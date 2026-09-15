const NETEASE_TOOLS = new Set([
  'play_music',
  'search_song',
  'get_play_history',
  'get_recent_plays',
  'daily_recommend',
  'list_my_playlists',
  'get_playlist_songs',
  'create_playlist',
  'add_to_playlist',
  'remove_from_playlist',
  'like_song',
  'update_playlist_description',
  'reorder_playlist_tracks',
  'get_song_lyrics',
  'get_song_details',
  'get_artist_hot_songs',
  'get_personal_fm',
  'get_liked_songs',
  'get_user_level',
]);

/**
 * 将不同 MCP 客户端传入的工具名统一为实际工具名。
 *
 * 支持：
 * search_song
 * server.search_song
 * mcp__netease__search_song
 * netease-music-mcp.search_song
 */
export const normalizeNeteaseToolName = (toolName = '') => {
  let name = String(toolName).trim();

  if (!name) return '';

  name = name.split(/[.:/]/).pop();

  if (name.includes('__')) {
    name = name.split('__').pop();
  }

  return name.trim().toLowerCase();
};

const tryParseJson = (value) => {
  if (typeof value !== 'string') return value;

  const cleaned = value
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  if (!cleaned) return '';

  try {
    return JSON.parse(cleaned);
  } catch {
    return value;
  }
};

/**
 * 解开 MCP 返回的各种包装层。
 *
 * 兼容：
 * 1. { content: [{ type: 'text', text: '{"results": []}' }] }
 * 2. { result: { content: [...] } }
 * 3. { data: {...} }
 * 4. { structuredContent: {...} }
 * 5. 直接 JSON 字符串
 */
const unwrapMcpValue = (value, depth = 0) => {
  if (value === null || value === undefined) return null;

  if (depth > 8) return value;

  if (typeof value === 'string') {
    const parsed = tryParseJson(value);

    if (parsed !== value) {
      return unwrapMcpValue(parsed, depth + 1);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value.result !== undefined) {
    return unwrapMcpValue(value.result, depth + 1);
  }

  if (value.structuredContent !== undefined) {
    return unwrapMcpValue(value.structuredContent, depth + 1);
  }

  if (value.data !== undefined) {
    return unwrapMcpValue(value.data, depth + 1);
  }

  if (Array.isArray(value.content)) {
    for (const part of value.content) {
      if (!part) continue;

      if (part.type === 'text') {
        const parsed = tryParseJson(part.text);

        if (parsed !== part.text) {
          return unwrapMcpValue(parsed, depth + 1);
        }
      }
    }

    return value.content
      .filter((part) => part?.type === 'text')
      .map((part) => part.text)
      .join('\n');
  }

  return value;
};

const parseToolRawData = (toolResult) => {
  const data = unwrapMcpValue(toolResult);

  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    data.data !== undefined
  ) {
    return unwrapMcpValue(data.data);
  }

  return data;
};

const getArtists = (song) => {
  if (!song || typeof song !== 'object') return [];

  if (Array.isArray(song.artists)) return song.artists;
  if (Array.isArray(song.ar)) return song.ar;
  if (Array.isArray(song.artistsInfo)) return song.artistsInfo;

  return [];
};

const getArtistName = (song) => {
  if (!song || typeof song !== 'object') return '';

  if (typeof song.artist === 'string') {
    return song.artist;
  }

  if (typeof song.artists === 'string') {
    return song.artists;
  }

  return getArtists(song)
    .map((artist) => {
      if (typeof artist === 'string') return artist;
      return artist?.name || artist?.title || '';
    })
    .filter(Boolean)
    .join(', ');
};

/**
 * 解析网易云歌曲。
 *
 * 兼容仓库当前实际返回的字符串：
 * "1. 歌曲名 - 歌手 (ID:123456)"
 *
 * 也兼容网易云原始对象：
 * {
 *   id: 123456,
 *   name: "歌曲名",
 *   ar: [{ name: "歌手" }]
 * }
 */
export const parseNeteaseSong = (item) => {
  if (!item) return null;

  if (typeof item === 'object') {
    const album =
      item.album ||
      item.al?.name ||
      item.albumInfo?.name ||
      '';

    return {
      id: item.id ?? item.song_id ?? item.songId ?? null,
      title: item.title || item.name || '?',
      artist: getArtistName(item),
      album,
      duration: item.duration || item.dt || '',
      year: item.year || '',
      raw: item,
    };
  }

  if (typeof item !== 'string') {
    return null;
  }

  const raw = item.trim();

  if (!raw) return null;

  const idMatch = raw.match(/\(ID:\s*(\d+)\)/i);

  const id = idMatch ? idMatch[1] : null;

  const clean = raw
    .replace(/^\s*\d+\.\s*/, '')
    .replace(/\(plays:\s*[\d.]+\s*,\s*ID:\s*\d+\)/gi, '')
    .replace(/\(ID:\s*\d+\)/gi, '')
    .replace(/\[[^\]]*UTC\]/gi, '')
    .trim();

  const parts = clean.split(/\s+-\s+/);

  return {
    id,
    title: parts[0]?.trim() || raw,
    artist: parts.slice(1).join(' - ').trim(),
    album: '',
    duration: '',
    year: '',
    raw: item,
  };
};

const parsePlaylist = (item) => {
  if (!item) return null;

  if (typeof item === 'object') {
    return {
      id: item.id ?? item.playlist_id ?? null,
      name: item.name || item.title || '我的歌单',
      count:
        item.count ??
        item.trackCount ??
        item.track_count ??
        item.songCount ??
        '',
      desc:
        item.desc ||
        item.description ||
        '',
    };
  }

  const segments = String(item)
    .split('|')
    .map((segment) => segment.trim());

  return {
    id: segments[0]?.replace(/^ID:\s*/i, '') || null,
    name: segments[1] || '我的歌单',
    count: segments[2] || '',
    desc: segments[3] || '',
  };
};

const getListData = (toolName, data) => {
  const map = {
    search_song: data?.results,
    daily_recommend: data?.recommendations,
    get_artist_hot_songs: data?.hot_songs,
    get_play_history: data?.history,
    get_recent_plays: data?.recent_plays,
    get_playlist_songs: data?.songs,
  };

  return map[toolName];
};

const getListTitle = (toolName, data) => {
  if (data?.name) return data.name;

  if (data?.artist) {
    return `${data.artist} 的热门作品`;
  }

  switch (toolName) {
    case 'search_song':
      return '歌曲搜索结果';

    case 'daily_recommend':
      return '今日每日推荐';

    case 'get_play_history':
      return '历史听歌排行';

    case 'get_recent_plays':
      return '最近播放记录';

    case 'get_artist_hot_songs':
      return '歌手热门歌曲';

    case 'get_playlist_songs':
      return '歌单歌曲';

    default:
      return '精选音乐推荐';
  }
};

const parseActionFeedback = (toolName, data) => {
  const isActionTool = [
    'like_song',
    'create_playlist',
    'add_to_playlist',
    'remove_from_playlist',
    'update_playlist_description',
    'reorder_playlist_tracks',
    'get_liked_songs',
  ].includes(toolName);

  const hasActionFields =
    data?.status !== undefined ||
    data?.playlist_id !== undefined ||
    data?.count !== undefined;

  if (!isActionTool && !hasActionFields) {
    return null;
  }

  let status = data?.status || '';

  if (!status && data?.playlist_id) {
    status = `歌单已创建：${data.name || ''}（#${data.playlist_id}）`;
  }

  if (!status && data?.count !== undefined) {
    status = `已收藏 ${data.count} 首歌曲`;
  }

  if (!status) {
    status = '网易云操作已完成';
  }

  return {
    kind: 'netease_music',
    viewType: 'action_feedback',
    toolName,
    status,
    count: data?.count,
    note: data?.note || null,
    isError: false,
  };
};

export const parseNeteaseMusicCard = (toolName, toolResult) => {
  const normalizedToolName = normalizeNeteaseToolName(toolName);

  if (!NETEASE_TOOLS.has(normalizedToolName)) {
    return null;
  }

  const data = parseToolRawData(toolResult);

  if (!data) {
    return null;
  }

  if (data?.error) {
    return {
      kind: 'netease_music',
      viewType: 'action_feedback',
      toolName: normalizedToolName,
      status: `网易云操作失败：${data.error}`,
      note: data.detail?.error || '',
      isError: true,
    };
  }

  if (normalizedToolName === 'play_music') {
    if (!data.title && !data.name && !data.id) {
      return null;
    }

    const id = data.id ?? data.song_id ?? data.songId ?? null;

    return {
      kind: 'netease_music',
      viewType: 'player',
      title: data.title || data.name || '未知曲目',
      artist:
        data.artist ||
        data.artists ||
        getArtistName(data) ||
        '未知艺人',
      id,
      link:
        data.link ||
        data.url ||
        (id ? `https://music.163.com/#/song?id=${id}` : '#'),
    };
  }

  if (normalizedToolName === 'get_song_lyrics') {
    const lyrics =
      data.lyrics ||
      data.lrc ||
      data.lyric ||
      '';

    if (!lyrics) {
      return null;
    }

    return {
      kind: 'netease_music',
      viewType: 'lyrics',
      songId: data.song_id || data.songId || data.id || null,
      lyrics: String(lyrics),
      translation: data.translation || data.tlyric || null,
    };
  }

  const rawList = getListData(normalizedToolName, data);

  if (Array.isArray(rawList)) {
    const songs = rawList
      .map(parseNeteaseSong)
      .filter(Boolean);

    if (songs.length === 0) {
      return null;
    }

    return {
      kind: 'netease_music',
      viewType: 'song_list',
      toolName: normalizedToolName,
      title: getListTitle(normalizedToolName, data),
      songs,
    };
  }

  if (normalizedToolName === 'get_personal_fm') {
    const rawTracks = data.personal_fm || data.tracks || data.songs;

    if (!Array.isArray(rawTracks) || rawTracks.length === 0) {
      return null;
    }

    const tracks = rawTracks
      .map((item) => {
        if (typeof item === 'object') {
          return parseNeteaseSong(item);
        }

        const parts = String(item)
          .replace(/^\s*\d+\.\s*/, '')
          .split('|');

        const song = parseNeteaseSong(parts[0]?.trim());

        if (!song) return null;

        return {
          ...song,
          album:
            parts[1]
              ?.replace(/Album:\s*/i, '')
              .replace(/\(ID:\s*\d+\)/i, '')
              .trim() || '',
        };
      })
      .filter(Boolean);

    if (tracks.length === 0) {
      return null;
    }

    return {
      kind: 'netease_music',
      viewType: 'fm',
      tracks,
    };
  }

  if (normalizedToolName === 'list_my_playlists') {
    const rawPlaylists = data.playlists || data.data;

    if (!Array.isArray(rawPlaylists) || rawPlaylists.length === 0) {
      return null;
    }

    const playlists = rawPlaylists
      .map(parsePlaylist)
      .filter(Boolean);

    if (playlists.length === 0) {
      return null;
    }

    return {
      kind: 'netease_music',
      viewType: 'playlists',
      playlists,
    };
  }

  if (normalizedToolName === 'get_song_details') {
    const rawSongs = data.songs || data.data;

    if (!Array.isArray(rawSongs) || rawSongs.length === 0) {
      return null;
    }

    const songs = rawSongs
      .map(parseNeteaseSong)
      .filter(Boolean);

    if (songs.length === 0) {
      return null;
    }

    return {
      kind: 'netease_music',
      viewType: 'song_details',
      songs,
    };
  }

  if (normalizedToolName === 'get_user_level') {
    return {
      kind: 'netease_music',
      viewType: 'user_level',
      level: data.level ?? data.user_level ?? '?',
      listenSongs:
        data.listen_songs ??
        data.listenSongs ??
        0,
      createDays:
        data.create_days ??
        data.createDays ??
        0,
      nickname:
        data.nickname ||
        data.profile?.nickname ||
        '云音乐用户',
    };
  }

  return parseActionFeedback(normalizedToolName, data);
};

export { NETEASE_TOOLS };
