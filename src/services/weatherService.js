// src/services/weatherService.js
//
// "今日穿搭"用的自动天气。
// 数据来源：Open-Meteo（免费、不需要 API Key、支持浏览器直接访问）。
// 只会向它发送"取整到小数点后两位（约一公里）的坐标"，不发送任何其他个人信息。
//
// 所有失败都安全降级：返回 { status: 'error' }，界面退回手动选择天气。

import db from '../db';
import { getCurrentPosition } from '../apps/location/locationService';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const REQUEST_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CITY_RESULTS = 5;
const MAX_QUERY_LENGTH = 40;

// 强风的界线（米/秒，蒲福风级 6 级）。天气本身是晴、多云、阴时，风大就记成"风"。
const STRONG_WIND_MS = 10.8;

// 穿搭页温度输入框最多 8 个字符，超过时改为只显示最高温。
const MAX_TEMP_TEXT_LENGTH = 8;

const LOCATION_SETTING_KEY = 'outfitWeatherLocation';
const UNIT_SETTING_KEY = 'outfitTempUnit';

export const WEATHER_ATTRIBUTION = 'Open-Meteo';

const roundCoord = (value) => Math.round(Number(value) * 100) / 100;

const isValidCoord = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

// ---------- 设置：地点与温度单位 ----------

export const getWeatherLocation = async () => {
  try {
    const setting = await db.settings.get(LOCATION_SETTING_KEY);
    const value = setting?.value;

    if (!value || !isValidCoord(Number(value.lat), Number(value.lng))) {
      return null;
    }

    return {
      name: String(value.name || '').slice(0, 40) || '已选地点',
      lat: Number(value.lat),
      lng: Number(value.lng),
    };
  } catch (err) {
    console.error('[weatherService] 读取地点失败：', err);
    return null;
  }
};

export const saveWeatherLocation = async ({ name, lat, lng }) => {
  const latitude = roundCoord(lat);
  const longitude = roundCoord(lng);

  if (!isValidCoord(latitude, longitude)) return null;

  const value = {
    name: String(name || '').trim().slice(0, 40) || '已选地点',
    lat: latitude,
    lng: longitude,
  };

  await db.settings.put({ key: LOCATION_SETTING_KEY, value });

  return value;
};

export const clearWeatherLocation = async () => {
  await db.settings.delete(LOCATION_SETTING_KEY);
};

export const getTempUnit = async () => {
  try {
    const setting = await db.settings.get(UNIT_SETTING_KEY);

    return setting?.value === 'F' ? 'F' : 'C';
  } catch (err) {
    return 'C';
  }
};

export const setTempUnit = async (unit) => {
  const value = unit === 'F' ? 'F' : 'C';

  await db.settings.put({ key: UNIT_SETTING_KEY, value });

  return value;
};

// ---------- 城市搜索与当前定位 ----------

/**
 * 按名字搜索城市，最多返回 5 条。
 * 同名城市会带上省份和国家，方便区分。
 */
export const searchCities = async (query) => {
  const name = String(query || '').trim().slice(0, MAX_QUERY_LENGTH);

  if (!name) return { status: 'empty', results: [] };

  try {
    const params = new URLSearchParams({
      name,
      count: String(MAX_CITY_RESULTS),
      language: 'zh',
      format: 'json',
    });

    const data = await fetchJson(`${GEOCODE_URL}?${params.toString()}`);

    const results = (Array.isArray(data?.results) ? data.results : [])
      .filter((item) => isValidCoord(Number(item?.latitude), Number(item?.longitude)))
      .slice(0, MAX_CITY_RESULTS)
      .map((item) => {
        const detail = [item.admin1, item.country]
          .filter((part) => part && part !== item.name)
          .join(' · ');

        return {
          id: String(item.id ?? `${item.latitude},${item.longitude}`),
          name: String(item.name || name),
          detail,
          lat: Number(item.latitude),
          lng: Number(item.longitude),
        };
      });

    return { status: 'success', results };
  } catch (err) {
    console.error('[weatherService] 搜索城市失败：', err);
    return { status: 'error', results: [] };
  }
};

/**
 * 用设备定位取一次坐标（需要浏览器授权）。
 * 只取一次，不持续追踪；坐标取整后才保存。
 */
export const locateByDevice = async () => {
  try {
    const position = await getCurrentPosition();

    return {
      status: 'success',
      lat: roundCoord(position.lat),
      lng: roundCoord(position.lng),
    };
  } catch (err) {
    return {
      status: err?.code === 1 ? 'denied' : 'error',
    };
  }
};

// ---------- 天气 ----------

/**
 * 把 WMO 天气代码转成穿搭页的 7 个选项之一。
 * 用的是"当天最严重的天气"，所以下午才下的雨也会被算进来。
 */
export const mapWeatherCode = (code, windMs = 0) => {
  const c = Number(code);
  let label = '';

  if (c === 0 || c === 1) label = '晴';
  else if (c === 2) label = '多云';
  else if (c === 3) label = '阴';
  else if (c === 45 || c === 48) label = '雾';
  else if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95 && c <= 99)) label = '雨';
  else if ((c >= 71 && c <= 77) || c === 85 || c === 86) label = '雪';

  if (['晴', '多云', '阴'].includes(label) && Number(windMs) >= STRONG_WIND_MS) {
    return '风';
  }

  return label;
};

export const formatTempRange = (min, max, unit) => {
  const low = Math.round(min);
  const high = Math.round(max);
  const suffix = `°${unit}`;

  const range = low === high ? `${high}${suffix}` : `${low}~${high}${suffix}`;

  return range.length <= MAX_TEMP_TEXT_LENGTH ? range : `${high}${suffix}`;
};

const weatherCache = new Map();
const weatherInFlight = new Map();

const requestTodayWeather = async ({ lat, lng, unit }) => {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '1',
    wind_speed_unit: 'ms',
    temperature_unit: unit === 'F' ? 'fahrenheit' : 'celsius',
  });

  const data = await fetchJson(`${FORECAST_URL}?${params.toString()}`);

  const daily = data?.daily;
  const max = Number(daily?.temperature_2m_max?.[0]);
  const min = Number(daily?.temperature_2m_min?.[0]);

  if (!Number.isFinite(max) || !Number.isFinite(min)) {
    throw new Error('BAD_RESPONSE');
  }

  return {
    label: mapWeatherCode(daily?.weather_code?.[0], daily?.wind_speed_10m_max?.[0]),
    temp: formatTempRange(min, max, unit === 'F' ? 'F' : 'C'),
    // 供"昼夜进度条"一类的展示用：当地日出/日落（不带时区偏移的本地时间字符串，
    // 例如 "2026-09-25T06:12"）以及该地点相对 UTC 的偏移秒数。两者都是
    // 附加字段，不影响原有只读 label/temp 的调用方（如"今日穿搭"）。
    sunrise: typeof daily?.sunrise?.[0] === 'string' ? daily.sunrise[0] : null,
    sunset: typeof daily?.sunset?.[0] === 'string' ? daily.sunset[0] : null,
    utcOffsetSeconds: Number.isFinite(Number(data?.utc_offset_seconds))
      ? Number(data.utc_offset_seconds)
      : 0,
  };
};

/**
 * 获取某个地点"今天"的天气，返回 { status, weather: { label, temp } }。
 * 同一地点 30 分钟内直接用缓存；同时发起的相同请求只会真正请求一次。
 */
export const fetchTodayWeather = async ({ lat, lng, unit = 'C' }) => {
  const latitude = roundCoord(lat);
  const longitude = roundCoord(lng);

  if (!isValidCoord(latitude, longitude)) {
    return { status: 'error' };
  }

  const key = `${latitude},${longitude},${unit}`;
  const cached = weatherCache.get(key);

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { status: 'success', weather: cached.weather };
  }

  if (weatherInFlight.has(key)) {
    return weatherInFlight.get(key);
  }

  const promise = requestTodayWeather({ lat: latitude, lng: longitude, unit })
    .then((weather) => {
      weatherCache.set(key, { at: Date.now(), weather });

      return { status: 'success', weather };
    })
    .catch((err) => {
      console.error('[weatherService] 获取天气失败：', err);

      return { status: 'error' };
    })
    .finally(() => {
      weatherInFlight.delete(key);
    });

  weatherInFlight.set(key, promise);

  return promise;
};

// ---------- 昼夜进度 ----------

// 把 Open-Meteo 返回的"本地墙上时间"字符串（没有时区偏移，例如
// "2026-09-25T06:12"）换算成真正的 UTC 毫秒数：先当成 UTC 解析，
// 再减去该地点相对 UTC 的偏移，得到的就是这一刻在全球统一时间线上
// 真正对应的时间点，方便和 Date.now() 直接比较。
const localWallTimeToUtcMs = (isoLikeString, utcOffsetSeconds) => {
  const asUtc = Date.parse(`${isoLikeString}Z`);

  if (!Number.isFinite(asUtc)) return null;

  return asUtc - utcOffsetSeconds * 1000;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 根据"今天"的日出/日落，算出此刻是白天还是夜晚，以及在当前这一段
 * （白天：日出→日落；夜晚：日落→次日日出）里走到了百分之多少。
 * 夜晚的另一端（昨天日落 / 明天日出）没有请求过，就近似地用
 * "今天日落/日出 ± 24 小时"代替——对于装饰性的进度条来说已经足够，
 * 不追求天文级精确。
 *
 * 返回 { phase: 'day' | 'night', fraction: 0~1 } ；数据不完整时返回 null。
 */
export const computeDayNightProgress = ({ sunrise, sunset, utcOffsetSeconds = 0 }) => {
  if (!sunrise || !sunset) return null;

  const sunriseMs = localWallTimeToUtcMs(sunrise, utcOffsetSeconds);
  const sunsetMs = localWallTimeToUtcMs(sunset, utcOffsetSeconds);

  if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs) || sunsetMs <= sunriseMs) {
    return null;
  }

  const nowMs = Date.now();

  if (nowMs >= sunriseMs && nowMs <= sunsetMs) {
    return {
      phase: 'day',
      fraction: (nowMs - sunriseMs) / (sunsetMs - sunriseMs),
    };
  }

  const nightStartMs = nowMs > sunsetMs ? sunsetMs : sunsetMs - DAY_MS;
  const nightEndMs = nowMs > sunsetMs ? sunriseMs + DAY_MS : sunriseMs;

  if (nightEndMs <= nightStartMs) return null;

  return {
    phase: 'night',
    fraction: Math.min(1, Math.max(0, (nowMs - nightStartMs) / (nightEndMs - nightStartMs))),
  };
};