// src/apps/textgames/skull/useSkullMatch.js
//
// 一局骷髅牌的“控制器”：把纯规则引擎（skullEngine.js）、角色策略
// （skullAi.js）、台词（skullLines.js）、界面文案（skullView.js）、存档
// （skullService.js）和计时器串起来，给 SkullGame.jsx 一个干净的接口。
// 界面只管渲染和转发点击，所有时序都在这里。
//
// 座位：table 是 buildTablePlayers() 的结果，下标 0 是用户，1 到 3 是真人
// 角色或 NPC。
//
// 时序约定：
// - 电脑玩家每手停 1.5 到 4.5 秒再行动；挑战者翻牌时每张间隔 1.1 到 1.9 秒；
// - 用户每手 20 秒，超时由引擎的 applyTimeout 自动处理；
// - 一轮结束后停 3.6 秒让大家看清结果（用户可以点“继续”跳过），再自动开
//   下一轮；用户已经被淘汰时，电脑之间的节奏加快；
// - 没有整局时限：这个游戏一局本身不长。
//
// 对局状态只放在 React state 里不落库，中途退出就是放弃；只有打完才由
// recordSkullMatch 写一次存档（用 ref 保证只写一次）。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  PHASE,
  TURN_TIME_LIMIT_MS,
  applyTimeout,
  chooseDiscard,
  createGame,
  flipCard,
  getLegalActions,
  getMatchSummary,
  getStandings,
  passBid,
  placeCard,
  raiseBid,
  startBid,
  startNextRound,
  tableCount,
} from './skullEngine';
import { applyAiMove, pickAiMove } from './skullAi';
import { LINE_CHANCE, MANDATORY_KINDS, pickLine } from './skullLines';
import { getSkullStats, recordSkullMatch } from './skullService';
import { buildSummaryLinesForUser } from './skullMatchFormat';
import { buildHerald, getSeatBids } from './skullView';

export const AI_DELAY_MIN_MS = 1500;
export const AI_DELAY_MAX_MS = 4500;
export const AI_FLIP_DELAY_MIN_MS = 1100;
export const AI_FLIP_DELAY_MAX_MS = 1900;
export const ROUND_OVER_DELAY_MS = 3600;
const BUBBLE_MS = 2800;
const NOTICE_MS = 2400;
const RESULT_DELAY_MS = 2600;
// 用户已经被淘汰、只剩电脑们打的时候，把等待时间压到原来的这个比例。
const SPECTATOR_SPEEDUP = 0.25;
// 每位角色一局最多说这么多句“选说”的台词（必说的不占名额）。
const OPTIONAL_LINE_LIMIT = 6;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// ---------- 音效：Web Audio 现场合成，不需要任何外部资源 ----------
// AudioContext 必须在用户点击之后才能发声，所以每个用户操作都会先调用
// unlock()；创建或播放失败一律静默忽略，不影响对局。
const createAudio = () => {
  let ctx = null;

  const ensure = () => {
    try {
      if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        ctx = new AudioCtx();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (err) {
      return null;
    }
  };

  const tone = (type, from, to, duration, volume) => {
    const c = ensure();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = c.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(from, t);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + duration * 0.8);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + duration);
    } catch (err) {
      // 发不出声就算了
    }
  };

  return {
    unlock: ensure,
    click: () => tone('sine', 180, 40, 0.08, 0.2),
    chime: () => tone('triangle', 880, 1760, 0.35, 0.22),
    rumble: () => {
      [55, 65.4, 77.8].forEach((f) => tone('sawtooth', f, f, 0.8, 0.12));
    },
  };
};

export const useSkullMatch = ({ table }) => {
  const [game, setGame] = useState(null);
  const gameRef = useRef(null);

  const [remainingMs, setRemainingMs] = useState(TURN_TIME_LIMIT_MS);
  const [bubbles, setBubbles] = useState({});
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [bidValue, setBidValue] = useState(1);
  const [showResult, setShowResult] = useState(false);
  const [stats, setStats] = useState(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [soundOn, setSoundOn] = useState(true);

  const startedAtRef = useRef(0);
  const durationRef = useRef(0);
  const recordedRef = useRef(false);
  const spokenRef = useRef({});
  const bubbleTimersRef = useRef({});
  const noticeTimerRef = useRef(null);
  const resultTimerRef = useRef(null);
  const roundTimerRef = useRef(null);
  const boldnessRef = useRef([]);
  const commitRef = useRef(null);
  const soundRef = useRef(true);
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudio();

  soundRef.current = soundOn;

  // 存档用的座位信息：只要 id、名字、是不是 NPC。
  const players = useMemo(
    () => table.map((p) => ({ id: p.id, name: p.name, isNpc: !!p.isNpc })),
    [table]
  );

  const nameOf = useCallback((seat) => (seat === 0 ? '你' : table[seat]?.name || '对手'), [table]);

  const play = (sound) => {
    if (soundRef.current) audioRef.current[sound]();
  };
  const unlock = () => audioRef.current.unlock();

  // ---------- 台词和提示 ----------
  const speak = (seat, kind) => {
    if (seat === 0) return;
    const optional = !MANDATORY_KINDS.includes(kind);
    const spoken = spokenRef.current[seat] || 0;
    if (optional) {
      if (spoken >= OPTIONAL_LINE_LIMIT) return;
      if (Math.random() > (LINE_CHANCE[kind] ?? 0.4)) return;
    }
    const text = pickLine(table[seat], kind);
    if (!text) return;

    if (optional) spokenRef.current[seat] = spoken + 1;
    setBubbles((prev) => ({ ...prev, [seat]: { text, key: Date.now() + Math.random() } }));

    if (bubbleTimersRef.current[seat]) clearTimeout(bubbleTimersRef.current[seat]);
    bubbleTimersRef.current[seat] = setTimeout(() => {
      setBubbles((prev) => {
        const next = { ...prev };
        delete next[seat];
        return next;
      });
    }, BUBBLE_MS);
  };

  const say = (text) => {
    setNotice(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(''), NOTICE_MS);
  };

  // ---------- 引擎事件 -> 界面反馈 ----------
  const processEvents = (events) => {
    events.forEach((ev) => {
      switch (ev.type) {
        case 'place':
          play('click');
          if (ev.player !== 0) say(`${nameOf(ev.player)}扣下了一张牌`);
          speak(ev.player, 'place');
          break;
        case 'bid':
          play('click');
          if (ev.raise) {
            say(`${nameOf(ev.player)}加价到 ${ev.count}`);
            speak(ev.player, 'raise');
          } else {
            say(`${nameOf(ev.player)}开始叫数：${ev.count}`);
            speak(ev.player, 'bid');
          }
          break;
        case 'pass':
          say(`${nameOf(ev.player)}弃权`);
          speak(ev.player, 'pass');
          break;
        case 'flip':
          if (ev.kind === 'skull') {
            play('rumble');
            setShakeKey((k) => k + 1);
            speak(ev.player, 'skull');
          } else {
            play('chime');
            speak(ev.player, 'rose');
          }
          break;
        case 'success':
          play('chime');
          say(`${nameOf(ev.player)}翻牌成功，拿到一枚胜利印记`);
          break;
        case 'eliminated':
          say(`${nameOf(ev.player)}的牌用光了，被淘汰`);
          break;
        case 'timeout':
          if (ev.player === 0) say('20 秒到了，已经自动替你处理');
          break;
        case 'round_start':
          setSelectedId(null);
          say(`第 ${ev.round} 轮，${nameOf(ev.starter)}先放牌`);
          break;
        case 'game_end': {
          speak(ev.winner, 'win');
          const others = [1, 2, 3].filter((s) => s !== ev.winner && table[s]);
          if (others.length > 0) speak(others[Math.floor(Math.random() * others.length)], 'lose');
          break;
        }
        default:
          break;
      }
    });
  };

  const commit = (nextState, events) => {
    gameRef.current = nextState;
    setGame(nextState);
    processEvents(events);
  };
  commitRef.current = commit;

  // ---------- 开局 ----------
  const startMatch = useCallback(() => {
    Object.values(bubbleTimersRef.current).forEach(clearTimeout);
    [noticeTimerRef, resultTimerRef, roundTimerRef].forEach((ref) => {
      if (ref.current) clearTimeout(ref.current);
    });
    bubbleTimersRef.current = {};
    spokenRef.current = {};
    recordedRef.current = false;
    startedAtRef.current = Date.now();
    durationRef.current = 0;
    // 每位电脑玩家这一局有一点点性格差异：有的敢叫，有的稳一点。
    boldnessRef.current = table.map(() => Math.random() - 0.5);

    const fresh = createGame({ playerIds: table.map((p) => p.id) });
    gameRef.current = fresh;
    setGame(fresh);
    setBubbles({});
    setNotice('');
    setSelectedId(null);
    setBidValue(1);
    setShowResult(false);
    setStats(null);
    setRemainingMs(TURN_TIME_LIMIT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  // ---------- 电脑玩家的回合 ----------
  const runAiStep = () => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing' || g.phase === PHASE.ROUND_OVER || g.currentIndex === 0) return;

    const idx = g.currentIndex;
    const move = pickAiMove(g, idx, { boldness: boldnessRef.current[idx] || 0 });
    let result = applyAiMove(g, idx, move);

    // 理论上策略只会给出合法操作；万一出错，退回引擎的保守默认操作，
    // 保证对局不会卡死。
    if (!result.ok) result = applyTimeout(g, idx);
    if (!result.ok) return;

    commitRef.current(result.state, result.events);
  };

  useEffect(() => {
    if (!game || game.status !== 'playing') return undefined;
    if (game.phase === PHASE.ROUND_OVER || game.currentIndex === 0) return undefined;

    const flipping = game.phase === PHASE.FLIPPING;
    const min = flipping ? AI_FLIP_DELAY_MIN_MS : AI_DELAY_MIN_MS;
    const max = flipping ? AI_FLIP_DELAY_MAX_MS : AI_DELAY_MAX_MS;
    let delay = min + Math.random() * (max - min);
    if (game.players[0].eliminated) delay *= SPECTATOR_SPEEDUP;

    const timer = setTimeout(runAiStep, delay);
    return () => clearTimeout(timer);
    // runAiStep 读的是 gameRef，不依赖闭包里的 game。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.turnCount, game?.currentIndex, game?.phase, game?.round, game?.status]);

  // ---------- 一轮结束后自动开下一轮 ----------
  const advanceRound = () => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing' || g.phase !== PHASE.ROUND_OVER) return;
    const r = startNextRound(g);
    if (r.ok) commitRef.current(r.state, r.events);
  };

  useEffect(() => {
    if (!game || game.status !== 'playing' || game.phase !== PHASE.ROUND_OVER) return undefined;

    const wait = game.players[0].eliminated
      ? ROUND_OVER_DELAY_MS * SPECTATOR_SPEEDUP * 2
      : ROUND_OVER_DELAY_MS;
    roundTimerRef.current = setTimeout(advanceRound, wait);
    return () => clearTimeout(roundTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.round, game?.status]);

  const skipRoundWait = () => {
    unlock();
    if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    advanceRound();
  };

  // ---------- 用户 20 秒倒计时 ----------
  // 依赖里带 turnCount：用户连续翻几张牌时，每翻一张重新计时。
  const isMyTurn =
    !!game &&
    game.status === 'playing' &&
    game.currentIndex === 0 &&
    game.phase !== PHASE.ROUND_OVER;

  useEffect(() => {
    if (!isMyTurn) return undefined;

    const deadline = Date.now() + TURN_TIME_LIMIT_MS;
    setRemainingMs(TURN_TIME_LIMIT_MS);

    const timer = setInterval(() => {
      const left = deadline - Date.now();
      if (left > 0) {
        setRemainingMs(left);
        return;
      }

      clearInterval(timer);
      setRemainingMs(0);
      const g = gameRef.current;
      if (g && g.status === 'playing' && g.currentIndex === 0 && g.phase !== PHASE.ROUND_OVER) {
        const r = applyTimeout(g, 0);
        if (r.ok) {
          setSelectedId(null);
          commitRef.current(r.state, r.events);
        }
      }
    }, 100);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, game?.turnCount, game?.phase]);

  // 轮到用户叫数/加价时，给叫数步进器一个合理的起点。
  useEffect(() => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing' || g.currentIndex !== 0) return;
    const max = tableCount(g);
    if (g.phase === PHASE.ADDING) {
      setBidValue(clamp(g.players[0].stack.length, 1, max));
    } else if (g.phase === PHASE.BIDDING && g.bid) {
      setBidValue(Math.min(g.bid.count + 1, max));
    }
  }, [game?.turnCount, game?.phase, game?.currentIndex]);

  // ---------- 结束：只存一次档 ----------
  useEffect(() => {
    if (!game || game.status !== 'ended' || recordedRef.current) return;
    recordedRef.current = true;
    durationRef.current = Date.now() - startedAtRef.current;

    recordSkullMatch({
      summary: getMatchSummary(game),
      players,
      durationMs: durationRef.current,
    })
      .then(() => getSkullStats())
      .then((s) => setStats(s))
      .catch((err) => console.warn('骷髅牌存档失败', err));

    // 稍等一下再弹结算页，让最后一次翻牌和赢家台词能被看到。
    resultTimerRef.current = setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status]);

  useEffect(
    () => () => {
      Object.values(bubbleTimersRef.current).forEach(clearTimeout);
      [noticeTimerRef, resultTimerRef, roundTimerRef].forEach((ref) => {
        if (ref.current) clearTimeout(ref.current);
      });
    },
    []
  );

  // ---------- 用户操作 ----------
  const apply = (fn) => {
    const g = gameRef.current;
    if (!g) return null;
    const r = fn(g);
    if (!r.ok) return r;
    commit(r.state, r.events);
    return r;
  };

  const legal = useMemo(
    () => (game && isMyTurn ? getLegalActions(game, 0) : null),
    [game, isMyTurn]
  );

  const selectCard = (cardId) => {
    unlock();
    if (!isMyTurn) return;
    setSelectedId((cur) => (cur === cardId ? null : cardId));
  };

  const confirmPlace = () => {
    unlock();
    if (!isMyTurn || !selectedId) return;
    const r = apply((state) => placeCard(state, 0, selectedId));
    if (r?.ok) setSelectedId(null);
  };

  const adjustBid = (delta) => {
    unlock();
    if (!legal || legal.minBid == null) return;
    setBidValue((v) => clamp(v + delta, legal.minBid, legal.maxBid));
  };

  // 开始叫数（放牌阶段）或加价（叫数阶段），数字取步进器里的值。
  const confirmBid = () => {
    unlock();
    const g = gameRef.current;
    if (!g || !isMyTurn) return;
    if (g.phase === PHASE.ADDING) apply((state) => startBid(state, 0, bidValue));
    else if (g.phase === PHASE.BIDDING) apply((state) => raiseBid(state, 0, bidValue));
  };

  const pass = () => {
    unlock();
    if (!isMyTurn) return;
    apply((state) => passBid(state, 0));
  };

  // 翻 target 座位牌堆最上面那张；翻自己时 target 传 0。
  const flipTarget = (target) => {
    unlock();
    if (!isMyTurn) return;
    apply((state) => flipCard(state, 0, target));
  };

  const discardCard = (cardId) => {
    unlock();
    if (!isMyTurn) return;
    apply((state) => chooseDiscard(state, 0, cardId));
  };

  const toggleSound = () => setSoundOn((on) => !on);

  // ---------- 界面要用的派生数据 ----------
  const herald = useMemo(() => buildHerald(game, nameOf), [game, nameOf]);
  const seatBids = useMemo(() => getSeatBids(game), [game]);

  const standings = useMemo(
    () => (game && game.status === 'ended' ? getStandings(game) : []),
    [game]
  );

  const momentLines = useMemo(() => {
    if (!game || game.status !== 'ended') return [];
    return buildSummaryLinesForUser({ row: { moments: game.moments }, players });
  }, [game, players]);

  return {
    game,
    isMyTurn,
    legal,
    herald,
    seatBids,
    remainingMs,
    bubbles,
    notice,
    selectedId,
    bidValue,
    shakeKey,
    soundOn,
    showResult,
    stats,
    standings,
    momentLines,
    durationMs: durationRef.current,
    nameOf,
    startMatch,
    selectCard,
    confirmPlace,
    adjustBid,
    confirmBid,
    pass,
    flipTarget,
    discardCard,
    skipRoundWait,
    toggleSound,
  };
};