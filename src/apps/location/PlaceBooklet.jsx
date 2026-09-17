import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
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

const getMapPoint = (place, index) => {
  const latitude = Number(place?.latitude ?? place?.lat);
  const longitude = Number(
    place?.longitude
    ?? place?.lng
    ?? place?.lon,
  );

  if (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
  ) {
    return {
      x: 120 + ((longitude + 180) / 360) * 760,
      y: 80 + ((90 - latitude) / 180) * 460,
    };
  }

  const seed = hashString(place?.id || place?.name || index);

  return {
    x: 115 + ((seed * 37 + index * 113) % 770),
    y: 90 + ((seed * 19 + index * 71) % 390),
  };
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
    setIsEditing(true);
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
  }));

  const activePoint = mapPlaces[activeIndex]?.point || {
    x: 500,
    y: 310,
  };

  const mapOffsetX = 500 - activePoint.x * 1.34;
  const mapOffsetY = 310 - activePoint.y * 1.34;

  const routePoints = mapPlaces
    .map(({ point }) => `${point.x},${point.y}`)
    .join(' ');

  const canSave = Boolean(String(draftName || '').trim()) && !isSaving;

  return (
    <div
      className="place-booklet fixed inset-0 z-50 flex h-[100dvh] w-full flex-col"
      style={{
        background: '#fbfbf8',
        color: '#11110f',
      }}
    >
      <style>{`
        .place-booklet {
          --place-ink: #11110f;
          --place-black: #0c0c0b;
          --place-white: #fff;
          --place-muted: #77766f;
          --place-soft: #aaa8a0;
          --place-line: rgba(17,17,15,.12);
          --place-wash: rgba(17,17,15,.055);
          --place-ease: cubic-bezier(.16,1,.3,1);
          --place-smooth: cubic-bezier(.4,0,.2,1);
          --accent-color: #11110f;
          --accent-foreground: #fff;
          position: relative;
          isolation: isolate;
          overflow: hidden;
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

        .place-booklet::before {
          content: "";
          position: absolute;
          z-index: -3;
          top: -180px;
          right: -130px;
          width: 450px;
          height: 450px;
          border-radius: 50%;
          background: rgba(255,255,255,.95);
          filter: blur(35px);
          pointer-events: none;
        }

        .place-booklet::after {
          content: "";
          position: absolute;
          z-index: 30;
          inset: 0;
          pointer-events: none;
          opacity: .055;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='placeNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23placeNoise)' opacity='.2'/%3E%3C/svg%3E");
        }

        .place-booklet *,
        .place-booklet *::before,
        .place-booklet *::after {
          box-sizing: border-box;
        }

        .place-booklet button,
        .place-booklet input,
        .place-booklet textarea {
          font: inherit;
        }

        .place-booklet button {
          border: 0;
        }

        .place-booklet button:focus-visible,
        .place-booklet input:focus-visible,
        .place-booklet textarea:focus-visible {
          outline: 2px solid var(--place-ink);
          outline-offset: 3px;
        }

        .place-back-float {
          position: absolute;
          z-index: 20;
          top: max(18px, env(safe-area-inset-top));
          left: 20px;
          display: inline-flex;
          min-height: 40px;
          align-items: center;
          gap: 7px;
          padding: 0 15px 0 11px;
          border-radius: 999px;
          color: var(--place-white);
          background: var(--place-black);
          box-shadow:
            0 14px 32px rgba(0,0,0,.16),
            0 3px 8px rgba(0,0,0,.08);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .1px;
          cursor: pointer;
          transition:
            transform .5s var(--place-ease),
            background .3s ease,
            box-shadow .5s var(--place-ease);
        }

        .place-back-float:hover {
          background: #292926;
          box-shadow:
            0 19px 38px rgba(0,0,0,.22),
            0 5px 12px rgba(0,0,0,.1);
          transform: translateX(-4px) translateY(-2px);
        }

        .place-back-float:active {
          transform: translateX(-2px) scale(.94);
        }

        .place-scroll {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 0 22px 105px;
          scrollbar-width: none;
          overscroll-behavior: contain;
          scroll-behavior: smooth;
        }

        .place-scroll::-webkit-scrollbar {
          display: none;
        }

        .place-intro {
          position: relative;
          padding: 104px 3px 40px;
          animation: placeIntroIn .85s var(--place-ease) both;
        }

        .place-intro::before {
          content: "";
          position: absolute;
          top: 76px;
          right: -42px;
          width: 170px;
          height: 170px;
          border: 1px solid rgba(17,17,15,.1);
          border-radius: 50%;
          opacity: .75;
          pointer-events: none;
        }

        .place-intro::after {
          content: "MEMORY / 01";
          position: absolute;
          top: 143px;
          right: -4px;
          color: var(--place-muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 8px;
          letter-spacing: 1.5px;
          transform: rotate(90deg);
          opacity: .7;
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
          width: 25px;
          height: 1px;
          background: var(--place-ink);
          opacity: .8;
        }

        .place-main-title {
          max-width: 420px;
          margin-top: 19px;
          color: var(--place-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(43px, 12vw, 76px);
          font-weight: 400;
          letter-spacing: -4px;
          line-height: .92;
        }

        .place-main-title span,
        .place-main-title em {
          display: block;
        }

        .place-main-title em {
          padding-left: 22px;
          font-style: italic;
        }

        .place-intro-meta {
          display: flex;
          max-width: calc(100% - 80px);
          align-items: center;
          flex-wrap: wrap;
          gap: 10px 15px;
          margin-top: 27px;
          color: var(--place-muted);
          font-size: 10px;
        }

        .place-intro-meta strong {
          color: var(--place-ink);
          font-size: 12px;
          font-weight: 750;
        }

        .place-meta-dot {
          width: 4px;
          height: 4px;
          flex: 0 0 4px;
          border-radius: 50%;
          background: var(--place-ink);
          opacity: .42;
        }

        .place-stamp {
          position: absolute;
          right: 3px;
          bottom: 34px;
          display: flex;
          width: 62px;
          height: 62px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(17,17,15,.34);
          border-radius: 50%;
          color: var(--place-muted);
          font-family: Georgia, serif;
          font-size: 8px;
          letter-spacing: 1px;
          line-height: 1.4;
          text-align: center;
          transform: rotate(11deg);
          opacity: .7;
        }

        .place-stamp::before {
          content: "";
          position: absolute;
          inset: 5px;
          border: 1px dashed rgba(17,17,15,.28);
          border-radius: 50%;
        }

        .map-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 15px;
          margin: 1px 2px 12px;
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
          opacity: .62;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .map-frame {
          position: relative;
          height: min(64vw, 430px);
          min-height: 300px;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(circle at 25% 20%, #f4f4ef, transparent 28%),
            linear-gradient(135deg, #d7dad4, #929790);
          clip-path: polygon(
            0 1%,
            99.4% 0,
            100% 98.8%,
            .5% 100%
          );
          box-shadow:
            0 28px 48px -30px rgba(0,0,0,.58),
            inset 0 1px 0 rgba(255,255,255,.65);
          animation: mapReveal 1s .12s var(--place-ease) both;
        }

        @keyframes mapReveal {
          from {
            opacity: 0;
            transform: translateY(18px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .map-frame::before {
          content: "";
          position: absolute;
          z-index: 4;
          top: -12px;
          left: 50%;
          width: 112px;
          height: 30px;
          background: rgba(248,245,231,.62);
          box-shadow: 0 2px 5px rgba(0,0,0,.08);
          transform: translateX(-50%) rotate(-2deg);
          pointer-events: none;
        }

        .map-frame::after {
          content: "";
          position: absolute;
          z-index: 5;
          inset: 0;
          background:
            linear-gradient(
              135deg,
              rgba(255,255,255,.2),
              transparent 38%
            ),
            linear-gradient(
              0deg,
              rgba(9,9,8,.3),
              transparent 34%
            ),
            radial-gradient(
              ellipse at center,
              transparent 42%,
              rgba(8,8,7,.24)
            );
          pointer-events: none;
        }

        .map-svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        .map-world {
          transform-origin: 0 0;
          transform:
            translate(var(--map-offset-x), var(--map-offset-y))
            scale(1.34);
          transition: transform 1.1s var(--place-ease);
          will-change: transform;
        }

        .map-image {
          display: block;
          width: 1000px;
          height: 620px;
          opacity: .92;
          filter: grayscale(1) contrast(.93) brightness(1.08);
          transition:
            opacity .6s ease,
            filter .8s ease;
        }

        .map-frame:hover .map-image {
          opacity: .98;
          filter: grayscale(1) contrast(1) brightness(1.04);
        }

        .map-grid {
          opacity: .12;
        }

        .map-route-line {
          animation: mapRouteMove 24s linear infinite;
          opacity: .78;
        }

        @keyframes mapRouteMove {
          from {
            stroke-dashoffset: 380;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        .map-marker {
          cursor: pointer;
          transform-box: fill-box;
          transform-origin: center;
          transition: transform .65s var(--place-ease);
        }

        .map-marker:hover {
          transform: scale(1.18);
        }

        .map-marker.active {
          transform: scale(1.5);
        }

        .map-marker-pulse {
          animation: mapPulse 2.8s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        @keyframes mapPulse {
          0% {
            opacity: .48;
            transform: scale(.65);
          }
          70%,
          100% {
            opacity: 0;
            transform: scale(1.85);
          }
        }

        .map-location-label {
          pointer-events: none;
          fill: #fff;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          font-size: 15px;
          font-weight: 750;
          letter-spacing: -.2px;
          paint-order: stroke;
          stroke: rgba(0,0,0,.5);
          stroke-width: 5px;
          stroke-linejoin: round;
        }

        .map-scale {
          position: absolute;
          right: 15px;
          bottom: 15px;
          display: flex;
          align-items: center;
          gap: 7px;
          color: #fff;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
          opacity: .7;
          text-shadow: 0 1px 5px rgba(0,0,0,.45);
        }

        .map-scale::before {
          content: "";
          display: block;
          width: 34px;
          height: 5px;
          border-top: 1px solid currentColor;
          border-right: 1px solid currentColor;
          border-left: 1px solid currentColor;
        }

        .map-compass {
          position: absolute;
          top: 17px;
          right: 17px;
          display: flex;
          width: 34px;
          height: 34px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #fff;
          background: rgba(12,12,11,.55);
          box-shadow: 0 5px 14px rgba(0,0,0,.16);
          font-family: Georgia, serif;
          font-size: 10px;
          font-weight: 700;
          opacity: .8;
        }

        .map-compass::after {
          content: "";
          position: absolute;
          width: 1px;
          height: 13px;
          background: #fff;
          transform: rotate(42deg);
        }

        .place-map-caption {
          position: absolute;
          z-index: 8;
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
          margin-bottom: 5px;
          color: rgba(255,255,255,.7);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .place-map-caption strong {
          display: block;
          max-width: 230px;
          overflow: hidden;
          font-family: Georgia, serif;
          font-size: 21px;
          font-style: italic;
          font-weight: 400;
          text-overflow: ellipsis;
          text-shadow: 0 2px 12px rgba(0,0,0,.3);
          white-space: nowrap;
        }

        .place-map-counter {
          color: rgba(255,255,255,.82);
          font-family: Georgia, serif;
          font-size: 11px;
          white-space: nowrap;
        }

        .map-note {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 3px 0;
          color: var(--place-muted);
          font-family: Georgia, serif;
          font-size: 10px;
          font-style: italic;
          line-height: 1.5;
          animation: sectionIn .8s .25s var(--place-ease) both;
        }

        .map-note::before {
          content: "";
          width: 29px;
          height: 1px;
          flex: 0 0 29px;
          background: var(--place-ink);
          opacity: .5;
        }

        .place-list-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 48px 2px 9px;
          animation: sectionIn .8s .3s var(--place-ease) both;
        }

        .place-list-heading span:first-child {
          color: var(--place-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 27px;
          font-weight: 400;
          letter-spacing: -1.1px;
        }

        .place-list-heading span:last-child {
          color: var(--place-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.3px;
          opacity: .72;
        }

        .place-list {
          position: relative;
          padding-bottom: 8px;
          animation: sectionIn .8s .38s var(--place-ease) both;
        }

        .place-list::before {
          content: "";
          position: absolute;
          top: 13px;
          bottom: 17px;
          left: 17px;
          width: 1px;
          background: linear-gradient(
            var(--place-ink),
            rgba(17,17,15,.08)
          );
          opacity: .28;
        }

        .place-row {
          position: relative;
          display: grid;
          width: 100%;
          grid-template-columns: 35px minmax(0,1fr) 29px;
          align-items: center;
          gap: 13px;
          padding: 17px 2px 18px;
          border-bottom: 1px solid var(--place-line);
          color: var(--place-ink);
          text-align: left;
          cursor: pointer;
          transition:
            padding .6s var(--place-ease),
            transform .45s var(--place-ease),
            background .45s ease;
        }

        .place-row::before {
          content: "";
          position: absolute;
          top: 9px;
          bottom: 9px;
          left: -22px;
          width: 3px;
          border-radius: 0 4px 4px 0;
          background: var(--place-black);
          opacity: 0;
          transform: scaleY(.35);
          transition:
            opacity .4s ease,
            transform .6s var(--place-ease);
        }

        .place-row:hover {
          transform: translateX(4px);
        }

        .place-row:focus-visible {
          outline: 2px solid var(--place-ink);
          outline-offset: 3px;
        }

        .place-row.active {
          padding-top: 23px;
          padding-bottom: 23px;
          background:
            linear-gradient(
              90deg,
              rgba(17,17,15,.055),
              transparent 72%
            );
        }

        .place-row.active::before {
          opacity: 1;
          transform: scaleY(1);
        }

        .place-row-marker {
          position: relative;
          z-index: 2;
          display: flex;
          width: 34px;
          height: 34px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--place-muted);
          background: #fbfbf8;
          box-shadow: 0 0 0 5px #fbfbf8;
          transition:
            color .35s ease,
            background .35s ease,
            transform .5s var(--place-ease);
        }

        .place-row.active .place-row-marker {
          color: var(--place-white);
          background: var(--place-black);
          box-shadow:
            0 0 0 5px #fbfbf8,
            0 10px 22px -12px rgba(0,0,0,.7);
          transform: scale(1.12) rotate(-7deg);
        }

        .place-row-info {
          min-width: 0;
        }

        .place-row-name {
          overflow: hidden;
          color: var(--place-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 18px;
          font-weight: 400;
          letter-spacing: -.45px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-row-meta {
          margin-top: 5px;
          overflow: hidden;
          color: var(--place-muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .55px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-row-note {
          max-width: 92%;
          margin-top: 8px;
          overflow: hidden;
          color: #68665f;
          font-family: Georgia, serif;
          font-size: 11px;
          font-style: italic;
          line-height: 1.45;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-delete {
          display: inline-flex;
          width: 29px;
          height: 29px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--place-muted);
          background: rgba(17,17,15,.055);
          opacity: .42;
          cursor: pointer;
          transition:
            opacity .3s ease,
            color .3s ease,
            background .3s ease,
            transform .4s var(--place-ease);
        }

        .place-delete:hover {
          color: #fff;
          background: #9c3434;
          opacity: 1;
          transform: scale(1.1) rotate(7deg);
        }

        .place-delete:active {
          transform: scale(.9);
        }

        .place-delete:focus-visible {
          outline: 2px solid #9c3434;
          outline-offset: 2px;
          opacity: 1;
        }

        .place-empty-state {
          display: flex;
          min-height: 58vh;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 15px;
          color: var(--place-muted);
          text-align: center;
          animation: placeIntroIn .8s var(--place-ease) both;
        }

        .place-empty-state::before {
          content: "⌁";
          display: block;
          color: var(--place-ink);
          font-family: Georgia, serif;
          font-size: 48px;
          line-height: .7;
          opacity: .7;
        }

        .place-empty-state svg {
          display: none;
        }

        .place-empty-state p {
          max-width: 230px;
          font-family: Georgia, serif;
          font-size: 11px;
          font-style: italic;
          line-height: 1.7;
          opacity: .75;
        }

        .place-footer {
          position: relative;
          z-index: 10;
          flex-shrink: 0;
          padding: 17px 22px calc(23px + env(safe-area-inset-bottom));
          background:
            linear-gradient(
              180deg,
              rgba(251,251,248,0),
              rgba(251,251,248,.94) 25%,
              #fbfbf8 57%
            );
        }

        .place-footer::before {
          content: "";
          display: block;
          width: 36px;
          height: 2px;
          margin-bottom: 13px;
          border-radius: 999px;
          background: var(--place-black);
          opacity: .78;
        }

        .place-footer-display {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 17px;
        }

        .place-footer-summary {
          min-width: 0;
          flex: 1;
        }

        .place-footer-summary > p {
          color: var(--place-muted);
          font-size: 9px;
          font-weight: 750;
          letter-spacing: .7px;
        }

        .place-footer-note {
          max-width: 100%;
          margin-top: 7px;
          overflow: hidden;
          color: var(--place-ink);
          font-family: Georgia, serif;
          font-size: 13px;
          font-style: italic;
          line-height: 1.5;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-edit-button {
          display: inline-flex;
          min-height: 39px;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
          padding: 0 15px;
          border-radius: 999px;
          color: var(--place-white);
          background: var(--place-black);
          box-shadow: 0 10px 23px -13px rgba(0,0,0,.7);
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
          transition:
            background .3s ease,
            box-shadow .45s var(--place-ease),
            transform .45s var(--place-ease);
        }

        .place-edit-button:hover {
          background: #292926;
          box-shadow: 0 15px 27px -12px rgba(0,0,0,.75);
          transform: translateY(-3px);
        }

        .place-edit-button:active {
          transform: scale(.94);
        }

        .place-edit-panel {
          display: flex;
          flex-direction: column;
          gap: 11px;
          padding: 19px 19px 18px;
          border-radius: 22px;
          color: var(--place-white);
          background: var(--place-black);
          box-shadow:
            0 21px 50px -26px rgba(0,0,0,.7),
            0 4px 16px rgba(0,0,0,.12);
          animation: editPanelIn .65s var(--place-ease) both;
        }

        @keyframes editPanelIn {
          from {
            opacity: 0;
            transform: translateY(18px) scale(.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .place-edit-label {
          display: block;
          color: rgba(255,255,255,.48);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
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
          font-family: inherit;
          font-size: 14px;
          line-height: 1.5;
          transition:
            border-color .35s ease,
            background .35s ease;
        }

        .place-edit-input {
          padding: 7px 0 9px;
          font-weight: 700;
        }

        .place-edit-textarea {
          min-height: 48px;
          padding: 7px 0 9px;
          resize: vertical;
          font-family: Georgia, serif;
          font-size: 12px;
        }

        .place-edit-input:focus,
        .place-edit-textarea:focus {
          border-bottom-color: rgba(255,255,255,.86);
        }

        .place-edit-input::placeholder,
        .place-edit-textarea::placeholder {
          color: rgba(255,255,255,.38);
        }

        .place-edit-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          padding-top: 3px;
        }

        .place-edit-action {
          display: inline-flex;
          min-height: 35px;
          align-items: center;
          gap: 5px;
          padding: 0 12px;
          border-radius: 999px;
          color: rgba(255,255,255,.72);
          background: rgba(255,255,255,.1);
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
          transition:
            color .3s ease,
            background .3s ease,
            transform .4s var(--place-ease);
        }

        .place-edit-action:hover {
          color: #fff;
          background: rgba(255,255,255,.18);
          transform: translateY(-2px);
        }

        .place-edit-action:active {
          transform: scale(.94);
        }

        .place-edit-action.save {
          color: var(--place-black);
          background: var(--place-white);
          font-weight: 800;
        }

        .place-edit-action.save:hover {
          background: #e8e8e3;
        }

        .place-edit-action.save:disabled {
          cursor: not-allowed;
          opacity: .35;
          transform: none;
        }

        @media (min-width: 700px) {
          .place-booklet {
            width: min(100%, 700px);
            min-height: calc(100dvh - 36px);
            max-height: calc(100dvh - 36px);
            margin: 18px auto;
            box-shadow:
              0 32px 90px rgba(0,0,0,.2),
              0 0 0 1px rgba(17,17,15,.04);
          }

          .place-scroll {
            padding-right: 28px;
            padding-left: 28px;
          }

          .place-back-float {
            left: 25px;
          }

          .place-intro {
            padding-right: 5px;
            padding-left: 5px;
          }

          .place-footer {
            padding-right: 28px;
            padding-left: 28px;
          }
        }

        @media (max-width: 420px) {
          .place-scroll {
            padding-right: 18px;
            padding-left: 18px;
          }

          .place-back-float {
            left: 17px;
          }

          .place-intro {
            padding-top: 98px;
            padding-bottom: 35px;
          }

          .place-main-title {
            font-size: clamp(42px, 13vw, 62px);
          }

          .place-intro-meta {
            max-width: calc(100% - 58px);
          }

          .place-stamp {
            right: 0;
            width: 53px;
            height: 53px;
            font-size: 7px;
          }

          .map-frame {
            min-height: 315px;
          }

          .place-list-heading {
            margin-top: 41px;
          }

          .place-list-heading span:first-child {
            font-size: 24px;
          }

          .place-row {
            grid-template-columns: 32px minmax(0,1fr) 28px;
            gap: 11px;
          }

          .place-row-name {
            font-size: 17px;
          }

          .place-footer {
            padding-right: 18px;
            padding-left: 18px;
          }

          .place-footer-note {
            font-size: 12px;
          }

          .place-edit-panel {
            padding-right: 16px;
            padding-left: 16px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .place-booklet *,
          .place-booklet *::before,
          .place-booklet *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <button
        type="button"
        onClick={onBack}
        className="place-back-float"
        aria-label="返回上一页"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>返回</span>
      </button>

      <section className="place-scroll">
        <div className="place-intro">
          <div className="place-kicker">
            FIELD NOTES · MEMORY ATLAS
          </div>

          <h1 className="place-main-title">
            <span>一起走过的</span>
            <em>地方。</em>
          </h1>

          <div className="place-intro-meta">
            <strong>
              和 {character?.name || '伴侣'}
            </strong>

            <span className="place-meta-dot" />

            <span>
              {places.length} 个足迹
            </span>

            <span className="place-meta-dot" />

            <span>
              PLACES WE KEPT
            </span>
          </div>

          <div className="place-stamp">
            WANDER
            <br />
            TOGETHER
          </div>
        </div>

        {isLoading && (
          <p className="py-16 text-center text-xs opacity-40">
            正在翻找记忆里的地点...
          </p>
        )}

        {!isLoading && places.length === 0 && (
          <div className="place-empty-state">
            <MapPin className="h-7 w-7" />
            <p>
              还没有留下足迹，等你们一起走过更多地方吧。
            </p>
          </div>
        )}

        {!isLoading && places.length > 0 && (
          <>
            <div className="map-heading">
              <span className="map-heading-label">
                Places / Map
              </span>

              <span className="map-heading-place">
                {activePlace?.name || '记忆地图'}
              </span>
            </div>

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
                    width="48"
                    height="48"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 48 0 L 0 0 0 48"
                      fill="none"
                      stroke="#6f746d"
                      strokeWidth="1"
                    />
                  </pattern>

                  <filter id="markerShadow">
                    <feDropShadow
                      dx="0"
                      dy="5"
                      stdDeviation="5"
                      floodColor="#11110f"
                      floodOpacity=".32"
                    />
                  </filter>
                </defs>

                <g className="map-world">
                  <image
                    className="map-image"
                    href={MAP_IMAGE_URL}
                    x="0"
                    y="0"
                    width="1000"
                    height="620"
                    preserveAspectRatio="xMidYMid slice"
                    aria-label="记忆地图底图"
                  />

                  <rect
                    className="map-grid"
                    x="0"
                    y="0"
                    width="1000"
                    height="620"
                    fill="url(#mapGrid)"
                  />

                  {routePoints && (
                    <polyline
                      className="map-route-line"
                      points={routePoints}
                      fill="none"
                      stroke="#11110f"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="10 9"
                      opacity=".78"
                    />
                  )}

                  {mapPlaces.map(({ place, index, point }) => {
                    const isActive = index === activeIndex;

                    return (
                      <g
                        key={place.id}
                        className={`map-marker ${isActive ? 'active' : ''}`}
                        transform={`translate(${point.x} ${point.y})`}
                        onClick={() => selectPlace(index)}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter'
                            || event.key === ' '
                          ) {
                            event.preventDefault();
                            selectPlace(index);
                          }
                        }}
                        role="button"
                        tabIndex="0"
                        aria-label={`选择地点：${place.name}`}
                      >
                        {isActive && (
                          <circle
                            className="map-marker-pulse"
                            r="27"
                            fill="#fff"
                            opacity=".35"
                          />
                        )}

                        <circle
                          r={isActive ? 18 : 13}
                          fill="#11110f"
                          opacity=".2"
                        />

                        <path
                          d="M0 -17 C-10 -17 -17 -9 -17 1 C-17 12 0 26 0 26 S17 12 17 1 C17 -9 10 -17 0 -17Z"
                          fill="#11110f"
                          stroke="#fff"
                          strokeWidth="3"
                          filter="url(#markerShadow)"
                        />

                        <circle
                          cy="1"
                          r="5"
                          fill="#fff"
                        />

                        {isActive && (
                          <text
                            className="map-location-label"
                            x="25"
                            y="-19"
                          >
                            {place.name}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>

              <div className="map-compass">
                N
              </div>

              <div className="map-scale">
                500 M
              </div>

              <div className="place-map-caption">
                <div>
                  <small>
                    LAST TRACE / 最近一次足迹
                  </small>

                  <strong>
                    {activePlace?.name || '记忆地图'}
                  </strong>
                </div>

                <span className="place-map-counter">
                  {String(activeIndex + 1).padStart(2, '0')}
                  {' / '}
                  {String(places.length).padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="map-note">
              <span>
                地图不会记得所有路，但会记得我们停留过的地方。
              </span>

              <span>
                ↗
              </span>
            </div>

            <div className="place-list-heading">
              <span>
                足迹地点
              </span>

              <span>
                {String(places.length).padStart(2, '0')} LOCATIONS
              </span>
            </div>

            <div className="place-list">
              {places.map((place, index) => (
                <div
                  key={place.id}
                  className={`place-row ${
                    index === activeIndex ? 'active' : ''
                  }`}
                  onClick={() => selectPlace(index)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                  role="button"
                  tabIndex="0"
                  aria-pressed={index === activeIndex}
                >
                  <div className="place-row-marker">
                    <MapPin className="h-4 w-4" />
                  </div>

                  <div className="place-row-info">
                    <p className="place-row-name">
                      {place.name || '未命名地点'}
                    </p>

                    <p className="place-row-meta">
                      到访 {place.visitCount || 1} 次 · 最近一次{' '}
                      {formatDate(place.lastVisitAt)}
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
      </section>

      {activePlace && (
        <footer className="place-footer">
          {isEditing ? (
            <div className="place-edit-panel">
              <label
                className="place-edit-label"
                htmlFor="place-name-input"
              >
                地点名称
              </label>

              <input
                id="place-name-input"
                className="place-edit-input"
                type="text"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="给这个地方取个名字"
                maxLength={100}
                autoFocus
              />

              <label
                className="place-edit-label"
                htmlFor="place-note-input"
              >
                共同备注
              </label>

              <textarea
                id="place-note-input"
                className="place-edit-textarea"
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                placeholder="留一句只有你们知道的话..."
                maxLength={1000}
                rows={2}
              />

              <div className="place-edit-actions">
                <button
                  type="button"
                  className="place-edit-action"
                  onClick={handleCancelEditing}
                  disabled={isSaving}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>
                    取消
                  </span>
                </button>

                <button
                  type="button"
                  className="place-edit-action save"
                  onClick={() => void handleSave()}
                  disabled={!canSave}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {isSaving ? '保存中...' : '保存'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="place-footer-display">
              <div className="place-footer-summary">
                <p>
                  初次到访：
                  {formatDate(activePlace.firstVisitAt)}
                </p>

                {activePlace.note && (
                  <div className="place-footer-note">
                    {activePlace.note}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="place-edit-button"
                onClick={handleStartEditing}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>
                  编辑
                </span>
              </button>
            </div>
          )}
        </footer>
      )}
    </div>
  );
};

export default PlaceBooklet;
