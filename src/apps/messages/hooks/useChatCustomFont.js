import { useEffect, useMemo, useState } from 'react';

const FONT_FILE_PATTERN = /\.(woff2?|ttf|otf)(\?[^#]*)?(#.*)?$/i;
const INTERNAL_FONT_FAMILY = 'WIU Chat Custom Font';
const GENERIC_FALLBACK = 'sans-serif';

export const isFontFileUrl = (url) => FONT_FILE_PATTERN.test(url);

const sanitizeFamilyName = (name) => (
  String(name || '').replace(/["'\\;{}<>]/g, '').trim()
);

/*
 * 按需加载用户为本聊天窗填写的自定义字体。
 * - 字体文件网址（.woff2 / .ttf / .otf）：用 FontFace 加载。
 * - 字体 CSS 网址（如 Google Fonts）：临时插入 <link>，需要用户同时填写字体名称。
 * - 未填写时不发任何请求；离开聊天窗或修改网址时会清理掉。
 * status: idle | loading | ready | failed | needs-name
 */
export const useChatCustomFont = (fontUrl, fontFamily) => {
  const url = String(fontUrl || '').trim();
  const isFile = url ? isFontFileUrl(url) : false;
  const family = isFile ? '' : sanitizeFamilyName(fontFamily);

  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!url) {
      setStatus('idle');
      return undefined;
    }

    // 站点是 https，http 字体会被浏览器拦截，直接判定失败
    if (!/^https:\/\//i.test(url)) {
      setStatus('failed');
      return undefined;
    }

    let cancelled = false;

    if (isFile) {
      setStatus('loading');

      const face = new FontFace(
        INTERNAL_FONT_FAMILY,
        `url("${url.replace(/"/g, '%22')}")`,
        { display: 'swap' },
      );

      face
        .load()
        .then(() => {
          if (cancelled) return;
          document.fonts.add(face);
          setStatus('ready');
        })
        .catch(() => {
          if (!cancelled) setStatus('failed');
        });

      return () => {
        cancelled = true;
        document.fonts.delete(face);
      };
    }

    if (!family) {
      setStatus('needs-name');
      return undefined;
    }

    setStatus('loading');

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => {
      if (!cancelled) setStatus('ready');
    };
    link.onerror = () => {
      if (!cancelled) setStatus('failed');
    };
    document.head.appendChild(link);

    return () => {
      cancelled = true;
      link.remove();
    };
  }, [url, isFile, family]);

  const fontFamilyValue = useMemo(() => {
    if (status !== 'ready') return null;

    const name = isFile ? INTERNAL_FONT_FAMILY : family;
    return `"${name}", ${GENERIC_FALLBACK}`;
  }, [status, isFile, family]);

  return { fontFamilyValue, status };
};