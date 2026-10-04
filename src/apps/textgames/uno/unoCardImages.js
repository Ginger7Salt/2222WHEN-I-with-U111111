// src/apps/textgames/uno/unoCardImages.js
//
// 牌面图片清单：把“哪一张牌”映射到“图床外链”。图床没法指定文件名，所以不靠
// 文件名约定，而是在这里一张一张填链接。没填（或填了但加载失败）的牌，
// UnoCard.jsx 会自动退回 CSS 画的牌面，所以可以边抠图边填，随时能玩。
//
// 不重复的图只有约 55 张：同色同数字的两张牌共用同一个 key，浏览器按 URL
// 缓存，不会存两份。图不要存进数据库，这里只放链接。
//
// key 的写法：<颜色>-<牌面>
//   颜色：black / red / white / darkblue
//   牌面：0-9、skip、reverse、draw2
//   例子：'red-5'、'darkblue-skip'、'black-draw2'
// 万能牌没有颜色：'wild'、'wild4'
// 牌背：'back'（牌堆和对手的手牌共用这一张）
//
// 建议导出 200x300 左右的 webp，每张 10-20KB；图床不能转格式的话 png 也行。
//
// 填法：把下面每一行引号里粘贴上对应那张图的链接。引号里留空的牌，
// 会自动用代码画的牌面，所以可以先填一部分，其余以后再补。
export const UNO_CARD_IMAGES = {
  // ---- 牌背（牌堆和对手的手牌共用这一张）----
  back: 'https://img.pagehost.cn/autoupload/amqnh/20261004/TMmP/1363X1957/kapai.jpg/webp',

  // ---- 万能牌 ----
  wild: 'https://img.pagehost.cn/autoupload/amqnh/20261004/WhjU/1431X2243/uno_%281%29.png/webp', // Wild 变色
  wild4: 'https://img.pagehost.cn/autoupload/amqnh/20261004/JauI/1432X2243/uno_%282%29.png/webp', // Wild Draw Four

  // ---- 黑 ----
  'black-0': 'https://img.pagehost.cn/autoupload/amqnh/20261004/b9Fa/1183X2000/0_%282%29.jpg/webp', // 黑 0
  'black-1': 'https://img.pagehost.cn/autoupload/amqnh/20261004/fVVu/781X1129/uno_%2831%29.png/webp', // 黑 1
  'black-2': 'https://img.pagehost.cn/autoupload/amqnh/20261004/w4gX/818X1161/uno_%2830%29.png/webp', // 黑 2
  'black-3': 'https://img.pagehost.cn/autoupload/amqnh/20261004/STuG/849X1190/uno_%2832%29.png/webp', // 黑 3
  'black-4': 'https://img.pagehost.cn/autoupload/amqnh/20261004/92Sg/783X1106/uno_%2833%29.png/webp', // 黑 4
  'black-5': 'https://img.pagehost.cn/autoupload/amqnh/20261004/ATYV/794X1076/uno_%2834%29.png/webp', // 黑 5
  'black-6': 'https://img.pagehost.cn/autoupload/amqnh/20261004/Onx0/785X1140/uno_%2835%29.png/webp', // 黑 6
  'black-7': 'https://img.pagehost.cn/autoupload/amqnh/20261004/Id6q/852X1125/uno_%2836%29.png/webp', // 黑 7
  'black-8': 'https://img.pagehost.cn/autoupload/amqnh/20261004/et9V/838X1079/uno_%2837%29.png/webp', // 黑 8
  'black-9': 'https://img.pagehost.cn/autoupload/amqnh/20261004/WNOa/782X1082/uno_%2838%29.png/webp', // 黑 9
  'black-skip': 'https://img.pagehost.cn/autoupload/amqnh/20261004/Un4t/1339X2050/un_%289%29.jpg/webp', // 黑 Skip
  'black-reverse': 'https://img.pagehost.cn/autoupload/amqnh/20261004/wfWr/1376X2100/un_%2811%29.jpg/webp', // 黑 Reverse
  'black-draw2': 'https://img.pagehost.cn/autoupload/amqnh/20261004/HoIl/852X1213/uno_%2847%29.png/webp', // 黑 Draw Two

  // ---- 红 ----
  'red-0': 'https://img.pagehost.cn/autoupload/amqnh/20261004/jdNS/1164X1998/0_%284%29.jpg/webp', // 红 0
  'red-1': 'https://img.pagehost.cn/autoupload/amqnh/20261004/xiqU/1402X2157/un_%288%29.jpg/webp', // 红 1
  'red-2': 'https://img.pagehost.cn/autoupload/amqnh/20261004/ij91/762X1141/uno_%2822%29.png/webp', // 红 2
  'red-3': 'https://img.pagehost.cn/autoupload/amqnh/20261004/vQBu/1416X2142/un_%2810%29.jpg/webp', // 红 3
  'red-4': 'https://img.pagehost.cn/autoupload/amqnh/20261004/js6m/773X1177/uno_%2824%29.png/webp', // 红 4
  'red-5': 'https://img.pagehost.cn/autoupload/amqnh/20261004/igw2/669X1021/uno_%2825%29.png/webp', // 红 5
  'red-6': 'https://img.pagehost.cn/autoupload/amqnh/20261004/M28u/703X1159/uno_%2826%29.png/webp', // 红 6
  'red-7': 'https://img.pagehost.cn/autoupload/amqnh/20261004/gfrN/1392X2080/un_%287%29.jpg/webp', // 红 7
  'red-8': 'https://img.pagehost.cn/autoupload/amqnh/20261004/bfdP/1418X2119/un_%2813%29.jpg/webp', // 红 8
  'red-9': 'https://img.pagehost.cn/autoupload/amqnh/20261004/wLDB/727X1195/uno_%2829%29.png/webp', // 红 9
  'red-skip': 'https://img.pagehost.cn/autoupload/amqnh/20261004/01Xz/771X1205/uno_%2848%29.png/webp', // 红 Skip
  'red-reverse': 'https://img.pagehost.cn/autoupload/amqnh/20261004/cXPG/1481X2067/un_%283%29.jpg/webp', // 红 Reverse
  'red-draw2': 'https://img.pagehost.cn/autoupload/amqnh/20261004/IcaF/1390X2161/un_%282%29.jpg/webp', // 红 Draw Two

  // ---- 白 ----
  'white-0': 'https://img.pagehost.cn/autoupload/amqnh/20261004/psky/1174X1987/0_%281%29.jpg/webp', // 白 0
  'white-1': 'https://img.pagehost.cn/autoupload/amqnh/20261004/QrVd/872X1209/uno_%2812%29.png/webp', // 白 1
  'white-2': 'https://img.pagehost.cn/autoupload/amqnh/20261004/yB35/927X1203/uno_%2813%29.png/webp', // 白 2
  'white-3': 'https://img.pagehost.cn/autoupload/amqnh/20261004/JAix/975X1166/uno_%2814%29.png/webp', // 白 3
  'white-4': 'https://img.pagehost.cn/autoupload/amqnh/20261004/Iid0/876X1089/uno_%2815%29.png/webp', // 白 4
  'white-5': 'https://img.pagehost.cn/autoupload/amqnh/20261004/ioW9/767X1086/uno_%2816%29.png/webp', // 白 5
  'white-6': 'https://img.pagehost.cn/autoupload/amqnh/20261004/cyG6/837X1122/uno_%2817%29.png/webp', // 白 6
  'white-7': 'https://img.pagehost.cn/autoupload/amqnh/20261004/ison/822X1083/uno_%2818%29.png/webp', // 白 7
  'white-8': 'https://img.pagehost.cn/autoupload/amqnh/20261004/YmK4/924X1173/uno_%2819%29.png/webp', // 白 8
  'white-9': 'https://img.pagehost.cn/autoupload/amqnh/20261004/4zeV/845X1088/uno_%2820%29.png/webp', // 白 9
  'white-skip': 'https://img.pagehost.cn/autoupload/amqnh/20261004/g9dO/874X1253/uno_%2839%29.png/webp', // 白 Skip
  'white-reverse': 'https://img.pagehost.cn/autoupload/amqnh/20261004/NkRn/841X1203/uno_%2840%29.png/webp', // 白 Reverse
  'white-draw2': 'https://img.pagehost.cn/autoupload/amqnh/20261004/9bFq/827X1265/uno_%2841%29.png/webp', // 白 Draw Two

  // ---- 深蓝 ----
  'darkblue-0': 'https://img.pagehost.cn/autoupload/amqnh/20261004/iPnO/1196X2023/0_%283%29.jpg/webp', // 深蓝 0
  'darkblue-1': 'https://img.pagehost.cn/autoupload/amqnh/20261004/3Rv0/1330X2126/un_%2812%29.jpg/webp', // 深蓝 1
  'darkblue-2': 'https://img.pagehost.cn/autoupload/amqnh/20261004/lyob/1317X2118/default_%281%29.jpg/webp', // 深蓝 2
  'darkblue-3': 'https://img.pagehost.cn/autoupload/amqnh/20261004/vBmf/1324X2144/default_%282%29.jpg/webp', // 深蓝 3
  'darkblue-4': 'https://img.pagehost.cn/autoupload/amqnh/20261004/Hfd8/1314X2108/default_%283%29.jpg/webp', // 深蓝 4
  'darkblue-5': 'https://img.pagehost.cn/autoupload/amqnh/20261004/CvTi/1464X2297/uno_%287%29.png/webp', // 深蓝 5
  'darkblue-6': 'https://img.pagehost.cn/autoupload/amqnh/20261004/bPR8/1942X2177/uno_%288%29.png/webp', // 深蓝 6
  'darkblue-7': 'https://img.pagehost.cn/autoupload/amqnh/20261004/OgzJ/1492X2273/uno_%289%29.png/webp', // 深蓝 7
  'darkblue-8': 'https://img.pagehost.cn/autoupload/amqnh/20261004/ekCg/1318X2082/un_%286%29.jpg/webp', // 深蓝 8
  'darkblue-9': 'https://img.pagehost.cn/autoupload/amqnh/20261004/6iSX/1719X2309/uno_%2811%29.png/webp', // 深蓝 9
  'darkblue-skip': 'https://img.pagehost.cn/autoupload/amqnh/20261004/03OL/798X1259/uno_%2842%29.png/webp', // 深蓝 Skip
  'darkblue-reverse': 'https://img.pagehost.cn/autoupload/amqnh/20261004/LUc3/757X1191/uno_%2843%29.png/webp', // 深蓝 Reverse
  'darkblue-draw2': 'https://img.pagehost.cn/autoupload/amqnh/20261004/eOxn/985X1250/uno_%2844%29.png/webp', // 深蓝 Draw Two
};

export const cardImageKey = (card) => {
  if (!card) return 'back';
  if (!card.color) return card.value; // wild / wild4
  return `${card.color}-${card.value}`;
};

// 返回链接字符串；没有填就返回 null。
export const getCardImageUrl = (card, back = false) => {
  const key = back ? 'back' : cardImageKey(card);
  const url = UNO_CARD_IMAGES[key];
  return typeof url === 'string' && url.trim() ? url.trim() : null;
};
