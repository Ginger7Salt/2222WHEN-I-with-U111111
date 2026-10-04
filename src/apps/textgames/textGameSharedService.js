// src/apps/textgames/textGameSharedService.js
//
// 文字游戏大厅——给"一局定胜负、跟绑定角色对弈"这类游戏（20个问题、
// 女巫的毒药，以后类似的新游戏也可以直接复用）共用的数据层：角色列表/
// 所属聊天查找、战绩记录读写、结束后回传聊天消息。
//
// 跟 ticTacToe/ticTacToeService.js 几乎同源——井字棋是第一个落地的游戏，
// 自己攒了一份一模一样的逻辑；这里把它抽成公共版本给后面的游戏用，没有
// 回头改井字棋自己那份（它工作得好好的，没必要为了去重冒风险去碰，见
// 项目硬规则3"touch only what's needed"）。
//
// textGameMatches 这张表本来就是按 gameId 区分、设计成给大厅里任何
// "跟角色对局"的游戏共用的（见 db/index.js v76 的注释），这里只是把
// 读写它的代码也做成公共的。

import db from '../../db';

const nowIso = () => new Date().toISOString();

const dispatchLocalMessageEvent = (chatId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    })
  );
};

const MAX_KEPT_MATCHES = 10;

export const listCharactersForPicker = async () => {
  const characters = await db.characters.toArray();
  return characters.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

// 找这个角色对应的那个聊天——跟 ticTacToeService.js 同一个查法。没有
// 聊天的角色（理论上不该出现，但防御一下）返回 null，调用方应该仍然
// 允许对局本身进行，只是跳过"回传结果/生成AI反应"这些依赖 chatId 的步骤。
export const getChatIdForCharacter = async (characterId) => {
  if (!characterId) return null;
  const chat = await db.chats.where('characterId').equals(characterId).first();
  return chat?.id ?? null;
};

export const getRecentMatches = async (gameId, characterId) => {
  if (!characterId) return [];

  const rows = await db.textGameMatches
    .where('[gameId+characterId]')
    .equals([gameId, characterId])
    .toArray();

  return rows
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
    .slice(0, MAX_KEPT_MATCHES);
};

export const getMatchStats = async (gameId, characterId) => {
  const matches = await getRecentMatches(gameId, characterId);

  return matches.reduce(
    (stats, match) => {
      if (match.result === 'win') stats.wins += 1;
      else if (match.result === 'loss') stats.losses += 1;
      else if (match.result === 'draw') stats.draws += 1;
      return stats;
    },
    { wins: 0, losses: 0, draws: 0, total: matches.length }
  );
};

// result 统一是"这局里负责猜/负责达成目标的那一方"的结果：'win' | 'loss' |
// 'draw'——具体"猜的是谁"因游戏而异（20个问题里可能是用户猜也可能是
// 角色猜，女巫的毒药里猜的也可能是任意一方），每个游戏自己的 service
// 文件负责把这个通用字段的含义在自己的 contextNote/UI 文案里讲清楚，
// 这里只管存和回传。
//
// contextNote 是这局游戏想让角色在下次聊天回复里感知到的具体文案（比如
// "秘密是苹果，用户在18问的时候才猜中"），用来替换掉 aiService.js 里
// text_game_result 分支默认的那句最简单的 win/loss/draw 措辞；不传的话
// 就退回那个默认措辞（兼容井字棋，它目前没有传这个字段）。
//
// noticeText 是这局结果在聊天记录里显示的那一条小药丸文案（见
// TextGameResultNotice.jsx）；不传的话同样退回默认的 win/loss/draw
// 措辞表。
//
// extra 是这个游戏自己想在 textGameMatches 这一行里多存的任意字段（比如
// 20个问题的秘密词、女巫的毒药的杯子编号/赌注），直接整个铺平塞进那一行，
// 不用为每个游戏单独改表结构。
export const recordTextGameMatch = async ({
  gameId,
  gameTitle,
  characterId,
  result,
  contextNote,
  noticeText,
  extra,
}) => {
  if (!gameId || !characterId || !result) return null;

  const endedAt = nowIso();
  const chatId = await getChatIdForCharacter(characterId);

  await db.textGameMatches.add({
    gameId,
    characterId,
    chatId: chatId || null,
    result,
    endedAt,
    ...(extra || {}),
  });

  const staleRows = await db.textGameMatches
    .where('[gameId+characterId]')
    .equals([gameId, characterId])
    .toArray();

  const idsToDelete = staleRows
    .sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1))
    .slice(MAX_KEPT_MATCHES)
    .map((row) => row.id);
  if (idsToDelete.length > 0) {
    await db.textGameMatches.bulkDelete(idsToDelete);
  }

  if (chatId) {
    await db.messages.add({
      chatId,
      characterId,
      sender: 'user',
      type: 'text_game_result',
      content: '',
      metadata: {
        gameId,
        gameTitle,
        result,
        contextNote: contextNote || null,
        noticeText: noticeText || null,
      },
      isRead: true,
      timestamp: endedAt,
    });

    await db.chats.update(chatId, { updatedAt: endedAt });

    dispatchLocalMessageEvent(chatId);
  }

  return { chatId, endedAt };
};