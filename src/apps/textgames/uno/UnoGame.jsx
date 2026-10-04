// src/apps/textgames/uno/UnoGame.jsx
//
// UNO 对局界面，从文字游戏大厅内部切换进来（跟井字棋同一个接法，见
// TextGameHallApp.jsx 的 GAME_COMPONENTS，没有另外注册成顶层 app）。
// 流程：选两位同桌角色 -> 横屏对局 -> 结算（存档和发聊天消息由
// useUnoMatch / unoService 处理）。
//
// 对局画面是固定 844x390 的横屏舞台，按屏幕大小等比缩放；手机竖着拿的
// 时候整个舞台旋转 90 度，转过手机就能玩。能锁定横屏的环境（装成应用的
// 安卓等）会顺手尝试锁定，锁不了就静默忽略。

import React, { useEffect, useMemo, useState } from 'react';

import UnoCard, { COLOR_ZH, cardEffect, cardName } from './UnoCard';
import { sortHandForDisplay, useUnoMatch } from './useUnoMatch';
import { formatDuration } from './unoMatchFormat';
import { TURN_TIME_LIMIT_MS, COLORS, getTopCard, isWild } from './unoEngine';
import { listCharactersForPicker } from './unoService';
import './uno.css';

const STAGE_W = 844;
const STAGE_H = 390;

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

const HALO = {
  black: 'rgba(120, 110, 150, 0.55)',
  red: 'rgba(217, 69, 74, 0.5)',
  white: 'rgba(255, 255, 255, 0.42)',
  darkblue: 'rgba(60, 100, 200, 0.55)',
};

const CHIP = {
  black: '#232027',
  red: '#d9454a',
  white: '#f3efe8',
  darkblue: '#26427d',
};

// ---------- 视口：横屏直接铺，竖屏旋转 ----------
const useViewport = () => {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [size, setSize] = useState(read);

  useEffect(() => {
    const onResize = () => setSize(read());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return size;
};

const stageTransform = ({ w, h }) => {
  const portrait = h > w;
  const effW = portrait ? h : w;
  const effH = portrait ? w : h;
  const scale = Math.min(effW / STAGE_W, effH / STAGE_H);

  if (!portrait) {
    const left = (w - STAGE_W * scale) / 2;
    const top = (h - STAGE_H * scale) / 2;
    return `translate(${left}px, ${top}px) scale(${scale})`;
  }

  // 顺时针转 90 度：舞台的长边沿着屏幕竖直方向。
  const tx = (w + STAGE_H * scale) / 2;
  const ty = (h - STAGE_W * scale) / 2;
  return `translate(${tx}px, ${ty}px) rotate(90deg) scale(${scale})`;
};

// ---------- 手牌扇形布局 ----------
const handCardStyle = (index, count, selected, playable) => {
  const mid = (count - 1) / 2;
  const off = index - mid;
  const gap = count > 1 ? Math.min(52, 560 / (count - 1)) : 0;
  const rotStep = Math.min(4.2, 40 / Math.max(count - 1, 1));
  const drop = count > 10 ? 0.5 : 1.2;
  const lift = selected ? -62 : playable ? -24 : 0;
  const y = selected ? lift : off * off * drop + lift;
  const rot = selected ? 0 : off * rotStep;

  return {
    left: `${STAGE_W / 2 - 33 + off * gap}px`,
    transform: `translateY(${y}px) rotate(${rot}deg)`,
    zIndex: selected ? 50 : index,
  };
};

// ---------- 对手面板 ----------
const OpponentPanel = ({ seat, side, character, count, active, bubble, canCatch, onCatch }) => (
  <div className={`uno-opp uno-opp--${side} ${active ? 'uno-opp--on' : ''}`}>
    {bubble && (
      <div className="uno-bubble" key={bubble.key}>
        {bubble.text}
      </div>
    )}
    <AvatarBubble character={character} className="uno-avatar" />
    <div className="uno-opp-name">{character.name}</div>
    <span className={`uno-count ${count <= 2 ? 'uno-count--warn' : ''}`}>{count} 张</span>
    <div className="uno-mini" aria-hidden="true">
      {Array.from({ length: Math.min(count, 9) }).map((_, i) => (
        <UnoCard key={i} back className="uno-card--mini" />
      ))}
    </div>
    {canCatch && (
      <button type="button" className="uno-catch" onClick={onCatch}>
        抓 UNO
      </button>
    )}
  </div>
);

// ---------- 对局 ----------
const UnoMatch = ({ characters, onExitToHall, onBackToPicker }) => {
  const m = useUnoMatch({ characters });
  const { game } = m;
  const viewport = useViewport();

  const [overviewOpen, setOverviewOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  useEffect(() => {
    m.startMatch();
    // 尝试锁定横屏；大多数浏览器标签页里会被拒绝，忽略即可。
    try {
      const lock = window.screen?.orientation?.lock?.('landscape');
      if (lock && lock.catch) lock.catch(() => {});
    } catch (err) {
      // 不支持就算了
    }
    return () => {
      try {
        window.screen?.orientation?.unlock?.();
      } catch (err) {
        // 同上
      }
    };
    // 只在挂载时开局一次；“再来一局”走 m.startMatch。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hand = useMemo(
    () => (game ? sortHandForDisplay(game.players[0].hand) : []),
    [game]
  );

  if (!game) return <div className="uno-root" />;

  const top = getTopCard(game);
  const selectedCard = hand.find((c) => c.id === m.selectedId) || null;
  const ended = game.status === 'ended';
  const seconds = Math.ceil(m.remainingMs / 1000);
  const currentSeat = game.currentIndex;

  const reasonFor = (card) => {
    if (!m.isMyTurn) return { ok: false, text: '还没轮到你' };
    if (game.drawnCardId && game.drawnCardId !== card.id) {
      return { ok: false, text: '这一手只能出刚抽到的那张牌' };
    }
    if (isWild(card)) return { ok: true, text: '可以出：万能牌任何时候都能出' };
    if (card.color === game.currentColor) return { ok: true, text: '可以出：颜色和当前颜色相同' };
    if (card.value === top.value) return { ok: true, text: '可以出：和弃牌堆的牌面相同' };
    return {
      ok: false,
      text: `现在不能出：当前颜色是${COLOR_ZH[game.currentColor]}，弃牌堆是${cardName(top)}`,
    };
  };

  const reason = selectedCard ? reasonFor(selectedCard) : null;

  const statusText =
    m.notice ||
    (ended
      ? ''
      : m.isMyTurn
        ? game.drawnCardId
          ? '抽到的牌可以出，也可以选择过'
          : '轮到你出牌，点一张牌看详情'
        : `${m.nameOf(currentSeat)}正在想……`);

  const pickFromOverview = (id) => {
    setOverviewOpen(false);
    if (m.selectedId !== id) m.selectCard(id);
  };

  const requestExit = () => {
    if (ended) onBackToPicker();
    else setExitConfirmOpen(true);
  };

  const groups = [...COLORS, null].map((color) => ({
    color,
    cards: hand.filter((c) => (color ? c.color === color : !c.color)),
  }));

  const winner = m.standings[0];
  const userWon = winner && winner.index === 0;

  return (
    <div className="uno-root">
      <div
        className="uno-stage"
        style={{ width: STAGE_W, height: STAGE_H, transform: stageTransform(viewport) }}
      >
        <div className="uno-table" />

        <button type="button" className="uno-roundbtn uno-back" aria-label="退出" onClick={requestExit}>
          <BackIcon />
        </button>
        <button type="button" className="uno-handbtn" onClick={() => setOverviewOpen(true)}>
          手牌 {hand.length}
        </button>

        {!ended && (
          <>
            <div className={`uno-turn ${m.isMyTurn && seconds <= 5 ? 'uno-turn--hurry' : ''}`}>
              {m.isMyTurn ? `轮到你了  ${seconds}` : `${m.nameOf(currentSeat)}的回合`}
            </div>
            {m.isMyTurn && (
              <div className="uno-timer" aria-hidden="true">
                <div
                  className="uno-timer-fill"
                  style={{ width: `${Math.max(0, (m.remainingMs / TURN_TIME_LIMIT_MS) * 100)}%` }}
                />
              </div>
            )}
          </>
        )}
        <div className="uno-dir">{game.direction === 1 ? '顺时针' : '逆时针'}</div>

        <OpponentPanel
          seat={1}
          side="l"
          character={characters[0]}
          count={game.players[1].hand.length}
          active={currentSeat === 1 && !ended}
          bubble={m.bubbles[1]}
          canCatch={game.unoVulnerable === 1 && !ended}
          onCatch={m.catchOpponent}
        />
        <OpponentPanel
          seat={2}
          side="r"
          character={characters[1]}
          count={game.players[2].hand.length}
          active={currentSeat === 2 && !ended}
          bubble={m.bubbles[2]}
          canCatch={game.unoVulnerable === 2 && !ended}
          onCatch={m.catchOpponent}
        />

        <div className="uno-center">
          <div className="uno-pile uno-pile--draw">
            <UnoCard back className="uno-card--big" />
            <div className="uno-pile-tag">牌堆 {game.drawPile.length}</div>
          </div>
          <div className="uno-pile uno-pile--discard">
            <div className="uno-halo" style={{ background: `radial-gradient(circle, ${HALO[game.currentColor]}, transparent 68%)` }} />
            <UnoCard card={top} className="uno-card--big" />
            <div className="uno-pile-tag">弃牌堆</div>
          </div>
        </div>
        <div className="uno-colorchip">
          <i style={{ background: CHIP[game.currentColor] }} />
          当前颜色 {COLOR_ZH[game.currentColor]}
        </div>
        {statusText && <div className="uno-notice">{statusText}</div>}

        {m.flash && (
          <div className="uno-flash" key={m.flash.key}>
            <UnoCard card={m.flash.card} className="uno-card--big" />
            <span>
              {m.flash.who}打出了 {cardName(m.flash.card)}
            </span>
          </div>
        )}

        <div className="uno-hand">
          {hand.map((card, i) => {
            const playable = m.playableIds.has(card.id) && m.isMyTurn;
            const selected = card.id === m.selectedId;
            return (
              <UnoCard
                key={card.id}
                card={card}
                className="uno-card--hand"
                style={handCardStyle(i, hand.length, selected, playable)}
                selected={selected}
                dimmed={!playable && !selected}
                onClick={() => m.selectCard(card.id)}
              />
            );
          })}
        </div>

        <button
          type="button"
          className="uno-round uno-round--draw"
          disabled={!m.isMyTurn || !!game.drawnCardId}
          onClick={m.draw}
        >
          抽
          <br />牌
        </button>
        <button
          type="button"
          className={`uno-round uno-round--uno ${
            game.unoVulnerable === 0 ? 'uno-round--pulse' : ''
          } ${m.unoArmed ? 'uno-round--armed' : ''}`}
          disabled={ended}
          onClick={m.pressUno}
        >
          {m.unoArmed ? '已喊' : 'UNO'}
        </button>

        {selectedCard && !ended && (
          <div className="uno-detail">
            <div className="uno-detail-pic">
              <UnoCard card={selectedCard} className="uno-card--detail" />
            </div>
            <div className="uno-detail-txt">
              <h4>{cardName(selectedCard)}</h4>
              <div className="uno-detail-eff">{cardEffect(selectedCard)}</div>
              <span className={`uno-can ${reason.ok ? 'uno-can--yes' : 'uno-can--no'}`}>
                {reason.text}
              </span>
              <div className="uno-detail-acts">
                <button type="button" className="uno-pill" disabled={!reason.ok} onClick={m.playSelected}>
                  出牌
                </button>
                {game.drawnCardId && m.isMyTurn && (
                  <button type="button" className="uno-pill uno-pill--ghost" onClick={m.pass}>
                    不出，过
                  </button>
                )}
                <button type="button" className="uno-pill uno-pill--ghost" onClick={m.clearSelection}>
                  收起
                </button>
              </div>
            </div>
          </div>
        )}

        {m.wildPendingId && (
          <div className="uno-ov uno-ov--show">
            <div className="uno-sheet">
              <h3>下一轮要什么颜色</h3>
              <p>万能牌不看颜色，选你手里最多的那种。</p>
              <div className="uno-colors">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`uno-colorbtn uno-colorbtn--${color}`}
                    onClick={() => m.chooseWildColor(color)}
                  >
                    {COLOR_ZH[color]}
                  </button>
                ))}
              </div>
              <button type="button" className="uno-pill uno-pill--ghost uno-pill--below" onClick={m.cancelWild}>
                再想想
              </button>
            </div>
          </div>
        )}

        {overviewOpen && (
          <div className="uno-ov uno-ov--show" onClick={() => setOverviewOpen(false)}>
            <div className="uno-sheet uno-sheet--grid" onClick={(e) => e.stopPropagation()}>
              <h3>全部手牌（点一张查看详情）</h3>
              {groups
                .filter((g) => g.cards.length > 0)
                .map((g) => (
                  <div className="uno-grow" key={g.color || 'wild'}>
                    <div className="uno-grow-label">
                      {g.color ? COLOR_ZH[g.color] : '万能'} {g.cards.length}
                    </div>
                    <div className="uno-grow-cards">
                      {g.cards.map((card) => (
                        <UnoCard
                          key={card.id}
                          card={card}
                          className="uno-card--grid"
                          dimmed={!(m.playableIds.has(card.id) && m.isMyTurn)}
                          onClick={() => pickFromOverview(card.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {exitConfirmOpen && (
          <div className="uno-ov uno-ov--show">
            <div className="uno-sheet">
              <h3>要放弃这一局吗</h3>
              <p>对局不会保存，退出就当没打。</p>
              <div className="uno-acts-row">
                <button type="button" className="uno-pill" onClick={() => setExitConfirmOpen(false)}>
                  继续玩
                </button>
                <button type="button" className="uno-pill uno-pill--ghost" onClick={onBackToPicker}>
                  放弃退出
                </button>
              </div>
            </div>
          </div>
        )}

        {ended && m.showResult && (
          <div className="uno-ov uno-ov--show">
            <div className="uno-sheet uno-sheet--result">
              <div className="uno-result-left">
                <h3>{userWon ? '你赢了' : `${m.nameOf(winner.index)}赢了`}</h3>
                <p>
                  用时 {formatDuration(m.durationMs)}，共 {game.turnCount} 回合
                </p>
                <div className="uno-rank">
                  {m.standings.map((s) => (
                    <div key={s.index} className={s.rank === 1 ? 'uno-rank-first' : ''}>
                      <span>
                        {s.rank}. {m.nameOf(s.index)}
                      </span>
                      <span>{s.remaining} 张</span>
                    </div>
                  ))}
                </div>
                {m.stats && (
                  <p className="uno-stats">
                    最近 {m.stats.total} 局：你赢了 {m.stats.wins} 局
                  </p>
                )}
              </div>
              <div className="uno-result-right">
                <h4>这一局的几个瞬间</h4>
                <ul className="uno-log">
                  {(m.momentLines.length > 0 ? m.momentLines : ['这一局很安静，没有特别的事发生']).map(
                    (line, i) => (
                      <li key={i}>{line}</li>
                    )
                  )}
                </ul>
                <p className="uno-saved">这一局的结果已经让TA们知道了，下次聊天可能会提起。</p>
                <div className="uno-acts-row">
                  <button type="button" className="uno-pill" onClick={m.startMatch}>
                    再来一局
                  </button>
                  <button type="button" className="uno-pill uno-pill--ghost" onClick={onBackToPicker}>
                    换同桌
                  </button>
                  <button type="button" className="uno-pill uno-pill--ghost" onClick={onExitToHall}>
                    回大厅
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- 选同桌 ----------
const UnoGame = ({ onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickedIds, setPickedIds] = useState([]);
  const [table, setTable] = useState(null); // 选定的两位角色（数组），null = 还在选

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

  if (table) {
    return (
      <UnoMatch
        characters={table}
        onExitToHall={onExitToHall}
        onBackToPicker={() => setTable(null)}
      />
    );
  }

  const startDisabled = pickedIds.length !== 2;

  return (
    <div className="tgh-ttt-screen">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="tgh-ttt-picker-head">
        <h2>请两位同桌</h2>
        <p>Three at the table</p>
      </div>

      {loading && <p className="tgh-ttt-empty">正在加载角色列表……</p>}

      {!loading && characters.length < 2 && (
        <p className="tgh-ttt-empty">UNO 需要两位角色同桌，先去创建至少两个角色吧。</p>
      )}

      {!loading && characters.length >= 2 && (
        <>
          <div className="tgh-ttt-picker-grid">
            {characters.map((character) => {
              const picked = pickedIds.includes(character.id);
              return (
                <button
                  key={character.id}
                  type="button"
                  className={`tgh-ttt-picker-item ${picked ? 'uno-picked' : ''}`}
                  onClick={() => togglePick(character.id)}
                >
                  <AvatarBubble character={character} className="tgh-ttt-picker-avatar" />
                  <span className="tgh-ttt-picker-name">{character.name}</span>
                </button>
              );
            })}
          </div>

          <p className="uno-picker-hint">
            已选 {pickedIds.length} / 2。横屏对局，竖着拿手机也会自动转过来。
          </p>

          <div className="tgh-ttt-actions">
            <button
              type="button"
              className="tgh-ttt-btn tgh-ttt-btn-primary"
              disabled={startDisabled}
              onClick={() =>
                setTable(pickedIds.map((id) => characters.find((c) => c.id === id)))
              }
            >
              开局
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UnoGame;