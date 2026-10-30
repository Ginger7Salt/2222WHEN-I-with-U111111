// src/apps/messages/phoneScreen/PhoneScreenCard.jsx
//
// 角色发来的"手机截图"消息卡片（message.type === 'phone_screen'）。
//
// 存的是结构化 spec（message.metadata.spec，见 phoneScreenSpec.js），这里
// 每次渲染时现画一张手机锁屏的样子——不是存下来的图片，所以清晰、不占
// 空间。想保存成真图片时点下面的"保存为图片"，用 html-to-image 把这张卡
// 片的 DOM 节点导出成 PNG（复用 margin-notes 里现成的 exportPageToImage，
// 它本身跟便签没有任何绑定，就是个通用的 DOM 转 PNG 并下载的工具）。
//
// 文字内容全部走 React 文本节点，颜色在解析阶段已经被严格校验成
// #rgb/#rrggbb，所以不存在 HTML/CSS 注入的问题。
//
// 目前只有锁屏通知栏一种画面（PHONE_SCREEN_KIND_LOCKSCREEN），以后加
// 新画面只需要在这个文件里按 spec.kind 多分一支渲染函数。
import React, { useMemo, useRef, useState } from 'react';
import { Lock, Camera, Download } from 'lucide-react';
import { exportPageToImage } from '../../margin-notes/marginNotesExportService';
import {
  PHONE_SCREEN_KIND_LOCKSCREEN,
  PHONE_SCREEN_STYLE_ANDROID,
  DEFAULT_WALLPAPER_COLOR,
} from './phoneScreenSpec';
import './phoneScreen.css';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const toDate = (timestamp) => {
  const date = timestamp ? new Date(timestamp) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const formatClock = (date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const formatDateLine = (date) =>
  `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;

// 壁纸颜色偏浅时文字改用深色，保证看得清。按相对亮度粗略判断即可。
const isLightColor = (hex) => {
  let value = String(hex || '').replace('#', '');

  if (value.length === 3) {
    value = value.split('').map((char) => char + char).join('');
  }

  if (!/^[0-9a-f]{6}$/i.test(value)) return false;

  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.62;
};

// 应用图标：用应用名第一个字 + 由应用名算出来的稳定颜色，同一个应用
// 每次渲染都是同一个颜色，不需要图片资源。
const getAppIconColor = (app) => {
  let hash = 0;

  for (const char of String(app || '')) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }

  return `hsl(${hash}, 52%, 48%)`;
};

const Battery = ({ level }) => {
  if (!level) return null;

  return (
    <span className="phone-screen-battery" aria-label={`电量 ${level}%`}>
      <span className="phone-screen-battery__body">
        <span
          className="phone-screen-battery__fill"
          style={{
            width: `${level}%`,
            background: level <= 20 ? '#ff5a5a' : 'var(--ps-fg)',
          }}
        />
      </span>
      <span className="phone-screen-battery__cap" />
    </span>
  );
};

const LockScreen = ({ spec, date, cardRef }) => {
  const isAndroid = spec.style === PHONE_SCREEN_STYLE_ANDROID;
  const wallpaper = spec.wallpaper || DEFAULT_WALLPAPER_COLOR;
  const light = isLightColor(wallpaper);
  const timeText = spec.time || formatClock(date);

  const cssVars = {
    '--ps-wallpaper': wallpaper,
    '--ps-fg': light ? '#1b1b1f' : '#ffffff',
    '--ps-fg-soft': light ? 'rgba(27, 27, 31, 0.62)' : 'rgba(255, 255, 255, 0.72)',
    '--ps-notice-bg': light ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.18)',
  };

  return (
    <div
      ref={cardRef}
      className={`phone-screen-card ${
        isAndroid ? 'phone-screen-card--android' : 'phone-screen-card--ios'
      }`}
      style={cssVars}
    >
      <div className="phone-screen-statusbar">
        <span>{isAndroid ? timeText : ''}</span>
        <Battery level={spec.battery} />
      </div>

      <div className="phone-screen-clock">
        {!isAndroid && <Lock className="phone-screen-lock" strokeWidth={2.2} />}
        <div className="phone-screen-date">{formatDateLine(date)}</div>
        <div className="phone-screen-time">{timeText}</div>
      </div>

      <div className="phone-screen-notices">
        {spec.notifications.map((item, index) => (
          <div className="phone-screen-notice" key={`${item.app}-${index}`}>
            <span
              className="phone-screen-notice__icon"
              style={{ background: getAppIconColor(item.app) }}
            >
              {Array.from(item.app)[0]}
            </span>
            <div className="phone-screen-notice__main">
              <div className="phone-screen-notice__head">
                <span className="phone-screen-notice__app">{item.app}</span>
                {item.time && (
                  <span className="phone-screen-notice__time">{item.time}</span>
                )}
              </div>
              {item.title && (
                <div className="phone-screen-notice__title">{item.title}</div>
              )}
              {item.body && (
                <div className="phone-screen-notice__body">{item.body}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="phone-screen-bottom">
        {isAndroid ? (
          <span className="phone-screen-homebar" />
        ) : (
          <>
            <span className="phone-screen-round">
              <Lock className="h-4 w-4" />
            </span>
            <span className="phone-screen-round">
              <Camera className="h-4 w-4" />
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export const PhoneScreenCard = ({ content, metadata, timestamp, messageId }) => {
  const cardRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const spec = metadata?.spec;
  const date = useMemo(() => toDate(timestamp), [timestamp]);

  const isRenderable =
    spec
    && spec.kind === PHONE_SCREEN_KIND_LOCKSCREEN
    && Array.isArray(spec.notifications)
    && spec.notifications.length > 0;

  // spec 缺失或损坏时退回显示 content 里那段文字摘要，不让整条消息空白。
  if (!isRenderable) {
    return (
      <div className="text-[12px] leading-relaxed opacity-70">
        {content || '[手机截图]'}
      </div>
    );
  }

  const handleSave = async () => {
    if (isSaving || !cardRef.current) return;

    setIsSaving(true);
    setSaveFailed(false);

    try {
      await exportPageToImage(
        cardRef.current,
        `phone-screen-${messageId || Date.now()}.png`,
      );
    } catch (error) {
      console.warn('[PhoneScreen] 保存为图片失败:', error);
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="phone-screen-wrap">
      <LockScreen spec={spec} date={date} cardRef={cardRef} />

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="phone-screen-save"
      >
        <Download className="h-3 w-3" />
        <span>
          {isSaving ? '正在保存...' : saveFailed ? '保存失败，点一下重试' : '保存为图片'}
        </span>
      </button>
    </div>
  );
};

export default PhoneScreenCard;
