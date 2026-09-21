// src/apps/location/placeService.js
//
// 地点归类核心逻辑：不依赖任何地图 API，只用 Haversine 公式判断
// "当前坐标是否落在某个已知地点的范围内"。地点名称完全由用户手动命名。
//
// 依赖 db.js 中新增的 places / locationSettings 两张表（见 db-patch 说明）。

import db from '../../db';

const DEFAULT_RADIUS_METERS = 150;
const EARTH_RADIUS_METERS = 6371000;

// 定位误差超过这个值（米）的点不可信：不用它来判断"到了哪里"，也不用它新建地点，稍后重试。
export const POOR_ACCURACY_METERS = 300;

// 这一次的点不可信时，多久之后再试一次。
export const POOR_ACCURACY_RETRY_MS = 10 * 60 * 1000;

// 判断"是否在某个地点范围内"时，把定位误差的一半（最多 50 米）算进半径里，
// 避免定位稍微飘一点，就被判成"离开了"。
const MAX_ACCURACY_RADIUS_BONUS_METERS = 50;

const toRad = (deg) => (deg * Math.PI) / 180;

export const haversineDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = (
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1))
    * Math.cos(toRad(lat2))
    * Math.sin(dLng / 2) ** 2
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
    currentStayStartedAt: null,
    lastCheckAt: 0,
    lastFixAt: 0,
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
    currentStayStartedAt: existing?.currentStayStartedAt ?? null,
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

// 定位误差换算成"半径加成"：误差的一半，最多 50 米。
const getAccuracyRadiusBonus = (accuracy) => {
  const value = Number(accuracy);

  if (!Number.isFinite(value) || value <= 0) return 0;

  return Math.min(value / 2, MAX_ACCURACY_RADIUS_BONUS_METERS);
};

// 在所有"已命名"地点里，找出坐标落在其 radius 范围内、且距离最近的一个。
// accuracy 是这次定位的误差（米），会略微放宽范围，可以不传。
export const findMatchingPlace = async (chatId, lat, lng, accuracy = 0) => {
  const places = await db.places
    .where('chatId')
    .equals(chatId)
    .and((place) => place.isNamed)
    .toArray();

  let closest = null;
  let closestDistance = Infinity;

  for (const place of places) {
    const distance = haversineDistanceMeters(
      lat,
      lng,
      place.lat,
      place.lng,
    );

    const radius = (place.radius || DEFAULT_RADIUS_METERS)
      + getAccuracyRadiusBonus(accuracy);

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
 * - skipped: 这次的定位误差太大（超过 POOR_ACCURACY_METERS），没有记录任何东西，
 *   调用方应该过一会儿再取一次点（place 为 null）
 */
export const checkLocationAndDetectTransition = async (chatId, coords) => {
  const { lat, lng } = coords;
  const accuracy = Number(coords.accuracy) || 0;
  const settings = await getLocationSettings(chatId);
  const timestamp = nowIso();

  // 误差太大的点不可信：不判断到了哪里，也不新建"新地方"，只记下这次尝试的时间。
  if (accuracy > POOR_ACCURACY_METERS) {
    await db.locationSettings.put({
      ...settings,
      lastCheckAt: Date.now(),
      updatedAt: timestamp,
    });

    return {
      place: null,
      hasTransitioned: false,
      isNewUnnamedPlace: false,
      skipped: true,
    };
  }

  const matchedPlace = await findMatchingPlace(chatId, lat, lng, accuracy);

  let resultPlaceId = null;
  let isNewUnnamedPlace = false;

  if (matchedPlace) {
    resultPlaceId = matchedPlace.id;

    // 只有"从别处到达这里"才算一次新到访。
    // 上次检查时已经在这个地点、只是继续停留，不重复计数。
    const isArrivingNow = settings.currentPlaceId !== matchedPlace.id;

    await db.places.update(matchedPlace.id, {
      lastVisitAt: timestamp,
      visitCount: isArrivingNow
        ? (matchedPlace.visitCount || 0) + 1
        : (matchedPlace.visitCount || 0),
    });
  } else {
    // 没命中任何已命名地点。看看是否离"上一条待命名记录"很近，
    // 是的话直接复用，避免同一个新地方反复创建多条待命名记录。
    const pendingPlace = settings.pendingNamingPlaceId
      ? await db.places.get(settings.pendingNamingPlaceId)
      : null;

    const isNearPending = pendingPlace && (
      haversineDistanceMeters(
        lat,
        lng,
        pendingPlace.lat,
        pendingPlace.lng,
      ) <= DEFAULT_RADIUS_METERS
    );

    if (isNearPending) {
      resultPlaceId = pendingPlace.id;
    } else {
      resultPlaceId = await db.places.add({
        chatId,
        name: '',
        note: '',
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

    // 只有真正发生地点转移时，才重置本次停留开始时间。
    // 如果仍在同一个地点，则保留原来的时间，用于计算当前已停留时长。
    currentStayStartedAt: hasTransitioned
      ? timestamp
      : (settings.currentStayStartedAt || timestamp),

    lastCheckAt: Date.now(),
    lastFixAt: Date.now(),
    updatedAt: timestamp,
  });

  const place = matchedPlace || await db.places.get(resultPlaceId);

  return {
    place,
    hasTransitioned,
    isNewUnnamedPlace,
    skipped: false,
  };
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

// 编辑已经存在的地点名称。
export const renamePlace = async (placeId, name) => {
  const trimmed = String(name || '').trim();

  if (!trimmed) return;

  await db.places.update(placeId, {
    name: trimmed,
  });
};

// 更新地点备注。
export const updatePlaceNote = async (placeId, note) => {
  await db.places.update(placeId, {
    note: String(note || '').trim(),
  });
};

export const updatePlaceRadius = async (placeId, radiusMeters) => {
  const radius = Number(radiusMeters);

  if (!Number.isFinite(radius) || radius <= 0) return;

  await db.places.update(placeId, {
    radius,
  });
};

export const deletePlace = async (chatId, placeId) => {
  await db.places.delete(placeId);

  // 这个地点下的小记录（placeMemories）一起删掉。
  await db.placeMemories.where('placeId').equals(placeId).delete();

  const settings = await getLocationSettings(chatId);

  const isCurrentPlace = settings.currentPlaceId === placeId;
  const isPendingNamingPlace = settings.pendingNamingPlaceId === placeId;

  if (isCurrentPlace || isPendingNamingPlace) {
    await db.locationSettings.put({
      ...settings,
      currentPlaceId: isCurrentPlace
        ? null
        : settings.currentPlaceId,
      pendingNamingPlaceId: isPendingNamingPlace
        ? null
        : settings.pendingNamingPlaceId,

      // 当前地点被删除后，原来的停留计时也应失效。
      currentStayStartedAt: isCurrentPlace
        ? null
        : settings.currentStayStartedAt,

      updatedAt: nowIso(),
    });
  }
};

// 获取当前地点已经连续停留的时长，单位为毫秒。
export const getCurrentStayDurationMs = (settings) => {
  if (!settings?.currentStayStartedAt) return 0;

  return Date.now() - new Date(
    settings.currentStayStartedAt,
  ).getTime();
};

// 判断距离上次检查是否已经超过给定的轮询间隔。
export const shouldCheckLocation = (settings, intervalMs) => {
  if (!settings?.enabled) return false;

  const last = settings.lastCheckAt || 0;

  return Date.now() - last >= intervalMs;
};

// 距离上一次成功取点已经过了多久（毫秒）；从没取过点返回 Infinity。
// 旧数据没有 lastFixAt，就用 lastCheckAt 代替。
export const getLocationFixAgeMs = (settings, now = Date.now()) => {
  const last = settings?.lastFixAt || settings?.lastCheckAt || 0;

  return last ? Math.max(0, now - last) : Infinity;
};

// 每次成功取点后，随机 10～20 分钟再取下一次（只在聊天室开着时才会取），
// 避免产生规律感。
export const getRandomCheckIntervalMs = () => {
  const tenMinutes = 10 * 60 * 1000;

  return tenMinutes + Math.random() * tenMinutes;
};

export default {
  haversineDistanceMeters,
  getLocationSettings,
  setLocationEnabled,
  listPlaces,
  findMatchingPlace,
  checkLocationAndDetectTransition,
  namePlace,
  renamePlace,
  updatePlaceNote,
  updatePlaceRadius,
  deletePlace,
  getCurrentStayDurationMs,
  shouldCheckLocation,
  getRandomCheckIntervalMs,
  getLocationFixAgeMs,
};