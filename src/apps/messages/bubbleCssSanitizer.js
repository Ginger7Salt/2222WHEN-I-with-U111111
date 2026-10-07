// src/apps/messages/bubbleCssSanitizer.js
//
// 角色自己写的气泡 CSS 在落库、渲染之前必须先过这一关。AI 写出来的文本
// 不可信，所以这里用"白名单"而不是"黑名单"：
//   - 选择器只认 .user-bubble / .ai-bubble（可叠加 .chat-font、.bubble-fresh、
//     常见伪类、::before / ::after），其它任何选择器整条规则丢掉；
//   - 属性只认下面的白名单，其它属性整行丢掉；
//   - 属性值里出现 url( / @ / 反斜杠 / 尖括号 / expression 等一律整行丢掉；
//   - @规则只认 @keyframes，名字统一加前缀，避免撞名；
//   - 总长度、规则条数设上限。
// 返回的 css 是"不带作用域前缀"的形式，跟 bubbleStylePresets.js 里的预设
// 同一种写法，所以存进样式库之后可以直接当配色预设用。渲染时再用
// scopeBubbleCss 套上 .chat-room-container 之类的作用域。

export const MAX_BUBBLE_CSS_LENGTH = 4000;
const MAX_RULES = 30;
const MAX_KEYFRAMES = 4;
const KEYFRAME_PREFIX = 'charcss_';

const ALLOWED_PROPERTIES = new Set([
  'background', 'background-color', 'background-image', 'background-size',
  'background-position', 'background-repeat', 'background-clip',
  'color', 'opacity',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-width', 'border-style', 'border-color', 'border-radius',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'outline', 'outline-offset',
  'box-shadow', 'text-shadow', 'filter', 'backdrop-filter',
  '-webkit-backdrop-filter',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'text-decoration',
  'transform', 'transform-origin',
  'transition',
  'animation', 'animation-name', 'animation-duration',
  'animation-timing-function', 'animation-delay',
  'animation-iteration-count', 'animation-direction', 'animation-fill-mode',
  'clip-path',
  // 伪元素装饰（::before / ::after）才用得到的几个。
  'content', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'min-width', 'min-height', 'z-index',
]);

// 选择器：一个气泡类 + 若干受限的修饰，不允许后代/兄弟组合、不允许标签、
// 不允许属性选择器。
const SELECTOR_PATTERN = new RegExp(
  '^\\.(?:user-bubble|ai-bubble)'
  + '(?:\\.(?:chat-font|bubble-fresh))*'
  + '(?::(?:hover|active|first-child|last-child)|::(?:before|after))*$'
);

const FORBIDDEN_VALUE_PATTERN = /url\s*\(|image-set\s*\(|expression\s*\(|javascript:|@|\\|<|>|\bvar\s*\(\s*--(?!accent|text|bg|card|control|divider)/i;

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');

// 把顶层的 `头 { 体 }` 切出来，支持 @keyframes 里嵌套一层花括号。
const splitTopLevelBlocks = (text) => {
  const blocks = [];
  let depth = 0;
  let head = '';
  let body = '';

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '{') {
      depth += 1;
      if (depth === 1) continue;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        blocks.push({ head: head.trim(), body });
        head = '';
        body = '';
        continue;
      }
      if (depth < 0) return null;
    }

    if (depth === 0) head += char;
    else body += char;
  }

  return depth === 0 ? blocks : null;
};

const sanitizeDeclarations = (body, { allowAnimationNames = true } = {}) => {
  const lines = [];

  body.split(';').forEach((rawDeclaration) => {
    const declaration = rawDeclaration.trim();
    if (!declaration) return;

    const colonIndex = declaration.indexOf(':');
    if (colonIndex <= 0) return;

    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    const value = declaration.slice(colonIndex + 1).replace(/!important/gi, '').trim();

    if (!ALLOWED_PROPERTIES.has(property)) return;
    if (!value || value.length > 300) return;
    if (FORBIDDEN_VALUE_PATTERN.test(value)) return;

    if (property === 'position' && !/^(relative|absolute)$/i.test(value)) return;
    if (property === 'z-index' && !/^-?[0-5]$/.test(value)) return;
    if (!allowAnimationNames && property.startsWith('animation')) return;

    // content 只允许纯字符串或 none，不允许 attr()/counter() 等函数。
    if (property === 'content' && !/^(none|"[^"]*"|'[^']*')$/.test(value)) return;

    lines.push(`${property}: ${value}`);
  });

  return lines;
};

const prefixKeyframeNames = (value, names) => {
  let next = value;
  names.forEach((name) => {
    const pattern = new RegExp(`(^|[\\s,])${name}(?=$|[\\s,])`, 'g');
    next = next.replace(pattern, `$1${KEYFRAME_PREFIX}${name}`);
  });
  return next;
};

export const sanitizeBubbleCss = (rawCss) => {
  const raw = String(rawCss || '').trim();

  if (!raw) return { ok: false, css: '', reason: 'empty' };
  if (raw.length > MAX_BUBBLE_CSS_LENGTH) return { ok: false, css: '', reason: 'too-long' };

  const blocks = splitTopLevelBlocks(stripComments(raw));
  if (!blocks) return { ok: false, css: '', reason: 'unbalanced' };

  // 先收集 @keyframes 的名字，后面才能给 animation 里引用它的地方加前缀。
  const keyframeBlocks = blocks.filter((block) => /^@keyframes\s+[A-Za-z][\w-]*$/i.test(block.head));
  const keyframeNames = keyframeBlocks
    .slice(0, MAX_KEYFRAMES)
    .map((block) => block.head.replace(/^@keyframes\s+/i, '').trim());

  const outputBlocks = [];

  blocks.forEach((block) => {
    if (outputBlocks.length >= MAX_RULES + MAX_KEYFRAMES) return;

    if (block.head.startsWith('@')) {
      const name = block.head.replace(/^@keyframes\s+/i, '').trim();
      if (!/^@keyframes\s+/i.test(block.head) || !keyframeNames.includes(name)) return;

      const frames = splitTopLevelBlocks(block.body);
      if (!frames) return;

      const frameLines = [];
      frames.forEach((frame) => {
        if (!/^(from|to|\d{1,3}%)(\s*,\s*(from|to|\d{1,3}%))*$/i.test(frame.head)) return;
        const declarations = sanitizeDeclarations(frame.body, { allowAnimationNames: false });
        if (declarations.length === 0) return;
        frameLines.push(`  ${frame.head} { ${declarations.join('; ')}; }`);
      });

      if (frameLines.length === 0) return;
      outputBlocks.push(`@keyframes ${KEYFRAME_PREFIX}${name} {\n${frameLines.join('\n')}\n}`);
      return;
    }

    const selectors = block.head
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean);

    if (selectors.length === 0) return;
    if (!selectors.every((selector) => SELECTOR_PATTERN.test(selector))) return;

    const declarations = sanitizeDeclarations(block.body)
      .map((line) => {
        const colonIndex = line.indexOf(':');
        const property = line.slice(0, colonIndex);
        const value = line.slice(colonIndex + 1).trim();
        return property.startsWith('animation')
          ? `${property}: ${prefixKeyframeNames(value, keyframeNames)}`
          : line;
      });

    if (declarations.length === 0) return;
    outputBlocks.push(`${selectors.join(', ')} { ${declarations.join('; ')}; }`);
  });

  const hasRule = outputBlocks.some((block) => !block.startsWith('@keyframes'));
  if (!hasRule) return { ok: false, css: '', reason: 'nothing-usable' };

  return { ok: true, css: outputBlocks.join('\n'), reason: '' };
};

// 给已经通过 sanitizeBubbleCss 的 css 套作用域。
// 作用域写两遍（.chat-room-container.chat-room-container）是为了把优先级
// 抬高一级，让角色写的样式能压过形状预设（.user-bubble.chat-font 三个类）
// 而不用 !important；@keyframes 不加作用域。
export const scopeBubbleCss = (css, scope = '.chat-room-container') => {
  const doubled = `${scope}${scope}`;
  const blocks = splitTopLevelBlocks(String(css || ''));
  if (!blocks) return '';

  return blocks
    .map((block) => {
      if (block.head.startsWith('@keyframes')) {
        return `${block.head} {${block.body}}`;
      }
      const scoped = block.head
        .split(',')
        .map((selector) => `${doubled} ${selector.trim()}`)
        .join(', ');
      return `${scoped} {${block.body}}`;
    })
    .join('\n');
};