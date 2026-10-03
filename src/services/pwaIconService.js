// pwaIconService.js
// 在 App 启动时调用 applyPwaIcon(iconUrl)，动态替换 manifest 的图标和 apple-touch-icon。
// 若 iconUrl 为空字符串，则不做任何修改（保持静态 manifest 原样）。
//
// 技术说明：PWA manifest 是静态文件，无法在运行时修改。
// 这里的做法是：读取现有 manifest 内容，注入自定义图标，
// 生成 Blob URL，再把 <link rel="manifest"> 指向这个 Blob URL。
// 已安装的 PWA 图标不会自动更新，用户需要卸载后重新"添加到主屏幕"。

let _blobUrl = null;

export async function applyPwaIcon(iconUrl) {
  if (!iconUrl || typeof iconUrl !== 'string') return;

  try {
    // 1. 读取现有 manifest（用于保留其他字段）
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return;

    let baseManifest = {};
    try {
      const response = await fetch(manifestLink.href);
      if (response.ok) {
        baseManifest = await response.json();
      }
    } catch {
      // 读取失败时用最小结构，不影响主流程
    }

    // 2. 构造新 manifest，注入自定义图标
    const newManifest = {
      ...baseManifest,
      icons: [
        {
          src: iconUrl,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: iconUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    };

    // 3. 生成 Blob URL 并替换 <link rel="manifest">
    if (_blobUrl) {
      URL.revokeObjectURL(_blobUrl);
    }
    const blob = new Blob([JSON.stringify(newManifest)], {
      type: 'application/manifest+json',
    });
    _blobUrl = URL.createObjectURL(blob);
    manifestLink.href = _blobUrl;

    // 4. 同时更新 apple-touch-icon（iOS 用这个，不读 manifest）
    const appleIcons = document.querySelectorAll(
      'link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]',
    );
    appleIcons.forEach((el) => {
      el.href = iconUrl;
    });
  } catch (error) {
    console.warn('[pwaIconService] 应用自定义图标失败:', error);
  }
}