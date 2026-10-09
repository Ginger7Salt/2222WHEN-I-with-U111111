// src/apps/textgames/twoTruthsOneLie/TwoTruthsOneLieGame.jsx
//
// "两个真话，一个假话"对局界面，从文字游戏大厅内部切换进来（跟 20个问题
// 同一个接入方式，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 流程：选角色 -> 第一轮（角色说三句，用户猜假话）-> 揭晓+角色反应
// -> 第二轮（用户写三句并标出假话，角色猜）-> 揭晓+角色反应+最终结果
// -> 写回战绩+聊天消息 -> 可以"再来一局"。
//
// 对局状态只放在 React state 里，不落库——中途退出/刷新就是放弃这一局。
// 用户在第二轮标记的"哪句是假的"只存在这个组件的 state 里，从来不会发给
// AI，直到揭晓后才作为战绩的一部分落库。

import React, { useEffect, useRef, useState } from 'react';

import {
  computeTwoTruthsResult,
  getChatIdForCharacter,
  getMatchStats,
  listCharactersForPicker,
  recordTwoTruthsMatch,
} from './twoTruthsOneLieService';
import {
  generateCharacterStatements,
  generateReaction,
  guessUserLie,
} from './twoTruthsOneLieAiService';
import '../textGameShared.css';
import './twoTruthsOneLie.css';

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
  LOADING_STATEMENTS: 'loading-statements', // 第一轮：等角色出题
  ERROR: 'error', // 第一轮出题失败
  ROUND1_GUESS: 'round1-guess', // 用户选哪句是假的
  ROUND1_REVEAL: 'round1-reveal', // 揭晓第一轮
  ROUND2_WRITE: 'round2-write', // 用户写三句并标出假话
  ROUND2_LOADING: 'round2-loading', // 等角色猜
  ROUND2_REVEAL: 'round2-reveal', // 揭晓第二轮 + 最终结果
};

const ROMAN = ['I.', 'II.', 'III.'];
const MAX_STATEMENT_LENGTH = 60;

const RESULT_TITLE = {
  win: '这一局你赢了',
  loss: '这一局TA赢了',
  draw: '这一局平手',
};

const TwoTruthsOneLieGame = ({ onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0, total: 0 });

  const [phase, setPhase] = useState(PHASE.PICK_CHARACTER);
  const [errorKind, setErrorKind] = useState(null); // 'unavailable' | 'parse'

  // 第一轮：角色出题
  const [charStatements, setCharStatements] = useState([]); // [{text, isLie}]
  const [userPick, setUserPick] = useState(null);
  const [userCorrect, setUserCorrect] = useState(false);
  const [round1Reaction, setRound1Reaction] = useState('');
  const [round1ReactionLoading, setRound1ReactionLoading] = useState(false);

  // 第二轮：用户出题
  const [userDrafts, setUserDrafts] = useState(['', '', '']);
  const [userLieIndex, setUserLieIndex] = useState(null);
  const [round2Error, setRound2Error] = useState('');
  const [charGuess, setCharGuess] = useState(null); // { pick, reason }
  const [charCorrect, setCharCorrect] = useState(false);
  const [round2Reaction, setRound2Reaction] = useState('');
  const [round2ReactionLoading, setRound2ReactionLoading] = useState(false);

  const hasRecordedResultRef = useRef(false);
  // 每次重置一局就 +1：异步请求回来之后比对一下，对不上就说明用户已经
  // 退出/重开了，这次回来的结果直接丢掉，不去改新一局的状态。
  const roundTokenRef = useRef(0);

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
    const next = await getMatchStats('two-truths-one-lie', characterId);
    setStats(next);
  };

  const resetRoundState = () => {
    roundTokenRef.current += 1;
    setErrorKind(null);
    setCharStatements([]);
    setUserPick(null);
    setUserCorrect(false);
    setRound1Reaction('');
    setRound1ReactionLoading(false);
    setUserDrafts(['', '', '']);
    setUserLieIndex(null);
    setRound2Error('');
    setCharGuess(null);
    setCharCorrect(false);
    setRound2Reaction('');
    setRound2ReactionLoading(false);
    hasRecordedResultRef.current = false;
  };

  const beginRound = async (id) => {
    resetRoundState();
    const token = roundTokenRef.current;
    setPhase(PHASE.LOADING_STATEMENTS);

    const outcome = await generateCharacterStatements({ chatId: id });
    if (token !== roundTokenRef.current) return;

    if (!outcome.ok) {
      setErrorKind(outcome.reason);
      setPhase(PHASE.ERROR);
      return;
    }

    setCharStatements(outcome.statements);
    setPhase(PHASE.ROUND1_GUESS);
  };

  const handlePickCharacter = async (character) => {
    setSelectedCharacter(character);
    const id = await getChatIdForCharacter(character.id);
    setChatId(id);
    await refreshStats(character.id);
    await beginRound(id);
  };

  // ===== 第一轮：用户猜 =====
  const handleGuess = async (index) => {
    if (phase !== PHASE.ROUND1_GUESS || userPick !== null) return;

    const token = roundTokenRef.current;
    const correct = Boolean(charStatements[index]?.isLie);
    const lieIndex = charStatements.findIndex((item) => item.isLie);

    setUserPick(index);
    setUserCorrect(correct);
    setRound1ReactionLoading(true);
    setPhase(PHASE.ROUND1_REVEAL);

    const text = await generateReaction({
      chatId,
      round: 1,
      statements: charStatements.map((item) => item.text),
      lieIndex,
      guessIndex: index,
      guesserCorrect: correct,
    });
    if (token !== roundTokenRef.current) return;

    setRound1Reaction(text || '');
    setRound1ReactionLoading(false);
  };

  // ===== 第二轮：用户出题，角色猜 =====
  const handleChangeDraft = (index, value) => {
    setUserDrafts((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const canSubmitRound2 =
    userLieIndex !== null && userDrafts.every((item) => item.trim());

  const handleSubmitRound2 = async () => {
    if (!canSubmitRound2 || !selectedCharacter) return;

    const token = roundTokenRef.current;
    const statements = userDrafts.map((item) => item.trim());
    const lieIndex = userLieIndex;

    setRound2Error('');
    setPhase(PHASE.ROUND2_LOADING);

    // 只发三句话本身，用户标记的假话位置不会发给AI。
    const guess = await guessUserLie({ chatId, statements });
    if (token !== roundTokenRef.current) return;

    if (!guess.ok) {
      setRound2Error('TA暂时联系不上，请检查AI接口配置后再试一次。');
      setPhase(PHASE.ROUND2_WRITE);
      return;
    }

    const correct = guess.pick === lieIndex;
    setCharGuess({ pick: guess.pick, reason: guess.reason });
    setCharCorrect(correct);
    setRound2ReactionLoading(true);
    setPhase(PHASE.ROUND2_REVEAL);

    if (!hasRecordedResultRef.current) {
      hasRecordedResultRef.current = true;
      try {
        await recordTwoTruthsMatch({
          characterId: selectedCharacter.id,
          charStatements,
          userPickIndex: userPick,
          userStatements: statements,
          userLieIndex: lieIndex,
          charGuessIndex: guess.pick,
          userCorrect,
          charCorrect: correct,
        });
        await refreshStats(selectedCharacter.id);
      } catch (error) {
        console.warn('[TwoTruthsOneLie] 战绩写回失败。', error);
      }
    }
    if (token !== roundTokenRef.current) return;

    const text = await generateReaction({
      chatId,
      round: 2,
      statements,
      lieIndex,
      guessIndex: guess.pick,
      guesserCorrect: correct,
    });
    if (token !== roundTokenRef.current) return;

    setRound2Reaction(text || '');
    setRound2ReactionLoading(false);
  };

  const handlePlayAgain = () => {
    beginRound(chatId);
  };

  const handleBackToPicker = () => {
    resetRoundState();
    setSelectedCharacter(null);
    setChatId(null);
    setPhase(PHASE.PICK_CHARACTER);
  };

  // ================= 渲染 =================

  const characterName = selectedCharacter?.name || 'TA';

  const renderBackButton = (onClick) => (
    <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onClick}>
      <BackIcon />
    </button>
  );

  const renderHead = (subText) => (
    <div className="tgh-shared-head">
      <AvatarBubble character={selectedCharacter} className="tgh-shared-head-avatar" />
      <div>
        <div className="tgh-shared-head-title">两个真话，一个假话</div>
        <div className="tgh-shared-head-sub">{subText}</div>
      </div>
    </div>
  );

  const renderReaction = (text, loading) => {
    if (loading) return <p className="tgt-note">{characterName}正在想怎么说……</p>;
    if (!text) return null;

    return (
      <div className="tgt-reaction">
        <div className="tgt-reaction-name">{characterName}</div>
        <div className="tgt-reaction-text">{text}</div>
      </div>
    );
  };

  if (phase === PHASE.PICK_CHARACTER) {
    return (
      <div className="tgh-shared-screen tgt-screen">
        {renderBackButton(onExitToHall)}

        <div className="tgh-shared-picker-head">
          <h2>找谁玩两真一假</h2>
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

  if (phase === PHASE.LOADING_STATEMENTS) {
    return (
      <div className="tgh-shared-screen tgt-screen">
        {renderBackButton(handleBackToPicker)}
        <p className="tgh-shared-empty" style={{ marginTop: 100 }}>
          {characterName}正在想三句关于自己的话……
        </p>
      </div>
    );
  }

  if (phase === PHASE.ERROR) {
    return (
      <div className="tgh-shared-screen tgt-screen">
        {renderBackButton(handleBackToPicker)}
        <p className="tgh-shared-empty" style={{ marginTop: 100 }}>
          {errorKind === 'unavailable'
            ? '还没配置好AI接口，这个游戏需要AI才能玩——去设置里配置聊天接口后再来吧。'
            : `${characterName}这次没把三句话想明白，再试一次吧。`}
        </p>
        <div className="tgh-shared-actions">
          {errorKind !== 'unavailable' && (
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              onClick={handlePlayAgain}
            >
              再试一次
            </button>
          )}
          <button type="button" className="tgh-shared-btn" onClick={handleBackToPicker}>
            换个人玩
          </button>
        </div>
      </div>
    );
  }

  if (phase === PHASE.ROUND1_GUESS || phase === PHASE.ROUND1_REVEAL) {
    const isReveal = phase === PHASE.ROUND1_REVEAL;

    return (
      <div className="tgh-shared-screen tgt-screen">
        {renderBackButton(handleBackToPicker)}
        {renderHead(isReveal ? '第 1 轮揭晓' : '第 1 / 2 轮 · 找出TA的假话')}

        <p className="tgt-hint">
          {isReveal
            ? userCorrect
              ? '你找到了那句假话。'
              : '你被TA骗过去了。'
            : `${characterName}说了三句关于自己的话，其中一句是编的，点你认为是假的那一句。`}
        </p>

        <div className="tgt-statements">
          {charStatements.map((item, index) => {
            const classNames = ['tgt-statement'];
            if (isReveal && item.isLie) classNames.push('tgt-statement-lie');
            if (isReveal && userPick === index) classNames.push('tgt-statement-picked');

            return (
              <button
                key={index}
                type="button"
                className={classNames.join(' ')}
                onClick={() => handleGuess(index)}
                disabled={isReveal}
              >
                <span className="tgt-statement-num">{ROMAN[index]}</span>
                <span className="tgt-statement-text">{item.text}</span>
                {isReveal && (
                  <span className="tgt-statement-marks">
                    {item.isLie && <span className="tgt-mark tgt-mark-lie">假话</span>}
                    {!item.isLie && <span className="tgt-mark">真话</span>}
                    {userPick === index && <span className="tgt-mark tgt-mark-pick">你的选择</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isReveal && renderReaction(round1Reaction, round1ReactionLoading)}

        {isReveal && (
          <div className="tgh-shared-actions">
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              onClick={() => setPhase(PHASE.ROUND2_WRITE)}
            >
              进入第二轮
            </button>
          </div>
        )}
      </div>
    );
  }

  if (phase === PHASE.ROUND2_WRITE) {
    return (
      <div className="tgh-shared-screen tgt-screen">
        {renderBackButton(handleBackToPicker)}
        {renderHead('第 2 / 2 轮 · 轮到你出题')}

        <p className="tgt-hint">
          写三句关于你自己的话，两句真的、一句编的，再点右边的"假"标出编的那句。{characterName}
          看不到你的标记，只能凭对你的了解来猜。
        </p>

        <div className="tgt-write-list">
          {userDrafts.map((draft, index) => (
            <div className="tgt-write-row" key={index}>
              <span className="tgt-write-num">{ROMAN[index]}</span>
              <input
                type="text"
                className="tgh-shared-input"
                placeholder="写一句关于你自己的话"
                maxLength={MAX_STATEMENT_LENGTH}
                value={draft}
                onChange={(event) => handleChangeDraft(index, event.target.value)}
              />
              <button
                type="button"
                className={
                  userLieIndex === index ? 'tgt-lie-toggle tgt-lie-toggle-on' : 'tgt-lie-toggle'
                }
                aria-pressed={userLieIndex === index}
                onClick={() => setUserLieIndex(index)}
              >
                假
              </button>
            </div>
          ))}
        </div>

        {round2Error && <p className="tgt-note">{round2Error}</p>}

        <div className="tgh-shared-actions">
          <button
            type="button"
            className="tgh-shared-btn tgh-shared-btn-primary"
            onClick={handleSubmitRound2}
            disabled={!canSubmitRound2}
          >
            交给TA来猜
          </button>
        </div>
      </div>
    );
  }

  if (phase === PHASE.ROUND2_LOADING) {
    return (
      <div className="tgh-shared-screen tgt-screen">
        {renderBackButton(handleBackToPicker)}
        <p className="tgh-shared-empty" style={{ marginTop: 100 }}>
          {characterName}正在盯着这三句话看……
        </p>
      </div>
    );
  }

  // PHASE.ROUND2_REVEAL
  const finalResult = computeTwoTruthsResult(userCorrect, charCorrect);

  return (
    <div className="tgh-shared-screen tgt-screen">
      {renderBackButton(handleBackToPicker)}
      {renderHead('第 2 轮揭晓')}

      <div className="tgt-statements">
        {userDrafts.map((text, index) => {
          const classNames = ['tgt-statement'];
          if (userLieIndex === index) classNames.push('tgt-statement-lie');
          if (charGuess?.pick === index) classNames.push('tgt-statement-picked');

          return (
            <div key={index} className={classNames.join(' ')}>
              <span className="tgt-statement-num">{ROMAN[index]}</span>
              <span className="tgt-statement-text">{text.trim()}</span>
              <span className="tgt-statement-marks">
                {userLieIndex === index ? (
                  <span className="tgt-mark tgt-mark-lie">假话</span>
                ) : (
                  <span className="tgt-mark">真话</span>
                )}
                {charGuess?.pick === index && (
                  <span className="tgt-mark tgt-mark-pick">{characterName}的选择</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {charGuess?.reason && (
        <p className="tgt-hint">
          {characterName}：{charGuess.reason}
        </p>
      )}

      {renderReaction(round2Reaction, round2ReactionLoading)}

      <div className="tgh-shared-result-banner">
        <div className="tgt-result-kicker">Final Score</div>
        <h3>{RESULT_TITLE[finalResult]}</h3>
        <div className="tgt-result-score">
          你 {userCorrect ? 1 : 0} : {charCorrect ? 1 : 0} {characterName}
        </div>
        <p>
          {userCorrect ? '你识破了TA的假话' : '你没识破TA的假话'}，
          {charCorrect ? 'TA识破了你的假话' : 'TA没识破你的假话'}。
        </p>
        <p>这一局的结果已经让TA知道了，下次聊天可能会提起。</p>
      </div>

      <div className="tgh-shared-actions">
        <button
          type="button"
          className="tgh-shared-btn tgh-shared-btn-primary"
          onClick={handlePlayAgain}
        >
          再来一局
        </button>
        <button type="button" className="tgh-shared-btn" onClick={handleBackToPicker}>
          换个人玩
        </button>
      </div>

      <div className="tgh-shared-stats-row">
        <div className="tgh-shared-stat">
          <div className="tgh-shared-stat-num">{stats.wins}</div>
          <div className="tgh-shared-stat-label">胜</div>
        </div>
        <div className="tgh-shared-stat">
          <div className="tgh-shared-stat-num">{stats.draws}</div>
          <div className="tgh-shared-stat-label">平</div>
        </div>
        <div className="tgh-shared-stat">
          <div className="tgh-shared-stat-num">{stats.losses}</div>
          <div className="tgh-shared-stat-label">负</div>
        </div>
      </div>
    </div>
  );
};

export default TwoTruthsOneLieGame;