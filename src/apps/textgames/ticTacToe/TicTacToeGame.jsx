// src/apps/textgames/ticTacToe/TicTacToeGame.jsx
//
// 井字棋对局界面，从文字游戏大厅内部切换进来（见 TextGameHallApp.jsx
// 的 activeGame 状态，没有另外注册成顶层 app）。流程：选角色 -> 对局
// -> 结束后写回战绩+聊天消息 -> 可以"再来一局"或返回大厅。
//
// 棋盘状态只放在 React state 里，不落库——中途退出/刷新就是放弃这一局，
// 跟其余轻量互动（戳一戳/石头剪刀布）同一个"没必要为了一局棋单独做
// 断点续局"的取舍。真正需要持久化的只有"打完之后的结果"。

import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  createEmptyBoard,
  getGameOutcome,
  pickComputerMove,
} from './ticTacToeEngine';
import {
  GAME_ID_TIC_TAC_TOE,
  getMatchStats,
  listCharactersForPicker,
  recordTicTacToeMatch,
} from './ticTacToeService';
import './ticTacToe.css';

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
    return (
      <img src={character.avatar} alt={name} className={className} />
    );
  }

  return <div className={className}>{initial}</div>;
};

// 用户永远执 X 先手，角色执 O——保持最直观的默认设定，以后想做"角色
// 也可能先手"是可以在这里单独扩展的小改动，不影响其余结构。
const USER_SYMBOL = 'X';
const COMPUTER_SYMBOL = 'O';

const STATUS_TEXT = {
  userTurn: '轮到你落子',
  computerTurn: 'TA正在想……',
  win: { user: '你赢了这一局', computer: '这一局被TA拿下了' },
  draw: '平局，谁都没赢',
};

const TicTacToeGame = ({ onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  const [board, setBoard] = useState(createEmptyBoard());
  const [isComputerThinking, setIsComputerThinking] = useState(false);
  const [outcome, setOutcome] = useState({ status: null, winner: null, line: null });
  const [hasRecordedResult, setHasRecordedResult] = useState(false);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0, total: 0 });

  const computerMoveTimerRef = useRef(null);

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

  useEffect(
    () => () => {
      if (computerMoveTimerRef.current) {
        clearTimeout(computerMoveTimerRef.current);
      }
    },
    []
  );

  const refreshStats = async (characterId) => {
    const next = await getMatchStats(GAME_ID_TIC_TAC_TOE, characterId);
    setStats(next);
  };

  const startMatchWith = async (character) => {
    setSelectedCharacter(character);
    setBoard(createEmptyBoard());
    setOutcome({ status: null, winner: null, line: null });
    setHasRecordedResult(false);
    await refreshStats(character.id);
  };

  const scheduleComputerMove = (currentBoard) => {
    setIsComputerThinking(true);
    computerMoveTimerRef.current = setTimeout(() => {
      const move = pickComputerMove(currentBoard, COMPUTER_SYMBOL);
      if (move === null) {
        setIsComputerThinking(false);
        return;
      }

      const nextBoard = currentBoard.slice();
      nextBoard[move] = COMPUTER_SYMBOL;
      setBoard(nextBoard);
      setIsComputerThinking(false);

      const result = getGameOutcome(nextBoard);
      if (result.status) {
        setOutcome(result);
      }
    }, 450); // 一点点延迟，手感上像"TA真的想了一下"，不是瞬间回子
  };

  const handleCellClick = (index) => {
    if (outcome.status || isComputerThinking) return;
    if (board[index] !== null) return;

    const nextBoard = board.slice();
    nextBoard[index] = USER_SYMBOL;
    setBoard(nextBoard);

    const result = getGameOutcome(nextBoard);
    if (result.status) {
      setOutcome(result);
      return;
    }

    scheduleComputerMove(nextBoard);
  };

  // 对局一结束就落库+回传聊天消息，只做一次（outcome.status 从 null
  // 变成有值的那一刻），避免重渲染重复写入。
  useEffect(() => {
    if (!outcome.status || hasRecordedResult || !selectedCharacter) return;

    const result =
      outcome.status === 'draw'
        ? 'draw'
        : outcome.winner === USER_SYMBOL
          ? 'win'
          : 'loss';

    setHasRecordedResult(true);

    recordTicTacToeMatch({
      characterId: selectedCharacter.id,
      gameTitle: '井字棋',
      result,
      board,
      userSymbol: USER_SYMBOL,
      computerSymbol: COMPUTER_SYMBOL,
    }).then(() => refreshStats(selectedCharacter.id));
  }, [outcome, hasRecordedResult, selectedCharacter, board]);

  const statusText = useMemo(() => {
    if (outcome.status === 'draw') return STATUS_TEXT.draw;
    if (outcome.status === 'win') {
      return outcome.winner === USER_SYMBOL
        ? STATUS_TEXT.win.user
        : STATUS_TEXT.win.computer;
    }
    if (isComputerThinking) return STATUS_TEXT.computerTurn;
    return STATUS_TEXT.userTurn;
  }, [outcome, isComputerThinking]);

  const handlePlayAgain = () => {
    if (!selectedCharacter) return;
    startMatchWith(selectedCharacter);
  };

  const handleBackToPicker = () => {
    setSelectedCharacter(null);
    setBoard(createEmptyBoard());
    setOutcome({ status: null, winner: null, line: null });
  };

  if (!selectedCharacter) {
    return (
      <div className="tgh-ttt-screen">
        <button
          type="button"
          className="tgh-back-btn"
          aria-label="返回"
          onClick={onExitToHall}
        >
          <BackIcon />
        </button>

        <div className="tgh-ttt-picker-head">
          <h2>找谁下这一局</h2>
          <p>Pick your opponent</p>
        </div>

        {loadingCharacters && (
          <p className="tgh-ttt-empty">正在加载角色列表……</p>
        )}

        {!loadingCharacters && characters.length === 0 && (
          <p className="tgh-ttt-empty">
            还没有可以对弈的角色，先去创建一个角色吧。
          </p>
        )}

        {!loadingCharacters && characters.length > 0 && (
          <div className="tgh-ttt-picker-grid">
            {characters.map((character) => (
              <button
                key={character.id}
                type="button"
                className="tgh-ttt-picker-item"
                onClick={() => startMatchWith(character)}
              >
                <AvatarBubble
                  character={character}
                  className="tgh-ttt-picker-avatar"
                />
                <span className="tgh-ttt-picker-name">{character.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tgh-ttt-screen">
      <button
        type="button"
        className="tgh-back-btn"
        aria-label="返回"
        onClick={handleBackToPicker}
      >
        <BackIcon />
      </button>

      <div className="tgh-ttt-match-head">
        <div className="tgh-ttt-vs-row">
          <div className="tgh-ttt-side">
            <div className="tgh-ttt-side-avatar">你</div>
            <span className="tgh-ttt-side-label">YOU</span>
            <span className="tgh-ttt-side-symbol">{USER_SYMBOL}</span>
          </div>

          <span className="tgh-ttt-vs-divider">vs</span>

          <div className="tgh-ttt-side">
            <AvatarBubble
              character={selectedCharacter}
              className="tgh-ttt-side-avatar"
            />
            <span className="tgh-ttt-side-label">
              {selectedCharacter.name}
            </span>
            <span className="tgh-ttt-side-symbol">{COMPUTER_SYMBOL}</span>
          </div>
        </div>

        <p className="tgh-ttt-status-line">{statusText}</p>
      </div>

      <div className="tgh-ttt-board">
        {board.map((cell, index) => {
          const isWinningCell = outcome.line?.includes(index);
          return (
            <button
              key={index}
              type="button"
              className={`tgh-ttt-cell ${
                cell === 'X' ? 'tgh-ttt-cell-x' : ''
              } ${cell === 'O' ? 'tgh-ttt-cell-o' : ''} ${
                isWinningCell ? 'tgh-ttt-cell-win' : ''
              }`}
              onClick={() => handleCellClick(index)}
              disabled={
                cell !== null || Boolean(outcome.status) || isComputerThinking
              }
            >
              {cell}
            </button>
          );
        })}
      </div>

      {outcome.status && (
        <div className="tgh-ttt-result-banner">
          <h3>
            {outcome.status === 'draw'
              ? '平局'
              : outcome.winner === USER_SYMBOL
                ? '你赢了'
                : `${selectedCharacter.name}赢了`}
          </h3>
          <p>这一局的结果已经让TA知道了，下次聊天可能会提起。</p>
        </div>
      )}

      {outcome.status && (
        <div className="tgh-ttt-actions">
          <button
            type="button"
            className="tgh-ttt-btn tgh-ttt-btn-primary"
            onClick={handlePlayAgain}
          >
            再来一局
          </button>
          <button
            type="button"
            className="tgh-ttt-btn"
            onClick={handleBackToPicker}
          >
            换个人下
          </button>
        </div>
      )}

      <div className="tgh-ttt-stats-row">
        <div className="tgh-ttt-stat">
          <div className="tgh-ttt-stat-num">{stats.wins}</div>
          <div className="tgh-ttt-stat-label">胜</div>
        </div>
        <div className="tgh-ttt-stat">
          <div className="tgh-ttt-stat-num">{stats.losses}</div>
          <div className="tgh-ttt-stat-label">负</div>
        </div>
        <div className="tgh-ttt-stat">
          <div className="tgh-ttt-stat-num">{stats.draws}</div>
          <div className="tgh-ttt-stat-label">平</div>
        </div>
      </div>
    </div>
  );
};

export default TicTacToeGame;