// src/services/dailyLifeTopicPicker.js
//
// 给"角色自己的生活"这几处生成点（碎碎念、今日安排、拍立得动态）共用的
// 话题池选择器。原来这几处的 prompt 只有人设文本 + 跟用户的近期剧情可用，
// AI 只能反复咀嚼同一份材料，内容容易显得围着用户转、不够新鲜——这是
// 2026-09 讨论"AI 每天的事情太少"时定位到的根因，不是哪里写错了，是
// 这几处生成从一开始就没给模型"人设和用户关系之外"的原料。
//
// 做法：每次生成前，先从四个类别里随机抽一个（大致等权重），并按抽到
// 的类别准备好对应的素材，一起交给调用方拼进 prompt：
// - npc：从这个聊天窗关联的 NPC 里挑一个，读它最近一条真实发过的动态，
//   让角色的话能跟这条动态对上，而不是凭空提一个名字；
// - news：复用 newspaper 应用已经在用的 searchLatestNews()——免 Key 也能
//   拿到内容（Hacker News 热榜 / 维基百科"历史上的今天"兜底），如果
//   newspaper 里配置过 Tavily Key 会优先用它，这里不强制要求用户
//   额外配置任何东西；
// - mood：保留原来的"单纯想到用户"这条路，不需要额外素材；
// - hobby：角色自己工作/爱好上的小事，没有现成素材来源，交给模型结合
//   人设自由发挥，只是把话题方向从"用户"上挪开。
//
// 四类抽取时权重相同。如果抽到 npc/news 但拿不到真实素材（这个聊天窗
// 没有 NPC、NPC 还没发过动态、或者 news 抓取失败/为空），自动降级成
// mood 类别返回——调用方不需要处理"抽到了但没东西"这种情况，只要看
// topic/material 就知道该怎么拼 prompt。
import db from '../db';
import { getNpcsByChatId } from '../apps/snapshots/services/snapshotNpcService';
import { searchLatestNews } from '../apps/newspaper/newspaperSearchService';

export const DAILY_LIFE_TOPICS = {
  NPC: 'npc',
  NEWS: 'news',
  MOOD: 'mood',
  HOBBY: 'hobby',
};

const TOPIC_POOL = [
  DAILY_LIFE_TOPICS.NPC,
  DAILY_LIFE_TOPICS.NEWS,
  DAILY_LIFE_TOPICS.MOOD,
  DAILY_LIFE_TOPICS.HOBBY,
];

const pickRandomTopic = () => (
  TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)]
);

// 跟 snapshotGlobalScheduler.js 里 tryPostForCharacter/tryPostForNpc 用的
// 是同一套 db.snapshots 索引（chatId/authorType/npcId，db.version(47) 里
// 加的），保持一致，不另起一套查询方式。
const getRecentNpcSnapshotMaterial = async (chatId) => {
  try {
    const npcs = await getNpcsByChatId(chatId);
    if (!Array.isArray(npcs) || npcs.length === 0) return null;

    // 随机挑一个 NPC，而不是固定第一个，避免每次话题池抽中 npc
    // 类别时都提到同一个 NPC。
    const candidate = npcs[Math.floor(Math.random() * npcs.length)];

    const latestPost = await db.snapshots
      .where('chatId')
      .equals(Number(chatId))
      .and((s) => s.npcId === candidate.id && s.authorType === 'npc')
      .last();

    if (!latestPost || !latestPost.content) return null;

    return {
      npcName: candidate.name,
      npcRoleTag: candidate.roleTag || '',
      postContent: latestPost.content,
      postLocation: latestPost.location || '',
    };
  } catch (error) {
    console.warn('[dailyLifeTopicPicker] 读取 NPC 动态素材失败：', error);
    return null;
  }
};

const getNewsMaterial = async () => {
  try {
    // newspaper 应用已有的设置项，key 是 'newspaper_settings'（见
    // NewspaperApp.jsx）。这里只读它的 tavilyKey 顺手复用，用户没配置
    // 过 newspaper 时 tavilyKey 就是空字符串，searchLatestNews 会自动
    // 降级到免 Key 的开放数据源，不会因为没配置而报错或跳过。
    const savedSettings = await db.settings.get('newspaper_settings');
    const tavilyKey = savedSettings?.value?.tavilyKey || '';

    const results = await searchLatestNews('今日趣闻', { tavilyKey });
    if (!Array.isArray(results) || results.length === 0) return null;

    const picked = results[Math.floor(Math.random() * results.length)];
    if (!picked?.title) return null;

    return {
      title: picked.title,
      snippet: picked.snippet || '',
      source: picked.source || '',
    };
  } catch (error) {
    console.warn('[dailyLifeTopicPicker] 拉取今日资讯素材失败：', error);
    return null;
  }
};

/**
 * 给调用方返回 { topic, material }。
 * topic 恒为 DAILY_LIFE_TOPICS 四个值之一；material 是对应的素材对象，
 * mood/hobby 恒为 null，npc/news 拿不到真实素材时会降级成
 * { topic: 'mood', material: null } 返回。
 */
export const pickDailyLifeTopic = async (chatId) => {
  const topic = pickRandomTopic();

  if (topic === DAILY_LIFE_TOPICS.NPC) {
    const material = await getRecentNpcSnapshotMaterial(chatId);
    if (!material) {
      return { topic: DAILY_LIFE_TOPICS.MOOD, material: null };
    }
    return { topic: DAILY_LIFE_TOPICS.NPC, material };
  }

  if (topic === DAILY_LIFE_TOPICS.NEWS) {
    const material = await getNewsMaterial();
    if (!material) {
      return { topic: DAILY_LIFE_TOPICS.MOOD, material: null };
    }
    return { topic: DAILY_LIFE_TOPICS.NEWS, material };
  }

  return { topic, material: null };
};

/**
 * 把 pickDailyLifeTopic() 的结果转成一段可以直接拼进 prompt 的中文描述。
 * 三个调用方（murmur / dailyPlan / snapshot 动态）共用同一套措辞，避免
 * 各自写一份、以后改了一处漏了另一处。
 *
 * mood 类别刻意返回空字符串——调用方原有的"单纯想到用户"这条 prompt
 * 分支保持不变，不需要这里额外补话。
 */
export const describeDailyLifeTopic = ({ topic, material }) => {
  if (topic === DAILY_LIFE_TOPICS.NPC && material) {
    return `此刻你想到的是和「${material.npcName}」有关的事——TA 最近发了一条动态："${material.postContent}"。可以借着这条动态自然地提一嘴你们之间的事，用你自己的话说，不需要逐字复述这条动态。`;
  }

  if (topic === DAILY_LIFE_TOPICS.NEWS && material) {
    return `此刻你刚好刷到一条资讯："${material.title}"${material.snippet ? `（${material.snippet}）` : ''}。可以把这当成你自己刷到、随口提一句的东西，用你的人设口吻去说，不需要像播报新闻一样正式，也不用逐字复述。`;
  }

  if (topic === DAILY_LIFE_TOPICS.HOBBY) {
    return '此刻你想到的是自己工作或爱好上的一件小事，跟用户没有直接关系，单纯是你自己生活里的一点小事，结合你的人设自己想一件具体的事。';
  }

  return '';
};

/**
 * describeDailyLifeTopic() 的短语版本，给"请围绕心境或灵感：'X'创作"这种
 * 已经有自己句式的 prompt 模板用（比如 snapshotAiService.js 里
 * generateCharacterPost 的 topicHint 参数）——只给一个短语/主题，
 * 不是一整句写给角色的指令，避免跟模板自己的句式重复或打架。
 *
 * mood 类别刻意返回空字符串，调用方看到空字符串就用回原来"不给
 * topicHint"的那条默认分支即可。
 */
export const describeDailyLifeTopicAsHint = ({ topic, material }) => {
  if (topic === DAILY_LIFE_TOPICS.NPC && material) {
    return `和「${material.npcName}」有关的小事，TA 最近发的动态是"${material.postContent}"`;
  }

  if (topic === DAILY_LIFE_TOPICS.NEWS && material) {
    return `刚刷到的一条资讯："${material.title}"`;
  }

  if (topic === DAILY_LIFE_TOPICS.HOBBY) {
    return '自己工作或爱好上的一件小事';
  }

  return '';
};