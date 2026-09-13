/**
 * 压缩图片文件
 *
 * @param {File} file
 * @param {Object} options
 * @param {number} options.maxWidth 最大宽度
 * @param {number} options.maxHeight 最大高度
 * @param {number} options.quality 图片质量，0 - 1
 * @param {'base64'|'blob'} options.outputType 输出类型
 * @returns {Promise<string|Blob>}
 */
export const compressImageFile = (
  file,
  {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.78,
    outputType = 'base64'
  } = {}
) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('请选择有效的图片文件。'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('读取图片失败。'));
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(new Error('图片解析失败。'));
      };

      image.onload = () => {
        let width = image.width;
        let height = image.height;

        const scale = Math.min(
          maxWidth / width,
          maxHeight / height,
          1
        );

        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('当前浏览器不支持 Canvas。'));
          return;
        }

        // 白色背景，避免透明 PNG 转 JPEG 后出现黑色背景
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);

        context.drawImage(image, 0, 0, width, height);

        // 统一输出 JPEG，体积更小，适合保存到 IndexedDB
        const mimeType = 'image/jpeg';

        if (outputType === 'blob') {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('图片压缩失败。'));
                return;
              }

              resolve(blob);
            },
            mimeType,
            quality
          );

          return;
        }

        try {
          const base64 = canvas.toDataURL(mimeType, quality);
          resolve(base64);
        } catch (error) {
          reject(error);
        }
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
};

export default compressImageFile;
