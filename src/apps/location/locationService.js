// src/apps/location/locationService.js
//
// 纯浏览器 Geolocation API 封装，不依赖任何地图/逆地理编码服务。
// 只负责"拿到一次坐标"，不做任何存储或业务判断。

const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000,
};

export const isGeolocationSupported = () => (
  typeof navigator !== 'undefined' && 'geolocation' in navigator
);

/**
 * 获取一次当前坐标。
 * 失败（用户拒绝权限 / 超时 / 不支持）时 reject，调用方需要 catch 并安全降级，
 * 不能让定位失败影响正常聊天。
 */
export const getCurrentPosition = () => new Promise((resolve, reject) => {
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
    GEO_OPTIONS,
  );
});

export default {
  isGeolocationSupported,
  getCurrentPosition,
};