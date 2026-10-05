// pwaIconService.js
let _blobUrl = null;
let _originalManifestHref = null;

function ensureLink(rel, attrs = {}) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

export async function applyPwaIcon(iconUrl) {
  if (!iconUrl || typeof iconUrl !== 'string') return;

  try {
    const absIcon = new URL(iconUrl, location.href).href;

    // 1. apple-touch-icon（iOS 主要读这个），没有就创建
    ensureLink('apple-touch-icon', { href: absIcon, sizes: '180x180' });

    // 2. manifest
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return;

    // 只记录一次"原始"地址，避免之后读到已被 revoke 的 blob
    if (!_originalManifestHref) _originalManifestHref = manifestLink.href;
    const origHref = _originalManifestHref;

    let base = {};
    try {
      const res = await fetch(origHref);
      if (res.ok) base = await res.json();
    } catch {}

    // blob URL 下相对路径会失效，统一转成绝对地址
    const abs = (p, fallback = '.') => new URL(p || fallback, origHref).href;

    const newManifest = {
      ...base,
      start_url: abs(base.start_url),
      scope: abs(base.scope),
      ...(base.id ? { id: abs(base.id) } : {}),
      icons: [
        { src: absIcon, sizes: '192x192', purpose: 'any' },
        { src: absIcon, sizes: '512x512', purpose: 'any' },
      ],
    };

    if (_blobUrl) URL.revokeObjectURL(_blobUrl);
    _blobUrl = URL.createObjectURL(
      new Blob([JSON.stringify(newManifest)], { type: 'application/manifest+json' }),
    );
    manifestLink.href = _blobUrl;
  } catch (e) {
    console.warn('[pwaIconService] 应用自定义图标失败:', e);
  }
}