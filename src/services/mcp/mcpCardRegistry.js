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

// 辅助函数：解析网易云常见字符串格式 "序号. 歌名 - 歌手 (ID:123456)"
const parseNeteaseSongLine = (line) => {
  if (typeof line !== 'string') return null;

  const idMatch = line.match(/\(ID:(\d+)\)/i);
  const id = idMatch ? idMatch[1] : null;

  // 清洗序号、(ID:...)、(plays:...)、[时间戳]
  const clean = line
    .replace(/^\d+\.\s*/, '')
    .replace(/\(ID:\d+\)/gi, '')
    .replace(/\(plays:\s*\d+,\s*ID:\d+\)/gi, '')
    .replace(/\[.*?UTC\]/gi, '')
    .trim();

  const parts = clean.split('-');
  const title = parts[0]?.trim() || line;
  const artist = parts.slice(1).join('-').trim() || '';

  return { id, title, artist, raw: line };
};

// 网易云音乐专用解析器（适配 18+1 个 MCP 工具）
const parseNeteaseMusicCard = (toolName, toolResult) => {
  const data = parseToolRawData(toolResult);
  if (!data || data.error) return null;

  // 1. 播放音乐 (play_music)
  if (/^play_music$/i.test(toolName)) {
    if (!data.title && !data.id) return null;
    return {
      kind: 'netease_music',
      viewType: 'player',
      title: data.title || '未知曲目',
      artist: data.artist || '未知艺人',
      id: data.id,
      link: data.link || (data.id ? `https://music.163.com/#/song?id=${data.id}` : '#'),
    };
  }

  // 2. 歌词信息 (get_song_lyrics)
  if (/^get_song_lyrics$/i.test(toolName)) {
    if (!data.lyrics) return null;
    return {
      kind: 'netease_music',
      viewType: 'lyrics',
      songId: data.song_id || null,
      lyrics: data.lyrics,
      translation: data.translation || null,
    };
  }

  // 3. 歌曲列表流（搜索 / 每日推荐 / 歌手热歌 / 播放历史 / 最近播放 / 歌单歌曲）
  const listDataMap = {
    search_song: data.results,
    daily_recommend: data.recommendations,
    get_artist_hot_songs: data.hot_songs,
    get_play_history: data.history,
    get_recent_plays: data.recent_plays,
    get_playlist_songs: data.songs,
  };

  if (listDataMap[toolName]) {
    const rawList = listDataMap[toolName];
    if (!Array.isArray(rawList) || rawList.length === 0) return null;

    let displayTitle = '精选音乐推荐';
    if (data.name) displayTitle = data.name;
    else if (data.artist) displayTitle = `${data.artist} 的热门作品`;
    else if (toolName === 'daily_recommend') displayTitle = '今日每日推荐';
    else if (toolName === 'search_song') displayTitle = '歌曲搜索结果';
    else if (toolName === 'get_play_history') displayTitle = '历史听歌排行';
    else if (toolName === 'get_recent_plays') displayTitle = '最近播放记录';

    return {
      kind: 'netease_music',
      viewType: 'song_list',
      toolName,
      title: displayTitle,
      songs: rawList.map(parseNeteaseSongLine).filter(Boolean),
    };
  }

  // 4. 私人 FM (get_personal_fm)
  if (/^get_personal_fm$/i.test(toolName)) {
    if (!Array.isArray(data.personal_fm) || data.personal_fm.length === 0) return null;
    return {
      kind: 'netease_music',
      viewType: 'fm',
      tracks: data.personal_fm.map((str) => {
        const parts = str.replace(/^\d+\.\s*/, '').split('|');
        const songPart = parts[0]?.trim() || '';
        const albumPart = parts[1]?.replace(/Album:\s*/i, '').replace(/\(ID:\d+\)/i, '').trim() || '';
        const parsed = parseNeteaseSongLine(songPart);
        return { ...parsed, album: albumPart };
      }),
    };
  }

  // 5. 歌单列表 (list_my_playlists)
  if (/^list_my_playlists$/i.test(toolName)) {
    if (!Array.isArray(data.playlists) || data.playlists.length === 0) return null;
    return {
      kind: 'netease_music',
      viewType: 'playlists',
      playlists: data.playlists.map((line) => {
        const segments = line.split('|').map((s) => s.trim());
        const id = segments[0]?.replace(/^ID:\s*/i, '');
        return {
          id,
          name: segments[1] || '我的歌单',
          count: segments[2] || '',
          desc: segments[3] || '',
        };
      }),
    };
  }

  // 6. 歌曲详情 (get_song_details)
  if (/^get_song_details$/i.test(toolName)) {
    if (!Array.isArray(data.songs) || data.songs.length === 0) return null;
    return {
      kind: 'netease_music',
      viewType: 'song_details',
      songs: data.songs,
    };
  }

  // 7. 用户等级徽章 (get_user_level)
  if (/^get_user_level$/i.test(toolName)) {
    return {
      kind: 'netease_music',
      viewType: 'user_level',
      level: data.level,
      listenSongs: data.listen_songs,
      createDays: data.create_days,
      nickname: data.nickname || '云音乐用户',
    };
  }

  // 8. 轻操作反馈（喜欢、创建歌单、增删歌曲、重排、收藏列表总览）
  if (
    /^(like_song|create_playlist|add_to_playlist|remove_from_playlist|update_playlist_description|reorder_playlist_tracks|get_liked_songs)$/i.test(toolName)
    || data.status
    || data.playlist_id
    || data.count !== undefined
  ) {
    return {
      kind: 'netease_music',
      viewType: 'action_feedback',
      toolName,
      status: data.status || (data.playlist_id ? `歌单已创建: ${data.name || ''} (#${data.playlist_id})` : null),
      count: data.count,
      note: data.note || null,
    };
  }

  return null;
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

// 滴滴出行专用解析器
// 适配：taxi_estimate / taxi_create_order / taxi_query_order / taxi_cancel_order / taxi_get_driver_location
// 滴滴出行专用解析器
// 完整覆盖 5 个工具阶段：taxi_estimate / taxi_create_order / taxi_query_order / taxi_get_driver_location / taxi_cancel_order
const parseDidiTaxiCard = (toolName, toolResult) => {
  const data = parseToolRawData(toolResult);
  if (!data || data.error) return null;

  const rawText = Array.isArray(toolResult?.content)
    ? toolResult.content.find((part) => part?.type === 'text')?.text || ''
    : (typeof toolResult === 'string' ? toolResult : '');

  // 提取公用地址解析（从对象或正文中提取）
  const routeMatch = rawText.match(/(?:从|起点[：:]\s*)(.+?)\s*(?:到|终点[：:]\s*)([^，,。\n：:]+)/);
  const fromAddr = data.from?.name || data.fromAddress || data.from || routeMatch?.[1]?.trim() || '';
  const toAddr = data.to?.name || data.toAddress || data.to || routeMatch?.[2]?.trim() || '';

  // -------------------------------------------------------------
  // 1. 车型与价格预估 (taxi_estimate)
  // -------------------------------------------------------------
  if (/estimate/i.test(toolName)) {
    const rawItems = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
    if (!data.traceId && rawItems.length === 0) {
      return null;
    }

    const items = rawItems
      .filter((item) => item && (item.productName || item.name || item.priceText != null || item.price != null))
      .map((item) => {
        const rawPrice = item.price ?? item.priceText ?? item.estimatePrice ?? 0;
        const numPrice = typeof rawPrice === 'number' 
          ? rawPrice 
          : parseFloat(String(rawPrice).replace(/[^\d.]/g, '')) || 0;

        return {
          category: item.productCategory || item.category || '',
          name: item.productName || item.name || '可选车型',
          price: numPrice,
          currency: item.currency || 'CNY',
        };
      });

    if (items.length === 0) return null;

    return {
      kind: 'didi_taxi',
      subType: 'estimate',
      phase: 'estimate',
      statusText: '预计费用',
      traceId: data.traceId || '',
      from: fromAddr,
      to: toAddr,
      items,
      summary: rawText,
    };
  }

  // -------------------------------------------------------------
  // 2. 创建订单 / 呼叫派单中 (taxi_create_order)
  // -------------------------------------------------------------
  if (/create_order/i.test(toolName)) {
    if (!data.orderId && !data.statusText && !rawText) return null;

    return {
      kind: 'didi_taxi',
      subType: 'order',
      phase: 'matching',
      orderId: String(data.orderId || ''),
      statusCode: Number(data.statusCode ?? data.status ?? 0),
      statusText: data.statusText || '正在为您寻找附近车辆...',
      from: fromAddr,
      to: toAddr,
      phoneNumberSuffix: data.phoneNumberSuffix || '',
      driver: null,
      distanceKm: '',
      eta: '',
      summary: rawText,
    };
  }

  // -------------------------------------------------------------
  // 3. 查询订单状态 (taxi_query_order)
  // -------------------------------------------------------------
  if (/query_order/i.test(toolName)) {
    if (!data.orderId && data.statusCode == null && !data.statusText) return null;

    return {
      kind: 'didi_taxi',
      subType: 'order',
      phase: 'status',
      orderId: String(data.orderId || ''),
      statusCode: Number(data.statusCode ?? data.status ?? 0),
      statusText: data.statusText || '行程处理中',
      from: fromAddr,
      to: toAddr,
      phoneNumberSuffix: data.phoneNumberSuffix || '',
      driver: data.driver ? {
        name: data.driver.name || '司机师傅',
        phone: data.driver.phone || '',
        carPlate: data.driver.carPlate || '',
        carModel: data.driver.carModel || '',
      } : null,
      // 容错：有些数据在 map 节点下，有些直接在根节点下
      distanceKm: String(data.map?.distanceKm ?? data.distanceKm ?? ''),
      eta: String(data.map?.eta ?? data.eta ?? ''),
      summary: rawText,
    };
  }

  // -------------------------------------------------------------
  // 4. 司机实时位置 / 接驾追踪 (taxi_get_driver_location)
  // -------------------------------------------------------------
  if (/get_driver_location/i.test(toolName)) {
    const location = data.location || data.driverLocation || data.driver?.location;
    if (!data.orderId && !location && !data.driver && !data.statusText) return null;

    return {
      kind: 'didi_taxi',
      subType: 'order',
      phase: 'driver_location',
      orderId: String(data.orderId || ''),
      statusCode: Number(data.statusCode ?? data.status ?? 1),
      statusText: data.statusText || '司机正在赶往上车地点',
      from: fromAddr,
      to: toAddr,
      phoneNumberSuffix: data.phoneNumberSuffix || '',
      driver: data.driver ? {
        name: data.driver.name || '司机师傅',
        phone: data.driver.phone || '',
        carPlate: data.driver.carPlate || '',
        carModel: data.driver.carModel || '',
      } : null,
      location: location ? {
        lng: location.lng ?? location.longitude ?? null,
        lat: location.lat ?? location.latitude ?? null,
      } : null,
      distanceKm: String(data.map?.distanceKm ?? data.distanceKm ?? ''),
      eta: String(data.map?.eta ?? data.eta ?? ''),
      summary: rawText,
    };
  }

  // -------------------------------------------------------------
  // 5. 取消订单 (taxi_cancel_order)
  // -------------------------------------------------------------
  if (/cancel_order/i.test(toolName)) {
    if (data.success === false && !data.statusText && !rawText) {
      return null;
    }

    return {
      kind: 'didi_taxi',
      subType: 'order',
      phase: 'cancelled',
      orderId: String(data.orderId || ''),
      statusCode: 7, // 滴滴通常定义 7 为已取消
      statusText: data.statusText || data.message || '订单已取消',
      from: fromAddr,
      to: toAddr,
      phoneNumberSuffix: '',
      driver: null,
      distanceKm: '',
      eta: '',
      summary: rawText,
    };
  }

  return null;
};


// 全局卡片提取入口
export const extractMcpCard = (toolName = '', toolResult = null) => {
  if (!toolName || !toolResult) return null;

  // 1. 网易云音乐工具匹配（前置判定，避免 reorder_playlist_tracks 触发下方 order 误拦截）
  if (
    /^(play_music|search_song|get_play_history|get_recent_plays|daily_recommend|list_my_playlists|get_playlist_songs|create_playlist|add_to_playlist|remove_from_playlist|like_song|update_playlist_description|reorder_playlist_tracks|get_song_lyrics|get_song_details|get_artist_hot_songs|get_personal_fm|get_liked_songs|get_user_level)$/i.test(
      toolName
    )
  ) {
    const neteaseCard = parseNeteaseMusicCard(toolName, toolResult);
    if (neteaseCard) return neteaseCard;
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
  if (/^taxi_(estimate|create_order|query_order|cancel_order|get_driver_location)$/i.test(toolName)) {
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
