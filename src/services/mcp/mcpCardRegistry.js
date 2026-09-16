// src/services/mcp/mcpCardRegistry.js
//
// MCP 富动作卡片解析中心
// 负责在工具执行完毕时，将真实返回提取为 UI 渲染用的结构化卡片数据

import { parseHealthMarkdown } from './healthCardParser';
import { parseWeatherCard } from './weatherCardParser';

import {
  parseNeteaseMusicCard,
  normalizeNeteaseToolName,
  NETEASE_TOOLS,
} from './neteaseMusicParser';
import { parseLuckinCard } from './luckinCardParser';




// 苹果日历专用解析器（适配 list_calendars / search_events / create_event / update_event / delete_event）
const parseAppleCalendarCard = (toolName, toolResult) => {
  const data = parseToolRawData(toolResult);
  if (!data) return null;

  // 1. 搜索与查询事件 (search_events)
  if (/search_events/i.test(toolName)) {
    const events = Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);
    return {
      kind: 'apple_calendar',
      action: 'search',
      total: Number(data.total ?? events.length),
      events: events.map((ev) => ({
        id: ev.id || String(Math.random()),
        title: ev.title || '无标题日程',
        startTime: ev.startTime || null,
        endTime: ev.endTime || null,
        location: ev.location || '',
        description: ev.description || '',
        timezone: ev.timezone || 'Asia/Shanghai',
        attendeesCount: Array.isArray(ev.attendees) ? ev.attendees.length : 0,
      })),
    };
  }

  // 2. 创建新日程 (create_event)
  if (/create_event/i.test(toolName)) {
    if (data.success === false) return null;
    return {
      kind: 'apple_calendar',
      action: 'create',
      eventId: data.eventId || null,
      message: data.message || '已成功添加到日历',
      event: {
        title: data.title || (data.message ? data.message.replace(/^Event\s*['"]?|['"]?\s*created successfully$/gi, '') : '新日程'),
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        location: data.location || '',
        description: data.description || '',
      },
    };
  }

  // 3. 更新日程 (update_event)
  if (/update_event/i.test(toolName)) {
    if (data.success === false) return null;
    return {
      kind: 'apple_calendar',
      action: 'update',
      eventId: data.eventId || null,
      message: data.message || '日程已更新',
      event: {
        title: data.title || '日程已修改',
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        location: data.location || '',
      },
    };
  }

  // 4. 删除日程 (delete_event)
  if (/delete_event/i.test(toolName)) {
    if (data.success === false) return null;
    return {
      kind: 'apple_calendar',
      action: 'delete',
      eventId: data.eventId || null,
      message: data.message || '日程已移除',
    };
  }

  // 5. 列出日历列表 (list_calendars)
  if (/list_calendars/i.test(toolName)) {
    const calendars = Array.isArray(data.calendars) ? data.calendars : (Array.isArray(data) ? data : []);
    return {
      kind: 'apple_calendar',
      action: 'list',
      calendars: calendars.map((c) => ({
        name: c.name || '日历',
        color: c.color || '#FF3B30',
        description: c.description || '',
        path: c.path || '',
      })),
    };
  }

  return null;
};
// 麦当劳专用解析器（对照 M-China/mcd-mcp-server 官方规范）
const parseMcdonaldsCard = (toolName, toolResult) => {
  const raw = parseToolRawData(toolResult);
  if (!raw || raw.success === false) return null;

  // MCP 返回可能是：
  // 1. { success, code, data: {...} }
  // 2. 直接返回 {...}
  // 3. structuredContent 中直接包含业务数据
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

  const name = String(toolName || '');

  const isStoreQuery =
    /(?:query[-_]?nearby[-_]?stores?|delivery[-_]?query[-_]?stores?)/i.test(name);

  const isCreateOrder = /create[-_]?order/i.test(name);

  const isQueryOrder = /query[-_]?order/i.test(name);

  const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  const parseItems = (list) => {
    if (!Array.isArray(list)) return [];

    return list.map((item) => ({
      name: item.productName || item.name || item.itemName || '餐品',
      qty: toNumber(item.quantity ?? item.qty, 1),
      price: toNumber(item.price, 0),
      comboItems: Array.isArray(item.comboItemList)
        ? item.comboItemList.map((combo) => ({
            name: combo.itemName || combo.productName || combo.name || '套餐内容',
            qty: toNumber(combo.itemQuantity ?? combo.quantity ?? combo.qty, 1),
          }))
        : [],
    }));
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
      value.includes('待支付') ||
      value.includes('支付') ||
      value.includes('下单') ||
      value.includes('PAY')
    ) {
      return 'order_created';
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

    return takeWay ? 'cooking' : 'order_created';
  };

  // 1. 查询附近门店
  if (isStoreQuery) {
    const stores = Array.isArray(data)
      ? data
      : Array.isArray(data.stores)
        ? data.stores
        : Array.isArray(data.data)
          ? data.data
          : [];

    if (stores.length === 0) return null;

    return {
      kind: 'mcd',
      phase: 'store_list',
      stores: stores.slice(0, 5).map((store) => ({
        name: store.storeName || store.name || '麦当劳餐厅',
        address: store.address || store.fullAddress || '',
        distance: store.distance
          ? `${store.distance}${String(store.distance).includes('m') ? '' : 'm'}`
          : '',
        status: store.businessStatus === false ? '休息中' : '营业中',
        businessHours:
          store.businessStartTime && store.businessEndTime
            ? `${store.businessStartTime}-${store.businessEndTime}`
            : '',
        storeCode: store.storeCode || '',
        beCode: store.beCode || '',
      })),
    };
  }

  // 2. 创建订单
  if (isCreateOrder) {
    const detail = data.orderDetail || data;

    const orderNo =
      data.orderId ||
      detail.orderId ||
      detail.orderNo ||
      data.orderNo ||
      '';

    const pickupCode =
      detail.pickupCode ||
      detail.lockerCode ||
      detail.takeCode ||
      '';

    return {
      kind: 'mcd',
      phase: parsePhase(
        detail.orderStatus || data.orderStatus || '待支付',
        pickupCode,
        detail.takeWay
      ),
      orderNo,
      storeName:
        detail.storeName ||
        data.storeName ||
        data.store ||
        '麦当劳餐厅',
      storeAddress:
        detail.storeAddress ||
        data.storeAddress ||
        '',
      total: toNumber(
        detail.realTotalAmount ??
        detail.totalAmount ??
        data.realTotalAmount ??
        data.totalAmount ??
        data.total ??
        data.amount
      ),
      items: parseItems(
        detail.orderProductList ||
        detail.items ||
        data.orderProductList ||
        data.items
      ),
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

  // 3. 查询订单状态
  if (isQueryOrder) {
    const detail = data.orderDetail || data;

    const pickupCode =
      detail.pickupCode ||
      detail.lockerCode ||
      detail.takeCode ||
      detail.pickupNo ||
      '';

    return {
      kind: 'mcd',
      phase: parsePhase(
        detail.orderStatus ||
        detail.status ||
        data.orderStatus ||
        data.status,
        pickupCode,
        detail.takeWay || data.takeWay
      ),
      orderNo:
        detail.orderId ||
        detail.orderNo ||
        data.orderId ||
        data.orderNo ||
        '',
      pickupCode,
      storeName:
        detail.storeName ||
        detail.store ||
        data.storeName ||
        data.store ||
        '麦当劳餐厅',
      storeAddress:
        detail.storeAddress ||
        data.storeAddress ||
        '',
      total: toNumber(
        detail.realTotalAmount ??
        detail.totalAmount ??
        detail.total ??
        data.realTotalAmount ??
        data.totalAmount ??
        data.total
      ),
      etaMinutes: toNumber(
        detail.estimatedMinutes ??
        detail.pickupMinutes ??
        detail.eta ??
        data.estimatedMinutes ??
        data.pickupMinutes ??
        data.eta
      ) || null,
      items: parseItems(
        detail.orderProductList ||
        detail.items ||
        data.orderProductList ||
        data.items
      ),
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


// 滴滴出行专用解析器
// 适配：taxi_estimate / taxi_create_order / taxi_query_order / taxi_cancel_order / taxi_get_driver_location
// 滴滴出行专用解析器
// 完整覆盖 5 个工具阶段：taxi_estimate / taxi_create_order / taxi_query_order / taxi_get_driver_location / taxi_cancel_order
// 滴滴出行专用解析器（对照滴滴官方 didi-ride-skill MCP 规范）
const parseDidiTaxiCard = (toolName, toolResult) => {
  // 滴滴官方优先在 structuredContent 返回结构体
  const data = toolResult?.structuredContent || parseToolRawData(toolResult);
  if (!data || data.error || data.success === false) return null;

  // 提取文本正文以兜底提取地址
  const rawText = Array.isArray(toolResult?.content)
    ? toolResult.content.find((part) => part?.type === 'text')?.text || ''
    : (typeof toolResult === 'string' ? toolResult : '');

  // 尝试从自然语言文本中提取起终点：“从[A]到[B]”
  const routeMatch = rawText.match(/(?:从|起点[：:]\s*)(.+?)\s*(?:到|终点[：:]\s*)([^，,。\n：:（(]+)/);
  const fromAddr = data.from?.name || data.from || routeMatch?.[1]?.trim() || '';
  const toAddr = data.to?.name || data.to || routeMatch?.[2]?.trim() || '';

  // -------------------------------------------------------------
  // 1. 车型与价格预估 (taxi_estimate)
  // -------------------------------------------------------------
  if (/estimate/i.test(toolName)) {
    const rawItems = Array.isArray(data.items) ? data.items : [];
    if (rawItems.length === 0) return null;

    // 官方规范：productName, productCategory, priceText
    const items = rawItems.map((item) => {
      // 提取纯数字以防 priceText 带"元"或货币符号
      const priceNum = typeof item.priceText === 'number'
        ? item.priceText
        : parseFloat(String(item.priceText ?? item.price ?? '').replace(/[^\d.]/g, '')) || 0;

      return {
        category: item.productCategory || item.category || '',
        productCategory: item.productCategory || '',
        name: item.productName || item.name || '可选车型',
        productName: item.productName || '可选车型',
        price: priceNum,
        priceText: String(item.priceText ?? priceNum),
      };
    });

    return {
      kind: 'didi_taxi',
      subType: 'estimate',       // 供给卡片判断
      phase: 'estimate',         // 双向兼容
      statusText: '预计费用',
      traceId: data.traceId || '',
      from: fromAddr,
      to: toAddr,
      items,
      summary: rawText,
    };
  }

  // -------------------------------------------------------------
  // 2. 创建打车订单 (taxi_create_order)
  // -------------------------------------------------------------
  if (/create_order/i.test(toolName)) {
    const orderId = data.orderId || '';
    if (!orderId && !rawText) return null;

    return {
      kind: 'didi_taxi',
      subType: 'matching',
      phase: 'matching',
      orderId: String(orderId),
      statusCode: 0, // 官方码：0 为匹配中
      statusText: '正在为您寻找司机...',
      from: fromAddr,
      to: toAddr,
      driver: null,
      summary: rawText,
    };
  }

  // -------------------------------------------------------------
  // 3. 查询订单状态 (taxi_query_order)
  // -------------------------------------------------------------
  if (/query_order/i.test(toolName)) {
    const statusCode = Number(data.statusCode ?? -1);
    if (statusCode < 0 && !data.statusText && !data.orderId) return null;

    // 官方状态分类
    const isCancelled = [6, 7, 11, 12].includes(statusCode);
    const isCompleted = statusCode === 5;
    const phaseName = isCancelled ? 'cancelled' : isCompleted ? 'completed' : 'ride';

    return {
      kind: 'didi_taxi',
      subType: phaseName,
      phase: phaseName,
      orderId: String(data.orderId || ''),
      statusCode,
      statusText: data.statusText || (
        statusCode === 0 ? '正在为您寻找司机...' :
        statusCode === 1 ? '司机已接单，赶往上车点' :
        statusCode === 2 ? '司机已到达上车点' :
        statusCode === 4 ? '行程中' :
        isCompleted ? '行程已完成' :
        isCancelled ? '订单已取消' : '行程处理中'
      ),
      from: fromAddr,
      to: toAddr,
      driver: data.driver ? {
        name: data.driver.name || '司机师傅',
        phone: data.driver.phone || '',
        carPlate: data.driver.carPlate || '',
        carModel: data.driver.carModel || '',
      } : null,
      // 官方文档：在 map.distanceKm 与 map.eta 下
      distanceKm: String(data.map?.distanceKm ?? data.distanceKm ?? ''),
      eta: String(data.map?.eta ?? data.eta ?? ''),
      summary: rawText,
    };
  }

  // -------------------------------------------------------------
  // 4. 司机实时位置 (taxi_get_driver_location)
  // -------------------------------------------------------------
  if (/get_driver_location/i.test(toolName)) {
    return {
      kind: 'didi_taxi',
      subType: 'driver_location',
      phase: 'driver_location',
      orderId: String(data.orderId || ''),
      statusCode: 1,
      statusText: data.statusText || '司机正在赶往上车点',
      from: fromAddr,
      to: toAddr,
      driver: data.driver ? {
        name: data.driver.name || '司机师傅',
        phone: data.driver.phone || '',
        carPlate: data.driver.carPlate || '',
        carModel: data.driver.carModel || '',
      } : null,
      distanceKm: String(data.distanceKm ?? data.map?.distanceKm ?? ''),
      eta: String(data.eta ?? data.map?.eta ?? ''),
      summary: rawText,
    };
  }

  // -------------------------------------------------------------
  // 5. 取消订单 (taxi_cancel_order)
  // -------------------------------------------------------------
  if (/cancel_order/i.test(toolName)) {
    return {
      kind: 'didi_taxi',
      subType: 'cancelled',
      phase: 'cancelled',
      orderId: String(data.orderId || ''),
      statusCode: 7,
      statusText: data.statusText || '订单已取消',
      from: fromAddr,
      to: toAddr,
      driver: null,
      summary: rawText,
    };
  }

  return null;
};



// 全局卡片提取入口
export const extractMcpCard = (toolName = '', toolResult = null) => {
  if (!toolName || !toolResult) return null;

  // 1. 网易云音乐工具匹配（前置判定，避免 reorder_playlist_tracks 触发下方 order 误拦截）
  const normalizedToolName = normalizeNeteaseToolName(toolName);

if (NETEASE_TOOLS.has(normalizedToolName)) {
  const neteaseCard = parseNeteaseMusicCard(
    normalizedToolName,
    toolResult
  );

  if (neteaseCard) {
    return neteaseCard;
  }
}


  // 2. 苹果日历匹配
  if (/calendar|search_events|create_event|update_event|delete_event/i.test(toolName)) {
    const calendarCard = parseAppleCalendarCard(toolName, toolResult);
    if (calendarCard) return calendarCard;
  }

  // 3. 健康工具匹配
  if (/health|watch|apple_health/i.test(toolName)) {
    const rawText = toolResult?.content?.[0]?.text || (typeof toolResult === 'string' ? toolResult : '');
    const healthCard = parseHealthMarkdown(rawText);
    if (healthCard) return healthCard;
  }


    // 4. 天气与天文环境匹配
  if (/^get_weather_and_astronomy$/i.test(toolName)) {
    const weatherCard = parseWeatherCard(toolName, toolResult);
    if (weatherCard) return weatherCard;
  }

  // 4. 瑞幸匹配
  // 必须放在麦当劳通用 order / store 匹配之前
  if (
    /^queryShopList$/i.test(toolName)
    || /^(searchProductForMcp|queryProductDetailInfo|switchProduct)$/i.test(toolName)
    || /^(previewOrder|createOrder|queryOrderDetailInfo|cancelOrder)$/i.test(toolName)
  ) {
    const luckinCard = parseLuckinCard(toolName, toolResult);
    if (luckinCard) return luckinCard;
  }

  // 5. 滴滴出行匹配
  // 必须放在麦当劳通用 order / store 匹配之前，避免 taxi_create_order 等工具被误拦截
if (/taxi|didi/i.test(toolName) && /(estimate|order|location)/i.test(toolName)) {
  const didiTaxiCard = parseDidiTaxiCard(toolName, toolResult);
  if (didiTaxiCard) return didiTaxiCard;
}


  // 6. 麦当劳匹配
  if (/mcd|mcdonald|store|order|meal/i.test(toolName)) {
    const card = parseMcdonaldsCard(toolName, toolResult);
    if (card) return card;
  }

  return null;
};
