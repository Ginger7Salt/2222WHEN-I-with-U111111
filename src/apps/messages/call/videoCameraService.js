// 视频通话的摄像头管理与截帧服务。
// 纯函数 + 状态对象，不依赖 React，也不依赖 Dexie / aiService——
// 调用者（VideoCallScreen / callService）自己决定何时截帧、如何使用截帧结果。
//
// 设计原则：
// - 摄像头流的生命周期由调用者控制（startCamera / stopCamera）
// - 截帧（captureFrame）返回 base64 data URL，调用者决定发给哪个 AI
// - vision 能力检测（supportsVision）是启发式的——只能根据 model 名字猜，
//   不能 100% 保证，用于"要不要在接听界面显示视频选项"的判断。

// 已知支持视觉输入的模型名字片段（不区分大小写）
const VISION_MODEL_HINTS = [
  'gpt-4o',
  'gpt-4-vision',
  'gpt-4-turbo',
  'claude-3',
  'claude-opus',
  'claude-sonnet',
  'claude-haiku',
  'gemini',
  'vision',
  'vl',        // 常见于国内多模态模型命名（如 Qwen-VL）
  'multimodal',
];

/**
 * 根据用户配置的模型名称，启发式判断该模型是否支持视觉输入。
 * 不能保证 100% 准确——只是用来决定要不要展示"视频接听"按钮。
 * 当无法判断时，返回 false（保守），不展示视频选项。
 */
export const supportsVision = (modelName) => {
  if (!modelName || typeof modelName !== 'string') return false;
  const lower = modelName.toLowerCase();
  return VISION_MODEL_HINTS.some((hint) => lower.includes(hint));
};

// 当前活跃的摄像头流，模块级单例——同一时间只开一路摄像头
let activeStream = null;

/**
 * 启动摄像头，返回 MediaStream。
 * 如果已经有活跃流，直接复用（不重复申请权限）。
 * 失败时抛出异常，调用者应捕获并告知用户。
 */
export const startCamera = async () => {
  if (activeStream && activeStream.active) {
    return activeStream;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false, // 摄像头流不带麦克风，音频由现有通话逻辑处理
  });

  activeStream = stream;
  return stream;
};

/**
 * 停止摄像头，释放资源。
 * 在通话挂断、组件卸载时调用。
 */
export const stopCamera = () => {
  if (!activeStream) return;

  activeStream.getTracks().forEach((track) => track.stop());
  activeStream = null;
};

/**
 * 从 <video> 元素截取当前帧，返回 base64 JPEG data URL。
 * videoElement 必须是已经在播放摄像头流的 <video> 元素。
 * 失败时返回 null（不抛异常，让通话继续，只是这轮没有视觉上下文）。
 *
 * @param {HTMLVideoElement} videoElement
 * @param {number} [quality=0.7] JPEG 压缩质量 0-1，越低体积越小
 * @returns {string|null} base64 data URL 或 null
 */
export const captureFrame = (videoElement, quality = 0.7) => {
  try {
    if (
      !videoElement
      || videoElement.readyState < 2 // HAVE_CURRENT_DATA
      || videoElement.videoWidth === 0
    ) {
      return null;
    }

    const canvas = document.createElement('canvas');
    // 按实际视频分辨率缩到合理大小：宽度上限 480px，防止 base64 太大
    const maxWidth = 480;
    const scale = Math.min(1, maxWidth / videoElement.videoWidth);
    canvas.width = Math.round(videoElement.videoWidth * scale);
    canvas.height = Math.round(videoElement.videoHeight * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', quality);
  } catch (error) {
    console.warn('[videoCameraService] 截帧失败：', error);
    return null;
  }
};

/**
 * 把一组按时间顺序的截帧包装成 OpenAI 兼容的 vision content 数组。
 * frames 为空则退化为纯文字字符串。
 *
 * @param {string} text 用户说的话（语音转写或打字）
 * @param {string[]|string|null} frames 摄像头截帧 base64 数组（也兼容单张字符串）
 */
export const buildVisionUserContent = (text, frames) => {
  const list = (Array.isArray(frames) ? frames : [frames]).filter(Boolean);

  if (list.length === 0) {
    return text;
  }

  const spoken = text || '（用户没有说话，只是让你看看TA现在的样子）';
  const note = list.length > 1
    ? `（上面 ${list.length} 张图是对方说这段话期间按时间顺序抽取的画面，最后一张是说完时的样子）`
    : '（上面这张图是对方说这段话时你看到的画面）';

  return [
    ...list.map((url) => ({
      type: 'image_url',
      image_url: { url, detail: 'low' },
    })),
    { type: 'text', text: `${spoken}\n${note}` },
  ];
};

// ---------------------------------------------------------------------
// 录像期间抽帧。所有帧只放在内存里，不写入 IndexedDB / localStorage，
// 刷新页面或挂断后就消失。
// ---------------------------------------------------------------------
const SAMPLE_INTERVAL_MS = 1000;

// 发给 AI 的帧数随说话时长增加：约每 3 秒多一张，起步 2 张，封顶 10 张
// （封顶是为了控制 token 和请求体积，说得再久也不会无限涨）。
const FRAMES_MIN = 2;
const FRAMES_MAX = 10;
const SECONDS_PER_EXTRA_FRAME = 3;

// 内存里最多暂存的原始帧数。超过就隔一张丢一张、同时把抽帧间隔翻倍，
// 这样不管录多久，暂存的帧始终覆盖整段录像，而不是只剩最后一分钟。
const MAX_RAW_FRAMES = 60;

export const getTargetFrameCount = (durationMs) => {
  const seconds = Math.max(0, durationMs) / 1000;
  const count = Math.round(seconds / SECONDS_PER_EXTRA_FRAME) + FRAMES_MIN;

  return Math.min(FRAMES_MAX, Math.max(FRAMES_MIN, count));
};

let samplerTimer = null;
let samplerVideo = null;
let samplerStartedAt = 0;
let samplerStride = 1;
let samplerTick = 0;
let rawFrames = [];

const pickEvenly = (frames, max) => {
  if (frames.length <= max) return [...frames];

  const indexes = new Set();
  for (let i = 0; i < max; i += 1) {
    indexes.add(Math.round((i * (frames.length - 1)) / (max - 1)));
  }

  return [...indexes].map((index) => frames[index]);
};

const pushSample = () => {
  const frame = captureFrame(samplerVideo, 0.6);
  if (!frame) return;

  rawFrames.push(frame);

  if (rawFrames.length > MAX_RAW_FRAMES) {
    rawFrames = rawFrames.filter((_, index) => index % 2 === 0);
    samplerStride *= 2;
  }
};

const handleSamplerTick = () => {
  samplerTick += 1;
  if (samplerTick % samplerStride !== 0) return;

  pushSample();
};

export const beginFrameSampling = (videoElement) => {
  if (samplerTimer) window.clearInterval(samplerTimer);

  samplerVideo = videoElement;
  samplerStartedAt = Date.now();
  samplerStride = 1;
  samplerTick = 0;
  rawFrames = [];

  pushSample();
  samplerTimer = window.setInterval(handleSamplerTick, SAMPLE_INTERVAL_MS);
};

/**
 * 结束抽帧，返回按时间排序的截帧（含最后一张）。
 * 帧数按这段录像的时长算：说得越久，给 AI 的画面越多。
 */
export const endFrameSampling = () => {
  if (samplerTimer) window.clearInterval(samplerTimer);
  samplerTimer = null;

  const durationMs = Date.now() - samplerStartedAt;

  // 结束时再补一张，保证最后一张就是说完那一刻的样子。
  pushSample();
  const picked = pickEvenly(rawFrames, getTargetFrameCount(durationMs));

  rawFrames = [];
  samplerVideo = null;

  return picked;
};

// 每条用户轮次对应的截帧，只存在内存里，供重 roll 复用。
const turnFrames = new Map();

export const rememberTurnFrames = (turnId, frames) => {
  if (turnId && Array.isArray(frames) && frames.length > 0) {
    turnFrames.set(turnId, frames);
  }
};

export const getTurnFrames = (turnId) => turnFrames.get(turnId) || [];

export const clearTurnFrames = () => {
  turnFrames.clear();
  if (samplerTimer) window.clearInterval(samplerTimer);
  samplerTimer = null;
  samplerVideo = null;
  rawFrames = [];
};