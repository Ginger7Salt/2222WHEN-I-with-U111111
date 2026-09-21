// src/apps/messages/order/orderRequestService.js
//
// 点单请求的校验、消息字段生成，以及"要不要显示点单入口"的判断。

import { getEnabledMcpTools } from '../../../services/mcp/mcpConnectionService';
import { getBrandById, getFulfillmentLabel } from './orderBrands';

export const ORDER_MODES = {
  // 用户自己选好了想要的东西
  FULL: 'full',
  // 用户只给品牌、地址、取餐方式，让角色去查菜单带回来
  MENU: 'menu',
};

export const ORDER_REQUEST_LIMITS = {
  deliveryInfo: 300,
  pickupPlace: 100,
  items: 500,
  note: 200,
};

const clean = (value, maxLength) => {
  return String(value ?? '').trim().slice(0, maxLength);
};

/**
 * 是否存在"能点单"的已启用 MCP 工具。
 * 只有存在时，聊天窗里才显示点单入口，
 * 没有配置 MCP 的用户看不到这个按钮。
 *
 * 判断依据：已启用工具的名字里带 order（create-order、createOrder 等）。
 */
export const hasOrderCapableMcpTools = async () => {
  try {
    const tools = await getEnabledMcpTools();

    return tools.some((tool) => /order/i.test(String(tool?.toolName || '')));
  } catch (error) {
    console.warn('[Order] 无法判断点单工具是否可用：', error);
    return false;
  }
};

/**
 * 校验用户在窗口里填写的内容，并生成要写入 db.messages 的字段。
 *
 * @returns {{ ok: true, content: string, metadata: object } | { ok: false, message: string }}
 */
export const buildOrderRequestFields = (input = {}) => {
  const brand = getBrandById(input.brandId);

  if (!brand) {
    return { ok: false, message: '请先选择品牌。' };
  }

  if (!brand.fulfillments.includes(input.fulfillment)) {
    return { ok: false, message: '请选择取餐方式。' };
  }

  const mode = input.mode === ORDER_MODES.FULL ? ORDER_MODES.FULL : ORDER_MODES.MENU;

  const metadata = {
    brandId: brand.id,
    brandName: brand.name,
    mode,
    fulfillment: input.fulfillment,
    note: clean(input.note, ORDER_REQUEST_LIMITS.note),
  };

  if (input.fulfillment === 'delivery') {
    metadata.deliveryInfo = clean(input.deliveryInfo, ORDER_REQUEST_LIMITS.deliveryInfo);

    if (!metadata.deliveryInfo) {
      return { ok: false, message: '请填写收货信息。' };
    }
  } else {
    metadata.pickupPlace = clean(input.pickupPlace, ORDER_REQUEST_LIMITS.pickupPlace);

    if (!metadata.pickupPlace) {
      return { ok: false, message: '请填写取餐地点。' };
    }
  }

  if (mode === ORDER_MODES.FULL) {
    metadata.items = clean(input.items, ORDER_REQUEST_LIMITS.items);

    if (!metadata.items) {
      return { ok: false, message: '请填写想要的东西。' };
    }
  }

  // content 会出现在聊天列表预览等只读 content 的地方，所以写成一句简短的概括。
  const content = [
    brand.name,
    getFulfillmentLabel(input.fulfillment),
    mode === ORDER_MODES.MENU ? '先看菜单' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return { ok: true, content, metadata };
};

export default {
  ORDER_MODES,
  ORDER_REQUEST_LIMITS,
  hasOrderCapableMcpTools,
  buildOrderRequestFields,
};