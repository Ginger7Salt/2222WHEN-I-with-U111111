// ============================================================
// 星光小竖琴 —— "拨弦"音色的波形计算（纯函数，不碰 AudioContext、不碰 DOM）。
//
// 用 Karplus-Strong 拨弦合成：一小段噪声在一个带低通的延迟回路里反复循环，
// 越循环越"圆"，听起来就是一根被拨响的弦。
//
// 为什么不用 Web Audio 自带的 DelayNode 搭回路：浏览器规定回路里的延迟
// 至少是一个渲染块（128 个采样点，约 2.9 毫秒），这样音高上限只有 340 Hz 左右，
// 而竖琴的弦在 523 到 1760 Hz。所以这里直接在 JS 里把整段波形算出来，
// 由 harpAudio.js 放进 AudioBuffer 缓存起来，每根弦只算一次。
//
// 音高校准：回路总延迟 = 整数延迟线 N + 低通的 b 个采样点 + 一个一阶全通滤波器
// 补上的小数部分 d（d 取 0.5 到 1.5 之间，这个范围全通最准）。
// ============================================================

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// 固定种子的随机数：同一个音每次算出来的波形一样，也方便测试。
const makeRandom = (seed) => {
  let x = (seed | 0) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296 * 2 - 1;
  };
};

// sampleRate：采样率；freq：音高（Hz）；seconds：波形总长度；
// damping：回路低通的强度（0.05 到 0.5，越大越闷、衰减越快，高音要用小值）；
// ringSeconds：整体余音长度（回路增益按它折算成"衰减到千分之一"的时间）。
export const renderPluckSamples = ({
  sampleRate,
  freq,
  seconds,
  damping = 0.3,
  ringSeconds = 2,
  seed = 1,
}) => {
  const total = Math.max(1, Math.floor(sampleRate * seconds));
  const out = new Float32Array(total);

  const b = clamp(damping, 0.05, 0.5);
  const period = sampleRate / freq;
  const lineLength = Math.max(2, Math.floor(period - b - 0.5));
  const fraction = period - b - lineLength;
  const allpass = (1 - fraction) / (1 + fraction);
  const loopGain = Math.pow(0.001, 1 / (freq * Math.max(0.2, ringSeconds)));

  // 激励：一小段轻微平滑过的噪声，归一化到固定峰值。
  const random = makeRandom(seed);
  const line = new Float32Array(lineLength);
  let last = 0;
  let peak = 0;
  for (let i = 0; i < lineLength; i += 1) {
    const r = random();
    line[i] = 0.5 * (r + last);
    last = r;
    peak = Math.max(peak, Math.abs(line[i]));
  }
  const scale = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < lineLength; i += 1) line[i] *= scale;

  let index = 0;
  let previousOut = 0;
  let apInput = 0;
  let apOutput = 0;

  for (let n = 0; n < total; n += 1) {
    const y = line[index];
    out[n] = y;

    const smoothed = (1 - b) * y + b * previousOut;
    previousOut = y;

    const tuned = allpass * smoothed + apInput - allpass * apOutput;
    apInput = smoothed;
    apOutput = tuned;

    line[index] = tuned * loopGain;
    index = index + 1 === lineLength ? 0 : index + 1;
  }

  // 头尾各做一小段淡入淡出，避免咔哒声。
  const fadeIn = Math.min(total, Math.floor(sampleRate * 0.0015));
  for (let n = 0; n < fadeIn; n += 1) out[n] *= n / fadeIn;
  const fadeOut = Math.min(total, Math.floor(sampleRate * 0.06));
  for (let n = 0; n < fadeOut; n += 1) out[total - 1 - n] *= n / fadeOut;

  return out;
};