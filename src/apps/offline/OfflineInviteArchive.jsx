// src/apps/offline/OfflineInviteArchive.jsx
//
// 全屏版邀约收纳室。
// 三个 tab：进行中（待回应/倒计时/可进入）、已完成、未成行（拒绝/取消）。
// 每张卡片是「标题 + 时间」的头部，下面一排小胶囊标签展示状态、消息数、发起人，
// 有心情或天气快照的话也会带出来（复用 offlineSceneStatusService 写的字段）。
//
// 数据来源仍然是 offlineSessionService.js 里的 getAllOfflineSessionsForChat(chatId)，
// 额外查了一次每个 session 的线下消息条数用来展示消息标签，
// 不新增数据表，只读不写。

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BanIcon,
  CalendarClockIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleXIcon,
  DoorOpenIcon,
  HourglassIcon,
  MessageCircleIcon,
} from 'lucide-animated';

import db from '../../db';
import { getAllOfflineSessionsForChat } from './offlineSessionService';

const formatDateTime = (value) => {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString('zh-CN', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
  } catch {
    return '';
  }
};

const STATUS_META = {
  pending_review: {
    label: '等待回应',
    icon: HourglassIcon,
    tint: '#666d7b',
  },
  scheduled: {
    label: '倒计时中',
    icon: CalendarClockIcon,
    tint: '#24262b',
  },
  active: {
    label: '可以进入',
    icon: DoorOpenIcon,
    tint: '#111216',
  },
  completed: {
    label: '已完成',
    icon: CircleCheckIcon,
    tint: '#555b68',
  },
  declined: {
    label: '被拒绝了',
    icon: CircleXIcon,
    tint: '#8b5555',
  },
  cancelled: {
    label: '已取消',
    icon: BanIcon,
    tint: '#8b5555',
  },
};

const TABS = [
  {
    key: 'ongoing',
    label: '进行中',
    statuses: ['pending_review', 'scheduled', 'active'],
  },
  {
    key: 'completed',
    label: '已完成',
    statuses: ['completed'],
  },
  {
    key: 'inactive',
    label: '未成行',
    statuses: ['declined', 'cancelled'],
  },
];

const ARCHIVE_STYLES = `
  .offline-archive,
  .offline-archive * {
    box-sizing: border-box;
  }

  .offline-archive {
    --archive-bg: #eef0f4;
    --archive-ink: #111216;
    --archive-muted: #777e8c;
    --archive-soft-ink: #5e6571;
    --archive-glass: rgba(255, 255, 255, 0.58);
    --archive-glass-strong: rgba(255, 255, 255, 0.78);
    --archive-glass-border: rgba(255, 255, 255, 0.78);
    --archive-shadow:
      0 24px 60px rgba(23, 28, 38, 0.09),
      0 8px 20px rgba(23, 28, 38, 0.06),
      inset 0 1px 1px rgba(255, 255, 255, 0.92),
      inset 0 -1px 2px rgba(20, 22, 28, 0.035);

    position: fixed;
    isolation: isolate;
    inset: 0;
    z-index: 70;
    display: flex;
    width: 100%;
    height: 100dvh;
    flex-direction: column;
    overflow: hidden;
    color: var(--archive-ink);
    background:
      radial-gradient(
        circle at 4% 7%,
        rgba(220, 225, 234, 0.85) 0,
        rgba(220, 225, 234, 0.28) 19%,
        transparent 47%
      ),
      radial-gradient(
        circle at 96% 90%,
        rgba(232, 227, 222, 0.78) 0,
        rgba(232, 227, 222, 0.22) 20%,
        transparent 48%
      ),
      radial-gradient(
        circle at 52% 48%,
        rgba(255, 255, 255, 0.9) 0,
        rgba(255, 255, 255, 0.32) 30%,
        transparent 70%
      ),
      var(--archive-bg);
    -webkit-font-smoothing: antialiased;
  }

  .offline-archive::before {
    position: absolute;
    z-index: -1;
    inset: 0;
    pointer-events: none;
    content: '';
    opacity: 0.22;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.14) 1px, transparent 1px);
    background-size: 42px 42px;
    mask-image: linear-gradient(to bottom, black, transparent 82%);
  }

  .archive-ambient {
    position: absolute;
    z-index: -1;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .archive-orb {
    position: absolute;
    border-radius: 999px;
    filter: blur(48px);
    opacity: 0.56;
    animation: archiveOrbFloat 16s ease-in-out infinite alternate;
  }

  .archive-orb--light {
    top: -110px;
    left: -90px;
    width: 300px;
    height: 300px;
    background: rgba(255, 255, 255, 0.94);
  }

  .archive-orb--cool {
    top: 34%;
    right: -125px;
    width: 300px;
    height: 300px;
    background: rgba(208, 215, 227, 0.72);
    animation-delay: -5s;
  }

  .archive-orb--warm {
    bottom: -135px;
    left: 8%;
    width: 300px;
    height: 300px;
    background: rgba(230, 224, 218, 0.74);
    animation-delay: -10s;
  }

  @keyframes archiveOrbFloat {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }

    50% {
      transform: translate3d(20px, 25px, 0) scale(1.08);
    }

    100% {
      transform: translate3d(-16px, -20px, 0) scale(0.94);
    }
  }

  .archive-header {
    position: relative;
    z-index: 3;
    flex: 0 0 auto;
    padding: calc(env(safe-area-inset-top, 0px) + 18px) 20px 10px;
  }

  .archive-header__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .archive-back-button,
  .archive-mark {
    display: flex;
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    align-items: center;
    justify-content: center;
    color: var(--archive-ink);
    border: 1px solid var(--archive-glass-border);
    border-radius: 15px;
    outline: none;
    background: rgba(255, 255, 255, 0.52);
    box-shadow:
      0 8px 18px rgba(20, 24, 31, 0.055),
      inset 0 1px 1px rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(18px) saturate(145%);
    -webkit-backdrop-filter: blur(18px) saturate(145%);
  }

  .archive-back-button {
    cursor: pointer;
    transition:
      transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
      background 220ms ease,
      box-shadow 220ms ease;
  }

  .archive-back-button:hover {
    background: rgba(255, 255, 255, 0.78);
    box-shadow:
      0 12px 24px rgba(20, 24, 31, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.96);
  }

  .archive-back-button:active {
    transform: scale(0.91);
  }

  .archive-back-button > div,
  .archive-mark > div,
  .invite-card__status-icon > div,
  .invite-pocket__seal > div,
  .invite-tile > div,
  .archive-empty__icon > div {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .archive-heading {
    min-width: 0;
    flex: 1;
    padding: 0 2px;
  }

  .archive-kicker {
    margin: 1px 0 7px;
    color: var(--archive-muted);
    font-size: 9px;
    font-weight: 760;
    letter-spacing: 0.19em;
    line-height: 1;
    text-transform: uppercase;
  }

  .archive-title {
    margin: 0;
    color: var(--archive-ink);
    font-size: clamp(27px, 7vw, 34px);
    font-weight: 780;
    letter-spacing: -0.065em;
    line-height: 1;
  }

  .archive-subtitle {
    margin: 9px 0 0;
    overflow: hidden;
    color: var(--archive-muted);
    font-size: 11px;
    font-weight: 520;
    letter-spacing: 0.01em;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .archive-mark {
    color: #22252b;
    background:
      linear-gradient(
        145deg,
        rgba(255, 255, 255, 0.9),
        rgba(255, 255, 255, 0.42)
      );
  }

  .archive-tabs {
    position: relative;
    display: flex;
    gap: 5px;
    margin-top: 22px;
    padding: 5px;
    overflow-x: auto;
    border: 1px solid rgba(255, 255, 255, 0.66);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.34);
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.85),
      0 8px 24px rgba(29, 33, 40, 0.035);
    backdrop-filter: blur(24px) saturate(145%);
    -webkit-backdrop-filter: blur(24px) saturate(145%);
    scrollbar-width: none;
  }

  .archive-tabs::-webkit-scrollbar {
    display: none;
  }

  .archive-tab {
    position: relative;
    display: inline-flex;
    min-width: max-content;
    flex: 1 0 auto;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 35px;
    padding: 0 14px;
    color: var(--archive-soft-ink);
    border: 1px solid transparent;
    border-radius: 12px;
    outline: none;
    background: transparent;
    font-size: 11px;
    font-weight: 680;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition:
      color 220ms ease,
      background 220ms ease,
      box-shadow 220ms ease,
      transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .archive-tab:hover {
    color: var(--archive-ink);
    background: rgba(255, 255, 255, 0.44);
  }

  .archive-tab:active {
    transform: scale(0.96);
  }

  .archive-tab.is-active {
    color: #ffffff;
    border-color: rgba(12, 13, 16, 0.96);
    background: #0f1013;
    box-shadow:
      0 8px 16px rgba(11, 12, 15, 0.19),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .archive-tab__count {
    display: inline-flex;
    min-width: 18px;
    height: 18px;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    border-radius: 999px;
    color: inherit;
    background: rgba(15, 16, 19, 0.07);
    font-size: 9px;
    font-weight: 760;
    line-height: 1;
  }

  .archive-tab.is-active .archive-tab__count {
    background: rgba(255, 255, 255, 0.2);
  }

  .archive-scroll {
    position: relative;
    z-index: 2;
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px calc(34px + env(safe-area-inset-bottom, 0px));
    scroll-behavior: smooth;
    scrollbar-width: none;
  }

  .archive-scroll::-webkit-scrollbar {
    display: none;
  }

  .invite-list {
    display: grid;
    width: min(100%, 760px);
    gap: 14px;
    margin: 0 auto;
  }

  .invite-card {
    position: relative;
    display: block;
    width: 100%;
    min-height: 232px;
    padding: 10px;
    overflow: hidden;
    color: var(--archive-ink);
    text-align: left;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 27px;
    outline: none;
    background:
      linear-gradient(
        145deg,
        rgba(255, 255, 255, 0.73),
        rgba(255, 255, 255, 0.32)
      );
    box-shadow: var(--archive-shadow);
    backdrop-filter: blur(26px) saturate(155%);
    -webkit-backdrop-filter: blur(26px) saturate(155%);
    transition:
      transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
      box-shadow 320ms ease,
      border-color 320ms ease,
      opacity 220ms ease;
  }

  .invite-card::before {
    position: absolute;
    top: -70px;
    right: -52px;
    width: 180px;
    height: 180px;
    border-radius: 999px;
    pointer-events: none;
    content: '';
    background: rgba(255, 255, 255, 0.43);
    filter: blur(12px);
  }

  .invite-card:not(:disabled) {
    cursor: pointer;
  }

  .invite-card:not(:disabled):hover {
    border-color: rgba(255, 255, 255, 0.96);
    box-shadow:
      0 30px 70px rgba(23, 28, 38, 0.13),
      0 10px 24px rgba(23, 28, 38, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.96),
      inset 0 -1px 2px rgba(20, 22, 28, 0.035);
    transform: translateY(-3px);
  }

  .invite-card:active:not(:disabled) {
    transform: scale(0.985);
  }

  .invite-card.is-enterable {
    border-color: rgba(19, 20, 24, 0.17);
  }

  .invite-card.is-muted {
    opacity: 0.63;
  }

  .invite-card__art {
    position: relative;
    height: 116px;
    overflow: hidden;
    border-radius: 20px;
    background:
      radial-gradient(
        circle at 78% 24%,
        rgba(255, 255, 255, 0.82),
        transparent 32%
      ),
      linear-gradient(
        145deg,
        rgba(231, 234, 240, 0.72),
        rgba(212, 216, 224, 0.43)
      );
  }

  .status-active .invite-card__art {
    background:
      radial-gradient(
        circle at 78% 20%,
        rgba(255, 255, 255, 0.92),
        transparent 34%
      ),
      linear-gradient(
        145deg,
        rgba(247, 247, 247, 0.78),
        rgba(205, 209, 217, 0.48)
      );
  }

  .status-scheduled .invite-card__art {
    background:
      radial-gradient(
        circle at 20% 15%,
        rgba(255, 255, 255, 0.92),
        transparent 35%
      ),
      linear-gradient(
        145deg,
        rgba(236, 238, 242, 0.82),
        rgba(216, 218, 224, 0.52)
      );
  }

  .status-declined .invite-card__art,
  .status-cancelled .invite-card__art {
    background:
      radial-gradient(
        circle at 80% 18%,
        rgba(255, 255, 255, 0.76),
        transparent 34%
      ),
      linear-gradient(
        145deg,
        rgba(230, 231, 234, 0.74),
        rgba(205, 207, 212, 0.46)
      );
  }

  .invite-card__art::after {
    position: absolute;
    right: 14px;
    bottom: 11px;
    width: 65%;
    height: 1px;
    content: '';
    background: linear-gradient(
      90deg,
      transparent,
      rgba(17, 18, 22, 0.1),
      transparent
    );
  }

  .invite-paper {
    position: absolute;
    width: 68%;
    height: 82px;
    border: 1px solid rgba(255, 255, 255, 0.68);
    border-radius: 13px 13px 7px 7px;
    box-shadow:
      0 8px 17px rgba(24, 28, 35, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.92);
    transition: transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .invite-paper::before {
    position: absolute;
    top: 20px;
    left: 16px;
    width: 43%;
    height: 5px;
    border-radius: 99px;
    content: '';
    background: rgba(18, 20, 24, 0.12);
    box-shadow:
      0 12px 0 rgba(18, 20, 24, 0.075),
      0 24px 0 rgba(18, 20, 24, 0.055);
  }

  .invite-paper--back {
    top: 7px;
    left: 24px;
    transform: rotate(-5deg);
    background: rgba(250, 251, 252, 0.79);
  }

  .invite-paper--front {
    top: 8px;
    left: 42px;
    z-index: 1;
    transform: rotate(4deg);
    background: rgba(255, 255, 255, 0.83);
  }

  .invite-card:hover .invite-paper--back {
    transform: translateY(-8px) rotate(-8deg);
  }

  .invite-card:hover .invite-paper--front {
    transform: translateY(-11px) rotate(7deg);
  }

  .invite-pocket {
    position: absolute;
    z-index: 2;
    right: 10px;
    bottom: 9px;
    left: 10px;
    height: 72px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 10px 22px 17px 17px;
    background:
      linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.69),
        rgba(239, 242, 246, 0.39)
      );
    box-shadow:
      0 13px 24px rgba(20, 24, 31, 0.09),
      inset 0 1px 1px rgba(255, 255, 255, 0.94),
      inset 0 -2px 3px rgba(22, 24, 29, 0.035);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
  }

  .invite-pocket::before {
    position: absolute;
    top: -11px;
    left: -1px;
    width: 57px;
    height: 16px;
    content: '';
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-bottom: 0;
    border-radius: 10px 10px 0 0;
    background: rgba(255, 255, 255, 0.44);
  }

  .invite-pocket__label {
    position: absolute;
    bottom: 11px;
    left: 13px;
    color: rgba(25, 27, 32, 0.42);
    font-size: 8px;
    font-weight: 760;
    letter-spacing: 0.15em;
    line-height: 1;
  }

  .invite-pocket__seal {
    position: absolute;
    top: 13px;
    right: 13px;
    display: flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    color: #202228;
    border: 1px solid rgba(255, 255, 255, 0.92);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.65);
    box-shadow:
      0 5px 10px rgba(18, 20, 25, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.95);
  }

  .invite-card__body {
    position: relative;
    z-index: 2;
    padding: 13px 5px 4px;
  }

  .invite-card__heading {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .invite-card__identity {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
  }

  .invite-card__status-icon {
    display: flex;
    width: 31px;
    height: 31px;
    flex: 0 0 31px;
    align-items: center;
    justify-content: center;
    color: #24262b;
    border: 1px solid rgba(255, 255, 255, 0.86);
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.54);
    box-shadow:
      0 5px 12px rgba(25, 28, 34, 0.045),
      inset 0 1px 1px rgba(255, 255, 255, 0.9);
  }

  .invite-card__copy {
    min-width: 0;
  }

  .invite-card__title {
    overflow: hidden;
    color: var(--archive-ink);
    font-size: 14px;
    font-weight: 720;
    letter-spacing: -0.025em;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .invite-card__date {
    margin-top: 4px;
    overflow: hidden;
    color: var(--archive-muted);
    font-size: 10px;
    font-weight: 520;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .invite-card__arrow {
    flex: 0 0 16px;
    color: #22242a;
    opacity: 0.42;
    transition:
      opacity 220ms ease,
      transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .invite-card:hover .invite-card__arrow {
    opacity: 0.82;
    transform: translateX(3px);
  }

  .invite-card__tiles {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }

  .invite-tile {
    display: inline-flex;
    min-height: 22px;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    padding: 0 8px;
    overflow: hidden;
    color: var(--archive-soft-ink);
    border: 1px solid rgba(255, 255, 255, 0.68);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.4);
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.76),
      0 3px 8px rgba(23, 27, 34, 0.025);
    font-size: 9px;
    font-weight: 620;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .invite-tile__text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .archive-loading {
    display: flex;
    min-height: 180px;
    align-items: center;
    justify-content: center;
    color: var(--archive-muted);
    font-size: 11px;
    font-weight: 580;
  }

  .archive-loading__inner {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .archive-loading__ring {
    width: 15px;
    height: 15px;
    border: 1.5px solid rgba(17, 18, 22, 0.13);
    border-top-color: rgba(17, 18, 22, 0.74);
    border-radius: 999px;
    animation: archiveLoadingSpin 720ms linear infinite;
  }

  @keyframes archiveLoadingSpin {
    to {
      transform: rotate(360deg);
    }
  }

  .archive-empty {
    display: flex;
    min-height: 240px;
    align-items: center;
    justify-content: center;
    padding: 30px;
  }

  .archive-empty__card {
    display: flex;
    width: min(100%, 300px);
    flex-direction: column;
    align-items: center;
    padding: 30px 22px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 25px;
    background: rgba(255, 255, 255, 0.35);
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.8),
      0 18px 40px rgba(22, 26, 33, 0.045);
    backdrop-filter: blur(20px) saturate(145%);
    -webkit-backdrop-filter: blur(20px) saturate(145%);
  }

  .archive-empty__icon {
    display: flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    margin-bottom: 15px;
    color: #555b66;
    border: 1px solid rgba(255, 255, 255, 0.86);
    border-radius: 17px;
    background: rgba(255, 255, 255, 0.56);
    box-shadow:
      0 8px 18px rgba(22, 26, 33, 0.06),
      inset 0 1px 1px rgba(255, 255, 255, 0.94);
  }

  .archive-empty__title {
    color: var(--archive-ink);
    font-size: 13px;
    font-weight: 700;
  }

  .archive-empty__text {
    margin-top: 7px;
    color: var(--archive-muted);
    font-size: 10px;
    line-height: 1.6;
  }

  .archive-home-indicator {
    position: absolute;
    z-index: 5;
    bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    width: 112px;
    height: 4px;
    pointer-events: none;
    border-radius: 999px;
    background: rgba(16, 17, 21, 0.7);
    transform: translateX(-50%);
  }

  @media (min-width: 560px) {
    .archive-header {
      padding-right: 28px;
      padding-left: 28px;
    }

    .archive-scroll {
      padding-right: 28px;
      padding-left: 28px;
    }

    .invite-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .invite-card {
      min-height: 238px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .offline-archive *,
    .offline-archive *::before,
    .offline-archive *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

const getDateLabel = (session) => {
  if (session.status === 'completed') {
    return session.completedAt
      ? `${formatDateTime(session.completedAt)} 结束`
      : '已经结束';
  }

  if (session.status === 'declined' || session.status === 'cancelled') {
    return session.updatedAt ? formatDateTime(session.updatedAt) : '';
  }

  return session.scheduledFor
    ? formatDateTime(session.scheduledFor)
    : '时间待定';
};

const Tile = ({ label, tint, icon: TileIcon }) => (
  <span
    className="invite-tile"
    style={{ color: tint || 'var(--archive-soft-ink)' }}
  >
    {TileIcon && (
      <TileIcon
        aria-hidden="true"
        size={11}
        animateOnHover
      />
    )}

    <span className="invite-tile__text">{label}</span>
  </span>
);

const InviteCard = ({ session, onEnterScene }) => {
  const meta = STATUS_META[session.status] || {
    label: session.status,
    icon: HourglassIcon,
    tint: '#666d7b',
  };

  const StatusIcon = meta.icon;

  const isEnterable =
    session.status === 'active' || session.status === 'completed';

  const isMuted =
    session.status === 'declined' || session.status === 'cancelled';

  const handleClick = () => {
    if (!isEnterable) return;
    onEnterScene?.(session.id);
  };

  const hasSceneStatus = Boolean(
    session.sceneMood || session.sceneWeather
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isEnterable}
      className={[
        'invite-card',
        isEnterable ? 'is-enterable' : '',
        isMuted ? 'is-muted' : '',
        `status-${session.status}`,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${session.sceneLabel || '线下邀约'}，${meta.label}`}
    >
      <div className="invite-card__art" aria-hidden="true">
        <div className="invite-paper invite-paper--back" />
        <div className="invite-paper invite-paper--front" />

        <div className="invite-pocket">
          <span className="invite-pocket__label">
            INVITE ARCHIVE
          </span>

          <span
            className="invite-pocket__seal"
            style={{ color: meta.tint }}
          >
            <StatusIcon
              size={14}
              animateOnHover
              aria-hidden="true"
            />
          </span>
        </div>
      </div>

      <div className="invite-card__body">
        <div className="invite-card__heading">
          <div className="invite-card__identity">
            <div
              className="invite-card__status-icon"
              style={{ color: meta.tint }}
              aria-hidden="true"
            >
              <StatusIcon
                size={15}
                animateOnHover
              />
            </div>

            <div className="invite-card__copy">
              <div className="invite-card__title">
                {session.sceneLabel}
              </div>

              <div className="invite-card__date">
                {getDateLabel(session)}
              </div>
            </div>
          </div>

          {isEnterable && (
            <ChevronRightIcon
              className="invite-card__arrow"
              size={16}
              animateOnHover
              aria-hidden="true"
            />
          )}
        </div>

        <div className="invite-card__tiles">
          <Tile label={meta.label} tint={meta.tint} />

          {typeof session.messageCount === 'number' &&
            session.messageCount > 0 && (
              <Tile
                label={`消息 ${session.messageCount}`}
                icon={MessageCircleIcon}
              />
            )}

          {hasSceneStatus && session.sceneWeather && (
            <Tile label={session.sceneWeather} />
          )}

          {hasSceneStatus && session.sceneMood && (
            <Tile label={session.sceneMood} />
          )}

          <Tile
            label={
              session.proposedBy === 'user'
                ? '你发起的'
                : '对方发起的'
            }
          />
        </div>
      </div>
    </button>
  );
};

const OfflineInviteArchive = ({
  chatId,
  onClose,
  onEnterScene,
}) => {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ongoing');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);

      try {
        const list = await getAllOfflineSessionsForChat(chatId);

        const withCounts = await Promise.all(
          list.map(async (session) => {
            const messageCount = await db.messages
              .where('offlineSessionId')
              .equals(session.id)
              .count();

            return {
              ...session,
              messageCount,
            };
          })
        );

        if (!cancelled) {
          setSessions(withCounts);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const tabCounts = useMemo(() => {
    const counts = {};

    TABS.forEach((tab) => {
      counts[tab.key] = sessions.filter((session) =>
        tab.statuses.includes(session.status)
      ).length;
    });

    return counts;
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    const tab = TABS.find((item) => item.key === activeTab);

    if (!tab) return [];

    return sessions.filter((session) =>
      tab.statuses.includes(session.status)
    );
  }, [sessions, activeTab]);

  const activeTabLabel =
    TABS.find((tab) => tab.key === activeTab)?.label || '邀约';

  return (
    <>
      <style>{ARCHIVE_STYLES}</style>

      <div
        className="offline-archive animate-fade-in-up"
        aria-busy={isLoading}
      >
        <div className="archive-ambient" aria-hidden="true">
          <div className="archive-orb archive-orb--light" />
          <div className="archive-orb archive-orb--cool" />
          <div className="archive-orb archive-orb--warm" />
        </div>

        <header className="archive-header">
          <div className="archive-header__row">
            <button
              type="button"
              onClick={onClose}
              className="archive-back-button"
              aria-label="关闭线下邀约"
            >
              <ArrowLeftIcon
                size={18}
                animateOnHover
                aria-hidden="true"
              />
            </button>

            <div className="archive-heading">
              <div className="archive-kicker">
                Offline Archive
              </div>

              <h1 className="archive-title">线下邀约</h1>

              <p className="archive-subtitle">
                {activeTabLabel} · 保存每一次见面的时间与状态
              </p>
            </div>

            <div className="archive-mark" aria-hidden="true">
              <ArchiveIcon
                size={19}
                animateOnHover
              />
            </div>
          </div>

          <nav
            className="archive-tabs"
            aria-label="邀约状态筛选"
          >
            {TABS.map((tab) => {
              const isActive = tab.key === activeTab;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    'archive-tab',
                    isActive ? 'is-active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-selected={isActive}
                  role="tab"
                >
                  <span>{tab.label}</span>

                  {tabCounts[tab.key] > 0 && (
                    <span className="archive-tab__count">
                      {tabCounts[tab.key]}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </header>

        <section className="archive-scroll no-scrollbar">
          {isLoading && (
            <div className="archive-loading">
              <div className="archive-loading__inner">
                <span
                  className="archive-loading__ring"
                  aria-hidden="true"
                />
                <span>正在加载</span>
              </div>
            </div>
          )}

          {!isLoading && visibleSessions.length === 0 && (
            <div className="archive-empty">
              <div className="archive-empty__card">
                <div className="archive-empty__icon">
                  <ArchiveIcon
                    size={21}
                    animateOnHover
                    aria-hidden="true"
                  />
                </div>

                <div className="archive-empty__title">
                  {activeTab === 'ongoing' &&
                    '还没有进行中的邀约'}

                  {activeTab === 'completed' &&
                    '还没有完成过的线下见面'}

                  {activeTab === 'inactive' &&
                    '没有被拒绝或取消的邀约'}
                </div>

                <div className="archive-empty__text">
                  这里会收纳与你有关的线下邀约记录
                </div>
              </div>
            </div>
          )}

          {!isLoading && visibleSessions.length > 0 && (
            <div className="invite-list">
              {visibleSessions.map((session) => (
                <InviteCard
                  key={session.id}
                  session={session}
                  onEnterScene={onEnterScene}
                />
              ))}
            </div>
          )}
        </section>

        <div
          className="archive-home-indicator"
          aria-hidden="true"
        />
      </div>
    </>
  );
};

export default OfflineInviteArchive;
