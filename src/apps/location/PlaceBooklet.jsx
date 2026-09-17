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

// 坐标映射：在 1000 x 620 的地图安全区域内映射点位
const getMapPoint = (place, index) => {
  const latitude = Number(place?.latitude ?? place?.lat);
  const longitude = Number(
    place?.longitude ?? place?.lng ?? place?.lon,
  );

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      x: 120 + ((longitude + 180) / 360) * 760,
      y: 80 + ((90 - latitude) / 180) * 460,
    };
  }

  const seed = hashString(place?.id || place?.name || index);
  return {
    x: 125 + ((seed * 37 + index * 113) % 750),
    y: 90 + ((seed * 19 + index * 71) % 440),
  };
};

// 经纬度精密刻度文字（用于坐标美化展示）
const formatCoordinates = (place, index) => {
  const latitude = Number(place?.latitude ?? place?.lat);
  const longitude = Number(place?.longitude ?? place?.lng ?? place?.lon);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lonDir = longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(latitude).toFixed(2)}°${latDir} / ${Math.abs(longitude).toFixed(2)}°${lonDir}`;
  }

  const seed = hashString(place?.id || place?.name || index);
  const pseudoLat = (24 + (seed % 280) / 10).toFixed(2);
  const pseudoLon = (108 + ((seed * 7) % 220) / 10).toFixed(2);
  return `${pseudoLat}°N / ${pseudoLon}°E`;
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
      setActiveIndex((previous) => (
        Math.min(previous, Math.max(list.length - 1, 0))
      ));
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

  const activePoint = mapPlaces[activeIndex]?.point || {
    x: 500,
    y: 310,
  };

  // 镜头漫游核心优化：底图缩放 1.36 倍，通过边界吸附（Clamping）确保底图无论如何都 100% 填满画面
  const MAP_SCALE = 1.36;
  const rawOffsetX = 500 - activePoint.x * MAP_SCALE;
  const rawOffsetY = 310 - activePoint.y * MAP_SCALE;
  
  // 限制偏移范围，防止相机滑动时把底图拖出边界造成“只显示一半”
  const maxMoveX = 1000 * (MAP_SCALE - 1);
  const maxMoveY = 620 * (MAP_SCALE - 1);
  const mapOffsetX = Math.max(-maxMoveX, Math.min(0, rawOffsetX));
  const mapOffsetY = Math.max(-maxMoveY, Math.min(0, rawOffsetY));

  const routePoints = mapPlaces
    .map(({ point }) => `${point.x},${point.y}`)
    .join(' ');

  const canSave = Boolean(String(draftName || '').trim()) && !isSaving;

  return (
    <div
      className="place-booklet fixed inset-0 z-[999] flex h-[100dvh] w-screen flex-col overflow-hidden"
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
          --place-line: rgba(17,17,15,.1);
          --place-wash: rgba(17,17,15,.04);
          --place-ease: cubic-bezier(.16,1,.3,1);
          --place-smooth: cubic-bezier(.4,0,.2,1);
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          isolation: isolate;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "SF Pro Display",
            "SF Pro Text",
            "Segoe UI",
            Roboto,
            "Noto Sans SC",
            sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* 顶部柔和日光氛围晕染 */
        .place-booklet::before {
          content: "";
          position: absolute;
          z-index: -2;
          top: -160px;
          right: -100px;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(251,251,248,0) 70%);
          filter: blur(40px);
          pointer-events: none;
        }

        /* 胶片颗粒手账质感噪点遮罩 */
        .place-booklet::after {
          content: "";
          position: absolute;
          z-index: 30;
          inset: 0;
          pointer-events: none;
          opacity: .045;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='placeNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23placeNoise)' opacity='.25'/%3E%3C/svg%3E");
        }

        .place-booklet * {
          box-sizing: border-box;
        }

        /* 修复返回按钮：强制精致小巧的纯黑胶囊设计 */
        .place-back-float {
          position: absolute;
          z-index: 50;
          top: max(16px, env(safe-area-inset-top));
          left: 20px;
          display: inline-flex !important;
          height: 36px !important;
          align-items: center;
          gap: 6px;
          padding: 0 14px 0 10px !important;
          border-radius: 999px !important;
          color: #ffffff !important;
          background: #0c0c0b !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          letter-spacing: .2px !important;
          box-shadow: 0 12px 28px rgba(0,0,0,.15), 0 3px 8px rgba(0,0,0,.06);
          cursor: pointer;
          transition: transform .5s var(--place-ease), background .3s ease, box-shadow .5s var(--place-ease);
        }

        .place-back-float span {
          font-size: 11px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
        }

        .place-back-float:hover {
          background: #252522 !important;
          box-shadow: 0 18px 36px rgba(0,0,0,.2), 0 4px 10px rgba(0,0,0,.08);
          transform: translateX(-3px) translateY(-2px);
        }

        .place-back-float:active {
          transform: translateX(-1px) scale(.95);
        }

        /* 滚动容器 */
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

        .place-inner-constraint {
          max-width: 660px;
          margin: 0 auto;
          width: 100%;
        }

        /* 抬头与印章丝滑入场 */
        .place-intro {
          position: relative;
          padding: 86px 2px 34px;
          animation: placeIntroIn .85s var(--place-ease) both;
        }

        .place-intro::before {
          content: "";
          position: absolute;
          top: 60px;
          right: -30px;
          width: 160px;
          height: 160px;
          border: 1px solid rgba(17,17,15,.09);
          border-radius: 50%;
          pointer-events: none;
        }

        .place-intro::after {
          content: "MEMORY / 01";
          position: absolute;
          top: 130px;
          right: 6px;
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
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .place-kicker {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--place-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .place-kicker::before {
          content: "";
          width: 22px;
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
          line-height: .94;
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
          gap: 8px 14px;
          margin-top: 24px;
          color: var(--place-muted);
          font-size: 11px;
        }

        .place-intro-meta strong {
          color: var(--place-ink);
          font-size: 12px;
          font-weight: 700;
        }

        .place-meta-dot {
          width: 3.5px;
          height: 3.5px;
          border-radius: 50%;
          background: var(--place-ink);
          opacity: .4;
        }

        .place-stamp {
          position: absolute;
          right: 2px;
          bottom: 28px;
          display: flex;
          width: 60px;
          height: 60px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(17,17,15,.3);
          border-radius: 50%;
          color: var(--place-muted);
          font-family: Georgia, serif;
          font-size: 8px;
          letter-spacing: 1px;
          line-height: 1.4;
          text-align: center;
          transform: rotate(11deg);
          opacity: .75;
          transition: transform .6s var(--place-ease);
        }

        .place-stamp:hover {
          transform: rotate(20deg) scale(1.05);
        }

        .place-stamp::before {
          content: "";
          position: absolute;
          inset: 4px;
          border: 1px dashed rgba(17,17,15,.25);
          border-radius: 50%;
        }

        /* 地图画框：严格充满整个区域，柔和裁切与撕纸胶带投影 */
        .map-frame {
          position: relative;
          height: min(64vw, 420px);
          min-height: 290px;
          overflow: hidden;
          isolation: isolate;
          background: #dcdfd8;
          border-radius: 20px;
          box-shadow:
            0 24px 50px -20px rgba(17,17,15,.25),
            0 0 0 1px rgba(17,17,15,.06);
          animation: mapReveal .9s .1s var(--place-ease) both;
        }

        @keyframes mapReveal {
          from {
            opacity: 0;
            transform: translateY(16px) scale(.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* 顶部装饰手账胶带 */
        .map-frame::before {
          content: "";
          position: absolute;
          z-index: 10;
          top: -10px;
          left: 50%;
          width: 100px;
          height: 26px;
          background: rgba(248,245,231,.7);
          backdrop-filter: blur(4px);
          box-shadow: 0 2px 6px rgba(0,0,0,.06);
          transform: translateX(-50%) rotate(-1.5deg);
          pointer-events: none;
        }

        /* 质感暗角 */
        .map-frame::after {
          content: "";
          position: absolute;
          z-index: 8;
          inset: 0;
          background:
            radial-gradient(ellipse at center, transparent 45%, rgba(12,12,11,.28) 100%),
            linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%);
          pointer-events: none;
        }

        .map-svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        /* 核心动效：1.1s cubic-bezier 电影级平滑推轨镜头漫游！ */
        .map-world {
          transform-origin: 0 0;
          transform: translate(var(--map-offset-x), var(--map-offset-y)) scale(var(--map-scale));
          transition: transform 1.1s var(--place-ease);
          will-change: transform;
        }

        /* 底图填满 */
        .map-image {
          display: block;
          width: 1000px;
          height: 620px;
          opacity: .94;
          filter: grayscale(1) contrast(.94) brightness(1.06);
          transition: filter .8s ease;
        }

        /* 航线流动发光虚线 */
        .map-route-line {
          stroke-dasharray: 8 7;
          animation: mapRouteMove 20s linear infinite;
        }

        @keyframes mapRouteMove {
          from {
            stroke-dashoffset: 300;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        /* 坐标图钉微动效 */
        .map-marker {
          cursor: pointer;
          transform-box: fill-box;
          transform-origin: center;
          transition: transform .6s var(--place-ease);
        }

        .map-marker:hover {
          transform: scale(1.15);
        }

        .map-marker.active {
          transform: scale(1.4);
        }

        /* 双层脉冲光圈波纹 */
        @keyframes mapPulse {
          0% {
            opacity: .6;
            transform: scale(.6);
          }
          70% {
            opacity: 0;
            transform: scale(2.4);
          }
          100% {
            opacity: 0;
            transform: scale(2.6);
          }
        }

        .map-marker-pulse {
          animation: mapPulse 2.6s cubic-bezier(0.24, 0, 0.38, 1) infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        .map-marker-pulse-second {
          animation: mapPulse 2.6s cubic-bezier(0.24, 0, 0.38, 1) infinite;
          animation-delay: 0.9s;
          transform-box: fill-box;
          transform-origin: center;
        }

        /* 坐标图钉标签 */
        .map-location-label {
          pointer-events: none;
          fill: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -.2px;
          paint-order: stroke fill;
          stroke: rgba(12,12,11,.6);
          stroke-width: 4px;
          stroke-linejoin: round;
        }

        /* 罗盘与比例尺 */
        .map-compass {
          position: absolute;
          z-index: 12;
          top: 16px;
          right: 16px;
          display: flex;
          width: 34px;
          height: 34px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #fff;
          background: rgba(12,12,11,.55);
          backdrop-filter: blur(8px);
          font-family: Georgia, serif;
          font-size: 10px;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(0,0,0,.15);
        }

        .map-compass::after {
          content: "";
          position: absolute;
          width: 1px;
          height: 13px;
          background: #fff;
          transform: rotate(42deg);
        }

        .map-scale {
          position: absolute;
          z-index: 12;
          right: 16px;
          bottom: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(255,255,255,.9);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
          text-shadow: 0 1px 4px rgba(0,0,0,.6);
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

        /* 地图底部当前足迹卡片 */
        .place-map-caption {
          position: absolute;
          z-index: 12;
          right: 16px;
          bottom: 16px;
          left: 16px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          color: #fff;
          pointer-events: none;
        }

        .place-map-caption small {
          display: block;
          margin-bottom: 3px;
          color: rgba(255,255,255,.75);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .place-map-caption strong {
          display: block;
          max-width: 260px;
          overflow: hidden;
          font-family: Georgia, serif;
          font-size: 20px;
          font-style: italic;
          font-weight: 400;
          text-overflow: ellipsis;
          text-shadow: 0 2px 10px rgba(0,0,0,.4);
          white-space: nowrap;
        }

        /* 列表项及丝滑触感 */
        .place-row {
          position: relative;
          display: grid;
          width: 100%;
          grid-template-columns: 34px minmax(0,1fr) 30px;
          align-items: center;
          gap: 12px;
          padding: 16px 8px;
          border-radius: 14px;
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
          top: 10px;
          bottom: 10px;
          left: -4px;
          width: 3px;
          border-radius: 4px;
          background: var(--place-black);
          opacity: 0;
          transform: scaleY(.3);
          transition:
            opacity .4s ease,
            transform .5s var(--place-ease);
        }

        .place-row:hover {
          transform: translateX(4px);
          background: rgba(17,17,15,.02);
        }

        .place-row.active {
          padding-top: 20px;
          padding-bottom: 20px;
          background: linear-gradient(90deg, rgba(17,17,15,.05) 0%, transparent 80%);
        }

        .place-row.active::before {
          opacity: 1;
          transform: scaleY(1);
        }

        .place-row-marker {
          display: flex;
          width: 34px;
          height: 34px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--place-muted);
          background: #f0f0ea;
          transition:
            color .35s ease,
            background .35s ease,
            transform .5s var(--place-ease);
        }

        .place-row.active .place-row-marker {
          color: var(--place-white);
          background: var(--place-black);
          box-shadow: 0 8px 20px -8px rgba(0,0,0,.6);
          transform: scale(1.1) rotate(-6deg);
        }

        .place-delete {
          display: inline-flex;
          width: 30px;
          height: 30px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--place-muted);
          background: rgba(17,17,15,.04);
          opacity: .5;
          cursor: pointer;
          transition:
            opacity .3s ease,
            color .3s ease,
            background .3s ease,
            transform .4s var(--place-ease);
        }

        .place-delete:hover {
          color: #fff;
          background: #a83232;
          opacity: 1;
          transform: scale(1.12) rotate(6deg);
        }

        /* 底部固定操作栏 */
        .place-footer {
          position: relative;
          z-index: 40;
          flex-shrink: 0;
          padding: 14px 20px calc(16px + env(safe-area-inset-bottom));
          background: linear-gradient(180deg, rgba(251,251,248,0.85) 0%, #fbfbf8 40%);
          backdrop-filter: blur(12px);
          border-top: 1px solid rgba(17,17,15,.06);
        }

        /* 修复编辑按钮：极简小黑胶囊 */
        .place-edit-button {
          display: inline-flex !important;
          height: 36px !important;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          padding: 0 16px !important;
          border-radius: 999px !important;
          color: #ffffff !important;
          background: #0c0c0b !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          letter-spacing: .2px !important;
          box-shadow: 0 8px 20px -8px rgba(0,0,0,.6);
          cursor: pointer;
          transition: background .3s ease, box-shadow .4s var(--place-ease), transform .4s var(--place-ease);
        }

        .place-edit-button span {
          font-size: 11px !important;
          font-weight: 700 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
        }

        .place-edit-button:hover {
          background: #252522 !important;
          box-shadow: 0 12px 24px -8px rgba(0,0,0,.7);
          transform: translateY(-2px);
        }

        .place-edit-button:active {
          transform: scale(.95);
        }

        /* 编辑面板展开动画 */
        .place-edit-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 16px 18px;
          border-radius: 20px;
          color: #fff;
          background: #0c0c0b;
          box-shadow: 0 20px 45px -20px rgba(0,0,0,.6);
          animation: editPanelIn .6s var(--place-ease) both;
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
      `}</style>

      {/* 顶部悬浮返回按钮（极简小巧圆润质感） */}
      <button
        type="button"
        onClick={onBack}
        className="place-back-float"
        aria-label="返回上一页"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>返回</span>
      </button>

      {/* 主滑动区域 */}
      <section className="place-scroll">
        <div className="place-inner-constraint">
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
              <span className="opacity-70 font-mono text-[10px]">PLACES WE KEPT</span>
            </div>

            <div className="place-stamp">
              WANDER
              <br />
              TOGETHER
            </div>
          </div>

          {isLoading && (
            <p className="py-16 text-center text-xs text-[#77766f]">
              正在翻找记忆里的地点...
            </p>
          )}

          {!isLoading && places.length === 0 && (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center text-[#77766f]">
              <MapPin className="h-8 w-8 stroke-1 opacity-60" />
              <p className="font-serif text-xs italic">
                还没有留下足迹，等你们一起走过更多地方吧。
              </p>
            </div>
          )}

          {!isLoading && places.length > 0 && (
            <>
              {/* 地图小标头 */}
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="text-[9px] font-extrabold tracking-[1.8px] uppercase text-[#77766f]">
                  Places / Atlas
                </span>
                <span className="font-mono text-[10px] text-[#77766f] truncate max-w-[50%]">
                  {activeMapItem?.coordsText}
                </span>
              </div>

              {/* 地图画框：严格充满整个区域，包含平滑推轨漫游动效 */}
              <div className="map-frame">
                <svg
                  className="map-svg"
                  viewBox="0 0 1000 620"
                  preserveAspectRatio="xMidYMid slice"
                  style={{
                    '--map-offset-x': `${mapOffsetX}px`,
                    '--map-offset-y': `${mapOffsetY}px`,
                    '--map-scale': MAP_SCALE,
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
                        strokeWidth="0.8"
                      />
                    </pattern>

                    <filter id="markerShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow
                        dx="0"
                        dy="5"
                        stdDeviation="5"
                        floodColor="#000000"
                        floodOpacity=".4"
                      />
                    </filter>
                  </defs>

                  {/* 随选择丝滑平移的镜头层 */}
                  <g className="map-world">
                    {/* 地图底图（始终充满画布） */}
                    <image
                      className="map-image"
                      href={MAP_IMAGE_URL}
                      x="0"
                      y="0"
                      width="1000"
                      height="620"
                      preserveAspectRatio="xMidYMid slice"
                    />

                    {/* 坐标微网格 */}
                    <rect
                      x="0"
                      y="0"
                      width="1000"
                      height="620"
                      fill="url(#mapGrid)"
                      opacity="0.12"
                    />

                    {/* 流动的足迹连线 */}
                    {routePoints && (
                      <polyline
                        className="map-route-line"
                        points={routePoints}
                        fill="none"
                        stroke="#11110f"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity=".75"
                      />
                    )}

                    {/* 坐标标记与大地测量美化 */}
                    {mapPlaces.map(({ place, index, point, coordsText }) => {
                      const isActive = index === activeIndex;

                      return (
                        <g
                          key={place.id}
                          className={`map-marker ${isActive ? 'active' : ''}`}
                          transform={`translate(${point.x} ${point.y})`}
                          onClick={() => selectPlace(index)}
                          role="button"
                          tabIndex="0"
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
                                className="map-marker-pulse-second"
                                r="28"
                                fill="#ffffff"
                                opacity=".3"
                              />
                              <circle
                                r="18"
                                fill="none"
                                stroke="#11110f"
                                strokeWidth="1"
                                strokeDasharray="3 3"
                                opacity=".6"
                              />
                            </>
                          )}

                          {/* 投影底圈 */}
                          <circle
                            r={isActive ? 16 : 12}
                            fill="#11110f"
                            opacity=".2"
                          />

                          {/* 精雕大地 Pin 针标 */}
                          <path
                            d="M0 -18 C-10 -18 -17 -10 -17 0 C-17 11 0 24 0 24 S17 11 17 0 C17 -10 10 -18 0 -18Z"
                            fill="#11110f"
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            filter="url(#markerShadow)"
                          />

                          <circle cy="0" r="4.5" fill="#ffffff" />

                          {/* 激活点悬浮经纬度铭牌 */}
                          {isActive && (
                            <g transform="translate(0, -28)">
                              <text
                                className="map-location-label"
                                x="0"
                                y="-8"
                                textAnchor="middle"
                              >
                                {place.name}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* 复古罗盘 */}
                <div className="map-compass">
                  N
                </div>

                {/* 比例尺 */}
                <div className="map-scale">
                  500 M
                </div>

                {/* 底部信息标签 */}
                <div className="place-map-caption">
                  <div>
                    <small>CURRENT TRACE / 聚焦点</small>
                    <strong>{activePlace?.name || '记忆地图'}</strong>
                  </div>

                  <span className="font-mono text-[11px] opacity-85">
                    {String(activeIndex + 1).padStart(2, '0')} / {String(places.length).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* 列表小标头 */}
              <div className="mt-9 mb-2 flex items-center justify-between px-1">
                <span className="font-serif text-2xl text-[#11110f]">
                  足迹地点
                </span>
                <span className="text-[9px] font-extrabold tracking-widest text-[#77766f]">
                  {String(places.length).padStart(2, '0')} LOCATIONS
                </span>
              </div>

              {/* 互动足迹列表 */}
              <div className="divide-y divide-[#11110f]/10 pb-4">
                {places.map((place, index) => (
                  <div
                    key={place.id}
                    className={`place-row ${index === activeIndex ? 'active' : ''}`}
                    onClick={() => selectPlace(index)}
                    onKeyDown={(e) => handleRowKeyDown(e, index)}
                    role="button"
                    tabIndex="0"
                  >
                    <div className="place-row-marker">
                      <MapPin className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 pr-1">
                      <p className="truncate font-serif text-[17px] text-[#11110f]">
                        {place.name || '未命名地点'}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-[#77766f]">
                        {formatCoordinates(place, index)} · 到访 {place.visitCount || 1} 次 · 最近 {formatDate(place.lastVisitAt)}
                      </p>
                      {place.note && (
                        <p className="mt-1 truncate font-serif text-xs italic text-[#5f5d56]">
                          "{place.note}"
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(place.id);
                      }}
                      className="place-delete"
                      title="忘记这个地方"
                      aria-label={`删除地点：${place.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 底部固定操作栏 */}
      {activePlace && (
        <footer className="place-footer">
          <div className="place-inner-constraint">
            {isEditing ? (
              <div className="place-edit-panel">
                <label className="text-[9px] font-bold tracking-wider text-white/50 uppercase">
                  地点名称
                </label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="给这个地方取个名字"
                  className="w-full border-b border-white/20 bg-transparent py-1 text-sm font-bold text-white outline-none focus:border-white"
                  maxLength={100}
                  autoFocus
                />

                <label className="mt-1 text-[9px] font-bold tracking-wider text-white/50 uppercase">
                  共同备注
                </label>
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="留一句只有你们知道的话..."
                  rows={2}
                  className="w-full resize-none border-b border-white/20 bg-transparent py-1 font-serif text-xs italic text-white/90 outline-none focus:border-white"
                  maxLength={1000}
                />

                <div className="mt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    disabled={isSaving}
                    className="flex h-8 items-center gap-1 rounded-full bg-white/10 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>取消</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                    className="flex h-8 items-center gap-1 rounded-full bg-white px-4 text-xs font-bold text-[#0c0c0b] transition-transform hover:bg-white/90 active:scale-95 disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isSaving ? '保存中...' : '保存'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold tracking-wider text-[#77766f]">
                    初次到访：{formatDate(activePlace.firstVisitAt)}
                  </p>
                  {activePlace.note ? (
                    <p className="mt-0.5 truncate font-serif text-xs italic text-[#11110f]">
                      "{activePlace.note}"
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-[#aaa8a0]">
                      暂无专属回忆备注
                    </p>
                  )}
                </div>

                {/* 编辑按钮（精致黑胶囊） */}
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="place-edit-button"
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
