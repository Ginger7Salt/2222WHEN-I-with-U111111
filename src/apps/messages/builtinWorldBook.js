// src/apps/messages/builtinWorldBook.js
//
// ChatRoom（普通聊天窗）专属的内置世界书——纯代码维护，不走数据库、
// 不走界面编辑：直接改这个文件里的 BUILTIN_WORLD_BOOKS 数组来增删书/
// 条目即可，改完立刻生效，不需要任何"播种"或迁移步骤。
//
// 刻意跟两套已有的东西完全独立、互不共用：
//   - 长RP自己的世界书（rpWorldBooks 表 + RpWorldBookManager.jsx，用户
//     在界面里建/编辑、按会话挂载）——那套服务的是长RP子应用，不会因为
//     这个文件而多出内容，这个文件也不会出现在长RP的书架里。
//   - shared-world 全局共享设定（sharedWorldService.js）——那是跨角色的
//     全局背景，不是"一本本带关键词的世界书"这个概念。
// 这个文件只给普通聊天窗（ChatRoom）用，只有一份内置的、写死在代码里
// 的库，没有用户建书/挂书这一层。
//
// 每本书的结构：
//   {
//     name: '书名（只是给你自己看、方便分类用，不会发给AI，也不会在
//            界面上展示给user）',
//     entries: [
//       { keywords: ['关键词1', '关键词2'], content: '命中后注入给AI的背景设定文本' },
//       ...
//     ],
//   }
//
// - keywords：纯文本包含匹配，不区分大小写，不支持正则。
// - content：命中任意一个关键词就会把这一条整段注入进提示词，建议控制
//   在两三句话以内——需要讲清楚的大背景拆成多条、分别配不同关键词，
//   比一条又长又杂的描述更容易被命中、也更省token。
// - 聊天窗设置里的"内置世界书"开关管的是这整个库要不要参与扫描，是
//   全有或全无（没有"只启用其中几本"的界面）；想让某本书/某条暂时不
//   生效，直接从下面删掉或注释掉对应的对象即可。
//
// 下面是示例/占位内容，照着这个格式改成你自己世界观的设定即可——书名、
// 条目数量都不需要对齐，想加几本书、每本加几条都可以。
export const BUILTIN_WORLD_BOOKS = [
  {
    name: '示例书·世界观基础',
    entries: [
      {
        keywords: ['猎人协会', '协会'],
        content: '猎人协会是这个世界里负责登记、派遣、监管所有持证猎人的官方机构，总部设在中央城，各大区设有分部。',
      },
      {
        keywords: ['深渊', '异界裂隙'],
        content: '深渊是散布在世界各地的异界裂隙，会周期性地涌出魔物，普通人无法靠近，只有持证猎人能够进入执行讨伐任务。',
      },
      {
        keywords: ['晶币', '货币'],
        content: '这个世界通用的流通货币是晶币，由讨伐魔物掉落的魔晶提炼压制而成，猎人协会按任务等级结算报酬。',
      },
    ],
  },
  {
    name: '示例书·人物与地点',
    entries: [
      {
        keywords: ['中央城', '首都'],
        content: '中央城是猎人协会总部所在地，也是这个世界人口最密集、最繁华的城市，大型任务和重要事件大多从这里发起。',
      },
      {
        keywords: ['师父', '前辈'],
        content: '角色早年曾有一位亦师亦友的前辈带领入行，这位前辈如今下落不明，是角色心里一直没放下的一件事。',
      },
    ],
  },
];

/**
 * 扫描 BUILTIN_WORLD_BOOKS，找出 scanText 里命中关键词的条目，拼成一段
 * 可以直接塞进system prompt的文本。
 *
 * - scanText：调用方负责拼好要扫描的文本（通常是最近几条消息），这个
 *   函数只管在给定文本里找关键词。
 * - 关键词匹配：纯文本包含、大小写不敏感。
 * - 所有书的条目汇总在一起按 maxEntries 总数上限截取，不是每本书各自
 *   限额——先到先得（按上面数组里书的顺序、书内条目的顺序）。
 * - 纯同步函数，不读任何数据库/网络——这个文件本身就是数据源。
 */
export const scanBuiltinWorldBook = (scanText, { maxEntries = 5 } = {}) => {
  const text = String(scanText || '').toLowerCase();
  if (!text) return '';

  const matched = [];

  for (const book of BUILTIN_WORLD_BOOKS) {
    for (const entry of (book.entries || [])) {
      if (matched.length >= maxEntries) break;
      if (!entry.content) continue;

      const keywords = Array.isArray(entry.keywords) ? entry.keywords : [];
      const hit = keywords.some((kw) => kw && text.includes(String(kw).toLowerCase()));
      if (hit) matched.push(entry);
    }
    if (matched.length >= maxEntries) break;
  }

  if (matched.length === 0) return '';

  return `【内置世界书背景设定】\n${matched.map((e) => `- ${e.content}`).join('\n')}`;
};

export default BUILTIN_WORLD_BOOKS;