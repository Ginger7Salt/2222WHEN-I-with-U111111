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
//
// 互动对话（2026-10 新增）：每一轮轮到谁点杯子，谁就可以顺带说一句话
// ——可以是暗示，也可以是故意下的烟雾弹，用来误导对方接下来的选择。
// 用户这边是一个可选的文字输入框（userMessageDraft），点杯子的同时把
// 当前草稿一起带上；角色这边复用原本就有的AI"理由"字段，只是现在明确
// 当成"说给用户听的一句话"，而且会先把用户上一轮说的话喂给它（见
// witchsPoisonAiService.js 的 userMessage 参数），让角色可以顺势回应
// 或者将计就计。turnLog 里每一条现在除了 side/cup，还可能带一个
// message 字段，渲染时统一显示；round结束时整条 turnLog 会传给
// recordWitchsPoisonRound，压缩成一句过程摘要一起写进 contextNote。
//
// 拟物化改版（2026-10）：杯子换成3D翻转的"药瓶"——轮流点杯子阶段，
// 点开一个还没点过的瓶子，安全就翻面露出小猫贴图，撞上对方的毒就翻面
// 露出毒药贴图（下面两个常量，以后要换图只改这两行）。同一个编号的瓶子
// 用户和角色可能分别点过，翻面状态取"任意一方点过"就算翻开，背面下方
// 会标出是谁点的；结束揭晓时，没被撞上的那一方秘密瓶另外叠一圈虚线紫
// 环标出来（不影响它本身是否已经翻开过）。

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

const SAFE_ICON_URL = 'https://u2.fukit.cn/QM187W6RW';
const POISON_ICON_URL = 'https://u2.fukit.cn/o2mTZlwSK';

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

// 药瓶正面的拟物外观（瓶塞+瓶颈+瓶身+紫色药液+编号），藏毒阶段的普通
// 按钮和轮流点杯阶段的翻转卡片正面共用这一份标记。
const FlaskFront = ({ number }) => (
  <div className="tgwp-flask">
    <div className="tgwp-flask-stopper" />
    <div className="tgwp-flask-neck" />
    <div className="tgwp-flask-body">
      <div className="tgwp-flask-liquid" />
    </div>
    <div className="tgwp-flask-shine" />
    <div className="tgwp-flask-num">{number}</div>
  </div>
);

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
  const [turnLog, setTurnLog] = useState([]); // [{side, cup, message}]
  const [isWaitingAi, setIsWaitingAi] = useState(false);
  const [userMessageDraft, setUserMessageDraft] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState(''); // 喂给TA下一次选杯子的AI调用，用过就清空

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
    setUserMessageDraft('');
    setLastUserMessage('');
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
      turnLog,
    });
    await refreshStats(selectedCharacter.id);
  };

  // 用户这一轮点一个自己还没点过的杯子，赌它不是角色藏毒的那一杯；点的
  // 同时把当前输入框里的草稿话（暗示/烟雾弹，选填）一起带上。
  const handleUserTurn = async (cupNumber) => {
    if (phase !== PHASE.ROUND || currentTurn !== 'user') return;
    if (userTriedCups.includes(cupNumber)) return;

    const message = userMessageDraft.trim();
    setUserMessageDraft('');

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

    setTurnLog((prev) => [...prev, { side: 'user', cup: cupNumber, message }]);
    setLastUserMessage(message);
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
      userMessage: lastUserMessage,
    });

    setIsWaitingAi(false);
    setLastUserMessage(''); // 这句话已经喂给TA了，不重复带到下一轮
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

    setTurnLog((prev) => [...prev, { side: 'character', cup: cupNumber, message: reason }]);
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
      <div className="tgh-shared-screen tgwp-screen">
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
      <div className="tgh-shared-screen tgwp-screen">
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
      <div className="tgh-shared-screen tgwp-screen">
        <button
          type="button"
          className="tgh-back-btn-light"
          aria-label="返回"
          onClick={handleEditStake}
        >
          <BackIcon />
        </button>

        <div className="tgwp-eyebrow">The Witch&rsquo;s Poison</div>

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
              <FlaskFront number={cupNumber} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const revealed = phase === PHASE.RESULT;

  // 轮流点杯阶段的翻转药瓶：安全就翻面露出小猫贴图，撞上对方的毒就
  // 翻面露出毒药贴图；结束揭晓时，没被撞上的那一方秘密瓶额外叠一圈
  // 虚线紫环（撞上的那一瓶已经是最重的强调，不需要再叠一层）。
  const renderCup = (cupNumber) => {
    const triedByUser = userTriedCups.includes(cupNumber);
    const triedByCharacter = characterTriedCups.includes(cupNumber);
    const isHit = revealed && cupNumber === hitCup;
    const isFlipped = triedByUser || triedByCharacter;
    const isSecretMarker =
      revealed &&
      cupNumber !== hitCup &&
      (cupNumber === userSecretCup || cupNumber === characterSecretCup);

    const canUserClickNow = !revealed && currentTurn === 'user' && !triedByUser;

    let backTag = '';
    if (isHit) {
      backTag = '中毒';
    } else if (isFlipped) {
      const triers = [];
      if (triedByUser) triers.push('你');
      if (triedByCharacter) triers.push(selectedCharacter?.name || 'TA');
      backTag = triers.length ? `${triers.join('·')}点过 安全` : '';
    }

    const classNames = [
      'tgwp-vial-wrap',
      isFlipped ? 'is-flipped' : '',
      isHit ? 'is-hit' : isFlipped ? 'is-safe' : '',
      isSecretMarker ? 'is-secret-marker' : '',
      !canUserClickNow ? 'is-disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        key={cupNumber}
        type="button"
        className={classNames}
        onClick={() => canUserClickNow && handleUserTurn(cupNumber)}
        disabled={!canUserClickNow}
        aria-label={`${cupNumber}号瓶`}
      >
        <div className="tgwp-vial-inner">
          <div className="tgwp-vial-face">
            <FlaskFront number={cupNumber} />
          </div>
          <div className="tgwp-vial-back">
            {isFlipped && (
              <img src={isHit ? POISON_ICON_URL : SAFE_ICON_URL} alt={isHit ? '中毒' : '安全'} />
            )}
            {backTag && <span className="tgwp-vial-back-tag">{backTag}</span>}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="tgh-shared-screen tgwp-screen">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={handleBackToPicker}>
        <BackIcon />
      </button>

      <div className="tgwp-eyebrow">The Witch&rsquo;s Poison</div>

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

      {!revealed &&
        turnLog.length > 0 &&
        turnLog[turnLog.length - 1].message && (
          <div className="tgwp-latest-bubble">
            <div className="tgwp-bubble-avatar">
              {turnLog[turnLog.length - 1].side === 'character'
                ? (selectedCharacter?.name || 'TA').trim().charAt(0) || 'TA'
                : '你'}
            </div>
            <div className="tgwp-bubble-col">
              <span className="tgwp-bubble-label">
                {turnLog[turnLog.length - 1].side === 'character'
                  ? `${selectedCharacter?.name || 'TA'} 刚才说`
                  : '你刚才说'}
              </span>
              <div className="tgwp-bubble">{turnLog[turnLog.length - 1].message}</div>
            </div>
          </div>
        )}

      {!revealed && (
        <div className="tgh-shared-field tgwp-message-field">
          <label>想说句话吗？可以是暗示，也可以是故意下的烟雾弹（选填）</label>
          <div className="tgh-shared-input-row">
            <input
              type="text"
              className="tgh-shared-input"
              placeholder="比如：千万别点3号……"
              value={userMessageDraft}
              maxLength={60}
              onChange={(event) => setUserMessageDraft(event.target.value)}
            />
          </div>
        </div>
      )}

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
              {item.message && <span className="tgwp-log-reason">"{item.message}"</span>}
            </div>
          ))}
        </div>
      )}

      {revealed && (
        <div className="tgh-shared-result-banner tgwp-result-banner">
          <h3>{poisonedSide === 'user' ? '你中毒了' : 'TA中毒了'}</h3>
          <p>
            你藏在{userSecretCup}号，TA藏在{characterSecretCup}号，第{turnLog.length + 1}轮在
            {hitCup}号撞上了。
          </p>
          {reactionLine && <p className="tgwp-result-reaction">"{reactionLine}"</p>}
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