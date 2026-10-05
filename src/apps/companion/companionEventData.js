/*
 * "小伙伴"特殊事件目录——纯数据，不含任何 db 读写（逻辑在
 * companionEventService.js）。三种事件：
 *
 *   - flavor：纯氛围小事件（心情异常、认识新朋友、学会新技能……），
 *     只给一点点数值小加成，不解锁任何东西，可以反复触发。
 *   - rare_unlock：触发一次就永久解锁对应的稀有食物购买资格
 *     （解锁状态记在 companion.unlockedRareFoodIds，触发过一次后
 *     这条事件不会再触发——判断方式就是"那个食物 id 是否已经在
 *     解锁列表里"，不需要额外的"已触发"标记）。
 *   - legendary_grant：触发一次就给 1 份对应的传说食物（存进
 *     companion.legendaryStock），可以反复触发（毕竟是消耗品），
 *     但全局有冷却（见 companionEventService.js 的
 *     MIN_LEGENDARY_GRANT_GAP_HOURS），防止短时间内连续刷到。
 *
 * check(ctx) 是纯函数，ctx 由 companionEventService.js 在每次判定时
 * 组装（daysSinceAdopt、daysSinceLastOpen、companion 当前各项计数
 * 字段等），这里不直接访问 companion 原始字段，方便以后要加新派生
 * 数据时只用改 service 这一处。
 *
 * 【关于"清洁度"】：目前小伙伴只有饱食/心情两个数值属性，还没有真正
 * 的清洁度数值字段，"泡了一个悠长的澡"这条事件改成了用"累计清洁互动
 * 次数"代替原本设想的"清洁度满格"，等后续真的加了清洁度属性，
 * 只需要改这一条的 check，不影响别的事件。
 *
 * 【关于"生日/节日"】：需要用户先设置生日才能判断，这个功能现在还没
 * 有，所以"今天是个特别的日子"这条传说事件先不放进自动判定池
 * （isAutoRollable: false），留着以后接上生日设置后再打开。
 */

export const EVENT_KINDS = {
  FLAVOR: 'flavor',
  RARE_UNLOCK: 'rare_unlock',
  LEGENDARY_GRANT: 'legendary_grant',
};

// ---- 氛围小事件：心情异常 / 想要东西 / 认识新朋友 / 学会技能 ----
export const FLAVOR_EVENTS = [
  {
    id: 'flavor-mood-low',
    kind: EVENT_KINDS.FLAVOR,
    title: '它好像有点低落',
    bannerText: '它窝在角落里，看起来不太开心……',
    characterLine: (name) => `${name}今天好像有点闷闷的，蹲在角落里不太想动，要不要去陪陪它？`,
    reward: { mood: 5 },
    probability: 0.08,
    check: (ctx) => ctx.mood < 40,
  },
  {
    id: 'flavor-mood-high',
    kind: EVENT_KINDS.FLAVOR,
    title: '它兴奋得跳了起来',
    bannerText: '它绕着圈圈跑，心情好得不行！',
    characterLine: (name) => `${name}今天兴奋得不得了，一直围着你转圈圈，看着就让人开心。`,
    reward: { hearts: 1 },
    probability: 0.08,
    check: (ctx) => ctx.mood > 85,
  },
  {
    id: 'flavor-new-friend',
    kind: EVENT_KINDS.FLAVOR,
    title: '它好像认识了新朋友',
    bannerText: '它趴在窗边，好像在跟外面的谁打招呼。',
    characterLine: (name) => `${name}好像在窗边认识了个新朋友，叽叽喳喳地跟对方"聊"了好一会儿。`,
    reward: { mood: 6 },
    probability: 0.05,
    check: (ctx) => ctx.daysSinceAdopt >= 2,
  },
  {
    id: 'flavor-new-skill',
    kind: EVENT_KINDS.FLAVOR,
    title: '它学会了一个新技能',
    bannerText: '它正得意地展示一个新学会的小动作！',
    characterLine: (name) => `${name}好像自己偷偷学会了个新把戏，一直在你面前得意地表演。`,
    reward: { mood: 8 },
    probability: 0.05,
    check: (ctx) => ctx.daysSinceAdopt >= 3,
  },
  {
    id: 'flavor-wants-something',
    kind: EVENT_KINDS.FLAVOR,
    title: '它好像很想要点什么',
    bannerText: '它盯着商店的方向，眼神里全是期待。',
    characterLine: (name) => `${name}一直盯着商店那边看，好像很想要点什么好吃的或者好玩的。`,
    reward: {},
    probability: 0.06,
    check: (ctx) => ctx.satiety < 60 && ctx.mood < 70,
  },
  {
    id: 'flavor-nice-dream',
    kind: EVENT_KINDS.FLAVOR,
    title: '它做了一个有趣的梦',
    bannerText: '它睡醒之后一直盯着你，好像在回味什么。',
    characterLine: (name) => `${name}好像刚睡醒，迷迷糊糊地盯着你，像是梦到了什么有趣的事。`,
    reward: { mood: 3 },
    probability: 0.04,
    check: () => true,
  },
];

// ---- 稀有食物解锁事件：触发一次，永久解锁对应食物的购买资格 ----
export const RARE_UNLOCK_EVENTS = [
  {
    id: 'rare-unlock-old-recipe',
    kind: EVENT_KINDS.RARE_UNLOCK,
    title: '发现了角落里的旧食谱',
    bannerText: '它翻出了一本旧食谱，上面画着樱花年糕的做法。',
    characterLine: (name) => `${name}翻出了一本旧食谱，兴冲冲地指着上面"樱花年糕"的插画，看起来很想尝尝。`,
    grantsFoodId: 'food-sakura-mochi',
    check: (ctx) => ctx.daysSinceAdopt >= 7,
  },
  {
    id: 'rare-unlock-mood-streak',
    kind: EVENT_KINDS.RARE_UNLOCK,
    title: '某天心情特别好',
    bannerText: '它一连好几次都是最开心的样子，像是打开了什么新世界。',
    characterLine: (name) => `${name}这几天心情都特别好，好像因为这样学会了做奶油泡芙。`,
    grantsFoodId: 'food-cream-puff',
    check: (ctx) => ctx.moodFullStreak >= 3,
  },
  {
    id: 'rare-unlock-long-bath',
    kind: EVENT_KINDS.RARE_UNLOCK,
    title: '泡了一个悠长的澡',
    bannerText: '它刚洗完澡，整个人暖烘烘的，闻起来香香的。',
    characterLine: (name) => `${name}刚洗完一个很舒服的澡，暖烘烘地凑过来，好像特别想吃溏心温泉蛋。`,
    grantsFoodId: 'food-onsen-egg',
    check: (ctx) => ctx.cleanActionCount >= 15,
  },
  {
    id: 'rare-unlock-spilled-lemon',
    kind: EVENT_KINDS.RARE_UNLOCK,
    title: '打翻了一瓶柠檬汁',
    bannerText: '它不小心碰倒了柠檬汁，反而闻出了新灵感。',
    characterLine: (name) => `${name}不小心打翻了一瓶柠檬汁，闻着闻着居然琢磨出了薄荷柠檬挞的配方。`,
    grantsFoodId: 'food-mint-lemon-tart',
    probability: 0.01,
    check: () => true,
  },
  {
    id: 'rare-unlock-matcha-dream',
    kind: EVENT_KINDS.RARE_UNLOCK,
    title: '做了一个关于抹茶的梦',
    bannerText: '它睡得很香，嘴里好像还在念叨着"抹茶"。',
    characterLine: (name) => `${name}梦里好像全是抹茶的味道，醒来就缠着要抹茶千层。`,
    grantsFoodId: 'food-matcha-millefeuille',
    // 心情越高，越容易做个好梦——概率随 mood 线性提高。
    probability: null,
    getProbability: (ctx) => 0.015 + (ctx.mood / 100) * 0.03,
    check: () => true,
  },
  {
    id: 'rare-unlock-fridge-cheese',
    kind: EVENT_KINDS.RARE_UNLOCK,
    title: '翻出了冰箱里的奶酪',
    bannerText: '它饿得不行，自己翻冰箱找到了一块奶酪。',
    characterLine: (name) => `${name}饿得翻遍了冰箱，最后啃着一块奶酪，像是发现了芝士焗红薯的灵感。`,
    grantsFoodId: 'food-cheese-sweet-potato',
    check: (ctx) => ctx.satiety < 30,
  },
  {
    id: 'rare-unlock-learned-recipe',
    kind: EVENT_KINDS.RARE_UNLOCK,
    title: '偷偷学会了一个食谱',
    bannerText: '它趴在你喂食的样子旁边偷偷观察了好久。',
    characterLine: (name) => `${name}偷偷观察你喂它吃了那么多次，终于自己也学会了做草莓大福。`,
    grantsFoodId: 'food-strawberry-daifuku',
    check: (ctx) => ctx.feedCount >= 50,
  },
  {
    id: 'rare-unlock-garden-dream',
    kind: EVENT_KINDS.RARE_UNLOCK,
    title: '梦见了花园',
    bannerText: '它趴在窗边睡着了，嘴角带着笑意，像是梦到了一座花园。',
    characterLine: (name) => `${name}这一个月陪你陪得很开心，昨晚还梦到了一座开满玫瑰的花园。`,
    grantsFoodId: 'food-rose-pudding',
    check: (ctx) => ctx.daysSinceAdopt >= 30,
  },
];

// ---- 传说食物触发事件：触发一次就给 1 份对应传说食物 ----
export const LEGENDARY_GRANT_EVENTS = [
  {
    id: 'legendary-shooting-star',
    kind: EVENT_KINDS.LEGENDARY_GRANT,
    title: '流星划过',
    bannerText: '夜空中划过一道流星，它许了个愿望。',
    characterLine: (name) => `${name}好像看到了一道流星，兴奋地拉着你一起许愿，然后不知从哪变出了一串流星糖葫芦。`,
    grantsFoodId: 'food-shooting-star-candy',
    probability: 0.002,
    check: () => true,
  },
  {
    id: 'legendary-missed-you',
    kind: EVENT_KINDS.LEGENDARY_GRANT,
    title: '好久没见，好想你',
    bannerText: '它窝在原地等了你好久，终于等到你回来了。',
    characterLine: (name) => `${name}已经好几天没见到你了，一直等在原地，见到你的第一件事就是把珍藏的梦境马卡龙拿出来分你一半。`,
    grantsFoodId: 'food-dream-macaron',
    check: (ctx) => ctx.daysSinceLastOpen >= 5,
  },
  {
    id: 'legendary-mystery-box',
    kind: EVENT_KINDS.LEGENDARY_GRANT,
    title: '捡到了一个神秘礼盒',
    bannerText: '它叼回来一个包装精美的小礼盒，不知道从哪捡到的。',
    characterLine: (name) => `${name}不知道从哪叼回来一个神秘礼盒，拆开一看，里面是一包幸运饼干。`,
    grantsFoodId: 'food-lucky-cookie',
    probability: 0.03,
    check: () => true,
  },
  {
    id: 'legendary-chef-gift',
    kind: EVENT_KINDS.LEGENDARY_GRANT,
    title: '梦里的厨师送来了礼物',
    bannerText: '它说梦里有个神秘的厨师，送了它一份特别的礼物。',
    characterLine: (name) => `${name}陪你整整 100 天了，说梦里有个厨师出现，送了它一份金灿灿的栗子饭当作礼物。`,
    grantsFoodId: 'food-golden-chestnut-rice',
    // 陪伴满 100 天是个一次性里程碑，不是"每次打开都满足"的常驻条件，
    // 只触发一次——靠 companion.firedMilestoneEventIds 记录，不会反复给。
    oncePerLifetime: true,
    check: (ctx) => ctx.daysSinceAdopt >= 100,
  },
  {
    id: 'legendary-rainbow-moment',
    kind: EVENT_KINDS.LEGENDARY_GRANT,
    title: '彩虹出现的那一刻',
    bannerText: '它指着天边的彩虹，整只都在发光一样开心。',
    characterLine: (name) => `${name}指着天边一道彩虹，兴奋地说这是好运气的预兆，变出了一碗星空果冻。`,
    grantsFoodId: 'food-starry-jelly',
    probability: 0.007,
    check: () => true,
  },
  {
    id: 'legendary-time-loop-feeling',
    kind: EVENT_KINDS.LEGENDARY_GRANT,
    title: '时光倒流的错觉',
    bannerText: '它望着你，好像在回忆你们相处的每一个瞬间。',
    characterLine: (name) => `${name}数了数你们已经互动了 1000 次，恍惚间有种时光倒流的错觉，郑重地端出一碗时光奶油冻。`,
    grantsFoodId: 'food-time-cream-pudding',
    // 同上，1000 次互动也是一次性里程碑，不会每次打开都重复触发。
    oncePerLifetime: true,
    check: (ctx) => ctx.totalInteractionCount >= 1000,
  },
  {
    id: 'legendary-special-day',
    kind: EVENT_KINDS.LEGENDARY_GRANT,
    title: '今天是个特别的日子',
    bannerText: '它好像知道今天有什么特别的意义。',
    characterLine: (name) => `${name}好像知道今天是个特别的日子，特地准备了一份彩虹蜂蜜蛋糕。`,
    grantsFoodId: 'food-rainbow-honey-cake',
    // 需要先有"生日/纪念日"设置才能真正判断，暂不加入自动判定池。
    isAutoRollable: false,
    check: () => false,
  },
  {
    id: 'legendary-catch-all-good-day',
    kind: EVENT_KINDS.LEGENDARY_GRANT,
    title: '今天一定会有好事发生',
    bannerText: '它莫名其妙地开始翻箱倒柜，像是在找什么惊喜。',
    characterLine: (name) => `${name}莫名其妙地开始翻箱倒柜，最后举着一卷初雪抹茶卷跑了回来，说今天一定会有好事发生。`,
    grantsFoodId: 'food-first-snow-matcha-roll',
    // 兜底事件：以上传说事件这次都没命中时，极小概率给个"安慰"惊喜。
    probability: 0.005,
    check: () => true,
  },
];

export const ALL_EVENT_DEFS = [
  ...FLAVOR_EVENTS,
  ...RARE_UNLOCK_EVENTS,
  ...LEGENDARY_GRANT_EVENTS,
];

export const findEventDef = (eventDefId) => (
  ALL_EVENT_DEFS.find((def) => def.id === eventDefId) || null
);