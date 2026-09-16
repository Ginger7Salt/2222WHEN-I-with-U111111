import { parseToolRawData, getToolText } from './mcpRawData';

const pick = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '');

const toText = (value) =>
  value === undefined || value === null ? '' : String(value);

const getBusinessData = (value) => {
  if (
    value &&
    typeof value === 'object' &&
    value.data &&
    typeof value.data === 'object' &&
    !Array.isArray(value.data)
  ) {
    return {
      ...value,
      ...value.data,
    };
  }

  return value || {};
};

const getRoute = (data, rawText) => {
  const directFrom =
    data.from?.name ||
    data.from ||
    data.fromName ||
    data.from_name ||
    '';

  const directTo =
    data.to?.name ||
    data.to ||
    data.toName ||
    data.to_name ||
    '';

  if (directFrom || directTo) {
    return {
      from: toText(directFrom),
      to: toText(directTo),
    };
  }

  const routeMatch = rawText.match(
    /从\s*(.+?)\s*到\s*(.+?)(?:[，,。.\n]|$)/
  );

  if (routeMatch) {
    return {
      from: routeMatch[1].trim(),
      to: routeMatch[2].trim(),
    };
  }

  const labeledMatch = rawText.match(
    /起点[：:]\s*(.+?)\s*(?:终点|目的地)[：:]\s*(.+?)(?:[，,。.\n]|$)/
  );

  return {
    from: labeledMatch?.[1]?.trim() || '',
    to: labeledMatch?.[2]?.trim() || '',
  };
};

const parseTextEstimateItems = (rawText) => {
  const items = [];
  const pattern =
    /(?:^|\n)\s*(?:\d+[.)、]\s*)?([^：:\n]{1,24})[：:]\s*(?:约\s*)?(?:¥|￥)?\s*(\d+(?:\.\d+)?(?:\s*[-~至]\s*\d+(?:\.\d+)?)?)\s*元?/g;

  let match;

  while ((match = pattern.exec(rawText))) {
    items.push({
      category: '',
      productCategory: '',
      name: match[1].trim(),
      productName: match[1].trim(),
      price: null,
      priceText: `${match[2]}元`,
    });
  }

  return items;
};

const normalizeItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const priceText = pick(
      item?.priceText,
      item?.price,
      item?.estimatePrice
    );

    return {
      category: toText(
        pick(item?.productCategory, item?.category, '')
      ),
      productCategory: toText(item?.productCategory || ''),
      name: toText(
        pick(item?.productName, item?.name, '可选车型')
      ),
      productName: toText(
        pick(item?.productName, item?.name, '可选车型')
      ),
      price:
        typeof item?.price === 'number' &&
        Number.isFinite(item.price)
          ? item.price
          : null,
      priceText:
        priceText === undefined || priceText === null
          ? ''
          : toText(priceText),
    };
  });
};

const normalizeDriver = (driver) => {
  if (!driver || typeof driver !== 'object') return null;

  const hasValue = Object.values(driver).some(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
  );

  if (!hasValue) return null;

  return {
    name: toText(driver.name || '司机师傅'),
    phone: toText(driver.phone || ''),
    carPlate: toText(driver.carPlate || ''),
    carModel: toText(driver.carModel || ''),
  };
};

const getStatusCode = (data, rawText) => {
  const value = pick(
    data.statusCode,
    data.status_code,
    data.status
  );

  if (value !== undefined) {
    const code = Number(value);
    if (Number.isFinite(code)) return code;
  }

  const match = rawText.match(
    /(?:statusCode|状态码|状态代码)[\s"']*[：:=]\s*(\d+)/
  );

  return match ? Number(match[1]) : NaN;
};

export const parseDidiTaxiCard = (toolName, toolResult) => {
  const name = String(toolName || '');
  const raw = parseToolRawData(toolResult);
  const data = getBusinessData(raw);
  const rawText = getToolText(toolResult);
  const route = getRoute(data, rawText);

  if (!data || data.error || data.isError || data.success === false) {
    return null;
  }

  if (/taxi_estimate/i.test(name)) {
    const items = normalizeItems(
      Array.isArray(data.items)
        ? data.items
        : parseTextEstimateItems(rawText)
    );

    return {
      kind: 'didi_taxi',
      subType: 'estimate',
      phase: 'estimate',
      statusText: '预计费用',
      traceId: toText(data.traceId || ''),
      from: route.from,
      to: route.to,
      items,
      summary: rawText,
    };
  }

  if (/taxi_create_order/i.test(name)) {
    const orderId = pick(data.orderId, data.order_id, '');

    if (!orderId && !rawText) return null;

    return {
      kind: 'didi_taxi',
      subType: 'matching',
      phase: 'matching',
      orderId: toText(orderId),
      statusCode: 0,
      statusText: '正在为您寻找司机...',
      from: route.from,
      to: route.to,
      driver: null,
      summary: rawText,
    };
  }

  if (/taxi_query_order/i.test(name)) {
    const statusCode = getStatusCode(data, rawText);
    const isCompleted = statusCode === 5;
    const isTerminated = [
      3, 6, 7, 8, 9, 10, 11, 12,
    ].includes(statusCode);

    const map =
      data.map && typeof data.map === 'object'
        ? data.map
        : {};

    return {
      kind: 'didi_taxi',
      subType: isCompleted
        ? 'completed'
        : isTerminated
          ? 'cancelled'
          : 'ride',
      phase: isCompleted
        ? 'completed'
        : isTerminated
          ? 'cancelled'
          : 'ride',
      orderId: toText(
        pick(data.orderId, data.order_id, '')
      ),
      statusCode,
      statusText: toText(
        data.statusText ||
        (
          statusCode === 0
            ? '正在为您寻找司机...'
            : statusCode === 1
              ? '司机已接单，赶往上车点'
              : statusCode === 2
                ? '司机已到达上车点'
                : statusCode === 4
                  ? '行程中'
                  : statusCode === 5
                    ? '行程已完成'
                    : isTerminated
                      ? '订单已终止'
                      : '行程处理中'
        )
      ),
      from: route.from,
      to: route.to,
      driver: normalizeDriver(data.driver),
      distanceKm: toText(
        pick(map.distanceKm, data.distanceKm, '')
      ),
      eta: toText(
        pick(map.eta, data.eta, '')
      ),
      summary: rawText,
    };
  }

  if (/taxi_get_driver_location/i.test(name)) {
    const map =
      data.map && typeof data.map === 'object'
        ? data.map
        : {};

    return {
      kind: 'didi_taxi',
      subType: 'driver_location',
      phase: 'driver_location',
      orderId: toText(
        pick(data.orderId, data.order_id, '')
      ),
      statusCode: 1,
      statusText: toText(
        data.statusText || '司机正在赶往上车点'
      ),
      from: route.from,
      to: route.to,
      driver: normalizeDriver(data.driver),
      distanceKm: toText(
        pick(data.distanceKm, map.distanceKm, '')
      ),
      eta: toText(
        pick(data.eta, map.eta, '')
      ),
      summary: rawText,
    };
  }

  if (/taxi_cancel_order/i.test(name)) {
    return {
      kind: 'didi_taxi',
      subType: 'cancelled',
      phase: 'cancelled',
      orderId: toText(
        pick(data.orderId, data.order_id, '')
      ),
      statusCode: 7,
      statusText: toText(
        data.statusText || '订单已取消'
      ),
      from: route.from,
      to: route.to,
      driver: null,
      summary: rawText,
    };
  }

  return null;
};
