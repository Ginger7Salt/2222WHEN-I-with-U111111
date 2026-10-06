// src/apps/textgames/liarsDice/liarsDiceNpcs.js
//
// 虚拟 NPC：用户选的角色不够三位时，用这里的 NPC 把四人桌补满。
// NPC 不是 db.characters 里的真实角色：没有聊天，所以对局结束后不会往
// 他们的聊天里发消息（见 liarsDiceService.js），台词用通用兜底句子。
// 形状跟真角色保持一致（至少有 id、name），其余字段缺省即可。

export const NPC_ID_PREFIX = 'npc-liars-dice-';
export const TABLE_CHARACTER_COUNT = 3;

export const NPC_POOL = [
  { id: `${NPC_ID_PREFIX}1`, name: '旅店老板' },
  { id: `${NPC_ID_PREFIX}2`, name: '戴帽的客人' },
  { id: `${NPC_ID_PREFIX}3`, name: '角落里的老人' },
];

export const isNpcId = (id) => typeof id === 'string' && id.startsWith(NPC_ID_PREFIX);

// 把用户选的角色（0 到 3 位）补成正好 count 位，真角色在前，NPC 在后。
// 超过 count 位时只取前 count 位。
export const fillWithNpcs = (characters, count = TABLE_CHARACTER_COUNT) => {
  const real = (characters || []).filter(Boolean).slice(0, count);
  const npcs = NPC_POOL.slice(0, count - real.length).map((npc) => ({ ...npc, isNpc: true }));
  return [...real, ...npcs];
};