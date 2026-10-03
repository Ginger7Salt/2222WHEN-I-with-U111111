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
//   手上有几张（countPendingUserCoupons，喂进系统提示词）；角色决定
//   兑现时，在回复里带 [COUPON_REDEEM: 标题 | 内容] 标签，检测逻辑在
//   containsCouponRedeemRequest/extractCouponRedeemTitle，实际改状态
//   在 redeemPendingUserCoupon，调用方是 aiService.js（跟 DIY小屋的
//   换装标签同一套模式——静默标签，不产出卡片，只触发副作用）。
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

// 兑现一张券（用户按按钮触发——目前只有角色发给用户的券能走这条路径，
// 用户自己发的券，兑现发起权在角色那边，这一版的 UI 本来就不会给用户
// 发的券显示兑现按钮）。
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

// 角色自己决定兑现一张用户送的券（[COUPON_REDEEM] 标签触发）。
// 按标题匹配这个聊天里最早的一张还没兑现的用户送出的券；AI 复述的标题
// 可能跟原文不完全一致（大小写/首尾空格/轻微转述），所以：
// 1. 先尝试精确匹配（忽略大小写和首尾空格）；
// 2. 找不到就退回"最早那张还没兑现的"，避免因为用词对不上而静默失败——
//    角色说了"我要兑现这张券"，体验上应该真的兑现一张,而不是什么都不做。
// 找到就把消息 metadata 标成 redeemed 并返回这条消息（调用方用它来确认
// 兑现成功、取标题等）；一张都没有就返回 null。
export const redeemPendingUserCoupon = async ({ chatId, title }) => {
  if (!chatId) return null;

  const pendingRows = await db.messages
    .where('chatId')
    .equals(chatId)
    .filter((message) =>
      message.type === 'coupon' &&
      message.sender === 'user' &&
      (message.metadata?.status || 'pending') === 'pending'
    )
    .toArray();

  if (pendingRows.length === 0) return null;

  pendingRows.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const cleanTitle = String(title || '').trim().toLowerCase();

  const target =
    (cleanTitle &&
      pendingRows.find(
        (message) =>
          String(message.metadata?.title || '').trim().toLowerCase() === cleanTitle
      )) ||
    pendingRows[0];

  await db.messages.update(target.id, {
    metadata: {
      ...(target.metadata || {}),
      status: 'redeemed',
      redeemedAt: new Date().toISOString(),
      redeemedBy: 'character',
    },
  });

  return { ...target, metadata: { ...(target.metadata || {}), status: 'redeemed' } };
};
// aiService.js 解析 AI 原始回复文字时用这个判断：这次回复里有没有带
// 角色决定兑现用户送的券时该带的那个静默信号标签。跟 DIY小屋的
// containsDiyAreaRequest 同一个用法——标签不产出可见卡片，解析结果里
// 找不到它，只能直接查原始文字。
export const containsCouponRedeemRequest = (text) => (
  /\[COUPON_REDEEM\s*:/i.test(String(text || ''))
);

// 从原始回复文字里把 [COUPON_REDEEM: 标题 | 内容] 的标题部分摘出来，
// 给 redeemPendingUserCoupon 用来匹配具体是哪一张券。一次回复理论上
// 只会兑现一张，所以只取第一个匹配；内容(第二段)目前不需要额外用——
// 角色会在标签之外的正文里自己说明"打算怎么兑现"，不需要再单独存一份。
export const extractCouponRedeemTitle = (text) => {
  const match = /\[COUPON_REDEEM\s*:\s*([^\]|]+)/i.exec(String(text || ''));
  return match ? match[1].trim() : '';
};