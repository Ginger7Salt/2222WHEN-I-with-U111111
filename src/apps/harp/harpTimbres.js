// ============================================================
// 星光小竖琴 —— 音色注册表（纯数据/纯函数，不碰音频、不碰数据库）。
//
// 这里只放"有哪些音色、叫什么、怎么认"，真正的发声参数在 harpAudio.js。
// 单独成文件，是为了标签解析（harpTagParser.js）、提示词（harpPromptBlock.js）、
// 文字描述（harpDescribe.js）和选择器界面都能引用它，而不用把音频代码拖进来。
//
// 加新音色：
//   1) 在下面的 HARP_TIMBRES 里加一条（id 一旦存进数据库就不要改）；
//   2) 在 harpAudio.js 的 TIMBRE_VOICES 里加同一个 id 的发声参数。
// 其余文件都不用动。
//
// 存储约定：旋律消息的 metadata.timbre、收藏记录的 timbre、聊天的 harpTimbre
// 存的都是这里的 id。字段缺失一律当 DEFAULT_TIMBRE（经典竖琴）处理，
// 所以旧数据不需要任何迁移。
// ============================================================

export const DEFAULT_TIMBRE = 'harp';

// aliases：角色在 [HARP: ...] 标签里可能写出的叫法（不分大小写）。
export const HARP_TIMBRES = [
  {
    id: 'harp',
    label: '竖琴',
    aliases: ['竖琴', '经典', '经典竖琴', 'harp'],
    hint: '原来的星光竖琴',
  },
  {
    id: 'musicbox',
    label: '八音盒',
    aliases: ['八音盒', '音乐盒', 'music box', 'musicbox'],
    hint: '清脆短促，带一点金属叮声',
  },
  {
    id: 'pluck',
    label: '拨弦',
    aliases: ['拨弦', '吉他', '弹拨', 'pluck', 'guitar'],
    hint: '干净的拨弦，余音比竖琴短',
  },
];

// 把任何写法（id、中文名、别名）认成 id；认不出来返回 null。
export const normalizeTimbreId = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return null;

  const hit = HARP_TIMBRES.find(
    (timbre) =>
      timbre.id === key ||
      timbre.label.toLowerCase() === key ||
      timbre.aliases.some((alias) => alias.toLowerCase() === key)
  );
  return hit ? hit.id : null;
};

export const getTimbreLabel = (id) => {
  const hit = HARP_TIMBRES.find((timbre) => timbre.id === normalizeTimbreId(id));
  return hit ? hit.label : HARP_TIMBRES[0].label;
};