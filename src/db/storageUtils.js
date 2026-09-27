// 本地存储空间估算
export const estimateStorageUsage = async () => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
    const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
    return { usedMB, quotaMB };
  }
  return { usedMB: '未知', quotaMB: '未知' };
};

// 2026-09：整体存储占用预警的阈值（首页角标用，见 StorageWarningBadge.jsx）。
// 目前只做"超过就提醒"，不做自动清理——真要清理时，按已确认的方向
// 只清语音消息的音频本体（metadata.audioBlob），保留文字转写，绝不整条删除。
export const STORAGE_WARNING_THRESHOLD_BYTES = 1024 * 1024 * 1024; // 1GB

/**
 * 跟 estimateStorageUsage 类似，但返回原始字节数（不是格式化好的字符串），
 * 方便调用方自己拿去跟阈值比较、或者用 formatBytes 自己格式化展示。
 */
export const getStorageUsageBytes = async () => {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { supported: false, usage: 0, quota: 0 };
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      supported: true,
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  } catch (error) {
    console.warn('[storageUtils] 存储空间估算失败：', error);
    return { supported: false, usage: 0, quota: 0 };
  }
};

export const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

/**
 * 悄悄压缩图片并转为 Base64
 * 
 * 这是一个“无感拦截”函数。
 * 外部调用方式完全不变，内部自动对大图进行等比例缩放和质量压缩，
 * 彻底解决高分辨率图片撑爆浏览器内存（RAM）和数据库的问题。
 */
export const convertFileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    // 1. 安全校验：如果不是图片，或者文件损坏，直接走原生 FileReader
    if (!file || !file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      return;
    }

    // 2. 动图 GIF 避开 Canvas 压缩（防止动图变成静态图）
    if (file.type === 'image/gif') {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      return;
    }

    // 3. 针对普通图片（PNG/JPG/WEBP），在内存中通过 Canvas 压缩
    const tempUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = tempUrl;

    img.onload = () => {
      // 释放临时 URL 内存占用
      URL.revokeObjectURL(tempUrl);

      // 设置最大分辨率（头像、日记配图、贴纸在此分辨率下都非常清晰）
      const MAX_WIDTH = 900;
      const MAX_HEIGHT = 900;
      let width = img.width;
      let height = img.height;

      // 等比例缩放
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        // Canvas 创建失败时，使用无损兜底
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // 自动转为高兼容且压缩率极高的 jpeg 格式，压缩质量设为 0.75 (体积仅为原图的 5%~10%)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
      resolve(compressedBase64);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(tempUrl);
      // 发生错误时，使用无损 FileReader 兜底，确保上传功能不挂掉
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    };
  });
};

export default {
  convertFileToBase64,
  estimateStorageUsage,
  getStorageUsageBytes,
  formatBytes,
  STORAGE_WARNING_THRESHOLD_BYTES,
};