import db from '../../db';

import {
  ensureMemoryJob,
  getChatMemory,
  getMemoryJob
} from './memoryService';

import {
  EMOTION_TRIGGER_INTERVAL_MS,
  applyGrowthOps,
  buildGrowthContext,
  collectGrowthTriggers,
  confirmGrowthItem,
  dismissGrowthItem,
  markGrowthSeen,
  normalizeGrowthState,
  revertGrowthItem,
  GROWTH_STATUSES
} from './memoryGrowth';

import {
  judgeGrowth
} from './memoryGrowthAiService';

import {
  getMemoryTidyAutoExecute
} from '../../services/memoryTidySettingsService';

/*
 * 角色成长的执行层。判断"什么事值得触发"在 memoryGrowth.js（纯函数），
 * 判断"这些事让角色发生了什么变化"交给 AI（memoryGrowthAiService.js），
 * 这里负责读写这个聊天的成长记录，并决定新的成长是先问用户还是直接生效。
 *
 * 自主程度沿用记忆整理的开关（memoryTidySettingsService.js）：
 *   - 关（默认）：新出现的成长先放在"待确认"，你确认后才影响角色；
 *   - 开：新的成长直接生效，同时在记忆页里标出来提醒你，可以随时回退。
 * 无论开关如何，已经生效的成长被增强或减弱都直接生效——
 * "被新的事件推回去"应该及时，而且它小、可逆。
 *
 * 数据存在 memoryJobs 记录的 growth 字段上，每个聊天一份。
 * 所有失败都只在控制台警告，不向上抛错，不影响聊天和记忆提炼。
 */

const MAX_TRIGGERS_PER_RUN = 8;

// 同一个聊天同时只判断一次：提炼后的判断和手动整理可能撞在一起，
// 两次都去问 AI 既浪费，也可能把同一件事记两遍。
const activeGrowthChats = new Set();
const MAX_PERSONA_CHARS = 600;

const nowIso = () => new Date().toISOString();

const toTime = (value) => {
  const time = new Date(value || 0).getTime();

  return Number.isFinite(time) ? time : 0;
};

const notifyChanged = () => {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.dispatchEvent === 'function' &&
      typeof Event === 'function'
    ) {
      window.dispatchEvent(new Event('memory-growth-changed'));
    }
  } catch {
    // 通知只是让记忆页刷新，失败无所谓。
  }
};

export const getGrowthState = async (chatId) => {
  const job = await getMemoryJob(chatId);

  return normalizeGrowthState(job?.growth);
};

const saveGrowthState = async (chatId, state) => {
  const job = await ensureMemoryJob(chatId);

  await db.memoryJobs.update(job.id, {
    growth: state,
    updatedAt: nowIso()
  });

  notifyChanged();

  return state;
};

// 进入聊天提示词的那一块：角色在这段关系里的成长变化。
export const getGrowthContext = async (chatId) => {
  try {
    const state = await getGrowthState(chatId);

    return buildGrowthContext(state.items);
  } catch (error) {
    console.warn('[Growth] 读取成长失败，已跳过：', error);

    return '';
  }
};

const buildPersonaText = (character) => {
  if (!character) return '';

  return [
    character.name ? `名字：${character.name}` : '',
    character.bio ? `设定：${character.bio}` : '',
    character.extraNotes ? `补充：${character.extraNotes}` : ''
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_PERSONA_CHARS);
};

// 重大事件排在前面，其余的按时间从新到旧。
const pickTriggersForAi = (triggers) => (
  [...triggers]
    .sort((left, right) => {
      const leftRank = left.kind === 'milestone' ? 0 : 1;
      const rightRank = right.kind === 'milestone' ? 0 : 1;

      if (leftRank !== rightRank) return leftRank - rightRank;

      return toTime(right.at) - toTime(left.at);
    })
    .slice(0, MAX_TRIGGERS_PER_RUN)
);

export const runGrowthUpdate = async (
  chatId,
  {
    force = false,
    allMemories = null,
    autoExecute = null
  } = {}
) => {
  const summary = {
    ran: false,
    reason: '',
    added: 0,
    pending: 0,
    reinforced: 0,
    weakened: 0,
    faded: 0,
    revived: 0,
    error: ''
  };

  if (activeGrowthChats.has(chatId)) {
    summary.reason = 'already_running';
    return summary;
  }

  activeGrowthChats.add(chatId);

  try {
    const job = await ensureMemoryJob(chatId);
    const state = normalizeGrowthState(job.growth);
    const memories = allMemories || await getChatMemory(chatId);

    const triggers = collectGrowthTriggers({
      allMemories: memories,
      seenKeys: state.seenTriggerKeys
    });

    if (!triggers.length) {
      summary.reason = 'no_triggers';
      return summary;
    }

    const hasMilestone = triggers.some((trigger) => trigger.kind === 'milestone');

    // 只有情绪触发（没有重大事件）时，别太频繁地调用 AI。
    if (
      !force &&
      !hasMilestone &&
      Date.now() - toTime(state.lastRunAt) < EMOTION_TRIGGER_INTERVAL_MS
    ) {
      summary.reason = 'throttled';
      return summary;
    }

    const chat = await db.chats.get(chatId);

    const character = chat?.characterId
      ? await db.characters.get(chat.characterId)
      : null;

    const sentTriggers = pickTriggersForAi(triggers);

    const knownItems = state.items.filter((item) => (
      item.status !== GROWTH_STATUSES.DISMISSED
    ));

    let ops = [];

    try {
      ops = await judgeGrowth({
        persona: buildPersonaText(character),
        activeItems: knownItems,
        triggers: sentTriggers
      });
    } catch (error) {
      // AI 不可用时不记录"处理过"，下次还会再试。
      console.warn('[Growth] 判断角色成长失败：', error);
      summary.error = error?.message || '未知错误';

      return summary;
    }

    const shouldAuto = autoExecute === null
      ? await getMemoryTidyAutoExecute()
      : autoExecute;

    /*
     * 问 AI 期间，用户可能已经在记忆页里确认、忽略或回退了某条成长。
     * 所以这里重新读一次最新的成长记录，把变化应用在它上面，而不是覆盖掉。
     */
    const latestState = await getGrowthState(chatId);

    const applied = applyGrowthOps({
      state: latestState,
      ops,
      triggers: sentTriggers,
      autoExecute: shouldAuto
    });

    await saveGrowthState(chatId, applied.state);

    summary.ran = true;
    Object.assign(summary, applied.summary);

    return summary;
  } catch (error) {
    console.warn('[Growth] 更新角色成长失败：', error);
    summary.error = error?.message || '未知错误';

    return summary;
  } finally {
    activeGrowthChats.delete(chatId);
  }
};

/* ------------------------------------------------------------------ */
/* 记忆页里的手动操作                                                    */
/* ------------------------------------------------------------------ */

const updateGrowth = async (chatId, updater) => {
  const state = await getGrowthState(chatId);

  return saveGrowthState(chatId, updater(state));
};

export const confirmGrowth = (chatId, itemId) => (
  updateGrowth(chatId, (state) => confirmGrowthItem(state, itemId))
);

export const dismissGrowth = (chatId, itemId) => (
  updateGrowth(chatId, (state) => dismissGrowthItem(state, itemId))
);

export const revertGrowth = (chatId, itemId) => (
  updateGrowth(chatId, (state) => revertGrowthItem(state, itemId))
);

export const acknowledgeGrowth = (chatId) => (
  updateGrowth(chatId, (state) => markGrowthSeen(state))
);