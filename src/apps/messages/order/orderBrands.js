// src/apps/messages/order/orderBrands.js
//
// 点单窗口里可选的品牌，以及每个品牌支持的取餐方式。
// 这里只是一份数据：想增加品牌，在 ORDER_BRANDS 里照样子加一项即可。
//
// image 是相对于站点根目录的路径，文件放在项目的 public 目录下，
// 例如 public/order-assets/brand/coffee.webp。
// 图片不存在时，窗口会自动显示一块柔和的渐变色块，不会报错。
//
// 这里不含任何价格或菜单：商品、价格、门店都由角色通过 MCP 实时查询。

export const FULFILLMENT_OPTIONS = {
  delivery: {
    id: 'delivery',
    label: '外送',
    // 需要收货信息
    needs: 'deliveryInfo',
  },
  pickup: {
    id: 'pickup',
    label: '到店自取',
    needs: 'pickupPlace',
  },
  drive_through: {
    id: 'drive_through',
    label: '得来速',
    needs: 'pickupPlace',
  },
};

export const ORDER_BRANDS = [
  {
    id: 'mcdonalds',
    name: '麦当劳',
    image: 'order-assets/brand/fries.webp',
    fulfillments: ['delivery', 'pickup', 'drive_through'],
  },
  {
    id: 'luckin',
    name: '瑞幸咖啡',
    image: 'order-assets/brand/coffee.webp',
    fulfillments: ['pickup'],
  },
];

export const getBrandById = (brandId) => {
  return ORDER_BRANDS.find((brand) => brand.id === brandId) || null;
};

export const getFulfillmentLabel = (fulfillmentId) => {
  return FULFILLMENT_OPTIONS[fulfillmentId]?.label || '';
};

/**
 * 品牌图片的实际地址。
 * 项目部署在子路径下（vite 的 base），所以必须拼上 BASE_URL。
 */
export const getBrandImageUrl = (brand) => {
  if (!brand?.image) {
    return '';
  }

  const base = import.meta.env?.BASE_URL || '/';

  return `${base}${brand.image}`;
};

export default {
  FULFILLMENT_OPTIONS,
  ORDER_BRANDS,
  getBrandById,
  getFulfillmentLabel,
  getBrandImageUrl,
};