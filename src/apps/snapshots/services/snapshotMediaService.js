// src/apps/snapshots/services/snapshotMediaService.js

/**
 * 将用户上传的本地 File 图片进行等比缩放和压缩，控制在安全体积内 (最大 1200px，画质 0.82)
 * 返回安全的 Base64 DataURL
 */
export const compressImageFile = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('请选择有效的图片文件'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败，可能已损坏'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(e.target.result);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // 优先使用现代化 webp 压缩，不支持则优雅降级为 jpeg
        try {
          const compressedDataUrl = canvas.toDataURL('image/webp', quality);
          resolve(compressedDataUrl);
        } catch {
          const fallbackDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(fallbackDataUrl);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * 校验字符串是否为合法的网络图片链接
 */
export const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return /^https?:\/\/.+/i.test(trimmed);
};
