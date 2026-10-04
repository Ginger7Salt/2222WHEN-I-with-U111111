// src/apps/textgames/uno/useUnoMatch.js
//
// 一局 UNO 的“控制器”：把纯规则引擎（unoEngine.js）、角色策略（unoAi.js）、
// 台词（unoLines.js）、存档（unoService.js）和计时器串起来，给 UnoGame.jsx
// 一个干净的接口。界面只管渲染和转发点击，所有时序都在这里。
//
// 座位：0 是用户，1、2 是两位角色（characters[0]、characters[1]）。
//
// 时序约定（用户确认过的）：
// - 角色每手停 1.5-2 秒再出牌；抽到能出的牌后的第二步停 0.8 秒；
// - 用户每手 15 秒，超时自动抽一张并结束这一轮（引擎的 applyTimeout）；
// - 用户出到只剩一张没喊 UNO：下一位角色行动前（那 1.5-2 秒）就是用户的
//   补喊窗口，角色行动时有概率抓包（CATCH_UNO_CHANCE）；
// - 角色出到只剩一张：有概率忘喊（FORGET_UNO_CHANCE），忘了的话用户可以
//   点“抓”，窗口到下一位玩家行动为止。
//
// 对局状态只放在 React state 里不落库，中途退出就是放弃；只有打完才由
// recordUnoMatch 写一次存档（用 ref 保证只写一次）。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  TURN_TIME_LIMIT_MS,
  applyTimeout,
  callUno,
  canPlayCard,
  catchUno,
  createGame,
  drawCard,
  getMatchSummary,
  getPlayableCardIds,
  getStandings,
  isWild,
  passTurn,
  playCard,
} from './unoEngine';
import { pickAiMove, shouldCallUno, shouldCatchUno } from './unoAi';
import { LINE_CHANCE, MANDATORY_KINDS, pickLine } from './unoLines';
import { getUnoStats, recordUnoMatch } from './unoService';
import { buildSummaryLinesForUser } from './unoMatchFormat';
import { isSpecialCard } from './UnoCard';

export const AI_DELAY_MIN_MS = 2000;
export const AI_DELAY_MAX_MS = 10000;
export const AI_FOLLOWUP_DELAY_MS = 800;
const BUBBLE_MS = 2800;
const FLASH_MS = 1500;
const NOTICE_MS = 2400;
const RESULT_DELAY_MS = 1800;
// 每位角色一局最多约 5 句：选说的台词最多占 4 句，给必说的留位置。
const OPTIONAL_LINE_LIMIT = 4;

const COLOR_ORDER = ['black', 'red', 'white', 'darkblue'];
const VALUE_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

// 手牌显示顺序：按颜色分组、数字从小到大，万能牌放最后，方便一眼找牌。
export const sortHandForDisplay = (hand) =>
  hand.slice().sort((a, b) => {
    const ca = a.color ? COLOR_ORDER.indexOf(a.color) : 99;
    const cb = b.color ? COLOR_ORDER.indexOf(b.color) : 99;
    if (ca !== cb) return ca - cb;
    return VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value) || (a.value < b.value ? -1 : 1);
  });

export const useUnoMatch = ({ characters }) => {
  const [game, setGame] = useState(null);
  const gameRef = useRef(null);

  const [remainingMs, setRemainingMs] = useState(TURN_TIME_LIMIT_MS);
  const [bubbles, setBubbles] = useState({});
  const [flash, setFlash] = useState(null);
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [wildPendingId, setWildPendingId] = useState(null);
  const [unoArmed, setUnoArmed] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [stats, setStats] = useState(null);

  const startedAtRef = useRef(0);
  const durationRef = useRef(0);
  const recordedRef = useRef(false);
  const spokenRef = useRef({});
  const bubbleTimersRef = useRef({});
  const flashTimerRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const resultTimerRef = useRef(null);
  const commitRef = useRef(null);

  const players = useMemo(
    () => [
      { id: 'user', name: '用户' },
      ...characters.map((c) => ({ id: c.id, name: c.name })),
    ],
    [characters]
  );

  const nameOf = (seat) => (seat === 0 ? '你' : characters[seat - 1]?.name || '对手');

  // ---------- 台词 ----------
  const speak = (seat, kind) => {
    if (seat === 0) return;
    const spoken = spokenRef.current[seat] || 0;
    if (!MANDATORY_KINDS.includes(kind)) {
      if (spoken >= OPTIONAL_LINE_LIMIT) return;
      if (Math.random() > (LINE_CHANCE[kind] ?? 0.4)) return;
    }
    const text = pickLine(characters[seat - 1], kind);
    if (!text) return;

    spokenRef.current[seat] = spoken + 1;
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
        case 'play':
          if (ev.player !== 0 && isSpecialCard(ev.card)) {
            setFlash({ card: ev.card, who: nameOf(ev.player), color: ev.color, key: Date.now() });
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setFlash(null), FLASH_MS);
          }
          if (ev.card.value === 'skip') speak(ev.player, 'skip');
          break;
        case 'skip':
          say(`${nameOf(ev.target)}被跳过了`);
          break;
        case 'reverse':
          say('出牌方向反转了');
          break;
        case 'penalty_draw':
          say(`${nameOf(ev.target)}被罚抽 ${ev.count} 张，并跳过这一轮`);
          if (ev.cause === 'wild4') speak(ev.player, 'wild4');
          speak(ev.target, 'hit');
          break;
        case 'uno_called':
          say(`${nameOf(ev.player)}喊了 UNO`);
          speak(ev.player, 'uno');
          break;
        case 'uno_caught':
          say(`${nameOf(ev.player)}抓到${nameOf(ev.target)}没喊 UNO，罚抽 ${ev.count} 张`);
          speak(ev.target, 'caught');
          speak(ev.player, 'catch');
          break;
        case 'timeout':
          say('15 秒到了，自动替你抽了一张牌');
          break;
        case 'win': {
          speak(ev.player, 'win');
          const losers = [1, 2].filter((s) => s !== ev.player);
          if (ev.player !== 0 && losers.length > 0) speak(losers[0], 'lose');
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
    [flashTimerRef, noticeTimerRef, resultTimerRef].forEach((ref) => {
      if (ref.current) clearTimeout(ref.current);
    });
    bubbleTimersRef.current = {};
    spokenRef.current = {};
    recordedRef.current = false;
    startedAtRef.current = Date.now();
    durationRef.current = 0;

    const fresh = createGame({ playerIds: ['user', ...characters.map((c) => c.id)] });
    gameRef.current = fresh;
    setGame(fresh);
    setBubbles({});
    setFlash(null);
    setNotice('');
    setSelectedId(null);
    setWildPendingId(null);
    setUnoArmed(false);
    setShowResult(false);
    setStats(null);
    setRemainingMs(TURN_TIME_LIMIT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters]);

  // ---------- 角色回合 ----------
  const runAiStep = () => {
    let g = gameRef.current;
    if (!g || g.status !== 'playing' || g.currentIndex === 0) return;

    const idx = g.currentIndex;
    const events = [];

    // 行动前先看用户是不是忘了喊 UNO：有概率被抓。
    if (g.unoVulnerable === 0 && shouldCatchUno()) {
      const caught = catchUno(g, idx);
      if (caught.ok) {
        g = caught.state;
        events.push(...caught.events);
      }
    }

    const move = pickAiMove(g, idx);
    let result;
    if (move.action === 'draw') {
      result = drawCard(g, idx);
    } else if (move.action === 'pass') {
      result = passTurn(g, idx);
    } else {
      result = playCard(g, idx, move.cardId, {
        chosenColor: move.chosenColor,
        // 出完这张手里只剩一张：有概率忘喊 UNO。
        callUno: g.players[idx].hand.length === 2 && shouldCallUno(),
      });
    }

    // 理论上策略只会给出合法操作；万一出错，退回最保险的“抽一张”，
    // 保证对局不会卡死。
    if (!result.ok) {
      result = drawCard(g, idx);
      if (!result.ok) result = passTurn(g, idx);
      if (!result.ok) return;
    }

    events.push(...result.events);
    commit(result.state, events);
  };

  useEffect(() => {
    if (!game || game.status !== 'playing' || game.currentIndex === 0) return undefined;

    const delay = game.drawnCardId
      ? AI_FOLLOWUP_DELAY_MS
      : AI_DELAY_MIN_MS + Math.random() * (AI_DELAY_MAX_MS - AI_DELAY_MIN_MS);
    const timer = setTimeout(runAiStep, delay);
    return () => clearTimeout(timer);
    // runAiStep 读的是 gameRef，不依赖闭包里的 game。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.turnCount, game?.currentIndex, game?.drawnCardId, game?.status]);

  // ---------- 用户 15 秒倒计时 ----------
  // 依赖里故意不放 drawnCardId：用户抽到能出的牌后还在同一回合里，倒计时
  // 不重置。
  useEffect(() => {
    if (!game || game.status !== 'playing' || game.currentIndex !== 0) return undefined;

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
      if (g && g.status === 'playing' && g.currentIndex === 0) {
        const r = applyTimeout(g, 0);
        if (r.ok) {
          setSelectedId(null);
          setWildPendingId(null);
          setUnoArmed(false);
          commitRef.current(r.state, r.events);
        }
      }
    }, 100);

    return () => clearInterval(timer);
  }, [game?.turnCount, game?.currentIndex, game?.status]);

  // ---------- 结束：只存一次档 ----------
  useEffect(() => {
    if (!game || game.status !== 'ended' || recordedRef.current) return;
    recordedRef.current = true;
    durationRef.current = Date.now() - startedAtRef.current;

    recordUnoMatch({
      summary: getMatchSummary(game),
      players,
      durationMs: durationRef.current,
    })
      .then(() => getUnoStats())
      .then((s) => setStats(s))
      .catch((err) => console.warn('UNO 存档失败', err));

    // 稍等一下再弹结算页，让最后一张牌和赢家台词能被看到。
    resultTimerRef.current = setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status]);

  useEffect(
    () => () => {
      Object.values(bubbleTimersRef.current).forEach(clearTimeout);
      [flashTimerRef, noticeTimerRef, resultTimerRef].forEach((ref) => {
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

  const isMyTurn = !!game && game.status === 'playing' && game.currentIndex === 0;

  const playableIds = useMemo(
    () => (game && game.status === 'playing' ? new Set(getPlayableCardIds(game, 0)) : new Set()),
    [game]
  );

  const selectCard = (cardId) => setSelectedId((cur) => (cur === cardId ? null : cardId));
  const clearSelection = () => setSelectedId(null);

  const doPlay = (cardId, chosenColor) => {
    const g = gameRef.current;
    if (!g) return;
    const handLen = g.players[0].hand.length;
    const r = apply((state) =>
      playCard(state, 0, cardId, { chosenColor, callUno: unoArmed && handLen === 2 })
    );
    if (r?.ok) {
      setSelectedId(null);
      setWildPendingId(null);
      setUnoArmed(false);
    }
  };

  const playSelected = () => {
    const g = gameRef.current;
    if (!g || !isMyTurn || !selectedId) return;
    const card = g.players[0].hand.find((c) => c.id === selectedId);
    if (!card || !canPlayCard(g, card)) return;
    if (g.drawnCardId && g.drawnCardId !== selectedId) return;

    if (isWild(card)) {
      setWildPendingId(selectedId);
    } else {
      doPlay(selectedId, null);
    }
  };

  const chooseWildColor = (color) => {
    if (wildPendingId) doPlay(wildPendingId, color);
  };
  const cancelWild = () => setWildPendingId(null);

  const draw = () => {
    if (!isMyTurn) return;
    const r = apply((state) => drawCard(state, 0));
    if (r?.ok) {
      // 抽到能出的牌：直接选中它，详情面板里可以出或者过。
      setSelectedId(r.canPlayDrawn && r.drawnCard ? r.drawnCard.id : null);
      setUnoArmed(false);
    }
  };

  const pass = () => {
    if (!isMyTurn) return;
    const r = apply((state) => passTurn(state, 0));
    if (r?.ok) {
      setSelectedId(null);
      setUnoArmed(false);
    }
  };

  // UNO 按钮：已经暴露（出完只剩一张还没喊）就补喊；还没出牌、手里正好
  // 两张时是“预先喊”，接下来出牌会一并喊出；其他时候提示不用喊。
  const pressUno = () => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing') return;

    if (g.unoVulnerable === 0) {
      apply((state) => callUno(state, 0));
      return;
    }
    if (g.currentIndex === 0 && g.players[0].hand.length === 2) {
      setUnoArmed((a) => !a);
      return;
    }
    say('现在还不用喊 UNO');
  };

  const catchOpponent = () => {
    const g = gameRef.current;
    if (!g || g.status !== 'playing' || g.unoVulnerable === null || g.unoVulnerable === 0) return;
    apply((state) => catchUno(state, 0));
  };

  // ---------- 结算页数据 ----------
  const standings = useMemo(
    () => (game && game.status === 'ended' ? getStandings(game) : []),
    [game]
  );

  const momentLines = useMemo(() => {
    if (!game || game.status !== 'ended') return [];
    return buildSummaryLinesForUser({
      row: { moments: game.moments },
      players: [{ id: 'user', name: '你' }, ...players.slice(1)],
    });
  }, [game, players]);

  return {
    game,
    isMyTurn,
    playableIds,
    remainingMs,
    bubbles,
    flash,
    notice,
    selectedId,
    wildPendingId,
    unoArmed,
    showResult,
    stats,
    standings,
    momentLines,
    durationMs: durationRef.current,
    nameOf,
    startMatch,
    selectCard,
    clearSelection,
    playSelected,
    chooseWildColor,
    cancelWild,
    draw,
    pass,
    pressUno,
    catchOpponent,
  };
};