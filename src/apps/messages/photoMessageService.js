import db from '../../db';
import {
  recordAlmanacEvent,
  ALMANAC_EVENT_TYPES,
} from '../almanac/services/almanacService';
import {
  describeImageWithVision,
  getVisionApiConfig,
  isVisionConfigured,
} from '../../services/visionService';

const MAX_DIMENSION = 900; // 长边最大 900px，兼顾清晰度与体积
const JPEG_QUALITY = 0.65;

const notifyChatRoom = (chatId) => {
  window.dispatchEvent(
    new CustomEvent('new-local-message-inserted', {
      detail: { chatId },
    }),
  );
};

/**
 * 把用户选中的原始图片文件压缩为体积更小的 JPEG Blob，
 * 避免大图直接进入 IndexedDB 造成聊天列表卡顿。
 */
const compressImageFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = () => {
    const img = new window.Image();

    img.onload = () => {
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('图片压缩失败'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };

    img.onerror = () => reject(new Error('图片解析失败'));
    img.src = reader.result;
  };

  reader.onerror = () => reject(new Error('图片读取失败'));
  reader.readAsDataURL(file);
});

const blobToBase64DataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('图片转码失败'));
  reader.readAsDataURL(blob);
});

/**
 * 发送一张真实图片消息。
 * 图片本体以压缩后的 Blob 存入 message.metadata.blob；
 * 发送后立即异步请求视觉 API 生成文字描述，写回 metadata.visionDescription，
 * 供后续对话上下文使用；识别过程中 metadata.visionStatus 为 'pending'。
 */
export const sendPhotoMessage = async ({ chatId, characterId, file }) => {
  if (!chatId || !file) return null;

  const compressedBlob = await compressImageFile(file);

  const visionConfig = await getVisionApiConfig();
  const visionEnabled = isVisionConfigured(visionConfig);

  const nowIso = new Date().toISOString();

  const payload = {
    chatId,
    characterId,
    sender: 'user',
    type: 'photo',
    content: '发送了一张照片',
    metadata: {
      blob: compressedBlob,
      visionStatus: visionEnabled ? 'pending' : 'unsupported',
      visionDescription: '',
    },
    isRead: true,
    timestamp: nowIso,
  };

  const messageId = await db.messages.add(payload);

  void recordAlmanacEvent({
    chatId,
    characterId,
    eventType: ALMANAC_EVENT_TYPES.USER_MESSAGE,
    timestamp: nowIso,
    metadata: { source: 'chat-room', messageType: 'photo' },
  });

  await db.chats.update(chatId, { updatedAt: nowIso });

  notifyChatRoom(chatId);

  if (visionEnabled) {
    void analyzeAndAttachVisionDescription(chatId, messageId, compressedBlob);
  }

  return messageId;
};

const analyzeAndAttachVisionDescription = async (chatId, messageId, blob) => {
  try {
    const dataUrl = await blobToBase64DataUrl(blob);
    const result = await describeImageWithVision(dataUrl);

    const message = await db.messages.get(messageId);
    if (!message) return;

    if (result.error) {
      await db.messages.update(messageId, {
        metadata: {
          ...message.metadata,
          visionStatus: 'error',
          visionError: result.message,
        },
      });
    } else {
      await db.messages.update(messageId, {
        metadata: {
          ...message.metadata,
          visionStatus: 'done',
          visionDescription: result.description,
        },
      });
    }
  } catch (error) {
    console.warn('[Vision] 图片识别流程异常：', error);

    const message = await db.messages.get(messageId);
    if (message) {
      await db.messages.update(messageId, {
        metadata: {
          ...message.metadata,
          visionStatus: 'error',
          visionError: error?.message || '识别失败',
        },
      });
    }
  } finally {
    notifyChatRoom(chatId);
  }
};

export default { sendPhotoMessage };