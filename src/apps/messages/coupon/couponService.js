// 和好券：数据读写。
//
// 2026-10 改版：两个方向统一存成真正的聊天消息（db.messages，type: 'coupon'），
// 不再区分"表里的券"和"消息里的券"两套来源——用户发出的券之前只写进一张
// 看不见的 coupons 表，聊天记录里完全找不到，这正是这一轮要改掉的问题。
// 现在用户发券也会变成一条 sender:'user' 的真消息，直接出现在聊天记录里
// （写入逻辑在 ChatRoom.jsx 的 handleSendCoupon，跟发表情包/点单请求是
// 同一套写法）。
//
// 方向用消息自己的 sender 字段区分：
// - sender === 'user'：用户发给角色的券。角色是持有方。角色自己知道自己
//   手上有几张（countPendingUserCoupons，喂进系统提示词），但由谁、怎么
//   触发"兑现"是下一轮要做的事，这一版不碰。
// - sender === 'character'：角色发给用户的券（角色在线回复里自己带
//   [COUPON: 标题 | 内容] 标签生成，解析逻辑在 aiService.js，没有变）。
//   用户是持有方，兑现入口在聊天气泡本身（CouponCard.jsx）。
//
// 券夹（CouponWalletPanel 的"券夹"标签页）这一轮跟用户确认过：只展示角色
// 发给用户的券——用户自己发的券已经是聊天记录的一部分，不需要在券夹里
// 重复列一遍。
//
// 旧版 coupons 表（上一版用来存用户发出的券）这一版不再写入，也不再在券夹
// 里读取展示；表本身不删，数据库结构没有变化，符合这个项目"能不动 schema
// 就不动"的一贯原则。

import db from '../../../db';
import { COUPON_AUTO_CLEAN_DAYS } from './couponTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeMessageCoupon = (message) => ({
  source: 'message',
  id: message.id,
  chatId: message.chatId,
  fromRole: message.sender === 'user' ? 'user' : 'character',
  title: message.metadata?.title || '和好券',
  note: message.metadata?.note || '',
  status: message.metadata?.status || 'pending',
  createdAt: message.timestamp,
  redeemedAt: message.metadata?.redeemedAt || null,
});

// 已兑现超过 10 天的券，不再计入券夹列表/统计——聊天消息本身不会被删除，
// 这只影响券夹这个"展示层"，不碰真实聊天记录。
const isStaleRedeemed = (item) => {
  if (item.status !== 'redeemed' || !item.redeemedAt) return false;
  return Date.now() - new Date(item.redeemedAt).getTime() > COUPON_AUTO_CLEAN_DAYS * DAY_MS;
};

// 券夹列表：只取角色发给用户的券。
export const listCouponsForChat = async (chatId) => {
  if (!chatId) return [];

  const messageRows = await db.messages
    .where('chatId')
    .equals(chatId)
    .filter((message) => message.type === 'coupon' && message.sender === 'character')
    .toArray();

  const list = messageRows
    .map(normalizeMessageCoupon)
    .filter((item) => !isStaleRedeemed(item));

  list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return list;
};

// 角色手里攥着几张用户给的、还没兑现的券——喂给系统提示词用，让角色"知道"
// 自己手上有多少张可以兑现。具体什么时候、怎么兑现是下一轮要做的事，这里
// 只负责数量感知。
export const countPendingUserCoupons = async (chatId) => {
  if (!chatId) return 0;

  const rows = await db.messages
    .where('chatId')
    .equals(chatId)
    .filter((message) =>
      message.type === 'coupon' &&
      message.sender === 'user' &&
      (message.metadata?.status || 'pending') === 'pending'
    )
    .toArray();

  return rows.length;
};

// 兑现一张券（目前只有角色发给用户的券能走这条路径——用户自己发的券，
// 兑现发起权在角色那边，这一版的 UI 本来就不会给用户发的券显示兑现按钮）。
export const redeemCoupon = async (item) => {
  if (!item || item.source !== 'message') return;

  const message = await db.messages.get(item.id);
  if (!message) return;

  await db.messages.update(item.id, {
    metadata: {
      ...(message.metadata || {}),
      status: 'redeemed',
      redeemedAt: new Date().toISOString(),
    },
  });
};