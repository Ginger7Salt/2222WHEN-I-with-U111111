/*
 * "小伙伴"（#6 聊天窗宠物）静态数据：默认形态图 + 商店目录。
 *
 * 这里不是数据库表——商店本身没有"库存"概念（每件商品可以无限次购买），
 * 需要持久化的只是"这只宠物买过/穿着哪件"，那部分存在 companionInventory
 * 表里（见 companionService.js）。
 *
 * 【用户后续替换默认形态图】：DEFAULT_AVATARS 里的 url 目前是占位 SVG
 * （内联 data URI，不依赖 public 目录下的文件）。等你自己生好图、
 * 有图床链接之后，把对应的 url 换成图床链接即可，不用改别的代码。
 * 换成图床链接前，请确认链接是你自己的图/没有版权问题（仓库是公开的，
 * 参考第 0 节 PlaceBooklet.jsx 里 MAP_IMAGE_URL 的先例）。
 */

const placeholderAvatarSvg = (fill) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="92" fill="${fill}" opacity="0.18" />
      <circle cx="100" cy="112" r="58" fill="${fill}" opacity="0.55" />
      <circle cx="72" cy="86" r="10" fill="${fill}" />
      <circle cx="128" cy="86" r="10" fill="${fill}" />
      <path d="M78 132 Q100 148 122 132" stroke="${fill}" stroke-width="6" fill="none" stroke-linecap="round" />
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// 三个占位形态，用不同颜色区分；替换成真实图片前，先能选、能领养、能看见。
 export const DEFAULT_AVATARS = [
{ id: 'preset-a', label: '形态 A', url: 'https://u2.fukit.cn/GBd84WFuR' },
   { id: 'preset-b', label: '形态 B', url: placeholderAvatarSvg('#F4B860') },
   { id: 'preset-c', label: '形态 C', url: placeholderAvatarSvg('#7FB3D5') },
 ];

/*
 * 食物：花 ❤️ 买来直接喂给宠物（买 = 喂，不单独占一个"背包"步骤）。
 * satiety / mood 是买下后立刻生效的加成，数值和价格都只是起步默认值，
 * 用户测试后可以随时调整这里的数字，不用改逻辑代码。
 */
export const SHOP_FOOD_ITEMS = [
  { id: 'food-snack', name: '小零食', price: 5, satiety: 15, mood: 3 },
  { id: 'food-meal', name: '爱心便当', price: 12, satiety: 35, mood: 8 },
  { id: 'food-treat', name: '限定小甜点', price: 20, satiety: 20, mood: 20 },
];

/*
 * 衣服：纯文字，买下后永久拥有，可在"穿着"里选择要不要穿上；
 * 不做换装视觉，宠物形象图本身不会因为穿了什么而改变。
 */
export const SHOP_CLOTHING_ITEMS = [
  { id: 'outfit-sweater', name: '藏青色小毛衣', price: 25 },
  { id: 'outfit-scarf', name: '格纹小围巾', price: 18 },
  { id: 'outfit-bowtie', name: '绅士领结', price: 15 },
  { id: 'outfit-cap', name: '毛线小帽', price: 15 },
];

export const findShopItem = (itemId) => (
  SHOP_FOOD_ITEMS.find((item) => item.id === itemId)
  || SHOP_CLOTHING_ITEMS.find((item) => item.id === itemId)
  || null
);

/*
 * 场景背景：小伙伴页面"装修房间"用的背景图，用户在场景选择里四选一，
 * 选择会持久化在 companion.background 上（见 companionService.js 的
 * setCompanionScene）。跟 DEFAULT_AVATARS 一样，这里先放占位渐变图，
 * 等你出好图之后直接把对应 url 换成图床链接即可，不用改别的代码。
 */
const placeholderSceneSvg = (from, to, label) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect width="400" height="600" fill="url(#g)" />
      <circle cx="320" cy="90" r="46" fill="#ffffff" opacity="0.18" />
      <circle cx="60" cy="480" r="70" fill="#ffffff" opacity="0.12" />
      <text x="200" y="300" font-family="sans-serif" font-size="22" fill="#ffffff" opacity="0.55" text-anchor="middle">${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const COMPANION_SCENES = [
  { id: 'scene-a', label: '场景 A', url: placeholderSceneSvg('#F7D9B6', '#F2A65A', '场景 A') },
  { id: 'scene-b', label: '场景 B', url: placeholderSceneSvg('#BFE3D0', '#6FA98C', '场景 B') },
  { id: 'scene-c', label: '场景 C', url: placeholderSceneSvg('#C9D9F2', '#7B93C4', '场景 C') },
  { id: 'scene-d', label: '场景 D', url: placeholderSceneSvg('#EAC6D6', '#C97FA0', '场景 D') },
];

export const findScene = (sceneId) => (
  COMPANION_SCENES.find((scene) => scene.id === sceneId) || null
);