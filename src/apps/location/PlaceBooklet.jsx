import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Compass,
  Edit3,
  MapPin,
  Trash2,
  X,
} from 'lucide-react';

import {
  deletePlace,
  listPlaces,
  renamePlace,
  updatePlaceNote,
} from './placeService';

const MAP_IMAGE_URL = 'https://u2.fukit.cn/yYmWOHrYc';

const hashString = (value) => {
  let hash = 0;
  String(value || '').split('').forEach((char) => {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  });
  return Math.abs(hash);
};

// 坐标映射：在地图内生成平滑点位
const getMapPoint = (place, index) => {
  const latitude = Number(place?.latitude ?? place?.lat);
  const longitude = Number(place?.longitude ?? place?.lng ?? place?.lon);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      x: 140 + ((longitude + 180) / 360) * 720,
      y: 90 + ((90 - latitude) / 180) * 440,
    };
  }

  const seed = hashString(place?.id || place?.name || index);
  return {
    x: 140 + ((seed * 41 + index * 127) % 720),
    y: 100 + ((seed * 23 + index * 83) % 420),
  };
};

// 经纬度坐标文字格式化（用于坐标美化展示）
const formatCoordinates = (place, index) => {
  const latitude = Number(place?.latitude ?? place?.lat);
  const longitude = Number(place?.longitude ?? place?.lng ?? place?.lon);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lonDir = longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(latitude).toFixed(2)}° ${latDir}, ${Math.abs(longitude).toFixed(2)}° ${lonDir}`;
  }

  const seed = hashString(place?.id || place?.name || index);
  const pseudoLat = (24 + (seed % 280) / 10).toFixed(2);
  const pseudoLon = (108 + ((seed * 7) % 220) / 10).toFixed(2);
  return `${pseudoLat}° N, ${pseudoLon}° E`;
};

const formatDate = (value) => {
  if (!value) return '未知日期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知日期';
  return date.toLocaleDateString('zh-CN');
};

const PlaceBooklet = ({ chatId, character, onBack }) => {
  const [places, setPlaces] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftNote, setDraftNote] = useState('');

  const reload = async () => {
    try {
      const list = await listPlaces(chatId);
      setPlaces(list);
      setActiveIndex((previous) =>
        Math.min(previous, Math.max(list.length - 1, 0)),
      );
    } catch (error) {
      console.warn('[Location] Failed to load places:', error);
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const activePlace = places[activeIndex];

  useEffect(() => {
    if (!activePlace) {
      setDraftName('');
      setDraftNote('');
      setIsEditing(false);
      return;
    }
    setDraftName(activePlace.name || '');
    setDraftNote(activePlace.note || '');
    setIsEditing(false);
  }, [activePlace?.id]);

  const selectPlace = (index) => {
    const place = places[index];
    if (!place) return;
    setActiveIndex(index);
    setDraftName(place.name || '');
    setDraftNote(place.note || '');
  };

  const handleStartEditing = () => {
    if (!activePlace) return;
    setDraftName(activePlace.name || '');
    setDraftNote(activePlace.note || '');
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    if (!activePlace) return;
    setDraftName(activePlace.name || '');
    setDraftNote(activePlace.note || '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!activePlace || isSaving) return;
    const trimmedName = String(draftName || '').trim();
    if (!trimmedName) return;

    setIsSaving(true);
    try {
      await renamePlace(activePlace.id, trimmedName);
      await updatePlaceNote(activePlace.id, draftNote);
      await reload();
      setIsEditing(false);
    } catch (error) {
      console.warn('[Location] Failed to save place:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (placeId) => {
    try {
      await deletePlace(chatId, placeId);
      setIsEditing(false);
      await reload();
    } catch (error) {
      console.warn('[Location] Failed to delete place:', error);
    }
  };

  const handleRowKeyDown = (event, index) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectPlace(index);
    }
  };

  const mapPlaces = places.map((place, index) => ({
    place,
    index,
    point: getMapPoint(place, index),
    coordsText: formatCoordinates(place, index),
  }));

  const activePoint = mapPlaces[activeIndex]?.point || { x: 500, y: 310 };

  // 镜头缩放与位移（加入安全边界限制，保证平移推镜时底图 100% 填满画面，绝不露出空白边缘）
  const ZOOM_SCALE = 1.32;
  const rawOffsetX = 500 - activePoint.x * ZOOM_SCALE;
  const rawOffsetY = 310 - activePoint.y * ZOOM_SCALE;

  // 边界约束：底图为 1200x744，可视区域 1000x620，推镜平移永远锁在安全覆盖区域内
  const mapOffsetX = Math.max(-280, Math.min(60, rawOffsetX));
  const mapOffsetY = Math.max(-170, Math.min(50, rawOffsetY));

  const routePoints = mapPlaces
    .map(({ point }) => `${point.x},${point.y}`)
    .join(' ');

  const canSave = Boolean(String(draftName || '').trim()) && !isSaving;

  return (
    <div
      className="place-booklet fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden select-none"
      style={{
        background: '#fbfbf8',
        color: '#11110f',
      }}
    >
      <style>{`
        .place-booklet {
          --place-ink: #11110f;
          --place-black: #0c0c0b;
          --place-white: #ffffff;
          --place-muted: #77766f;
          --place-soft: #aaa8a0;
          --place-line: rgba(17,17,15,.11);
          --place-wash: rgba(17,17,15,.05);
          --place-ease: cubic-bezier(.16, 1, .3, 1);
          --place-smooth: cubic-bezier(.4, 0, .2, 1);
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          isolation: isolate;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* 柔和环境光晕与质感噪点 */
        .place-booklet::before {
          content: "";
          position: absolute;
          z-index: -3;
          top: -180px;
          right: -130px;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          background: rgba(255,255,255,.96);
          filter: blur(40px);
          pointer-events: none;
        }

        .place-booklet::after {
          content: "";
          position: absolute;
          z-index: 30;
          inset: 0;
          pointer-events: none;
          opacity: .05;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='placeNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23placeNoise)' opacity='.22'/%3E%3C/svg%3E");
        }

        .place-booklet *,
        .place-booklet *::before,
        .place-booklet *::after {
          box-sizing: border-box;
        }

        /* 彻底修复按钮字体过大、样式被外部污染的问题 */
        .place-booklet button {
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .place-back-float,
        .place-edit-button,
        .place-edit-action {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          letter-spacing: .2px !important;
        }

        .place-back-float span,
        .place-edit-button span,
        .place-edit-action span {
          font-size: 11px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
        }

        /* 顶部悬浮返回按钮（极具弹性的微交互动效） */
        .place-back-float {
          position: absolute;
          z-index: 40;
          top: max(18px, env(safe-area-inset-top));
          left: 20px;
          display: inline-flex;
          height: 38px;
          align-items: center;
          gap: 6px;
          padding: 0 14px 0 10px;
          border-radius: 999px;
          color: var(--place-white);
          background: var(--place-black);
          box-shadow: 0 12px 28px rgba(0,0,0,.15), 0 3px 8px rgba(0,0,0,.08);
          transition: transform .5s var(--place-ease), background .3s ease, box-shadow .5s var(--place-ease);
        }

        .place-back-float:hover {
          background: #272724;
          box-shadow: 0 16px 36px rgba(0,0,0,.2), 0 4px 10px rgba(0,0,0,.1);
          transform: translateX(-3px) translateY(-2px);
        }

        .place-back-float:active {
          transform: translateX(-1px) scale(.95);
        }

        /* 主体滚动区 */
        .place-scroll {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 0 20px 100px;
          scrollbar-width: none;
          overscroll-behavior: contain;
          scroll-behavior: smooth;
        }

        .place-scroll::-webkit-scrollbar {
          display: none;
        }

        .place-container {
          max-width: 680px;
          margin: 0 auto;
          width: 100%;
        }

        /* 头部入场动效 */
        .place-intro {
          position: relative;
          padding: 92px 3px 34px;
          animation: placeIntroIn .85s var(--place-ease) both;
        }

        .place-intro::after {
          content: "MEMORY / 01";
          position: absolute;
          top: 130px;
          right: 0px;
          color: var(--place-muted);
          font-family: Georgia, serif;
          font-size: 8px;
          letter-spacing: 1.5px;
          transform: rotate(90deg);
          opacity: .6;
          pointer-events: none;
        }

        @keyframes placeIntroIn {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .place-kicker {
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--place-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .place-kicker::before {
          content: "";
          width: 24px;
          height: 1px;
          background: var(--place-ink);
          opacity: .7;
        }

        .place-main-title {
          margin-top: 16px;
          color: var(--place-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(38px, 11vw, 68px);
          font-weight: 400;
          letter-spacing: -3px;
          line-height: .95;
        }

        .place-main-title span,
        .place-main-title em {
          display: block;
        }

        .place-main-title em {
          padding-left: 20px;
          font-style: italic;
        }

        .place-intro-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px 14px;
          margin-top: 24px;
          color: var(--place-muted);
          font-size: 11px;
        }

        .place-intro-meta strong {
          color: var(--place-ink);
          font-weight: 700;
        }

        .place-meta-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--place-ink);
          opacity: .35;
        }

        /* 区域小标题动画 */
        .map-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 15px;
          margin: 0 2px 10px;
          animation: sectionIn .8s .1s var(--place-ease) both;
        }

        @keyframes sectionIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .map-heading-label {
          color: var(--place-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.8px;
          text-transform: uppercase;
        }

        .map-heading-place {
          max-width: 60%;
          overflow: hidden;
          color: var(--place-ink);
          font-family: Georgia, serif;
          font-size: 12px;
          font-style: italic;
          opacity: .75;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* 地图画框：严格充满设定区域，立体光影 */
        .map-frame {
          position: relative;
          height: min(62vw, 400px);
          min-height: 290px;
          overflow: hidden;
          isolation: isolate;
          border-radius: 16px;
          background: #d8d9d4;
          box-shadow:
            0 24px 44px -20px rgba(0,0,0,.35),
            0 1px 0 rgba(255,255,255,.6) inset;
          animation: mapReveal 1s .12s var(--place-ease) both;
        }

        @keyframes mapReveal {
          from {
            opacity: 0;
            transform: translateY(16px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .map-frame::after {
          content: "";
          position: absolute;
          z-index: 5;
          inset: 0;
          background:
            linear-gradient(135deg, rgba(255,255,255,.15), transparent 38%),
            radial-gradient(ellipse at center, transparent 40%, rgba(8,8,7,.25));
          pointer-events: none;
        }

        .map-svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        /* 核心！丝滑镜头平移与非线性缩放推镜 */
        .map-world {
          transform-origin: 0 0;
          transform: translate(var(--map-offset-x), var(--map-offset-y)) scale(${ZOOM_SCALE});
          transition: transform 1.1s var(--place-ease);
          will-change: transform;
        }

        /* 满铺底图样式 */
        .map-image {
          display: block;
          opacity: .94;
          filter: grayscale(1) contrast(.94) brightness(1.05);
          transition: opacity .6s ease, filter .8s ease;
        }

        .map-grid {
          opacity: .1;
        }

        /* 连线光流流动动画 */
        .map-route-line {
          animation: mapRouteMove 22s linear infinite;
          opacity: .7;
        }

        @keyframes mapRouteMove {
          from {
            stroke-dashoffset: 380;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        /* 标记点微交互 */
        .map-marker {
          cursor: pointer;
          transform-box: fill-box;
          transform-origin: center;
          transition: transform .65s var(--place-ease);
        }

        .map-marker:hover {
          transform: scale(1.15);
        }

        .map-marker.active {
          transform: scale(1.35);
        }

        /* 激活点双环脉冲动画 */
        .map-marker-pulse {
          animation: mapPulse 2.6s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        @keyframes mapPulse {
          0% {
            opacity: .6;
            transform: scale(.6);
          }
          70%, 100% {
            opacity: 0;
            transform: scale(2.2);
          }
        }

        /* 罗盘与比例尺 */
        .map-scale {
          position: absolute;
          right: 14px;
          bottom: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: #fff;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
          opacity: .75;
          text-shadow: 0 1px 4px rgba(0,0,0,.5);
        }

        .map-scale::before {
          content: "";
          display: block;
          width: 30px;
          height: 4px;
          border-top: 1px solid currentColor;
          border-right: 1px solid currentColor;
          border-left: 1px solid currentColor;
        }

        .map-compass {
          position: absolute;
          top: 14px;
          right: 14px;
          display: flex;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #fff;
          background: rgba(12,12,11,.6);
          box-shadow: 0 4px 12px rgba(0,0,0,.2);
          font-size: 9px;
          font-weight: 700;
          backdrop-filter: blur(4px);
        }

        .place-map-caption {
          position: absolute;
          z-index: 8;
          right: 15px;
          bottom: 14px;
          left: 15px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          color: #fff;
          pointer-events: none;
        }

        .place-map-caption small {
          display: block;
          margin-bottom: 4px;
          color: rgba(255,255,255,.75);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .place-map-caption strong {
          display: block;
          max-width: 220px;
          overflow: hidden;
          font-family: Georgia, serif;
          font-size: 19px;
          font-style: italic;
          font-weight: 400;
          text-overflow: ellipsis;
          text-shadow: 0 2px 10px rgba(0,0,0,.4);
          white-space: nowrap;
        }

        .map-note {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 2px 0;
          color: var(--place-muted);
          font-family: Georgia, serif;
          font-size: 10px;
          font-style: italic;
          animation: sectionIn .8s .22s var(--place-ease) both;
        }

        .map-note::before {
          content: "";
          width: 26px;
          height: 1px;
          background: var(--place-ink);
          opacity: .4;
        }

        .place-list-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 40px 2px 8px;
          animation: sectionIn .8s .28s var(--place-ease) both;
        }

        .place-list-heading span:first-child {
          color: var(--place-ink);
          font-family: Georgia, serif;
          font-size: 24px;
          font-weight: 400;
          letter-spacing: -.8px;
        }

        .place-list-heading span:last-child {
          color: var(--place-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.2px;
          opacity: .7;
        }

        /* 列表项极其丝滑的伸展动效 */
        .place-list {
          position: relative;
          padding-bottom: 10px;
          animation: sectionIn .8s .34s var(--place-ease) both;
        }

        .place-row {
          position: relative;
          display: grid;
          width: 100%;
          grid-template-columns: 34px minmax(0,1fr) 28px;
          align-items: center;
          gap: 12px;
          padding: 15px 4px;
          border-bottom: 1px solid var(--place-line);
          color: var(--place-ink);
          text-align: left;
          cursor: pointer;
          transition:
            padding .5s var(--place-ease),
            transform .4s var(--place-ease),
            background .4s ease;
        }

        .place-row::before {
          content: "";
          position: absolute;
          top: 8px;
          bottom: 8px;
          left: -12px;
          width: 3px;
          border-radius: 0 3px 3px 0;
          background: var(--place-black);
          opacity: 0;
          transform: scaleY(.3);
          transition: opacity .35s ease, transform .5s var(--place-ease);
        }

        .place-row:hover {
          transform: translateX(4px);
        }

        .place-row.active {
          padding-top: 21px;
          padding-bottom: 21px;
          background: linear-gradient(90deg, rgba(17,17,15,.045), transparent 75%);
        }

        .place-row.active::before {
          opacity: 1;
          transform: scaleY(1);
        }

        .place-row-marker {
          display: flex;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--place-muted);
          background: #fbfbf8;
          box-shadow: 0 0 0 4px #fbfbf8;
          transition: color .35s ease, background .35s ease, transform .5s var(--place-ease);
        }

        .place-row.active .place-row-marker {
          color: var(--place-white);
          background: var(--place-black);
          box-shadow: 0 0 0 4px #fbfbf8, 0 8px 18px -8px rgba(0,0,0,.6);
          transform: scale(1.1) rotate(-7deg);
        }

        .place-row-info {
          min-width: 0;
        }

        .place-row-name {
          overflow: hidden;
          color: var(--place-ink);
          font-family: Georgia, serif;
          font-size: 17px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-row-meta {
          margin-top: 4px;
          overflow: hidden;
          color: var(--place-muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-row-note {
          max-width: 90%;
          margin-top: 6px;
          overflow: hidden;
          color: #68665f;
          font-family: Georgia, serif;
          font-size: 11px;
          font-style: italic;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-delete {
          display: inline-flex;
          width: 28px;
          height: 28px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--place-muted);
          background: rgba(17,17,15,.05);
          opacity: .4;
          transition: opacity .3s ease, color .3s ease, background .3s ease, transform .4s var(--place-ease);
        }

        .place-delete:hover {
          color: #fff;
          background: #a13232;
          opacity: 1;
          transform: scale(1.12) rotate(6deg);
        }

        /* 底部操作区 */
        .place-footer {
          position: relative;
          z-index: 20;
          flex-shrink: 0;
          padding: 15px 20px calc(20px + env(safe-area-inset-bottom));
          background: linear-gradient(180deg, rgba(251,251,248,0), rgba(251,251,248,.96) 24%, #fbfbf8 55%);
        }

        .place-footer-inner {
          max-width: 680px;
          margin: 0 auto;
        }

        .place-footer-display {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }

        .place-footer-summary {
          min-width: 0;
          flex: 1;
        }

        .place-footer-summary > p {
          color: var(--place-muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .6px;
        }

        .place-footer-note {
          margin-top: 6px;
          overflow: hidden;
          color: var(--place-ink);
          font-family: Georgia, serif;
          font-size: 13px;
          font-style: italic;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* 编辑按钮动效 */
        .place-edit-button {
          display: inline-flex;
          height: 36px;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          padding: 0 16px;
          border-radius: 999px;
          color: var(--place-white);
          background: var(--place-black);
          box-shadow: 0 8px 20px -10px rgba(0,0,0,.6);
          transition: background .3s ease, box-shadow .4s var(--place-ease), transform .4s var(--place-ease);
        }

        .place-edit-button:hover {
          background: #272724;
          box-shadow: 0 12px 24px -8px rgba(0,0,0,.7);
          transform: translateY(-2px);
        }

        .place-edit-button:active {
          transform: scale(.95);
        }

        /* 编辑面板展开动效 */
        .place-edit-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 16px 18px;
          border-radius: 20px;
          color: var(--place-white);
          background: var(--place-black);
          box-shadow: 0 18px 45px -20px rgba(0,0,0,.6);
          animation: editPanelIn .55s var(--place-ease) both;
        }

        @keyframes editPanelIn {
          from {
            opacity: 0;
            transform: translateY(16px) scale(.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .place-edit-input,
        .place-edit-textarea {
          display: block;
          width: 100%;
          border: 0;
          border-bottom: 1px solid rgba(255,255,255,.2);
          outline: 0;
          color: var(--place-white);
          background: transparent;
          font-size: 13px;
        }

        .place-edit-input {
          padding: 6px 0 8px;
          font-weight: 700;
        }

        .place-edit-textarea {
          min-height: 44px;
          padding: 6px 0 8px;
          resize: none;
          font-family: Georgia, serif;
          font-size: 12px;
        }

        .place-edit-action {
          display: inline-flex;
          height: 32px;
          align-items: center;
          gap: 5px;
          padding: 0 12px;
          border-radius: 999px;
          color: rgba(255,255,255,.75);
          background: rgba(255,255,255,.1);
          transition: background .3s ease, transform .4s var(--place-ease);
        }

        .place-edit-action:hover {
          color: #fff;
          background: rgba(255,255,255,.18);
          transform: translateY(-1px);
        }

        .place-edit-action.save {
          color: var(--place-black);
          background: var(--place-white);
          font-weight: 800;
        }
      `}</style>

      {/* 顶部悬浮返回按钮 */}
      <button
        type="button"
        onClick={onBack}
        className="place-back-float"
        aria-label="返回上一页"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>返回</span>
      </button>

      {/* 主滚动区 */}
      <section className="place-scroll">
        <div className="place-container">
          <div className="place-intro">
            <div className="place-kicker">
              FIELD NOTES · MEMORY ATLAS
            </div>

            <h1 className="place-main-title">
              <span>一起走过的</span>
              <em>地方。</em>
            </h1>

            <div className="place-intro-meta">
              <strong>和 {character?.name || '伴侣'}</strong>
              <span className="place-meta-dot" />
              <span>{places.length} 个足迹</span>
              <span className="place-meta-dot" />
              <span className="text-[10px] tracking-wider opacity-60">PLACES WE KEPT</span>
            </div>
          </div>

          {isLoading && (
            <p className="py-16 text-center text-xs opacity-40">
              正在翻找记忆里的地点...
            </p>
          )}

          {!isLoading && places.length === 0 && (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center text-[#77766f]">
              <MapPin className="h-7 w-7 opacity-50" />
              <p className="font-serif text-xs italic">
                还没有留下足迹，等你们一起走过更多地方吧。
              </p>
            </div>
          )}

          {!isLoading && places.length > 0 && (
            <>
              <div className="map-heading">
                <span className="map-heading-label">
                  Places / Atlas
                </span>
                <span className="map-heading-place">
                  {activePlace?.name || '记忆地图'}
                </span>
              </div>

              {/* 地图画框：严格充满设定区域，并具备镜头平移动效与坐标美化 */}
              <div className="map-frame">
                <svg
                  className="map-svg"
                  viewBox="0 0 1000 620"
                  preserveAspectRatio="xMidYMid slice"
                  style={{
                    '--map-offset-x': `${mapOffsetX}px`,
                    '--map-offset-y': `${mapOffsetY}px`,
                  }}
                  aria-label="地点记忆地图"
                  role="img"
                >
                  <defs>
                    <pattern
                      id="mapGrid"
                      width="44"
                      height="44"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 44 0 L 0 0 0 44"
                        fill="none"
                        stroke="#6f746d"
                        strokeWidth="1"
                      />
                    </pattern>

                    <filter id="markerShadow">
                      <feDropShadow
                        dx="0"
                        dy="4"
                        stdDeviation="4"
                        floodColor="#11110f"
                        floodOpacity=".36"
                      />
                    </filter>
                  </defs>

                  {/* 核心！动效镜头推镜平移群组 */}
                  <g className="map-world">
                    {/* 全景超宽底图，彻底杜绝平移时边缘露白或只显示一半 */}
                    <image
                      className="map-image"
                      href={MAP_IMAGE_URL}
                      x="-100"
                      y="-60"
                      width="1200"
                      height="744"
                      preserveAspectRatio="xMidYMid slice"
                      aria-label="记忆地图底图"
                    />

                    <rect
                      className="map-grid"
                      x="-100"
                      y="-60"
                      width="1200"
                      height="744"
                      fill="url(#mapGrid)"
                    />

                    {/* 连线光流 */}
                    {routePoints && (
                      <polyline
                        className="map-route-line"
                        points={routePoints}
                        fill="none"
                        stroke="#11110f"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="8 8"
                      />
                    )}

                    {/* 地点坐标标记与高级 HUD 美化 */}
                    {mapPlaces.map(({ place, index, point, coordsText }) => {
                      const isActive = index === activeIndex;

                      return (
                        <g
                          key={place.id}
                          className={`map-marker ${isActive ? 'active' : ''}`}
                          transform={`translate(${point.x} ${point.y})`}
                          onClick={() => selectPlace(index)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              selectPlace(index);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`选择地点：${place.name}`}
                        >
                          {/* 激活状态：双层扩散雷达涟漪波纹 */}
                          {isActive && (
                            <>
                              <circle
                                className="map-marker-pulse"
                                r="28"
                                fill="#ffffff"
                                opacity=".4"
                              />
                              <circle
                                r="16"
                                fill="none"
                                stroke="#11110f"
                                strokeWidth="1"
                                strokeDasharray="3 3"
                                opacity="0.6"
                              />
                            </>
                          )}

                          {/* 标记阴影与主体 */}
                          <circle
                            r={isActive ? 16 : 11}
                            fill="#11110f"
                            opacity=".2"
                          />

                          <path
                            d="M0 -18 C-10 -18 -16 -10 -16 0 C-16 11 0 24 0 24 S16 11 16 0 C16 -10 10 -18 0 -18Z"
                            fill="#11110f"
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            filter="url(#markerShadow)"
                          />

                          <circle cy="-1" r="4.5" fill="#ffffff" />

                          {/* 激活状态：悬浮的大地测量 HUD 坐标铭牌 */}
                          {isActive && (
                            <g transform="translate(0, -28)">
                              <rect
                                x="-55"
                                y="-24"
                                width="110"
                                height="22"
                                rx="11"
                                fill="#0c0c0b"
                                fillOpacity="0.88"
                              />
                              <text
                                x="0"
                                y="-13"
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="8.5"
                                fontWeight="700"
                                letterSpacing="0.3"
                              >
                                {place.name?.slice(0, 8) || '坐标点'}
                              </text>
                              <text
                                x="0"
                                y="-5.5"
                                textAnchor="middle"
                                fill="#aaa8a0"
                                fontSize="6.5"
                                fontFamily="monospace"
                              >
                                {coordsText}
                              </text>
                              <polygon
                                points="0,0 -3.5,-3.5 3.5,-3.5"
                                fill="#0c0c0b"
                                fillOpacity="0.88"
                              />
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* 罗盘 */}
                <div className="map-compass">
                  <Compass className="h-4 w-4" />
                </div>

                {/* 比例尺 */}
                <div className="map-scale">
                  500 M
                </div>

                {/* 底部信息标题与计数器 */}
                <div className="place-map-caption">
                  <div>
                    <small>LAST TRACE / 最近足迹</small>
                    <strong>{activePlace?.name || '记忆地图'}</strong>
                  </div>

                  <span className="font-serif text-xs opacity-85">
                    {String(activeIndex + 1).padStart(2, '0')} / {String(places.length).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="map-note">
                <span>地图不会记得所有路，但会记得我们停留过的地方。</span>
                <span>↗</span>
              </div>

              <div className="place-list-heading">
                <span>足迹地点</span>
                <span>{String(places.length).padStart(2, '0')} LOCATIONS</span>
              </div>

              {/* 具备伸展展开动效的列表 */}
              <div className="place-list">
                {places.map((place, index) => (
                  <div
                    key={place.id}
                    className={`place-row ${index === activeIndex ? 'active' : ''}`}
                    onClick={() => selectPlace(index)}
                    onKeyDown={(event) => handleRowKeyDown(event, index)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={index === activeIndex}
                  >
                    <div className="place-row-marker">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>

                    <div className="place-row-info">
                      <p className="place-row-name">
                        {place.name || '未命名地点'}
                      </p>

                      <p className="place-row-meta">
                        {formatCoordinates(place, index)} · 到访 {place.visitCount || 1} 次 · 最近一次 {formatDate(place.lastVisitAt)}
                      </p>

                      {place.note && (
                        <p className="place-row-note">
                          {place.note}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(place.id);
                      }}
                      className="place-delete"
                      title="删除足迹"
                      aria-label={`删除地点：${place.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 底部固定面板 */}
      {activePlace && (
        <footer className="place-footer">
          <div className="place-footer-inner">
            {isEditing ? (
              <div className="place-edit-panel">
                <input
                  className="place-edit-input"
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="给这个地方取个名字"
                  maxLength={100}
                  autoFocus
                />

                <textarea
                  className="place-edit-textarea"
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                  placeholder="留一句只有你们知道的话..."
                  maxLength={1000}
                  rows={2}
                />

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="place-edit-action"
                    onClick={handleCancelEditing}
                    disabled={isSaving}
                  >
                    <X className="h-3 w-3" />
                    <span>取消</span>
                  </button>

                  <button
                    type="button"
                    className="place-edit-action save"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                  >
                    <Check className="h-3 w-3" />
                    <span>{isSaving ? '保存中...' : '保存'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="place-footer-display">
                <div className="place-footer-summary">
                  <p>
                    初次到访：{formatDate(activePlace.firstVisitAt)}
                  </p>
                  {activePlace.note ? (
                    <div className="place-footer-note">
                      {activePlace.note}
                    </div>
                  ) : (
                    <div className="place-footer-note text-[#aaa8a0]">
                      暂无备注回忆
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="place-edit-button"
                  onClick={handleStartEditing}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>编辑</span>
                </button>
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

export default PlaceBooklet;
