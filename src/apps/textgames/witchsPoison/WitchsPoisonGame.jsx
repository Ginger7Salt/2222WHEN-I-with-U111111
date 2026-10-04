// src/apps/textgames/witchsPoison/WitchsPoisonGame.jsx
//
// "女巫的毒药"对局界面，从文字游戏大厅内部切换进来（跟井字棋/20个问题
// 同一个接入方式，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 真实规则（2026-10 改版——第一版理解成"一方藏一方猜"是错的，这版替换
// 掉那个逻辑）：
// - 用户和角色各自偷偷选一个杯子藏毒（互不知道对方藏在哪一杯）；
// - 轮流点杯子，每次只能点"自己还没点过的杯子"（你和TA各自的"已点过"
//   是分开计的，同一个编号你们可以分别点，不互相占用）；
//   赌的是这一杯不是对方藏毒的那一杯；
// - 谁先点中对方藏的那一杯，谁就中毒、这一局算谁输——由于每一方最多
//   有9个编号可试，9个杯子里必然有一个是对方藏的，所以一定会在9轮以内
//   分出结果，不会出现"怎么点都安全"的僵局。
//
// 流程：选角色 -> 设置赌注（选填，一局会话里只设置一次）-> 双方各自
// 藏毒（用户自己点一个，角色纯随机不用AI）-> 轮流点杯子，直到有人中毒
// -> 结束后写回战绩+聊天消息 -> "再来一局"会翻面换谁先手，直到"换个
// 人玩"才重置。
//
// 对局状态只放在 React state 里，不落库——中途退出/刷新就是放弃这一局。
// userSecretCup 全程只存在这个组件的 state 里，不发给AI、不落库展示，
// 只有这局结束后才作为战绩的一部分写进 textGameMatches。

import React, { useEffect, useRef, useState } from 'react';

import {
  getChatIdForCharacter,
  getMatchStats,
  listCharactersForPicker,
  recordWitchsPoisonRound,
} from './witchsPoisonService';
import {
  CUP_COUNT,
  pickCharacterSecretCup,
  requestCharacterCupPick,
  requestRoundReaction,
} from './witchsPoisonAiService';
import '../textGameShared.css';
import './witchsPoison.css';

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

  return <div className={className}>{initial}</div>;
};

const CUP_NUMBERS = Array.from({ length: CUP_COUNT }, (_, i) => i + 1);

const PHASE = {
  PICK_CHARACTER: 'pick-character',
  STAKE_SETUP: 'stake-setup',
  HIDING: 'hiding', // 用户悄悄选一个杯子藏毒
  ROUND: 'round', // 轮流点杯子
  RESULT: 'result',
};

const WitchsPoisonGame = ({ onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [chatId, setChatId] = useState(null);

  const [phase, setPhase] = useState(PHASE.PICK_CHARACTER);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0, total: 0 });

  const [stakeDraft, setStakeDraft] = useState('');
  const [stakeNote, setStakeNote] = useState('');

  const [firstMover, setFirstMover] = useState('user'); // 'user' | 'character'，每局结束翻面
  const [currentTurn, setCurrentTurn] = useState('user');

  const [userSecretCup, setUserSecretCup] = useState(null);
  const [characterSecretCup, setCharacterSecretCup] = useState(null);
  const [userTriedCups, setUserTriedCups] = useState([]);
  const [characterTriedCups, setCharacterTriedCups] = useState([]);
  const [turnLog, setTurnLog] = useState([]); // [{side, cup, reason}]
  const [isWaitingAi, setIsWaitingAi] = useState(false);

  const [poisonedSide, setPoisonedSide] = useState(null); // 'user' | 'character'
  const [hitCup, setHitCup] = useState(null);
  const [reactionLine, setReactionLine] = useState('');

  const hasRecordedResultRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await listCharactersForPicker();
        if (!cancelled) setCharacters(list);
      } finally {
        if (!cancelled) setLoadingCharacters(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshStats = async (characterId) => {
    const next = await getMatchStats('witchs-poison', characterId);
    setStats(next);
  };

  const handlePickCharacter = async (character) => {
    setSelectedCharacter(character);
    const id = await getChatIdForCharacter(character.id);
    setChatId(id);
    await refreshStats(character.id);
    setStakeDraft('');
    setPhase(PHASE.STAKE_SETUP);
  };

  const beginRound = (mover) => {
    setFirstMover(mover);
    setCurrentTurn(mover);
    setUserSecretCup(null);
    setCharacterSecretCup(null);
    setUserTriedCups([]);
    setCharacterTriedCups([]);
    setTurnLog([]);
    setIsWaitingAi(false);
    setPoisonedSide(null);
    setHitCup(null);
    setReactionLine('');
    hasRecordedResultRef.current = false;
    setPhase(PHASE.HIDING);
  };

  const confirmStakeAndStart = () => {
    setStakeNote(stakeDraft.trim());
    beginRound('user');
  };

  // 用户选好自己要藏毒的杯子——同一时刻角色的秘密也生成好（纯随机，
  // 不用AI），然后正式进入轮流点杯子阶段。
  const handleHideCup = (cupNumber) => {
    if (phase !== PHASE.HIDING) return;
    setUserSecretCup(cupNumber);
    setCharacterSecretCup(pickCharacterSecretCup());
    setPhase(PHASE.ROUND);
  };

  const finishRound = async ({ finalPoisonedSide, finalHitCup, finalTurnsTaken }) => {
    setPoisonedSide(finalPoisonedSide);
    setHitCup(finalHitCup);
    setPhase(PHASE.RESULT);

    // 角色反应是锦上添花，不等它也不让它卡住流程，拿到了就补上。
    requestRoundReaction({
      chatId,
      character: selectedCharacter,
      poisonedSide: finalPoisonedSide,
      stakeNote,
    }).then((line) => line && setReactionLine(line));

    if (hasRecordedResultRef.current || !selectedCharacter) return;
    hasRecordedResultRef.current = true;

    await recordWitchsPoisonRound({
      characterId: selectedCharacter.id,
      poisonedSide: finalPoisonedSide,
      userSecretCup,
      characterSecretCup,
      hitCup: finalHitCup,
      turnsTaken: finalTurnsTaken,
      stakeNote,
    });
    await refreshStats(selectedCharacter.id);
  };

  // 用户这一轮点一个自己还没点过的杯子，赌它不是角色藏毒的那一杯。
  const handleUserTurn = async (cupNumber) => {
    if (phase !== PHASE.ROUND || currentTurn !== 'user') return;
    if (userTriedCups.includes(cupNumber)) return;

    const nextTried = [...userTriedCups, cupNumber];
    setUserTriedCups(nextTried);
    const turnsTaken = nextTried.length + characterTriedCups.length;

    if (cupNumber === characterSecretCup) {
      await finishRound({
        finalPoisonedSide: 'user',
        finalHitCup: cupNumber,
        finalTurnsTaken: turnsTaken,
      });
      return;
    }

    setTurnLog((prev) => [...prev, { side: 'user', cup: cupNumber }]);
    setCurrentTurn('character');
  };

  // 角色这一轮点一个自己还没点过的杯子，赌它不是用户藏毒的那一杯。
  const handleCharacterTurn = async () => {
    if (phase !== PHASE.ROUND || currentTurn !== 'character' || isWaitingAi) return;

    const availableCups = CUP_NUMBERS.filter((n) => !characterTriedCups.includes(n));
    setIsWaitingAi(true);

    const { cupNumber, reason } = await requestCharacterCupPick({
      chatId,
      character: selectedCharacter,
      availableCups,
      stakeNote,
    });

    setIsWaitingAi(false);
    if (cupNumber === null) return; // 理论上不会发生（9个杯子不可能被提前点完）

    const nextTried = [...characterTriedCups, cupNumber];
    setCharacterTriedCups(nextTried);
    const turnsTaken = nextTried.length + userTriedCups.length;

    if (cupNumber === userSecretCup) {
      await finishRound({
        finalPoisonedSide: 'character',
        finalHitCup: cupNumber,
        finalTurnsTaken: turnsTaken,
      });
      return;
    }

    setTurnLog((prev) => [...prev, { side: 'character', cup: cupNumber, reason }]);
    setCurrentTurn('user');
  };

  const handlePlayAgain = () => {
    beginRound(firstMover === 'user' ? 'character' : 'user');
  };

  const handleEditStake = () => {
    setStakeDraft(stakeNote);
    setPhase(PHASE.STAKE_SETUP);
  };

  const handleBackToPicker = () => {
    setSelectedCharacter(null);
    setChatId(null);
    setStakeNote('');
    setPhase(PHASE.PICK_CHARACTER);
  };

  // ================= 渲染 =================

  if (phase === PHASE.PICK_CHARACTER) {
    return (
      <div className="tgh-shared-screen">
        <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
          <BackIcon />
        </button>

        <div className="tgh-shared-picker-head">
          <h2>找谁玩女巫的毒药</h2>
          <p>Pick your opponent</p>
        </div>

        {loadingCharacters && <p className="tgh-shared-empty">正在加载角色列表……</p>}

        {!loadingCharacters && characters.length === 0 && (
          <p className="tgh-shared-empty">还没有可以玩的角色，先去创建一个角色吧。</p>
        )}

        {!loadingCharacters && characters.length > 0 && (
          <div className="tgh-shared-picker-grid">
            {characters.map((character) => (
              <button
                key={character.id}
                type="button"
                className="tgh-shared-picker-item"
                onClick={() => handlePickCharacter(character)}
              >
                <AvatarBubble character={character} className="tgh-shared-picker-avatar" />
                <span className="tgh-shared-picker-name">{character.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (phase === PHASE.STAKE_SETUP) {
    return (
      <div className="tgh-shared-screen">
        <button
          type="button"
          className="tgh-back-btn-light"
          aria-label="返回"
          onClick={handleBackToPicker}
        >
          <BackIcon />
        </button>

        <div className="tgh-shared-picker-head">
          <h2>定个赌注（选填）</h2>
          <p>What does the loser owe</p>
        </div>

        <div className="tgh-shared-field" style={{ marginTop: 28 }}>
          <label>中毒的人要做什么？不填也可以，就是单纯赌个运气</label>
          <div className="tgh-shared-input-row">
            <input
              type="text"
              className="tgh-shared-input"
              placeholder="比如：唱一句歌给对方听"
              value={stakeDraft}
              onChange={(event) => setStakeDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && confirmStakeAndStart()}
            />
          </div>
        </div>

        <div className="tgh-shared-actions" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="tgh-shared-btn tgh-shared-btn-primary"
            onClick={confirmStakeAndStart}
          >
            开始
          </button>
        </div>
      </div>
    );
  }

  if (phase === PHASE.HIDING) {
    return (
      <div className="tgh-shared-screen">
        <button
          type="button"
          className="tgh-back-btn-light"
          aria-label="返回"
          onClick={handleEditStake}
        >
          <BackIcon />
        </button>

        <div className="tgh-shared-head">
          <AvatarBubble character={selectedCharacter} className="tgh-shared-head-avatar" />
          <div>
            <div className="tgh-shared-head-title">轮到你藏毒了</div>
            {stakeNote ? <div className="tgh-shared-head-sub">赌注：{stakeNote}</div> : null}
          </div>
        </div>

        <p className="tgwp-hint">悄悄选一个杯子藏毒——只有你自己知道是哪一个</p>

        <div className="tgwp-cup-grid">
          {CUP_NUMBERS.map((cupNumber) => (
            <button
              key={cupNumber}
              type="button"
              className="tgwp-cup"
              onClick={() => handleHideCup(cupNumber)}
            >
              {cupNumber}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const revealed = phase === PHASE.RESULT;

  const renderCup = (cupNumber) => {
    const isUserSecret = revealed && cupNumber === userSecretCup;
    const isCharacterSecret = revealed && cupNumber === characterSecretCup;
    const isHit = revealed && cupNumber === hitCup;

    const classNames = [
      'tgwp-cup',
      isHit ? 'tgwp-cup-hit' : '',
      isUserSecret && !isHit ? 'tgwp-cup-user-secret' : '',
      isCharacterSecret && !isHit ? 'tgwp-cup-character-secret' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const canUserClickNow =
      !revealed && currentTurn === 'user' && !userTriedCups.includes(cupNumber);

    return (
      <button
        key={cupNumber}
        type="button"
        className={classNames}
        onClick={() => canUserClickNow && handleUserTurn(cupNumber)}
        disabled={!canUserClickNow}
      >
        {cupNumber}
      </button>
    );
  };

  return (
    <div className="tgh-shared-screen">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={handleBackToPicker}>
        <BackIcon />
      </button>

      <div className="tgh-shared-head">
        <AvatarBubble character={selectedCharacter} className="tgh-shared-head-avatar" />
        <div>
          <div className="tgh-shared-head-title">你和TA各自藏了一杯毒</div>
          {stakeNote ? <div className="tgh-shared-head-sub">赌注：{stakeNote}</div> : null}
        </div>
      </div>

      {!revealed && (
        <p className="tgwp-hint">
          {currentTurn === 'user' ? '轮到你了，点一个还没点过的杯子' : '轮到TA了'}
        </p>
      )}

      <div className="tgwp-cup-grid">{CUP_NUMBERS.map(renderCup)}</div>

      {!revealed && currentTurn === 'character' && (
        <div className="tgh-shared-actions">
          <button
            type="button"
            className="tgh-shared-btn tgh-shared-btn-primary"
            onClick={handleCharacterTurn}
            disabled={isWaitingAi}
          >
            {isWaitingAi ? 'TA正在想……' : '让TA点一杯'}
          </button>
        </div>
      )}

      {turnLog.length > 0 && (
        <div className="tgwp-log">
          {turnLog.map((item, index) => (
            <div className="tgwp-log-row" key={index}>
              <span className="tgwp-log-side">
                {item.side === 'user' ? '你' : selectedCharacter?.name || 'TA'}点了{item.cup}号，安全
              </span>
              {item.reason && <span className="tgwp-log-reason">"{item.reason}"</span>}
            </div>
          ))}
        </div>
      )}

      {revealed && (
        <div className="tgh-shared-result-banner">
          <h3>{poisonedSide === 'user' ? '你中毒了' : 'TA中毒了'}</h3>
          <p>
            你藏在{userSecretCup}号，TA藏在{characterSecretCup}号，第{turnLog.length + 1}轮在
            {hitCup}号撞上了。
          </p>
          {reactionLine && <p>"{reactionLine}"</p>}
          {stakeNote && <p>说好的赌注："{stakeNote}"</p>}
          <p>这一局的结果已经让TA知道了，下次聊天可能会提起。</p>
        </div>
      )}

      {revealed && (
        <div className="tgh-shared-actions">
          <button
            type="button"
            className="tgh-shared-btn tgh-shared-btn-primary"
            onClick={handlePlayAgain}
          >
            再来一局（换谁先手）
          </button>
          <button type="button" className="tgh-shared-btn" onClick={handleEditStake}>
            换个赌注
          </button>
          <button type="button" className="tgh-shared-btn" onClick={handleBackToPicker}>
            换个人玩
          </button>
        </div>
      )}

      <div className="tgh-shared-stats-row">
        <div className="tgh-shared-stat">
          <div className="tgh-shared-stat-num">{stats.wins}</div>
          <div className="tgh-shared-stat-label">赢</div>
        </div>
        <div className="tgh-shared-stat">
          <div className="tgh-shared-stat-num">{stats.losses}</div>
          <div className="tgh-shared-stat-label">输</div>
        </div>
      </div>
    </div>
  );
};

export default WitchsPoisonGame;