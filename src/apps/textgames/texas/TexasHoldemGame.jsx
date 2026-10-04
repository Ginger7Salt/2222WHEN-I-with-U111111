// src/apps/textgames/texas/TexasHoldemGame.jsx
//
// 德州扑克对局界面，从文字游戏大厅内部切换进来（跟井字棋/UNO同一个接入
// 方式，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 流程：选两位同桌角色 -> 选买入金额（从全局虚拟筹码池里带多少上桌）
// -> 对局（可以连打很多手牌，每手结束停下来等用户点"下一手"或者
// "离场结算"）-> 会话结算（赢/输了多少筹码，写回战绩+两位角色各自的
// 聊天）。真正的下注引擎/角色策略/台词都在 texas/ 目录下的其它文件里，
// 这个组件只管渲染和转发点击，时序交给 useTexasMatch.js。

import React, { useEffect, useState } from 'react';

import { listCharactersForPicker } from './texasService';
import { ensureTexasLinesForTable } from './texasLinesService';
import { COMP_TOPUP_TO, MIN_PLAYABLE_CHIPS, ensureMinimumChips } from './texasChipsService';
import { computeBlinds, useTexasMatch } from './useTexasMatch';
import { RANK_LABEL, SUIT_SYMBOL, evaluateBest } from './texasHandEval';
import { sessionHasEnded } from './texasEngine';
import '../textGameShared.css';
import './texasHoldem.css';

const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const AvatarBubble = ({ character, className }) => {
  const name = character?.name || '你';
  const initial = name.trim().charAt(0) || '?';
  if (character?.avatar) return <img src={character.avatar} alt={name} className={className} />;
  return <div className={className}>{initial}</div>;
};

const isRed = (suit) => suit === 'h' || suit === 'd';

const TexasCard = ({ card, hidden, small }) => {
  if (hidden || !card) {
    return <div className={`tht-card tht-card-back ${small ? 'tht-card-sm' : ''}`} />;
  }
  return (
    <div className={`tht-card ${isRed(card.suit) ? 'tht-card-red' : 'tht-card-black'} ${small ? 'tht-card-sm' : ''}`}>
      <span className="tht-card-rank">{RANK_LABEL[card.rank]}</span>
      <span className="tht-card-suit">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
};

// ---------- 选同桌 ----------
const CharacterPicker = ({ onPicked, onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickedIds, setPickedIds] = useState([]);
  const [preparing, setPreparing] = useState(false);

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
      if (cur.length >= 2) return [cur[1], id];
      return [...cur, id];
    });
  };

  const startDisabled = pickedIds.length !== 2 || preparing;

  return (
    <div className="tgh-shared-screen tht-screen">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="tgh-shared-picker-head">
        <h2>请两位同桌</h2>
        <p>Three at the felt</p>
      </div>

      {loading && <p className="tgh-shared-empty">正在加载角色列表……</p>}
      {!loading && characters.length < 2 && (
        <p className="tgh-shared-empty">德州扑克需要两位角色同桌，先去创建至少两个角色吧。</p>
      )}

      {!loading && characters.length >= 2 && (
        <>
          <div className="tgh-shared-picker-grid">
            {characters.map((character) => {
              const picked = pickedIds.includes(character.id);
              return (
                <button
                  key={character.id}
                  type="button"
                  className={`tgh-shared-picker-item ${picked ? 'tht-picked' : ''}`}
                  onClick={() => togglePick(character.id)}
                >
                  <AvatarBubble character={character} className="tgh-shared-picker-avatar" />
                  <span className="tgh-shared-picker-name">{character.name}</span>
                </button>
              );
            })}
          </div>

          <p className="tht-picker-hint">已选 {pickedIds.length} / 2</p>

          <div className="tgh-shared-actions">
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              disabled={startDisabled}
              onClick={async () => {
                const picked = pickedIds.map((id) => characters.find((c) => c.id === id));
                setPreparing(true);
                try {
                  onPicked(await ensureTexasLinesForTable(picked));
                } catch (err) {
                  onPicked(picked);
                } finally {
                  setPreparing(false);
                }
              }}
            >
              {preparing ? '正在准备台词……' : '下一步：选买入'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ---------- 选买入 ----------
const BuyInScreen = ({ characters, onConfirm, onBack }) => {
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const topped = await ensureMinimumChips();
      if (!cancelled) {
        setBalance(topped);
        setAmount(Math.max(MIN_PLAYABLE_CHIPS, Math.round(topped * 0.5)));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || balance === null) {
    return (
      <div className="tgh-shared-screen tht-screen">
        <p className="tgh-shared-empty">正在查筹码……</p>
      </div>
    );
  }

  const presets = Array.from(
    new Set([
      Math.max(MIN_PLAYABLE_CHIPS, Math.round(balance * 0.25)),
      Math.max(MIN_PLAYABLE_CHIPS, Math.round(balance * 0.5)),
      balance,
    ])
  ).filter((v) => v <= balance && v >= MIN_PLAYABLE_CHIPS);

  const { smallBlind, bigBlind } = computeBlinds(Math.max(amount, MIN_PLAYABLE_CHIPS));
  const clampAmount = (v) => Math.min(balance, Math.max(MIN_PLAYABLE_CHIPS, Math.round(v || 0)));

  return (
    <div className="tgh-shared-screen tht-screen">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onBack}>
        <BackIcon />
      </button>

      <div className="tgh-shared-picker-head">
        <h2>买入多少</h2>
        <p>Buy in from your chip pool</p>
      </div>

      <div className="tht-balance-card">
        <span className="tht-balance-label">筹码池余额</span>
        <span className="tht-balance-num">{balance}</span>
        {balance === COMP_TOPUP_TO && (
          <span className="tht-balance-note">余额太少，大厅给你补了点本金</span>
        )}
      </div>

      <div className="tgh-shared-actions">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            className={`tgh-shared-btn ${amount === p ? 'tgh-shared-btn-primary' : ''}`}
            onClick={() => setAmount(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="tgh-shared-field">
        <label>自定义买入（最少 {MIN_PLAYABLE_CHIPS}）</label>
        <div className="tgh-shared-input-row">
          <input
            type="number"
            className="tgh-shared-input"
            value={amount}
            min={MIN_PLAYABLE_CHIPS}
            max={balance}
            onChange={(e) => setAmount(clampAmount(e.target.value))}
          />
        </div>
      </div>

      <p className="tht-blind-hint">
        这桌盲注：小盲 {smallBlind} / 大盲 {bigBlind}（按买入的固定比例算，坐下后这局都不变）。
        另外两位同桌按同样的买入上桌。
      </p>

      <div className="tgh-shared-actions">
        <button
          type="button"
          className="tgh-shared-btn tgh-shared-btn-primary"
          onClick={() => onConfirm(clampAmount(amount))}
        >
          坐下开局
        </button>
      </div>
    </div>
  );
};

// ---------- 结算页里的摊牌展示（结束后回看自己的牌） ----------
const buildBoardWithHole = (table, seatIdx) => {
  if (!table) return null;
  const seat = table.seats[seatIdx];
  if (!seat || seat.holeCards.length < 2 || table.board.length < 3) return null;
  return evaluateBest([...seat.holeCards, ...table.board]);
};

// ---------- 对局（一整个会话） ----------
const TexasMatch = ({ characters, buyIn, onExitToHall, onBackToPicker }) => {
  const m = useTexasMatch({ characters, buyIn });
  const { table } = m;

  useEffect(() => {
    m.startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!table) {
    return (
      <div className="tgh-shared-screen tht-screen">
        <p className="tgh-shared-empty">正在洗牌……</p>
      </div>
    );
  }

  const handOver = table.street === 'handOver';
  const showdown = handOver && !table.winnersInfo?.uncontested;
  const winnerSeats = new Set((table.winnersInfo?.pots || []).flatMap((p) => p.winners));

  const seatLabel = (idx) => {
    if (idx === table.buttonIndex) return '庄';
    return null;
  };

  const renderSeat = (idx, character) => {
    const seat = table.seats[idx];
    const isUser = idx === 0;
    const revealHole = isUser || (showdown && !seat.folded);
    const bubble = m.bubbles[idx];
    const isActing = !handOver && table.toAct[0] === idx;
    const isWinner = handOver && winnerSeats.has(idx);

    let handTag = null;
    if (showdown && !seat.folded) {
      const ev = buildBoardWithHole(table, idx);
      if (ev) handTag = ev.label;
    }

    return (
      <div
        key={idx}
        className={`tht-seat ${isUser ? 'tht-seat-user' : `tht-seat-${idx}`} ${seat.folded ? 'tht-seat-folded' : ''} ${seat.out ? 'tht-seat-out' : ''} ${isActing ? 'tht-seat-acting' : ''} ${isWinner ? 'tht-seat-winner' : ''}`}
      >
        {bubble && (
          <div className="tht-bubble" key={bubble.key}>
            {bubble.text}
          </div>
        )}
        <div className="tht-seat-top">
          <AvatarBubble character={isUser ? null : character} className="tht-avatar" />
          {seatLabel(idx) && <span className="tht-btn-chip">{seatLabel(idx)}</span>}
        </div>
        <div className="tht-seat-name">{isUser ? '你' : character?.name}</div>
        <div className="tht-seat-stack">{seat.stack}</div>
        {seat.out && <div className="tht-seat-tag">已出局</div>}
        {!seat.out && seat.folded && !handOver && <div className="tht-seat-tag">已弃牌</div>}
        {seat.allIn && !seat.folded && <div className="tht-seat-tag tht-seat-tag-allin">全下</div>}
        <div className="tht-hole-row">
          <TexasCard card={seat.holeCards[0]} hidden={!revealHole} small={!isUser} />
          <TexasCard card={seat.holeCards[1]} hidden={!revealHole} small={!isUser} />
        </div>
        {handTag && <div className="tht-hand-tag">{handTag}</div>}
      </div>
    );
  };

  const timerPct = Math.max(0, Math.min(100, (m.remainingMs / 20000) * 100));

  return (
    <div className="tht-screen tht-table-screen">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="tht-header">
        <span>第 {m.handsPlayed} 手</span>
        <span>
          盲注 {table.smallBlind}/{table.bigBlind}
        </span>
      </div>

      <div className="tht-felt">
        <div className="tht-opponents-row">
          {renderSeat(1, characters[0])}
          {renderSeat(2, characters[1])}
        </div>

        <div className="tht-board-area">
          <div className="tht-pot">底池 {m.potTotal}</div>
          <div className="tht-board-row">
            {[0, 1, 2, 3, 4].map((i) => (
              <TexasCard key={i} card={table.board[i]} hidden={!table.board[i]} />
            ))}
          </div>
        </div>

        {renderSeat(0, null)}
      </div>

      {m.notice && <div className="tht-notice">{m.notice}</div>}

      {!handOver && m.isMyTurn && (
        <div className="tht-action-bar">
          <div className="tht-timer-track">
            <div className="tht-timer-fill" style={{ width: `${timerPct}%` }} />
          </div>
          <div className="tht-action-row">
            <button type="button" className="tht-act-btn tht-act-fold" onClick={m.doFold}>
              弃牌
            </button>
            <button type="button" className="tht-act-btn tht-act-call" onClick={m.doCheckOrCall}>
              {m.legal.canCheck ? '过牌' : `跟注 ${m.legal.callAmount}`}
            </button>
            {m.legal.canRaise && (
              <button
                type="button"
                className="tht-act-btn tht-act-raise"
                onClick={() => m.doRaiseTo(m.raiseAmount)}
              >
                加注到 {m.raiseAmount}
              </button>
            )}
            <button type="button" className="tht-act-btn tht-act-allin" onClick={m.doAllIn}>
              全下
            </button>
          </div>
          {m.legal.canRaise && (
            <div className="tht-raise-row">
              <button
                type="button"
                className="tht-raise-step"
                onClick={() => m.setRaiseAmount((v) => Math.max(m.legal.minRaiseTo, v - table.bigBlind))}
              >
                −
              </button>
              <input
                type="range"
                min={m.legal.minRaiseTo}
                max={m.legal.maxRaiseTo}
                value={Math.min(Math.max(m.raiseAmount, m.legal.minRaiseTo), m.legal.maxRaiseTo)}
                onChange={(e) => m.setRaiseAmount(Number(e.target.value))}
                className="tht-raise-slider"
              />
              <button
                type="button"
                className="tht-raise-step"
                onClick={() => m.setRaiseAmount((v) => Math.min(m.legal.maxRaiseTo, v + table.bigBlind))}
              >
                +
              </button>
            </div>
          )}
        </div>
      )}

      {handOver && !m.sessionEnded && !sessionHasEnded(table) && (
        <div className="tht-hand-result">
          <h4>
            {table.winnersInfo?.uncontested
              ? `${table.seats.map((s, i) => i).filter((i) => !table.seats[i].folded)[0] === 0 ? '你' : m.nameOf(table.seats.map((s, i) => i).filter((i) => !table.seats[i].folded)[0])}让其他人弃牌，直接赢下这手`
              : '摊牌'}
          </h4>
          <div className="tht-pot-results">
            {(table.winnersInfo?.pots || []).map((pot, i) => (
              <p key={i}>
                {pot.winners.map((s) => m.nameOf(s)).join('、')}赢下 {pot.amount}
                {pot.handLabel ? `（${pot.handLabel}）` : ''}
              </p>
            ))}
          </div>
          <div className="tgh-shared-actions">
            <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={m.nextHand}>
              下一手
            </button>
            <button type="button" className="tgh-shared-btn" onClick={m.leaveTable}>
              离场结算
            </button>
          </div>
        </div>
      )}

      {m.sessionEnded && m.sessionResult && (
        <div className="tht-session-overlay">
          <div className="tgh-shared-result-banner">
            <h3>
              {m.sessionResult.result === 'win'
                ? `这桌赢了 ${m.sessionResult.netChange} 个筹码`
                : m.sessionResult.result === 'loss'
                ? `这桌输了 ${Math.abs(m.sessionResult.netChange)} 个筹码`
                : '这桌不赔不赚'}
            </h3>
            <p>
              买入 {m.sessionResult.buyIn}，离桌时手上 {m.sessionResult.finalStack}，一共打了{' '}
              {m.sessionResult.handsPlayed} 手
            </p>
          </div>
          {m.momentLines.length > 0 && (
            <ul className="tht-moment-log">
              {m.momentLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {m.stats && (
            <div className="tgh-shared-stats-row">
              <div className="tgh-shared-stat">
                <div className="tgh-shared-stat-num">{m.stats.wins}</div>
                <div className="tgh-shared-stat-label">赢</div>
              </div>
              <div className="tgh-shared-stat">
                <div className="tgh-shared-stat-num">{m.stats.losses}</div>
                <div className="tgh-shared-stat-label">输</div>
              </div>
              <div className="tgh-shared-stat">
                <div className="tgh-shared-stat-num">{m.stats.total}</div>
                <div className="tgh-shared-stat-label">最近局数</div>
              </div>
            </div>
          )}
          <p className="tht-saved-note">这桌的结果已经让TA们知道了，下次聊天可能会提起。</p>
          <div className="tgh-shared-actions">
            <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={onBackToPicker}>
              再来一桌
            </button>
            <button type="button" className="tgh-shared-btn" onClick={onExitToHall}>
              回大厅
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- 顶层：选角色 -> 选买入 -> 对局 ----------
const TexasHoldemGame = ({ onExitToHall }) => {
  const [step, setStep] = useState('pick'); // 'pick' | 'buyIn' | 'match'
  const [table, setTable] = useState(null); // 选定的两位角色（数组）
  const [buyIn, setBuyIn] = useState(0);

  if (step === 'pick') {
    return (
      <CharacterPicker
        onExitToHall={onExitToHall}
        onPicked={(characters) => {
          setTable(characters);
          setStep('buyIn');
        }}
      />
    );
  }

  if (step === 'buyIn') {
    return (
      <BuyInScreen
        characters={table}
        onBack={() => setStep('pick')}
        onConfirm={(amount) => {
          setBuyIn(amount);
          setStep('match');
        }}
      />
    );
  }

  return (
    <TexasMatch
      characters={table}
      buyIn={buyIn}
      onExitToHall={onExitToHall}
      onBackToPicker={() => setStep('pick')}
    />
  );
};

export default TexasHoldemGame;