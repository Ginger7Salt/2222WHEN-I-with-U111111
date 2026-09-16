const getTextContent = (toolResult) => {
  if (typeof toolResult === 'string') return toolResult;

  const content = toolResult?.content;

  if (Array.isArray(content)) {
    return content.find((item) => item?.type === 'text')?.text || '';
  }

  return '';
};

const unwrapWeatherData = (toolResult) => {
  if (!toolResult) return null;

  if (toolResult.structuredContent) {
    return toolResult.structuredContent;
  }

  const text = getTextContent(toolResult).trim();

  if (!text) return null;

  if (/^(未找到城市|查询天气失败|天气查询失败)/i.test(text)) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const textValue = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  return String(value).trim() || fallback;
};

const numberValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(
    String(value ?? '').replace(/[^\d.-]/g, '')
  );

  return Number.isFinite(parsed) ? parsed : null;
};

const parseIsDay = (value) => {
  const text = textValue(value).toLowerCase();

  if (/夜|晚上|night/.test(text)) return false;
  if (/白天|白昼|白日|day/.test(text)) return true;

  return null;
};

export const parseWeatherCard = (toolName, toolResult) => {
  if (!/^get_weather_and_astronomy$/i.test(String(toolName || ''))) {
    return null;
  }

  const data = unwrapWeatherData(toolResult);

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const city = textValue(data['城市'] ?? data.city);
  const condition = textValue(
    data['天气现象'] ?? data.condition,
    '天气状况未知'
  );

  const temperature = textValue(
    data['当前温度'] ?? data.temperature
  );

  if (!city || !temperature) {
    return null;
  }

  return {
    kind: 'weather',
    city,
    condition,
    temperature,
    feelsLike: textValue(
      data['体感温度'] ?? data.feelsLike,
      '--'
    ),
    humidity: textValue(
      data['相对湿度'] ?? data.humidity,
      '--'
    ),
    windSpeed: textValue(
      data['风速'] ?? data.windSpeed,
      '--'
    ),
    isDay: parseIsDay(
      data['是否白天'] ?? data.isDay
    ),
    daylightText: textValue(
      data['是否白天'] ?? data.daylightText,
      ''
    ),
    sunrise: textValue(
      data['今日日出时间'] ?? data.sunrise,
      '--:--'
    ),
    sunset: textValue(
      data['今日日落时间'] ?? data.sunset,
      '--:--'
    ),
    uvIndex: numberValue(
      data['紫外线指数最高'] ?? data.uvIndex
    ),
  };
};

export default parseWeatherCard;
