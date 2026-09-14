// src/services/soundService.js
import db from '../db';
 // 引用你的 Dexie 数据库实例，路径请按项目实际对齐

class SoundService {
  constructor() {
    this.audioCtx = null;
    this.audioCache = new Map();
    this.lastPlayedTime = 0;
    this.throttleInterval = 500; // 防连击节流 (ms)

    // 音效预设列表（可拓展）
    this.presets = [
      { id: 'dewdrop', name: '晨露水滴 (默认)', file: '/sounds/companion_dewdrop.mp3' },
      { id: 'crystal', name: '水晶风铃', file: '/sounds/companion_crystal.mp3' },
      { id: 'soft_chime', name: '柔和双音', file: '/sounds/companion_chime.mp3' },
      { id: 'pulse', name: '微光脉冲', file: '/sounds/companion_pulse.mp3' }
    ];

    this.STORAGE_KEY_PRESET = 'companion_sound_preset';
    this.STORAGE_KEY_ENABLED = 'companion_sound_enabled';
    this.STORAGE_KEY_VOLUME = 'companion_sound_volume';

    // 监听任意首次用户交互以自动解锁 iOS Web Audio 上下文
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.getAudioContext();
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
    }
  }

  /**
   * 惰性获取 AudioContext
   */
  getAudioContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // --- 用户偏好设置读取与写入 ---
  getSoundEnabled() {
    const val = localStorage.getItem(this.STORAGE_KEY_ENABLED);
    return val === null ? true : val === 'true';
  }

  setSoundEnabled(enabled) {
    localStorage.setItem(this.STORAGE_KEY_ENABLED, String(Boolean(enabled)));
  }

  getCurrentPreset() {
    return localStorage.getItem(this.STORAGE_KEY_PRESET) || 'dewdrop';
  }

  setCurrentPreset(presetId) {
    if (this.presets.some(p => p.id === presetId)) {
      localStorage.setItem(this.STORAGE_KEY_PRESET, presetId);
    }
  }

  getVolume() {
    const val = localStorage.getItem(this.STORAGE_KEY_VOLUME);
    return val !== null ? Math.max(0, Math.min(1, parseFloat(val))) : 0.6;
  }

  setVolume(vol) {
    localStorage.setItem(this.STORAGE_KEY_VOLUME, String(Math.max(0, Math.min(1, vol))));
  }

  /**
   * 核心播放入口：仅在伴侣发来新消息时调用
   * @param {Object} options - { chatId, presetId }
   */
  async playCompanionMessageSound(options = {}) {
    // 1. 全局声音开关判定
    if (!this.getSoundEnabled()) return;

    // 2. 检查单个聊天室的静音状态（尊重 chats 表中的 soundEnabled 属性）
    const targetChatId = options.chatId;
    if (targetChatId && db?.chats) {
      try {
        const chat = await db.chats.get(Number(targetChatId));
        if (chat && chat.soundEnabled === false) {
          return; // 当前伴侣被单独静音，不播放
        }
      } catch (e) {
        // 容错通过
      }
    }

    // 3. 节流判定（防止多条消息并发时产生刺耳爆音）
    const now = Date.now();
    if (now - this.lastPlayedTime < this.throttleInterval) {
      return;
    }
    this.lastPlayedTime = now;

    // 4. 优先尝试播放真实音频文件，若 404 或受限则自动无缝降级为合成音
    const presetId = options.presetId || this.getCurrentPreset();
    const preset = this.presets.find(p => p.id === presetId) || this.presets[0];
    const volume = this.getVolume();

    try {
      await this.playAudioFile(preset.file, volume);
    } catch {
      // 文件缺失或解码失败，启动纯代码合成音保底
      this.playSynthesizedTone(presetId, volume);
    }
  }

  /**
   * 播放实际音频文件
   */
  playAudioFile(url, volume) {
    return new Promise((resolve, reject) => {
      let audio = this.audioCache.get(url);
      if (!audio) {
        audio = new Audio(url);
        audio.preload = 'auto';
        this.audioCache.set(url, audio);
      }
      audio.volume = volume;
      audio.currentTime = 0;
      audio.play().then(resolve).catch(reject);
    });
  }

  /**
   * 🎛️ 高品质 Web Audio API 原生合成音（零外部资源依赖）
   */
  playSynthesizedTone(toneId, volume = 0.6) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(ctx.destination);

    switch (toneId) {
      case 'crystal': {
        // 🔮 水晶风铃：纯净的双高音余音袅袅
        [1046.5, 2093].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.05);

          gain.gain.setValueAtTime(0, now + i * 0.05);
          gain.gain.linearRampToValueAtTime(0.28, now + i * 0.05 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.05);
          osc.stop(now + 0.5);
        });
        break;
      }

      case 'soft_chime': {
        // 🔔 柔和双音：温暖的上升五度音
        [587.33, 880].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.07);

          gain.gain.setValueAtTime(0.01, now + i * 0.07);
          gain.gain.linearRampToValueAtTime(0.35, now + i * 0.07 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.3);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.35);
        });
        break;
      }

      case 'pulse': {
        // 💡 微光脉冲：短促干脆的轻音
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }

      case 'dewdrop':
      default: {
        // 💧 晨露水滴（默认）：柔和圆润的弯音滑起
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1300, now + 0.09);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.32, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
    }
  }

  /**
   * 提供给设置界面的试听方法
   */
  preview(presetId) {
    this.playSynthesizedTone(presetId, this.getVolume());
  }
}

export const soundService = new SoundService();
export default soundService;
