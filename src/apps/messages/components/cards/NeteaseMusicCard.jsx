import React, { useState } from 'react';

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

const asArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const cleanLyricLine = (line) => {
  return String(line)
    .replace(/\[\d{1,3}:\d{2}(?:[.:]\d{2,3})?\]/g, '')
    .trim();
};

export default function NeteaseMusicCard({ card }) {
  const [themeMode, setThemeMode] = useState('crimson');
  const theme = THEMES[themeMode];

  if (!card) {
    return null;
  }

  return (
    <div className="relative my-2.5 max-w-sm rounded-3xl backdrop-blur-2xl bg-white/40 dark:bg-neutral-900/40 p-4 transition-all duration-500 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between pb-3 text-[11px] tracking-wider text-neutral-400 dark:text-neutral-500 select-none">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${theme.accentDot} animate-pulse`}
          />
          <span className="font-medium uppercase tracking-widest text-[10px]">
            Cloud Music
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setThemeMode((previous) =>
              previous === 'crimson' ? 'mono' : 'crimson'
            );
          }}
          className="px-2 py-0.5 rounded-full transition-all duration-300 text-[10px] bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:scale-105 active:scale-95"
          title="切换配色风格"
        >
          {theme.name}
        </button>
      </div>

      {card.isError && (
        <div className="mb-3 text-[11px] text-red-500 dark:text-red-400">
          {card.status || '网易云操作失败'}
        </div>
      )}

      {card.viewType === 'player' && (
        <PlayerView card={card} theme={theme} />
      )}

      {card.viewType === 'song_list' && (
        <SongListView card={card} theme={theme} />
      )}

      {card.viewType === 'lyrics' && (
        <LyricsView card={card} theme={theme} />
      )}

      {card.viewType === 'fm' && (
        <FmView card={card} theme={theme} />
      )}

      {card.viewType === 'playlists' && (
        <PlaylistsView card={card} theme={theme} />
      )}

      {card.viewType === 'action_feedback' && (
        <ActionFeedbackView card={card} theme={theme} />
      )}

      {card.viewType === 'user_level' && (
        <UserLevelView card={card} theme={theme} />
      )}

      {card.viewType === 'song_details' && (
        <SongDetailsView card={card} theme={theme} />
      )}
    </div>
  );
}

function PlayerView({ card, theme }) {
  const songId = card.id ? String(card.id) : '';

  const link =
    card.link ||
    (songId ? `https://music.163.com/#/song?id=${songId}` : '#');

  return (
    <div className="flex items-center gap-4 py-1">
      <div className="relative group shrink-0">
        <div
          className="w-16 h-16 rounded-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-neutral-950 flex items-center justify-center animate-[spin_12s_linear_infinite] shadow-xl"
          style={{
            boxShadow: `0 8px 24px -4px ${theme.halo}`,
          }}
        >
          <div className="absolute inset-1.5 rounded-full border border-white/5" />
          <div className="absolute inset-3 rounded-full border border-white/5" />

          <div
            className={`w-6 h-6 rounded-full bg-gradient-to-tr ${theme.vinylCenter} flex items-center justify-center shadow-inner`}
          >
            <div className="w-2 h-2 rounded-full bg-neutral-950 shadow-sm" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="truncate font-semibold text-sm text-neutral-900 dark:text-neutral-100 tracking-tight">
          {card.title || '未知曲目'}
        </div>

        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          {card.artist || '未知艺人'}
        </div>

        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-end gap-[3px] h-3.5">
            <span
              className={`w-[2.5px] rounded-full ${theme.activeBar} animate-[pulse_0.8s_ease-in-out_infinite] h-2.5`}
            />
            <span
              className={`w-[2.5px] rounded-full ${theme.activeBar} animate-[pulse_1.1s_ease-in-out_infinite_0.2s] h-3.5`}
            />
            <span
              className={`w-[2.5px] rounded-full ${theme.activeBar} animate-[pulse_0.7s_ease-in-out_infinite_0.4s] h-1.5`}
            />
            <span
              className={`w-[2.5px] rounded-full ${theme.activeBar} animate-[pulse_1.3s_ease-in-out_infinite_0.1s] h-3`}
            />
          </div>

          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[11px] font-medium transition-transform active:scale-90 ${theme.accentText}`}
          >
            去听听 →
          </a>
        </div>
      </div>
    </div>
  );
}

function SongListView({ card, theme }) {
  const songs = asArray(card.songs);

  if (songs.length === 0) {
    return (
      <div className="text-xs text-neutral-400">
        暂无歌曲数据
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {card.title || '歌曲列表'}
      </div>

      <div className="space-y-1">
        {songs.slice(0, 6).map((song, index) => {
          const songId = song?.id ? String(song.id) : '';

          const link = songId
            ? `https://music.163.com/#/song?id=${songId}`
            : '#';

          return (
            <a
              key={songId || index}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center justify-between p-2 rounded-2xl transition-all duration-300 ${theme.hoverBg}`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="w-4 text-[11px] font-mono text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200">
                  {(index + 1).toString().padStart(2, '0')}
                </span>

                <div className="truncate">
                  <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate group-hover:translate-x-0.5 transition-transform">
                    {song?.title || song?.name || '未知歌曲'}
                  </div>

                  {song?.artist && (
                    <div className="text-[11px] text-neutral-400 truncate">
                      {song.artist}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-neutral-300 group-hover:text-neutral-500 transition-colors text-xs">
                ›
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function LyricsView({ card, theme }) {
  const lyricLines = String(card.lyrics || '')
    .split(/\r?\n/)
    .map(cleanLyricLine)
    .filter(Boolean)
    .slice(0, 4);

  const translationLine = String(card.translation || '')
    .split(/\r?\n/)
    .map(cleanLyricLine)
    .find(Boolean);

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs tracking-wider text-neutral-400">
          LYRICS PREVIEW
        </span>
      </div>

      <div className="space-y-2 py-1">
        {lyricLines.length > 0 ? (
          lyricLines.map((line, index) => (
            <p
              key={`${line}-${index}`}
              className={`text-xs transition-opacity duration-300 ${
                index === 1
                  ? `${theme.accentText} font-medium text-sm scale-[1.02] origin-left drop-shadow-sm`
                  : 'text-neutral-500 dark:text-neutral-400 opacity-60'
              }`}
            >
              {line}
            </p>
          ))
        ) : (
          <p className="text-xs text-neutral-400">
            暂无歌词内容
          </p>
        )}
      </div>

      {translationLine && (
        <p className="text-[11px] text-neutral-400 italic pt-1 border-t border-black/5 dark:border-white/5">
          {translationLine}
        </p>
      )}
    </div>
  );
}

function FmView({ card }) {
  const tracks = asArray(card.tracks);
  const current = tracks[0];

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-between text-[11px] text-neutral-400">
        <span>PERSONAL FM</span>

        <span className="animate-pulse flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          ON AIR
        </span>
      </div>

      {current ? (
        <div className="p-3 rounded-2xl bg-neutral-100/50 dark:bg-neutral-800/40">
          <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {current.title || '未知歌曲'}
          </div>

          <div className="text-[11px] text-neutral-500 mt-0.5">
            {current.artist || '未知艺人'}
            {current.album ? ` · 《${current.album}》` : ''}
          </div>
        </div>
      ) : (
        <div className="text-xs text-neutral-400">
          暂无私人 FM 内容
        </div>
      )}
    </div>
  );
}

function PlaylistsView({ card, theme }) {
  const playlists = asArray(card.playlists);

  if (playlists.length === 0) {
    return (
      <div className="text-xs text-neutral-400">
        暂无歌单
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-400">
        PLAYLISTS
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {playlists.map((playlist, index) => (
          <div
            key={playlist?.id || index}
            className={`p-2.5 rounded-2xl transition-all ${theme.hoverBg} flex items-center justify-between`}
          >
            <div className="min-w-0 pr-2">
              <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
                {playlist?.name || '我的歌单'}
              </div>

              <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                {playlist?.count || ''}
                {playlist?.desc ? ` · ${playlist.desc}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionFeedbackView({ card, theme }) {
  const isLike =
    String(card.status || '').toLowerCase().includes('liked') ||
    card.toolName === 'like_song';

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={`w-9 h-9 rounded-2xl flex items-center justify-center ${theme.accentBg} ${theme.accentText} text-base`}
      >
        {isLike ? (
          <span className="animate-bounce">♥</span>
        ) : (
          <span>✓</span>
        )}
      </div>

      <div className="text-xs min-w-0">
        <div className="font-medium text-neutral-800 dark:text-neutral-200 break-words">
          {card.status ||
            (card.count !== undefined
              ? `已收藏 ${card.count} 首歌曲`
              : '网易云操作已完成')}
        </div>

        {card.note && (
          <div className="text-[10px] text-neutral-400 mt-0.5 break-words">
            {card.note}
          </div>
        )}
      </div>
    </div>
  );
}

function UserLevelView({ card, theme }) {
  return (
    <div className="flex items-center justify-between p-1">
      <div>
        <div className="text-xs text-neutral-400">
          {card.nickname || '云音乐达人'}
        </div>

        <div className="text-[11px] text-neutral-500 mt-1">
          听歌 {card.listenSongs ?? 0} 首 · 陪伴 {card.createDays ?? 0} 天
        </div>
      </div>

      <div
        className={`text-2xl font-black italic tracking-tighter ${theme.accentText}`}
      >
        Lv.{card.level ?? '?'}
      </div>
    </div>
  );
}

function SongDetailsView({ card }) {
  const songs = asArray(card.songs);
  const song = songs[0];

  if (!song) {
    return (
      <div className="text-xs text-neutral-400">
        暂无歌曲详情
      </div>
    );
  }

  return (
    <div className="space-y-1.5 py-1">
      <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
        {song.title || song.name || '未知歌曲'}
      </div>

      <div className="text-xs text-neutral-500">
        {song.artist || song.artists || '未知艺人'}
        {song.album ? ` · 《${song.album}》` : ''}
      </div>

      <div className="flex gap-2 text-[10px] text-neutral-400 pt-1">
        {song.duration && (
          <span>
            时长 {formatDuration(song.duration)}
          </span>
        )}

        {song.year && (
          <span>
            发行于 {song.year}
          </span>
        )}
      </div>
    </div>
  );
}

function formatDuration(duration) {
  if (typeof duration === 'string') {
    return duration;
  }

  const milliseconds = Number(duration);

  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '';
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
