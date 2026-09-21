// src/apps/messages/order/orderRequestService.js
//
// 点单请求的校验、消息字段生成，以及"点单入口显示成什么状态"的判断。

import db from '../../../db';
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

// 点单入口的三种状态
export const ORDER_ENTRY_STATES = {
  // 从来没同步过点单类工具：不显示
  HIDDEN: 'hidden',
  // 点单工具已启用且连接已接通：可以使用
  READY: 'ready',
  // 同步过点单类工具，但现在还不能用：显示成灰色，点击时说明原因
  NEEDS_SETUP: 'needs-setup',
};

// 提示条只能显示一行，超出会被截断成省略号，所以文案要短：
// 标题说原因，正文说该做什么。
const SETUP_HINTS = {
  'tool-disabled': {
    title: '点单工具还没有启用',
    message: '请在 MCP 设置里开启点单工具',
  },
  'connection-unavailable': {
    title: 'MCP 连接还没有接通',
    message: '请在 MCP 设置里重新测试连接',
  },
};

const clean = (value, maxLength) => {
  return String(value ?? '').trim().slice(0, maxLength);
};

const isOrderToolName = (toolName) => {
  return /order/i.test(String(toolName || ''));
};

/**
 * 判断"帮我点单"入口该显示成什么状态。
 *
 * 判断依据：已同步下来的工具里，名字带 order 的（create-order、createOrder 等）。
 * "可用"的标准和 getEnabledMcpTools 保持一致：
 * 连接已启用且状态为 connected，工具已启用且服务端仍提供。
 * 这里直接读数据库，不调用 getEnabledMcpTools，避免每次打开菜单都往控制台打印一大串日志。
 *
 * @returns {Promise<{ state: string, reason?: string, title?: string, message?: string }>}
 */
export const getOrderEntryState = async () => {
  try {
    const allTools = await db.mcpTools.toArray();

    // 服务端已经不再提供的工具不算数
    const orderTools = allTools.filter(
      (tool) => isOrderToolName(tool.toolName) && tool.isAvailable !== false,
    );

    if (orderTools.length === 0) {
      return { state: ORDER_ENTRY_STATES.HIDDEN };
    }

    const connectionIds = [...new Set(orderTools.map((tool) => tool.connectionId))];
    const connections = await db.mcpConnections.bulkGet(connectionIds);
    const connectionById = new Map(
      connections.filter(Boolean).map((connection) => [connection.id, connection]),
    );

    const isConnectionUsable = (connection) => {
      return (
        Boolean(connection) &&
        connection.enabled === true &&
        connection.status === 'connected'
      );
    };

    const hasReadyTool = orderTools.some(
      (tool) =>
        tool.enabled === true &&
        isConnectionUsable(connectionById.get(tool.connectionId)),
    );

    if (hasReadyTool) {
      return { state: ORDER_ENTRY_STATES.READY };
    }

    // 不可用时区分原因：连接是好的但工具没开，还是连接本身有问题
    const hasUsableConnection = orderTools.some((tool) =>
      isConnectionUsable(connectionById.get(tool.connectionId)),
    );

    const reason = hasUsableConnection ? 'tool-disabled' : 'connection-unavailable';

    return {
      state: ORDER_ENTRY_STATES.NEEDS_SETUP,
      reason,
      title: SETUP_HINTS[reason].title,
      message: SETUP_HINTS[reason].message,
    };
  } catch (error) {
    console.warn('[Order] 无法判断点单入口状态：', error);
    return { state: ORDER_ENTRY_STATES.HIDDEN };
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
  ORDER_ENTRY_STATES,
  getOrderEntryState,
  buildOrderRequestFields,
};