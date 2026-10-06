/**
 * catchGameEngine.js
 *
 * 「接住掉落物」的纯 Canvas 游戏引擎：不碰 React、不碰 Dexie，只管
 * 一局游戏本身的物理和碰撞（生成掉落物、下落、碰撞判定、计分、计时）。
 * 难度曲线 / 掉落物权重 / 分数换算全部来自 catchData.js，不在这里重复。
 *
 * 用法（在 CompanionCatchGameModal.jsx 里）：
 *   const engine = new CatchGameEngine({
 *     canvas, assets, onScoreChange, onTimeChange, onCatch, onEnd,
 *   });
 *   engine.resize();   // canvas 尺寸变化时调用（含首次挂载）
 *   engine.start();    // 开始一局
 *   engine.setPetX(e.clientX); // 拖动控制
 *   engine.destroy();  // 组件卸载 / 关闭弹窗时调用
 *
 * assets 是 { pet, fish, bone, star, rock } 五个 HTMLImageElement——
 * 图片来源完全由调用方决定，引擎本身不关心图片是内嵌 SVG 还是真实
 * 图片 URL，调用方把 Image.src 换成项目自己的图片地址即可，这个文件
 * 不用改一行。
 */

import {
  ROUND_SECONDS, pickItemType, spawnIntervalMsAt, fallSpeedAt,
} from './catchData';

const PET_RADIUS = 30;
const PET_MOVE_SPEED = 320; // 键盘控制时的移动速度 px/s
const PET_STUN_SPEED = 160; // 碰到坏东西之后，晕眩期间的移动速度 px/s
const PET_STUN_SECONDS = 1.1;

export class CatchGameEngine {
  constructor({
    canvas, assets, onScoreChange, onTimeChange, onCatch, onEnd,
  }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assets = assets || {};
    this.onScoreChange = onScoreChange || (() => {});
    this.onTimeChange = onTimeChange || (() => {});
    this.onCatch = onCatch || (() => {});
    this.onEnd = onEnd || (() => {});

    this.stageW = 0;
    this.stageH = 0;
    this.dpr = Math.max(1, window.devicePixelRatio || 1);

    this.pet = {
      x: 0, y: 0, r: PET_RADIUS, squish: 0, stun: 0,
    };
    this.items = [];
    this.score = 0;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.running = false;
    this.rafId = null;
    this.lastTs = 0;
    this.keyDir = 0;
    this.dragging = false;

    this._onKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.keyDir = -1;
      if (e.key === 'ArrowRight' || e.key === 'd') this.keyDir = 1;
    };
    this._onKeyUp = (e) => {
      if (['ArrowLeft', 'a', 'ArrowRight', 'd'].includes(e.key)) this.keyDir = 0;
    };
    this._onPointerDown = (e) => {
      if (!this.running) return;
      this.dragging = true;
      this.setPetX(e.clientX);
    };
    this._onPointerMove = (e) => {
      if (!this.dragging) return;
      this.setPetX(e.clientX);
    };
    this._onPointerUp = () => { this.dragging = false; };
  }

  /* ---------------- 生命周期 ---------------- */

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.stageW = rect.width;
    this.stageH = rect.height;
    this.canvas.width = Math.round(this.stageW * this.dpr);
    this.canvas.height = Math.round(this.stageH * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._clampPetX();
  }

  attachControls() {
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  detachControls() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  start() {
    this.resize();
    this._resetPet();
    this.items = [];
    this.score = 0;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.running = true;
    this.onScoreChange(0);
    this.onTimeChange(ROUND_SECONDS);

    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  destroy() {
    this.stop();
    this.detachControls();
  }

  /* ---------------- 控制 ---------------- */

  setPetX(clientX) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    this.pet.x = Math.max(this.pet.r + 4, Math.min(this.stageW - this.pet.r - 4, x));
  }

  /* ---------------- 内部 ---------------- */

  _groundTop() { return this.stageH * 0.85; }

  _resetPet() {
    this.pet.x = this.stageW / 2;
    this.pet.y = this._groundTop() - 6;
    this.pet.squish = 0;
    this.pet.stun = 0;
  }

  _clampPetX() {
    if (!this.stageW) return;
    this.pet.x = Math.max(this.pet.r + 4, Math.min(this.stageW - this.pet.r - 4, this.pet.x || this.stageW / 2));
    this.pet.y = this._groundTop() - 6;
  }

  _spawnItem(progress) {
    const type = pickItemType(progress);
    const size = type.kind === 'rare' ? 34 : 36;
    this.items.push({
      type,
      x: 24 + Math.random() * Math.max(1, this.stageW - 48),
      y: -30,
      vy: fallSpeedAt(progress) * (0.9 + Math.random() * 0.25),
      r: size / 2,
      rot: 0,
    });
  }

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min(48, ts - this.lastTs) / 1000;
    this.lastTs = ts;

    this.elapsed += dt;
    const remain = ROUND_SECONDS - this.elapsed;
    this.onTimeChange(Math.max(0, remain));
    if (remain <= 0) {
      this.running = false;
      this.onEnd(this.score);
      return;
    }

    const progress = this.elapsed / ROUND_SECONDS;

    if (this.keyDir !== 0) {
      const speed = this.pet.stun > 0 ? PET_STUN_SPEED : PET_MOVE_SPEED;
      this.pet.x = Math.max(this.pet.r + 4, Math.min(this.stageW - this.pet.r - 4, this.pet.x + this.keyDir * speed * dt));
    }
    if (this.pet.stun > 0) this.pet.stun = Math.max(0, this.pet.stun - dt);
    if (this.pet.squish > 0) this.pet.squish = Math.max(0, this.pet.squish - dt * 2.4);

    this.spawnTimer -= dt * 1000;
    if (this.spawnTimer <= 0) {
      this._spawnItem(progress);
      this.spawnTimer = spawnIntervalMsAt(progress);
    }

    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const it = this.items[i];
      it.y += it.vy * dt;
      it.rot += dt * 1.4;

      const dx = it.x - this.pet.x;
      const dy = it.y - this.pet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const catchDist = this.pet.r * 0.85 + it.r * 0.6;

      if (dist <= catchDist && it.y > this.pet.y - this.pet.r) {
        this.items.splice(i, 1);
        this.pet.squish = 1;
        if (it.type.kind === 'bad') {
          this.score = Math.max(0, this.score + it.type.score);
          this.pet.stun = PET_STUN_SECONDS;
        } else {
          this.score += it.type.score;
        }
        this.onScoreChange(this.score);
        this.onCatch({
          kind: it.type.kind, itemKey: it.type.key, delta: it.type.score, x: it.x, y: it.y,
        });
        continue; // eslint-disable-line no-continue
      }
      if (it.y - it.r > this.stageH) this.items.splice(i, 1);
    }

    this._draw();
    this.rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _draw() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.stageW, this.stageH);

    this.items.forEach((it) => {
      const img = this.assets[it.type.key];
      if (!img || !img.complete || !img.naturalWidth) return;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(Math.sin(it.rot) * 0.18);
      const s = it.r * 2;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    });

    const petImg = this.assets.pet;
    if (petImg && petImg.complete && petImg.naturalWidth) {
      ctx.save();
      const sq = 1 + this.pet.squish * 0.22;
      const sy = 1 - this.pet.squish * 0.16;
      ctx.translate(this.pet.x, this.pet.y);
      if (this.pet.stun > 0) ctx.translate(Math.sin(this.pet.stun * 40) * 3, 0);
      ctx.scale(sq, sy);
      const ps = this.pet.r * 2.3;
      ctx.drawImage(petImg, -ps / 2, -ps / 2, ps, ps);
      ctx.restore();
    }
  }
}

export default CatchGameEngine;