// 来电铃声：角色上传了自己的铃声就循环播放那个文件（跟角色头像一样，
// 存成 base64 data URI 存在 characters 表里，不是新开一张表）；没上传
// 就用 Web Audio API 合成一段经典"嘟——嘟——"电话铃声反复播放，零依赖、
// 跟 aiService.js 里 playMessageSound 是同一个思路。
// 只在"来电响铃中"（角色主动打进来）这个场景使用，用户自己拨出去的
// 呼叫沿用原来的"拨号中"状态文案，不需要额外的呼出铃声。

let customAudioEl = null;
let synthTimer = null;
let synthAudioCtx = null;

const stopSynthRingtone = () => {
  if (synthTimer) {
    window.clearInterval(synthTimer);
    synthTimer = null;
  }

  if (synthAudioCtx) {
    synthAudioCtx.close().catch(() => {});
    synthAudioCtx = null;
  }
};

const stopCustomRingtone = () => {
  if (customAudioEl) {
    customAudioEl.pause();
    customAudioEl.src = '';
    customAudioEl = null;
  }
};

export const stopRingtone = () => {
  stopSynthRingtone();
  stopCustomRingtone();
};

const playSynthRingOnce = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!synthAudioCtx) {
      synthAudioCtx = new AudioContext();
    }

    const ctx = synthAudioCtx;

    const playTone = (freq, startOffset, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + startOffset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffset + duration);

      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration + 0.05);
    };

    // 两声短响 + 停顿，是最常见的"座机来电"节奏。
    playTone(950, 0, 0.35);
    playTone(950, 0.45, 0.35);
  } catch (err) {
    console.warn('[ringtoneService] 默认铃声播放失败：', err);
  }
};

/**
 * 开始播放来电铃声。character.ringtone 有值就循环播放那个音频文件，
 * 否则用合成音每隔一段时间响一次，模拟"响一声、停一下"的电话节奏。
 */
export const startRingtone = (character) => {
  stopRingtone();

  if (typeof window === 'undefined') return;

  if (character?.ringtone) {
    customAudioEl = new Audio(character.ringtone);
    customAudioEl.loop = true;

    customAudioEl.play().catch(() => {
      // 浏览器拦截了自动播放——用户点开来电界面之后有交互动作，
      // 之后的语音合成播放不受影响，这里安静失败即可。
    });

    return;
  }

  playSynthRingOnce();
  synthTimer = window.setInterval(playSynthRingOnce, 2200);
};