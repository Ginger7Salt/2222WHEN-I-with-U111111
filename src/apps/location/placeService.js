// src/apps/location/placeService.js
//
// 地点归类核心逻辑：不依赖任何地图 API，只用 Haversine 公式判断
// "当前坐标是否落在某个已知地点的范围内"。地点名称完全由用户手动命名。
//
// 依赖 db.js 中新增的 places / locationSettings 两张表（见 db-patch 说明）。

import db from '../../db';

const DEFAULT_RADIUS_METERS = 150;
const EARTH_RADIUS_METERS = 6371000;

const toRad = (deg) => (deg * Math.PI) / 180;

export const haversineDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = (
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  );
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

const nowIso = () => new Date().toISOString();

export const getLocationSettings = async (chatId) => {
  const settings = await db.locationSettings.get(chatId);

  return settings || {
    chatId,
    enabled: false,
    currentPlaceId: null,
    pendingNamingPlaceId: null,
    lastCheckAt: 0,
    updatedAt: null,
  };
};

export const setLocationEnabled = async (chatId, enabled) => {
  const existing = await db.locationSettings.get(chatId);

  await db.locationSettings.put({
    chatId,
    enabled: Boolean(enabled),
    currentPlaceId: existing?.currentPlaceId ?? null,
    pendingNamingPlaceId: existing?.pendingNamingPlaceId ?? null,
    lastCheckAt: existing?.lastCheckAt ?? 0,
    updatedAt: nowIso(),
  });
};

export const listPlaces = async (chatId) => (
  db.places
    .where('chatId')
    .equals(chatId)
    .and((place) => place.isNamed)
    .reverse()
    .sortBy('lastVisitAt')
);

// 在所有"已命名"地点里，找出坐标落在其 radius 范围内、且距离最近的一个。
export const findMatchingPlace = async (chatId, lat, lng) => {
  const places = await db.places
    .where('chatId')
    .equals(chatId)
    .and((place) => place.isNamed)
    .toArray();

  let closest = null;
  let closestDistance = Infinity;

  for (const place of places) {
    const distance = haversineDistanceMeters(lat, lng, place.lat, place.lng);
    const radius = place.radius || DEFAULT_RADIUS_METERS;

    if (distance <= radius && distance < closestDistance) {
      closest = place;
      closestDistance = distance;
    }
  }

  return closest;
};

/**
 * 主流程：拿到一次坐标后，匹配/新建地点记录，并判断是否发生了"转移"。
 *
 * 返回：
 * - place: 匹配到的（或新建的）地点记录
 * - hasTransitioned: 是否与上次记录的 currentPlaceId 不同
 * - isNewUnnamedPlace: 这次是不是刚创建了一条待命名记录（需要提示用户命名）
 */
export const checkLocationAndDetectTransition = async (chatId, coords) => {
  const { lat, lng } = coords;
  const settings = await getLocationSettings(chatId);
  const timestamp = nowIso();

  const matchedPlace = await findMatchingPlace(chatId, lat, lng);
  let resultPlaceId = null;
  let isNewUnnamedPlace = false;

  if (matchedPlace) {
    resultPlaceId = matchedPlace.id;

    await db.places.update(matchedPlace.id, {
      lastVisitAt: timestamp,
      visitCount: (matchedPlace.visitCount || 0) + 1,
    });
  } else {
    // 没命中任何已命名地点。看看是否离"上一条待命名记录"很近，
    // 是的话直接复用，避免同一个新地方反复创建多条待命名记录。
    const pendingPlace = settings.pendingNamingPlaceId
      ? await db.places.get(settings.pendingNamingPlaceId)
      : null;

    const isNearPending = pendingPlace && (
      haversineDistanceMeters(lat, lng, pendingPlace.lat, pendingPlace.lng)
      <= DEFAULT_RADIUS_METERS
    );

    if (isNearPending) {
      resultPlaceId = pendingPlace.id;
    } else {
      resultPlaceId = await db.places.add({
        chatId,
        name: '',
        lat,
        lng,
        radius: DEFAULT_RADIUS_METERS,
        isNamed: false,
        firstVisitAt: timestamp,
        lastVisitAt: timestamp,
        visitCount: 1,
        createdAt: timestamp,
      });

      isNewUnnamedPlace = true;
    }
  }

  const hasTransitioned = settings.currentPlaceId !== resultPlaceId;

  await db.locationSettings.put({
    ...settings,
    currentPlaceId: resultPlaceId,
    pendingNamingPlaceId: isNewUnnamedPlace
      ? resultPlaceId
      : (matchedPlace ? null : settings.pendingNamingPlaceId),
    lastCheckAt: Date.now(),
    updatedAt: timestamp,
  });

  const place = matchedPlace || await db.places.get(resultPlaceId);

  return { place, hasTransitioned, isNewUnnamedPlace };
};

// 用户为一个待命名地点起名字，命名后它才会参与后续匹配。
export const namePlace = async (placeId, name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return;

  await db.places.update(placeId, {
    name: trimmed,
    isNamed: true,
  });
};

export const updatePlaceRadius = async (placeId, radiusMeters) => {
  const radius = Number(radiusMeters);
  if (!Number.isFinite(radius) || radius <= 0) return;

  await db.places.update(placeId, { radius });
};

export const deletePlace = async (chatId, placeId) => {
  await db.places.delete(placeId);

  const settings = await getLocationSettings(chatId);

  if (settings.currentPlaceId === placeId || settings.pendingNamingPlaceId === placeId) {
    await db.locationSettings.put({
      ...settings,
      currentPlaceId: settings.currentPlaceId === placeId ? null : settings.currentPlaceId,
      pendingNamingPlaceId: settings.pendingNamingPlaceId === placeId
        ? null
        : settings.pendingNamingPlaceId,
      updatedAt: nowIso(),
    });
  }
};

// 判断距离上次检查是否已经超过给定的轮询间隔（默认 1.5 小时，带随机浮动）。
export const shouldCheckLocation = (settings, intervalMs) => {
  if (!settings?.enabled) return false;
  const last = settings.lastCheckAt || 0;
  return Date.now() - last >= intervalMs;
};

export const getRandomCheckIntervalMs = () => {
  const oneHour = 60 * 60 * 1000;
  return oneHour + Math.random() * oneHour; // 1~2小时之间随机
};

export default {
  haversineDistanceMeters,
  getLocationSettings,
  setLocationEnabled,
  listPlaces,
  findMatchingPlace,
  checkLocationAndDetectTransition,
  namePlace,
  updatePlaceRadius,
  deletePlace,
  shouldCheckLocation,
  getRandomCheckIntervalMs,
};