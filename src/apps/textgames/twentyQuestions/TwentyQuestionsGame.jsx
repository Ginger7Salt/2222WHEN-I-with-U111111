// src/apps/textgames/twentyQuestions/TwentyQuestionsGame.jsx
//
// "20个问题"对局界面，从文字游戏大厅内部切换进来（跟井字棋同一个接入
// 方式，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 流程：选角色 -> 选方向（角色出题/用户出题，用户可以在开局时切换
// 默认方向）-> 对局 -> 结束后写回战绩+聊天消息 -> 可以"再来一局"。
//
// 对局状态只放在 React state 里，不落库——中途退出/刷新就是放弃这一局，
// 跟井字棋同一个"没必要为了一局猜谜单独做断点续局"的取舍。角色出题
// 方向下的"秘密词"全程只存在这个组件的 state 里，不写进任何持久化的
// 地方，直到这局结束才作为战绩的一部分落库（textGameMatches 那一行）。

import React, { useEffect, useRef, useState } from 'react';

import {
  DIRECTIONS,
  QUESTION_LIMIT,
  getChatIdForCharacter,
  getMatchStats,
  listCharactersForPicker,
  recordTwentyQuestionsMatch,
} from './twentyQuestionsService';
import {
  generateCharacterQuestion,
  generateSecretWord,
  judgeFinalGuess,
  judgeYesNoAnswer,
} from './twentyQuestionsAiService';
import '../textGameShared.css';
import './twentyQuestions.css';

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

const PHASE = {
  PICK_CHARACTER: 'pick-character',
  PICK_DIRECTION: 'pick-direction',
  SETUP_SECRET: 'setup-secret', // 仅 USER_SETS：用户先输入自己想好的词
  LOADING_SECRET: 'loading-secret', // 仅 CHARACTER_SETS：等AI悄悄想词
  PLAYING: 'playing',
  RESULT: 'result',
};

const TwentyQuestionsGame = ({ onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [chatId, setChatId] = useState(null);

  const [phase, setPhase] = useState(PHASE.PICK_CHARACTER);
  const [direction, setDirection] = useState(DIRECTIONS.CHARACTER_SETS);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0, total: 0 });

  const [secretWord, setSecretWord] = useState(null); // CHARACTER_SETS 专用
  const [userSecretDraft, setUserSecretDraft] = useState(''); // SETUP_SECRET 输入框
  const [userSecret, setUserSecret] = useState(''); // USER_SETS 专用，确认后的值

  const [history, setHistory] = useState([]); // [{question, answer}]
  const [actionsUsed, setActionsUsed] = useState(0);
  const [isWaitingAi, setIsWaitingAi] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const [questionDraft, setQuestionDraft] = useState('');
  const [guessDraft, setGuessDraft] = useState('');
  const [pendingCharacterTurn, setPendingCharacterTurn] = useState(null); // USER_SETS: {type,text}

  const [result, setResult] = useState(null); // 'win' | 'loss'
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
    const next = await getMatchStats('twenty-questions', characterId);
    setStats(next);
  };

  const resetRoundState = () => {
    setSecretWord(null);
    setUserSecretDraft('');
    setUserSecret('');
    setHistory([]);
    setActionsUsed(0);
    setIsWaitingAi(false);
    setAiUnavailable(false);
    setQuestionDraft('');
    setGuessDraft('');
    setPendingCharacterTurn(null);
    setResult(null);
    hasRecordedResultRef.current = false;
  };

  const handlePickCharacter = async (character) => {
    setSelectedCharacter(character);
    const id = await getChatIdForCharacter(character.id);
    setChatId(id);
    resetRoundState();
    await refreshStats(character.id);
    setPhase(PHASE.PICK_DIRECTION);
  };

  const startWithDirection = async (nextDirection) => {
    setDirection(nextDirection);
    resetRoundState();

    if (nextDirection === DIRECTIONS.USER_SETS) {
      setPhase(PHASE.SETUP_SECRET);
      return;
    }

    setPhase(PHASE.LOADING_SECRET);
    const word = await generateSecretWord(chatId);
    if (!word) {
      setAiUnavailable(true);
      setPhase(PHASE.PLAYING);
      return;
    }
    setSecretWord(word);
    setPhase(PHASE.PLAYING);
  };

  const confirmUserSecret = async () => {
    const value = userSecretDraft.trim();
    if (!value) return;
    setUserSecret(value);
    setPhase(PHASE.PLAYING);
    await requestNextCharacterTurn([]);
  };

  // USER_SETS 方向：问角色下一步该干什么（提问 or 直接猜）。
  const requestNextCharacterTurn = async (historyForPrompt) => {
    setIsWaitingAi(true);
    setPendingCharacterTurn(null);

    const turn = await generateCharacterQuestion({
      chatId,
      character: selectedCharacter,
      history: historyForPrompt,
      questionsLeft: QUESTION_LIMIT - historyForPrompt.length,
    });

    setIsWaitingAi(false);
    setPendingCharacterTurn(turn);
  };

  const finishRound = async (finalResult, revealedSecret, usedCount) => {
    setResult(finalResult);
    setPhase(PHASE.RESULT);

    if (hasRecordedResultRef.current || !selectedCharacter) return;
    hasRecordedResultRef.current = true;

    await recordTwentyQuestionsMatch({
      characterId: selectedCharacter.id,
      direction,
      result: finalResult,
      secretWord: revealedSecret,
      questionsUsed: usedCount,
    });
    await refreshStats(selectedCharacter.id);
  };

  // ===== CHARACTER_SETS：用户提问 =====
  const handleAskQuestion = async () => {
    const question = questionDraft.trim();
    if (!question || isWaitingAi) return;

    setQuestionDraft('');
    setIsWaitingAi(true);

    const answer = await judgeYesNoAnswer({
      chatId,
      character: selectedCharacter,
      secretWord,
      question,
    });

    const nextHistory = [...history, { question, answer }];
    const nextUsed = actionsUsed + 1;
    setHistory(nextHistory);
    setActionsUsed(nextUsed);
    setIsWaitingAi(false);

    if (nextUsed >= QUESTION_LIMIT) {
      await finishRound('loss', secretWord, nextUsed);
    }
  };

  const handleSubmitGuess = async () => {
    const guess = guessDraft.trim();
    if (!guess || isWaitingAi) return;

    setGuessDraft('');
    setIsWaitingAi(true);

    const isCorrect = await judgeFinalGuess({ chatId, secretWord, guess });
    const nextUsed = actionsUsed + 1;
    setIsWaitingAi(false);

    if (isCorrect) {
      await finishRound('win', secretWord, nextUsed);
      return;
    }

    setHistory((prev) => [...prev, { question: `（最终猜测）${guess}`, answer: '不对' }]);
    setActionsUsed(nextUsed);

    if (nextUsed >= QUESTION_LIMIT) {
      await finishRound('loss', secretWord, nextUsed);
    }
  };

  // ===== USER_SETS：用户回答角色提出的是非题/确认猜测是否命中 =====
  const handleAnswerCharacterQuestion = async (answerLabel) => {
    if (!pendingCharacterTurn || pendingCharacterTurn.type !== 'question') return;

    const nextHistory = [
      ...history,
      { question: pendingCharacterTurn.text, answer: answerLabel },
    ];
    const nextUsed = actionsUsed + 1;
    setHistory(nextHistory);
    setActionsUsed(nextUsed);

    if (nextUsed >= QUESTION_LIMIT) {
      await finishRound('loss', userSecret, nextUsed);
      return;
    }

    await requestNextCharacterTurn(nextHistory);
  };

  const handleConfirmCharacterGuess = async (wasCorrect) => {
    if (!pendingCharacterTurn || pendingCharacterTurn.type !== 'guess') return;

    const nextUsed = actionsUsed + 1;

    if (wasCorrect) {
      await finishRound('win', userSecret, nextUsed);
      return;
    }

    const nextHistory = [
      ...history,
      { question: `（TA猜）${pendingCharacterTurn.text}`, answer: '不对' },
    ];
    setHistory(nextHistory);
    setActionsUsed(nextUsed);

    if (nextUsed >= QUESTION_LIMIT) {
      await finishRound('loss', userSecret, nextUsed);
      return;
    }

    await requestNextCharacterTurn(nextHistory);
  };

  const handlePlayAgain = () => {
    startWithDirection(direction);
  };

  const handleChangeDirection = () => {
    setPhase(PHASE.PICK_DIRECTION);
  };

  const handleBackToPicker = () => {
    setSelectedCharacter(null);
    setChatId(null);
    resetRoundState();
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
          <h2>找谁玩20个问题</h2>
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

  if (phase === PHASE.PICK_DIRECTION) {
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
          <h2>这局谁来出题</h2>
          <p>Who sets the secret</p>
        </div>

        <div className="tgq-direction-list">
          <button
            type="button"
            className="tgq-direction-card"
            onClick={() => startWithDirection(DIRECTIONS.CHARACTER_SETS)}
          >
            <span className="tgq-direction-title">TA来想，你来问</span>
            <span className="tgq-direction-desc">
              {selectedCharacter?.name || 'TA'}心里悄悄想一个东西，你问是非题来猜
            </span>
          </button>

          <button
            type="button"
            className="tgq-direction-card"
            onClick={() => startWithDirection(DIRECTIONS.USER_SETS)}
          >
            <span className="tgq-direction-title">你来想，TA来问</span>
            <span className="tgq-direction-desc">
              你心里悄悄想一个东西，{selectedCharacter?.name || 'TA'}问是非题来猜
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (phase === PHASE.SETUP_SECRET) {
    return (
      <div className="tgh-shared-screen">
        <button
          type="button"
          className="tgh-back-btn"
          aria-label="返回"
          onClick={handleChangeDirection}
        >
          <BackIcon />
        </button>

        <div className="tgh-shared-picker-head">
          <h2>悄悄想一个东西</h2>
          <p>Only you will know</p>
        </div>

        <div className="tgh-shared-field" style={{ marginTop: 28 }}>
          <label>这个词只会留在你自己的屏幕上，不会发给任何人</label>
          <div className="tgh-shared-input-row">
            <input
              type="text"
              className="tgh-shared-input"
              placeholder="比如：长颈鹿"
              value={userSecretDraft}
              onChange={(event) => setUserSecretDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && confirmUserSecret()}
            />
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              onClick={confirmUserSecret}
              disabled={!userSecretDraft.trim()}
            >
              想好了
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === PHASE.LOADING_SECRET) {
    return (
      <div className="tgh-shared-screen">
        <button
          type="button"
          className="tgh-back-btn"
          aria-label="返回"
          onClick={handleChangeDirection}
        >
          <BackIcon />
        </button>
        <p className="tgh-shared-empty" style={{ marginTop: 100 }}>
          {selectedCharacter?.name || 'TA'}正在悄悄想一个东西……
        </p>
      </div>
    );
  }

  const questionsLeft = QUESTION_LIMIT - actionsUsed;

  return (
    <div className="tgh-shared-screen">
      <button
        type="button"
        className="tgh-back-btn"
        aria-label="返回"
        onClick={handleChangeDirection}
      >
        <BackIcon />
      </button>

      <div className="tgh-shared-head">
        <AvatarBubble character={selectedCharacter} className="tgh-shared-head-avatar" />
        <div>
          <div className="tgh-shared-head-title">
            {direction === DIRECTIONS.USER_SETS ? 'TA来问，你来想' : '你来问，TA来想'}
          </div>
          <div className="tgh-shared-head-sub">
            {phase === PHASE.RESULT ? '本局结束' : `还剩 ${questionsLeft} 问`}
          </div>
        </div>
      </div>

      {aiUnavailable && phase !== PHASE.RESULT && (
        <p className="tgh-shared-empty">
          还没配置好AI接口，这个游戏需要一个"裁判"才能玩——去设置里配置聊天接口后再来吧。
        </p>
      )}

      {!aiUnavailable && (
        <div className="tgq-log">
          {history.length === 0 && phase === PHASE.PLAYING && (
            <p className="tgq-log-empty">
              {direction === DIRECTIONS.USER_SETS
                ? '等TA想好第一个问题……'
                : '问第一个是非题试试看吧'}
            </p>
          )}

          {history.map((item, index) => (
            <div className="tgq-log-row" key={index}>
              <div className="tgq-log-q">{item.question}</div>
              <div className="tgq-log-a">{item.answer}</div>
            </div>
          ))}

          {direction === DIRECTIONS.USER_SETS &&
            pendingCharacterTurn &&
            phase === PHASE.PLAYING && (
              <div className="tgq-log-row tgq-log-row-pending">
                <div className="tgq-log-q">
                  {pendingCharacterTurn.type === 'guess'
                    ? `TA猜：${pendingCharacterTurn.text}`
                    : pendingCharacterTurn.text}
                </div>
              </div>
            )}

          {isWaitingAi && <p className="tgq-log-empty">TA正在想……</p>}
        </div>
      )}

      {phase === PHASE.PLAYING && !aiUnavailable && direction === DIRECTIONS.CHARACTER_SETS && (
        <>
          <div className="tgh-shared-field">
            <label>问一个是非题</label>
            <div className="tgh-shared-input-row">
              <input
                type="text"
                className="tgh-shared-input"
                placeholder="比如：是活的吗？"
                value={questionDraft}
                onChange={(event) => setQuestionDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleAskQuestion()}
                disabled={isWaitingAi}
              />
              <button
                type="button"
                className="tgh-shared-btn"
                onClick={handleAskQuestion}
                disabled={isWaitingAi || !questionDraft.trim()}
              >
                提问
              </button>
            </div>
          </div>

          <div className="tgh-shared-field">
            <label>或者直接猜最终答案</label>
            <div className="tgh-shared-input-row">
              <input
                type="text"
                className="tgh-shared-input"
                placeholder="我猜是……"
                value={guessDraft}
                onChange={(event) => setGuessDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSubmitGuess()}
                disabled={isWaitingAi}
              />
              <button
                type="button"
                className="tgh-shared-btn tgh-shared-btn-primary"
                onClick={handleSubmitGuess}
                disabled={isWaitingAi || !guessDraft.trim()}
              >
                最终猜测
              </button>
            </div>
          </div>
        </>
      )}

      {phase === PHASE.PLAYING &&
        !aiUnavailable &&
        direction === DIRECTIONS.USER_SETS &&
        pendingCharacterTurn?.type === 'question' && (
          <div className="tgq-answer-row">
            <button
              type="button"
              className="tgh-shared-btn"
              onClick={() => handleAnswerCharacterQuestion('是')}
            >
              是
            </button>
            <button
              type="button"
              className="tgh-shared-btn"
              onClick={() => handleAnswerCharacterQuestion('不是')}
            >
              不是
            </button>
            <button
              type="button"
              className="tgh-shared-btn"
              onClick={() => handleAnswerCharacterQuestion('不确定')}
            >
              不确定
            </button>
          </div>
        )}

      {phase === PHASE.PLAYING &&
        !aiUnavailable &&
        direction === DIRECTIONS.USER_SETS &&
        pendingCharacterTurn?.type === 'guess' && (
          <div className="tgq-answer-row">
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              onClick={() => handleConfirmCharacterGuess(true)}
            >
              猜中了
            </button>
            <button
              type="button"
              className="tgh-shared-btn"
              onClick={() => handleConfirmCharacterGuess(false)}
            >
              没猜对
            </button>
          </div>
        )}

      {phase === PHASE.RESULT && (
        <div className="tgh-shared-result-banner">
          <h3>{result === 'win' ? '猜中了' : '没猜中'}</h3>
          <p>
            秘密是「{direction === DIRECTIONS.USER_SETS ? userSecret : secretWord}」，
            一共用了{actionsUsed}问。
          </p>
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
            再来一局
          </button>
          <button type="button" className="tgh-shared-btn" onClick={handleChangeDirection}>
            换个方向
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

export default TwentyQuestionsGame;