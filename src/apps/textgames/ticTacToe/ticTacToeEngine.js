// src/apps/textgames/ticTacToe/ticTacToeEngine.js
//
// 井字棋的纯规则引擎，不碰 DB、不碰 React——board 永远是长度为9的数组，
// 下标0-8对应三行三列，每格是 null / 'X' / 'O'。
//
// 电脑（角色）走子用 minimax 保证"不会走出臭棋"，但特意混入一定概率的
// 随机合法走法，让它可以被赢——这是一款增进感情的小游戏，不是要做一个
// 永远不败的对手。概率是这里写死的合理默认值，想调整难度以后随时能改
// 这一个常量，不用动其余逻辑。

export const BOARD_SIZE = 9;

export const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // 横
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // 竖
  [0, 4, 8], [2, 4, 6], // 斜
];

// 角色走"非最优解"的概率——越低电脑越聪明越难赢。0.3 大致对应"认真
// 下但偶尔会给你机会"的手感。
export const COMPUTER_RANDOM_MOVE_CHANCE = 0.3;

export const createEmptyBoard = () => Array(BOARD_SIZE).fill(null);

export const getLegalMoves = (board) =>
  board.reduce((moves, cell, index) => {
    if (cell === null) moves.push(index);
    return moves;
  }, []);

// 返回 { winner: 'X'|'O'|null, line: number[]|null }，line 是连成一线的
// 三个下标，用于棋盘上画出"连线"动效；没有赢家时 line 为 null。
export const getWinner = (board) => {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
};

export const isBoardFull = (board) => board.every((cell) => cell !== null);

// 对局是否已经结束，以及结束的原因：'win' | 'draw' | null（还没结束）。
export const getGameOutcome = (board) => {
  const { winner, line } = getWinner(board);
  if (winner) return { status: 'win', winner, line };
  if (isBoardFull(board)) return { status: 'draw', winner: null, line: null };
  return { status: null, winner: null, line: null };
};

const opponentOf = (symbol) => (symbol === 'X' ? 'O' : 'X');

// 标准 minimax，深度越深分值越小/越大，让它同样质量的赢法里优先选
// "更快赢"的，同样质量的输法里优先选"能拖更久"的。
const minimax = (board, currentSymbol, computerSymbol, depth) => {
  const { winner } = getWinner(board);
  if (winner === computerSymbol) return 10 - depth;
  if (winner && winner !== computerSymbol) return depth - 10;
  if (isBoardFull(board)) return 0;

  const moves = getLegalMoves(board);
  const scores = moves.map((move) => {
    const nextBoard = board.slice();
    nextBoard[move] = currentSymbol;
    return minimax(nextBoard, opponentOf(currentSymbol), computerSymbol, depth + 1);
  });

  return currentSymbol === computerSymbol
    ? Math.max(...scores)
    : Math.min(...scores);
};

const pickBestMove = (board, computerSymbol) => {
  const moves = getLegalMoves(board);

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const nextBoard = board.slice();
    nextBoard[move] = computerSymbol;
    const score = minimax(nextBoard, opponentOf(computerSymbol), computerSymbol, 1);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
};

const pickRandomMove = (board) => {
  const moves = getLegalMoves(board);
  return moves[Math.floor(Math.random() * moves.length)];
};

// 电脑（角色）在当前局面下的落子位置。randomChance 可覆盖默认概率，
// 方便以后给不同角色/难度做区分，现在所有角色共用同一个默认值。
export const pickComputerMove = (
  board,
  computerSymbol,
  randomChance = COMPUTER_RANDOM_MOVE_CHANCE
) => {
  const moves = getLegalMoves(board);
  if (moves.length === 0) return null;

  if (Math.random() < randomChance) {
    return pickRandomMove(board);
  }

  return pickBestMove(board, computerSymbol);
};