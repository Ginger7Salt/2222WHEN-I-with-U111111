// src/apps/messages/interactions/drawGuess/DrawGuessCanvasModal.jsx
//
// 你画我猜的画布面板：抽一道只有用户自己能看到的题目 -> 在画布上画 ->
// 发送给角色猜。题目每次打开都会重新随机，也可以点"换一个"。
//
// 笔画用 0 到 1 的归一化坐标存在内存里（不进数据库），所以窗口尺寸变化
// 或导出成别的分辨率时，画面都能等比还原。画布底色固定是白纸，
// 画笔颜色也是固定的几种颜料色，不跟随主题——和占卜里遮罩用固定黑色同理。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Undo2, Trash2, RefreshCw, Send, Eraser } from 'lucide-react';
import { getRandomDrawWord } from './drawGuessWords';
import './drawGuess.css';

const PAPER_COLOR = '#ffffff';

const COLORS = [
  { id: 'ink', value: '#1f2937', label: '黑色' },
  { id: 'red', value: '#e11d48', label: '红色' },
  { id: 'blue', value: '#2563eb', label: '蓝色' },
  { id: 'green', value: '#16a34a', label: '绿色' },
  { id: 'amber', value: '#f59e0b', label: '黄色' },
];

// 笔刷粗细用"占画布边长的比例"表示，画布缩放后线条粗细跟着等比变化。
const BRUSHES = [
  { id: 'thin', ratio: 0.008, label: '细' },
  { id: 'medium', ratio: 0.018, label: '中' },
  { id: 'thick', ratio: 0.036, label: '粗' },
];

const ERASER_ID = 'eraser';

// 发给模型的图片边长和压缩质量：够看清简笔画，又不会让请求体太大。
const EXPORT_SIZE = 448;
const EXPORT_QUALITY = 0.82;

// 一幅画最多的笔画数，防止极端情况下内存和重绘开销失控。
const MAX_STROKES = 400;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const applyStrokeStyle = (ctx, stroke, size) => {
  const lineWidth = Math.max(1, stroke.ratio * size);

  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  return lineWidth;
};

const drawStroke = (ctx, stroke, size) => {
  const points = stroke.points;
  if (!points.length) return;

  const lineWidth = applyStrokeStyle(ctx, stroke, size);

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0][0] * size, points[0][1] * size, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0][0] * size, points[0][1] * size);

  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0] * size, points[index][1] * size);
  }

  ctx.stroke();
};

export const DrawGuessCanvasModal = ({ isOpen, onClose, onSubmit }) => {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const activePointerRef = useRef(null);
  const metricsRef = useRef({ css: 0, dpr: 1 });

  const [wordInfo, setWordInfo] = useState(() => getRandomDrawWord());
  const [colorId, setColorId] = useState(COLORS[0].id);
  const [brushId, setBrushId] = useState(BRUSHES[1].id);
  const [strokeCount, setStrokeCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { css, dpr } = metricsRef.current;
    if (!css) return;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER_COLOR;
    ctx.fillRect(0, 0, css, css);

    strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke, css));
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    const dpr = window.devicePixelRatio || 1;
    const pixelSize = Math.round(rect.width * dpr);

    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize;
      canvas.height = pixelSize;
    }

    metricsRef.current = { css: rect.width, dpr };
    redraw();
  }, [redraw]);

  // 每次打开：换一道新题、清空画布、恢复默认画笔。
  useEffect(() => {
    if (!isOpen) return;

    setWordInfo(getRandomDrawWord());
    setColorId(COLORS[0].id);
    setBrushId(BRUSHES[1].id);
    setIsSubmitting(false);
    strokesRef.current = [];
    currentStrokeRef.current = null;
    activePointerRef.current = null;
    setStrokeCount(0);
  }, [isOpen]);

  // 画布尺寸跟随容器：打开时、窗口缩放、手机横竖屏切换都会重新对齐像素。
  useEffect(() => {
    if (!isOpen) return undefined;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    setupCanvas();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => setupCanvas());
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [isOpen, setupCanvas]);

  if (!isOpen) return null;

  const getPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();

    return [
      clamp01((event.clientX - rect.left) / rect.width),
      clamp01((event.clientY - rect.top) / rect.height),
    ];
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (activePointerRef.current !== null) return;
    if (strokesRef.current.length >= MAX_STROKES) return;

    event.preventDefault();

    const canvas = canvasRef.current;
    const brush = BRUSHES.find((item) => item.id === brushId) || BRUSHES[1];
    const color = colorId === ERASER_ID
      ? PAPER_COLOR
      : (COLORS.find((item) => item.id === colorId) || COLORS[0]).value;

    // 橡皮擦本质上是用纸的颜色再涂一遍，所以橡皮擦的线条加粗一档更好用。
    const stroke = {
      color,
      ratio: colorId === ERASER_ID ? brush.ratio * 2 : brush.ratio,
      points: [getPoint(event)],
    };

    strokesRef.current.push(stroke);
    currentStrokeRef.current = stroke;
    activePointerRef.current = event.pointerId;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // 个别浏览器不支持捕获指针，不影响继续画
    }

    const { css, dpr } = metricsRef.current;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStroke(ctx, stroke, css);

    setStrokeCount(strokesRef.current.length);
  };

  const handlePointerMove = (event) => {
    const stroke = currentStrokeRef.current;
    if (!stroke || event.pointerId !== activePointerRef.current) return;

    const canvas = canvasRef.current;
    const { css, dpr } = metricsRef.current;
    const ctx = canvas.getContext('2d');

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    applyStrokeStyle(ctx, stroke, css);

    // 浏览器会把两次事件之间的细小移动合并掉，取出来能让曲线更顺滑。
    const nativeEvent = event.nativeEvent;
    const samples = typeof nativeEvent?.getCoalescedEvents === 'function'
      ? nativeEvent.getCoalescedEvents()
      : [];
    const events = samples.length > 0 ? samples : [event];

    events.forEach((sample) => {
      const previous = stroke.points[stroke.points.length - 1];
      const next = getPoint(sample);

      stroke.points.push(next);

      ctx.beginPath();
      ctx.moveTo(previous[0] * css, previous[1] * css);
      ctx.lineTo(next[0] * css, next[1] * css);
      ctx.stroke();
    });
  };

  const handlePointerEnd = (event) => {
    if (event.pointerId !== activePointerRef.current) return;

    currentStrokeRef.current = null;
    activePointerRef.current = null;

    try {
      canvasRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // 已经释放过就忽略
    }
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;

    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  };

  const handleClear = () => {
    if (strokesRef.current.length === 0) return;

    strokesRef.current = [];
    setStrokeCount(0);
    redraw();
  };

  const handleReroll = () => {
    setWordInfo((previous) => getRandomDrawWord(previous.word));
  };

  const exportImage = () => {
    const output = document.createElement('canvas');
    output.width = EXPORT_SIZE;
    output.height = EXPORT_SIZE;

    const ctx = output.getContext('2d');
    ctx.fillStyle = PAPER_COLOR;
    ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

    strokesRef.current.forEach((stroke) => drawStroke(ctx, stroke, EXPORT_SIZE));

    return output.toDataURL('image/jpeg', EXPORT_QUALITY);
  };

  const canSubmit = strokeCount > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      await onSubmit?.({
        word: wordInfo.word,
        categoryId: wordInfo.categoryId,
        categoryLabel: wordInfo.categoryLabel,
        imageDataUrl: exportImage(),
      });
      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 已经画了东西时，点遮罩不关闭，避免手滑丢掉一幅画；右上角的关闭按钮仍然可用。
  const handleBackdropClick = () => {
    if (strokeCount === 0) onClose?.();
  };

  return (
    <div className="dg-backdrop drawguess-scope" onClick={handleBackdropClick}>
      <div
        className="dg-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="你画我猜"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="dg-close"
          onClick={onClose}
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="dg-header">
          <span className="dg-kicker">DRAW AND GUESS</span>
          <h2 className="dg-title">你画我猜</h2>
        </div>

        <section className="dg-word" aria-live="polite">
          <div className="dg-word-main">
            <span className="dg-word-label">你要画的是</span>
            <span className="dg-word-text">{wordInfo.word}</span>
          </div>
          <div className="dg-word-side">
            <span className="dg-category">{wordInfo.categoryLabel}</span>
            <button
              type="button"
              className="dg-reroll"
              onClick={handleReroll}
              disabled={isSubmitting}
            >
              <RefreshCw className="h-3 w-3" />
              换一个
            </button>
          </div>
        </section>

        <p className="dg-hint">只有你能看到题目，TA 会根据你的画来猜。</p>

        <div className="dg-paper">
          <canvas
            ref={canvasRef}
            className="dg-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          />
        </div>

        <div className="dg-tools">
          <div className="dg-colors" role="group" aria-label="画笔颜色">
            {COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                className="dg-swatch"
                style={{ '--dg-swatch': color.value }}
                aria-label={color.label}
                aria-pressed={colorId === color.id}
                onClick={() => setColorId(color.id)}
              />
            ))}
            <button
              type="button"
              className="dg-tool-btn"
              aria-label="橡皮擦"
              aria-pressed={colorId === ERASER_ID}
              onClick={() => setColorId(ERASER_ID)}
            >
              <Eraser className="h-4 w-4" />
            </button>
          </div>

          <div className="dg-brushes" role="group" aria-label="画笔粗细">
            {BRUSHES.map((brush) => (
              <button
                key={brush.id}
                type="button"
                className="dg-brush"
                aria-label={`${brush.label}笔`}
                aria-pressed={brushId === brush.id}
                onClick={() => setBrushId(brush.id)}
              >
                <i style={{ '--dg-dot': `${Math.round(brush.ratio * 320)}px` }} />
              </button>
            ))}
          </div>

          <div className="dg-actions">
            <button
              type="button"
              className="dg-tool-btn"
              onClick={handleUndo}
              disabled={strokeCount === 0}
              aria-label="撤销一笔"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="dg-tool-btn"
              onClick={handleClear}
              disabled={strokeCount === 0}
              aria-label="清空画布"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="dg-submit"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          <Send className="h-4 w-4" />
          {isSubmitting ? '发送中' : '画好了，让TA猜'}
        </button>
      </div>
    </div>
  );
};

export default DrawGuessCanvasModal;
