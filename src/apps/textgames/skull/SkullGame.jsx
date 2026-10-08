// src/apps/textgames/skull/SkullGame.jsx
//
// 骷髅牌对局界面，从文字游戏大厅内部切换进来（跟 UNO 同一个接法，见
// TextGameHallApp.jsx 的 GAME_COMPONENTS，没有另外注册成顶层 app）。
// 流程：选 1 到 3 位同桌角色（不足的位置自动补 NPC，凑满 4 人桌）-> 对局
// -> 结算（存档和发聊天消息由 useSkullMatch / skullService 处理）。
//
// 对局画面是竖向的舞台：三位对手在上、中间是宣告圈、自己在下。这个界面
// 只负责渲染和转发点击，所有时序、台词、音效都在 useSkullMatch.js 里。

import React, { useEffect, useMemo, useState } from 'react';

import SkullCard, { SkullPile } from './SkullCard';
import { useSkullMatch } from './useSkullMatch';
import { PHASE, TURN_TIME_LIMIT_MS, WINS_TO_WIN, cardsLeft } from './skullEngine';
import { buildTablePlayers, formatDuration } from './skullMatchFormat';
import { listCharactersForPicker } from './skullService';
import { ensureSkullLinesForTable } from './skullLinesService';
import './skull.css';

const MAX_CHARACTERS = 3;
const CARDS_PER_PLAYER = 4;

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

const SoundIcon = () => (
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
    <path d="M11 5L6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
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

const Shards = ({ wins, className = 'skull-shards' }) => (
  <div className={className} aria-label={`${wins} 枚胜利印记`}>
    {Array.from({ length: WINS_TO_WIN }).map((_, i) => (
      <i
        key={i}
        className={className === 'skull-shards' ? `skull-shard ${i < wins ? 'skull-shard--on' : ''}` : i < wins ? 'on' : ''}
      />
    ))}
  </div>
);

// ---------- 对手席位 ----------
const SeatPanel = ({ seat, player, game, bubble, bid, active, pickable, onPick }) => {
  const p = game.players[seat];
  const owned = cardsLeft(game, seat);

  let chip = null;
  if (p.eliminated) chip = { kind: 'pass', text: '淘汰' };
  else if (pickable) chip = { kind: 'pick', text: '点这里翻' };
  else if (bid) chip = bid;

  const classes = [
    'skull-seat',
    active ? 'skull-seat--on' : '',
    p.eliminated ? 'skull-seat--out' : '',
    pickable ? 'skull-seat--pick' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      disabled={!pickable}
      onClick={() => pickable && onPick(seat)}
      aria-label={pickable ? `翻开${player.name}的牌` : player.name}
    >
      {bubble && (
        <div className="skull-bubble" key={bubble.key}>
          {bubble.text}
        </div>
      )}
      <AvatarBubble character={player} className="skull-avatar" />
      <div className="skull-name">{player.name}</div>
      <div className="skull-meta">
        <div className="skull-pips" aria-label={`剩 ${owned} 张牌`}>
          {Array.from({ length: CARDS_PER_PLAYER }).map((_, i) => (
            <i key={i} className={`skull-pip ${i < owned ? 'skull-pip--on' : ''}`} />
          ))}
        </div>
        <Shards wins={p.wins} className="skull-mini-shards" />
      </div>
      <SkullPile cards={p.stack} flipped={game.flipped[seat] || 0} />
      <span className={`skull-chip ${chip ? `skull-chip--${chip.kind}` : 'skull-chip--blank'}`}>
        {chip ? chip.text : '-'}
      </span>
    </button>
  );
};

// ---------- 对局 ----------
const SkullMatch = ({ table, onExitToHall, onBackToPicker }) => {
  const m = useSkullMatch({ table });
  const { game, legal } = m;

  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    m.startMatch();
    // 只在挂载时开局一次；“再来一局”走 m.startMatch。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 翻到骷髅时整个舞台抖一下。
  useEffect(() => {
    if (!m.shakeKey) return undefined;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 500);
    return () => clearTimeout(timer);
  }, [m.shakeKey]);

  // 手牌按 id 排序，位置稳定（蔷薇在前、骷髅在后）。
  const hand = useMemo(
    () => (game ? game.players[0].hand.slice().sort((a, b) => a.id.localeCompare(b.id)) : []),
    [game]
  );

  if (!game) return <div className="skull-root" />;

  const me = game.players[0];
  const ended = game.status === 'ended';
  const flipTargets = legal?.flipTargets || [];
  const placing = m.isMyTurn && (game.phase === PHASE.PLACING || game.phase === PHASE.ADDING);
  const canPlaceSelected = !!legal && !!m.selectedId && legal.canPlace.includes(m.selectedId);
  const seconds = Math.ceil(m.remainingMs / 1000);
  const herald = m.herald;

  const requestExit = () => {
    if (ended) onBackToPicker();
    else setExitConfirmOpen(true);
  };

  const discardChoices =
    m.isMyTurn && game.phase === PHASE.DISCARDING
      ? [
          ...hand.map((c) => ({ ...c, where: '手牌' })),
          ...me.stack.map((c) => ({ ...c, where: '桌上' })),
        ]
      : [];

  const winner = m.standings[0];
  const userWon = !!winner && winner.index === 0;

  return (
    <div className="skull-root">
      <div className={`skull-stage ${shaking ? 'skull-stage--shake' : ''}`}>
        {/* 顶栏 */}
        <div className="skull-top">
          <div className="skull-top-left">
            <button type="button" className="skull-roundbtn" aria-label="退出" onClick={requestExit}>
              <BackIcon />
            </button>
            <button
              type="button"
              className={`skull-roundbtn ${m.soundOn ? '' : 'skull-roundbtn--off'}`}
              aria-label={m.soundOn ? '关闭音效' : '打开音效'}
              onClick={m.toggleSound}
            >
              <SoundIcon />
            </button>
          </div>
          <div className="skull-title">
            <b>骷髅牌</b>
            <i>Skull</i>
          </div>
          <div className="skull-top-right">
            <Shards wins={me.wins} />
          </div>
        </div>

        {/* 三位对手 */}
        <div className="skull-seats">
          {[1, 2, 3].map((seat) => (
            <SeatPanel
              key={seat}
              seat={seat}
              player={table[seat]}
              game={game}
              bubble={m.bubbles[seat]}
              bid={m.seatBids[seat]}
              active={!ended && game.phase !== PHASE.ROUND_OVER && game.currentIndex === seat}
              pickable={m.isMyTurn && flipTargets.includes(seat)}
              onPick={m.flipTarget}
            />
          ))}
        </div>

        {/* 中央宣告圈 */}
        {herald && (
          <div className={`skull-herald ${herald.kind ? `skull-herald--${herald.kind}` : ''}`}>
            <div className="skull-h-phase">
              {herald.phase}
              {herald.timer && m.isMyTurn ? `（${seconds} 秒）` : ''}
            </div>
            <div className="skull-h-title">{herald.title}</div>
            {herald.bid && (
              <div className="skull-h-bid">
                <b>{herald.bid[0]}</b>
                <span>{herald.bid[1]}</span>
              </div>
            )}
            {herald.progress && (
              <div className="skull-progress" aria-hidden="true">
                {herald.progress.map((p, i) => (
                  <i key={i} className={p === 1 ? 'on' : p === 'bad' ? 'bad' : ''} />
                ))}
              </div>
            )}
            {herald.desc && <div className="skull-h-desc">{herald.desc}</div>}
            {herald.timer && m.isMyTurn && (
              <div className={`skull-timer ${seconds <= 5 ? 'skull-timer--hurry' : ''}`} aria-hidden="true">
                <i style={{ width: `${Math.max(0, (m.remainingMs / TURN_TIME_LIMIT_MS) * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {/* 自己的区域 */}
        <div className="skull-me">
          <div className="skull-me-label">
            <b>你的牌堆</b>
            <span>
              {me.eliminated
                ? '你的牌用光了，只能看TA们打完'
                : `桌上 ${me.stack.length} 张，手里 ${me.hand.length} 张`}
            </span>
          </div>

          <div className="skull-me-field">
            <div className={`skull-me-board ${flipTargets.includes(0) ? 'skull-me-board--pick' : ''}`}>
              <SkullPile
                cards={me.stack}
                flipped={game.flipped[0] || 0}
                mine
                glow={flipTargets.includes(0)}
                onClick={flipTargets.includes(0) ? () => m.flipTarget(0) : undefined}
              />
              {flipTargets.includes(0) && <small>点一下翻开</small>}
            </div>

            <div className={`skull-rack ${placing ? '' : 'skull-rack--locked'}`}>
              {Array.from({ length: CARDS_PER_PLAYER }).map((_, i) => {
                const card = hand[i];
                if (!card) {
                  return (
                    <div className="skull-slot skull-slot--gone" key={`empty-${i}`}>
                      <SkullCard kind="rose" faceUp={false} className="skull-tile--flat" />
                    </div>
                  );
                }
                return (
                  <div className="skull-slot" key={card.id}>
                    <SkullCard
                      flat
                      kind={card.kind}
                      selected={card.id === m.selectedId}
                      onClick={placing ? () => m.selectCard(card.id) : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 操作区 */}
          <div className="skull-dock">
            {m.isMyTurn && (game.phase === PHASE.PLACING || game.phase === PHASE.ADDING) && (
              <button
                type="button"
                className="skull-btn"
                disabled={!canPlaceSelected}
                onClick={m.confirmPlace}
              >
                扣下选中的牌
              </button>
            )}

            {m.isMyTurn && game.phase === PHASE.ADDING && legal && (
              <>
                <div className="skull-stepper">
                  <button type="button" aria-label="减少" disabled={m.bidValue <= legal.minBid} onClick={() => m.adjustBid(-1)}>
                    -
                  </button>
                  <b>{m.bidValue}</b>
                  <button type="button" aria-label="增加" disabled={m.bidValue >= legal.maxBid} onClick={() => m.adjustBid(1)}>
                    +
                  </button>
                </div>
                <button type="button" className="skull-btn skull-btn--ghost" onClick={m.confirmBid}>
                  叫数
                </button>
              </>
            )}

            {m.isMyTurn && game.phase === PHASE.BIDDING && legal && (
              <>
                {legal.canRaise && (
                  <>
                    <div className="skull-stepper">
                      <button type="button" aria-label="减少" disabled={m.bidValue <= legal.minBid} onClick={() => m.adjustBid(-1)}>
                        -
                      </button>
                      <b>{m.bidValue}</b>
                      <button type="button" aria-label="增加" disabled={m.bidValue >= legal.maxBid} onClick={() => m.adjustBid(1)}>
                        +
                      </button>
                    </div>
                    <button type="button" className="skull-btn" onClick={m.confirmBid}>
                      加价到 {m.bidValue}
                    </button>
                  </>
                )}
                <button type="button" className="skull-btn skull-btn--ghost" onClick={m.pass}>
                  弃权
                </button>
              </>
            )}

            {!ended && game.phase === PHASE.ROUND_OVER && (
              <button type="button" className="skull-btn skull-btn--ghost" onClick={m.skipRoundWait}>
                继续
              </button>
            )}
          </div>

          <div className="skull-hint">{m.notice}</div>
        </div>

        {/* 翻到自己的骷髅：选一张牌弃掉 */}
        {discardChoices.length > 0 && (
          <div className="skull-veil">
            <div className="skull-plaque">
              <h3>选一张牌弃掉</h3>
              <p>你翻到了自己的骷髅，要永久弃掉一张牌。手牌和桌上的牌都可以选。</p>
              <div className="skull-choices">
                {discardChoices.map((card) => (
                  <div className="skull-choice" key={card.id}>
                    <SkullCard
                      flat
                      kind={card.kind}
                      selected={card.id === m.selectedId}
                      onClick={() => m.selectCard(card.id)}
                    />
                    <small>{card.where}</small>
                  </div>
                ))}
              </div>
              <div className="skull-dock">
                <button
                  type="button"
                  className="skull-btn"
                  disabled={!m.selectedId}
                  onClick={() => m.discardCard(m.selectedId)}
                >
                  弃掉这张
                </button>
              </div>
              <div className="skull-hint">还剩 {seconds} 秒，超时会随机弃一张</div>
            </div>
          </div>
        )}

        {exitConfirmOpen && (
          <div className="skull-veil">
            <div className="skull-plaque">
              <h3>要放弃这一局吗</h3>
              <p>对局不会保存，退出就当没打。</p>
              <div className="skull-dock">
                <button type="button" className="skull-btn" onClick={() => setExitConfirmOpen(false)}>
                  继续玩
                </button>
                <button type="button" className="skull-btn skull-btn--ghost" onClick={onBackToPicker}>
                  放弃退出
                </button>
              </div>
            </div>
          </div>
        )}

        {ended && m.showResult && (
          <div className="skull-veil">
            <div className="skull-plaque">
              <h3>{userWon ? '你赢了' : `${m.nameOf(winner.index)}赢了`}</h3>
              <p>
                {game.endedBy === 'wins'
                  ? '集齐了两枚胜利印记'
                  : '是最后留在桌上的人'}
                ，共 {game.round} 轮，用时 {formatDuration(m.durationMs)}
              </p>

              <div className="skull-rank">
                {m.standings.map((s) => (
                  <div key={s.index}>
                    <span>
                      {s.rank}. {m.nameOf(s.index)}
                    </span>
                    <span>
                      {s.wins} 枚印记，{s.eliminated ? '淘汰' : `剩 ${s.cards} 张`}
                    </span>
                  </div>
                ))}
              </div>

              {m.stats && (
                <p>
                  最近 {m.stats.total} 局：你赢了 {m.stats.wins} 局
                </p>
              )}

              <h4 className="skull-log-title">这一局的几个瞬间</h4>
              <ul className="skull-log">
                {(m.momentLines.length > 0 ? m.momentLines : ['这一局很安静，没有特别的事发生']).map(
                  (line, i) => (
                    <li key={i}>{line}</li>
                  )
                )}
              </ul>

              <p>这一局的结果已经让TA们知道了，下次聊天可能会提起。</p>

              <div className="skull-dock">
                <button type="button" className="skull-btn" onClick={m.startMatch}>
                  再来一局
                </button>
                <button type="button" className="skull-btn skull-btn--ghost" onClick={onBackToPicker}>
                  换同桌
                </button>
                <button type="button" className="skull-btn skull-btn--ghost" onClick={onExitToHall}>
                  回大厅
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- 选同桌 ----------
const SkullGame = ({ onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickedIds, setPickedIds] = useState([]);
  const [table, setTable] = useState(null); // 选定后的座位（4 个，含用户和 NPC），null = 还在选
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
      if (cur.length >= MAX_CHARACTERS) return [...cur.slice(1), id];
      return [...cur, id];
    });
  };

  if (table) {
    return (
      <SkullMatch
        table={table}
        onExitToHall={onExitToHall}
        onBackToPicker={() => setTable(null)}
      />
    );
  }

  const startDisabled = pickedIds.length < 1;
  const npcCount = MAX_CHARACTERS - pickedIds.length;

  return (
    <div className="tgh-ttt-screen">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="tgh-ttt-picker-head">
        <h2>请同桌的人</h2>
        <p>Four at the table</p>
      </div>

      {loading && <p className="tgh-ttt-empty">正在加载角色列表……</p>}

      {!loading && characters.length < 1 && (
        <p className="tgh-ttt-empty">骷髅牌至少需要一位角色同桌，先去创建一个角色吧。</p>
      )}

      {!loading && characters.length >= 1 && (
        <>
          <div className="tgh-ttt-picker-grid">
            {characters.map((character) => {
              const picked = pickedIds.includes(character.id);
              return (
                <button
                  key={character.id}
                  type="button"
                  className={`tgh-ttt-picker-item ${picked ? 'skull-picked' : ''}`}
                  onClick={() => togglePick(character.id)}
                >
                  <AvatarBubble character={character} className="tgh-ttt-picker-avatar" />
                  <span className="tgh-ttt-picker-name">{character.name}</span>
                </button>
              );
            })}
          </div>

          <p className="skull-picker-hint">
            已选 {pickedIds.length} / {MAX_CHARACTERS}。四人一桌，空位由电脑玩家补上
            {pickedIds.length > 0 ? `（这局补 ${npcCount} 位）` : ''}。
            <br />
            竖着拿手机就能玩。
          </p>

          <div className="tgh-ttt-actions">
            <button
              type="button"
              className="tgh-ttt-btn tgh-ttt-btn-primary"
              disabled={startDisabled || preparing}
              onClick={async () => {
                const picked = pickedIds.map((id) => characters.find((c) => c.id === id));
                setPreparing(true);
                try {
                  // 第一次和某个角色玩时生成专属台词并缓存；失败就用通用台词。
                  setTable(buildTablePlayers(await ensureSkullLinesForTable(picked)));
                } catch (err) {
                  setTable(buildTablePlayers(picked));
                } finally {
                  setPreparing(false);
                }
              }}
            >
              {preparing ? '正在准备台词……' : '开局'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SkullGame;