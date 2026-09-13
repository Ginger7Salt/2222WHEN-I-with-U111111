import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
  Shuffle,
  Trash2,
  Upload,
  X
} from 'lucide-react';

import db from '../../db';
import { compressImageFile } from '../../utils/imageHelper';

import {
  getAllWorkflowsWithContext,
  getWorkflowCandidateChats,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  setWorkflowEnabled
} from '../../services/workflow/workflowService';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=85';

const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1800&q=85';

const DEFAULT_CHARACTER = {
  name: 'Mori',
  handle: 'mori',
  code: '001',
  status: 'ARCHIVED',
  bio: '喜欢在阴天出门。把没有说出口的事情，藏进一张张失焦的照片里。',
  avatar: DEFAULT_AVATAR,
  banner: DEFAULT_BANNER,
  accent: '#d8d3c8',
  tone: 'linear-gradient(135deg,#2a2926,#928d82)',
  cameraEyebrow: 'Choose your perspective',
  cameraIntro: '像从一卷旧胶卷里抽出一张相片。选择一个角色，进入属于他的独立世界。',
  cameraCaption: 'use the frame to remember',
  timelineTitle: 'Fragments',
  timelineLabel: 'PERSONAL TIMELINE',
  events: [
    {
      date: '2026.09.12',
      title: '雨停以后',
      content: '在城市边缘拍下第一张照片。没有人知道那张照片最后去了哪里。'
    },
    {
      date: '2026.08.27',
      title: '旧唱片店',
      content: '买到一张有裂痕的爵士唱片，声音像从另一个房间传来。'
    },
    {
      date: '2026.07.04',
      title: '无题',
      content: '今天没有发生什么，但风一直很好。'
    }
  ]
};

const DEFAULT_CHARACTERS = [
  DEFAULT_CHARACTER,
  {
    name: 'Nox',
    handle: 'nox',
    code: '002',
    status: 'IN MOTION',
    bio: '夜行者。收集凌晨三点的街灯、陌生人的背影，以及所有短暂的告别。',
    avatar:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=85',
    banner:
      'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1800&q=85',
    accent: '#aab8c4',
    tone: 'linear-gradient(135deg,#151b21,#718394)',
    cameraEyebrow: 'Choose your perspective',
    cameraIntro: '夜色会替我们保存那些不方便说出口的事情。',
    cameraCaption: 'collect the afterglow',
    timelineTitle: 'Fragments',
    timelineLabel: 'PERSONAL TIMELINE',
    events: [
      {
        date: '2026.09.09',
        title: '03:17 AM',
        content: '便利店的灯还亮着。玻璃上有一只飞蛾，像一个很小的月亮。'
      },
      {
        date: '2026.08.18',
        title: '南下列车',
        content: '坐过站了，于是继续坐下去。'
      },
      {
        date: '2026.06.29',
        title: '蓝色噪音',
        content: '把所有通知关闭，城市突然变得很安静。'
      }
    ]
  },
  {
    name: 'Aster',
    handle: 'aster',
    code: '003',
    status: 'DREAMING',
    bio: '住在植物、旧书和午后阳光之间。相信每一种沉默都有自己的颜色。',
    avatar:
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=700&q=85',
    banner:
      'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=1800&q=85',
    accent: '#b8c2a2',
    tone: 'linear-gradient(135deg,#242b1e,#879779)',
    cameraEyebrow: 'Choose your perspective',
    cameraIntro: '相信每一种沉默都有自己的颜色。',
    cameraCaption: 'stay close to the light',
    timelineTitle: 'Fragments',
    timelineLabel: 'PERSONAL TIMELINE',
    events: [
      {
        date: '2026.09.10',
        title: '窗边植物',
        content: '新叶子长出来了。它比昨天更靠近光一点。'
      },
      {
        date: '2026.08.02',
        title: '绿色房间',
        content: '重新整理了书架，发现一本忘记读完的书。'
      },
      {
        date: '2026.05.11',
        title: '春天的证据',
        content: '花开得很慢，但确实开了。'
      }
    ]
  }
];

const styles = `
  .camera-page {
    min-height: 100svh;
    overflow-x: hidden;
    color: var(--text-main);
    background:
      radial-gradient(circle at 80% 8%, rgba(255,255,255,.08), transparent 24rem),
      linear-gradient(115deg, #0b0b0b, #1b1b1a 65%, #080808);
  }

  .camera-page.light {
    color: #151515;
    background:
      radial-gradient(circle at 80% 8%, rgba(255,255,255,.7), transparent 24rem),
      linear-gradient(115deg, #c9c5bb, #efede7);
  }

  .camera-page *,
  .camera-page *::before,
  .camera-page *::after {
    box-sizing: border-box;
  }

  .camera-page button,
  .camera-page input,
  .camera-page textarea {
    font: inherit;
  }

  .camera-page button {
    color: inherit;
  }

  .camera-noise {
    position: fixed;
    z-index: 20;
    pointer-events: none;
    inset: 0;
    opacity: .12;
    mix-blend-mode: screen;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.32'/%3E%3C/svg%3E");
  }

  .camera-content {
    position: relative;
    z-index: 2;
    width: min(1440px, 100%);
    margin: 0 auto;
    padding: 0 clamp(18px, 5vw, 80px) 70px;
  }

  .camera-topbar {
    height: 76px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .camera-brand {
    font-size: 11px;
    letter-spacing: .3em;
    opacity: .7;
    text-transform: uppercase;
  }

  .camera-top-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .camera-ghost-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    padding: 5px;
    background: transparent;
    cursor: pointer;
    opacity: .7;
    font-size: 11px;
    letter-spacing: .08em;
    transition: .25s ease;
  }

  .camera-ghost-button:hover {
    opacity: 1;
    transform: translateY(-2px);
  }

  .camera-dot {
    width: 9px;
    height: 9px;
    display: inline-block;
    border-radius: 50%;
    background: var(--camera-accent);
    box-shadow: 0 0 15px var(--camera-accent);
  }

  .camera-intro {
    display: grid;
    grid-template-columns: 1fr minmax(260px, 430px);
    align-items: end;
    gap: 40px;
    margin: clamp(22px, 5vw, 72px) 0 34px;
  }

  .camera-eyebrow {
    margin: 0 0 18px;
    color: #999;
    font-size: 10px;
    letter-spacing: .28em;
    text-transform: uppercase;
  }

  .camera-heading {
    margin: 0;
    font: 400 clamp(52px, 9vw, 126px)/.78 Georgia, "Times New Roman", serif;
    letter-spacing: -.08em;
  }

  .camera-intro-copy {
    max-width: 360px;
    margin: 0 0 6px;
    color: #aaa;
    font-size: 13px;
    line-height: 1.8;
  }

  .camera-stage {
    position: relative;
    min-height: 650px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .camera-glow {
    position: absolute;
    width: min(75vw, 700px);
    height: min(75vw, 700px);
    border-radius: 50%;
    background: var(--camera-tone);
    filter: blur(70px);
    opacity: .28;
    transition: .6s ease;
  }

  .camera-object {
    position: relative;
    z-index: 2;
    width: min(88vw, 540px);
    aspect-ratio: 1.02/.82;
    transform: rotate(-2deg);
    transition: .5s ease;
  }

  .camera-object:hover {
    transform: rotate(0deg) scale(1.015);
  }

  .camera-body {
    position: absolute;
    inset: 0;
    border: 1px solid rgba(255,255,255,.35);
    border-radius: 10px;
    padding: 28px 25px 24px;
    background: linear-gradient(145deg,#292929,#0c0c0c 62%,#343434);
    box-shadow: 25px 30px 80px #000, inset 0 1px rgba(255,255,255,.25);
  }

  .camera-body::after {
    content: "";
    position: absolute;
    inset: 10px;
    pointer-events: none;
    border: 1px solid rgba(255,255,255,.07);
  }

  .camera-viewfinder {
    position: absolute;
    left: 8%;
    right: 8%;
    top: 12%;
    bottom: 17%;
    overflow: hidden;
    border: 5px solid #181818;
    background: #292929;
    box-shadow: inset 0 0 0 1px #707070, 0 4px 12px #000;
  }

  .camera-viewfinder::before,
  .camera-viewfinder::after {
    content: "";
    position: absolute;
    z-index: 3;
    pointer-events: none;
  }

  .camera-viewfinder::before {
    inset: 0;
    background:
      linear-gradient(90deg,transparent 49.8%,rgba(255,255,255,.22) 50%,transparent 50.2%),
      linear-gradient(0deg,transparent 49.8%,rgba(255,255,255,.22) 50%,transparent 50.2%);
  }

  .camera-viewfinder::after {
    inset: 12px;
    border: 1px solid rgba(255,255,255,.35);
  }

  .camera-banner {
    position: absolute;
    inset: 0;
    background-position: center;
    background-size: cover;
    filter: grayscale(1) contrast(1.08);
  }

  .camera-banner::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg,rgba(0,0,0,.1),transparent 45%,rgba(0,0,0,.55));
  }

  .camera-focus {
    position: absolute;
    z-index: 4;
    top: 13px;
    left: 15px;
    color: #fff;
    font: 10px monospace;
    letter-spacing: .16em;
  }

  .camera-info {
    position: absolute;
    z-index: 4;
    right: 16px;
    bottom: 13px;
    left: 16px;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 10px;
  }

  .camera-name {
    overflow: hidden;
    font: 400 clamp(23px, 5vw, 42px) Georgia, "Times New Roman", serif;
    letter-spacing: -.05em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .camera-number {
    color: #bbb;
    font: 10px monospace;
  }

  .camera-lens {
    position: absolute;
    z-index: 5;
    right: 26px;
    bottom: -33px;
    width: 74px;
    height: 74px;
    border: 5px solid #191919;
    border-radius: 50%;
    background: radial-gradient(circle,#101010 0 22%,#999 23% 25%,#171717 27% 48%,#777 49% 51%,#111 52%);
    box-shadow: 0 8px 20px #000;
  }

  .camera-flash {
    position: absolute;
    top: 12px;
    right: 28%;
    width: 48px;
    height: 10px;
    border-radius: 2px;
    background: #858585;
  }

  .camera-shutter {
    position: absolute;
    top: -14px;
    right: 23%;
    width: 60px;
    height: 18px;
    border: 1px solid #777;
    border-radius: 5px 5px 0 0;
    background: #2e2e2e;
  }

  .camera-caption {
    position: absolute;
    bottom: 7%;
    left: 8%;
    color: #999;
    font-size: 9px;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  .camera-side {
    position: absolute;
    top: 20%;
    left: -17px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .camera-side button {
    width: 25px;
    height: 25px;
    border: 1px solid #777;
    border-radius: 50%;
    background: #161616;
    color: #aaa;
    cursor: pointer;
  }

  .camera-side button:hover {
    border-color: #fff;
    color: #fff;
  }

  .camera-selector {
    margin-top: 20px;
  }

  .camera-selector-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 15px;
  }

  .camera-selector-title {
    color: #aaa;
    font-size: 12px;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  .camera-swipe-hint {
    color: #666;
    font-size: 10px;
  }

  .camera-strip {
    display: flex;
    gap: 18px;
    overflow-x: auto;
    padding: 10px 2px 22px;
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
  }

  .camera-strip::-webkit-scrollbar {
    display: none;
  }

  .camera-character-card,
  .camera-new-card {
    position: relative;
    flex: 0 0 clamp(148px, 20vw, 220px);
    aspect-ratio: .72;
    overflow: hidden;
    scroll-snap-align: center;
  }

  .camera-character-card {
    border: 0;
    padding: 0;
    background: #222;
    box-shadow: 0 12px 30px #000;
    cursor: pointer;
    filter: grayscale(1);
    transition: .4s ease;
  }

  .camera-character-card:hover {
    transform: translateY(-8px) rotate(1deg);
    filter: grayscale(.25);
  }

  .camera-character-card.active {
    transform: translateY(-12px) rotate(-2deg);
    filter: grayscale(0);
  }

  .camera-character-card img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .camera-character-card::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg,transparent 42%,rgba(0,0,0,.8));
  }

  .camera-card-id {
    position: absolute;
    z-index: 2;
    top: 12px;
    right: 12px;
    color: #ddd;
    font: 10px monospace;
  }

  .camera-card-meta {
    position: absolute;
    z-index: 2;
    right: 14px;
    bottom: 13px;
    left: 14px;
    text-align: left;
  }

  .camera-card-meta strong {
    display: block;
    font: 400 22px Georgia, "Times New Roman", serif;
  }

  .camera-card-meta small {
    display: block;
    margin-top: 5px;
    color: #bbb;
    font-size: 9px;
    letter-spacing: .15em;
    text-transform: uppercase;
  }

  .camera-new-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 1px dashed #666;
    background: transparent;
    color: #999;
    cursor: pointer;
    flex-direction: column;
  }

  .camera-new-card strong {
    font-size: 28px;
    font-weight: 300;
  }

  .camera-new-card span {
    font-size: 10px;
    letter-spacing: .14em;
  }

  .camera-profile {
    display: grid;
    grid-template-columns: minmax(230px,.7fr) minmax(0,1.3fr);
    gap: clamp(28px, 6vw, 100px);
    margin-top: 85px;
    padding-top: 32px;
    border-top: 1px solid rgba(255,255,255,.18);
  }

  .camera-avatar {
    width: min(230px, 48vw);
    aspect-ratio: 1;
    border-radius: 50% 50% 45% 52%;
    object-fit: cover;
    filter: grayscale(1);
    box-shadow: 18px 18px 0 rgba(255,255,255,.06);
  }

  .camera-profile-title {
    margin: 26px 0 14px;
    font: 400 clamp(42px, 7vw, 82px)/.88 Georgia, "Times New Roman", serif;
    letter-spacing: -.08em;
  }

  .camera-profile-desc {
    max-width: 330px;
    color: #aaa;
    font-size: 13px;
    line-height: 1.8;
  }

  .camera-profile-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: #888;
    font: 10px monospace;
    letter-spacing: .15em;
  }

  .camera-edit-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 24px 0 42px;
    padding: 15px 0;
    border-bottom: 1px solid rgba(255,255,255,.18);
  }

  .camera-small-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 34px;
    border: 1px solid #555;
    padding: 8px 11px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 11px;
    transition: .25s ease;
  }

  .camera-small-button:hover {
    border-color: #fff;
    color: #fff;
    transform: translateY(-2px);
  }

  .camera-timeline-title {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 24px;
  }

  .camera-timeline-title h2 {
    margin: 0;
    font: 400 30px Georgia, "Times New Roman", serif;
  }

  .camera-timeline-title span {
    color: #888;
    font: 10px monospace;
  }

  .camera-timeline {
    position: relative;
    padding-left: 25px;
  }

  .camera-timeline::before {
    content: "";
    position: absolute;
    top: 8px;
    bottom: 0;
    left: 4px;
    width: 1px;
    background: linear-gradient(#aaa,transparent);
  }

  .camera-event {
    position: relative;
    margin-bottom: 32px;
  }

  .camera-event::before {
    content: "";
    position: absolute;
    top: 6px;
    left: -24px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--camera-accent);
    box-shadow: 0 0 15px var(--camera-accent);
  }

  .camera-event-date {
    color: #777;
    font: 10px monospace;
    letter-spacing: .12em;
  }

  .camera-event h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 7px 0;
    font: 400 20px Georgia, "Times New Roman", serif;
  }

  .camera-event p {
    max-width: 520px;
    margin: 0;
    color: #999;
    font-size: 12px;
    line-height: 1.8;
  }

  .camera-event-actions {
    display: inline-flex;
    gap: 5px;
    opacity: .45;
  }

  .camera-event-actions button {
    border: 0;
    padding: 2px;
    background: transparent;
    cursor: pointer;
  }

  .camera-footer {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 15px;
    margin-top: 100px;
    color: #666;
    font: 10px monospace;
    letter-spacing: .12em;
  }

  .camera-floating-button {
    position: fixed;
    z-index: 10;
    right: 22px;
    bottom: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border: 1px solid #777;
    border-radius: 50%;
    background: rgba(20,20,20,.78);
    color: #fff;
    cursor: pointer;
    backdrop-filter: blur(15px);
  }

  .camera-modal-mask {
    position: fixed;
    z-index: 50;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(0,0,0,.55);
  }

  .camera-modal {
    width: min(680px, 100%);
    max-height: 92svh;
    overflow-y: auto;
    border: 1px solid rgba(255,255,255,.2);
    border-radius: 18px;
    padding: 22px;
    background: #171717;
    color: #eee;
    box-shadow: 0 24px 80px #000;
  }

  .camera-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 20px;
  }

  .camera-modal-header h3 {
    margin: 0;
    font: 400 28px Georgia, "Times New Roman", serif;
  }

  .camera-modal-close {
    border: 0;
    background: transparent;
    color: inherit;
    opacity: .6;
    cursor: pointer;
  }

  .camera-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .camera-form-field {
    min-width: 0;
  }

  .camera-form-field.full {
    grid-column: 1 / -1;
  }

  .camera-form-field label {
    display: block;
    margin-bottom: 6px;
    color: #aaa;
    font-size: 11px;
    letter-spacing: .08em;
  }

  .camera-form-field input,
  .camera-form-field textarea,
  .camera-form-field select {
    width: 100%;
    border: 1px solid #555;
    border-radius: 10px;
    padding: 10px 12px;
    outline: none;
    background: #111;
    color: #eee;
    font-size: 13px;
  }

  .camera-form-field textarea {
    min-height: 88px;
    resize: vertical;
    line-height: 1.6;
  }

  .camera-form-field input:focus,
  .camera-form-field textarea:focus {
    border-color: #fff;
  }

  .camera-upload-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 6px 0 18px;
  }

  .camera-upload-box {
    position: relative;
    min-height: 130px;
    overflow: hidden;
    border: 1px dashed #666;
    border-radius: 12px;
    cursor: pointer;
  }

  .camera-upload-box img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: .55;
  }

  .camera-upload-box-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 130px;
    padding: 12px;
    background: rgba(0,0,0,.32);
    text-align: center;
    flex-direction: column;
    gap: 7px;
  }

  .camera-upload-box-content span {
    font-size: 11px;
  }

  .camera-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 22px;
  }

  .camera-primary-button,
  .camera-secondary-button {
    min-height: 38px;
    border-radius: 10px;
    padding: 9px 15px;
    cursor: pointer;
    font-size: 12px;
  }

  .camera-primary-button {
    border: 1px solid #eee;
    background: #eee;
    color: #111;
  }

  .camera-secondary-button {
    border: 1px solid #555;
    background: transparent;
    color: #eee;
  }

  .camera-empty {
    padding: 30px 0;
    color: #999;
    text-align: center;
    font-size: 13px;
  }

  @media (max-width: 700px) {
    .camera-topbar {
      height: 62px;
    }

    .camera-brand {
      font-size: 9px;
    }

    .camera-top-actions .camera-ghost-button:first-child {
      display: none;
    }

    .camera-content {
      padding-right: 18px;
      padding-left: 18px;
    }

    .camera-intro {
      display: block;
      margin: 35px 0 16px;
    }

    .camera-heading {
      margin-bottom: 22px;
      font-size: 65px;
    }

    .camera-intro-copy {
      font-size: 12px;
    }

    .camera-stage {
      min-height: 430px;
      margin: 0 -4px;
    }

    .camera-object {
      width: 94vw;
    }

    .camera-body {
      padding: 18px;
    }

    .camera-lens {
      right: 18px;
      bottom: -26px;
      width: 58px;
      height: 58px;
    }

    .camera-side {
      left: 0;
    }

    .camera-character-card,
    .camera-new-card {
      flex-basis: 150px;
    }

    .camera-strip {
      gap: 12px;
      margin-right: -18px;
      margin-left: -18px;
      padding-right: 18px;
      padding-left: 18px;
    }

    .camera-profile {
      display: block;
      margin-top: 58px;
      padding-top: 26px;
    }

    .camera-profile-left {
      margin-bottom: 50px;
    }

    .camera-avatar {
      width: 145px;
    }

    .camera-profile-title {
      font-size: 57px;
    }

    .camera-footer {
      align-items: flex-start;
      flex-direction: column;
      margin-top: 70px;
    }

    .camera-form-grid,
    .camera-upload-grid {
      grid-template-columns: 1fr;
    }

    .camera-form-field.full {
      grid-column: auto;
    }

    .camera-modal {
      max-height: 94svh;
      padding: 17px;
    }

    .camera-modal-footer {
      position: sticky;
      bottom: -17px;
      margin-right: -17px;
      margin-left: -17px;
      padding: 12px 17px 0;
      background: #171717;
    }
  }
`;

const normalizeEvents = (events) => {
  if (!Array.isArray(events)) return [];

  return events.map((event) => {
    if (Array.isArray(event)) {
      return {
        date: event[0] || '',
        title: event[1] || '',
        content: event[2] || ''
      };
    }

    return {
      date: event?.date || '',
      title: event?.title || '',
      content: event?.content || event?.description || ''
    };
  });
};

const normalizeCharacter = (character, index = 0) => {
  const fallback = DEFAULT_CHARACTERS[index % DEFAULT_CHARACTERS.length];

  return {
    ...fallback,
    ...character,
    name: character?.name || fallback.name,
    code:
      character?.code ||
      String(character?.id || index + 1).padStart(3, '0'),
    status: character?.status || 'ARCHIVED',
    bio: character?.cameraBio || character?.bio || fallback.bio,
    avatar: character?.cameraAvatar || character?.avatar || fallback.avatar,
    banner: character?.cameraBanner || character?.banner || fallback.banner,
    accent: character?.cameraAccent || character?.accent || fallback.accent,
    tone: character?.cameraTone || character?.tone || fallback.tone,
    cameraEyebrow:
      character?.cameraEyebrow || fallback.cameraEyebrow,
    cameraIntro:
      character?.cameraIntro ||
      '像从一卷旧胶卷里抽出一张相片。选择一个角色，进入属于他的独立世界。',
    cameraCaption:
      character?.cameraCaption || fallback.cameraCaption,
    timelineTitle:
      character?.cameraTimelineTitle || fallback.timelineTitle,
    timelineLabel:
      character?.cameraTimelineLabel || fallback.timelineLabel,
    events: normalizeEvents(
      character?.cameraEvents || character?.events || fallback.events
    )
  };
};

const formatWeekdays = (weekdays) => {
  if (!Array.isArray(weekdays) || weekdays.length === 0) return '未设置';
  if (weekdays.length === 7) return '每天';

  return [...weekdays]
    .sort()
    .map((day) => WEEKDAY_LABELS[day])
    .join('、');
};

const getWorkflowStatus = (workflow) => {
  if (!workflow.lastRunAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] opacity-45">
        <CircleDashed className="h-3 w-3" />
        尚未运行
      </span>
    );
  }

  if (workflow.lastRunStatus === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] opacity-70">
        <CircleAlert className="h-3 w-3" />
        {workflow.lastRunError?.slice(0, 24) || '上次执行失败'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] opacity-55">
      <CircleCheck className="h-3 w-3" />
      已送达
    </span>
  );
};

const ImageUploadBox = ({
  label,
  image,
  onChange,
  compressOptions
}) => {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.78,
        outputType: 'base64',
        ...compressOptions
      });

      onChange(compressed);
    } catch (error) {
      console.error('图片处理失败：', error);
      window.alert('图片处理失败，请重新选择图片。');
    } finally {
      setLoading(false);

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <div
      className="camera-upload-box"
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          inputRef.current?.click();
        }
      }}
    >
      {image && <img src={image} alt="" />}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleChange}
      />

      <div className="camera-upload-box-content">
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>正在压缩图片…</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5" />
            <span>{label}</span>
            <small className="text-[10px] opacity-60">
              自动压缩并保存
            </small>
          </>
        )}
      </div>
    </div>
  );
};

const CharacterEditModal = ({
  character,
  onClose,
  onSaved
}) => {
  const isNew = !character?.id;

  const [form, setForm] = useState(() => ({
    name: character?.name || '',
    code: character?.code || '',
    status: character?.status || 'ARCHIVED',
    bio: character?.bio || '',
    avatar: character?.avatar || '',
    banner: character?.banner || '',
    accent: character?.accent || '#d8d3c8',
    tone: character?.tone || DEFAULT_CHARACTER.tone,
    cameraEyebrow:
      character?.cameraEyebrow || 'Choose your perspective',
    cameraIntro: character?.cameraIntro || '',
    cameraCaption:
      character?.cameraCaption || 'use the frame to remember',
    timelineTitle: character?.timelineTitle || 'Fragments',
    timelineLabel:
      character?.timelineLabel || 'PERSONAL TIMELINE'
  }));

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      window.alert('请填写角色名称。');
      return;
    }

    const payload = {
      name: form.name.trim(),
      handle:
        character?.handle ||
        form.name.trim().toLowerCase().replace(/\s+/g, '-'),
      code: form.code.trim() || '001',
      status: form.status.trim() || 'ARCHIVED',
      bio: form.bio,
      avatar: form.avatar || DEFAULT_AVATAR,
      banner: form.banner || DEFAULT_BANNER,

      // 相机档案专用字段，直接保存在 characters 表记录中
      cameraAvatar: form.avatar || DEFAULT_AVATAR,
      cameraBanner: form.banner || DEFAULT_BANNER,
      cameraAccent: form.accent,
      cameraTone: form.tone,
      cameraEyebrow: form.cameraEyebrow,
      cameraIntro: form.cameraIntro,
      cameraCaption: form.cameraCaption,
      cameraTimelineTitle: form.timelineTitle,
      cameraTimelineLabel: form.timelineLabel,

      ...(isNew
        ? {
            cameraEvents: DEFAULT_CHARACTER.events,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        : {
            updatedAt: new Date().toISOString()
          })
    };

    try {
      let savedId = character?.id;

      if (isNew) {
        savedId = await db.characters.add(payload);
      } else {
        await db.characters.update(character.id, payload);
      }

      onSaved({
        ...character,
        ...payload,
        id: savedId,
        events: normalizeEvents(
          character?.events || DEFAULT_CHARACTER.events
        )
      });
    } catch (error) {
      console.error('保存角色失败：', error);
      window.alert(error?.message || '保存失败，请重试。');
    }
  };

  return (
    <div className="camera-modal-mask">
      <div className="camera-modal">
        <div className="camera-modal-header">
          <div>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[.18em] opacity-45">
              Personal Archive
            </p>
            <h3>{isNew ? '新增角色' : '编辑角色档案'}</h3>
          </div>

          <button
            type="button"
            className="camera-modal-close"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="camera-upload-grid">
          <ImageUploadBox
            label="上传头像"
            image={form.avatar}
            compressOptions={{
              maxWidth: 800,
              maxHeight: 800
            }}
            onChange={(value) => updateField('avatar', value)}
          />

          <ImageUploadBox
            label="上传 Banner"
            image={form.banner}
            compressOptions={{
              maxWidth: 1800,
              maxHeight: 1200
            }}
            onChange={(value) => updateField('banner', value)}
          />
        </div>

        <div className="camera-form-grid">
          <div className="camera-form-field">
            <label>角色名称</label>
            <input
              value={form.name}
              onChange={(event) =>
                updateField('name', event.target.value)
              }
              placeholder="例如 Mori"
            />
          </div>

          <div className="camera-form-field">
            <label>编号</label>
            <input
              value={form.code}
              onChange={(event) =>
                updateField('code', event.target.value)
              }
              placeholder="001"
            />
          </div>

          <div className="camera-form-field">
            <label>状态文字</label>
            <input
              value={form.status}
              onChange={(event) =>
                updateField('status', event.target.value)
              }
              placeholder="ARCHIVED"
            />
          </div>

          <div className="camera-form-field">
            <label>强调色</label>
            <input
              type="text"
              value={form.accent}
              onChange={(event) =>
                updateField('accent', event.target.value)
              }
              placeholder="#d8d3c8"
            />
          </div>

          <div className="camera-form-field full">
            <label>角色描述</label>
            <textarea
              value={form.bio}
              onChange={(event) =>
                updateField('bio', event.target.value)
              }
              placeholder="填写角色介绍"
            />
          </div>

          <div className="camera-form-field">
            <label>顶部装饰文字</label>
            <input
              value={form.cameraEyebrow}
              onChange={(event) =>
                updateField('cameraEyebrow', event.target.value)
              }
              placeholder="Choose your perspective"
            />
          </div>

          <div className="camera-form-field">
            <label>相机底部文字</label>
            <input
              value={form.cameraCaption}
              onChange={(event) =>
                updateField('cameraCaption', event.target.value)
              }
              placeholder="use the frame to remember"
            />
          </div>

          <div className="camera-form-field full">
            <label>页面介绍文字</label>
            <textarea
              value={form.cameraIntro}
              onChange={(event) =>
                updateField('cameraIntro', event.target.value)
              }
              placeholder="填写页面顶部介绍"
            />
          </div>

          <div className="camera-form-field">
            <label>时间线标题</label>
            <input
              value={form.timelineTitle}
              onChange={(event) =>
                updateField('timelineTitle', event.target.value)
              }
              placeholder="Fragments"
            />
          </div>

          <div className="camera-form-field">
            <label>时间线副标题</label>
            <input
              value={form.timelineLabel}
              onChange={(event) =>
                updateField('timelineLabel', event.target.value)
              }
              placeholder="PERSONAL TIMELINE"
            />
          </div>
        </div>

        <div className="camera-modal-footer">
          <button
            type="button"
            className="camera-secondary-button"
            onClick={onClose}
          >
            取消
          </button>

          <button
            type="button"
            className="camera-primary-button inline-flex items-center gap-2"
            onClick={handleSave}
          >
            <Save className="h-4 w-4" />
            保存档案
          </button>
        </div>
      </div>
    </div>
  );
};

const EventEditModal = ({
  event,
  onClose,
  onSaved
}) => {
  const [form, setForm] = useState({
    date: event?.date || '',
    title: event?.title || '',
    content: event?.content || ''
  });

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      window.alert('请填写时间线标题。');
      return;
    }

    onSaved({
      date: form.date.trim(),
      title: form.title.trim(),
      content: form.content.trim()
    });
  };

  return (
    <div className="camera-modal-mask">
      <div className="camera-modal" style={{ maxWidth: 480 }}>
        <div className="camera-modal-header">
          <h3>{event ? '编辑时间线' : '新增时间线'}</h3>

          <button
            type="button"
            className="camera-modal-close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="camera-form-field">
            <label>日期</label>
            <input
              value={form.date}
              onChange={(event) =>
                updateField('date', event.target.value)
              }
              placeholder="2026.09.12"
            />
          </div>

          <div className="camera-form-field">
            <label>标题</label>
            <input
              value={form.title}
              onChange={(event) =>
                updateField('title', event.target.value)
              }
              placeholder="例如：雨停以后"
            />
          </div>

          <div className="camera-form-field">
            <label>内容</label>
            <textarea
              value={form.content}
              onChange={(event) =>
                updateField('content', event.target.value)
              }
              placeholder="填写这段时间线的内容"
            />
          </div>
        </div>

        <div className="camera-modal-footer">
          <button
            type="button"
            className="camera-secondary-button"
            onClick={onClose}
          >
            取消
          </button>

          <button
            type="button"
            className="camera-primary-button inline-flex items-center gap-2"
            onClick={handleSave}
          >
            <Check className="h-4 w-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

const WorkflowFormSheet = ({
  chat,
  workflow,
  onClose,
  onSaved
}) => {
  const isEdit = Boolean(workflow);

  const [name, setName] = useState(workflow?.name || '');
  const [time, setTime] = useState(workflow?.time || '08:00');
  const [weekdays, setWeekdays] = useState(
    workflow?.weekdays || [0, 1, 2, 3, 4, 5, 6]
  );
  const [goal, setGoal] = useState(workflow?.goal || '');
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  const targetChat = workflow?.chat || chat;

  const handleSave = async () => {
    if (!time) {
      window.alert('请填写触发时间。');
      return;
    }

    if (!weekdays.length) {
      window.alert('请至少选择一个星期。');
      return;
    }

    if (!targetChat && !isEdit) {
      window.alert('没有找到可绑定的聊天。');
      return;
    }

    setSaving(true);

    try {
      if (isEdit) {
        await updateWorkflow(workflow.id, {
          name,
          time,
          weekdays,
          goal,
          enabled
        });
      } else {
        await createWorkflow({
          chatId: targetChat.id,
          characterId: targetChat.characterId,
          name,
          time,
          weekdays,
          goal,
          enabled
        });
      }

      onSaved();
    } catch (error) {
      console.error('保存工作流失败：', error);
      window.alert(error?.message || '保存工作流失败。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="camera-modal-mask">
      <div className="camera-modal" style={{ maxWidth: 500 }}>
        <div className="camera-modal-header">
          <div>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[.18em] opacity-45">
              {targetChat?.character?.name || 'Character'}
            </p>
            <h3>{isEdit ? '编辑工作流' : '新建工作流'}</h3>
          </div>

          <button
            type="button"
            className="camera-modal-close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="camera-form-field">
            <label>名称</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="比如：早安问候"
            />
          </div>

          <div className="camera-form-grid">
            <div className="camera-form-field">
              <label>时间</label>
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>

            <div className="camera-form-field">
              <label>启用状态</label>
              <button
                type="button"
                onClick={() => setEnabled((value) => !value)}
                className="camera-small-button w-full"
              >
                {enabled ? '已启用' : '已暂停'}
              </button>
            </div>
          </div>

          <div className="camera-form-field">
            <label>重复星期</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, index) => {
                const active = weekdays.includes(index);

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setWeekdays((previous) =>
                        active
                          ? previous.filter((day) => day !== index)
                          : [...previous, index].sort()
                      );
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border text-xs"
                    style={{
                      borderColor: '#555',
                      background: active ? '#eee' : 'transparent',
                      color: active ? '#111' : '#eee'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="camera-form-field">
            <label>目标 / 意图</label>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="告诉 AI 这次主动联系想做什么"
            />
          </div>
        </div>

        <div className="camera-modal-footer">
          <button
            type="button"
            className="camera-secondary-button"
            onClick={onClose}
          >
            取消
          </button>

          <button
            type="button"
            className="camera-primary-button"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? '保存中…' : '保存工作流'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatPickerModal = ({
  chats,
  onPick,
  onClose
}) => {
  return (
    <div className="camera-modal-mask">
      <div className="camera-modal" style={{ maxWidth: 500 }}>
        <div className="camera-modal-header">
          <h3>选择聊天</h3>

          <button
            type="button"
            className="camera-modal-close"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!chats.length ? (
          <div className="camera-empty">
            还没有可绑定的聊天。
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => onPick(chat)}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left"
                style={{ borderColor: '#555' }}
              >
                <img
                  src={chat.character?.avatar || DEFAULT_AVATAR}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {chat.character?.name || '未知角色'}
                  </p>
                  <p className="truncate text-[11px] opacity-55">
                    {chat.title || '默认对话'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const WorkflowList = ({
  workflows,
  onEdit,
  onReload
}) => {
  const [confirmingId, setConfirmingId] = useState(null);

  const activeCount = workflows.filter(
    (workflow) => workflow.enabled
  ).length;

  const handleToggle = async (workflow) => {
    try {
      await setWorkflowEnabled(workflow.id, !workflow.enabled);
      await onReload();
    } catch (error) {
      window.alert(error?.message || '更新工作流失败。');
    }
  };

  const handleDelete = async (workflow) => {
    try {
      await deleteWorkflow(workflow.id);
      setConfirmingId(null);
      await onReload();
    } catch (error) {
      window.alert(error?.message || '删除工作流失败。');
    }
  };

  return (
    <section className="mt-12 border-t border-white/15 pt-7">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[.18em] opacity-45">
            Standing Routines
          </p>
          <h2 className="font-serif text-3xl font-normal">
            工作流
          </h2>
        </div>

        <span className="font-mono text-[10px] opacity-50">
          {activeCount} / {workflows.length} ACTIVE
        </span>
      </div>

      {!workflows.length ? (
        <p className="camera-empty">
          还没有工作流。
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workflows.map((workflow) => (
            <article
              key={workflow.id}
              className="rounded-xl border border-white/15 bg-white/[.04] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg">
                    {workflow.name || '未命名工作流'}
                  </p>

                  <p className="mt-1 text-[11px] opacity-55">
                    {workflow.time || '--:--'} ·{' '}
                    {formatWeekdays(workflow.weekdays)}
                  </p>
                </div>

                <button
                  type="button"
                  className="camera-small-button shrink-0"
                  onClick={() => handleToggle(workflow)}
                >
                  {workflow.enabled ? '暂停' : '启用'}
                </button>
              </div>

              {workflow.goal && (
                <p className="mt-3 border-l border-white/30 pl-3 font-serif text-xs italic leading-relaxed opacity-70">
                  “{workflow.goal}”
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <div>{getWorkflowStatus(workflow)}</div>

                {confirmingId === workflow.id ? (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="opacity-60">确认删除？</span>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => handleDelete(workflow)}
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      className="opacity-60"
                      onClick={() => setConfirmingId(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="opacity-55 hover:opacity-100"
                      onClick={() => onEdit(workflow)}
                      aria-label="编辑工作流"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      className="opacity-55 hover:opacity-100"
                      onClick={() => setConfirmingId(workflow.id)}
                      aria-label="删除工作流"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export const WorkflowApp = ({ onBackHub }) => {
  const [characters, setCharacters] = useState([]);
  const [current, setCurrent] = useState(0);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [lightMode, setLightMode] = useState(false);

  const [editingCharacter, setEditingCharacter] = useState(null);
  const [editingEventIndex, setEditingEventIndex] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);

  const [workflows, setWorkflows] = useState([]);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [workflowForm, setWorkflowForm] = useState(null);
  const [candidateChats, setCandidateChats] = useState([]);
  const [showChatPicker, setShowChatPicker] = useState(false);

  const stripRef = useRef(null);

  const activeCharacter = characters[current];

  const reloadCharacters = useCallback(async () => {
    setLoadingCharacters(true);

    try {
      const records = await db.characters.toArray();

      if (!records.length) {
        const createdCharacters = [];

        for (const item of DEFAULT_CHARACTERS) {
          const id = await db.characters.add({
            ...item,
            avatar: item.avatar,
            banner: item.banner,
            cameraAvatar: item.avatar,
            cameraBanner: item.banner,
            cameraBio: item.bio,
            cameraAccent: item.accent,
            cameraTone: item.tone,
            cameraEyebrow: item.cameraEyebrow,
            cameraIntro: item.cameraIntro,
            cameraCaption: item.cameraCaption,
            cameraTimelineTitle: item.timelineTitle,
            cameraTimelineLabel: item.timelineLabel,
            cameraEvents: item.events,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          createdCharacters.push({
            ...item,
            id
          });
        }

        setCharacters(createdCharacters.map(normalizeCharacter));
      } else {
        setCharacters(records.map(normalizeCharacter));
      }
    } catch (error) {
      console.error('读取角色失败：', error);
      setCharacters(DEFAULT_CHARACTERS.map(normalizeCharacter));
    } finally {
      setLoadingCharacters(false);
    }
  }, []);

  const reloadWorkflows = useCallback(async () => {
    setWorkflowLoading(true);

    try {
      const data = await getAllWorkflowsWithContext();
      setWorkflows(data);
    } catch (error) {
      console.error('读取工作流失败：', error);
    } finally {
      setWorkflowLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadCharacters();
    void reloadWorkflows();
  }, [reloadCharacters, reloadWorkflows]);

  useEffect(() => {
    if (!activeCharacter) return;

    document.documentElement.style.setProperty(
      '--camera-accent',
      activeCharacter.accent || '#d8d3c8'
    );

    document.documentElement.style.setProperty(
      '--camera-tone',
      activeCharacter.tone || DEFAULT_CHARACTER.tone
    );
  }, [activeCharacter]);

  const selectCharacter = (index, scroll = true) => {
    if (!characters.length) return;

    const nextIndex =
      (index + characters.length) % characters.length;

    setCurrent(nextIndex);

    if (scroll) {
      window.setTimeout(() => {
        stripRef.current?.children[nextIndex]?.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest'
        });
      }, 30);
    }
  };

  const saveCharacterToState = (savedCharacter) => {
    const normalized = normalizeCharacter(savedCharacter);

    setCharacters((previous) => {
      const exists = previous.some(
        (character) => character.id === normalized.id
      );

      if (!exists) {
        return [...previous, normalized];
      }

      return previous.map((character) =>
        character.id === normalized.id ? normalized : character
      );
    });

    const savedIndex = characters.findIndex(
      (character) => character.id === normalized.id
    );

    if (savedIndex >= 0) {
      setCurrent(savedIndex);
    } else {
      setCurrent(characters.length);
    }

    setEditingCharacter(null);
  };

  const persistEvents = async (events) => {
    if (!activeCharacter?.id) return;

    const normalizedEvents = normalizeEvents(events);

    await db.characters.update(activeCharacter.id, {
      cameraEvents: normalizedEvents,
      updatedAt: new Date().toISOString()
    });

    setCharacters((previous) =>
      previous.map((character) =>
        character.id === activeCharacter.id
          ? {
              ...character,
              events: normalizedEvents
            }
          : character
      )
    );
  };

  const openEventEditor = (index = null) => {
    setEditingEventIndex(index);
    setShowEventModal(true);
  };

  const handleEventSaved = async (event) => {
    const previousEvents = activeCharacter?.events || [];
    const nextEvents = [...previousEvents];

    if (editingEventIndex === null) {
      nextEvents.unshift(event);
    } else {
      nextEvents[editingEventIndex] = event;
    }

    try {
      await persistEvents(nextEvents);
      setShowEventModal(false);
      setEditingEventIndex(null);
    } catch (error) {
      window.alert(error?.message || '保存时间线失败。');
    }
  };

  const deleteEvent = async (index) => {
    const confirmed = window.confirm('确定删除这条时间线吗？');
    if (!confirmed) return;

    const nextEvents = (activeCharacter?.events || []).filter(
      (_, eventIndex) => eventIndex !== index
    );

    try {
      await persistEvents(nextEvents);
    } catch (error) {
      window.alert(error?.message || '删除时间线失败。');
    }
  };

  const handleOpenWorkflowCreate = async () => {
    try {
      const chats = await getWorkflowCandidateChats();
      setCandidateChats(chats);
      setShowChatPicker(true);
    } catch (error) {
      window.alert(error?.message || '读取聊天列表失败。');
    }
  };

  const visibleWorkflows = useMemo(() => {
    if (!activeCharacter?.id) return [];

    return workflows.filter(
      (workflow) =>
        String(workflow.characterId) === String(activeCharacter.id)
    );
  }, [activeCharacter, workflows]);

  if (loadingCharacters) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center opacity-60">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在读取角色档案…
      </div>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <div className={`camera-page ${lightMode ? 'light' : ''}`}>
        <div className="camera-noise" />

        <div className="camera-content">
          <header className="camera-topbar">
            <button
              type="button"
              className="camera-ghost-button"
              onClick={onBackHub}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回
            </button>

            <div className="camera-brand">
              PRIVATE ARCHIVE / 2026
            </div>

            <div className="camera-top-actions">
              <button
                type="button"
                className="camera-ghost-button"
                onClick={() =>
                  selectCharacter(
                    Math.floor(Math.random() * characters.length)
                  )
                }
              >
                <Shuffle className="h-3.5 w-3.5" />
                随机角色
              </button>

              <button
                type="button"
                className="camera-ghost-button"
                onClick={() => setLightMode((value) => !value)}
              >
                <span className="camera-dot" />
                {lightMode ? '暗房氛围' : '浅色氛围'}
              </button>
            </div>
          </header>

          <main>
            <section className="camera-intro">
              <div>
                <p className="camera-eyebrow">
                  {activeCharacter?.cameraEyebrow}
                </p>

                <h1 className="camera-heading">
                  Who
                  <br />
                  are you?
                </h1>
              </div>

              <p className="camera-intro-copy">
                {activeCharacter?.cameraIntro}
              </p>
            </section>

            <section className="camera-stage">
              <div className="camera-glow" />

              <div className="camera-object">
                <div className="camera-body">
                  <div className="camera-shutter" />
                  <div className="camera-flash" />

                  <div className="camera-viewfinder">
                    <div
                      className="camera-banner"
                      style={{
                        backgroundImage: `url("${activeCharacter?.banner}")`
                      }}
                    />

                    <div className="camera-focus">
                      FOCUS <span>●</span>
                    </div>

                    <div className="camera-info">
                      <div className="camera-name">
                        {activeCharacter?.name?.toUpperCase()}
                      </div>

                      <div className="camera-number">
                        NO. {activeCharacter?.code} /{' '}
                        {String(characters.length).padStart(2, '0')}
                      </div>
                    </div>
                  </div>

                  <div className="camera-caption">
                    {activeCharacter?.cameraCaption}
                  </div>

                  <div className="camera-lens" />
                </div>

                <div className="camera-side">
                  <button
                    type="button"
                    onClick={() => selectCharacter(current - 1)}
                    aria-label="上一个角色"
                  >
                    <ChevronLeft className="mx-auto h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => selectCharacter(current + 1)}
                    aria-label="下一个角色"
                  >
                    <ChevronRight className="mx-auto h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>

            <section className="camera-selector">
              <div className="camera-selector-head">
                <span className="camera-selector-title">
                  The portraits
                </span>

                <span className="camera-swipe-hint">
                  ← swipe / drag →
                </span>
              </div>

              <div
                ref={stripRef}
                className="camera-strip"
              >
                {characters.map((character, index) => (
                  <button
                    key={character.id || index}
                    type="button"
                    className={`camera-character-card ${
                      index === current ? 'active' : ''
                    }`}
                    onClick={() => selectCharacter(index)}
                  >
                    <span className="camera-card-id">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <img
                      src={character.avatar}
                      alt={character.name}
                    />

                    <span className="camera-card-meta">
                      <strong>{character.name}</strong>
                      <small>{character.status}</small>
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  className="camera-new-card"
                  onClick={() =>
                    setEditingCharacter({
                      ...normalizeCharacter({
                        ...DEFAULT_CHARACTER,
                        id: null,
                        name: '',
                        code: String(characters.length + 1).padStart(3, '0')
                      }),
                      id: null
                    })
                  }
                >
                  <strong>＋</strong>
                  <span>NEW CHARACTER</span>
                </button>
              </div>
            </section>

            {activeCharacter && (
              <section className="camera-profile">
                <div className="camera-profile-left">
                  <img
                    className="camera-avatar"
                    src={activeCharacter.avatar}
                    alt={`${activeCharacter.name} 头像`}
                  />

                  <h2 className="camera-profile-title">
                    {activeCharacter.name}
                  </h2>

                  <p className="camera-profile-desc">
                    {activeCharacter.bio}
                  </p>
                </div>

                <div>
                  <div className="camera-profile-topline">
                    <span>
                      CHARACTER / {activeCharacter.code}
                    </span>

                    <span>{activeCharacter.status}</span>
                  </div>

                  <div className="camera-edit-tools">
                    <button
                      type="button"
                      className="camera-small-button"
                      onClick={() =>
                        setEditingCharacter(activeCharacter)
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      编辑页面
                    </button>

                    <button
                      type="button"
                      className="camera-small-button"
                      onClick={() => openEventEditor(null)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      新增时间线
                    </button>

                    <button
                      type="button"
                      className="camera-small-button"
                      onClick={handleOpenWorkflowCreate}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      新建工作流
                    </button>
                  </div>

                  <div className="camera-timeline-title">
                    <h2>{activeCharacter.timelineTitle}</h2>
                    <span>{activeCharacter.timelineLabel}</span>
                  </div>

                  <div className="camera-timeline">
                    {!activeCharacter.events.length ? (
                      <p className="camera-empty">
                        还没有时间线内容。
                      </p>
                    ) : (
                      activeCharacter.events.map((event, index) => (
                        <article
                          className="camera-event"
                          key={`${event.date}-${event.title}-${index}`}
                        >
                          <div className="camera-event-date">
                            {event.date}
                          </div>

                          <h3>
                            {event.title}

                            <span className="camera-event-actions">
                              <button
                                type="button"
                                onClick={() => openEventEditor(index)}
                                aria-label="编辑时间线"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteEvent(index)}
                                aria-label="删除时间线"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          </h3>

                          <p>{event.content}</p>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}

            <WorkflowList
              workflows={visibleWorkflows}
              onEdit={(workflow) =>
                setWorkflowForm({ workflow })
              }
              onReload={reloadWorkflows}
            />

            <div className="camera-footer">
              <span>
                NO FIXED NAVIGATION / JUST FOLLOW THE LIGHT
              </span>
              <span>↘ END OF FRAME</span>
            </div>
          </main>
        </div>

        <button
          type="button"
          className="camera-floating-button"
          title="编辑当前页面"
          onClick={() =>
            activeCharacter &&
            setEditingCharacter(activeCharacter)
          }
        >
          <ImageIcon className="h-5 w-5" />
        </button>

        {editingCharacter && (
          <CharacterEditModal
            character={editingCharacter}
            onClose={() => setEditingCharacter(null)}
            onSaved={(savedCharacter) => {
              saveCharacterToState(savedCharacter);
            }}
          />
        )}

        {showEventModal && (
          <EventEditModal
            event={
              editingEventIndex === null
                ? null
                : activeCharacter?.events?.[editingEventIndex]
            }
            onClose={() => {
              setShowEventModal(false);
              setEditingEventIndex(null);
            }}
            onSaved={handleEventSaved}
          />
        )}

        {showChatPicker && (
          <ChatPickerModal
            chats={candidateChats}
            onClose={() => setShowChatPicker(false)}
            onPick={(chat) => {
              setShowChatPicker(false);
              setWorkflowForm({ chat });
            }}
          />
        )}

        {workflowForm && (
          <WorkflowFormSheet
            chat={workflowForm.chat}
            workflow={workflowForm.workflow}
            onClose={() => setWorkflowForm(null)}
            onSaved={() => {
              setWorkflowForm(null);
              void reloadWorkflows();
            }}
          />
        )}

        {workflowLoading && (
          <div className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-[11px] text-white">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            工作流同步中
          </div>
        )}
      </div>
    </>
  );
};

export default WorkflowApp;
