// src/apps/shell/shellPromptBuilder.js
//
// 潮汐贝壳打捞时的 system prompt 组装。核心边界（设计确认稿原话）：
// 「内容彻底独立于当前 chat 的 timeline 和相处记忆，不参考任何已有
//   关系状态」——所以这里完全不读 messages/memoryProvider，只用
// 角色本身的人设资料 + 这次随机抽到的身份/形式。

import { IDENTITY, FORM } from './shellTypes';

const IDENTITY_BRIEF = {
  [IDENTITY.SELF]: (charName) => (
    `这不是"当前这段关系"里的${charName}，而是 ta 人生时间线上的另一个`
    + '切片——可以是更年轻、更年长的 ta，是认识 user 之前的 ta，或者是'
    + '很久以后某种假想未来里的 ta。身份仍然连续、仍然是同一个人，只是'
    + '站在了不同的人生阶段回头看或往前看。'
  ),
  [IDENTITY.PARALLEL]: (charName) => (
    `这是一个彻底架空的"平行世界的${charName}"——跟当前这个${charName}`
    + '没有身份连续性，是纯虚构、独立编织出来的另一种可能性，不基于 ta'
    + '在其他世界线（chat）里的真实经历，可以拥有完全不同的境遇、身份、'
    + '人生轨迹。'
  ),
};

const FORM_BRIEF = {
  [FORM.MONOLOGUE]: '一段没有说出口的内心独白——只对自己讲的话，不是写给谁看的。',
  [FORM.LETTER]: '一封写给 user 的信——明确知道对方是谁、想对 ta 说些什么。',
  [FORM.DIARY]: '一篇日记——记录当下某一天、某个瞬间，带着私人记录的口吻。',
  [FORM.SLICE]: '一段生活片段的白描——像随手截下的一帧画面，不必是完整的心事。',
};

export function buildShellDrawPrompt({ character, identity, form }) {
  const charName = character?.name || '角色';
  const bio = character?.bio || '（未填写人设）';
  const extraNotes = character?.extraNotes || '无';
  const worldBookText = character?.worldBook
    ? `\n【专属世界书】：${character.worldBook}`
    : '';

  return `你要为"${charName}"生成一段【潮汐贝壳】里封存的内容。

【角色人设】：${bio}
【补充设定】：${extraNotes}${worldBookText}

【这次贝壳的身份设定】
${IDENTITY_BRIEF[identity](charName)}

【这次贝壳的形式】
${FORM_BRIEF[form]}

【重要边界】
这段内容跟 user 和${charName}当前这段关系、当前聊天记录完全无关，不要
参考、不要呼应、不要提及任何"你们之间"已经发生过的事——把它当成从
时间的潮水里冲上岸的、一枚独立的贝壳，里面封存着一段跟"此刻的关系"
没有因果关系的、单独存在的心绪或记忆。

请直接输出 JSON（不要任何代码块标记、不要多余文字），格式：
{"title": "八到十六字左右的短标题", "when": "十字左右的场景/时间点，比如'认识你之前 · 三月的某个阴天'", "content": "正文分两段，第一人称，不要用 Emoji，两段之间用一个换行符分隔，每段约60～120字"}`;
}