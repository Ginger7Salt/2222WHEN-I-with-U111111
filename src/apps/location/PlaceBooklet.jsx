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

const formatCoordinate = (value, positive, negative) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return '';

  const direction = number >= 0 ? positive : negative;

  return `${Math.abs(number).toFixed(3)}° ${direction}`;
};

const getPlaceCoordinate = (place, index) => {
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
    return [
      formatCoordinate(latitude, 'N', 'S'),
      formatCoordinate(longitude, 'E', 'W'),
    ].join('  ·  ');
  }

  return `POINT ${String(index + 1).padStart(2, '0')}`;
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

  const routePoints = mapPlaces
    .map(({ point }) => `${point.x},${point.y}`)
    .join(' ');

  const canSave = Boolean(String(draftName || '').trim()) && !isSaving;

  return (
    <div
      className="place-booklet"
      style={{
        background: '#fbfbf8',
        color: '#11110f',
      }}
    >
      <style>{`
        html:has(.place-booklet),
        body:has(.place-booklet) {
          width: 100%;
          min-width: 100%;
          height: 100%;
          min-height: 100%;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #fbfbf8 !important;
        }

        #root:has(.place-booklet) {
          position: fixed !important;
          z-index: 2147483000 !important;
          inset: 0 !important;
          width: 100vw !important;
          max-width: none !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #fbfbf8 !important;
        }

        .place-booklet {
          --place-ink: #11110f;
          --place-black: #0b0b0a;
          --place-white: #fff;
          --place-paper: #fbfbf8;
          --place-muted: #77766f;
          --place-soft: #a5a39c;
          --place-line: rgba(17,17,15,.13);
          --place-wash: rgba(17,17,15,.055);
          --place-ease: cubic-bezier(.16,1,.3,1);
          --place-smooth: cubic-bezier(.4,0,.2,1);

          position: fixed !important;
          z-index: 2147483000 !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          left: 0 !important;
          display: flex;
          width: 100vw !important;
          max-width: none !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          flex-direction: column;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(
              circle at 85% 2%,
              rgba(255,255,255,.98),
              transparent 28%
            ),
            radial-gradient(
              circle at 8% 72%,
              rgba(226,226,219,.22),
              transparent 29%
            ),
            var(--place-paper) !important;
          color: var(--place-ink) !important;
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
          z-index: -2;
          top: -180px;
          right: -130px;
          width: 460px;
          height: 460px;
          border-radius: 50%;
          background: rgba(255,255,255,.82);
          filter: blur(38px);
          pointer-events: none;
        }

        .place-booklet::after {
          content: "";
          position: absolute;
          z-index: 30;
          inset: 0;
          pointer-events: none;
          opacity: .045;
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
          top: max(17px, env(safe-area-inset-top));
          left: max(18px, env(safe-area-inset-left));
          display: inline-flex;
          min-height: 39px;
          align-items: center;
          gap: 7px;
          padding: 0 14px 0 10px;
          border-radius: 999px;
          color: var(--place-white);
          background: var(--place-black);
          box-shadow:
            0 15px 32px -16px rgba(0,0,0,.74),
            0 4px 10px rgba(0,0,0,.12);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition:
            background .3s ease,
            transform .55s var(--place-ease),
            box-shadow .55s var(--place-ease);
        }

        .place-back-float:hover {
          background: #30302c;
          box-shadow:
            0 21px 38px -16px rgba(0,0,0,.82),
            0 5px 13px rgba(0,0,0,.14);
          transform: translateX(-3px) translateY(-2px);
        }

        .place-back-float:active {
          transform: scale(.93);
        }

        .place-scroll {
          position: relative;
          z-index: 1;
          min-height: 0;
          flex: 1;
          overflow-x: hidden;
          overflow-y: auto;
          padding:
            82px
            max(19px, env(safe-area-inset-right))
            105px
            max(19px, env(safe-area-inset-left));
          scrollbar-width: none;
          overscroll-behavior: contain;
          scroll-behavior: smooth;
        }

        .place-scroll::-webkit-scrollbar {
          display: none;
        }

        .place-intro {
          position: relative;
          padding: 19px 4px 31px;
          animation: placeIntroIn .8s var(--place-ease) both;
        }

        @keyframes placeIntroIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .place-intro::before {
          content: "";
          position: absolute;
          top: 0;
          right: 1px;
          width: 142px;
          height: 142px;
          border: 1px solid rgba(17,17,15,.1);
          border-radius: 50%;
          pointer-events: none;
        }

        .place-intro::after {
          content: "MEMORY / 01";
          position: absolute;
          top: 59px;
          right: -10px;
          color: var(--place-muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 7px;
          letter-spacing: 1.3px;
          opacity: .62;
          transform: rotate(90deg);
          pointer-events: none;
        }

        .place-kicker {
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--place-muted);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.7px;
          line-height: 1;
          text-transform: uppercase;
        }

        .place-kicker::before {
          content: "";
          width: 27px;
          height: 1px;
          flex: 0 0 27px;
          background: var(--place-ink);
          opacity: .72;
        }

        .place-main-title {
          max-width: 380px;
          margin: 19px 0 0;
          color: var(--place-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(34px, 8.9vw, 51px);
          font-weight: 400;
          letter-spacing: -2.7px;
          line-height: .99;
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
          max-width: calc(100% - 52px);
          align-items: center;
          flex-wrap: wrap;
          gap: 8px 13px;
          margin-top: 23px;
          color: var(--place-muted);
          font-size: 9px;
          line-height: 1.3;
        }

        .place-intro-meta strong {
          color: var(--place-ink);
          font-size: 11px;
          font-weight: 750;
        }

        .place-meta-dot {
          width: 3px;
          height: 3px;
          flex: 0 0 3px;
          border-radius: 50%;
          background: var(--place-ink);
          opacity: .42;
        }

        .place-stamp {
          position: absolute;
          right: 0;
          bottom: 23px;
          display: flex;
          width: 52px;
          height: 52px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(17,17,15,.27);
          border-radius: 50%;
          color: var(--place-muted);
          font-family: Georgia, serif;
          font-size: 6.5px;
          letter-spacing: .8px;
          line-height: 1.35;
          text-align: center;
          transform: rotate(10deg);
          opacity: .68;
        }

        .place-stamp::before {
          content: "";
          position: absolute;
          inset: 5px;
          border: 1px dashed rgba(17,17,15,.24);
          border-radius: 50%;
        }

        .map-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          margin: 0 2px 10px;
          animation: placeSectionIn .75s .08s var(--place-ease) both;
        }

        @keyframes placeSectionIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .map-heading-label {
          color: var(--place-muted);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.7px;
          text-transform: uppercase;
        }

        .map-heading-place {
          max-width: 55%;
          overflow: hidden;
          color: var(--place-muted);
          font-family: Georgia, serif;
          font-size: 11px;
          font-style: italic;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .map-frame {
          position: relative;
          height: clamp(275px, 58vw, 415px);
          min-height: 275px;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(
              circle at 28% 20%,
              rgba(255,255,255,.78),
              transparent 30%
            ),
            #e1e3dd;
          box-shadow:
            0 25px 48px -32px rgba(0,0,0,.68),
            inset 0 1px 0 rgba(255,255,255,.8);
          clip-path: polygon(
            0 1%,
            99.6% 0,
            100% 99%,
            .4% 100%
          );
          animation: mapReveal .9s .12s var(--place-ease) both;
        }

        @keyframes mapReveal {
          from {
            opacity: 0;
            transform: translateY(13px) scale(.985);
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
          inset: 0;
          background:
            linear-gradient(
              135deg,
              rgba(255,255,255,.27),
              transparent 37%
            ),
            linear-gradient(
              0deg,
              rgba(17,17,15,.23),
              transparent 30%
            ),
            radial-gradient(
              ellipse at center,
              transparent 45%,
              rgba(17,17,15,.14)
            );
          pointer-events: none;
        }

        .map-frame::after {
          content: "";
          position: absolute;
          z-index: 5;
          top: 10px;
          right: 11px;
          bottom: 10px;
          left: 11px;
          border: 1px solid rgba(255,255,255,.34);
          pointer-events: none;
        }

        .map-svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        .map-world {
          transform: translate(0, 0) scale(1);
          transform-origin: center;
          transition: transform 1s var(--place-ease);
        }

        .map-image {
          display: block;
          width: 1000px;
          height: 620px;
          opacity: .95;
          filter: grayscale(1) contrast(.97) brightness(1.06);
          transform: translate(0, 0);
          transition:
            opacity .5s ease,
            filter .7s ease;
        }

        .map-frame:hover .map-image {
          opacity: 1;
          filter: grayscale(1) contrast(1.02) brightness(1.03);
        }

        .map-grid {
          opacity: .15;
        }

        .map-coordinate-grid {
          fill: none;
          stroke: #11110f;
          stroke-width: 1;
          stroke-dasharray: 2 13;
          opacity: .17;
          vector-effect: non-scaling-stroke;
          pointer-events: none;
        }

        .map-coordinate-axis {
          fill: #11110f;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          opacity: .42;
        }

        .map-coordinate-corner {
          fill: #fff;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.3px;
          paint-order: stroke;
          stroke: rgba(17,17,15,.35);
          stroke-width: 4px;
          stroke-linejoin: round;
        }

        .map-route-line {
          fill: none;
          stroke: #11110f;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 8 8;
          opacity: .72;
          animation: mapRouteMove 22s linear infinite;
          vector-effect: non-scaling-stroke;
        }

        @keyframes mapRouteMove {
          from {
            stroke-dashoffset: 360;
          }

          to {
            stroke-dashoffset: 0;
          }
        }

        .map-marker {
          cursor: pointer;
          transform-box: fill-box;
          transform-origin: center;
          transition: transform .55s var(--place-ease);
        }

        .map-marker:hover {
          transform: scale(1.12);
        }

        .map-marker.active {
          transform: scale(1.25);
        }

        .map-marker-pulse {
          animation: mapPulse 2.8s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        @keyframes mapPulse {
          0% {
            opacity: .52;
            transform: scale(.65);
          }

          70%,
          100% {
            opacity: 0;
            transform: scale(1.75);
          }
        }

        .map-location-label {
          pointer-events: none;
          fill: #fff;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          font-style: italic;
          font-weight: 400;
          paint-order: stroke;
          stroke: rgba(17,17,15,.52);
          stroke-width: 5px;
          stroke-linejoin: round;
        }

        .map-location-coordinate {
          pointer-events: none;
          fill: rgba(255,255,255,.86);
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: .6px;
          paint-order: stroke;
          stroke: rgba(17,17,15,.42);
          stroke-width: 3px;
          stroke-linejoin: round;
        }

        .map-marker-number {
          pointer-events: none;
          fill: #11110f;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          font-size: 7px;
          font-weight: 900;
          text-anchor: middle;
        }

        .map-scale {
          position: absolute;
          right: 17px;
          bottom: 17px;
          z-index: 8;
          display: flex;
          align-items: center;
          gap: 7px;
          color: #fff;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
          opacity: .82;
          text-shadow: 0 1px 6px rgba(0,0,0,.55);
        }

        .map-scale::before {
          content: "";
          display: block;
          width: 35px;
          height: 5px;
          border-top: 1px solid currentColor;
          border-right: 1px solid currentColor;
          border-left: 1px solid currentColor;
        }

        .map-compass {
          position: absolute;
          z-index: 8;
          top: 16px;
          right: 17px;
          display: flex;
          width: 34px;
          height: 34px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #fff;
          background: rgba(11,11,10,.52);
          box-shadow: 0 9px 18px -10px rgba(0,0,0,.8);
          font-family: Georgia, serif;
          font-size: 10px;
          font-weight: 700;
          opacity: .84;
        }

        .map-compass::after {
          content: "";
          position: absolute;
          width: 1px;
          height: 14px;
          background: #fff;
          transform: rotate(42deg);
        }

        .place-map-caption {
          position: absolute;
          z-index: 8;
          right: 17px;
          bottom: 16px;
          left: 17px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 15px;
          color: #fff;
          pointer-events: none;
        }

        .place-map-caption small {
          display: block;
          margin-bottom: 5px;
          color: rgba(255,255,255,.76);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }

        .place-map-caption strong {
          display: block;
          max-width: 225px;
          overflow: hidden;
          color: #fff;
          font-family: Georgia, serif;
          font-size: 20px;
          font-style: italic;
          font-weight: 400;
          text-overflow: ellipsis;
          text-shadow: 0 2px 11px rgba(0,0,0,.38);
          white-space: nowrap;
        }

        .place-map-caption-coordinate {
          margin-top: 5px;
          color: rgba(255,255,255,.74);
          font-size: 7px;
          font-weight: 700;
          letter-spacing: .7px;
        }

        .place-map-counter {
          color: rgba(255,255,255,.84);
          font-family: Georgia, serif;
          font-size: 10px;
          white-space: nowrap;
        }

        .map-note {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px 4px 0;
          color: var(--place-muted);
          font-family: Georgia, serif;
          font-size: 9px;
          font-style: italic;
          line-height: 1.55;
          animation: placeSectionIn .75s .25s var(--place-ease) both;
        }

        .map-note::before {
          content: "";
          width: 27px;
          height: 1px;
          flex: 0 0 27px;
          background: var(--place-ink);
          opacity: .55;
        }

        .place-list-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin: 40px 3px 6px;
          animation: placeSectionIn .75s .3s var(--place-ease) both;
        }

        .place-list-heading span:first-child {
          color: var(--place-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 23px;
          font-weight: 400;
          letter-spacing: -1px;
        }

        .place-list-heading span:last-child {
          color: var(--place-muted);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.2px;
          opacity: .7;
        }

        .place-list {
          position: relative;
          padding-bottom: 8px;
          animation: placeSectionIn .75s .38s var(--place-ease) both;
        }

        .place-list::before {
          content: "";
          position: absolute;
          top: 14px;
          bottom: 17px;
          left: 16px;
          width: 1px;
          background: linear-gradient(
            var(--place-ink),
            rgba(17,17,15,.06)
          );
          opacity: .25;
        }

        .place-row {
          position: relative;
          display: grid;
          width: 100%;
          grid-template-columns: 34px minmax(0, 1fr) 28px;
          align-items: center;
          gap: 11px;
          padding: 14px 2px 15px;
          border-bottom: 1px solid var(--place-line);
          color: var(--place-ink);
          text-align: left;
          cursor: pointer;
          transition:
            padding .55s var(--place-ease),
            transform .4s var(--place-ease),
            background .4s ease;
        }

        .place-row::before {
          content: "";
          position: absolute;
          top: 9px;
          bottom: 9px;
          left: -21px;
          width: 3px;
          border-radius: 0 3px 3px 0;
          background: var(--place-black);
          opacity: 0;
          transform: scaleY(.3);
          transition:
            opacity .35s ease,
            transform .55s var(--place-ease);
        }

        .place-row:hover {
          transform: translateX(3px);
        }

        .place-row:focus-visible {
          outline: 2px solid var(--place-ink);
          outline-offset: 3px;
        }

        .place-row.active {
          padding-top: 18px;
          padding-bottom: 18px;
          background: linear-gradient(
            90deg,
            rgba(17,17,15,.055),
            transparent 75%
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
          width: 33px;
          height: 33px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--place-muted);
          background: var(--place-paper);
          box-shadow: 0 0 0 5px var(--place-paper);
          transition:
            color .35s ease,
            background .35s ease,
            transform .5s var(--place-ease);
        }

        .place-row.active .place-row-marker {
          color: var(--place-white);
          background: var(--place-black);
          box-shadow:
            0 0 0 5px var(--place-paper),
            0 10px 20px -12px rgba(0,0,0,.7);
          transform: scale(1.1) rotate(-6deg);
        }

        .place-row-info {
          min-width: 0;
        }

        .place-row-name {
          overflow: hidden;
          color: var(--place-ink);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 16px;
          font-weight: 400;
          letter-spacing: -.35px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-row-meta {
          margin-top: 4px;
          overflow: hidden;
          color: var(--place-muted);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .3px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-row-note {
          max-width: 92%;
          margin-top: 7px;
          overflow: hidden;
          color: #69675f;
          font-family: Georgia, serif;
          font-size: 10px;
          font-style: italic;
          line-height: 1.45;
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
          background: rgba(17,17,15,.055);
          opacity: .43;
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
          transform: scale(1.08) rotate(7deg);
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
          gap: 13px;
          color: var(--place-muted);
          text-align: center;
          animation: placeIntroIn .8s var(--place-ease) both;
        }

        .place-empty-state svg {
          width: 27px;
          height: 27px;
          color: var(--place-ink);
          opacity: .65;
        }

        .place-empty-state p {
          max-width: 230px;
          font-family: Georgia, serif;
          font-size: 10px;
          font-style: italic;
          line-height: 1.7;
          opacity: .72;
        }

        .place-footer {
          position: relative;
          z-index: 10;
          flex-shrink: 0;
          padding:
            14px
            max(19px, env(safe-area-inset-right))
            calc(22px + env(safe-area-inset-bottom))
            max(19px, env(safe-area-inset-left));
          background:
            linear-gradient(
              180deg,
              rgba(251,251,248,0),
              rgba(251,251,248,.95) 28%,
              #fbfbf8 58%
            );
        }

        .place-footer::before {
          content: "";
          display: block;
          width: 34px;
          height: 2px;
          margin-bottom: 11px;
          border-radius: 999px;
          background: var(--place-black);
          opacity: .72;
        }

        .place-footer-display {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 15px;
        }

        .place-footer-summary {
          min-width: 0;
          flex: 1;
        }

        .place-footer-summary > p {
          color: var(--place-muted);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .3px;
        }

        .place-footer-note {
          max-width: 100%;
          margin-top: 6px;
          overflow: hidden;
          color: var(--place-ink);
          font-family: Georgia, serif;
          font-size: 11px;
          font-style: italic;
          line-height: 1.5;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .place-edit-button {
          display: inline-flex;
          min-height: 38px;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          padding: 0 14px;
          border-radius: 999px;
          color: var(--place-white);
          background: var(--place-black);
          box-shadow: 0 13px 25px -15px rgba(0,0,0,.8);
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
          transition:
            background .3s ease,
            box-shadow .45s var(--place-ease),
            transform .45s var(--place-ease);
        }

        .place-edit-button:hover {
          background: #2d2d29;
          box-shadow: 0 18px 29px -13px rgba(0,0,0,.82);
          transform: translateY(-3px);
        }

        .place-edit-button:active {
          transform: scale(.93);
        }

        .place-edit-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 17px 17px 16px;
          border-radius: 19px;
          color: var(--place-white);
          background: var(--place-black);
          box-shadow:
            0 24px 48px -27px rgba(0,0,0,.8),
            0 5px 16px rgba(0,0,0,.12);
          animation: placeEditIn .55s var(--place-ease) both;
        }

        @keyframes placeEditIn {
          from {
            opacity: 0;
            transform: translateY(13px) scale(.985);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .place-edit-label {
          display: block;
          color: rgba(255,255,255,.48);
          font-size: 8px;
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
          font-size: 13px;
          line-height: 1.5;
          transition: border-color .3s ease;
        }

        .place-edit-input {
          padding: 5px 0 8px;
          font-weight: 700;
        }

        .place-edit-textarea {
          min-height: 45px;
          padding: 5px 0 8px;
          resize: vertical;
          font-family: Georgia, serif;
          font-size: 11px;
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
          gap: 8px;
          padding-top: 2px;
        }

        .place-edit-action {
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          gap: 5px;
          padding: 0 11px;
          border-radius: 999px;
          color: rgba(255,255,255,.72);
          background: rgba(255,255,255,.1);
          font-size: 10px;
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
          background: #e9e9e4;
        }

        .place-edit-action.save:disabled {
          cursor: not-allowed;
          opacity: .35;
          transform: none;
        }

        @media (min-width: 700px) {
          .place-scroll {
            padding-right: 30px;
            padding-left: 30px;
          }

          .place-intro {
            padding-right: 6px;
            padding-left: 6px;
          }

          .place-footer {
            padding-right: 30px;
            padding-left: 30px;
          }

          .place-main-title {
            font-size: 51px;
          }
        }

        @media (max-width: 420px) {
          .place-scroll {
            padding-right: 17px;
            padding-left: 17px;
          }

          .place-back-float {
            left: 16px;
          }

          .place-main-title {
            font-size: clamp(32px, 9.5vw, 43px);
            letter-spacing: -2.2px;
          }

          .place-intro {
            padding-top: 15px;
          }

          .place-intro::before {
            width: 126px;
            height: 126px;
          }

          .place-intro::after {
            top: 52px;
          }

          .map-frame {
            height: clamp(265px, 61vw, 350px);
            min-height: 265px;
          }

          .place-list-heading {
            margin-top: 34px;
          }

          .place-list-heading span:first-child {
            font-size: 21px;
          }

          .place-row {
            grid-template-columns: 32px minmax(0, 1fr) 27px;
            gap: 10px;
          }

          .place-row-name {
            font-size: 15px;
          }

          .place-footer {
            padding-right: 17px;
            padding-left: 17px;
          }

          .place-footer-note {
            font-size: 10px;
          }

          .place-edit-panel {
            padding-right: 15px;
            padding-left: 15px;
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
                preserveAspectRatio="xMidYMid meet"
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
                      stroke="#70756f"
                      strokeWidth="1"
                    />
                  </pattern>

                  <filter id="markerShadow">
                    <feDropShadow
                      dx="0"
                      dy="4"
                      stdDeviation="4"
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
                    preserveAspectRatio="xMidYMid meet"
                    aria-label="完整地图底图"
                  />

                  <rect
                    className="map-grid"
                    x="0"
                    y="0"
                    width="1000"
                    height="620"
                    fill="url(#mapGrid)"
                  />

                  <g
                    className="map-coordinate-grid"
                    aria-hidden="true"
                  >
                    <line x1="166" y1="44" x2="166" y2="576" />
                    <line x1="333" y1="44" x2="333" y2="576" />
                    <line x1="500" y1="44" x2="500" y2="576" />
                    <line x1="667" y1="44" x2="667" y2="576" />
                    <line x1="834" y1="44" x2="834" y2="576" />

                    <line x1="54" y1="150" x2="946" y2="150" />
                    <line x1="54" y1="310" x2="946" y2="310" />
                    <line x1="54" y1="470" x2="946" y2="470" />
                  </g>

                  <g
                    className="map-coordinate-axis"
                    aria-hidden="true"
                  >
                    <text x="58" y="38">
                      90°N
                    </text>

                    <text x="914" y="38">
                      180°E
                    </text>

                    <text x="58" y="602">
                      90°S
                    </text>

                    <text x="882" y="602">
                      180°W
                    </text>
                  </g>

                  {routePoints && (
                    <polyline
                      className="map-route-line"
                      points={routePoints}
                    />
                  )}

                  {mapPlaces.map(({ place, index, point }) => {
                    const isActive = index === activeIndex;

                    return (
                      <g
                        key={place.id}
                        className={`map-marker ${
                          isActive ? 'active' : ''
                        }`}
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
                            r="25"
                            fill="#fff"
                            opacity=".35"
                          />
                        )}

                        <circle
                          r={isActive ? 17 : 13}
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

                        <text
                          className="map-marker-number"
                          x="0"
                          y="3.5"
                        >
                          {String(index + 1).padStart(2, '0')}
                        </text>

                        {isActive && (
                          <>
                            <text
                              className="map-location-label"
                              x="24"
                              y="-20"
                            >
                              {place.name || '未命名地点'}
                            </text>

                            <text
                              className="map-location-coordinate"
                              x="25"
                              y="-6"
                            >
                              {getPlaceCoordinate(place, index)}
                            </text>
                          </>
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

                  <div className="place-map-caption-coordinate">
                    {getPlaceCoordinate(activePlace, activeIndex)}
                  </div>
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

