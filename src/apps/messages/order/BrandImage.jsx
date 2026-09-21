import React, { useState } from 'react';
import { getBrandImageUrl } from './orderBrands';

/**
 * 品牌图片。
 * - 懒加载、异步解码，不占用首屏资源；
 * - 图片文件不存在或加载失败时，显示柔和的渐变色块加品牌首字，不会出现破图图标。
 */
export const BrandImage = ({ brand, name = '', className = '', fit = 'contain' }) => {
  const [failed, setFailed] = useState(false);
  const url = getBrandImageUrl(brand);
  const showImage = Boolean(url) && !failed;
  const initial = String(name || brand?.name || '').trim().slice(0, 1);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background:
          'linear-gradient(135deg, var(--control-soft-bg), var(--card-bg))',
      }}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className={`h-full w-full ${
            fit === 'cover' ? 'object-cover' : 'object-contain'
          }`}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold opacity-40">
          {initial}
        </span>
      )}
    </div>
  );
};

export default BrandImage;