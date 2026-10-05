// src/apps/textgames/undercover/UndercoverGame.jsx
//
// "谁是卧底"对局界面，从文字游戏大厅内部切换进来（跟井字棋/UNO 同一个
// 接入方式，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 固定 5 人局，用户本人也是场上玩家之一（设计确认）：选 0-4 位真实
// 角色同场，不够 5 人时用临时 NPC 补位。词库来源可选"内置词库"或
// "AI 现场生成"。身份不公开发放给其他人看——用户只能看到自己的身份
// 和词，淘汰后也不公开被淘汰者的身份（设计确认）。
//
// Slice A：选人 -> 发身份/发词 -> 展示"你的词+阵营"。
// Slice B：发言 -> 投票 -> 淘汰/下一轮循环，直到游戏结束
// （卧底被投出 -> 平民胜；只剩2人卧底还在 -> 卧底胜）。AI/NPC 座位的
// 发言/投票按座位顺序自动依次生成（带一点"正在输入"停顿，不是瞬间
// 全部刷出来），轮到用户时暂停等待输入——跟 UNO/女巫的毒药里"AI 回合
// 自动结算、用户回合才停下来等"的既有节奏一致。
//
// 这一版（视觉改版）：对局画面改成"舞台"布局——
//   - 顶部：轮次/存活人数状态条 + 规则按钮；
//   - 舞台：5 个席位一排，当前行动者抬起+光圈，下方的发言气泡箭头
//     指向"刚发言的人"（气泡 = 刚说了什么，光圈 = 现在轮到谁）；
//   - 表情条：给刚发言的人飘表情，纯前端动效，不影响对局、不落库；
//   - 本轮发言记录、底部操作舱（发言输入 / 投票选择 / 淘汰结算）。
// 对局逻辑（effects、引擎调用、落库）与改版前完全一致，只改了渲染层
// 和少量只读派生状态。结算画面只是展示本局结果，不回写聊天。
//
// 发言规则（设计确认）：限字数（25字内），且不能直接说出自己的词本身
// ——AI 这边提示词要求+生成后二次校验（undercoverAiService.js），用户
// 这边是提交前的简单文本包含检查，命中就提示修改、不允许提交。
// 投票规则（设计确认）：AI/NPC 的投票理由展示给用户看；任何人都不能
// 投给自己（UI 层面直接不出现自己这个选项）。

import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  listCharactersForPicker,
  getRecentWordPairs,
  recordUndercoverMatch,
} from './undercoverService';
import { generateAiWordPair } from './undercoverAiWordService';
import { pickRandomWordPair } from './undercoverWordBank';
import { generateNpcSeats } from './undercoverNpc';
import {
  UNDERCOVER_PHASES,
  UNDERCOVER_RESULT,
  checkGameEnd,
  dealRoles,
  eliminateSeat,
  getAliveSeats,
  getSpeakingOrder,
  tallyVotes,
  withSeatIndexes,
} from './undercoverEngine';
import {
  getVoteCandidates,
  toPerspectiveSpeechLog,
} from './undercoverPerspective';
import { requestUndercoverSpeech, requestUndercoverVote } from './undercoverAiService';
import '../textGameShared.css';
import './undercover.css';

const MAX_REAL_PICKS = 4; // 5 人局，用户占 1 席，真实角色最多选 4 位
const SPEECH_MAX_LEN = 25;
const AI_TURN_DELAY_MS = 900; // AI 发言/投票之间的停顿，模拟"正在输入"
const REACTION_LIFETIME_MS = 1200; // 飘出来的表情存在多久

const REACTIONS = [
  { emoji: '🤨', label: '怀疑' },
  { emoji: '📝', label: '记小本' },
  { emoji: '👀', label: '盯' },
  { emoji: '👏', label: '认可' },
];
const SEAT_TAP_EMOJI = '👀'; // 直接点座位时飘的表情

const RULES_TEXT =
  '发言时不能说出自己的词。听谁的描述格格不入，就把票投给他。卧底被投出局，平民获胜；场上只剩 2 人且卧底还在，卧底获胜。';

const BackIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const SendIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const AvatarBubble = ({ character, className }) => {
  const name = character?.name || '';
  const initial = name.trim().charAt(0) || '?';
  if (character?.avatar) {
    return <img src={character.avatar} alt={name} className={className} />;
  }
  return (
    <div className={className}>
      <span>{initial}</span>
    </div>
  );
};

const WORD_SOURCE = {
  BUILTIN: 'builtin',
  AI: 'ai',
};

const findSeat = (players, seatIndex) => players.find((p) => p.seatIndex === seatIndex);
const roleLabel = (role) => (role === 'undercover' ? '卧底' : '平民');
const displayName = (seat) => (seat?.isUser ? '你' : seat?.name || '');

// ---------- 发词+身份展示 ----------
const RevealScreen = ({ players, onContinue, onExitToHall }) => {
  const userSeat = players.find((p) => p.isUser);
  const isUndercover = userSeat?.role === 'undercover';

  return (
    <div className="tgh-shared-screen uc-reveal-screen undercover-scope">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className={`uc-reveal-card ${isUndercover ? 'uc-reveal-card--undercover' : ''}`}>
        <span className={`uc-role-badge ${isUndercover ? 'uc-role-badge--undercover' : ''}`}>
          你是{roleLabel(userSeat?.role)}
        </span>
        <h2 className="uc-reveal-title">你的秘密手牌</h2>
        <p className="uc-reveal-meta">全场共 {players.length} 人，其中 1 位是卧底。</p>

        <div className="uc-word-box">
          <p className="uc-word-label">你拿到的词</p>
          <p className="uc-word">{userSeat?.word}</p>
        </div>

        <p className="uc-reveal-hint">
          {isUndercover
            ? '别人拿到的词跟你不一样——描述的时候留意别暴露细节。'
            : '场上有一位卧底拿到了不一样的词，听发言找破绽。'}
        </p>

        <div className="uc-reveal-seats">
          {players.map((p) => (
            <div key={p.seatIndex} className="uc-reveal-seat-chip">
              <AvatarBubble character={p} className="uc-reveal-seat-avatar" />
              <span className="uc-reveal-seat-name">{displayName(p)}</span>
            </div>
          ))}
        </div>

        <button type="button" className="uc-btn uc-btn--primary uc-btn--block" onClick={onContinue}>
          开始发言
        </button>
      </div>
    </div>
  );
};

// ---------- 单个席位 ----------
const Seat = ({ player, active, voted, voteCount, reactions, onTap }) => {
  const label = displayName(player);
  const cls = [
    'uc-seat',
    player.isUser && 'uc-seat--user',
    active && 'uc-seat--active',
    !player.alive && 'uc-seat--out',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      aria-label={`${label}，点击飘一个表情`}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap();
        }
      }}
    >
      <div className="uc-seat-figure">
        <AvatarBubble character={player} className="uc-seat-avatar" />
        {active && <span className="uc-seat-halo" aria-hidden="true" />}
        {voteCount > 0 && <span className="uc-seat-votes">{voteCount}</span>}
        {voted && (
          <span className="uc-seat-voted" aria-label="已投票">
            ✓
          </span>
        )}
        {reactions.map((r) => (
          <span key={r.id} className="uc-float" aria-hidden="true">
            {r.emoji}
          </span>
        ))}
      </div>
      <span className="uc-seat-name">{label}</span>
      {player.isUser && (
        <span
          className={`uc-seat-role ${player.role === 'undercover' ? 'uc-seat-role--undercover' : ''}`}
        >
          {roleLabel(player.role)}
        </span>
      )}
    </div>
  );
};

// ---------- 发言+投票对局画面 ----------
const MatchScreen = ({ players, setPlayers, onExitToHall, onEnded }) => {
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState(UNDERCOVER_PHASES.DESCRIBING);
  const [speakingOrder, setSpeakingOrder] = useState(() => getSpeakingOrder(players));
  const [turnPointer, setTurnPointer] = useState(0);
  const [speechLog, setSpeechLog] = useState([]); // 跨轮次累积 [{ round, seatIndex, text }]
  const [userDraft, setUserDraft] = useState('');
  const [draftError, setDraftError] = useState('');

  const [voteOrder, setVoteOrder] = useState([]);
  const [votePointer, setVotePointer] = useState(0);
  const [votes, setVotes] = useState({}); // { voterSeatIndex: targetSeatIndex }
  const [voteReasons, setVoteReasons] = useState({}); // { voterSeatIndex: reason }

  const [eliminatedBanner, setEliminatedBanner] = useState(null); // { seatIndex, tally }
  const [busy, setBusy] = useState(false);

  // 纯展示用状态：不参与对局逻辑
  const [pendingTarget, setPendingTarget] = useState(null); // 用户投票时"已选中、待确认"的座位
  const [reactions, setReactions] = useState([]); // [{ id, seatIndex, emoji }]
  const [showRules, setShowRules] = useState(false);

  const handledKeyRef = useRef(null);
  const matchStartRef = useRef(Date.now());
  const reactionIdRef = useRef(0);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  const userSeat = players.find((p) => p.isUser);
  const userAlive = !!userSeat?.alive;
  const aliveCount = getAliveSeats(players).length;

  // ---------- 发言阶段：AI/NPC 轮到自己时自动生成，轮到用户就停下来等输入 ----------
  useEffect(() => {
    if (phase !== UNDERCOVER_PHASES.DESCRIBING) return;
    if (turnPointer >= speakingOrder.length) {
      // 这一轮发言全部结束，进入投票阶段。
      const order = getSpeakingOrder(players);
      setVoteOrder(order);
      setVotePointer(0);
      setVotes({});
      setVoteReasons({});
      setPhase(UNDERCOVER_PHASES.VOTING);
      return;
    }

    const seatIndex = speakingOrder[turnPointer];
    const seat = findSeat(players, seatIndex);
    if (!seat || seat.isUser) return; // 用户回合，等 UI 提交

    // 用 handledKeyRef 当"这一回合有没有发起过"的唯一开关，不额外用
    // cancelled 标志位挡 setState——React.StrictMode 在开发环境会把这个
    // effect 挂载/卸载/再挂载一次，如果用 cancelled 挡住第一次真正发起
    // 的那次请求的结果，第二次又会被这里的 key 判断挡住不再发起，这一
    // 回合就会卡死。跟 pokeService/divinationAiService 一样，直接认
    // "请求发出去就让它自然落地"，不做取消。
    const key = `describe-${round}-${seatIndex}`;
    if (handledKeyRef.current === key) return;
    handledKeyRef.current = key;

    setBusy(true);
    (async () => {
      // 只取这一轮（round 一致）的发言当上下文——提示词里说的是"本轮"，
      // 跨轮次的发言不该混进来当同一轮的参考。
      const thisRoundLog = speechLog.filter((entry) => entry.round === round);
      const speechHistory = toPerspectiveSpeechLog(thisRoundLog, players, seatIndex);
      await new Promise((r) => setTimeout(r, AI_TURN_DELAY_MS));
      const text = await requestUndercoverSpeech({ seat, speechHistory });
      setSpeechLog((log) => [...log, { round, seatIndex, text }]);
      setTurnPointer((p) => p + 1);
      setBusy(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turnPointer, speakingOrder, round]);

  // ---------- 投票阶段：AI/NPC 自动投票，用户点按钮投票 ----------
  useEffect(() => {
    if (phase !== UNDERCOVER_PHASES.VOTING) return;
    if (votePointer >= voteOrder.length) return; // 等所有票收完统一结算（见下面的 effect）

    const seatIndex = voteOrder[votePointer];
    const seat = findSeat(players, seatIndex);
    if (!seat || seat.isUser) return; // 用户回合，等 UI 点击

    // 同上一个 effect 的理由：只用 key 守卫，不用 cancelled 挡 setState。
    const key = `vote-${round}-${seatIndex}`;
    if (handledKeyRef.current === key) return;
    handledKeyRef.current = key;

    setBusy(true);
    (async () => {
      const candidates = getVoteCandidates(players, seatIndex);
      // 同上：投票只参考这一轮的发言，不把之前轮次的发言也当依据。
      const thisRoundLog = speechLog.filter((entry) => entry.round === round);
      const speechHistory = toPerspectiveSpeechLog(thisRoundLog, players, seatIndex);
      await new Promise((r) => setTimeout(r, AI_TURN_DELAY_MS));
      const { target, reason } = await requestUndercoverVote({ seat, candidates, speechHistory });
      if (target) {
        setVotes((v) => ({ ...v, [seatIndex]: target.seatIndex }));
        setVoteReasons((r) => ({ ...r, [seatIndex]: reason }));
      }
      setVotePointer((p) => p + 1);
      setBusy(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, votePointer, voteOrder, round]);

  // ---------- 投票收完，统计+淘汰+判定胜负 ----------
  useEffect(() => {
    if (phase !== UNDERCOVER_PHASES.VOTING) return;
    if (voteOrder.length === 0) return;
    if (votePointer < voteOrder.length) return;

    const key = `tally-${round}`;
    if (handledKeyRef.current === key) return;
    handledKeyRef.current = key;

    const { eliminatedSeatIndex, tally } = tallyVotes(votes, players);
    const updatedPlayers = eliminateSeat(players, eliminatedSeatIndex);
    setPlayers(updatedPlayers);
    setEliminatedBanner({ seatIndex: eliminatedSeatIndex, tally });

    const result = checkGameEnd(updatedPlayers);
    if (result) {
      setPhase(UNDERCOVER_PHASES.ENDED);
      onEnded({
        result,
        players: updatedPlayers,
        rounds: round,
        durationMs: Date.now() - matchStartRef.current,
      });
    } else {
      setPhase(UNDERCOVER_PHASES.ELIMINATED);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, votePointer, voteOrder, votes]);

  const handleUserSpeechSubmit = () => {
    const text = userDraft.trim();
    if (!text) {
      setDraftError('说点什么吧。');
      return;
    }
    if (text.length > SPEECH_MAX_LEN) {
      setDraftError(`不超过 ${SPEECH_MAX_LEN} 个字。`);
      return;
    }
    if (userSeat?.word && text.includes(userSeat.word)) {
      setDraftError('不能直接说出你拿到的词本身。');
      return;
    }
    setDraftError('');
    setSpeechLog((log) => [...log, { round, seatIndex: userSeat.seatIndex, text }]);
    setUserDraft('');
    setTurnPointer((p) => p + 1);
  };

  const handleUserVote = (targetSeatIndex) => {
    setVotes((v) => ({ ...v, [userSeat.seatIndex]: targetSeatIndex }));
    setVoteReasons((r) => ({ ...r, [userSeat.seatIndex]: '' }));
    setPendingTarget(null);
    setVotePointer((p) => p + 1);
  };

  const handleNextRound = () => {
    const order = getSpeakingOrder(players);
    setSpeakingOrder(order);
    setTurnPointer(0);
    setEliminatedBanner(null);
    setPendingTarget(null);
    setRound((r) => r + 1);
    setPhase(UNDERCOVER_PHASES.DESCRIBING);
  };

  const fireReaction = (seatIndex, emoji) => {
    if (seatIndex == null) return;
    reactionIdRef.current += 1;
    const id = reactionIdRef.current;
    setReactions((list) => [...list, { id, seatIndex, emoji }]);
    setTimeout(() => {
      setReactions((list) => list.filter((r) => r.id !== id));
    }, REACTION_LIFETIME_MS);
  };

  // ---------- 派生状态（只读） ----------
  const currentSpeaker =
    phase === UNDERCOVER_PHASES.DESCRIBING && turnPointer < speakingOrder.length
      ? findSeat(players, speakingOrder[turnPointer])
      : null;
  const isUserSpeechTurn = !!currentSpeaker?.isUser;

  const currentVoter =
    phase === UNDERCOVER_PHASES.VOTING && votePointer < voteOrder.length
      ? findSeat(players, voteOrder[votePointer])
      : null;
  const isUserVoteTurn = !!currentVoter?.isUser;
  const voteCandidatesForUser = isUserVoteTurn ? getVoteCandidates(players, userSeat.seatIndex) : [];

  const activeSeat = currentSpeaker || currentVoter;

  const roundLog = useMemo(() => speechLog.filter((entry) => entry.round === round), [speechLog, round]);
  const lastEntry = roundLog.length > 0 ? roundLog[roundLog.length - 1] : null;

  const voteCounts = useMemo(() => {
    const counts = {};
    Object.values(votes).forEach((target) => {
      counts[target] = (counts[target] || 0) + 1;
    });
    return counts;
  }, [votes]);

  const eliminatedSeat = eliminatedBanner ? findSeat(players, eliminatedBanner.seatIndex) : null;
  const roundVoteRows = useMemo(() => {
    if (!eliminatedBanner) return [];
    return Object.entries(votes).map(([voterSeatIndex, targetSeatIndex]) => ({
      key: voterSeatIndex,
      voterName: displayName(findSeat(players, Number(voterSeatIndex))),
      targetName: displayName(findSeat(players, targetSeatIndex)),
      reason: voteReasons[voterSeatIndex] || '',
    }));
  }, [eliminatedBanner, voteReasons, votes, players]);

  // 气泡 = "刚说了什么"。箭头指向刚发言的人所在的列。
  let spot = null;
  if (phase === UNDERCOVER_PHASES.DESCRIBING) {
    if (lastEntry) {
      const seat = findSeat(players, lastEntry.seatIndex);
      const idx = players.findIndex((p) => p.seatIndex === lastEntry.seatIndex);
      spot = {
        kind: 'speech',
        key: `speech-${round}-${roundLog.length}`,
        seat,
        text: lastEntry.text,
        arrow: `${((idx + 0.5) / players.length) * 100}%`,
        order: `${roundLog.length}/${speakingOrder.length}`,
      };
    } else {
      spot = {
        kind: 'note',
        key: `note-start-${round}`,
        text: `第 ${round} 轮开始，按座位顺序依次描述自己的词。`,
      };
    }
  } else if (phase === UNDERCOVER_PHASES.VOTING) {
    spot = {
      kind: 'note',
      key: `note-vote-${round}`,
      text: `发言结束，开始投票（已投 ${Math.min(votePointer, voteOrder.length)}/${voteOrder.length}）`,
    };
  }

  // "正在……"提示：只在 AI/NPC 行动时出现
  let typingLabel = '';
  if (busy && activeSeat && !activeSeat.isUser) {
    typingLabel =
      phase === UNDERCOVER_PHASES.DESCRIBING
        ? `${activeSeat.name} 正在发言`
        : `${activeSeat.name} 正在投票`;
  }

  // 表情只飘给"刚发言的人"（不给自己）
  const reactionTarget = (() => {
    if (!lastEntry) return null;
    const seat = findSeat(players, lastEntry.seatIndex);
    return seat && !seat.isUser ? seat : null;
  })();

  // 发言记录始终滚到最新一条；轮到用户发言时自动聚焦输入框
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [roundLog.length]);

  useEffect(() => {
    if (isUserSpeechTurn && inputRef.current) inputRef.current.focus();
  }, [isUserSpeechTurn]);

  const pendingCandidate = voteCandidatesForUser.find((c) => c.seatIndex === pendingTarget);
  const lastSpeechOf = (seatIndex) => {
    for (let i = roundLog.length - 1; i >= 0; i -= 1) {
      if (roundLog[i].seatIndex === seatIndex) return roundLog[i].text;
    }
    return '';
  };

  return (
    <div className="tgh-shared-screen uc-match-screen undercover-scope">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      {/* 顶部状态条 */}
      <div className="uc-topbar">
        <div className="uc-status-pill">
          <span className="uc-live-dot" aria-hidden="true" />
          <span>第 {round} 轮</span>
          <span className="uc-status-sep" aria-hidden="true" />
          <span>存活 {aliveCount} 人</span>
        </div>
        <button
          type="button"
          className="uc-rules-btn"
          aria-label="对局规则"
          aria-expanded={showRules}
          onClick={() => setShowRules((s) => !s)}
        >
          ?
        </button>
      </div>
      {showRules && (
        <p className="uc-rules-pop" role="note">
          {RULES_TEXT}
        </p>
      )}

      {/* 舞台：席位 + 气泡 */}
      <section className="uc-stage">
        <div className="uc-seats" style={{ '--uc-seat-count': players.length }}>
          {players.map((p) => (
            <Seat
              key={p.seatIndex}
              player={p}
              active={activeSeat?.seatIndex === p.seatIndex}
              voted={phase === UNDERCOVER_PHASES.VOTING && votes[p.seatIndex] !== undefined}
              voteCount={phase === UNDERCOVER_PHASES.ELIMINATED ? voteCounts[p.seatIndex] || 0 : 0}
              reactions={reactions.filter((r) => r.seatIndex === p.seatIndex)}
              onTap={() => fireReaction(p.seatIndex, SEAT_TAP_EMOJI)}
            />
          ))}
        </div>

        {spot && (
          <div className="uc-spot">
            {spot.kind === 'speech' ? (
              <div
                key={spot.key}
                className="uc-bubble"
                style={{ '--uc-arrow': spot.arrow }}
                role="status"
                aria-live="polite"
              >
                <div className="uc-bubble-head">
                  <span className="uc-bubble-name">{displayName(spot.seat)}</span>
                  <span className="uc-bubble-order">发言 {spot.order}</span>
                </div>
                <p className="uc-bubble-text">“{spot.text}”</p>
              </div>
            ) : (
              <div key={spot.key} className="uc-bubble uc-bubble--note">
                <p className="uc-bubble-text">{spot.text}</p>
              </div>
            )}

            <div className="uc-typing" aria-live="polite">
              {typingLabel && (
                <>
                  <span className="uc-typing-dot" />
                  <span className="uc-typing-dot" />
                  <span className="uc-typing-dot" />
                  <span>{typingLabel}</span>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 表情条（仅发言阶段） */}
      {phase === UNDERCOVER_PHASES.DESCRIBING && (
        <div className="uc-reactions">
          <span className="uc-reactions-label">
            {reactionTarget ? `向${reactionTarget.name}表态` : '表态'}
          </span>
          <div className="uc-reactions-group">
            {REACTIONS.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className="uc-reaction-btn"
                disabled={!reactionTarget}
                onClick={() => fireReaction(reactionTarget?.seatIndex, r.emoji)}
              >
                {r.emoji} {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 本轮发言记录 */}
      {phase !== UNDERCOVER_PHASES.ELIMINATED && (
        <div className="uc-log">
          <div className="uc-log-head">
            <span>本轮发言记录</span>
            <span>
              {roundLog.length}/{speakingOrder.length}
            </span>
          </div>
          <div className="uc-log-list" ref={logRef}>
            {roundLog.length === 0 && <p className="uc-log-empty">还没有人发言。</p>}
            {roundLog.map((entry, i) => {
              const seat = findSeat(players, entry.seatIndex);
              return (
                <div key={i} className="uc-log-row">
                  <span className={`uc-log-name ${seat?.isUser ? 'uc-log-name--user' : ''}`}>
                    {displayName(seat)}:
                  </span>
                  <span className="uc-log-text">{entry.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 底部操作舱：发言 */}
      {phase === UNDERCOVER_PHASES.DESCRIBING && userAlive && (
        <footer className="uc-dock">
          <div className="uc-dock-head">
            <span className={`uc-dock-title ${isUserSpeechTurn ? 'uc-dock-title--turn' : ''}`}>
              {isUserSpeechTurn ? '轮到你发言' : '还没轮到你'}
              <span className="uc-dock-word">你的词：{userSeat?.word}</span>
            </span>
            <span className="uc-counter">
              {userDraft.length}/{SPEECH_MAX_LEN}
            </span>
          </div>
          <div className="uc-input-row">
            <input
              ref={inputRef}
              type="text"
              className="uc-input"
              value={userDraft}
              maxLength={SPEECH_MAX_LEN}
              disabled={!isUserSpeechTurn}
              onChange={(e) => {
                setUserDraft(e.target.value);
                setDraftError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isUserSpeechTurn) handleUserSpeechSubmit();
              }}
              placeholder={isUserSpeechTurn ? '描述特征，别直接说出词本身……' : '等其他人说完……'}
            />
            <button
              type="button"
              className="uc-send"
              aria-label="发送发言"
              disabled={!isUserSpeechTurn}
              onClick={handleUserSpeechSubmit}
            >
              <SendIcon />
            </button>
          </div>
          {draftError && (
            <p className="uc-toast" role="alert" key={draftError}>
              {draftError}
            </p>
          )}
        </footer>
      )}

      {/* 底部操作舱：投票 */}
      {phase === UNDERCOVER_PHASES.VOTING && userAlive && (
        <footer className="uc-dock">
          <div className="uc-dock-head">
            <span className={`uc-dock-title ${isUserVoteTurn ? 'uc-dock-title--turn' : ''}`}>
              {isUserVoteTurn ? '轮到你投票，选出最可疑的一位' : '等其他人投票'}
            </span>
          </div>

          {isUserVoteTurn ? (
            <>
              <div className="uc-vote-grid">
                {voteCandidatesForUser.map((c) => {
                  const seat = findSeat(players, c.seatIndex);
                  const selected = pendingTarget === c.seatIndex;
                  const quote = lastSpeechOf(c.seatIndex);
                  return (
                    <button
                      key={c.seatIndex}
                      type="button"
                      aria-pressed={selected}
                      className={`uc-vote-card ${selected ? 'uc-vote-card--selected' : ''}`}
                      onClick={() => setPendingTarget(c.seatIndex)}
                    >
                      <AvatarBubble character={seat} className="uc-vote-card-avatar" />
                      <span className="uc-vote-card-name">{c.label}</span>
                      <span className="uc-vote-card-quote">{quote ? `“${quote}”` : ' '}</span>
                      {selected && <span className="uc-vote-card-tag">已选</span>}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="uc-btn uc-btn--primary uc-btn--block uc-vote-confirm"
                disabled={pendingTarget == null}
                onClick={() => pendingTarget != null && handleUserVote(pendingTarget)}
              >
                {pendingCandidate ? `投给【${pendingCandidate.label}】` : '先选一位怀疑对象'}
              </button>
            </>
          ) : (
            <p className="uc-dock-wait">AI 和 NPC 依次投票，轮到你时这里会出现候选人。</p>
          )}
        </footer>
      )}

      {/* 用户已出局：旁观 */}
      {(phase === UNDERCOVER_PHASES.DESCRIBING || phase === UNDERCOVER_PHASES.VOTING) &&
        !userAlive && (
          <footer className="uc-dock uc-dock--spectate">
            <p className="uc-dock-wait">你已出局，继续旁观剩下的对局。</p>
          </footer>
        )}

      {/* 淘汰结算 */}
      {phase === UNDERCOVER_PHASES.ELIMINATED && eliminatedSeat && (
        <div className="uc-out">
          <AvatarBubble character={eliminatedSeat} className="uc-out-avatar" />
          <h3>{displayName(eliminatedSeat)} 被投票出局</h3>
          <p>
            获得 {voteCounts[eliminatedSeat.seatIndex] || 0} 票指认，身份不公开，继续观察剩下的人吧。
          </p>

          {roundVoteRows.length > 0 && (
            <div className="uc-out-tally">
              {roundVoteRows.map((row) => (
                <p key={row.key} className="uc-out-tally-row">
                  <strong>{row.voterName}</strong> 投给 <strong>{row.targetName}</strong>
                  {row.reason ? `：${row.reason}` : ''}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            className="uc-btn uc-btn--primary uc-btn--block"
            onClick={handleNextRound}
          >
            继续下一轮
          </button>
        </div>
      )}
    </div>
  );
};

// ---------- 结算画面（只展示结果，落库在 UndercoverGame 的 onEnded 里做） ----------
const ResultScreen = ({ players, result, onExitToHall, onPlayAgain }) => {
  const isCivilianWin = result === UNDERCOVER_RESULT.CIVILIAN_WIN;
  const userSeat = players.find((p) => p.isUser);
  const userIsUndercover = userSeat?.role === 'undercover';
  const userWon = isCivilianWin !== userIsUndercover;

  return (
    <div className="tgh-shared-screen uc-result-screen undercover-scope">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div
        className={`uc-result-card ${
          isCivilianWin ? 'uc-result-card--civilian' : 'uc-result-card--undercover'
        }`}
      >
        <h3>{isCivilianWin ? '平民胜利' : '卧底胜利'}</h3>
        <p>{isCivilianWin ? '卧底被成功投出局了。' : '卧底撑到了最后两人。'}</p>
        <p className="uc-result-you">
          你是{roleLabel(userSeat?.role)}，这局你{userWon ? '赢了' : '输了'}。
        </p>
      </div>

      <div className="uc-result-list">
        {players.map((p) => (
          <div key={p.seatIndex} className="uc-result-row">
            <AvatarBubble character={p} className="uc-result-avatar" />
            <div className="uc-result-who">
              <span className="uc-result-name">{displayName(p)}</span>
              {!p.alive && <span className="uc-result-out">出局</span>}
            </div>
            <span className="uc-result-word">{p.word}</span>
            <span
              className={`uc-result-role ${p.role === 'undercover' ? 'uc-result-role--undercover' : ''}`}
            >
              {roleLabel(p.role)}
            </span>
          </div>
        ))}
      </div>

      <div className="uc-actions">
        <button type="button" className="uc-btn uc-btn--primary uc-btn--block" onClick={onPlayAgain}>
          再来一局
        </button>
        <button type="button" className="uc-btn uc-btn--block" onClick={onExitToHall}>
          返回大厅
        </button>
      </div>
    </div>
  );
};

// ---------- 选人 ----------
const UndercoverGame = ({ onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickedIds, setPickedIds] = useState([]);
  const [wordSource, setWordSource] = useState(WORD_SOURCE.BUILTIN);
  const [preparing, setPreparing] = useState(false);
  const [players, setPlayers] = useState(null); // 发完身份的 5 人座位数组，null = 还在选人
  const [screen, setScreen] = useState('reveal'); // 'reveal' | 'match' | 'ended'
  const [endedResult, setEndedResult] = useState(null);
  const recordedRef = useRef(false); // 保证一局只落库/回写一次，跟 useUnoMatch.js 的 recordedRef 同一个理由

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCharactersForPicker();
        if (!cancelled) setCharacters(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePick = (id) => {
    setPickedIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_REAL_PICKS) return cur;
      return [...cur, id];
    });
  };

  const pickedCharacters = useMemo(
    () => pickedIds.map((id) => characters.find((c) => c.id === id)).filter(Boolean),
    [pickedIds, characters]
  );

  const handleStart = async () => {
    setPreparing(true);
    try {
      const recentPairs = await getRecentWordPairs();
      const wordPair =
        wordSource === WORD_SOURCE.AI
          ? await generateAiWordPair(recentPairs)
          : pickRandomWordPair(recentPairs);

      const realSeats = pickedCharacters.map((c) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        bio: c.bio,
        isNpc: false,
        isUser: false,
      }));
      const npcCount = MAX_REAL_PICKS - realSeats.length;
      const npcSeats = generateNpcSeats(
        npcCount,
        pickedCharacters.map((c) => c.name)
      );
      const userSeat = { id: 'user', name: '你', avatar: null, bio: '', isNpc: false, isUser: true };

      // 用户座位插在随机位置，不是永远第一个，避免"第一个发言的总是用户"
      const others = [...realSeats, ...npcSeats];
      const userPosition = Math.floor(Math.random() * (others.length + 1));
      others.splice(userPosition, 0, userSeat);

      const seatsWithIndex = withSeatIndexes(others);
      const dealt = dealRoles(seatsWithIndex, wordPair);
      setPlayers(dealt);
      setScreen('reveal');
      setEndedResult(null);
    } catch (error) {
      console.warn('[UndercoverGame] 开局准备失败。', error);
    } finally {
      setPreparing(false);
    }
  };

  if (players && screen === 'reveal') {
    return (
      <RevealScreen
        players={players}
        onContinue={() => setScreen('match')}
        onExitToHall={onExitToHall}
      />
    );
  }

  if (players && screen === 'match') {
    return (
      <MatchScreen
        players={players}
        setPlayers={setPlayers}
        onExitToHall={onExitToHall}
        onEnded={({ result, players: finalPlayers, rounds, durationMs }) => {
          setPlayers(finalPlayers);
          setEndedResult(result);
          setScreen('ended');

          // 只落库/回写一次，跟 useUnoMatch.js 的 recordedRef 同一个
          // 理由——这个回调理论上只会被 MatchScreen 的结算 effect 调用
          // 一次，但多一道保险不会错。
          if (!recordedRef.current) {
            recordedRef.current = true;
            recordUndercoverMatch({ players: finalPlayers, result, rounds, durationMs }).catch(
              (err) => console.warn('[UndercoverGame] 结算落库/回写失败。', err)
            );
          }
        }}
      />
    );
  }

  if (players && screen === 'ended') {
    return (
      <ResultScreen
        players={players}
        result={endedResult}
        onExitToHall={onExitToHall}
        onPlayAgain={() => {
          setPlayers(null);
          setPickedIds([]);
          recordedRef.current = false; // 下一局要能重新落库/回写
        }}
      />
    );
  }

  return (
    <div className="tgh-shared-screen undercover-scope">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="tgh-shared-picker-head">
        <h2>谁是卧底</h2>
        <p>One word, two meanings</p>
      </div>

      {loading && <p className="tgh-shared-empty">正在加载角色列表……</p>}

      {!loading && (
        <>
          <p className="uc-picker-sub">
            固定 5 人局，你自己是其中一位玩家。最多选 {MAX_REAL_PICKS} 位角色同场，人数不够会用临时 NPC 补位。
          </p>

          {characters.length === 0 && (
            <p className="tgh-shared-empty">
              还没有可选的角色，全部用临时 NPC 凑一局，或者先去创建几个角色。
            </p>
          )}

          {characters.length > 0 && (
            <div className="tgh-shared-picker-grid">
              {characters.map((character) => {
                const picked = pickedIds.includes(character.id);
                return (
                  <button
                    key={character.id}
                    type="button"
                    className={`tgh-shared-picker-item ${picked ? 'uc-picked' : ''}`}
                    onClick={() => togglePick(character.id)}
                  >
                    <AvatarBubble character={character} className="tgh-shared-picker-avatar" />
                    <span className="tgh-shared-picker-name">{character.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="uc-picker-hint">
            已选 {pickedIds.length} / {MAX_REAL_PICKS} 位角色，
            {MAX_REAL_PICKS - pickedIds.length > 0
              ? `另外 ${MAX_REAL_PICKS - pickedIds.length} 位用 NPC 补位。`
              : '刚好凑满。'}
          </p>

          <div className="uc-word-source-row">
            <span className="uc-word-source-label">词语来源</span>
            <div className="uc-word-source-options">
              <button
                type="button"
                className={`uc-word-source-btn ${wordSource === WORD_SOURCE.BUILTIN ? 'uc-word-source-btn--active' : ''}`}
                onClick={() => setWordSource(WORD_SOURCE.BUILTIN)}
              >
                内置词库
              </button>
              <button
                type="button"
                className={`uc-word-source-btn ${wordSource === WORD_SOURCE.AI ? 'uc-word-source-btn--active' : ''}`}
                onClick={() => setWordSource(WORD_SOURCE.AI)}
              >
                AI 现场生成
              </button>
            </div>
          </div>

          <div className="tgh-shared-actions">
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              disabled={preparing}
              onClick={handleStart}
            >
              {preparing ? '正在发牌……' : '开局'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UndercoverGame;