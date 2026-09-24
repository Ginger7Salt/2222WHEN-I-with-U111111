import {
  MEMORY_TYPES
} from './memoryConstants';

/*
 * 联想：想到 A 时顺着共同的人或事物带出相关的 B，再带出 C。
 * 例如用户提起朋友，角色想到"用户朋友的朋友叫小红"，再想到"小红喜欢喝奶茶"。
 *
 * 纯函数，不读写数据库，不调用 AI。
 *
 * 记忆之间靠"节点"相连：
 *   - entities：提炼时 AI 给出的这条记忆涉及的具体人物、物品、地点（权重 1）；
 *   - topicKey / topicKeys：主题键（权重 0.7）。
 *     旧记忆没有 entities，靠主题键也能连上，所以不需要重新提炼旧记忆。
 * 被太多记忆共用的节点（比如"work"）太泛，联想不走它，避免什么都连在一起。
 *
 * 每往外走一步，分数打一次折；最多走两步。
 */

export const MAX_ASSOCIATED = 2;
export const MAX_HOPS = 2;

// 一个节点连着超过这么多条记忆，就认为太泛，不用来联想。
export const HUB_LIMIT = 6;

const HOP_DECAY = 0.6;
const ENTITY_WEIGHT = 1;
const TOPIC_WEIGHT = 0.7;

// 每一步最多沿着几条记忆继续往外走，防止扩散得太大。
const FRONTIER_LIMIT = 6;

// 联想得分低于这个值就不带出来。
export const MIN_ASSOCIATION_SCORE = 0.15;

// 只有与当前话题重合度达到这个值的记忆，才有资格作为联想的出发点。
export const MIN_SEED_STRENGTH = 0.3;

/*
 * 只联想这几类：稳定陈述和共同经历。
 * 情绪有自己的召回和淡出，反思和看法是综合产物，表达边界一直生效，
 * 角色内部背景不能当成用户的事顺带说出来。
 */
const ASSOCIABLE_TYPES = new Set([
  MEMORY_TYPES.FACT,
  MEMORY_TYPES.PREFERENCE,
  MEMORY_TYPES.EPISODE,
  MEMORY_TYPES.RELATIONSHIP
]);

const GENERIC_ENTITIES = new Set([
  '用户', '我', '你', '他', '她', '它', '我们', '你们', '自己',
  '角色', 'user', 'character', 'ai', 'assistant', 'me', 'you'
]);

export const normalizeEntity = (value) => {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  if (!text || text.length > 20) return '';
  if (GENERIC_ENTITIES.has(text)) return '';

  return text;
};

export const normalizeEntityList = (value, limit = 6) => {
  const items = Array.isArray(value) ? value : [];

  return [...new Set(items.map(normalizeEntity).filter(Boolean))]
    .slice(0, limit);
};

export const isAssociableMemory = (memory) => (
  Boolean(memory) &&
  ASSOCIABLE_TYPES.has(memory.type) &&
  memory.recallPolicy !== 'when_relevant'
);

/*
 * 一条记忆连着的所有节点：Map<节点, 权重>。
 */
export const getMemoryNodes = (memory) => {
  const nodes = new Map();

  const put = (rawValue, weight) => {
    const key = normalizeEntity(rawValue);

    if (!key) return;

    nodes.set(key, Math.max(nodes.get(key) || 0, weight));
  };

  for (const entity of (Array.isArray(memory?.entities) ? memory.entities : [])) {
    put(entity, ENTITY_WEIGHT);
  }

  put(memory?.topicKey, TOPIC_WEIGHT);

  for (const key of (Array.isArray(memory?.topicKeys) ? memory.topicKeys : [])) {
    put(key, TOPIC_WEIGHT);
  }

  return nodes;
};

const buildNodeIndex = (pool) => {
  const index = new Map();

  for (const memory of pool) {
    for (const [node] of getMemoryNodes(memory)) {
      if (!index.has(node)) index.set(node, []);

      index.get(node).push(memory);
    }
  }

  return index;
};

const getImportanceFactor = (memory) => (
  0.7 + 0.3 * (Math.max(1, Math.min(5, Number(memory?.importance || 3))) / 5)
);

/*
 * seeds：[{ memory, strength }]，已经被这轮召回选中的记忆及它与当前话题的重合度（0 到 1）。
 * pool：可以参与联想的全部记忆（包含 seeds）。
 * isEligible(memory)：能不能作为联想结果输出（冷却、刚做过的事等由调用方判断）。
 *   注意：不合格的记忆仍然可以当"桥"往下走，只是自己不会被输出。
 *
 * 返回按得分从高到低排好的 [{ memory, score, hop, via }]，via 是这一步经过的节点名。
 */
export const findAssociatedMemories = ({
  seeds = [],
  pool = [],
  isEligible = () => true,
  maxCount = MAX_ASSOCIATED,
  maxHops = MAX_HOPS
} = {}) => {
  const validSeeds = seeds.filter((seed) => (
    seed?.memory && Number(seed.strength) >= MIN_SEED_STRENGTH
  ));

  if (!validSeeds.length || !pool.length) return [];

  const index = buildNodeIndex(pool);

  const visited = new Set(validSeeds.map((seed) => seed.memory.memoryId));
  const best = new Map();

  let frontier = validSeeds.map((seed) => ({
    memory: seed.memory,
    score: Math.min(1, Number(seed.strength))
  }));

  for (let hop = 1; hop <= maxHops; hop += 1) {
    const next = new Map();

    for (const item of frontier) {
      for (const [node, ownWeight] of getMemoryNodes(item.memory)) {
        const linked = index.get(node) || [];

        if (linked.length > HUB_LIMIT) continue;

        for (const other of linked) {
          if (visited.has(other.memoryId)) continue;

          const otherWeight = getMemoryNodes(other).get(node) || TOPIC_WEIGHT;
          const linkWeight = Math.min(ownWeight, otherWeight);

          const score = item.score
            * HOP_DECAY
            * linkWeight
            * getImportanceFactor(other);

          const current = next.get(other.memoryId);

          if (!current || score > current.score) {
            next.set(other.memoryId, {
              memory: other,
              score,
              hop,
              via: node
            });
          }
        }
      }
    }

    const found = [...next.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, FRONTIER_LIMIT);

    for (const entry of found) {
      visited.add(entry.memory.memoryId);

      const previous = best.get(entry.memory.memoryId);

      if (!previous || entry.score > previous.score) {
        best.set(entry.memory.memoryId, entry);
      }
    }

    frontier = found;

    if (!frontier.length) break;
  }

  return [...best.values()]
    .filter((entry) => (
      entry.score >= MIN_ASSOCIATION_SCORE &&
      isAssociableMemory(entry.memory) &&
      isEligible(entry.memory)
    ))
    .sort((left, right) => right.score - left.score)
    .slice(0, maxCount);
};

/*
 * 联想到的记忆在提示词里的写法：明确标出"是顺着什么想到的"，
 * 并提醒角色只在接得上话时顺带提起，不要当作要汇报的事。
 */
export const buildAssociationHeader = () => `
【由此联想到的（不是用户这句话直接提到的）】
下面是顺着当前话题里的人或事物，角色自然联想到的旧事。
只有接得上当前对话时才顺带提一句，接不上就不要提；不要当作要汇报的事，也不要一次说很多。
联想到的内容不一定仍然成立，不确定时可以用"我记得好像……"的口吻。
`;