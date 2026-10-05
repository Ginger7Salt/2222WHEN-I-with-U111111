// src/apps/textgames/undercover/undercoverNpc.js
//
// 真实角色不够 5 个时的临时 NPC 补位（设计确认）。NPC 只在这一局里
// 存在，不写进 db.characters，发言/投票逻辑跟真实角色完全一样（都走
// undercoverAiService.js 的同一套 AI 调用），区别只在：
// 1. id 是本局内的临时字符串，不是 db.characters 的真实 id；
// 2. isNpc: true，让结算时跳过"写回这位的聊天"这一步（NPC 没有聊天）；
// 3. bio 是一句通用、轻量的人设描述，不需要跟真实角色一样丰富——NPC
//    本来就只是补位凑人数，不追求有记忆/有延续性的角色感。

const NPC_NAME_POOL = ['阿九', '小满', '阿柒', '阿橙', '小鹿', '阿禾', '小溪', '阿岚'];

const NPC_BIO_POOL = [
  '说话直来直去，喜欢就事论事，不怎么绕弯子。',
  '性格有点迷糊，描述东西经常抓不住重点，但很真诚。',
  '脑子转得快，喜欢观察别人的反应，说话留一点心眼。',
  '嘴上随意，其实心里门儿清，喜欢用玩笑带过真正的判断。',
];

const shuffle = (list, rng) => {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// count：需要补几个 NPC。excludeNames：已经选中的真实角色名字，避免
// NPC 随机撞同名（概率很低，但顺手避开）。
export const generateNpcSeats = (count, excludeNames = [], rng = Math.random) => {
  const excluded = new Set(excludeNames);
  const availableNames = shuffle(
    NPC_NAME_POOL.filter((n) => !excluded.has(n)),
    rng
  );
  const shuffledBios = shuffle(NPC_BIO_POOL, rng);

  return Array.from({ length: count }).map((_, i) => ({
    id: `npc-${Date.now()}-${i}`,
    name: availableNames[i] || `路人${i + 1}`,
    avatar: null,
    bio: shuffledBios[i % shuffledBios.length],
    isNpc: true,
    isUser: false,
  }));
};