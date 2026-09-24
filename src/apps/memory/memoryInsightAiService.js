import {
  requestTidyCompletion
} from './memoryTidyAiService';

/*
 * 记忆整理里"认知层面"的两个 AI 调用：
 *   1. judgeMemoryPairs：几组新旧记忆，是不是互相冲突、能不能精简合并；
 *   2. generateDomainBeliefs：把某个领域的一批记忆，综合成角色对用户的稳定看法。
 *
 * 只负责"问 AI、把结果规范化"，不读写 memories 表；落库和"要不要先问用户"
 * 都在 memoryConflictService.js / memoryBeliefService.js 里决定。
 * 请求本身复用 memoryTidyAiService.js 里的 requestTidyCompletion。
 */

const MAX_BELIEFS_PER_RUN = 3;

const normalizeText = (value) => String(value || '').trim();

const normalizeImportance = (value) => {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 3;
  }

  return Math.max(1, Math.min(5, Math.round(numberValue)));
};

const formatDate = (value) => (
  value ? String(value).slice(0, 10) : '日期未知'
);

const getAuthorityText = (memory) => (
  (
    memory.confidence === 'user_written' ||
    memory.userEditedAt ||
    memory.userConfirmedAt ||
    memory.sourceKind === 'user_created'
  )
    ? '用户手写或确认过'
    : 'AI 从对话推断'
);

/* ------------------------------------------------------------------ */
/* 新旧记忆：冲突 / 补充                                                */
/* ------------------------------------------------------------------ */

const PAIR_SYSTEM_PROMPT = `
你负责整理一段私人数字陪伴关系里的记忆档案。下面有几组记忆，每组是"较旧"和"较新"的两条，已经被程序初筛为"可能在说同一个方面"。

你的职责：逐组判断它们的关系。不要使用角色口吻，不要安慰，不要添加抒情语言。

relation 只能是以下四种之一：
- conflict：两条对同一个人的同一方面说法互相矛盾，或者较新的已经取代了较旧的（例如搬了家、改变了偏好、纠正了说法）。
- complementary：两条说的是同一件事的不同细节，互不矛盾，合成一条更完整、更简洁。
- compatible：两条并不矛盾，也没必要合并（比如各自说的是不同的具体事件，或者是同一偏好的不同层面）。
- unrelated：其实不是同一个方面。

规则：
1. 拿不准就选 compatible，宁可多留一条，也不要误判为冲突。
2. 两条说的是不同时间发生的具体事件、或者针对不同对象，不算冲突。
3. relation 为 conflict 时，用 winner 指出哪一条现在仍然成立（older 或 newer）。通常较新的更可信；但如果较新的一条只是"AI 从对话推断"，而较旧的是"用户手写或确认过"，除非较新的内容明确显示用户改变了主意或更正了说法，否则不要判较新的取代较旧的。
4. relation 为 conflict 或 complementary 时，给出 title 和 content：
   - conflict：只写现在仍然成立的说法；必要时可以带一句变化的说明，例如"以前爱吃辣，后来不吃辣了"。
   - complementary：把两条的有效信息合成一条。
   - 不得添加给定记忆里没有的信息，不得推测，不得美化；不要出现"昨天、今天、最近"这类相对时间词。
   - title 不超过 30 字，content 用一到三句话，克制、客观。
5. importance 为 1 到 5 的整数，不低于两条中较高的一个。
6. relation 是 compatible 或 unrelated 时，title 和 content 输出空字符串，winner 输出 null。
7. reason 用一句话说明判断依据。
8. 不得使用 Emoji，只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "results": [
    {
      "index": 1,
      "relation": "conflict | complementary | compatible | unrelated",
      "winner": "older | newer | null",
      "title": "不超过 30 字",
      "content": "解决后的内容",
      "importance": 3,
      "reason": "一句话"
    }
  ]
}
`;

const buildPairLine = (memory, label) => (
  `${label}（${formatDate(memory.createdAt)}，${getAuthorityText(memory)}，${memory.type}）：${memory.title || ''}：${memory.content}`
);

const buildPairsUserPrompt = (pairs) => `
待判断的记忆组：
${pairs
    .map((pair, index) => (
      `第 ${index + 1} 组\n${buildPairLine(pair.older, '较旧')}\n${buildPairLine(pair.newer, '较新')}`
    ))
    .join('\n\n')}
`;

const RELATIONS = ['conflict', 'complementary', 'compatible', 'unrelated'];

/*
 * 输入：[{ older, newer }]（记忆对象）。
 * 输出：与输入等长的数组，每项 { relation, winner, title, content, importance, reason }。
 * conflict / complementary 但内容为空的，一律降级为 compatible。
 */
export const judgeMemoryPairs = async ({ pairs = [] }) => {
  if (!pairs.length) {
    return [];
  }

  const result = await requestTidyCompletion({
    systemPrompt: PAIR_SYSTEM_PROMPT,
    userPrompt: buildPairsUserPrompt(pairs)
  });

  const byIndex = new Map();

  for (const item of Array.isArray(result?.results) ? result.results : []) {
    const index = Number(item?.index);

    if (Number.isInteger(index) && index >= 1 && index <= pairs.length) {
      byIndex.set(index, item);
    }
  }

  return pairs.map((_, position) => {
    const item = byIndex.get(position + 1);

    const relation = RELATIONS.includes(item?.relation)
      ? item.relation
      : 'compatible';

    const title = normalizeText(item?.title).slice(0, 60);
    const content = normalizeText(item?.content).slice(0, 500);

    const needsContent = relation === 'conflict' || relation === 'complementary';

    if (needsContent && !content) {
      return {
        relation: 'compatible',
        winner: null,
        title: '',
        content: '',
        importance: 3,
        reason: ''
      };
    }

    return {
      relation,
      winner: relation === 'conflict'
        ? (item?.winner === 'older' ? 'older' : 'newer')
        : null,
      title: needsContent ? title : '',
      content: needsContent ? content : '',
      importance: normalizeImportance(item?.importance),
      reason: normalizeText(item?.reason).slice(0, 120)
    };
  });
};

/* ------------------------------------------------------------------ */
/* 领域看法                                                            */
/* ------------------------------------------------------------------ */

const BELIEF_SYSTEM_PROMPT = `
你负责为一段私人数字陪伴关系整理"角色对用户的看法"。下面是这段关系里积累下来的一批记忆（编号越大越新），以及已经形成的看法。

你的职责：按领域（比如饮食、工作、作息、感情、兴趣、家人朋友）把零散记忆综合成对用户在这个领域的稳定看法，例如"用户偏爱重口味，但最近在控制饮食"。不要使用角色口吻，不要安慰，不要添加抒情语言。

规则：
1. 只写有足够依据的领域：每条看法至少引用三条记忆，不能编造，不能只是复述其中一条。
2. 区分长期的倾向和近期的变化：新的记忆和旧的看法有出入时，以新的为准，把看法写成当前的样子，必要时带一句变化的说明。
3. 已有看法里如果已经有同一个领域的，用 updatesBeliefIndex 指出它的序号来修订，不要另外新建一条重复的；确实是新的领域才新建（updatesBeliefIndex 为 null）。
4. 只写"用户是什么样的人、倾向于什么"，不做诊断，不做医学或心理学判断，不评价用户对错。
5. 不得添加给定记忆里没有的信息，不得推测；记忆里没有依据的部分不写。
6. title 和 content 里不要出现"昨天、今天、最近、上周"这类相对时间词，看法会保存很久；变化用"以前……后来……"来表达。
7. domain 是 2 到 6 个字的领域名；content 用一到三句话，克制、客观。
8. importance 为 1 到 5 的整数，一般 3 到 4。
9. 最多输出 ${MAX_BELIEFS_PER_RUN} 条；没有值得写的就输出空数组，不要为了凑数硬写。
10. 每条必须给出 sourceMemoryIndexes，引用"记忆"列表里的序号（从 1 开始），不能编造不存在的序号。
11. 不得使用 Emoji，只输出严格 JSON，不要 Markdown，不要解释。

JSON 格式：
{
  "beliefs": [
    {
      "domain": "饮食",
      "title": "不超过 30 字",
      "content": "一到三句话的稳定看法",
      "importance": 3,
      "updatesBeliefIndex": null,
      "sourceMemoryIndexes": [1, 3, 5]
    }
  ]
}
`;

const buildBeliefUserPrompt = ({ memories, existingBeliefs }) => `
记忆（从旧到新）：
${memories
    .map((memory, index) => (
      `${index + 1}. ${formatDate(memory.createdAt)} [${memory.type}] ${memory.title || ''}：${memory.content}`
    ))
    .join('\n')}

已有看法：
${existingBeliefs.length
    ? existingBeliefs
      .map((memory, index) => `${index + 1}. [${memory.beliefDomain || '未标注领域'}] ${memory.title || ''}：${memory.content}`)
      .join('\n')
    : '无'}
`;

/*
 * 输入：一批证据记忆（从旧到新）、已有的看法记忆。
 * 输出：0 到 3 条 { domain, title, content, importance, updatesBeliefId, sourceMemoryIds }。
 */
export const generateDomainBeliefs = async ({
  memories = [],
  existingBeliefs = []
}) => {
  if (memories.length < 3) {
    return [];
  }

  const result = await requestTidyCompletion({
    systemPrompt: BELIEF_SYSTEM_PROMPT,
    userPrompt: buildBeliefUserPrompt({ memories, existingBeliefs })
  });

  const validIndexes = new Set(memories.map((_, index) => index + 1));

  return (Array.isArray(result?.beliefs) ? result.beliefs : [])
    .map((item) => {
      const sourceIndexes = Array.isArray(item?.sourceMemoryIndexes)
        ? [...new Set(
          item.sourceMemoryIndexes
            .map(Number)
            .filter((index) => validIndexes.has(index))
        )]
        : [];

      const updateIndex = Number(item?.updatesBeliefIndex);

      const target = (
        Number.isInteger(updateIndex) &&
        updateIndex >= 1 &&
        updateIndex <= existingBeliefs.length
      )
        ? existingBeliefs[updateIndex - 1]
        : null;

      return {
        domain: normalizeText(item?.domain).slice(0, 12),
        title: normalizeText(item?.title).slice(0, 60),
        content: normalizeText(item?.content).slice(0, 400),
        importance: normalizeImportance(item?.importance),
        updatesBeliefId: target?.memoryId || null,
        sourceMemoryIds: sourceIndexes
          .map((index) => memories[index - 1]?.memoryId)
          .filter(Boolean)
      };
    })
    .filter((item) => (
      item.domain &&
      item.content &&
      item.sourceMemoryIds.length >= 3
    ))
    .slice(0, MAX_BELIEFS_PER_RUN);
};