import db from '../db';
import { supportsVision } from '../apps/messages/call/videoCameraService';

// 视频通话专用的 API 配置。跟"视觉识别 API"（visionService.js，用来把
// 用户发的图片转成文字描述）是两件事：那个只负责读图出文字，这个是
// 视频通话里真正替角色说话的模型，要同时吃人设 + 画面 + 对话，所以
// 必须是支持图片输入的聊天模型。
//
// 存在通用的 db.settings 键值表里（跟 apiConfigBackup 一个惯例），
// 不需要改数据库版本。

export const VIDEO_API_SETTINGS_KEY = 'apiConfigVideo';

export const getVideoApiConfig = async () => {
  const record = await db.settings.get(VIDEO_API_SETTINGS_KEY);
  return record?.value || null;
};

export const saveVideoApiConfig = async (config) => {
  await db.settings.put({
    key: VIDEO_API_SETTINGS_KEY,
    value: config,
  });
};

// 视频 API 要三项都填才算配置好：视觉模型必须明确指定，不能像普通
// 聊天那样缺省成某个纯文字模型。
export const isVideoApiConfigured = (config) => (
  Boolean(config?.baseUrl && config?.apiKey && config?.model)
);

/**
 * 视频通话实际使用的 API：配置了视频 API 就用它，否则退回主 API。
 */
export const resolveVideoCallApiConfig = async () => {
  const videoConfig = await getVideoApiConfig();

  if (isVideoApiConfigured(videoConfig)) {
    return videoConfig;
  }

  const mainRecord = await db.settings.get('apiConfig');
  return mainRecord?.value || {};
};

/**
 * 能不能发起/接听视频通话：配置了视频 API 就直接认为可以（用户
 * 自己选的视觉模型，不再靠模型名猜）；否则看主 API 的模型名像不像
 * 支持视觉的。
 */
export const isVideoCallAvailable = async () => {
  try {
    const videoConfig = await getVideoApiConfig();

    if (isVideoApiConfigured(videoConfig)) {
      return true;
    }

    const mainRecord = await db.settings.get('apiConfig');
    return supportsVision(mainRecord?.value?.model);
  } catch (error) {
    console.warn('[videoCallApiService] 检查视频通话可用性失败：', error);
    return false;
  }
};