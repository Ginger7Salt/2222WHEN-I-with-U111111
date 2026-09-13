import React, { useState } from 'react';

/**
 * 主题样式配置系统
 * 支持: 经典网易红 (crimson) & 黑白无印极简 (mono)
 */
const THEMES = {
  crimson: {
    name: '云村红',
    accentBg: 'bg-red-500/10 dark:bg-red-500/15',
    accentText: 'text-red-600 dark:text-red-400',
    accentDot: 'bg-red-500',
    vinylCenter: 'from-red-600 to-rose-700 shadow-red-500/30',
    hoverBg: 'hover:bg-red-500/5 dark:hover:bg-red-500/10',
    activeBar: 'bg-red-500/80',
    halo: 'rgba(239, 68, 68, 0.15)',
  },
  mono: {
    name: '极简黑白',
    accentBg: 'bg-neutral-200/50 dark:bg-neutral-800/60',
    accentText: 'text-neutral-900 dark:text-neutral-100',
    accentDot: 'bg-neutral-800 dark:bg-neutral-200',
    vinylCenter: 'from-neutral-700 to-neutral-950 shadow-black/40',
    hoverBg: 'hover:bg-neutral-100 dark:hover:bg-neutral-800/40',
    activeBar: 'bg-neutral-800 dark:bg-neutral-200',
    halo: 'rgba(120, 120, 120, 0.12)',
  },
};

export default function NeteaseMusicCard({ card }) {
  const [themeMode, setThemeMode] = useState('crimson'); // 'crimson' | 'mono'
  const t = THEMES[themeMode];

  if (!card) return null;

  return (
    <div className="relative my-2.5 max-w-sm rounded-3xl backdrop-blur-2xl bg-white/40 dark:bg-neutral-900/40 p-4 transition-all duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
      {/* 顶部极简微徽标与色彩主题切换开关 */}
      <div className="flex items-center justify-between pb-3 text-[11px] tracking-wider text-neutral-400 dark:text-neutral-500 select-none">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${t.accentDot} animate-pulse`} />
          <span className="font-medium uppercase tracking-widest text-[10px]">Cloud Music</span>
        </div>
        
        {/* 一键无缝切主题 */}
        <button
          onClick={() => setThemeMode(prev => (prev === 'crimson' ? 'mono' : 'crimson'))}
          className="px-2 py-0.5 rounded-full transition-all duration-300 text-[10px] bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:scale-105 active:scale-95"
          title="切换配色风格"
        >
          {t.name}
        </button>
      </div>

      {/* 视图分流渲染 */}
      {card.viewType === 'player' && <PlayerView card={card} t={t} />}
      {card.viewType === 'song_list' && <SongListView card={card} t={t} />}
      {card.viewType === 'lyrics' && <LyricsView card={card} t={t} />}
      {card.viewType === 'fm' && <FmView card={card} t={t} />}
      {card.viewType === 'playlists' && <PlaylistsView card={card} t={t} />}
      {card.viewType === 'action_feedback' && <ActionFeedbackView card={card} t={t} />}
      {card.viewType === 'user_level' && <UserLevelView card={card} t={t} />}
      {card.viewType === 'song_details' && <SongDetailsView card={card} t={t} />}
    </div>
  );
}

/** 1. 核心单曲悬浮黑胶旋转播放器 */
function PlayerView({ card, t }) {
  return (
    <div className="flex items-center gap-4 py-1">
      {/* 悬浮黑胶唱片：无框、微光漫反射、纯 CSS 顺滑匀速旋转 */}
      <div className="relative group shrink-0">
        <div 
          className="w-16 h-16 rounded-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-neutral-950 flex items-center justify-center animate-[spin_12s_linear_infinite] shadow-xl"
          style={{ boxShadow: `0 8px 24px -4px ${t.halo}` }}
        >
          {/* 黑胶同心音轨光影纹理 */}
          <div className="absolute inset-1.5 rounded-full border border-white/5" />
          <div className="absolute inset-3 rounded-full border border-white/5" />
          {/* 黑胶中心红心唱片标 */}
          <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${t.vinylCenter} flex items-center justify-center shadow-inner`}>
            <div className="w-2 h-2 rounded-full bg-neutral-950 shadow-sm" />
          </div>
        </div>
      </div>

      {/* 歌曲信息与声波跳动 */}
      <div className="flex-1 min-w-0">
        <div className="truncate font-semibold text-sm text-neutral-900 dark:text-neutral-100 tracking-tight">
          {card.title}
        </div>
        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          {card.artist}
        </div>

        <div className="flex items-center justify-between mt-2.5">
          {/* 拟物 4 柱动态声波跳动 Equalizer */}
          <div className="flex items-end gap-[3px] h-3.5">
            <span className={`w-[2.5px] rounded-full ${t.activeBar} animate-[pulse_0.8s_ease-in-out_infinite] h-2.5`} />
            <span className={`w-[2.5px] rounded-full ${t.activeBar} animate-[pulse_1.1s_ease-in-out_infinite_0.2s] h-3.5`} />
            <span className={`w-[2.5px] rounded-full ${t.activeBar} animate-[pulse_0.7s_ease-in-out_infinite_0.4s] h-1.5`} />
            <span className={`w-[2.5px] rounded-full ${t.activeBar} animate-[pulse_1.3s_ease-in-out_infinite_0.1s] h-3`} />
          </div>

          <a
            href={card.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[11px] font-medium transition-transform active:scale-90 ${t.accentText}`}
          >
            去听听 &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}

/** 2. 歌曲列表流：搜索结果、每日推荐、历史热歌 */
function SongListView({ card, t }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {card.title}
      </div>
      <div className="space-y-1">
        {card.songs.slice(0, 6).map((song, idx) => (
          <a
            key={song.id || idx}
            href={song.id ? `https://music.163.com/#/song?id=${song.id}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center justify-between p-2 rounded-2xl transition-all duration-300 ${t.hoverBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <span className="w-4 text-[11px] font-mono text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200">
                {(idx + 1).toString().padStart(2, '0')}
              </span>
              <div className="truncate">
                <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate group-hover:translate-x-0.5 transition-transform">
                  {song.title}
                </div>
                {song.artist && (
                  <div className="text-[11px] text-neutral-400 truncate">
                    {song.artist}
                  </div>
                )}
              </div>
            </div>
            <div className="text-neutral-300 group-hover:text-neutral-500 transition-colors text-xs">
              &rsaquo;
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

/** 3. 沉浸式微歌词视窗 */
function LyricsView({ card, t }) {
  // 提取前 4 行干净歌词展示
  const lyricLines = (card.lyrics || '')
    .split('\n')
    .map(l => l.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs tracking-wider text-neutral-400">LYRICS PREVIEW</span>
      </div>
      <div className="space-y-2 py-1">
        {lyricLines.map((line, idx) => (
          <p
            key={idx}
            className={`text-xs transition-opacity duration-300 ${
              idx === 1
                ? `${t.accentText} font-medium text-sm scale-[1.02] origin-left drop-shadow-sm`
                : 'text-neutral-500 dark:text-neutral-400 opacity-60'
            }`}
          >
            {line}
          </p>
        ))}
      </div>
      {card.translation && (
        <p className="text-[11px] text-neutral-400 italic pt-1 border-t border-black/5 dark:border-white/5">
          {card.translation.split('\n')[0]?.replace(/\[.*?\]/, '')}
        </p>
      )}
    </div>
  );
}

/** 4. 私人 FM 电波流 */
function FmView({ card, t }) {
  const current = card.tracks[0];
  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-between text-[11px] text-neutral-400">
        <span>PERSONAL FM</span>
        <span className="animate-pulse flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ON AIR
        </span>
      </div>
      {current && (
        <div className="p-3 rounded-2xl bg-neutral-100/50 dark:bg-neutral-800/40">
          <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {current.title}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {current.artist} {current.album && `· 《${current.album}》`}
          </div>
        </div>
      )}
    </div>
  );
}

/** 5. 歌单集合视图 */
function PlaylistsView({ card, t }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-400">PLAYLISTS</div>
      <div className="grid grid-cols-1 gap-1.5">
        {card.playlists.map((pl, i) => (
          <div
            key={pl.id || i}
            className={`p-2.5 rounded-2xl transition-all ${t.hoverBg} flex items-center justify-between`}
          >
            <div className="min-w-0 pr-2">
              <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                {pl.name}
              </div>
              <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                {pl.count} {pl.desc && `· ${pl.desc}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 6. 状态与轻操作反馈（点赞红心微动效、加歌单成功） */
function ActionFeedbackView({ card, t }) {
  const isLike = card.status?.includes('Liked') || card.toolName === 'like_song';
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${t.accentBg} ${t.accentText} text-base`}>
        {isLike ? (
          <span className="animate-bounce">♥</span>
        ) : (
          <span>✓</span>
        )}
      </div>
      <div className="text-xs">
        <div className="font-medium text-neutral-800 dark:text-neutral-200">
          {card.status || `已收藏 ${card.count} 首歌曲`}
        </div>
        {card.note && <div className="text-[10px] text-neutral-400 mt-0.5">{card.note}</div>}
      </div>
    </div>
  );
}

/** 7. 用户等级 */
function UserLevelView({ card, t }) {
  return (
    <div className="flex items-center justify-between p-1">
      <div>
        <div className="text-xs text-neutral-400">{card.nickname || '云音乐达人'}</div>
        <div className="text-[11px] text-neutral-500 mt-1">
          听歌 {card.listenSongs} 首 · 陪伴 {card.createDays} 天
        </div>
      </div>
      <div className={`text-2xl font-black italic tracking-tighter ${t.accentText}`}>
        Lv.{card.level}
      </div>
    </div>
  );
}

/** 8. 歌曲多项元数据卡片 */
function SongDetailsView({ card, t }) {
  const song = card.songs[0];
  if (!song) return null;
  return (
    <div className="space-y-1.5 py-1">
      <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{song.name}</div>
      <div className="text-xs text-neutral-500">{song.artists} · 《{song.album}》</div>
      <div className="flex gap-2 text-[10px] text-neutral-400 pt-1">
        <span>时长 {song.duration}</span>
        <span>发行于 {song.year}</span>
      </div>
    </div>
  );
}
