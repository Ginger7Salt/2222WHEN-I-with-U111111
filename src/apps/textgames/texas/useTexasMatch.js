// src/apps/textgames/texas/useTexasMatch.js
//
// 一桌德州扑克的"控制器"：把纯规则引擎（texasEngine.js）、角色策略
// （texasAi.js）、台词（texasLines.js）、筹码结算（texasChipsService.js/
// texasService.js）串起来，给 TexasHoldemGame.jsx 一个干净的接口。界面
// 只管渲染和转发点击，所有时序都在这里——跟 uno/useUnoMatch.js 同一个
// 分工思路。
//
// 跟 UNO 不一样的地方：UNO 一次 useUnoMatch 生命周期就是"打到有人出完
// 牌"那一局；这里一次生命周期是"坐下到离桌/被淘汰"的一整个会话，中间
// 会连打很多手牌，每一手结束后停下来给用户看结果、由用户主动点"下一手"
// 才继续（摊牌信息值得让人看一眼，不想像 UNO 的整局计时器那样硬推）。
//
// 时序约定：
// - 角色每一步停 1.2～3.2 秒再行动，营造"在想"的感觉；
// - 轮到角色行动前，如果上一步刚好是发新公共牌，先停一小会儿让玩家
//   看清楚新牌再继续；
// - 用户每一步 20 秒超时：能过牌就自动过牌，否则自动弃牌；
// - 每一手结束后停在结算横幅，用户点"下一手"才继续发下一手牌，点
//   "离场结算"随时可以把这一桌的筹码带着走（只有在手与手之间才能点，
//   一手牌进行中不能中途撤)。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  betOrRaise,
  canStartHand,
  checkOrCall,
  createTable,
  fold,
  getLegalActions,
  goAllIn,
  advanceStreet,
  isBettingRoundOver,
  sessionHasEnded,
  startHand,
  getPotTotal,
} from './texasEngine';
import { pickAiAction } from './texasAi';
import { LINE_CHANCE, MANDATORY_KINDS, OPTIONAL_LINE_LIMIT, pickTexasLine } from './texasLines';
import { adjustChipBalance } from './texasChipsService';
import { getTexasStats, recordTexasMatch } from './texasService';
import { buildSummaryLinesForUser } from './texasMatchFormat';

export const AI_DELAY_MIN_MS = 1200;
export const AI_DELAY_MAX_MS = 3200;
export const STREET_REVEAL_DELAY_MS = 1100;
export const TURN_TIME_LIMIT_MS = 20000;
const BUBBLE_MS = 2800;
const NOTICE_MS = 2200;

const SMALL_BLIND_RATIO = 0.025;
const BIG_BLIND_RATIO = 0.05;

export const computeBlinds = (buyIn) => {
  const bigBlind = Math.max(2, Math.round(buyIn * BIG_BLIND_RATIO));
  const smallBlind = Math.max(1, Math.round(bigBlind / 2));
  return { smallBlind, bigBlind };
};

export const useTexasMatch = ({ characters, buyIn }) => {
  const [table, setTable] = useState(null);
  const tableRef = useRef(null);

  const [remainingMs, setRemainingMs] = useState(TURN_TIME_LIMIT_MS);
  const [bubbles, setBubbles] = useState({});
  const [notice, setNotice] = useState('');
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [handsPlayed, setHandsPlayed] = useState(0);
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false); // 正在自动推进街/结算的时候，按钮先锁住

  const startedAtRef = useRef(0);
  const handsPlayedRef = useRef(0);
  const spokenRef = useRef({});
  const handledHandNumberRef = useRef(0);
  const sessionRecordedRef = useRef(false);
  const bubbleTimersRef = useRef({});
  const noticeTimerRef = useRef(null);
  const advanceTimerRef = useRef(null);
  const aiTimerRef = useRef(null);
  const commitRef = useRef(null);

  const players = useMemo(
    () => [{ id: 'user', name: '你' }, ...characters.map((c) => ({ id: c.id, name: c.name }))],
    [characters]
  );
  const nameOf = (seat) => (seat === 0 ? '你' : characters[seat - 1]?.name || '对手');

  // ---------- 台词气泡 ----------
  const speak = (seat, kind) => {
    if (seat === 0) return;
    const spoken = spokenRef.current[seat] || 0;
    if (!MANDATORY_KINDS.includes(kind)) {
      if (spoken >= OPTIONAL_LINE_LIMIT) return;
      if (Math.random() > (LINE_CHANCE[kind] ?? 0.4)) return;
    }
    const text = pickTexasLine(characters[seat - 1], kind);
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

  const processEvents = (events) => {
    events.forEach((ev) => {
      switch (ev.type) {
        case 'fold':
          say(`${nameOf(ev.seat)}弃牌`);
          break;
        case 'call':
          if (ev.amount > 0) say(`${nameOf(ev.seat)}跟注 ${ev.amount}`);
          else say(`${nameOf(ev.seat)}过牌`);
          break;
        case 'check':
          say(`${nameOf(ev.seat)}过牌`);
          break;
        case 'raise':
          say(`${nameOf(ev.seat)}加注到 ${ev.amount}`);
          speak(ev.seat, 'raise');
          break;
        case 'allin':
          say(`${nameOf(ev.seat)}全下，${ev.amount}！`);
          speak(ev.seat, 'allin');
          break;
        case 'street':
          say(ev.street === 'flop' ? '发出翻牌' : ev.street === 'turn' ? '发出转牌' : '发出河牌');
          break;
        default:
          break;
      }
    });
  };

  const commit = (nextState, events) => {
    tableRef.current = nextState;
    setTable(nextState);
    processEvents(events || []);
  };
  commitRef.current = commit;

  // ---------- 开局：买入上桌，发第一手 ----------
  const startSession = useCallback(async () => {
    Object.values(bubbleTimersRef.current).forEach(clearTimeout);
    [noticeTimerRef, advanceTimerRef, aiTimerRef].forEach((ref) => {
      if (ref.current) clearTimeout(ref.current);
    });
    bubbleTimersRef.current = {};
    spokenRef.current = {};
    handledHandNumberRef.current = 0;
    sessionRecordedRef.current = false;
    handsPlayedRef.current = 0;
    startedAtRef.current = Date.now();

    await adjustChipBalance(-buyIn);

    const { smallBlind, bigBlind } = computeBlinds(buyIn);
    const seatConfigs = [{ id: 'user', name: '你' }, ...characters.map((c) => ({ id: c.id, name: c.name }))];
    const fresh = createTable({ seatConfigs, smallBlind, bigBlind, startingStack: buyIn });
    const started = startHand(fresh);

    tableRef.current = started.state;
    setTable(started.state);
    handsPlayedRef.current = 1;
    setHandsPlayed(1);
    setBubbles({});
    setNotice('');
    setRaiseAmount(0);
    setSessionResult(null);
    setSessionEnded(false);
    setStats(null);
    setRemainingMs(TURN_TIME_LIMIT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters, buyIn]);

  // ---------- 角色行动 ----------
  const runAiStep = () => {
    const t = tableRef.current;
    if (!t || t.street === 'handOver' || t.street === 'idle') return;
    const seatIdx = t.toAct[0];
    if (seatIdx === undefined || seatIdx === 0) return;

    const move = pickAiAction(t, seatIdx);
    let result;
    if (move.action === 'fold') result = fold(t, seatIdx);
    else if (move.action === 'check') result = checkOrCall(t, seatIdx);
    else if (move.action === 'call') result = checkOrCall(t, seatIdx);
    else if (move.action === 'raise') result = betOrRaise(t, seatIdx, move.toTotal);
    else result = checkOrCall(t, seatIdx);

    if (!result.ok) {
      // 兜底：策略给出了非法动作（理论上不该发生），退到最保守的
      // check/call，保证桌子不会卡死。
      result = checkOrCall(t, seatIdx);
      if (!result.ok) result = fold(t, seatIdx);
      if (!result.ok) return;
    }

    commit(result.state, result.events);
  };

  useEffect(() => {
    if (!table || table.street === 'handOver' || table.street === 'idle') return undefined;
    const seatIdx = table.toAct[0];
    if (seatIdx === undefined || seatIdx === 0) return undefined;

    const delay = AI_DELAY_MIN_MS + Math.random() * (AI_DELAY_MAX_MS - AI_DELAY_MIN_MS);
    aiTimerRef.current = setTimeout(runAiStep, delay);
    return () => clearTimeout(aiTimerRef.current);
    // runAiStep 读的是 tableRef，不依赖闭包里的 table。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.toAct, table?.street, table?.handNumber]);

  // ---------- 这条街下注结束：自动发下一条街/摊牌 ----------
  useEffect(() => {
    if (!table || !isBettingRoundOver(table)) return undefined;

    setBusy(true);
    advanceTimerRef.current = setTimeout(() => {
      const t = tableRef.current;
      if (!t || !isBettingRoundOver(t)) {
        setBusy(false);
        return;
      }
      const r = advanceStreet(t);
      setBusy(false);
      if (r.ok) commitRef.current(r.state, r.events);
    }, STREET_REVEAL_DELAY_MS);

    return () => clearTimeout(advanceTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.toAct, table?.street]);

  // ---------- 用户 20 秒倒计时 ----------
  useEffect(() => {
    if (!table || table.street === 'handOver' || table.street === 'idle') return undefined;
    if (table.toAct[0] !== 0) return undefined;

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
      const t = tableRef.current;
      if (!t || t.toAct[0] !== 0) return;
      const legal = getLegalActions(t, 0);
      const r = legal.canCheck ? checkOrCall(t, 0) : fold(t, 0);
      if (r.ok) commitRef.current(r.state, r.events);
    }, 150);

    return () => clearInterval(timer);
  }, [table?.toAct, table?.street, table?.handNumber]);

  // ---------- 一手牌结束：说赢/输的台词，检查会话是否该结束了 ----------
  useEffect(() => {
    if (!table || table.street !== 'handOver') return;
    if (handledHandNumberRef.current === table.handNumber) return;
    handledHandNumberRef.current = table.handNumber;

    const winners = Array.from(
      new Set((table.winnersInfo?.pots || []).flatMap((p) => p.winners))
    );
    winners.forEach((seat) => {
      if (seat !== 0) speak(seat, 'win');
    });
    if (!table.winnersInfo?.uncontested) {
      const showdownSeats = table.seats
        .map((s, i) => i)
        .filter((i) => !table.seats[i].folded);
      const losers = showdownSeats.filter((i) => !winners.includes(i));
      losers.forEach((seat) => {
        if (seat !== 0) speak(seat, 'lose');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.street, table?.handNumber]);

  // ---------- 会话结束（有人被淘汰到只剩一人）：自动结算 ----------
  useEffect(() => {
    if (!table || table.street !== 'handOver') return;
    if (!sessionHasEnded(table) || sessionRecordedRef.current) return;
    sessionRecordedRef.current = true;

    const endReason = table.seats[0].out ? 'busted' : 'wonAll';
    (async () => {
      await adjustChipBalance(table.seats[0].stack);
      const saved = await recordTexasMatch({
        table,
        players,
        buyIn,
        handsPlayed: handsPlayedRef.current,
        endReason,
        durationMs: Date.now() - startedAtRef.current,
      });
      setSessionResult(saved?.row || null);
      setSessionEnded(true);
      getTexasStats().then(setStats).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.street, table?.handNumber]);

  useEffect(
    () => () => {
      Object.values(bubbleTimersRef.current).forEach(clearTimeout);
      [noticeTimerRef, advanceTimerRef, aiTimerRef].forEach((ref) => {
        if (ref.current) clearTimeout(ref.current);
      });
    },
    []
  );

  // ---------- 用户操作 ----------
  const apply = (fn) => {
    const t = tableRef.current;
    if (!t) return null;
    const r = fn(t);
    if (!r.ok) return r;
    commit(r.state, r.events);
    return r;
  };

  const isMyTurn = !!table && table.street !== 'handOver' && table.street !== 'idle' && table.toAct[0] === 0;
  const legal = useMemo(() => (table && isMyTurn ? getLegalActions(table, 0) : { canAct: false }), [table, isMyTurn]);

  useEffect(() => {
    if (!isMyTurn || !legal.canAct || !legal.canRaise) return;
    setRaiseAmount((cur) => {
      if (cur >= legal.minRaiseTo && cur <= legal.maxRaiseTo) return cur;
      return legal.minRaiseTo;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, legal.minRaiseTo, legal.maxRaiseTo]);

  const doFold = () => isMyTurn && apply((t) => fold(t, 0));
  const doCheckOrCall = () => isMyTurn && apply((t) => checkOrCall(t, 0));
  const doRaiseTo = (toTotal) => isMyTurn && apply((t) => betOrRaise(t, 0, toTotal));
  const doAllIn = () => isMyTurn && apply((t) => goAllIn(t, 0));

  // ---------- 手与手之间：下一手 / 离场结算 ----------
  const nextHand = () => {
    const t = tableRef.current;
    if (!t || t.street !== 'handOver' || sessionEnded) return;
    if (!canStartHand(t)) return; // 该结算了，交给上面那个 effect
    const r = startHand(t);
    if (!r.ok) return;
    handsPlayedRef.current += 1;
    setHandsPlayed(handsPlayedRef.current);
    setBubbles({});
    setNotice('');
    commit(r.state, r.events);
  };

  const leaveTable = async () => {
    const t = tableRef.current;
    if (!t || t.street !== 'handOver' || sessionEnded || sessionRecordedRef.current) return;
    sessionRecordedRef.current = true;

    await adjustChipBalance(t.seats[0].stack);
    const saved = await recordTexasMatch({
      table: t,
      players,
      buyIn,
      handsPlayed: handsPlayedRef.current,
      endReason: 'left',
      durationMs: Date.now() - startedAtRef.current,
    });
    setSessionResult(saved?.row || null);
    setSessionEnded(true);
    getTexasStats().then(setStats).catch(() => {});
  };

  const potTotal = table ? getPotTotal(table) : 0;
  const momentLines = useMemo(() => {
    if (!sessionResult) return [];
    return buildSummaryLinesForUser({ row: sessionResult, players });
  }, [sessionResult, players]);

  return {
    table,
    potTotal,
    isMyTurn,
    legal,
    remainingMs,
    bubbles,
    notice,
    busy,
    raiseAmount,
    setRaiseAmount,
    handsPlayed,
    sessionResult,
    sessionEnded,
    stats,
    momentLines,
    nameOf,
    startSession,
    doFold,
    doCheckOrCall,
    doRaiseTo,
    doAllIn,
    nextHand,
    leaveTable,
  };
};