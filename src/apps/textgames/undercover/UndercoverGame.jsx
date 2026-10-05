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
// Slice B（这一版新增）：发言 -> 投票 -> 淘汰/下一轮循环，直到游戏结束
// （卧底被投出 -> 平民胜；只剩2人卧底还在 -> 卧底胜）。AI/NPC 座位的
// 发言/投票按座位顺序自动依次生成（带一点"正在输入"停顿，不是瞬间
// 全部刷出来），轮到用户时暂停等待输入——跟 UNO/女巫的毒药里"AI 回合
// 自动结算、用户回合才停下来等"的既有节奏一致。结算画面只是展示本局
// 结果，不回写聊天/不落库——那是 Slice C 的范围。
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

// ---------- 发词+身份展示 ----------
const RevealScreen = ({ players, onContinue, onExitToHall }) => {
  const userSeat = players.find((p) => p.isUser);
  const isUndercover = userSeat?.role === 'undercover';

  return (
    <div className="tgh-shared-screen uc-reveal-screen undercover-scope">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="uc-reveal-head">
        <p className="uc-reveal-eyebrow">你的身份</p>
        <h2 className={`uc-reveal-role ${isUndercover ? 'uc-reveal-role--undercover' : ''}`}>
          {isUndercover ? '卧底' : '平民'}
        </h2>
      </div>

      <div className="uc-reveal-word-card">
        <p className="uc-reveal-word-label">你拿到的词</p>
        <p className="uc-reveal-word">{userSeat?.word}</p>
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
            <span className="uc-reveal-seat-name">{p.isUser ? '你' : p.name}</span>
          </div>
        ))}
      </div>

      <div className="tgh-shared-actions">
        <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={onContinue}>
          开始发言
        </button>
      </div>
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

  const handledKeyRef = useRef(null);
  const matchStartRef = useRef(Date.now());

  const userSeat = players.find((p) => p.isUser);
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
    setVotePointer((p) => p + 1);
  };

  const handleNextRound = () => {
    const order = getSpeakingOrder(players);
    setSpeakingOrder(order);
    setTurnPointer(0);
    setEliminatedBanner(null);
    setRound((r) => r + 1);
    setPhase(UNDERCOVER_PHASES.DESCRIBING);
  };

  const currentSpeaker =
    phase === UNDERCOVER_PHASES.DESCRIBING && turnPointer < speakingOrder.length
      ? findSeat(players, speakingOrder[turnPointer])
      : null;
  const isUserSpeechTurn = currentSpeaker?.isUser;

  const currentVoter =
    phase === UNDERCOVER_PHASES.VOTING && votePointer < voteOrder.length
      ? findSeat(players, voteOrder[votePointer])
      : null;
  const isUserVoteTurn = currentVoter?.isUser;
  const voteCandidatesForUser = isUserVoteTurn ? getVoteCandidates(players, userSeat.seatIndex) : [];

  const eliminatedSeat = eliminatedBanner ? findSeat(players, eliminatedBanner.seatIndex) : null;
  const roundVoteReasonRows = useMemo(() => {
    if (!eliminatedBanner) return [];
    return Object.entries(voteReasons)
      .filter(([, reason]) => !!reason)
      .map(([voterSeatIndex, reason]) => {
        const voter = findSeat(players, Number(voterSeatIndex));
        const targetSeatIndex = votes[voterSeatIndex];
        const target = findSeat(players, targetSeatIndex);
        return {
          key: voterSeatIndex,
          voterName: voter?.isUser ? '你' : voter?.name,
          targetName: target?.isUser ? '你' : target?.name,
          reason,
        };
      });
  }, [eliminatedBanner, voteReasons, votes, players]);

  return (
    <div className="tgh-shared-screen uc-match-screen undercover-scope">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="uc-match-head">
        <h2>第 {round} 轮</h2>
        <p>存活 {aliveCount} 人</p>
      </div>

      <div className="uc-seat-row">
        {players.map((p) => (
          <div
            key={p.seatIndex}
            className={`uc-seat-chip ${!p.alive ? 'uc-seat-chip--out' : ''} ${
              currentSpeaker?.seatIndex === p.seatIndex || currentVoter?.seatIndex === p.seatIndex
                ? 'uc-seat-chip--active'
                : ''
            }`}
          >
            <AvatarBubble character={p} className="uc-seat-avatar" />
            <span className="uc-seat-name">{p.isUser ? '你' : p.name}</span>
          </div>
        ))}
      </div>

      <div className="uc-speech-log">
        {speechLog
          .filter((entry) => entry.round === round)
          .map((entry, i) => {
            const seat = findSeat(players, entry.seatIndex);
            return (
              <div key={i} className="uc-speech-row">
                <span className="uc-speech-name">{seat?.isUser ? '你' : seat?.name}</span>
                <span className="uc-speech-text">{entry.text}</span>
              </div>
            );
          })}
      </div>

      {phase === UNDERCOVER_PHASES.DESCRIBING && !isUserSpeechTurn && (
        <p className="uc-turn-hint">{busy ? `${currentSpeaker?.name || ''} 正在发言……` : ''}</p>
      )}

      {phase === UNDERCOVER_PHASES.DESCRIBING && isUserSpeechTurn && (
        <div className="tgh-shared-field uc-speech-field">
          <label>轮到你发言了——描述一下你拿到的词</label>
          <div className="tgh-shared-input-row">
            <input
              type="text"
              className="tgh-shared-input"
              value={userDraft}
              maxLength={SPEECH_MAX_LEN}
              onChange={(e) => {
                setUserDraft(e.target.value);
                setDraftError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUserSpeechSubmit();
              }}
              placeholder="别直接说出词本身……"
            />
            <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={handleUserSpeechSubmit}>
              发送
            </button>
          </div>
          {draftError && <p className="uc-field-error">{draftError}</p>}
        </div>
      )}

      {phase === UNDERCOVER_PHASES.VOTING && !isUserVoteTurn && (
        <p className="uc-turn-hint">{busy ? `${currentVoter?.name || ''} 正在投票……` : ''}</p>
      )}

      {phase === UNDERCOVER_PHASES.VOTING && isUserVoteTurn && (
        <div className="uc-vote-field">
          <p className="uc-vote-prompt">轮到你投票了——选出你认为最可疑的一位</p>
          <div className="uc-vote-grid">
            {voteCandidatesForUser.map((c) => {
              const seat = findSeat(players, c.seatIndex);
              return (
                <button
                  key={c.seatIndex}
                  type="button"
                  className="uc-vote-btn"
                  onClick={() => handleUserVote(c.seatIndex)}
                >
                  <AvatarBubble character={seat} className="uc-vote-btn-avatar" />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === UNDERCOVER_PHASES.ELIMINATED && eliminatedSeat && (
        <div className="uc-eliminated-banner">
          <h3>{eliminatedSeat.isUser ? '你' : eliminatedSeat.name} 被投出局了</h3>
          <p>身份不公开，继续观察剩下的人吧。</p>
          {roundVoteReasonRows.length > 0 && (
            <div className="uc-vote-reason-list">
              {roundVoteReasonRows.map((row) => (
                <p key={row.key} className="uc-vote-reason-row">
                  {row.voterName} 投给了 {row.targetName}：{row.reason}
                </p>
              ))}
            </div>
          )}
          <div className="tgh-shared-actions">
            <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={handleNextRound}>
              继续下一轮
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- 结算画面（Slice B 只展示结果，不落库/回写——见 Slice C） ----------
const ResultScreen = ({ players, result, onExitToHall, onPlayAgain }) => {
  const isCivilianWin = result === UNDERCOVER_RESULT.CIVILIAN_WIN;

  return (
    <div className="tgh-shared-screen undercover-scope">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="tgh-shared-result-banner uc-result-banner">
        <h3>{isCivilianWin ? '平民胜利' : '卧底胜利'}</h3>
        <p>{isCivilianWin ? '卧底被成功投出局了。' : '卧底撑到了最后两人。'}</p>
      </div>

      <div className="uc-reveal-seats uc-result-seats">
        {players.map((p) => (
          <div key={p.seatIndex} className="uc-reveal-seat-chip">
            <AvatarBubble character={p} className="uc-reveal-seat-avatar" />
            <span className="uc-reveal-seat-name">{p.isUser ? '你' : p.name}</span>
            <span className={`uc-result-role ${p.role === 'undercover' ? 'uc-result-role--undercover' : ''}`}>
              {p.role === 'undercover' ? '卧底' : '平民'}
            </span>
          </div>
        ))}
      </div>

      <div className="tgh-shared-actions">
        <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={onPlayAgain}>
          再来一局
        </button>
        <button type="button" className="tgh-shared-btn" onClick={onExitToHall}>
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