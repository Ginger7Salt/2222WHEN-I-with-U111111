// src/services/mcp/luckinCardParser.js
// 瑞幸官方 AI 开放平台 (open.lkcoffee.com) MCP 卡片数据解析器

/**
 * 安全解包 MCP 协议原始数据，并自动剥离瑞幸官方的 { code, msg, data } 业务包络
 */
function unwrapLuckinPayload(toolResult) {
  if (!toolResult) return null;

  let raw = toolResult;

  // 1. 若是 MCP 标准 structuredContent
  if (raw.structuredContent) {
    raw = raw.structuredContent;
  }

  // 2. 若是 MCP content 数组
  if (Array.isArray(raw.content)) {
    const textItem = raw.content.find((item) => item?.type === 'text' && item?.text);
    if (textItem) {
      raw = textItem.text;
    }
  }

  // 3. 若是字符串（包含可能带 ```json 标记的 JSON 文本）
  if (typeof raw === 'string') {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    try {
      raw = JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  if (!raw || typeof raw !== 'object') return null;

  // 4. 剥离瑞幸官方标准 { code, msg, data } 包络
  // 官方成功通常 code === 0 或 code === '0'
  if ('code' in raw && 'data' in raw) {
    if (Number(raw.code) !== 0) {
      return null; // 接口报错时不渲染正常业务卡片
    }
    return {
      _envelopeMsg: raw.msg,
      ...(typeof raw.data === 'object' && raw.data !== null ? raw.data : { _primitiveData: raw.data }),
    };
  }

  return raw;
}

/**
 * 格式化预计时间戳为友好时长（如 "约 8 分钟"）
 */
function formatAboutTime(aboutTime) {
  if (!aboutTime) return '10-15分钟';
  const num = Number(aboutTime);
  if (Number.isFinite(num) && num > 1000000000) {
    // 毫秒时间戳或秒时间戳转换
    const targetMs = num < 10000000000 ? num * 1000 : num;
    const diffMin = Math.max(1, Math.round((targetMs - Date.now()) / (60 * 1000)));
    return `约 ${diffMin} 分钟`;
  }
  return String(aboutTime);
}

/**
 * 统一商品项解析
 */
function normalizeProductList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((product) => ({
    productId: product.productId ?? null,
    skuCode: product.skuCode || '',
    name: product.name || product.commodityName || '咖啡饮品',
    amount: Number(product.amount ?? product.quantity ?? 1),
    desc: product.additionDesc || '',
    initialPrice: Number(product.initPrice ?? product.initialPrice ?? 0),
    price: Number(product.estimatePrice ?? product.price ?? product.payMoney ?? product.initPrice ?? 0),
  }));
}

/**
 * 瑞幸专用卡片解析入口
 */
export function parseLuckinCard(toolName, toolResult) {
  const data = unwrapLuckinPayload(toolResult);
  if (!data) return null;

  const name = String(toolName || '');

  // 1. 门店列表查询 (queryShopList)
  if (/queryShopList/i.test(name)) {
    const rawList = Array.isArray(data)
      ? data
      : (Array.isArray(data._primitiveData) ? data._primitiveData : (Array.isArray(data.shopList) ? data.shopList : []));

    if (!Array.isArray(rawList) || rawList.length === 0) return null;

    const normalizedShops = rawList
      .filter((shop) => shop && (shop.deptName || shop.address))
      .slice(0, 5)
      .map((shop) => {
        const distKm = Number(shop.distance);
        const distStr = Number.isFinite(distKm)
          ? (distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`)
          : (shop.distance ? String(shop.distance) : '');

        return {
          deptId: shop.deptId ?? null,
          deptName: shop.deptName || '瑞幸咖啡门店',
          address: shop.address || '',
          distance: distStr,
          workStatus: shop.workStatus || (shop.deptTags?.includes('营业') ? '营业中' : '营业中'),
          workTimeStart: shop.workTimeStart || '',
          workTimeEnd: shop.workTimeEnd || '',
          hours: shop.workTimeStart && shop.workTimeEnd
            ? `${shop.workTimeStart} - ${shop.workTimeEnd}`
            : '',
          longitude: shop.longitude ?? null,
          latitude: shop.latitude ?? null,
          number: shop.number || '',
          isOpen: shop.workStatus ? /营业|开放|正常/i.test(String(shop.workStatus)) : true,
        };
      });

    if (normalizedShops.length === 0) return null;

    return {
      kind: 'luckin_shop',
      shops: normalizedShops,
    };
  }

  // 2. 商品搜索、详情与切规格 (searchProductForMcp / queryProductDetailInfo / switchProduct)
  if (/^(searchProductForMcp|queryProductDetailInfo|switchProduct)$/i.test(name)) {
    // 搜索接口 data 是数组，详情与切规格是单个对象
    const product = Array.isArray(data)
      ? data[0]
      : (Array.isArray(data._primitiveData) ? data._primitiveData[0] : data);

    if (!product || !product.productName) return null;

    const attrs = Array.isArray(product.productAttrs)
      ? product.productAttrs
        .filter((attr) => attr && attr.attributeName)
        .map((attr) => ({
          attributeId: attr.attributeId ?? null,
          name: attr.attributeName,
          options: Array.isArray(attr.productSubAttrs)
            ? attr.productSubAttrs
              .filter((opt) => opt && opt.attributeName)
              .map((opt) => ({
                attributeId: opt.attributeId ?? null,
                name: opt.attributeName,
                selected: opt.selected === true,
                disabled: opt.canSelected === 0,
                price: Number(opt.price ?? 0),
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
        attr.options.filter((opt) => opt.selected).map((opt) => opt.name)
      ),
      attrs,
    };
  }

  // 3. 订单预览 (previewOrder)
  if (/previewOrder/i.test(name)) {
    const productList = normalizeProductList(data.productInfoList);
    if (productList.length === 0) return null;

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
      couponCodeList: Array.isArray(data.couponCodeList) ? data.couponCodeList : [],
      products: productList,
    };
  }

  // 4. 创建订单 (createOrder)
  if (/createOrder/i.test(name)) {
    const orderId = String(data.orderIdStr || data.orderId || '');
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
      couponCodeList: Array.isArray(data.couponCodeList) ? data.couponCodeList : [],
      products: normalizeProductList(data.productInfoList),
    };
  }

  // 5. 查询订单详情 (queryOrderDetailInfo)
  if (/queryOrderDetailInfo/i.test(name)) {
    const orderId = String(data.orderId || data.orderIdStr || '');
    const takeMealCode = data.takeMealCodeInfo?.code || '';
    const orderStatus = data.orderStatus != null ? Number(data.orderStatus) : null;

    if (!orderId && !takeMealCode && orderStatus == null) {
      return null;
    }

    const products = normalizeProductList(
      data.productInfoList || data.orderCommodityList || []
    );

    return {
      kind: 'luckin_order',
      phase: orderStatus === 100 ? 'cancelled' : 'status',
      orderId,
      shopName: data.shopInfo?.deptName || '瑞幸咖啡',
      orderStatus,
      orderStatusName: data.orderStatusName || (orderStatus === 60 ? '请取餐' : '制作中'),
      takeMealCode,
      takeOrderId: data.takeMealCodeInfo?.takeOrderId || '',
      aboutTime: formatAboutTime(data.aboutTime),
      payAmount: Number(data.orderPayAmount ?? 0),
      products,
      productName: products[0]?.name || '咖啡饮品',
      amount: products[0]?.amount || 1,
    };
  }

  // 6. 取消订单 (cancelOrder)
  if (/cancelOrder/i.test(name)) {
    const isSuccess = data._primitiveData === true || data.success === true || data.code === 0;
    const orderId = String(data.orderId || data.orderIdStr || '');

    return {
      kind: 'luckin_order',
      phase: 'cancelled',
      orderId,
      shopName: data.shopInfo?.deptName || '瑞幸咖啡',
      orderStatus: 100,
      orderStatusName: '已取消',
      takeMealCode: '',
      takeOrderId: '',
      aboutTime: null,
      payAmount: 0,
      message: data._envelopeMsg || data.msg || data.message || (isSuccess ? '订单已成功取消' : '取消失败'),
    };
  }

  return null;
}
