// src/apps/rp/rpCardStylePresets.js
//
// RP模式消息卡片的样式预设（跟用户确认过的方案："预设为主+可微调"）——
// 每套预设决定 fontFamily / lineHeight / 圆角这三项一起换一套"质感"，
// 不单独暴露给用户逐项调；用户能手动微调的只有字号（session.fontSize）
// 和圆角覆盖值（session.cardCornerRadius，留空就跟着预设走）。
//
// 新增一套预设不需要动这个文件以外的任何地方——RpMessageCard.jsx 和
// RpRoomSettingsModal.jsx 都是从这个数组里找 id 对应的一项，找不到就退回
// 第一项（DEFAULT_CARD_PRESET_ID 对应那一项）。

export const RP_CARD_STYLE_PRESETS = [
  {
    id: 'classic-serif',
    name: '衬线古典',
    description: '衬线字体 + 宽松行距 + 圆角卡片，原来的默认样子。',
    fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif',
    lineHeight: 1.9,
    cornerRadius: 20,
  },
  {
    id: 'soft-round',
    name: '圆润宽松',
    description: '无衬线字体，行距更松、圆角更大，读起来更轻松。',
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    lineHeight: 2.05,
    cornerRadius: 28,
  },
  {
    id: 'square-compact',
    name: '方正紧凑',
    description: '无衬线字体，行距收紧、直角卡片，信息密度更高。',
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
    lineHeight: 1.6,
    cornerRadius: 6,
  },
];

export const DEFAULT_CARD_PRESET_ID = RP_CARD_STYLE_PRESETS[0].id;

export const getRpCardStylePreset = (presetId) => (
  RP_CARD_STYLE_PRESETS.find((p) => p.id === presetId) || RP_CARD_STYLE_PRESETS[0]
);

export default RP_CARD_STYLE_PRESETS;