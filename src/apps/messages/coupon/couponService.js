// 和好券：数据读写。
//
// 两个方向分别存在两个地方，查看时合并成一个列表：
// - 用户发给角色的券：存在新建的 coupons 表里（这是用户在券夹面板里
//   主动创建的，不是聊天消息，不需要在聊天记录里留痕）。
// - 角色主动发给用户的券：角色在在线回复里自己决定带上
//   [COUPON: 标题 | 内容] 标签（跟戳一戳一样的"AI 自己判断时机"的
//   写法，不另开后台定时器），aiService.js 现有的标签解析器已经把它
//   解析成一条普通的 chatId 下的 messages 记录（type: 'coupon'）——
//   这条消息本身就是这张券的唯一数据来源，不再额外写一份进 coupons
//   表。兑现状态直接存在这条消息自己的 metadata 里。
//
// 10 天自动清理（COUPON_AUTO_CLEAN_DAYS）只物理删除 coupons 表里已兑现
// 的行；角色发的券是聊天消息，不会被删除——只是超过这个天数后不再算进
// 券夹的"未兑现/已兑现"统计里，这是跟"不能删除真实聊天记录"这个项目
// 一贯原则做的取舍，没有单独跟用户确认这一点，做完之后需要跟用户说明。

import db from '../../../db';
import { COUPON_AUTO_CLEAN_DAYS } from './couponTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeTableCoupon = (row) => ({
  source: 'table',
  id: row.id,
  chatId: row.chatId,
  fromRole: 'user',
  title: row.title || '自定义券',
  note: row.note || '',
  status: row.status || 'pending',
  createdAt: row.createdAt,
  redeemedAt: row.redeemedAt || null,
});

const normalizeMessageCoupon = (message) => ({
  source: 'message',
  id: message.id,
  chatId: message.chatId,
  fromRole: 'character',
  title: message.metadata?.title || '和好券',
  note: message.metadata?.note || '',
  status: message.metadata?.status || 'pending',
  createdAt: message.timestamp,
  redeemedAt: message.metadata?.redeemedAt || null,
});

const isStaleRedeemed = (item) => {
  if (item.status !== 'redeemed' || !item.redeemedAt) return false;
  return Date.now() - new Date(item.redeemedAt).getTime() > COUPON_AUTO_CLEAN_DAYS * DAY_MS;
};

// 创建一张用户发出的券（混合模式：模板名 + 自由文本，两者都允许为空
// 其一，但不能都为空）。
export const createCoupon = async ({ chatId, title, note }) => {
  if (!chatId) return null;

  const cleanTitle = (title || '自定义券').trim();
  const cleanNote = (note || '').trim();

  const id = await db.coupons.add({
    chatId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    title: cleanTitle,
    note: cleanNote,
    redeemedAt: null,
  });

  return id;
};

// 列出某个聊天窗口下，双方所有的券（已过期清理的已兑现项不返回）。
export const listCouponsForChat = async (chatId) => {
  if (!chatId) return [];

  const [tableRows, messageRows] = await Promise.all([
    db.coupons.where('chatId').equals(chatId).toArray(),
    db.messages
      .where('chatId')
      .equals(chatId)
      .filter((message) => message.type === 'coupon')
      .toArray(),
  ]);

  const merged = [
    ...tableRows.map(normalizeTableCoupon),
    ...messageRows.map(normalizeMessageCoupon),
  ].filter((item) => !isStaleRedeemed(item));

  merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return merged;
};

// 兑现一张券（两种来源分别更新各自的存储位置）。
export const redeemCoupon = async (item) => {
  if (!item) return;

  const redeemedAt = new Date().toISOString();

  if (item.source === 'table') {
    await db.coupons.update(item.id, { status: 'redeemed', redeemedAt });
    return;
  }

  if (item.source === 'message') {
    const message = await db.messages.get(item.id);
    if (!message) return;

    await db.messages.update(item.id, {
      metadata: {
        ...(message.metadata || {}),
        status: 'redeemed',
        redeemedAt,
      },
    });
  }
};

// 物理清理超过 10 天的已兑现用户券（只清理 coupons 表，不触碰聊天消息）。
export const cleanupExpiredCoupons = async (chatId) => {
  if (!chatId) return;

  const cutoff = Date.now() - COUPON_AUTO_CLEAN_DAYS * DAY_MS;

  const staleRows = await db.coupons
    .where('chatId')
    .equals(chatId)
    .filter((row) => row.status === 'redeemed' && row.redeemedAt && new Date(row.redeemedAt).getTime() < cutoff)
    .toArray();

  if (staleRows.length === 0) return;

  await db.coupons.bulkDelete(staleRows.map((row) => row.id));
};