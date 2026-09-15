// src/services/mcp/mcpOrderCardService.js

const listeners = new Set();

const nowIso = () => new Date().toISOString();

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `mcp_card_${crypto.randomUUID()}`;
  }
  return `mcp_card_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

/**
 * 麦当劳官方 MCP 工具结果解析器
 * 适配官方工具：create-order, query-order, query-nearby-stores
 */
const parseMcdonaldResult = (toolName, toolResult) => {
  if (!toolResult) return null;

  const parseRaw = (value) => {
    if (!value) return null;

    if (typeof value === 'string') {
      try {
        const cleaned = value
          .replace(/^```json\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        return JSON.parse(cleaned);
      } catch {
        return null;
      }
    }

    return value;
  };

  const raw = parseRaw(
    toolResult?.structuredContent ||
    toolResult?.data ||
    toolResult
  );

  if (!raw) return null;

  const data =
    raw.data &&
    (
      raw.success !== undefined ||
      raw.code !== undefined ||
      raw.message !== undefined
    )
      ? raw.data
      : raw;

  if (!data) return null;

  const tName = String(toolName || '').toLowerCase();

  const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const parseItems = (list) => {
    if (!Array.isArray(list)) return [];

    return list.map((item) => ({
      name: item.name || item.productName || item.itemName || '餐品',
      qty: toNumber(item.qty ?? item.quantity, 1),
      price: toNumber(item.price, 0),
      comboItems: Array.isArray(item.comboItemList)
        ? item.comboItemList.map((combo) => ({
            name:
              combo.itemName ||
              combo.productName ||
              combo.name ||
              '套餐内容',
            qty: toNumber(
              combo.itemQuantity ??
              combo.quantity ??
              combo.qty,
              1
            ),
          }))
        : [],
    }));
  };

  const parseOrderDetail = () => {
    if (data.orderDetail && typeof data.orderDetail === 'object') {
      return data.orderDetail;
    }

    return data;
  };

  const getOrderItems = (detail) => {
    return parseItems(
      detail.orderProductList ||
      detail.items ||
      data.orderProductList ||
      data.items
    );
  };

  const getOrderNo = (detail) => {
    return (
      data.orderId ||
      detail.orderId ||
      data.orderNo ||
      detail.orderNo ||
      data.order_id ||
      ''
    );
  };

  const getStoreName = (detail) => {
    return (
      detail.storeName ||
      data.storeName ||
      detail.store ||
      data.store ||
      '麦当劳餐厅'
    );
  };

  const getPickupCode = (detail) => {
    return (
      detail.pickupCode ||
      detail.lockerCode ||
      detail.takeCode ||
      detail.pickupNo ||
      data.pickupCode ||
      data.takeCode ||
      data.pickupNo ||
      null
    );
  };

  const getTotal = (detail) => {
    return toNumber(
      detail.realTotalAmount ??
      detail.totalAmount ??
      detail.total ??
      data.realTotalAmount ??
      data.totalAmount ??
      data.totalPrice ??
      data.total ??
      data.amount ??
      0
    );
  };

  const parsePhase = (status, pickupCode = '', takeWay = '') => {
    const value = String(status || '').trim().toUpperCase();

    if (
      value.includes('取消') ||
      value.includes('CANCEL')
    ) {
      return 'cancelled';
    }

    if (
      value.includes('完成') ||
      value.includes('已取') ||
      value.includes('FINISH') ||
      value.includes('COMPLETE')
    ) {
      return 'completed';
    }

    if (
      value.includes('待取') ||
      value.includes('取餐') ||
      value.includes('READY') ||
      value.includes('PICKUP') ||
      value.includes('WAIT_PICK') ||
      pickupCode
    ) {
      return 'ready';
    }

    if (
      value.includes('制作') ||
      value.includes('配送') ||
      value.includes('进行') ||
      value.includes('COOK') ||
      value.includes('DELIVER')
    ) {
      return 'cooking';
    }

    if (
      value.includes('待支付') ||
      value.includes('支付') ||
      value.includes('下单') ||
      value.includes('PAY')
    ) {
      return 'created';
    }

    return takeWay ? 'cooking' : 'created';
  };

  // 1. 附近餐厅 / 选择餐厅
  if (
    tName.includes('store') ||
    tName.includes('query-nearby-stores') ||
    tName.includes('query_nearby_stores')
  ) {
    const stores = Array.isArray(data)
      ? data
      : Array.isArray(data.stores)
        ? data.stores
        : Array.isArray(data.data)
          ? data.data
          : [];

    if (stores.length === 0) return null;

    return {
      kind: 'mcd-store',
      phase: 'store_select',
      stores: stores.slice(0, 5).map((store) => ({
        name: store.storeName || store.name || '麦当劳餐厅',
        address: store.address || store.fullAddress || '',
        businessHours:
          store.businessStartTime && store.businessEndTime
            ? `${store.businessStartTime}-${store.businessEndTime}`
            : '营业中',
        distance: store.distance
          ? `${store.distance}${String(store.distance).includes('m') ? '' : 'm'}`
          : '',
        status: store.businessStatus === false ? '休息中' : '营业中',
        storeCode: store.storeCode || '',
        beCode: store.beCode || '',
      })),
    };
  }

  // 2. 创建订单
  if (
    tName.includes('create-order') ||
    tName.includes('create_order') ||
    (
      tName.includes('create') &&
      tName.includes('order')
    )
  ) {
    const detail = parseOrderDetail();
    const pickupCode = getPickupCode(detail);

    return {
      kind: 'mcd-order',
      phase: parsePhase(
        detail.orderStatus ||
        data.orderStatus ||
        '待支付',
        pickupCode,
        detail.takeWay || data.takeWay
      ),
      orderNo: getOrderNo(detail),
      store: getStoreName(detail),
      storeAddress:
        detail.storeAddress ||
        data.storeAddress ||
        '',
      total: getTotal(detail),
      items: getOrderItems(detail),
      pickupCode,
      pickupType:
        detail.takeWay ||
        data.takeWay ||
        '',
      payUrl:
        data.payH5Url ||
        data.payUrl ||
        data.paymentUrl ||
        detail.payH5Url ||
        detail.payUrl ||
        null,
      orderStatus:
        detail.orderStatus ||
        data.orderStatus ||
        '待支付',
    };
  }

  // 3. 查询订单进度
  if (
    tName.includes('query-order') ||
    tName.includes('query_order') ||
    (
      tName.includes('query') &&
      tName.includes('order')
    )
  ) {
    const detail = parseOrderDetail();
    const pickupCode = getPickupCode(detail);

    return {
      kind: 'mcd-order',
      phase: parsePhase(
        detail.orderStatus ||
        detail.status ||
        data.orderStatus ||
        data.status,
        pickupCode,
        detail.takeWay || data.takeWay
      ),
      orderNo: getOrderNo(detail),
      store: getStoreName(detail),
      storeAddress:
        detail.storeAddress ||
        data.storeAddress ||
        '',
      pickupCode: pickupCode || '—',
      pickupMinutes:
        toNumber(
          detail.estimatedMinutes ??
          detail.pickupMinutes ??
          detail.eta ??
          data.estimatedMinutes ??
          data.pickupMinutes ??
          data.eta
        ) || null,
      total: getTotal(detail),
      items: getOrderItems(detail),
      orderStatus:
        detail.orderStatus ||
        detail.status ||
        data.orderStatus ||
        data.status ||
        '',
      deliveryInfo:
        detail.deliveryInfo ||
        data.deliveryInfo ||
        null,
    };
  }

  return null;
};


// 白名单匹配规则：未来扩展星巴克、瑞幸等只需在此添加规则
const CARD_MATCHERS = [
  {
    test: (toolName = '') => /mcd|mcdonald|麦当劳/i.test(toolName) || /(create-order|query-order|query-nearby-stores)/i.test(toolName),
    parse: parseMcdonaldResult,
  },
];

const notify = (event) => {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (e) {
      console.warn('[MCP Card] 事件派发异常:', e);
    }
  });
};

const cloneSession = (session) => {
  if (!session) return null;
  return {
    version: 1,
    used: session.cards.length > 0,
    cards: session.cards.map((c) => ({ ...c })),
  };
};

export const createOrderCardSession = ({ chatId = null, characterId = null } = {}) => ({
  id: createId(),
  chatId: chatId != null ? String(chatId) : null,
  characterId: characterId != null ? String(characterId) : null,
  cards: [],
  createdAt: nowIso(),
});

export const startOrderCard = ({ session, tool }) => {
  if (!session || !tool) return null;

  const toolName = tool.toolName || '';
  const matcher = CARD_MATCHERS.find((m) => m.test(toolName));
  if (!matcher) return null;

  const card = {
    id: createId(),
    toolName,
    status: 'pending',
    result: null,
    error: null,
    startedAt: nowIso(),
  };

  session.cards.push(card);

  notify({
    type: 'MCP_ORDER_CARD_UPDATED',
    chatId: session.chatId,
    characterId: session.characterId,
    orderCard: cloneSession(session),
  });

  return card.id;
};

export const finishOrderCard = ({ session, cardId, status, toolResult = null, errorMessage = '' }) => {
  if (!session || !cardId) return;

  const card = session.cards.find((c) => c.id === cardId);
  if (!card) return;

  card.completedAt = nowIso();

  if (status === 'success' && toolResult) {
    const matcher = CARD_MATCHERS.find((m) => m.test(card.toolName));
    const parsed = matcher ? matcher.parse(card.toolName, toolResult) : null;

    if (parsed) {
      card.status = 'success';
      card.result = parsed;
    } else {
      card.status = 'error';
      card.error = { message: '信息解析不完整' };
    }
  } else {
    card.status = 'error';
    card.error = { message: errorMessage || '操作未成功' };
  }

  notify({
    type: 'MCP_ORDER_CARD_UPDATED',
    chatId: session.chatId,
    characterId: session.characterId,
    orderCard: cloneSession(session),
  });
};

export const subscribeMcpOrderCardEvents = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getOrderCardSummary = (session) => {
  const summary = cloneSession(session);
  if (!summary || !summary.used) return null;
  return summary;
};
