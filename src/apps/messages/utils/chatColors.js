const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export const isValidHexColor = (value) => (
  typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
);

const toLinear = (channel) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/*
 * 按 WCAG 相对亮度，给一个底色挑选看得清的文字颜色（深色或白色）。
 * 传入前必须先用 isValidHexColor 校验。
 */
export const getReadableTextColor = (hex) => {
  const r = toLinear(parseInt(hex.slice(1, 3), 16));
  const g = toLinear(parseInt(hex.slice(3, 5), 16));
  const b = toLinear(parseInt(hex.slice(5, 7), 16));

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.179 ? '#1c1917' : '#ffffff';
};