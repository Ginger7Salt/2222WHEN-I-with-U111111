// src/apps/textgames/undercover/UndercoverGame.jsx
//
// "谁是卧底"对局界面，从文字游戏大厅内部切换进来（跟井字棋/UNO 同一个
// 接入方式，见 TextGameHallApp.jsx 的 GAME_COMPONENTS）。
//
// 固定 5 人局，用户本人也是场上玩家之一（设计确认）：选 0-4 位真实
// 角色同场，不够 5 人时用临时 NPC 补位。词库来源可选"内置词库"或
// "AI 现场生成"。身份不公开发放给其他人看——用户只能看到自己的身份
// 和词，AI/NPC 的身份在这个 Slice 里虽然在 state 里，但 UI 完全不
// 展示给用户（后续结算阶段才会用到，见 undercoverEngine.js 的淘汰
// 判定）。
//
// Slice A 范围：选人 -> 发身份/发词 -> 展示"你的词+阵营"。发言、投票、
// 结算回写都留到 Slice B/C。这个 Slice 结束后直接是一个"知道了"按钮
// 退回大厅，不会卡在一个没有后续功能的死胡同里。

import React, { useEffect, useMemo, useState } from 'react';

import {
  listCharactersForPicker,
  getRecentWordPairs,
} from './undercoverService';
import { generateAiWordPair } from './undercoverAiWordService';
import { pickRandomWordPair } from './undercoverWordBank';
import { generateNpcSeats } from './undercoverNpc';
import { dealRoles, withSeatIndexes } from './undercoverEngine';
import '../textGameShared.css';
import './undercover.css';

const MAX_REAL_PICKS = 4; // 5 人局，用户占 1 席，真实角色最多选 4 位

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
  return (
    <div className={className}>
      <span>{initial}</span>
    </div>
  );
};

const WORD_SOURCE = {
  BUILTIN: 'builtin',
  AI: 'ai',
};

// ---------- 发词+身份展示 ----------
const RevealScreen = ({ players, onContinue, onExitToHall }) => {
  const userSeat = players.find((p) => p.isUser);
  const isUndercover = userSeat?.role === 'undercover';

  return (
    <div className="tgh-shared-screen uc-reveal-screen undercover-scope">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="uc-reveal-head">
        <p className="uc-reveal-eyebrow">你的身份</p>
        <h2 className={`uc-reveal-role ${isUndercover ? 'uc-reveal-role--undercover' : ''}`}>
          {isUndercover ? '卧底' : '平民'}
        </h2>
      </div>

      <div className="uc-reveal-word-card">
        <p className="uc-reveal-word-label">你拿到的词</p>
        <p className="uc-reveal-word">{userSeat?.word}</p>
      </div>

      <p className="uc-reveal-hint">
        {isUndercover
          ? '别人拿到的词跟你不一样——描述的时候留意别暴露细节。'
          : '场上有一位卧底拿到了不一样的词，听发言找破绽。'}
      </p>

      <div className="uc-reveal-seats">
        {players.map((p) => (
          <div key={p.seatIndex} className="uc-reveal-seat-chip">
            <AvatarBubble character={p} className="uc-reveal-seat-avatar" />
            <span className="uc-reveal-seat-name">{p.isUser ? '你' : p.name}</span>
          </div>
        ))}
      </div>

      <div className="tgh-shared-actions">
        <button type="button" className="tgh-shared-btn tgh-shared-btn-primary" onClick={onContinue} disabled>
          开始发言（下个切片开放）
        </button>
      </div>
    </div>
  );
};

// ---------- 选人 ----------
const UndercoverGame = ({ onExitToHall }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickedIds, setPickedIds] = useState([]);
  const [wordSource, setWordSource] = useState(WORD_SOURCE.BUILTIN);
  const [preparing, setPreparing] = useState(false);
  const [players, setPlayers] = useState(null); // 发完身份的 5 人座位数组，null = 还在选人

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
      if (cur.length >= MAX_REAL_PICKS) return cur;
      return [...cur, id];
    });
  };

  const pickedCharacters = useMemo(
    () => pickedIds.map((id) => characters.find((c) => c.id === id)).filter(Boolean),
    [pickedIds, characters]
  );

  const handleStart = async () => {
    setPreparing(true);
    try {
      const recentPairs = await getRecentWordPairs();
      const wordPair =
        wordSource === WORD_SOURCE.AI
          ? await generateAiWordPair(recentPairs)
          : pickRandomWordPair(recentPairs);

      const realSeats = pickedCharacters.map((c) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        bio: c.bio,
        isNpc: false,
        isUser: false,
      }));
      const npcCount = MAX_REAL_PICKS - realSeats.length;
      const npcSeats = generateNpcSeats(
        npcCount,
        pickedCharacters.map((c) => c.name)
      );
      const userSeat = { id: 'user', name: '你', avatar: null, bio: '', isNpc: false, isUser: true };

      // 用户座位插在随机位置，不是永远第一个，避免"第一个发言的总是用户"
      const others = [...realSeats, ...npcSeats];
      const userPosition = Math.floor(Math.random() * (others.length + 1));
      others.splice(userPosition, 0, userSeat);

      const seatsWithIndex = withSeatIndexes(others);
      const dealt = dealRoles(seatsWithIndex, wordPair);
      setPlayers(dealt);
    } catch (error) {
      console.warn('[UndercoverGame] 开局准备失败。', error);
    } finally {
      setPreparing(false);
    }
  };

  if (players) {
    return (
      <RevealScreen
        players={players}
        onContinue={() => {}}
        onExitToHall={onExitToHall}
      />
    );
  }

  return (
    <div className="tgh-shared-screen undercover-scope">
      <button type="button" className="tgh-back-btn-light" aria-label="返回" onClick={onExitToHall}>
        <BackIcon />
      </button>

      <div className="tgh-shared-picker-head">
        <h2>谁是卧底</h2>
        <p>One word, two meanings</p>
      </div>

      {loading && <p className="tgh-shared-empty">正在加载角色列表……</p>}

      {!loading && (
        <>
          <p className="uc-picker-sub">
            固定 5 人局，你自己是其中一位玩家。最多选 {MAX_REAL_PICKS} 位角色同场，人数不够会用临时 NPC 补位。
          </p>

          {characters.length === 0 && (
            <p className="tgh-shared-empty">
              还没有可选的角色，全部用临时 NPC 凑一局，或者先去创建几个角色。
            </p>
          )}

          {characters.length > 0 && (
            <div className="tgh-shared-picker-grid">
              {characters.map((character) => {
                const picked = pickedIds.includes(character.id);
                return (
                  <button
                    key={character.id}
                    type="button"
                    className={`tgh-shared-picker-item ${picked ? 'uc-picked' : ''}`}
                    onClick={() => togglePick(character.id)}
                  >
                    <AvatarBubble character={character} className="tgh-shared-picker-avatar" />
                    <span className="tgh-shared-picker-name">{character.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="uc-picker-hint">
            已选 {pickedIds.length} / {MAX_REAL_PICKS} 位角色，
            {MAX_REAL_PICKS - pickedIds.length > 0
              ? `另外 ${MAX_REAL_PICKS - pickedIds.length} 位用 NPC 补位。`
              : '刚好凑满。'}
          </p>

          <div className="uc-word-source-row">
            <span className="uc-word-source-label">词语来源</span>
            <div className="uc-word-source-options">
              <button
                type="button"
                className={`uc-word-source-btn ${wordSource === WORD_SOURCE.BUILTIN ? 'uc-word-source-btn--active' : ''}`}
                onClick={() => setWordSource(WORD_SOURCE.BUILTIN)}
              >
                内置词库
              </button>
              <button
                type="button"
                className={`uc-word-source-btn ${wordSource === WORD_SOURCE.AI ? 'uc-word-source-btn--active' : ''}`}
                onClick={() => setWordSource(WORD_SOURCE.AI)}
              >
                AI 现场生成
              </button>
            </div>
          </div>

          <div className="tgh-shared-actions">
            <button
              type="button"
              className="tgh-shared-btn tgh-shared-btn-primary"
              disabled={preparing}
              onClick={handleStart}
            >
              {preparing ? '正在发牌……' : '开局'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UndercoverGame;