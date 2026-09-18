// src/apps/hub/appGridItems.jsx
//
// 首页「各种 app」滑块里，每一块拼图的定义。每一项声明自己在网格画布里
// 占用的列数 (colSpan，1 = 半宽小卡，2 = 整行横幅卡)，行高统一为一行，
// 交给 paginateGridItems 按真实的网格排布规则拼进固定行数的页面里，再
// 由 AppSwiper 渲染成可以左右滑动的分页。
//
// 大小不同的卡片（横幅大卡 / 方形小卡 / 迷你工具条）继续保留各自原本的
// 视觉设计，只是外层统一套上 colSpan 的网格容器、并用 h-full 撑满统一的
// 行高，让每一页拼出来的总尺寸一致。

import React from 'react';
import {
  BookOpen,
  Archive,
  Compass,
  Calendar,
  Camera,
  Waves,
  Sparkles,
  Users,
  Leaf,
  Ticket,
  MailOpen,
  Clock,
  Newspaper,
  Feather,
  Repeat,
  FolderArchive,
  ArrowUpRight,
} from 'lucide-react';

import GlassCard from '../../components/GlassCard';
import AppTitle from './AppTitle';

export const buildAppGridItems = ({
  onOpenApp,
  nameMode,
  habitatCount = 0,
  askCount = 0,
  activeWorkflowCount = 0,
}) => [
  {
    id: 'margin-notes',
    colSpan: 2,
    content: (
      <GlassCard
        onClick={() => onOpenApp('margin-notes')}
        className="group h-full cursor-pointer overflow-hidden p-0 text-left"
      >
        <div className="relative flex h-full items-stretch">
          {/* 左侧书脊 */}
          <div
            className="flex w-[54px] shrink-0 flex-col items-center justify-between border-r py-3"
            style={{
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
            }}
          >
            <Feather
              className="h-4 w-4 opacity-60"
              style={{ color: 'var(--text-main)' }}
            />

            <span className="[writing-mode:vertical-rl] font-serif text-[10px] tracking-[0.22em] opacity-45">
              THE MARGIN NOTES
            </span>
          </div>

          {/* 书页正文 */}
          <div className="flex flex-1 flex-col justify-between px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-40">
                  A shared reading room
                </p>

                <h4 className="mt-1 font-serif text-[17px] font-semibold tracking-wide">
                  页边注
                </h4>

                <p className="mt-0.5 font-serif text-[11px] italic opacity-55">
                  The Margin Notes
                </p>
              </div>

              <BookOpen
                className="h-4 w-4 shrink-0 opacity-35 transition-transform duration-300 group-hover:-rotate-6"
                style={{ color: 'var(--text-main)' }}
              />
            </div>

            <div
              className="mt-3 border-t pt-2 text-[10px] leading-relaxed opacity-55"
              style={{ borderColor: 'var(--card-border)' }}
            >
              Find a passage, read beside someone,
              <br />
              and leave a thought in the margin.
            </div>
          </div>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'snapshots',
    colSpan: 1,
    content: (
      <GlassCard
        onClick={() => onOpenApp('snapshots')}
        className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5">
          <Camera
            className="h-5 w-5 opacity-90"
            style={{ color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <AppTitle en="Snapshots" zh="快照" mode={nameMode} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
            Polaroid Feed
          </p>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'pebbling',
    colSpan: 1,
    content: (
      <GlassCard
        onClick={() => onOpenApp('pebbling')}
        className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <Waves
            className="h-5 w-5 opacity-90"
            style={{ color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <AppTitle en="Pebbling" zh="传石" mode={nameMode} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
            Nest Exchange
          </p>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'habitat',
    colSpan: 2,
    content: (
      <GlassCard
        onClick={() => onOpenApp('habitat')}
        className="group flex h-full cursor-pointer items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Leaf
              className="h-5 w-5 opacity-90"
              style={{ color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <AppTitle en="Living Habitat" zh="生态瓶" mode={nameMode} />
            <p className="mt-0.5 text-[11px] uppercase tracking-wider opacity-50">
              {habitatCount > 0
                ? `${habitatCount} lives breathing`
                : 'Adopt a new life'}
            </p>
          </div>
        </div>

        <span className="pr-1 font-mono text-[9px] uppercase tracking-[0.16em] opacity-30 transition-opacity group-hover:opacity-60">
          Bio-Sync
        </span>
      </GlassCard>
    ),
  },

  {
    id: 'imaginarium',
    colSpan: 1,
    content: (
      <GlassCard
        onClick={() => onOpenApp('imaginarium')}
        className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <Sparkles
            className="h-5 w-5 opacity-90"
            style={{ color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <AppTitle en="Imaginarium" zh="幻想沙龙" mode={nameMode} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
            Virtual Salon
          </p>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'ensemble',
    colSpan: 1,
    content: (
      <GlassCard
        onClick={() => onOpenApp('ensemble')}
        className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <Users
            className="h-5 w-5 opacity-90"
            style={{ color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <AppTitle en="The Ensemble" zh="羁绊圈" mode={nameMode} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
            Bonded Group
          </p>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'diaries',
    colSpan: 1,
    content: (
      <GlassCard
        onClick={() => onOpenApp('diaries')}
        className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <BookOpen
            className="h-5 w-5 opacity-90"
            style={{ color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <AppTitle en="Diaries" zh="日记" mode={nameMode} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-40">
            Sync Memories
          </p>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'memory',
    colSpan: 1,
    content: (
      <GlassCard
        onClick={() => onOpenApp('memory')}
        className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <Archive
            className="h-5 w-5 opacity-90"
            style={{ color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <AppTitle en="Memory Room" zh="记忆室" mode={nameMode} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-40">
            Private Archive
          </p>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'archive',
    colSpan: 1,
    content: (
      <GlassCard
        onClick={() => onOpenApp('archive')}
        className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <FolderArchive
            className="h-5 w-5 opacity-90"
            style={{ color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <AppTitle en="Archive Room" zh="存档室" mode={nameMode} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-40">
            Old Messages
          </p>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'ephemera',
    colSpan: 1,
    content: (
      <GlassCard
        onClick={() => onOpenApp('ephemera')}
        className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <Ticket
            className="h-5 w-5 opacity-90"
            style={{ color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <AppTitle en="Ephemera" zh="时光票根" mode={nameMode} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
            Time Tickets
          </p>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'newspaper',
    colSpan: 1,
    content: (
      <GlassCard
        onClick={() => onOpenApp('newspaper')}
        className="group flex h-full cursor-pointer flex-col justify-between p-4 text-left"
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <Newspaper
            className="h-5 w-5 opacity-90"
            style={{ color: 'var(--text-main)' }}
          />
        </div>

        <div>
          <AppTitle en="Daily Post" zh="晨报" mode={nameMode} />
          <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-50">
            Morning Press
          </p>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'workflows',
    colSpan: 2,
    content: (
      <GlassCard
        onClick={() => onOpenApp('workflows')}
        className="group flex h-full cursor-pointer items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Repeat
              className="h-5 w-5 opacity-90"
              style={{ color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <AppTitle en="Workflows" zh="定时工作流" mode={nameMode} />
            <p className="mt-0.5 text-[11px] uppercase tracking-wider opacity-50">
              {activeWorkflowCount > 0
                ? `${activeWorkflowCount} running quietly`
                : 'Set a standing routine'}
            </p>
          </div>
        </div>
      </GlassCard>
    ),
  },

  {
    id: 'askbox',
    colSpan: 2,
    content: (
      <GlassCard
        onClick={() => onOpenApp('askbox')}
        className="group flex h-full cursor-pointer items-center justify-between border-dashed p-4 text-left"
        style={{ borderColor: 'var(--text-muted)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <MailOpen
              className="h-5 w-5 opacity-90"
              style={{ color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <AppTitle en="Ask Box" zh="匿名信箱" mode={nameMode} />

              {askCount > 0 && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              )}
            </div>

            <p className="mt-0.5 text-[11px] uppercase tracking-wider opacity-50">
              {askCount > 0
                ? `${askCount} letters waiting`
                : 'Anonymity Box'}
            </p>
          </div>
        </div>

        <ArrowUpRight className="h-4 w-4 opacity-30 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </GlassCard>
    ),
  },

  {
    id: 'small-tools',
    colSpan: 2,
    content: (
      <GlassCard className="flex h-full flex-col justify-between p-3 text-left">
        <div className="flex items-center justify-between px-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-35">
            Small arrangements
          </span>

          <span className="text-[9px] opacity-30">for everyday life</span>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenApp('travel')}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl p-2 text-left transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Compass className="h-3.5 w-3.5 shrink-0 opacity-75" />
            <AppTitle en="Travel" zh="旅行" mode={nameMode} className="truncate text-xs font-bold" />
          </button>

          <button
            type="button"
            onClick={() => onOpenApp('planner')}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl p-2 text-left transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0 opacity-75" />
            <AppTitle en="Planner" zh="日程" mode={nameMode} className="truncate text-xs font-bold" />
          </button>

          <button
            type="button"
            onClick={() => onOpenApp('rhythm')}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl p-2 text-left transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-75" />
            <AppTitle en="Rhythm" zh="律动" mode={nameMode} className="truncate text-xs font-bold" />
          </button>

          <button
            type="button"
            onClick={() => onOpenApp('almanac')}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl p-2 text-left transition-transform active:scale-95"
            style={{ backgroundColor: 'var(--control-soft-bg)' }}
          >
            <BookOpen
              className="h-3.5 w-3.5 shrink-0 opacity-75"
              style={{ color: 'var(--text-main)' }}
            />
            <AppTitle en="Almanac" zh="岁时纪" mode={nameMode} className="truncate text-xs font-bold" />
          </button>
        </div>
      </GlassCard>
    ),
  },
];

export default buildAppGridItems;