// src/services/mcp/luckinCardParser.js
// 瑞幸官方 AI 开放平台 (open.lkcoffee.com) MCP 卡片解析中心
// 严密适配 6 种动作卡片：门店、商品规格、订单预览、下单支付、订单制作与取餐、订单取消

/**
 * 健壮的 JSON / MCP 协议原始回包递归解包器
 * 支持 content[0].text、structuredContent、markdown 代码块及 { code, data } 业务包络
 */
function extractRawData(toolResult) {
  if (!toolResult) return null;
  let raw = toolResult;

  // 1. 若是 MCP 传输层的 content 数组
  if (raw && Array.isArray(raw.content)) {
    const textItem = raw.content.find((item) => item?.type === 'text' && item?.text);
    if (textItem) {
      raw = textItem.text;
    }
  } else if (raw && raw.structuredContent) {
    raw = raw.structuredContent;
  }

  // 2. 若是字符串（包含 markdown json 标记或转义 json 文本）
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

  // 3. 处理可能被二次序列化为 string 的 data 字段
  if (typeof raw.data === 'string') {
    try {
      raw.data = JSON.parse(raw.data);
    } catch (_) {}
  }

  // 4. 剥离官方标准 { code, msg, data } 顶层包络
  if ('code' in raw && 'data' in raw) {
    if (Number(raw.code) !== 0) return null; // 业务报错时不渲染有效卡片
    // 兼容 data 为基础类型（如取消订单返回 true）或复杂对象
    if (typeof raw.data === 'object' && raw.data !== null) {
      return { _msg: raw.msg, ...raw.data };
    }
    return { _primitiveData: raw.data, _msg: raw.msg };
  }

  return raw;
}

/**
 * 格式化距离：统一为 "350m" 或 "1.2km"
 */
function formatDistance(dist) {
  if (dist == null || dist === '') return '';
  const num = Number(dist);
  if (Number.isFinite(num)) {
    if (num < 1) {
      return `${Math.round(num * 1000)}m`;
    }
    return `${num.toFixed(1)}km`;
  }
  return String(dist);
}

/**
 * 格式化预计时间戳为友好时长（如 "约 8 分钟"）
 * 避免组件将 13 位数字时间戳直接渲染出来
 */
function formatAboutTime(aboutTime) {
  if (!aboutTime) return '10-15分钟';
  const num = Number(aboutTime);
  if (Number.isFinite(num) && num > 1000000000) {
    const targetMs = num < 10000000000 ? num * 1000 : num;
    const diffMin = Math.max(1, Math.round((targetMs - Date.now()) / (60 * 1000)));
    return `约 ${diffMin} 分钟`;
  }
  return String(aboutTime);
}

/**
 * 统一商品项解析（用于 PayCard 列表与 OrderCard 制作中清单）
 */
function normalizeProductList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(Boolean)
    .map((product) => ({
      productId: product.productId ?? null,
      skuCode: product.skuCode || '',
      name: product.name || product.commodityName || product.productName || '咖啡饮品',
      amount: Number(product.amount ?? product.quantity ?? product.count ?? 1),
      desc: product.additionDesc || product.desc || '',
      initialPrice: Number(product.initPrice ?? product.initialPrice ?? 0),
      price: Number(product.estimatePrice ?? product.price ?? product.payMoney ?? product.initPrice ?? 0),
    }));
}

/**
 * 瑞幸卡片解析主入口
 */
export function parseLuckinCard(toolName = '', toolResult = null) {
  const data = extractRawData(toolResult);
  if (!data) return null;

  const name = String(toolName || '');

  // =========================================================================
  // 1. 门店查询 (queryShopList / query_shop_list)
  // =========================================================================
  if (/query[-_]?shop[-_]?list/i.test(name)) {
    let rawShops = [];
    if (Array.isArray(data)) {
      rawShops = data;
    } else if (Array.isArray(data._primitiveData)) {
      rawShops = data._primitiveData;
    } else if (Array.isArray(data.shopList)) {
      rawShops = data.shopList;
    } else if (Array.isArray(data.list)) {
      rawShops = data.list;
    } else if (Array.isArray(data.shops)) {
      rawShops = data.shops;
    }

    if (!Array.isArray(rawShops) || rawShops.length === 0) return null;

    const normalizedShops = rawShops
      .filter((shop) => shop && (shop.deptName || shop.address || shop.name))
      .slice(0, 5)
      .map((shop) => {
        const hours =
          shop.workTimeStart && shop.workTimeEnd
            ? `${shop.workTimeStart} - ${shop.workTimeEnd}`
            : (shop.hours || '');

        const statusStr =
          shop.workStatus ||
          (shop.deptTags?.some?.((t) => String(t).includes('营')) ? '营业中' : '营业中');
        const isOpen = /营业|正常|开放/i.test(statusStr);

        return {
          deptId: shop.deptId ?? null,
          deptName: shop.deptName || shop.name || '瑞幸咖啡门店',
          address: shop.address || '',
          distance: formatDistance(shop.distance),
          workStatus: statusStr,
          workTimeStart: shop.workTimeStart || '',
          workTimeEnd: shop.workTimeEnd || '',
          hours,
          longitude: shop.longitude ?? null,
          latitude: shop.latitude ?? null,
          number: shop.number || '',
          isOpen,
        };
      });

    if (normalizedShops.length === 0) return null;

    return {
      kind: 'luckin_shop',
      shops: normalizedShops,
    };
  }

  // =========================================================================
  // 2. 商品搜索、详情与切规格 (searchProductForMcp / queryProductDetailInfo / switchProduct)
  // =========================================================================
  if (/(searchProductForMcp|queryProductDetailInfo|switchProduct)/i.test(name)) {
    let product = null;
    if (Array.isArray(data)) {
      product = data[0];
    } else if (Array.isArray(data._primitiveData)) {
      product = data._primitiveData[0];
    } else if (Array.isArray(data.productList)) {
      product = data.productList[0];
    } else {
      product = data;
    }

    if (!product || (!product.productName && !product.name)) return null;

    const rawAttrs = Array.isArray(product.productAttrs)
      ? product.productAttrs
      : (Array.isArray(product.attrs) ? product.attrs : []);

    const attrs = rawAttrs
      .filter((attr) => attr && (attr.attributeName || attr.name))
      .map((attr) => ({
        attributeId: attr.attributeId ?? null,
        name: attr.attributeName || attr.name,
        options: Array.isArray(attr.productSubAttrs || attr.options)
          ? (attr.productSubAttrs || attr.options)
              .filter((opt) => opt && (opt.attributeName || opt.name))
              .map((opt) => ({
                attributeId: opt.attributeId ?? null,
                name: opt.attributeName || opt.name,
                selected: opt.selected === true,
                disabled: opt.canSelected === 0,
                price: Number(opt.price ?? 0),
              }))
          : [],
      }));

    return {
      kind: 'luckin_product',
      productId: product.productId ?? null,
      productName: product.productName || product.name || '瑞幸咖啡',
      skuCode: product.skuCode || '',
      initialPrice: Number(product.initialPrice ?? product.initPrice ?? 0),
      estimatePrice: Number(product.estimatePrice ?? product.initialPrice ?? product.price ?? 0),
      selectedSpecs: attrs.flatMap((attr) =>
        attr.options.filter((opt) => opt.selected).map((opt) => opt.name)
      ),
      attrs,
    };
  }

  // =========================================================================
  // 3. 订单预览 (previewOrder / preview_order)
  // =========================================================================
  if (/preview[-_]?order/i.test(name)) {
    const rawList = data.productInfoList || data.orderCommodityList || data.products;
    const productList = normalizeProductList(rawList);
    if (productList.length === 0) return null;

    return {
      kind: 'luckin_pay',
      phase: 'preview',
      isCreate: false,
      orderId: '',
      tradeNo: '',
      shopName: data.shopInfo?.deptName || data.deptName || '瑞幸咖啡',
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

  // =========================================================================
  // 4. 创建订单 (createOrder / create_order)
  // =========================================================================
  if (/create[-_]?order/i.test(name)) {
    const orderId = String(data.orderIdStr || data.orderId || '');
    if (!orderId && !data.tradeNo && !data.payOrderUrl && !data.payOrderQrCodeUrl) {
      return null;
    }

    const rawList = data.productInfoList || data.orderCommodityList || data.products;

    return {
      kind: 'luckin_pay',
      phase: 'created',
      isCreate: true,
      orderId,
      tradeNo: data.tradeNo || '',
      shopName: data.shopInfo?.deptName || data.deptName || '瑞幸咖啡',
      needPay: data.needPay !== false,
      payUrl: data.payOrderUrl || data.payUrl || '',
      qrCodeUrl: data.payOrderQrCodeUrl || data.qrCodeUrl || '',
      totalInitialPrice: Number(data.totalInitialPrice ?? 0),
      privilegeMoney: Number(data.privilegeMoney ?? 0),
      discountPrice: Number(data.discountPrice ?? data.orderPayAmount ?? 0),
      couponCodeList: Array.isArray(data.couponCodeList) ? data.couponCodeList : [],
      products: normalizeProductList(rawList),
    };
  }

  // =========================================================================
  // 5. 订单详情与取餐码查询 (queryOrderDetailInfo / query_order_detail_info)
  // =========================================================================
  if (/query[-_]?order[-_]?detail/i.test(name)) {
    const orderId = String(data.orderId || data.orderIdStr || '');
    const takeMealCode = data.takeMealCodeInfo?.code || data.takeMealCode || '';
    const orderStatus = data.orderStatus != null ? Number(data.orderStatus) : null;

    if (!orderId && !takeMealCode && orderStatus == null) {
      return null;
    }

    const rawList = data.productInfoList || data.orderCommodityList || data.products;
    const products = normalizeProductList(rawList);

    return {
      kind: 'luckin_order',
      phase: orderStatus === 100 ? 'cancelled' : 'status',
      orderId,
      shopName: data.shopInfo?.deptName || data.deptName || '瑞幸咖啡',
      orderStatus,
      orderStatusName: data.orderStatusName || (orderStatus === 60 ? '请取餐' : (orderStatus === 100 ? '已取消' : '制作中')),
      takeMealCode,
      takeOrderId: data.takeMealCodeInfo?.takeOrderId || data.takeOrderId || orderId,
      aboutTime: formatAboutTime(data.aboutTime),
      payAmount: Number(data.orderPayAmount ?? data.payAmount ?? 0),
      products,
      productName: products[0]?.name || '咖啡饮品',
      amount: products[0]?.amount || 1,
    };
  }

  // =========================================================================
  // 6. 取消订单 (cancelOrder / cancel_order)
  // =========================================================================
  if (/cancel[-_]?order/i.test(name)) {
    const isSuccess = data._primitiveData === true || data.success === true || data.code === 0;
    const orderId = String(data.orderId || data.orderIdStr || '');

    return {
      kind: 'luckin_order',
      phase: 'cancelled',
      orderId,
      shopName: data.shopInfo?.deptName || data.deptName || '瑞幸咖啡',
      orderStatus: 100,
      orderStatusName: '已取消',
      takeMealCode: '',
      takeOrderId: '',
      aboutTime: null,
      payAmount: 0,
      message: data._msg || data.message || (isSuccess ? '订单已成功取消' : '取消失败'),
    };
  }

  return null;
}
