// src/apps/textgames/liarsDice/useLiarsDiceMatch.js
//
// 一桌吹牛骰子的“控制器”：把纯规则引擎（liarsDiceEngine.js）、角色策略
// （liarsDiceAi.js）、台词（liarsDiceLines.js）、筹码结算（复用
// texas/texasChipsService.js，跟德州扑克共用同一个 textGamesChips 余额）
// 和结果回传（liarsDiceService.js）串起来，给 LiarsDiceGame.jsx 一个干净
// 的接口。界面只管渲染和转发点击，所有时序都在这里——跟
// uno/useUnoMatch.js、texas/useTexasMatch.js 同一个分工思路。
//
// 座位：0 是用户，1、2、3 是三位角色。用户选的角色不够三位时，用虚拟
// NPC 补满（fillWithNpcs）。
//
// 一次生命周期 = 从坐下（扣买入）到整局结束。中间会连打很多轮，每一轮
// 质疑开骰之后停在“摊牌”状态，让用户看清所有人的骰子，由用户点“下一
// 轮”才继续（跟德州扑克每一手之间的停顿一样）。
//
// 筹码（用户定的）：开局每人拿同样数量的筹码入底池（用户的那份从全局
// 余额里扣，其余三位是虚拟的），底池 = 买入 x 4。只剩一人有骰子时赢家
// 拿走整个底池：用户赢了就把底池加回余额，输了不用再动余额（买入已经
// 扣过了）。用户的骰子先用光了：不再继续模拟剩下三个人，直接算输。
// 用户在两轮之间点“离桌”：放弃，买入不退。对局进行中直接退出界面：
// 同样是放弃，什么都不记录（跟 UNO 一致）。
//
// 时序约定：
// - 角色每一步停 1.0-2.2 秒再行动（整局平均 65 次动作，其中约 49 次是
//   角色的，再长整局会拖得太久）；
// - 用户每一步 20 秒，超时由引擎自动叫一个最小的合法加码；
// - 质疑后停在摊牌状态，用户点“下一轮”才继续。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  SEAT_COUNT,
  TURN_TIME_LIMIT_MS,
  applyTimeout,
  challenge,
  createTable,
  findMinimalBid,
  getBidOptions,
  getTotalDice,
  placeBid,
  startRound,
} from './liarsDiceEngine';
import { pickAiMove } from './liarsDiceAi';
import { LINE_CHANCE, MANDATORY_KINDS, OPTIONAL_LINE_LIMIT, pickLine } from './liarsDiceLines';
import { buildMatchResult, buildSummaryLinesForUser } from './liarsDiceMatchFormat';
import { fillWithNpcs } from './liarsDiceNpcs';
import { recordLiarsDiceMatch } from './liarsDiceService';
import { adjustChipBalance, getChipBalance } from '../texas/texasChipsService';

export const AI_DELAY_MIN_MS = 1000;
export const AI_DELAY_MAX_MS = 2200;
const BUBBLE_MS = 2800;
const NOTICE_MS = 2400;

// 叫到骰子总数的这个比例以上，算“叫出很大的点数”，角色可能会放话。
const BIG_BID_RATIO = 0.5;

// 用户这一手选好的叫点（草稿）。每次轮到用户都重置成“最小的合法加码”，
// 优先沿用当前叫点的点数；点数、数量始终被夹在合法范围内。没有任何合法
// 加码时返回 null，界面只能让用户质疑。
export const normalizeDraft = (table, draft) => {
  const options = getBidOptions(table);
  const option = options.find((o) => o.face === draft.face);

  if (!option || !option.available) {
    const fallback = options.find((o) => o.available && o.face !== 1) || options.find((o) => o.available);
    return fallback ? { face: fallback.face, quantity: fallback.minQuantity } : null;
  }

  return {
    face: option.face,
    quantity: Math.min(option.maxQuantity, Math.max(option.minQuantity, draft.quantity)),
  };
};

export const useLiarsDiceMatch = ({ characters, stake }) => {
  const seatCharacters = useMemo(() => fillWithNpcs(characters), [characters]);
  const players = useMemo(
    () => [{ id: 'user', name: '你' }, ...seatCharacters.map((c) => ({ id: c.id, name: c.name }))],
    [seatCharacters]
  );

  const [table, setTable] = useState(null);
  const tableRef = useRef(null);

  const [remainingMs, setRemainingMs] = useState(TURN_TIME_LIMIT_MS);
  const [bubbles, setBubbles] = useState({});
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [chipBalance, setChipBalance] = useState(null);

  const startedAtRef = useRef(0);
  const activeStakeRef = useRef(0);
   const settledRef = useRef(false);
  const startingRef = useRef(false);
  const spokenRef = useRef({});
  const bubbleTimersRef = useRef({});
  const noticeTimerRef = useRef(null);
  const aiTimerRef = useRef(null);
  const commitRef = useRef(null);

  const nameOf = (seat) => (seat === 0 ? '你' : seatCharacters[seat - 1]?.name || '对手');

  // ---------- 台词气泡 / 提示条 ----------
  const speak = (seat, kind) => {
    if (seat === 0) return;
    const spoken = spokenRef.current[seat] || 0;
    if (!MANDATORY_KINDS.includes(kind)) {
      if (spoken >= OPTIONAL_LINE_LIMIT) return;
      if (Math.random() > (LINE_CHANCE[kind] ?? 0.4)) return;
    }
    const text = pickLine(seatCharacters[seat - 1], kind);
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
    events.forEach((ev, i) => {
      switch (ev.type) {
        case 'timeout': {
          // 引擎超时时先吐 timeout、紧接着吐 bid（或 challenge），两条提示会
          // 互相覆盖，所以这里把后一条的内容并进这一条里说。
          const following = events[i + 1];
          say(
            following && following.type === 'bid'
              ? `20 秒到了，自动替你叫了 ${following.quantity} 个 ${following.face} 点`
              : '20 秒到了，自动替你质疑开骰'
          );
          break;
        }
        case 'bid': {
          if (i > 0 && events[i - 1].type === 'timeout') break;
          say(`${nameOf(ev.seat)}叫了 ${ev.quantity} 个 ${ev.face} 点`);
          const t = tableRef.current;
          if (t && ev.quantity >= Math.ceil(getTotalDice(t) * BIG_BID_RATIO)) speak(ev.seat, 'bigbid');
          break;
        }
        case 'challenge':
          say(`${nameOf(ev.seat)}质疑${nameOf(ev.target)}，开骰`);
          speak(ev.seat, 'challenge');
          break;
        case 'reveal':
          if (ev.bidderRight) {
            speak(ev.bidder, 'defended');
            speak(ev.challenger, 'misfire');
          } else {
            speak(ev.bidder, 'exposed');
          }
          break;
        case 'lose_die':
          say(`${nameOf(ev.seat)}失去一颗骰子，还剩 ${ev.remaining} 颗`);
          break;
        case 'bust':
          speak(ev.seat, 'bust');
          break;
        case 'win': {
          speak(ev.seat, 'win');
          const losers = [1, 2, 3].filter((s) => s !== ev.seat);
          speak(losers[Math.floor(Math.random() * losers.length)], 'lose');
          break;
        }
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

  // ---------- 开局：买入上桌，开第一轮 ----------
  // 返回 { ok: true }，或 { ok: false, error: 'not_enough_chips' }。
  const startSession = useCallback(async () => {
    // 开发模式（React 严格模式）下界面的 effect 会跑两遍，同一时刻只允许
    // 一次开局，否则买入会被扣两次。被挡掉的那次返回 error: 'busy'。
    if (startingRef.current) return { ok: false, error: 'busy' };
    startingRef.current = true;

    const balance = await getChipBalance();
    if (balance < stake) {
      startingRef.current = false;
      return { ok: false, error: 'not_enough_chips' };
    }

    Object.values(bubbleTimersRef.current).forEach(clearTimeout);
    [noticeTimerRef, aiTimerRef].forEach((ref) => {
      if (ref.current) clearTimeout(ref.current);
    });
    bubbleTimersRef.current = {};
    spokenRef.current = {};
    settledRef.current = false;
    activeStakeRef.current = stake;
    startedAtRef.current = Date.now();

    const afterBuyIn = await adjustChipBalance(-stake);
    setChipBalance(afterBuyIn);

    const fresh = createTable({ seatConfigs: players.map((p) => ({ id: p.id, name: p.name })) });
    const started = startRound(fresh);

    tableRef.current = started.state;
    setTable(started.state);
    setBubbles({});
    setNotice('');
    setDraft(null);
    setSessionResult(null);
    setSessionEnded(false);
    setShowResult(false);
    setRemainingMs(TURN_TIME_LIMIT_MS);
    startingRef.current = false;
    return { ok: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, stake]);

  // 同一个“轮到谁、叫到了什么”只对应一个 key，倒计时和角色行动的 effect
  // 都靠它判断是不是换了新的一步。
  const turnKey = table
    ? `${table.roundNumber}:${table.currentIndex}:${
        table.currentBid
          ? `${table.currentBid.seat}-${table.currentBid.quantity}-${table.currentBid.face}`
          : 'open'
      }`
    : '';

  // ---------- 角色行动 ----------
  const runAiStep = () => {
    const t = tableRef.current;
    if (!t || t.status !== 'bidding' || t.currentIndex === 0) return;
    const seatIdx = t.currentIndex;

    const move = pickAiMove(t, seatIdx);
    let result =
      move.action === 'challenge'
        ? challenge(t, seatIdx)
        : placeBid(t, seatIdx, move.quantity, move.face);

    // 理论上策略只会给出合法动作；万一出错，退回最保险的操作，保证对局
    // 不会卡死：有人叫过点就质疑，没人叫过点就叫最小的合法点。
    if (!result.ok) {
      if (t.currentBid) {
        result = challenge(t, seatIdx);
      } else {
        const minimal = findMinimalBid(t);
        if (minimal) result = placeBid(t, seatIdx, minimal.quantity, minimal.face);
      }
      if (!result.ok) return;
    }

    commitRef.current(result.state, result.events);
  };

  useEffect(() => {
    if (!table || table.status !== 'bidding' || table.currentIndex === 0) return undefined;

    const delay = AI_DELAY_MIN_MS + Math.random() * (AI_DELAY_MAX_MS - AI_DELAY_MIN_MS);
    aiTimerRef.current = setTimeout(runAiStep, delay);
    return () => clearTimeout(aiTimerRef.current);
    // runAiStep 读的是 tableRef，不依赖闭包里的 table。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, table?.status]);

  // ---------- 用户 20 秒倒计时 ----------
  useEffect(() => {
    if (!table || table.status !== 'bidding' || table.currentIndex !== 0) return undefined;

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
      if (t && t.status === 'bidding' && t.currentIndex === 0) {
        const r = applyTimeout(t, 0);
        if (r.ok) commitRef.current(r.state, r.events);
      }
    }, 150);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, table?.status]);

  // ---------- 轮到用户：重置草稿 ----------
  useEffect(() => {
    if (!table || table.status !== 'bidding' || table.currentIndex !== 0) return;
    setDraft(normalizeDraft(table, { face: table.currentBid ? table.currentBid.face : 2, quantity: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, table?.status]);

  // ---------- 整局结束：结算筹码、回传聊天（只做一次） ----------
  const settleMatch = async (finalTable, endReason) => {
    const stakeValue = activeStakeRef.current;
    const userWon = endReason === 'finished' && finalTable.winnerIndex === 0;
    const durationMs = Date.now() - startedAtRef.current;

    if (userWon) {
      try {
        const balance = await adjustChipBalance(stakeValue * SEAT_COUNT);
        setChipBalance(balance);
      } catch (err) {
        console.warn('[LiarsDice] 底池入账失败', err);
      }
    }

    let result;
    try {
      result = await recordLiarsDiceMatch({
        table: finalTable,
        players,
        stake: stakeValue,
        endReason,
        durationMs,
      });
    } catch (err) {
      console.warn('[LiarsDice] 结果回传失败', err);
      result = buildMatchResult({
        table: finalTable,
        players,
        stake: stakeValue,
        endReason,
        durationMs,
        endedAt: new Date().toISOString(),
      });
    }

    setSessionResult(result);
    setSessionEnded(true);
  };

  // 打到只剩一人，或者用户的骰子先用光了（此时桌上还有别人，但对用户
  // 来说已经结束）。
  const matchOver =
    !!table && (table.status === 'ended' || (table.status === 'reveal' && table.seats[0].out));

  useEffect(() => {
    if (!matchOver || settledRef.current) return;
    settledRef.current = true;
    settleMatch(tableRef.current, tableRef.current.status === 'ended' ? 'finished' : 'busted');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchOver]);

  useEffect(
    () => () => {
      Object.values(bubbleTimersRef.current).forEach(clearTimeout);
      [noticeTimerRef, aiTimerRef].forEach((ref) => {
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

  const isMyTurn = !!table && table.status === 'bidding' && table.currentIndex === 0;
  const bidOptions = useMemo(() => (table && isMyTurn ? getBidOptions(table) : []), [table, isMyTurn]);
  const canChallenge = isMyTurn && !!table.currentBid;

  const setDraftFace = (face) => {
    const t = tableRef.current;
    if (!t) return;
    const option = getBidOptions(t).find((o) => o.face === face);
    if (!option || !option.available) return;
    setDraft({ face, quantity: option.minQuantity });
  };

  const stepDraftQuantity = (delta) => {
    setDraft((cur) => {
      const t = tableRef.current;
      if (!cur || !t) return cur;
      return normalizeDraft(t, { face: cur.face, quantity: cur.quantity + delta }) || cur;
    });
  };

  const doBid = () => {
    if (!isMyTurn || !draft) return;
    const r = apply((t) => placeBid(t, 0, draft.quantity, draft.face));
    if (r && !r.ok) say('这个叫点现在不能叫');
  };

  const doChallenge = () => {
    if (!canChallenge) return;
    apply((t) => challenge(t, 0));
  };

  // ---------- 两轮之间：下一轮 / 离桌 ----------
  const nextRound = () => {
    const t = tableRef.current;
    if (!t || t.status !== 'reveal' || settledRef.current) return;
    const r = startRound(t);
    if (!r.ok) return;
    setBubbles({});
    setNotice('');
    commit(r.state, r.events);
  };

  const leaveTable = async () => {
    const t = tableRef.current;
    if (!t || t.status !== 'reveal' || settledRef.current) return;
    settledRef.current = true;
    await settleMatch(t, 'left');
    setShowResult(true);
  };

  const openResult = () => {
    if (sessionEnded) setShowResult(true);
  };

  const momentLines = useMemo(() => {
    if (!sessionResult) return [];
    return buildSummaryLinesForUser({ result: sessionResult, players });
  }, [sessionResult, players]);

  return {
    table,
    seatCharacters,
    players,
    isMyTurn,
    canChallenge,
    remainingMs,
    bubbles,
    notice,
    draft,
    bidOptions,
    matchOver,
    sessionResult,
    sessionEnded,
    showResult,
    chipBalance,
    momentLines,
    nameOf,
    startSession,
    setDraftFace,
    stepDraftQuantity,
    doBid,
    doChallenge,
    nextRound,
    leaveTable,
    openResult,
  };
};