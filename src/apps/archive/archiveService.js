import db from '../../db';
import { getChatMemory, getMemoryJob } from '../memory/memoryService';
import { MEMORY_STATUSES, MEMORY_TYPES } from '../memory/memoryConstants';

/*
 * 存档室的数据层。
 *
 * 设计要点（对应之前商定的方案）：
 * 1. 归档 = 把消息从 messages 表物理搬到 archivedMessages 表，不是打标记。
 * 2. 无论是"按时间阈值自动归档""按日期手动归档"还是"手动勾选具体消息"，
 *    最终都收敛到同一段搬运+统计逻辑（archiveMessagesInternal），
 *    只是"要归档哪些消息"的筛选方式不同。
 * 3. 归档前必须检查 memoryJobs 表里该 chatId 的 lastProcessedMessageId 游标：
 *    只归档"记忆系统已经处理过"的消息（message.id <= 游标），
 *    避免把记忆系统还没来得及提炼的消息搬走导致内容丢失。
 *    这是因为 memoryScheduler 的触发是"消息数量凑够 30 条或命中高优先级信号"，
 *    不是纯定时的，慢聊天可能长期不触发，没有兜底时间上限。
 * 4. archiveStats 表按 chatId 存一条累加统计，页面打开时只读这一条记录，
 *    不能每次现场扫描 archivedMessages 全表。
 *    为了能在每次归档时增量算出"去重后的归档天数"，
 *    额外在 archiveStats 记录上加了 archivedDayKeys（数组，不是索引字段，
 *    不需要 db 版本升级），只在归档发生时更新，页面展示只读 totalArchivedDays。
 */

const isValidChatId = (chatId) => (
  chatId !== null &&
  chatId !== undefined &&
  chatId !== ''
);

const nowIso = () => new Date().toISOString();

const toSafeDate = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const toSafeTime = (value) => {
  const date = toSafeDate(value);
  return date ? date.getTime() : null;
};

/*
 * 按本地自然日去重用的 key，例如 "2026-09-18"。
 * 归档消息的 timestamp 历史上有 ISO 字符串和 Date.now() 数字两种格式，
 * 已经确认 new Date(value) 两种都能正确解析，这里统一处理。
 */
const getDayKey = (value) => {
  const date = toSafeDate(value);

  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const countDaysBetween = (fromValue, toValue) => {
  const fromDate = toSafeDate(fromValue);
  const toDate = toSafeDate(toValue);

  if (!fromDate || !toDate) {
    return 0;
  }

  const fromMidnight = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate()
  ).getTime();

  const toMidnight = new Date(
    toDate.getFullYear(),
    toDate.getMonth(),
    toDate.getDate()
  ).getTime();

  const diffDays = Math.round(
    (toMidnight - fromMidnight) / (24 * 60 * 60 * 1000)
  );

  return Math.max(1, diffDays + 1);
};

/*
 * 记忆系统安全游标：只有 id <= 这个值的消息才允许被归档。
 * 读不到 job 或游标为空，视为"这个聊天还从来没跑过记忆提炼"，
 * 保守起见本次不归档任何消息（返回 null，调用方据此跳过全部）。
 */
const getMemorySafeCursorId = async (chatId) => {
  try {
    const job = await getMemoryJob(chatId);
    const cursor = Number(job?.lastProcessedMessageId);

    return Number.isFinite(cursor) ? cursor : null;
  } catch (error) {
    console.warn(
      '[Archive] 读取记忆游标失败，为安全起见本次不归档：',
      error
    );

    return null;
  }
};

const getDefaultArchiveStats = (chatId) => ({
  chatId,
  totalArchivedDays: 0,
  totalArchivedMessages: 0,
  lastArchivedAt: null,
  updatedAt: nowIso(),
  archivedDayKeys: []
});

export const getArchiveStats = async (chatId) => {
  if (!isValidChatId(chatId)) {
    return getDefaultArchiveStats(chatId);
  }

  const record = await db.archiveStats.get(chatId);

  return record || getDefaultArchiveStats(chatId);
};

/*
 * "已聊天多少天"依赖这个聊天最早一条消息的时间。
 * 只在第一次需要时扫描一次并缓存进 archiveStats.firstMessageAt，
 * 之后打开页面只读缓存值，不会重复扫描。
 * 即使这条最早消息之后被归档搬走，缓存的时间本身不受影响，
 * 仍然是这个聊天真实的起点。
 */
const ensureFirstMessageCached = async (chatId) => {
  const stats = await getArchiveStats(chatId);

  if (stats.firstMessageAt) {
    return stats.firstMessageAt;
  }

  const [firstActive, firstArchived] = await Promise.all([
    db.messages.where('chatId').equals(chatId).toArray(),
    db.archivedMessages.where('chatId').equals(chatId).toArray()
  ]);

  const allTimes = [...firstActive, ...firstArchived]
    .map((message) => toSafeTime(message.timestamp))
    .filter((time) => Number.isFinite(time));

  if (allTimes.length === 0) {
    return null;
  }

  const earliestTime = Math.min(...allTimes);
  const earliestIso = new Date(earliestTime).toISOString();

  await db.archiveStats.put({
    ...getDefaultArchiveStats(chatId),
    ...stats,
    chatId,
    firstMessageAt: earliestIso,
    updatedAt: nowIso()
  });

  return earliestIso;
};

/*
 * 存档室主视图（大卡片轮播）用的每个聊天概览。
 * 消息条数用 Dexie 的 count()（走索引，不读取整表内容），
 * "已聊天多少天"用上面缓存的 firstMessageAt 计算，
 * 两者都不会随着历史消息变多而变慢。
 */
export const getChatsArchiveOverview = async () => {
  const chats = await db.chats.toArray();

  const overview = await Promise.all(
    chats.map(async (chat) => {
      const chatId = chat.id;

      const [
        character,
        activeCount,
        archivedCount,
        stats,
        firstMessageAt
      ] = await Promise.all([
        chat.characterId
          ? db.characters.get(chat.characterId)
          : null,
        db.messages.where('chatId').equals(chatId).count(),
        db.archivedMessages.where('chatId').equals(chatId).count(),
        getArchiveStats(chatId),
        ensureFirstMessageCached(chatId)
      ]);

           const characterName = character?.name || chat.title || '未命名';

      return {
        chatId,
        characterId: chat.characterId,
        characterName,
        characterAvatar: character?.avatar || '',
        discImage: chat.archiveDiscImage || '',

        // 只有没有自定义文字时才使用角色名字。
        // 空字符串是有效值，表示用户主动把唱片文字留空。
        discLabel: typeof chat.archiveDiscLabel === 'string'
          ? chat.archiveDiscLabel
          : characterName,

        userName: chat.userName || '你',
        userAvatar: chat.userAvatar || character?.userAvatar || '',
        bgImage: chat.bgImage || '',
        mode: chat.mode || 'rp',
        totalMessages: activeCount + archivedCount,
        activeMessages: activeCount,
        archivedMessages: archivedCount,
        totalArchivedDays: stats.totalArchivedDays || 0,
        chattedDays: firstMessageAt
          ? countDaysBetween(firstMessageAt, nowIso())
          : (activeCount + archivedCount > 0 ? 1 : 0),
        firstMessageAt
      };
    })
  );

  return overview.sort((a, b) => (
    (b.totalMessages || 0) - (a.totalMessages || 0)
  ));
};

/*
 * 允许 user 给某个聊天的"唱片"自定义封面图（不用角色头像）。
 * 直接存成 chats 表的一个附加字段（data URL），不新建表，
 * 页面读取时优先用这张图，没有才回退到角色头像。
 */
export const setChatDiscImage = async (chatId, dataUrl) => {
  if (!isValidChatId(chatId)) {
    return false;
  }

  await db.chats.update(chatId, { archiveDiscImage: dataUrl || '' });

  return true;
};

/*
 * 允许 user 自定义唱片上的主文字。
 * 不填写时保存为空字符串，表示主动隐藏这段文字。
 */
export const setChatDiscLabel = async (chatId, label) => {
  if (!isValidChatId(chatId)) {
    return false;
  }

  const normalizedLabel = typeof label === 'string'
    ? label.trim()
    : '';

  await db.chats.update(chatId, {
    archiveDiscLabel: normalizedLabel
  });

  return true;
};


/*
 * 归档消息的"文件夹分组 key"计算规则，统一在这一处，
 * 读取（getArchivedMessageFolders）、备注（setArchiveFolderNote）、
 * 删除（deleteArchivedFolder）都复用它，避免三处逻辑各写一遍、
 * 以后改分组规则时漏改某一处。
 */
const computeGroupKey = (message) => {
  const dayKey = getDayKey(message.timestamp);

  if (!dayKey) {
    return null;
  }

  return message.offlineSessionId
    ? `${dayKey}__offline_${message.offlineSessionId}`
    : `${dayKey}__online`;
};

const groupArchivedRecords = (records) => {
  const folderMap = new Map();

  for (const message of records) {
    const groupKey = computeGroupKey(message);

    if (!groupKey) {
      continue;
    }

    if (!folderMap.has(groupKey)) {
      folderMap.set(groupKey, {
        groupKey,
        dayKey: getDayKey(message.timestamp),
        mode: message.mode || 'online',
        offlineSessionId: message.offlineSessionId || null,
        note: '',
        coverImage: '',
        messages: []
      });
    }

    const folder = folderMap.get(groupKey);

    folder.messages.push(message);

    // 备注/封面都是冗余存在每条消息上的字段（同一组内应该一致），
    // 取第一个非空值即可，不需要新建表。
    if (!folder.note && message.folderNote) {
      folder.note = message.folderNote;
    }

    if (!folder.coverImage && message.folderCoverImage) {
      folder.coverImage = message.folderCoverImage;
    }
  }

  return folderMap;
};

/*
 * 已归档消息列表，按自然日分组，供档案柜视图渲染成一个个"文件夹"。
 * 分组时附带 mode/offlineSessionId，方便同一天既有线上又有一次性线下会话时
 * 分别展示（比如同一天既有普通聊天也有一次线下场景）。
 */
export const getArchivedMessageFolders = async (chatId) => {
  if (!isValidChatId(chatId)) {
    return [];
  }

  const records = await db.archivedMessages
    .where('chatId')
    .equals(chatId)
    .toArray();

  const folders = Array.from(groupArchivedRecords(records).values());

  for (const folder of folders) {
    folder.messages.sort((a, b) => (
      (toSafeTime(a.timestamp) || 0) - (toSafeTime(b.timestamp) || 0)
    ));
  }

  return folders.sort((a, b) => (
    (toSafeTime(b.messages[0]?.timestamp) || 0)
    - (toSafeTime(a.messages[0]?.timestamp) || 0)
  ));
};

/*
 * 给某个已归档"文件夹"写备注，方便辨认。
 * 备注冗余存在这个分组下每一条 archivedMessages 记录的 folderNote 字段上
 * （批量 update，不新建表，符合项目里"优先加字段而不是加表"的惯例）。
 */
export const setArchiveFolderNote = async (chatId, groupKey, note) => {
  if (!isValidChatId(chatId) || !groupKey) {
    return false;
  }

  const records = await db.archivedMessages
    .where('chatId')
    .equals(chatId)
    .toArray();

  const targetIds = records
    .filter((message) => computeGroupKey(message) === groupKey)
    .map((message) => message.id);

  if (targetIds.length === 0) {
    return false;
  }

  await db.archivedMessages
    .where('id')
    .anyOf(targetIds)
    .modify({ folderNote: note || '' });

  return true;
};

/*
 * 给某个已归档"文件夹"设置自定义封面图（data URL）。
 * 跟 setArchiveFolderNote 完全同一套写法：冗余存在这个分组下
 * 每一条 archivedMessages 记录的 folderCoverImage 字段上，
 * 批量 update，不新建表、不升级 db 版本。
 */
export const setArchiveFolderCoverImage = async (chatId, groupKey, dataUrl) => {
  if (!isValidChatId(chatId) || !groupKey) {
    return false;
  }

  const records = await db.archivedMessages
    .where('chatId')
    .equals(chatId)
    .toArray();

  const targetIds = records
    .filter((message) => computeGroupKey(message) === groupKey)
    .map((message) => message.id);

  if (targetIds.length === 0) {
    return false;
  }

  await db.archivedMessages
    .where('id')
    .anyOf(targetIds)
    .modify({ folderCoverImage: dataUrl || '' });

  return true;
};

/*
 * 删除后重新计算 archiveStats。
 * 删除是低频操作，这里允许现场扫一次这个聊天的 archivedMessages
 * （不是每次开页面都扫），用真实剩余数据重建 archivedDayKeys，
 * 比增量减法更不容易算错（比如同一天还有别的 session 没删）。
 */
const recomputeArchiveStatsAfterDeletion = async (chatId) => {
  const remaining = await db.archivedMessages
    .where('chatId')
    .equals(chatId)
    .toArray();

  const dayKeys = new Set(
    remaining
      .map((message) => getDayKey(message.timestamp))
      .filter(Boolean)
  );

  const current = await getArchiveStats(chatId);

  await db.archiveStats.put({
    ...getDefaultArchiveStats(chatId),
    ...current,
    chatId,
    archivedDayKeys: Array.from(dayKeys),
    totalArchivedDays: dayKeys.size,
    totalArchivedMessages: remaining.length,
    updatedAt: nowIso()
  });
};

/*
 * 彻底删除一整个"文件夹"（某一天的归档，或者某一次线下会话的归档）。
 * 不可恢复——调用方应该在 UI 上用 ConfirmModal 之类的二次确认。
 * 删除的是已经归档的内容，记忆系统早在归档之前就已经独立提炼过了，
 * 所以这里不需要、也不会再去动 memories 表。
 */
export const deleteArchivedFolder = async (chatId, groupKey) => {
  if (!isValidChatId(chatId) || !groupKey) {
    return { deletedCount: 0 };
  }

  const records = await db.archivedMessages
    .where('chatId')
    .equals(chatId)
    .toArray();

  const targetIds = records
    .filter((message) => computeGroupKey(message) === groupKey)
    .map((message) => message.id);

  if (targetIds.length === 0) {
    return { deletedCount: 0 };
  }

  await db.transaction(
    'rw',
    db.archivedMessages,
    db.archiveStats,
    async () => {
      await db.archivedMessages.bulkDelete(targetIds);
      await recomputeArchiveStatsAfterDeletion(chatId);
    }
  );

  return { deletedCount: targetIds.length };
};

/*
 * 删除文件夹里的单条归档消息（不删整个文件夹）。
 */
export const deleteArchivedMessage = async (chatId, messageId) => {
  if (!isValidChatId(chatId) || !messageId) {
    return false;
  }

  await db.transaction(
    'rw',
    db.archivedMessages,
    db.archiveStats,
    async () => {
      await db.archivedMessages.delete(Number(messageId));
      await recomputeArchiveStatsAfterDeletion(chatId);
    }
  );

  return true;
};

/*
 * "整理归档"列表用：还没归档、按自然日分组的活跃消息，
 * 每条附带 isMemorySafe 标记——false 表示记忆系统还没处理到这条，
 * 界面上应该禁用勾选并说明原因，而不是允许用户选中后静默跳过。
 */
export const getArchivableMessagePreview = async (chatId) => {
  if (!isValidChatId(chatId)) {
    return [];
  }

  const [records, cursorId] = await Promise.all([
    db.messages.where('chatId').equals(chatId).toArray(),
    getMemorySafeCursorId(chatId)
  ]);

  const sorted = [...records].sort((a, b) => (
    (toSafeTime(a.timestamp) || 0) - (toSafeTime(b.timestamp) || 0)
  ));

  const dayMap = new Map();

  for (const message of sorted) {
    const dayKey = getDayKey(message.timestamp);

    if (!dayKey) {
      continue;
    }

    const isMemorySafe = (
      cursorId !== null &&
      Number(message.id) <= cursorId
    );

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        dayKey,
        messages: []
      });
    }

    dayMap.get(dayKey).messages.push({
      ...message,
      isMemorySafe
    });
  }

  return Array.from(dayMap.values());
};

const applyArchiveDaySummary = (stats, dayKeys) => {
  const existingKeys = new Set(stats.archivedDayKeys || []);

  for (const dayKey of dayKeys) {
    if (dayKey) {
      existingKeys.add(dayKey);
    }
  }

  return {
    archivedDayKeys: Array.from(existingKeys),
    totalArchivedDays: existingKeys.size
  };
};

/*
 * 归档的核心执行逻辑。candidateMessages 是"打算归档"的候选消息数组
 * （由调用方按 cutoff 时间或按用户勾选的 id 列表筛出来）。
 * 这里统一做：记忆游标保护 -> 物理搬表 -> 累加统计。
 */
const archiveMessagesInternal = async (chatId, candidateMessages) => {
  if (!isValidChatId(chatId) || candidateMessages.length === 0) {
    return {
      archivedCount: 0,
      skippedProtectedCount: 0,
      skippedProtectedIds: []
    };
  }

  const cursorId = await getMemorySafeCursorId(chatId);

  const safeMessages = [];
  const skippedProtectedIds = [];

  for (const message of candidateMessages) {
    const isMemorySafe = (
      cursorId !== null &&
      Number(message.id) <= cursorId
    );

    if (isMemorySafe) {
      safeMessages.push(message);
    } else {
      skippedProtectedIds.push(message.id);
    }
  }

  if (safeMessages.length === 0) {
    return {
      archivedCount: 0,
      skippedProtectedCount: skippedProtectedIds.length,
      skippedProtectedIds
    };
  }

  const archivedAt = nowIso();

  await db.transaction(
    'rw',
    db.messages,
    db.archivedMessages,
    db.archiveStats,
    async () => {
      const payload = safeMessages.map((message) => {
        const record = { ...message };
        delete record.id;

        return {
          ...record,
          archivedAt
        };
      });

      await db.archivedMessages.bulkAdd(payload);

      await db.messages.bulkDelete(
        safeMessages.map((message) => message.id)
      );

      const currentStats = await getArchiveStats(chatId);

      const dayKeys = safeMessages.map((message) => (
        getDayKey(message.timestamp)
      ));

      const { archivedDayKeys, totalArchivedDays } =
        applyArchiveDaySummary(currentStats, dayKeys);

      await db.archiveStats.put({
        ...getDefaultArchiveStats(chatId),
        ...currentStats,
        chatId,
        archivedDayKeys,
        totalArchivedDays,
        totalArchivedMessages:
          (currentStats.totalArchivedMessages || 0) + safeMessages.length,
        lastArchivedAt: archivedAt,
        updatedAt: archivedAt
      });
    }
  );

  return {
    archivedCount: safeMessages.length,
    skippedProtectedCount: skippedProtectedIds.length,
    skippedProtectedIds
  };
};

/*
 * 自动归档 / 手动选日期归档共用的入口：
 * 归档 chatId 下 timestamp 早于 cutoffTimestamp 的全部消息
 * （再叠加记忆游标保护）。cutoffTimestamp 可以是 ISO 字符串、
 * 数字时间戳或 Date 对象，来源由调用方决定
 * （自动是"当前时间 - N 天"，手动是用户选的日期）。
 */
export const archiveMessagesBefore = async (chatId, cutoffTimestamp) => {
  const cutoffTime = toSafeTime(cutoffTimestamp);

  if (!isValidChatId(chatId) || cutoffTime === null) {
    return {
      archivedCount: 0,
      skippedProtectedCount: 0,
      skippedProtectedIds: []
    };
  }

  const allMessages = await db.messages
    .where('chatId')
    .equals(chatId)
    .toArray();

  const candidateMessages = allMessages.filter((message) => {
    const time = toSafeTime(message.timestamp);
    return time !== null && time < cutoffTime;
  });

  return archiveMessagesInternal(chatId, candidateMessages);
};

/*
 * 手动勾选具体消息归档。同样会经过记忆游标保护，
 * 如果用户选中的消息还没被记忆系统处理过，会被跳过而不是强行归档，
 * 调用方应该用返回的 skippedProtectedIds 提示用户"这些消息暂时还不能归档"。
 */
export const archiveSpecificMessages = async (chatId, messageIds) => {
  if (
    !isValidChatId(chatId) ||
    !Array.isArray(messageIds) ||
    messageIds.length === 0
  ) {
    return {
      archivedCount: 0,
      skippedProtectedCount: 0,
      skippedProtectedIds: []
    };
  }

  const numericIds = messageIds
    .map((id) => Number(id))
    .filter(Number.isFinite);

  const candidateMessages = await db.messages
    .where('id')
    .anyOf(numericIds)
    .toArray();

  return archiveMessagesInternal(chatId, candidateMessages);
};

/*
 * 全局自动归档设置，存进 db.settings（key/value 表），
 * 沿用项目里 cloudPushConfig 那套现成的存法，不新建表。
 */
const ARCHIVE_SETTINGS_KEY = 'archiveSettings';

const DEFAULT_ARCHIVE_SETTINGS = {
  autoArchiveEnabled: false,
  autoArchiveDaysThreshold: 14
};

export const getArchiveSettings = async () => {
  const record = await db.settings.get(ARCHIVE_SETTINGS_KEY);

  return {
    ...DEFAULT_ARCHIVE_SETTINGS,
    ...(record?.value || {})
  };
};

export const saveArchiveSettings = async (nextSettings) => {
  const current = await getArchiveSettings();

  const merged = {
    ...current,
    ...nextSettings
  };

  await db.settings.put({
    key: ARCHIVE_SETTINGS_KEY,
    value: merged
  });

  return merged;
};

/*
 * 供全局自动归档定时检查逻辑调用：对每个聊天，
 * 用"当前时间 - N 天"作为 cutoff 跑一次 archiveMessagesBefore。
 * 实际的定时触发（什么时候调用这个函数）留给单独的 scheduler 部分。
 */
export const runAutoArchiveForAllChats = async () => {
  const settings = await getArchiveSettings();

  if (!settings.autoArchiveEnabled) {
    return { skipped: true, reason: 'disabled' };
  }

  const thresholdMs =
    Math.max(1, Number(settings.autoArchiveDaysThreshold) || 14) *
    24 * 60 * 60 * 1000;

  const cutoffTime = Date.now() - thresholdMs;

  const chats = await db.chats.toArray();

  const results = await Promise.all(
    chats.map((chat) => (
      archiveMessagesBefore(chat.id, cutoffTime)
    ))
  );

  return {
    skipped: false,
    totalArchived: results.reduce(
      (sum, result) => sum + result.archivedCount,
      0
    )
  };
};

const MEMORY_HIGHLIGHT_TYPE_LABELS = {
  [MEMORY_TYPES.EPISODE]: '共同经历',
  [MEMORY_TYPES.EMOTION]: '情绪痕迹',
  [MEMORY_TYPES.RELATIONSHIP]: '关系理解',
  [MEMORY_TYPES.CHARACTER_THOUGHT]: '角色心事',
  [MEMORY_TYPES.FACT]: '事实与近况',
  [MEMORY_TYPES.PREFERENCE]: '偏好与习惯',
  [MEMORY_TYPES.REFLECTION]: '阶段性反思',
  [MEMORY_TYPES.EXPRESSION_RULE]: '表达方式与边界',
  [MEMORY_TYPES.CHARACTER_ACTION]: '角色做过的事'
};

const shuffleArray = (items) => {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

/*
 * 存档室主界面"记忆卡牌"用：从这个聊天已有的记忆里随机抽几条
 * "美好瞬间"类型的记忆（共同经历/情绪痕迹/关系理解优先），
 * 没有这类记忆时退回到任意生效中的记忆，都没有就返回空数组
 * （调用方据此隐藏这个区块，不强行展示占位假数据）。
 */
export const getArchiveMemoryHighlights = async (chatId, limit = 6) => {
  if (!isValidChatId(chatId)) {
    return [];
  }

  let memories = [];

  try {
    memories = await getChatMemory(chatId);
  } catch (error) {
    console.warn('[Archive] 读取记忆高光失败：', error);
    return [];
  }

  const activeMemories = memories.filter(
    (memory) => memory.status === MEMORY_STATUSES.ACTIVE
  );

  const preferredTypes = [
    MEMORY_TYPES.EPISODE,
    MEMORY_TYPES.EMOTION,
    MEMORY_TYPES.RELATIONSHIP
  ];

  const preferredPool = activeMemories.filter(
    (memory) => preferredTypes.includes(memory.type)
  );

  const pool = preferredPool.length > 0 ? preferredPool : activeMemories;

  return shuffleArray(pool)
    .slice(0, limit)
    .map((memory) => ({
      id: memory.id,
      title: memory.title || '',
      content: memory.content || '',
      typeLabel: MEMORY_HIGHLIGHT_TYPE_LABELS[memory.type] || '共同记忆',
      recordedAt: memory.createdAt || memory.updatedAt || null
    }));
};

/*
 * 档案柜页面用的一句文学性描述，纯粹由已经算好的统计数字模板生成，
 * 不调用 AI（不需要额外请求，结果也稳定可预期）。
 * 按"已聊天天数"分几档换不同措辞，避免每次看到的都是同一句话。
 */
export const getArchiveNarrativeLine = ({
  chattedDays = 0,
  totalArchivedDays = 0,
  characterName = 'Ta'
}) => {
  if (chattedDays <= 0) {
    return '这段故事还没正式开始。';
  }

  const ratio = chattedDays > 0
    ? Math.round((totalArchivedDays / chattedDays) * 100)
    : 0;

  if (totalArchivedDays === 0) {
    return `已经一起度过了 ${chattedDays} 天，还没有被封存的旧日子。`;
  }

  if (chattedDays < 30) {
    return (
      `一起走过 ${chattedDays} 天，其中 ${totalArchivedDays} 天`
      + `已经被仔细收进了这间屋子。`
    );
  }

  if (chattedDays < 100) {
    return (
      `${chattedDays} 天的陪伴里，有 ${totalArchivedDays} 天沉淀成了记忆，`
      + `大约占了你们相处时光的 ${ratio}%。`
    );
  }

  return (
    `${chattedDays} 天，${ratio}% 的时光都封存在这里——`
    + `这大概已经是 ${characterName} 生命里，一段写不完的章节。`
  );
};