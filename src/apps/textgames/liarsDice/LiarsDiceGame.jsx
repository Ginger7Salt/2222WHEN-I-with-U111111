// src/apps/textgames/liarsDice/LiarsDiceGame.jsx
//
// 吹牛骰子对局界面，从文字游戏大厅内部切换进来（跟 UNO / 德州扑克同一个
// 接入方式，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 流程：选同桌角色（0 到 3 位，不够的由虚拟 NPC 补满）-> 选买入金额（从
// 全局虚拟筹码池里下注多少）-> 对局（连打很多轮，每轮质疑开骰后停在摊牌
// 状态，用户点“下一轮”才继续）-> 结算页（赢/输了多少筹码，同时把结果回传
// 给真角色各自的聊天）。规则引擎、角色策略、台词、时序都在 liarsDice/ 目录
// 下的其它文件里，这个组件只管渲染和转发点击，时序交给
// useLiarsDiceMatch.js。
//
// 视觉：白昼哥特——象牙白底、香槟金描边、朱砂红的 1 点（百搭）。选角色和
// 买入两页复用 textGameShared.css 的通用样式。

import React, { useEffect, useState } from 'react';

import { listCharactersForPicker } from '../textGameSharedService';
import { COMP_TOPUP_TO, MIN_PLAYABLE_CHIPS, ensureMinimumChips } from '../texas/texasChipsService';
import { SEAT_COUNT, TURN_TIME_LIMIT_MS, getTotalDice } from './liarsDiceEngine';
import { formatDuration } from './liarsDiceMatchFormat';
import { TABLE_CHARACTER_COUNT } from './liarsDiceNpcs';
import { useLiarsDiceMatch } from './useLiarsDiceMatch';
import { AltarDie, HandDice } from './Dice3D';
import ShakeOverlay from './ShakeOverlay';
import RevealOverlay from './RevealOverlay';
import { OutOverlay, WinOverlay } from './EndOverlays';
import '../textGameShared.css';
import './liarsDice.css';
import './liarsDiceFx.css';

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

// ---------- 骰子 ----------
// 点阵坐标：[cx, cy, r]。1 点用朱砂红，提醒它是百搭。
const PIPS = {
  1: [[50, 50, 14]],
  2: [[30, 30, 9], [70, 70, 9]],
  3: [[28, 28, 9], [50, 50, 9], [72, 72, 9]],
  4: [[30, 30, 9], [70, 30, 9], [30, 70, 9], [70, 70, 9]],
  5: [[28, 28, 9], [72, 28, 9], [50, 50, 9], [28, 72, 9], [72, 72, 9]],
  6: [[30, 24, 8], [70, 24, 8], [30, 50, 8], [70, 50, 8], [30, 76, 8], [70, 76, 8]],
};

const DieFace = ({ value }) => (
  <svg className="tld-die-svg" viewBox="0 0 100 100" aria-hidden="true">
    {PIPS[value].map(([cx, cy, r], i) => (
      <circle key={i} cx={cx} cy={cy} r={r} className={value === 1 ? 'tld-pip tld-pip-wild' : 'tld-pip'} />
    ))}
  </svg>
);

const Die = ({ value, size = 'md', hit = false }) => (
  <div className={`tld-die tld-die-${size} ${hit ? 'tld-die-hit' : ''}`}>
    <DieFace value={value} />
  </div>
);

// 加码时某个点数最少要叫多少个的一句话说明（新手不用记规则）。
const describeMinimum = (bid, face, min) => {
  if (min === null) return '开局不能叫 1 点';
  if (!bid) return `开局至少叫 ${min} 个`;
  if (face === 1 && bid.face !== 1) return `换叫 1 点：数量可以折半（向上取整），至少 ${min} 个`;
  if (face !== 1 && bid.face === 1) return `从 1 点换回其他点数：数量要翻倍再加 1，至少 ${min} 个`;
  return `叫 ${face} 点至少要 ${min} 个`;
};

// ---------- 选同桌 ----------
const CharacterPicker = ({ onPicked, onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickedIds, setPickedIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCharactersForPicker();
        if (!cancelled) setCharacters(list);
      } catch (err) {
        console.warn('[LiarsDice] 读取角色列表失败', err);
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
      if (cur.length >= TABLE_CHARACTER_COUNT) return [...cur.slice(1), id];
      return [...cur, id];
    });
  };

  const npcCount = TABLE_CHARACTER_COUNT - pickedIds.length;

  return (
    <div className="tgh-shared-screen tld-screen">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="tgh-shared-picker-head">
        <h2>请同桌的人</h2>
        <p>Four at the table</p>
      </div>

      {loading && <p className="tgh-shared-empty">正在加载角色列表……</p>}
      {!loading && characters.length === 0 && (
        <p className="tgh-shared-empty">还没有创建角色，三个座位会全部由虚拟客人坐满。</p>
      )}

      {!loading && characters.length > 0 && (
        <div className="tgh-shared-picker-grid">
          {characters.map((character) => {
            const picked = pickedIds.includes(character.id);
            return (
              <button
                key={character.id}
                type="button"
                className={`tgh-shared-picker-item ${picked ? 'tld-picked' : ''}`}
                onClick={() => togglePick(character.id)}
              >
                <AvatarBubble character={character} className="tgh-shared-picker-avatar" />
                <span className="tgh-shared-picker-name">{character.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && (
        <>
          <p className="tld-picker-hint">
            已选 {pickedIds.length} / {TABLE_CHARACTER_COUNT}
            {npcCount > 0 ? `，不够的 ${npcCount} 个座位由虚拟客人补上` : ''}
          </p>

          <div className="tgh-shared-actions">
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              onClick={() => onPicked(pickedIds.map((id) => characters.find((c) => c.id === id)).filter(Boolean))}
            >
              下一步：选下注
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ---------- 选下注 ----------
const BuyInScreen = ({ onConfirm, onBack }) => {
  const [balance, setBalance] = useState(null);
  const [text, setText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const topped = await ensureMinimumChips();
      if (!cancelled) {
        setBalance(topped);
        setText(String(Math.min(topped, Math.max(MIN_PLAYABLE_CHIPS, Math.round(topped * 0.1)))));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (balance === null) {
    return (
      <div className="tgh-shared-screen tld-screen">
        <p className="tgh-shared-empty">正在查筹码……</p>
      </div>
    );
  }

  const clampAmount = (v) => Math.min(balance, Math.max(MIN_PLAYABLE_CHIPS, Math.round(Number(v) || 0)));
  const amount = clampAmount(text);
  const pot = amount * SEAT_COUNT;
  const presets = Array.from(
    new Set([0.1, 0.25, 0.5].map((ratio) => clampAmount(balance * ratio)))
  );

  return (
    <div className="tgh-shared-screen tld-screen">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onBack}>
        <BackIcon />
      </button>

      <div className="tgh-shared-picker-head">
        <h2>下多少注</h2>
        <p>Stake from your chip pool</p>
      </div>

      <div className="tld-balance-card">
        <span className="tld-balance-label">筹码池余额</span>
        <span className="tld-balance-num">{balance}</span>
        {balance === COMP_TOPUP_TO && (
          <span className="tld-balance-note">余额太少，大厅给你补了点本金</span>
        )}
      </div>

      <div className="tgh-shared-actions">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            className={`tgh-shared-btn ${amount === p ? 'tgh-shared-btn-primary' : ''}`}
            onClick={() => setText(String(p))}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="tgh-shared-field">
        <label>自定义下注（最少 {MIN_PLAYABLE_CHIPS}）</label>
        <div className="tgh-shared-input-row">
          <input
            type="number"
            className="tgh-shared-input"
            value={text}
            min={MIN_PLAYABLE_CHIPS}
            max={balance}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setText(String(amount))}
          />
        </div>
      </div>

      <p className="tld-stake-hint">
        四个人各下同样的注，底池是 {pot}。只剩一人有骰子时，赢家拿走整个底池：
        你赢了净赚 {pot - amount}，输了亏掉 {amount}。
      </p>

      <div className="tgh-shared-actions">
        <button
          type="button"
          className="tgh-shared-btn tgh-shared-btn-primary"
          onClick={() => onConfirm(amount)}
        >
          坐下开局
        </button>
      </div>
    </div>
  );
};

// ---------- 对局（一整场） ----------
const LiarsDiceMatch = ({ characters, stake, onExitToHall, onBackToPicker }) => {
  const m = useLiarsDiceMatch({ characters, stake });
  const { table } = m;
  const [startError, setStartError] = useState('');
  const [peek, setPeek] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [outFxDone, setOutFxDone] = useState(0); // 已经播过“你出局”演出的那一轮
  const [winFxDone, setWinFxDone] = useState(false); // 已经播过“你获胜”演出

  useEffect(() => {
    m.startSession()
      .then((r) => {
        // 'busy' 是开发模式下 effect 跑了两遍、第二遍被挡掉，不是错误。
        if (r && !r.ok && r.error === 'not_enough_chips') {
          setStartError('筹码不够这笔下注了，回去选小一点的数额吧。');
        }
      })
      .catch((err) => {
        console.warn('[LiarsDice] 开局失败', err);
        setStartError('开局失败了，请退出后重试。');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每一轮开始，骰盅重新盖上。
  useEffect(() => {
    setPeek(false);
  }, [table?.roundNumber]);

  if (startError) {
    return (
      <div className="tgh-shared-screen tld-screen">
        <p className="tgh-shared-empty">{startError}</p>
        <div className="tgh-shared-actions">
          <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={onBackToPicker}>
            重新选择
          </button>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="tgh-shared-screen tld-screen">
        <p className="tgh-shared-empty">正在摇骰……</p>
      </div>
    );
  }

  const status = table.status;
  const inReveal = status === 'reveal' || status === 'ended';
  const reveal = table.lastReveal;
  const bid = table.currentBid;
  const mySeat = table.seats[0];
  const totalDice = getTotalDice(table);
  const showMyDice = peek;
  const timerPct = Math.max(0, Math.min(100, (m.remainingMs / TURN_TIME_LIMIT_MS) * 100));

  // 开骰时哪些骰子算数：叫的点数本身，叫的不是 1 时 1 点也算。
  const isHit = (value) => !!reveal && (value === reveal.bid.face || (reveal.bid.face !== 1 && value === 1));

  // 用户是在刚刚这一轮出局的（这次摊牌停下来等用户点“继续旁观”）。
  const justOut = inReveal && !!reveal && reveal.eliminated && reveal.loser === 0;

  // 全屏演出：摇骰 / 开骰由控制器判断该不该播（shakePending / revealPending），
  // 播完回调 finishShake / finishReveal；出局、获胜演出接在开骰之后各播一次。
  const showOutFx = justOut && !m.revealPending && outFxDone !== reveal.round;
  const showWinFx =
    status === 'ended' && table.winnerIndex === 0 && !m.revealPending && !winFxDone && !m.showResult;

  const handleBack = () => {
    if (!m.sessionEnded && !m.matchOver) setConfirmLeave(true);
    else onExitToHall();
  };

  // 用户已经出局、正在旁观时离开：这一局直接算完，并照常告诉同桌的角色。
  const leaveWhileSpectating = () => {
    m.skipToEnd();
    onExitToHall();
  };

  const renderSeat = (idx) => {
    const seat = table.seats[idx];
    const character = m.seatCharacters[idx - 1];
    const bubble = m.bubbles[idx];
    const isActing = status === 'bidding' && table.currentIndex === idx;
    const isBidder = !!bid && bid.seat === idx;
    const isLoser = inReveal && !!reveal && reveal.loser === idx;

    return (
      <div
        key={idx}
        className={`tld-seat ${seat.out ? 'tld-seat-out' : ''} ${isActing ? 'tld-seat-acting' : ''} ${isLoser ? 'tld-seat-loser' : ''}`}
      >
        {bubble && (
          <div className="tld-bubble" key={bubble.key}>
            {bubble.text}
          </div>
        )}
        <AvatarBubble character={character} className="tld-avatar" />
        <div className="tld-seat-name">{character?.name}</div>
        <div className="tld-seat-dice">
          {seat.out ? (
            <span className="tld-seat-tag">出局</span>
          ) : (
            Array.from({ length: seat.diceCount }).map((_, i) => <span key={i} className="tld-mini-die" />)
          )}
        </div>
        {isBidder && !inReveal && (
          <span className="tld-seat-tag tld-seat-tag-bid">
            叫了 {bid.quantity} 个 {bid.face} 点
          </span>
        )}
      </div>
    );
  };

  const draftOption = m.draft ? m.bidOptions.find((o) => o.face === m.draft.face) : null;
  const noLegalBid = m.bidOptions.length > 0 && m.bidOptions.every((o) => !o.available);

  const renderResult = () => {
    const res = m.sessionResult;
    const finished = res.endReason === 'finished';
    let title;
    if (finished) title = res.winnerIndex === 0 ? '你赢到了最后' : `${res.standings[0].name}赢到了最后`;
    else if (res.endReason === 'busted') title = '你的骰子先用光了';
    else title = '你中途离桌了';

    const net = res.netChange > 0 ? `+${res.netChange}` : String(res.netChange);
    const hasRealCharacter = m.seatCharacters.some((c) => !c.isNpc);

    return (
      <div className="tld-result">
        <h3 className="tld-result-title">{title}</h3>
        <div className={`tld-result-net ${res.netChange > 0 ? 'tld-result-net-win' : 'tld-result-net-loss'}`}>{net}</div>
        <div className="tld-result-net-label">筹码</div>

        <div className="tld-result-facts">
          <span>底池 {res.pot}</span>
          <span>共 {res.rounds} 轮</span>
          <span>用时 {formatDuration(res.durationSec * 1000)}</span>
          {finished && res.userRank && <span>你排第 {res.userRank}</span>}
        </div>
        {m.chipBalance !== null && <p className="tld-result-balance">筹码池余额现在是 {m.chipBalance}</p>}

        {m.momentLines.length > 0 && (
          <ul className="tld-moment-log">
            {m.momentLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}

        {hasRealCharacter && <p className="tld-saved-note">这一局的结果已经让同桌的角色知道了，下次聊天可能会提起。</p>}

        <div className="tgh-shared-actions">
          <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={onBackToPicker}>
            再来一局
          </button>
          <button type="button" className="tgh-shared-btn" onClick={onExitToHall}>
            回大厅
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="tld-screen tld-table-screen">
      <div className="tld-orb tld-orb-gold" aria-hidden="true" />
      <div className="tld-orb tld-orb-lavender" aria-hidden="true" />
      <div className="tld-orb tld-orb-rose" aria-hidden="true" />

      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={handleBack}>
        <BackIcon />
      </button>

      {m.userOut && !m.matchOver && !m.showResult && (
        <button type="button" className="tld-skip-btn" onClick={m.skipToEnd}>
          跳过，直接看结果
        </button>
      )}

      <div className="tld-header">
        <span>第 {table.roundNumber} 轮</span>
        <span>桌上 {totalDice} 颗骰子</span>
        <span>底池 {stake * SEAT_COUNT}</span>
      </div>

      {confirmLeave && (
        <div className="tld-confirm">
          {m.userOut ? (
            <p>你已经出局了。现在离开的话，这一局会直接算完，结果会告诉同桌的角色。</p>
          ) : (
            <p>中途离开会放弃下注的 {stake} 个筹码，这一局也不会留下记录。</p>
          )}
          <div className="tgh-shared-actions">
            <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={() => setConfirmLeave(false)}>
              {m.userOut ? '继续旁观' : '继续打'}
            </button>
            <button type="button" className="tgh-shared-btn" onClick={m.userOut ? leaveWhileSpectating : onExitToHall}>
              {m.userOut ? '直接出结果并离开' : '仍然离开'}
            </button>
          </div>
        </div>
      )}

      <div className="tld-opponents">{[1, 2, 3].map((idx) => renderSeat(idx))}</div>

      {m.notice && <div className="tld-notice">{m.notice}</div>}

      {!m.showResult && (
        <>
          <section className="tld-altar">
            <div className="tld-altar-caption">
              {inReveal && reveal
                ? '开骰'
                : bid
                ? `${m.nameOf(bid.seat)}的叫点`
                : `第 ${table.roundNumber} 轮，${m.nameOf(table.currentIndex)}先叫`}
            </div>

            {!inReveal && bid && (
              <div className="tld-bid-display">
                <span className="tld-bid-count" key={`${bid.quantity}-${bid.face}`}>
                  {bid.quantity}
                </span>
                <span className="tld-bid-times">x</span>
                <AltarDie value={bid.face} size={66} />
              </div>
            )}
            {!inReveal && !bid && <div className="tld-bid-empty">还没有人叫点</div>}

            {inReveal && reveal && (
              <div className="tld-verdict">
                <div className={`tld-verdict-title ${reveal.bidderRight ? '' : 'tld-verdict-title-liar'}`}>
                  {reveal.bidderRight ? '叫点成立' : '抓到了虚张声势'}
                </div>
                <p>
                  {m.nameOf(reveal.bidder)}叫了 {reveal.bid.quantity} 个 {reveal.bid.face} 点，
                  全场实际有 {reveal.count} 个。
                </p>
                <p>
                  {m.nameOf(reveal.loser)}
                  {reveal.eliminated ? '的骰子用光了，出局' : `失去一颗骰子，还剩 ${reveal.remaining} 颗`}
                </p>
              </div>
            )}

            <div className="tld-rule-pill">
              {inReveal && reveal
                ? reveal.bid.face === 1
                  ? '叫的是 1 点，只数 1 点自己'
                  : '1 点百搭，已经算进去了'
                : bid && bid.face === 1
                ? '当前叫的是 1 点，只数 1 点自己'
                : '1 点百搭，算作任何点数'}
            </div>
          </section>

          {inReveal && reveal && (
            <section className="tld-reveal-board">
              {table.seats.map((seat, idx) => {
                const dice = reveal.allDice[idx];
                if (!dice || dice.length === 0) return null;
                return (
                  <div key={idx} className={`tld-reveal-row ${reveal.loser === idx ? 'tld-reveal-row-loser' : ''}`}>
                    <span className="tld-reveal-name">{m.nameOf(idx)}</span>
                    <div className="tld-reveal-dice">
                      {dice.map((v, i) => (
                        <Die key={i} value={v} size="sm" hit={isHit(v)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {!inReveal && !mySeat.out && (
            <section className="tld-sanctum">
              <div className="tld-sanctum-head">
                <span className="tld-sanctum-title">你的骰盅（{mySeat.diceCount} 颗）</span>
                <button type="button" className="tld-peek-btn" onClick={() => setPeek((v) => !v)}>
                  {peek ? '盖上骰盅' : '揭开偷看'}
                </button>
              </div>
              <div className="tld-tray">
                <HandDice dice={mySeat.dice} lifted={showMyDice} />
                {/* key 里带上摇骰演出是否还在播：演出一结束，骰盅重新挂载，播“落下”动画 */}
                <button
                  type="button"
                  key={`cup-${table.roundNumber}-${m.shakePending}`}
                  className={`tld-cup ${showMyDice ? 'tld-cup-lifted' : ''}`}
                  onClick={() => setPeek(true)}
                  tabIndex={showMyDice ? -1 : 0}
                  aria-hidden={showMyDice}
                >
                  <svg className="tld-cup-arch" viewBox="0 0 100 100" aria-hidden="true">
                    <path d="M20 90 L20 40 Q50 5 80 40 L80 90 Z" />
                    <line x1="50" y1="10" x2="50" y2="90" />
                    <circle cx="50" cy="45" r="8" />
                  </svg>
                  <span>点一下揭开骰盅</span>
                </button>
              </div>
            </section>
          )}

          {!inReveal && mySeat.out && (
            <section className="tld-spectate">
              <div className="tld-spectate-title">你已出局，正在旁观</div>
              <p>剩下三位还在继续，打完才会出结果。想直接看结果，点右上角的“跳过”。</p>
            </section>
          )}
        </>
      )}

      {!inReveal && !m.isMyTurn && (
        <div className="tld-waiting">等待 {m.nameOf(table.currentIndex)} 叫点……</div>
      )}

      {!inReveal && m.isMyTurn && (
        <div className="tld-controls">
          <div className="tld-timer-track">
            <div className="tld-timer-fill" style={{ width: `${timerPct}%` }} />
          </div>

          {m.draft && draftOption && (
            <>
              <div className="tld-selector-strip">
                <div className="tld-stepper">
                  <button
                    type="button"
                    className="tld-step-btn"
                    aria-label="少叫一个"
                    disabled={m.draft.quantity <= draftOption.minQuantity}
                    onClick={() => m.stepDraftQuantity(-1)}
                  >
                    -
                  </button>
                  <span className="tld-step-val">{m.draft.quantity}</span>
                  <button
                    type="button"
                    className="tld-step-btn"
                    aria-label="多叫一个"
                    disabled={m.draft.quantity >= draftOption.maxQuantity}
                    onClick={() => m.stepDraftQuantity(1)}
                  >
                    +
                  </button>
                </div>

                <div className="tld-faces">
                  {m.bidOptions.map((o) => (
                    <button
                      key={o.face}
                      type="button"
                      className={`tld-face-key ${m.draft.face === o.face ? 'tld-face-key-active' : ''}`}
                      disabled={!o.available}
                      aria-label={`${o.face} 点`}
                      onClick={() => m.setDraftFace(o.face)}
                    >
                      <DieFace value={o.face} />
                    </button>
                  ))}
                </div>
              </div>
              <p className="tld-hint">{describeMinimum(bid, m.draft.face, draftOption.minQuantity)}</p>
            </>
          )}
          {noLegalBid && <p className="tld-hint">已经叫到极限，没法再加码了，只能质疑。</p>}

          <div className="tld-action-row">
            <button type="button" className="tld-btn tld-btn-bid" disabled={!m.draft} onClick={m.doBid}>
              {m.draft ? `叫 ${m.draft.quantity} 个 ${m.draft.face} 点` : '叫点'}
            </button>
            <button type="button" className="tld-btn tld-btn-challenge" disabled={!m.canChallenge} onClick={m.doChallenge}>
              质疑开骰
            </button>
          </div>
        </div>
      )}

      {inReveal && !m.showResult && (
        <div className="tld-reveal-actions">
          {m.matchOver ? (
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              disabled={!m.sessionEnded}
              onClick={m.openResult}
            >
              {m.sessionEnded ? '查看结算' : '正在结算……'}
            </button>
          ) : m.userOut ? (
            justOut ? (
              <div className="tgh-shared-actions">
                <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={m.nextRound}>
                  继续旁观
                </button>
              </div>
            ) : (
              <p className="tld-spectate-note">旁观中，下一轮马上开始……</p>
            )
          ) : (
            <div className="tgh-shared-actions">
              <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={m.nextRound}>
                下一轮
              </button>
              <button type="button" className="tgh-shared-btn" onClick={m.leaveTable}>
                离桌（放弃下注）
              </button>
            </div>
          )}
        </div>
      )}

      {m.showResult && m.sessionResult && renderResult()}

      {m.shakePending && <ShakeOverlay onDone={() => m.finishShake(table.roundNumber)} />}
      {m.revealPending && reveal && (
        <RevealOverlay
          reveal={reveal}
          names={table.seats.map((_, i) => m.nameOf(i))}
          onDone={() => m.finishReveal(reveal.round)}
        />
      )}
      {showOutFx && <OutOverlay onDone={() => setOutFxDone(reveal.round)} />}
      {showWinFx && (
        <WinOverlay amount={stake * (SEAT_COUNT - 1)} balance={m.chipBalance} onDone={() => setWinFxDone(true)} />
      )}
    </div>
  );
};

// ---------- 顶层：选角色 -> 选下注 -> 对局 ----------
const LiarsDiceGame = ({ onExitToHall }) => {
  const [step, setStep] = useState('pick'); // 'pick' | 'stake' | 'match'
  const [characters, setCharacters] = useState([]);
  const [stake, setStake] = useState(0);

  if (step === 'pick') {
    return (
      <CharacterPicker
        onExitToHall={onExitToHall}
        onPicked={(picked) => {
          setCharacters(picked);
          setStep('stake');
        }}
      />
    );
  }

  if (step === 'stake') {
    return (
      <BuyInScreen
        onBack={() => setStep('pick')}
        onConfirm={(amount) => {
          setStake(amount);
          setStep('match');
        }}
      />
    );
  }

  return (
    <LiarsDiceMatch
      characters={characters}
      stake={stake}
      onExitToHall={onExitToHall}
      onBackToPicker={() => setStep('pick')}
    />
  );
};

export default LiarsDiceGame;