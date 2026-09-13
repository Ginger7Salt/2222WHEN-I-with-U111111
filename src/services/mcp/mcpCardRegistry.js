// src/services/mcp/mcpCardRegistry.js
//
// MCP 富动作卡片解析中心
// 负责在工具执行完毕时，将真实返回提取为 UI 渲染用的结构化卡片数据

import { parseHealthMarkdown } from './healthCardParser';

const parseToolRawData = (toolResult) => {
  if (!toolResult) return null;
  if (toolResult.structuredContent) return toolResult.structuredContent;
  if (toolResult.data) return toolResult.data;
  if (Array.isArray(toolResult.content)) {
    for (const part of toolResult.content) {
      if (part.type === 'text') {
        try {
          const parsed = JSON.parse(part.text);
          return parsed.data || parsed;
        } catch {
          // 不是 JSON 文本，忽略
        }
      }
    }
  }
  if (typeof toolResult === 'string') {
    try {
      const cleaned = toolResult.replace(/^```json\s*|\s*```$/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return toolResult;
    }
  }
  return toolResult;
};

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
  const data = parseToolRawData(toolResult);
  if (!data) return null;

  // 1. 附近门店查询 (query-nearby-stores / delivery-query-stores)
  if (/query-.*stores?/i.test(toolName)) {
    const stores = Array.isArray(data) ? data : (data.stores || []);
    if (stores.length === 0) return null;
    return {
      kind: 'mcd',
      phase: 'store_list',
      stores: stores.slice(0, 3).map((s) => ({
        name: s.storeName || s.name,
        address: s.address || s.fullAddress,
        distance: s.distance ? `${s.distance}m` : null,
        status: s.businessStatus ? '营业中' : '休息中',
      })),
    };
  }

  // 2. 下单创建 (create-order)
  if (/create-?order/i.test(toolName)) {
    return {
      kind: 'mcd',
      phase: 'order_created',
      orderNo: data.orderNo || data.orderId || data.order_id,
      storeName: data.storeName || data.store || '麦当劳餐厅',
      total: Number(data.totalAmount || data.total || data.amount || 0),
      items: Array.isArray(data.items) ? data.items.map((it) => ({
        name: it.productName || it.name || it.itemName,
        qty: Number(it.quantity || it.qty || 1),
        price: Number(it.price ?? 0),
      })) : [],
      pickupType: data.beType === 2 ? '麦乐送外送' : '到店取餐',
      payUrl: data.payUrl || data.paymentUrl || null,
    };
  }

  // 3. 订单状态查询 (query-order)
  if (/query-?order/i.test(toolName)) {
    const rawStatus = String(data.orderStatus || data.status || '').toUpperCase();
    let phase = 'cooking';
    if (rawStatus.includes('CANCEL')) phase = 'cancelled';
    else if (rawStatus.includes('PICKUP') || rawStatus.includes('WAIT')) phase = 'ready';
    else if (rawStatus.includes('COMPLETE')) phase = 'completed';

    return {
      kind: 'mcd',
      phase,
      orderNo: data.orderNo || data.orderId || '',
      pickupCode: data.takeCode || data.pickupCode || data.pickupNo || '',
      storeName: data.storeName || data.store || '麦当劳餐厅',
      etaMinutes: Number(data.estimatedMinutes || data.pickupMinutes || 0) || null,
      items: Array.isArray(data.items) ? data.items.map((it) => ({
        name: it.productName || it.name,
        qty: Number(it.quantity || it.qty || 1),
      })) : [],
    };
  }

  return null;
};

// 瑞幸专用解析器
// 适配：queryShopList / searchProductForMcp / queryProductDetailInfo /
// switchProduct / previewOrder / createOrder / queryOrderDetailInfo / cancelOrder
const parseLuckinCard = (toolName, toolResult) => {
  const data = parseToolRawData(toolResult);
  if (!data) return null;

  // 1. 门店查询
  if (/^queryShopList$/i.test(toolName)) {
    const shops = Array.isArray(data) ? data : [];
    if (shops.length === 0) return null;

    const normalizedShops = shops
      .filter((shop) => shop && (shop.deptName || shop.address))
      .slice(0, 5)
      .map((shop) => ({
        deptId: shop.deptId ?? null,
        deptName: shop.deptName || '瑞幸咖啡门店',
        address: shop.address || '',
        distance: shop.distance ?? null,
        workStatus: shop.workStatus || '',
        workTimeStart: shop.workTimeStart || '',
        workTimeEnd: shop.workTimeEnd || '',
        hours: shop.workTimeStart && shop.workTimeEnd
          ? `${shop.workTimeStart} - ${shop.workTimeEnd}`
          : '',
        longitude: shop.longitude ?? null,
        latitude: shop.latitude ?? null,
        number: shop.number || '',
        isOpen: shop.workStatus
          ? /营业|开放|正常/i.test(String(shop.workStatus))
          : null,
      }));

    if (normalizedShops.length === 0) return null;

    return {
      kind: 'luckin_shop',
      shops: normalizedShops,
    };
  }

  // 2. 商品搜索、商品详情、规格切换
  if (
    /^(searchProductForMcp|queryProductDetailInfo|switchProduct)$/i.test(toolName)
  ) {
    const product = Array.isArray(data) ? data[0] : data;
    if (!product || !product.productName) return null;

    const attrs = Array.isArray(product.productAttrs)
      ? product.productAttrs
        .filter((attr) => attr && attr.attributeName)
        .map((attr) => ({
          attributeId: attr.attributeId ?? null,
          name: attr.attributeName,
          options: Array.isArray(attr.productSubAttrs)
            ? attr.productSubAttrs
              .filter((option) => option && option.attributeName)
              .map((option) => ({
                attributeId: option.attributeId ?? null,
                name: option.attributeName,
                selected: option.selected === true,
                disabled: option.canSelected === 0,
                price: Number(option.price ?? 0),
              }))
            : [],
        }))
      : [];

    return {
      kind: 'luckin_product',
      productId: product.productId ?? null,
      productName: product.productName,
      skuCode: product.skuCode || '',
      initialPrice: Number(product.initialPrice ?? 0),
      estimatePrice: Number(product.estimatePrice ?? product.initialPrice ?? 0),
      selectedSpecs: attrs.flatMap((attr) =>
        attr.options
          .filter((option) => option.selected)
          .map((option) => option.name)
      ),
      attrs,
    };
  }

  // 3. 订单预览
  if (/^previewOrder$/i.test(toolName)) {
    if (!data || !Array.isArray(data.productInfoList) || data.productInfoList.length === 0) {
      return null;
    }

    return {
      kind: 'luckin_pay',
      phase: 'preview',
      isCreate: false,
      orderId: '',
      tradeNo: '',
      shopName: data.shopInfo?.deptName || '瑞幸咖啡',
      needPay: true,
      payUrl: '',
      qrCodeUrl: '',
      totalInitialPrice: Number(data.totalInitialPrice ?? 0),
      privilegeMoney: Number(data.privilegeMoney ?? 0),
      discountPrice: Number(data.discountPrice ?? data.estimateTotalPrice ?? 0),
      couponCodeList: Array.isArray(data.couponCodeList)
        ? data.couponCodeList
        : [],
      products: data.productInfoList.map((product) => ({
        productId: product.productId ?? null,
        skuCode: product.skuCode || '',
        name: product.name || '咖啡饮品',
        amount: Number(product.amount ?? 1),
        desc: product.additionDesc || '',
        initialPrice: Number(product.initPrice ?? 0),
        price: Number(product.estimatePrice ?? product.initPrice ?? 0),
      })),
    };
  }

  // 4. 创建订单
  if (/^createOrder$/i.test(toolName)) {
    const orderId = data.orderIdStr || (data.orderId != null ? String(data.orderId) : '');
    if (!orderId && !data.tradeNo && !data.payOrderUrl && !data.payOrderQrCodeUrl) {
      return null;
    }

    return {
      kind: 'luckin_pay',
      phase: 'created',
      isCreate: true,
      orderId,
      tradeNo: data.tradeNo || '',
      shopName: data.shopInfo?.deptName || '瑞幸咖啡',
      needPay: data.needPay !== false,
      payUrl: data.payOrderUrl || '',
      qrCodeUrl: data.payOrderQrCodeUrl || '',
      totalInitialPrice: Number(data.totalInitialPrice ?? 0),
      privilegeMoney: Number(data.privilegeMoney ?? 0),
      discountPrice: Number(data.discountPrice ?? 0),
      couponCodeList: Array.isArray(data.couponCodeList)
        ? data.couponCodeList
        : [],
      products: Array.isArray(data.productInfoList)
        ? data.productInfoList.map((product) => ({
          productId: product.productId ?? null,
          skuCode: product.skuCode || '',
          name: product.name || '咖啡饮品',
          amount: Number(product.amount ?? 1),
          desc: product.additionDesc || '',
          initialPrice: Number(product.initPrice ?? 0),
          price: Number(product.estimatePrice ?? product.initPrice ?? 0),
        }))
        : [],
    };
  }

  // 5. 查询订单详情
  if (/^queryOrderDetailInfo$/i.test(toolName)) {
    const orderId = data.orderId || data.orderIdStr || '';
    const takeMealCode = data.takeMealCodeInfo?.code || '';
    const orderStatus = data.orderStatus ?? null;

    if (!orderId && !takeMealCode && orderStatus == null) {
      return null;
    }

    return {
      kind: 'luckin_order',
      phase: 'status',
      orderId: String(orderId),
      shopName: data.shopInfo?.deptName || '瑞幸咖啡',
      orderStatus,
      orderStatusName: data.orderStatusName || '',
      takeMealCode,
      takeOrderId: data.takeMealCodeInfo?.takeOrderId || '',
      aboutTime: data.aboutTime ?? null,
      payAmount: Number(data.orderPayAmount ?? 0),
    };
  }

  // 6. 取消订单
  if (/^cancelOrder$/i.test(toolName)) {
    const orderId = data.orderId || data.orderIdStr || '';

    if (!orderId && data.success === false) {
      return null;
    }

    return {
      kind: 'luckin_order',
      phase: 'cancelled',
      orderId: String(orderId),
      shopName: data.shopInfo?.deptName || '瑞幸咖啡',
      orderStatus: 100,
      orderStatusName: data.orderStatusName || '已取消',
      takeMealCode: '',
      takeOrderId: '',
      aboutTime: null,
      payAmount: Number(data.orderPayAmount ?? 0),
      message: data.msg || data.message || '订单已取消',
    };
  }

  return null;
};

// 全局卡片提取入口
export const extractMcpCard = (toolName = '', toolResult = null) => {
  if (!toolName || !toolResult) return null;

  // 1. 苹果日历匹配
  if (/calendar|search_events|create_event|update_event|delete_event/i.test(toolName)) {
    const calendarCard = parseAppleCalendarCard(toolName, toolResult);
    if (calendarCard) return calendarCard;
  }

  // 2. 健康工具匹配
  if (/health|watch|apple_health/i.test(toolName)) {
    const rawText = toolResult?.content?.[0]?.text || (typeof toolResult === 'string' ? toolResult : '');
    const healthCard = parseHealthMarkdown(rawText);
    if (healthCard) return healthCard;
  }

  // 3. 瑞幸匹配
  // 必须放在麦当劳通用 order / store 匹配之前
  if (
    /^queryShopList$/i.test(toolName)
    || /^(searchProductForMcp|queryProductDetailInfo|switchProduct)$/i.test(toolName)
    || /^(previewOrder|createOrder|queryOrderDetailInfo|cancelOrder)$/i.test(toolName)
  ) {
    const luckinCard = parseLuckinCard(toolName, toolResult);
    if (luckinCard) return luckinCard;
  }

  // 4. 麦当劳匹配
  if (/mcd|mcdonald|store|order|meal/i.test(toolName)) {
    const card = parseMcdonaldsCard(toolName, toolResult);
    if (card) return card;
  }

  return null;
};
