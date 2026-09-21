// src/apps/messages/order/orderRequestPrompt.js
//
// 把一条"点单请求"消息，转成角色在对话历史里读到的文字。
// 这是一个纯函数文件，不依赖数据库或 MCP，方便 aiService 直接引用。
//
// 两种形态：
// - 未处理（角色还没回复过这条请求）：带完整的处理要求，让角色去办理；
// - 已处理（这条请求之后角色已经回复过）：只保留信息本身，
//   不再带"请办理"的要求，避免角色在之后的对话里重复下单。

import { getBrandById, getFulfillmentLabel } from './orderBrands';

const isPickupLike = (fulfillment) => {
  return fulfillment === 'pickup' || fulfillment === 'drive_through';
};

const buildInfoLines = (metadata = {}) => {
  const brandName = metadata.brandName || getBrandById(metadata.brandId)?.name || '未指定品牌';
  const fulfillmentLabel = getFulfillmentLabel(metadata.fulfillment) || '未指定';

  const lines = [`品牌：${brandName}`, `取餐方式：${fulfillmentLabel}`];

  if (metadata.fulfillment === 'delivery' && metadata.deliveryInfo) {
    lines.push(`收货信息：${metadata.deliveryInfo}`);
  }

  if (isPickupLike(metadata.fulfillment) && metadata.pickupPlace) {
    lines.push(`取餐地点（城市与地点关键词）：${metadata.pickupPlace}`);
  }

  if (metadata.mode === 'full') {
    lines.push(`想要的东西：\n${metadata.items || '（未填写）'}`);
  } else {
    lines.push('想要的东西：用户还没选好，希望先看菜单');
  }

  if (metadata.note) {
    lines.push(`备注：${metadata.note}`);
  }

  return lines;
};

const buildRequirements = (metadata = {}) => {
  const requirements = [];

  requirements.push(
    '收货或取餐信息已经在上面，不要向用户重复询问；查不到对应的门店或地址时，再向用户说明。',
  );

  if (metadata.fulfillment === 'delivery') {
    requirements.push(
      '如果外送需要先在用户账号里建立配送地址，请用上面的收货信息创建。',
    );
  }

  if (metadata.mode === 'full') {
    requirements.push(
      '用户已经选好了想要的东西：请查询门店和商品、试算价格，然后创建订单；如果商品对不上或缺货，先向用户说明并给出替代，再继续。',
    );
  } else {
    requirements.push(
      '用户还没选好：请查询门店和菜单，把适合的选择整理后发给用户（可以结合备注里的偏好推荐），然后等用户明确选定；在用户选定之前，不要创建订单。',
    );
    requirements.push(
      '用户选定后，再试算价格并创建订单。',
    );
  }

  requirements.push(
    '订单创建后，把订单内容、金额和付款方式告诉用户，由用户自己完成付款。',
  );

  requirements.push(
    '这次只做点餐相关的操作，不要使用积分兑换、领券等无关的工具。',
  );

  requirements.push('同一份请求只办理一次，不要重复下单。');

  return requirements.map((text, index) => `${index + 1}. ${text}`);
};

/**
 * @param {object} msg 消息对象（type 为 order_request）
 * @param {object} options
 * @param {boolean} options.handled 这条请求之后角色是否已经回复过
 */
export const describeOrderRequestForPrompt = (msg, { handled = false } = {}) => {
  const metadata = msg?.metadata || {};
  const infoLines = buildInfoLines(metadata);

  if (handled) {
    return `[用户之前发来过一份点单请求，已经处理过，仅供参考]\n${infoLines.join('\n')}`;
  }

  return [
    '[用户发来一份点单请求，需要你通过外接点餐工具办理]',
    ...infoLines,
    '处理要求：',
    ...buildRequirements(metadata),
  ].join('\n');
};

export default {
  describeOrderRequestForPrompt,
};