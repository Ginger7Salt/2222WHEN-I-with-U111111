import { HARP_NOTES } from './harpNotes';

// ============================================================
// 星光小竖琴 —— 拨弦音色（Web Audio 现场合成，没有任何音频文件）。
//
// 三个泛音叠加（基音 + 二倍音 + 三倍音），起音极快、衰减各不相同，
// 再送进两条不同时长的回声，拖出一点点梦幻的尾音。越高的音衰减越快。
//
// AudioContext 只能在用户手势之后创建/恢复，所以 ensureHarpAudio() 要在
// 点击/按下的事件处理函数里调用。整个模块共用一个 AudioContext，页面卸载
// 时调 releaseHarpAudio() 关掉，不在后台占着音频设备。
// ============================================================

let audioCtx = null;
let bus = null;

export const ensureHarpAudio = () => {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;

      const ctx = new Ctor();

      const master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);

      const dry = ctx.createBiquadFilter();
      dry.type = 'lowpass';
      dry.frequency.value = 3600;
      dry.connect(master);

      const makeEcho = (time, feedback, cutoff) => {
        const delay = ctx.createDelay(1.5);
        delay.delayTime.value = time;
        const fb = ctx.createGain();
        fb.gain.value = feedback;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = cutoff;
        delay.connect(lp);
        lp.connect(fb);
        fb.connect(delay);
        lp.connect(master);
        return delay;
      };

      bus = {
        dry,
        echoA: makeEcho(0.34, 0.4, 2400),
        echoB: makeEcho(0.53, 0.3, 1800),
      };
      audioCtx = ctx;
    } catch (error) {
      console.warn('[harp] 创建 AudioContext 失败:', error);
      audioCtx = null;
      bus = null;
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
};

export const playHarpNote = (index) => {
  const note = HARP_NOTES[index];
  if (!audioCtx || !bus || !note) return;

  try {
    const now = audioCtx.currentTime;
    const length = 2.6 - index * 0.12;

    const out = audioCtx.createGain();
    out.gain.value = 1;
    out.connect(bus.dry);
    out.connect(bus.echoA);
    out.connect(bus.echoB);

    // [倍频, 音量, 占总时长的比例]
    [
      [1, 0.34, 1.0],
      [2, 0.12, 0.55],
      [3, 0.05, 0.3],
    ].forEach(([multiple, volume, share]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq * multiple;
      if (multiple > 1) osc.detune.value = 3 * multiple;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + length * share);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + length * share + 0.05);
    });
  } catch (error) {
    console.warn('[harp] 播放音符失败:', error);
  }
};

export const releaseHarpAudio = () => {
  if (audioCtx) {
    audioCtx.close().catch(() => {});
  }
  audioCtx = null;
  bus = null;
};
