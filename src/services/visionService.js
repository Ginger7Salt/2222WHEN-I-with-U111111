import db from '../db';

const VISION_SETTINGS_KEY = 'visionApiConfig';

export const getVisionApiConfig = async () => {
  const record = await db.settings.get(VISION_SETTINGS_KEY);
  return record?.value || null;
};

export const saveVisionApiConfig = async (config) => {
  await db.settings.put({
    key: VISION_SETTINGS_KEY,
    value: config,
  });
};

export const isVisionConfigured = (config) => {
  return Boolean(config?.baseUrl && config?.apiKey);
};

/**
 * 调用独立的视觉 API，把图片转成一段文字描述。
 * imageBase64 应为形如 data:image/jpeg;base64,xxxx 的完整 Data URL。
 */
export const describeImageWithVision = async (imageBase64, promptHint = '') => {
  const config = await getVisionApiConfig();

  if (!isVisionConfigured(config)) {
    return {
      error: true,
      code: 'VISION_CONFIG_MISSING',
      message: '尚未配置视觉 API，无法识别图片内容。',
    };
  }

  const baseUrl = String(config.baseUrl).replace(/\/$/, '');

  const systemPrompt = `你是一个图片描述助手。请客观、简洁地描述用户发来的这张图片的画面内容、氛围与细节，
不要加入主观评价或对话式语气，输出一段 60-120 字的中文描述，供另一个 AI 角色理解“用户刚刚给它看了什么”。`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: promptHint || '请描述这张图片。' },
              { type: 'image_url', image_url: { url: imageBase64 } },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      let detail = response.statusText || '请求未成功';
      try {
        const errData = await response.json();
        detail = errData?.error?.message || errData?.message || detail;
      } catch {
        // 忽略解析失败，保留 statusText
      }
      return {
        error: true,
        code: `HTTP_${response.status}`,
        message: `[视觉 API 错误 ${response.status}] ${detail}`,
      };
    }

    const data = await response.json();
    const description = String(data?.choices?.[0]?.message?.content || '').trim();

    if (!description) {
      return {
        error: true,
        code: 'EMPTY_RESPONSE',
        message: '视觉 API 未返回有效描述。',
      };
    }

    return { error: false, description };
  } catch (err) {
    return {
      error: true,
      code: 'NETWORK_ERROR',
      message: `视觉 API 网络请求失败: ${err?.message || '未知错误'}`,
    };
  }
};

export default {
  getVisionApiConfig,
  saveVisionApiConfig,
  isVisionConfigured,
  describeImageWithVision,
};