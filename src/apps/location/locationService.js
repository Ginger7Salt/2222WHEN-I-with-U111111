// src/apps/location/locationService.js
//
// 纯浏览器 Geolocation API 封装，不依赖任何地图/逆地理编码服务。
// 只负责"拿到一次坐标"，不做任何存储或业务判断。

const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000,
};

// 地点小册子用的取点参数：开高精度（GPS），并且不用缓存的旧位置。
const PRECISE_GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 0,
};

export const isGeolocationSupported = () => (
  typeof navigator !== 'undefined' && 'geolocation' in navigator
);

const readPosition = (options) => new Promise((resolve, reject) => {
  if (!isGeolocationSupported()) {
    reject(new Error('GEOLOCATION_UNSUPPORTED'));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
    },
    (error) => {
      reject(error);
    },
    options,
  );
});

/**
 * 获取一次当前坐标（省电的粗定位，天气等功能在用，行为保持不变）。
 * 失败（用户拒绝权限 / 超时 / 不支持）时 reject，调用方需要 catch 并安全降级，
 * 不能让定位失败影响正常聊天。
 */
export const getCurrentPosition = () => readPosition(GEO_OPTIONS);

/**
 * 获取一次"更准"的坐标（地点小册子用）：先用高精度取点；
 * 高精度超时或失败（比如在室内、没有 GPS）就退回省电的粗定位再试一次。
 * 用户拒绝了权限、或者浏览器不支持定位时，直接 reject，不再重试。
 * 返回值里带 accuracy（误差范围，单位米），由调用方决定这次的点可不可信。
 */
export const getPrecisePosition = async () => {
  try {
    return await readPosition(PRECISE_GEO_OPTIONS);
  } catch (error) {
    if (error?.message === 'GEOLOCATION_UNSUPPORTED' || error?.code === 1) {
      throw error;
    }

    return readPosition(GEO_OPTIONS);
  }
};

export default {
  isGeolocationSupported,
  getCurrentPosition,
  getPrecisePosition,
};