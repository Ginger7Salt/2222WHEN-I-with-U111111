// src/apps/textgames/witchsPoison/WitchsPoisonGame.jsx
//
// "女巫的毒药"对局界面，从文字游戏大厅内部切换进来（跟井字棋/20个问题
// 同一个接入方式，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 流程：选角色 -> 设置赌注（选填，一局会话里只设置一次）-> 对局（9个
// 杯子，一方藏毒一方猜）-> 结束后写回战绩+聊天消息 -> "再来一局"会
// 自动翻面（轮流当女巫，见用户确认过的设计），直到"换个人玩"才重置。
//
// 藏毒方是用户时，"用户选哪个杯子"这件事只停留在这个组件自己的 state
// 里（userHiddenCup），从不发给AI、也不落库展示给任何人，猜测方（角色）
// 完全靠 witchsPoisonAiService.requestCharacterCupGuess 的"人设直觉"赌
// 一个数字——没有任何信息泄露的风险。

import React, { useEffect, useRef, useState } from 'react';

import {
  getChatIdForCharacter,
  getMatchStats,
  listCharactersForPicker,
  recordWitchsPoisonRound,
} from './witchsPoisonService';
import { CUP_COUNT, requestCharacterCupGuess, requestRoundReaction } from './witchsPoisonAiService';
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
  ROUND: 'round',
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

  const [witchSide, setWitchSide] = useState('character'); // 'character' | 'user'
  const [poisonedCup, setPoisonedCup] = useState(null);
  const [userHiddenCup, setUserHiddenCup] = useState(null);
  const [guessedCup, setGuessedCup] = useState(null);
  const [isWaitingAi, setIsWaitingAi] = useState(false);
  const [guessReason, setGuessReason] = useState('');
  const [reactionLine, setReactionLine] = useState('');
  const [result, setResult] = useState(null);

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

  const beginRound = (side) => {
    setWitchSide(side);
    setPoisonedCup(side === 'character' ? Math.floor(Math.random() * CUP_COUNT) + 1 : null);
    setUserHiddenCup(null);
    setGuessedCup(null);
    setGuessReason('');
    setReactionLine('');
    setResult(null);
    hasRecordedResultRef.current = false;
    setPhase(PHASE.ROUND);
  };

  const confirmStakeAndStart = () => {
    setStakeNote(stakeDraft.trim());
    beginRound('character');
  };

  const finishRound = async ({ finalResult, finalPoisonedCup, finalGuessedCup }) => {
    setResult(finalResult);
    setPhase(PHASE.RESULT);

    // 角色反应是锦上添花，不等它也不让它卡住流程，拿到了就补上。
    requestRoundReaction({
      chatId,
      character: selectedCharacter,
      witchSide,
      guesserWon: finalResult === 'win',
      stakeNote,
    }).then((line) => line && setReactionLine(line));

    if (hasRecordedResultRef.current || !selectedCharacter) return;
    hasRecordedResultRef.current = true;

    await recordWitchsPoisonRound({
      characterId: selectedCharacter.id,
      witchSide,
      result: finalResult,
      poisonedCup: finalPoisonedCup,
      guessedCup: finalGuessedCup,
      stakeNote,
    });
    await refreshStats(selectedCharacter.id);
  };

  // witchSide === 'character'：用户点杯子猜
  const handleUserGuessCup = async (cupNumber) => {
    if (phase !== PHASE.ROUND || witchSide !== 'character') return;

    setGuessedCup(cupNumber);
    const finalResult = cupNumber === poisonedCup ? 'win' : 'loss';
    await finishRound({
      finalResult,
      finalPoisonedCup: poisonedCup,
      finalGuessedCup: cupNumber,
    });
  };

  // witchSide === 'user'：用户先选一个杯子藏毒
  const handleUserHideCup = (cupNumber) => {
    if (phase !== PHASE.ROUND || witchSide !== 'user' || userHiddenCup) return;
    setUserHiddenCup(cupNumber);
  };

  const handleTriggerCharacterGuess = async () => {
    if (!userHiddenCup || isWaitingAi) return;

    setIsWaitingAi(true);
    const { cupNumber, reason } = await requestCharacterCupGuess({
      chatId,
      character: selectedCharacter,
      stakeNote,
    });
    setIsWaitingAi(false);
    setGuessedCup(cupNumber);
    setGuessReason(reason);

    const finalResult = cupNumber === userHiddenCup ? 'win' : 'loss';
    await finishRound({
      finalResult,
      finalPoisonedCup: userHiddenCup,
      finalGuessedCup: cupNumber,
    });
  };

  const handlePlayAgain = () => {
    beginRound(witchSide === 'character' ? 'user' : 'character');
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
        <button type="button" className="tgh-back-btn" aria-label="返回" onClick={onExitToHall}>
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
          className="tgh-back-btn"
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
          <label>没猜中的人要做什么？不填也可以，就是单纯赌个运气</label>
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

  const isCharacterWitch = witchSide === 'character';
  const isUserHidingPhase = !isCharacterWitch && !userHiddenCup && phase === PHASE.ROUND;
  const isReadyForCharacterGuess = !isCharacterWitch && userHiddenCup && phase === PHASE.ROUND;
  const isUserGuessingPhase = isCharacterWitch && phase === PHASE.ROUND;

  const renderCup = (cupNumber) => {
    const revealed = phase === PHASE.RESULT;
    const isPoisoned = revealed && cupNumber === poisonedCup;
    const isGuessed = revealed && cupNumber === guessedCup;
    const isHiddenByUser = !revealed && !isCharacterWitch && cupNumber === userHiddenCup;

    const classNames = [
      'tgwp-cup',
      isPoisoned ? 'tgwp-cup-poisoned' : '',
      isGuessed && !isPoisoned ? 'tgwp-cup-guessed' : '',
      isHiddenByUser ? 'tgwp-cup-hidden-marker' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const disabled =
      revealed ||
      (isCharacterWitch ? false : Boolean(userHiddenCup)) ||
      (isCharacterWitch ? false : isWaitingAi);

    const handleClick = () => {
      if (isCharacterWitch) {
        handleUserGuessCup(cupNumber);
      } else {
        handleUserHideCup(cupNumber);
      }
    };

    return (
      <button
        key={cupNumber}
        type="button"
        className={classNames}
        onClick={handleClick}
        disabled={disabled}
      >
        {cupNumber}
      </button>
    );
  };

  return (
    <div className="tgh-shared-screen">
      <button type="button" className="tgh-back-btn" aria-label="返回" onClick={handleBackToPicker}>
        <BackIcon />
      </button>

      <div className="tgh-shared-head">
        <AvatarBubble character={selectedCharacter} className="tgh-shared-head-avatar" />
        <div>
          <div className="tgh-shared-head-title">
            {isCharacterWitch ? `${selectedCharacter?.name || 'TA'}藏毒，你来猜` : '你藏毒，TA来猜'}
          </div>
          {stakeNote ? <div className="tgh-shared-head-sub">赌注：{stakeNote}</div> : null}
        </div>
      </div>

      {isUserHidingPhase && (
        <p className="tgwp-hint">悄悄选一个杯子藏毒——只有你自己知道是哪一个</p>
      )}
      {isReadyForCharacterGuess && (
        <p className="tgwp-hint">藏好了，让TA猜一个杯子</p>
      )}
      {isUserGuessingPhase && <p className="tgwp-hint">选一个杯子，赌它有毒</p>}

      <div className="tgwp-cup-grid">{CUP_NUMBERS.map(renderCup)}</div>

      {isReadyForCharacterGuess && (
        <div className="tgh-shared-actions">
          <button
            type="button"
            className="tgh-shared-btn tgh-shared-btn-primary"
            onClick={handleTriggerCharacterGuess}
            disabled={isWaitingAi}
          >
            {isWaitingAi ? 'TA正在想……' : '让TA猜'}
          </button>
        </div>
      )}

      {phase === PHASE.RESULT && (
        <div className="tgh-shared-result-banner">
          <h3>{result === 'win' ? '猜中了' : '没猜中'}</h3>
          <p>
            毒药在{poisonedCup}号杯，猜的是{guessedCup}号杯。
          </p>
          {guessReason && <p>TA说："{guessReason}"</p>}
          {reactionLine && <p>"{reactionLine}"</p>}
          {stakeNote && <p>说好的赌注："{stakeNote}"</p>}
          <p>这一局的结果已经让TA知道了，下次聊天可能会提起。</p>
        </div>
      )}

      {phase === PHASE.RESULT && (
        <div className="tgh-shared-actions">
          <button
            type="button"
            className="tgh-shared-btn tgh-shared-btn-primary"
            onClick={handlePlayAgain}
          >
            再来一局（换TA/你藏毒）
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
          <div className="tgh-shared-stat-label">猜中</div>
        </div>
        <div className="tgh-shared-stat">
          <div className="tgh-shared-stat-num">{stats.losses}</div>
          <div className="tgh-shared-stat-label">没猜中</div>
        </div>
      </div>
    </div>
  );
};

export default WitchsPoisonGame;