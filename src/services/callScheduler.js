import db from '../db';
import { buildRhythmPersonaBrief } from './rhythmReminderService';
import { hasAnyLiveCall, startIncomingCall } from './callService';
import { getAwayState } from '../apps/messages/away/awayState';

// 角色主动打电话过来,应该是偶尔的意外,不是准点报时,所以频率要比
// 寄语/反应这类小动作低得多。每 6 分钟才检查一次,冷却期 6 小时起步,
// 冷却过了也只有一定概率真的打过来——留一点"不确定什么时候会响"的
// 真实感,而不是掐着表来电话。
const SCHEDULER_INTERVAL_MS = 6 * 60 * 1000;
const CALL_ATTEMPT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const CALL_ATTEMPT_CHANCE = 0.08;

let callSchedulerTimer = null;
let isCallChecking = false;

const fetchAiText = async (apiConfig, systemPrompt) => {
  const baseUrl = String(apiConfig.baseUrl).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.5,
      max_tokens: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败：${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};

const buildCallDecisionPrompt = ({ character, worldBookText, extraNotesText }) => `
你正在扮演角色「${character.name}」。

人设背景：${character.bio || '普通人'}。${worldBookText}${extraNotesText}

你偶尔会想直接打电话给对方,而不是发消息——比如突然很想听TA的声音、
有点小事想立刻说、或者单纯想撒娇一下。但这应该是偶尔的、真实的冲动,
不是每次都要打,大多数时候你应该选择不打。

现在,你想不想立刻打个电话过去？只输出 yes 或 no,不要输出任何其他内容。
`;

/**
 * 扫描所有开启了 rhythmEnabled 的聊天窗（复用"角色可以主动联系我"
 * 这个既有开关,没有再单独加一个"允许来电"的设置项),逐个用一次
 * 很小的是/否判断,决定这次醒来要不要真的打一通电话进来。
 *
 * 串行执行、一次最多打进一通,避免多个角色同时抢着打电话。
 */
export const runCallScheduler = async () => {
  if (isCallChecking) return;
  isCallChecking = true;

  try {
    if (await hasAnyLiveCall()) {
      return;
    }

    const chats = await db.chats.toArray();

    const eligibleChats = chats.filter(
      (chat) =>
        chat?.id != null &&
        chat?.characterId != null &&
        chat?.rhythmEnabled !== false &&
        // 角色暂时不在线时不主动来电，也省掉一次决定要不要打的 AI 请求。
        !getAwayState(chat).away
    );

    for (const chat of eligibleChats) {
      try {
        if (await hasAnyLiveCall()) {
          break;
        }

        const now = Date.now();
        const cooldownKey = `lastCallAttemptTime_${chat.id}`;
        const lastAttemptSetting = await db.settings.get(cooldownKey);
        const lastAttempt = Number(lastAttemptSetting?.value || 0);

        if (now - lastAttempt < CALL_ATTEMPT_COOLDOWN_MS) {
          continue;
        }

        if (Math.random() > CALL_ATTEMPT_CHANCE) {
          continue;
        }

        const character = await db.characters.get(chat.characterId);
        if (!character) continue;

        const apiSettings = await db.settings.get('apiConfig');
        const apiConfig = apiSettings?.value || {};
        if (!apiConfig.baseUrl || !apiConfig.apiKey) continue;

        // 无论最终决定打不打,都先刷新冷却时间,避免判断失败时
        // 下一轮检查（6 分钟后）又立刻重试。
        await db.settings.put({ key: cooldownKey, value: String(now) });

        const { worldBookText, extraNotesText } = await buildRhythmPersonaBrief(character);
        const systemPrompt = buildCallDecisionPrompt({ character, worldBookText, extraNotesText });
        const rawResponse = await fetchAiText(apiConfig, systemPrompt);

        if (/^yes/i.test(rawResponse)) {
          await startIncomingCall({ chatId: chat.id, characterId: character.id });
          console.log(`[callScheduler] chatId=${chat.id} 发起来电`);
          break;
        }
      } catch (err) {
        console.error(`[callScheduler] chatId=${chat.id} 检查失败:`, err);
      }
    }
  } catch (err) {
    console.error('[callScheduler] 调度检查失败：', err);
  } finally {
    isCallChecking = false;
  }
};

/**
 * 启动来电调度器。跟 rhythmScheduler 不同,这里不在启动时立即检查一次
 * ——不希望每次打开 App 都可能被劈头盖脸打一通电话,第一次检查要等
 * 满一个 SCHEDULER_INTERVAL_MS 之后。
 */
export const startCallScheduler = () => {
  if (callSchedulerTimer) {
    return;
  }

  console.log(
    `[callScheduler] 已启动，每 ${SCHEDULER_INTERVAL_MS / 60000} 分钟检查一次。`
  );

  callSchedulerTimer = window.setInterval(() => {
    void runCallScheduler();
  }, SCHEDULER_INTERVAL_MS);
};

export const stopCallScheduler = () => {
  if (!callSchedulerTimer) {
    return;
  }

  window.clearInterval(callSchedulerTimer);
  callSchedulerTimer = null;
  isCallChecking = false;

  console.log('[callScheduler] 已停止。');
};
