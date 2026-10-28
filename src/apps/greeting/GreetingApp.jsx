// src/apps/greeting/GreetingApp.jsx
//
// 贺卡 subapp：收藏夹书架（切片 A）。
//
// 这一刀包含：书架（按状态/来源筛选）、点名请角色做一张、制作中状态、送到时的
// 提示、全屏拆封、收藏、删除、失败重试。
// 这一刀不含：定时推送、角色主动送、立体书——书架顶部的"立体书"标签先占位。

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Trash2, RotateCw } from 'lucide-react';

import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import {
  deleteGreetingCard,
  listGreetingCards,
  markGreetingCardRead,
  reconcileGreetingCards,
  requestGreetingCard,
  retryGreetingCard,
  subscribeGreetingCards,
} from './greetingService';
import { GREETING_SOURCE, GREETING_STATUS, MAKING_STAGES } from './greetingConstants';
import GreetingCover from './GreetingCover';
import GreetingUnwrap from './GreetingUnwrap';
import GreetingAskSheet from './GreetingAskSheet';
import './greeting.css';

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'unread', label: '还没拆' },
  { id: GREETING_SOURCE.PROACTIVE, label: 'TA 主动送的' },
  { id: GREETING_SOURCE.REQUESTED, label: '我点名做的' },
];

const matchesFilter = (card, filter) => {
  if (filter === 'all') return true;
  if (filter === 'unread') return card.status === GREETING_STATUS.READY && !card.isRead;
  return card.source === filter;
};

// 贺卡送到时的系统通知（只有用户已经授权过才会弹，不在这里主动申请权限）。
const showSystemNotification = (characterName, avatar) => {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return;
  }
  try {
    new Notification(`${characterName} 做好了一张贺卡`, {
      body: '去收藏夹拆开看看',
      icon: avatar || '/favicon.ico',
      tag: 'greeting-card-ready',
    });
  } catch (error) {
    console.warn('贺卡通知未能显示：', error);
  }
};

const GreetingApp = ({ onBackHub }) => {
  const [cards, setCards] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [landedId, setLandedId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showAsk, setShowAsk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [askError, setAskError] = useState('');
  const [stageIndex, setStageIndex] = useState(0);

  const charactersById = useMemo(
    () => Object.fromEntries(characters.map((character) => [character.id, character])),
    [characters]
  );

  const load = useCallback(async () => {
    const [list, chars] = await Promise.all([listGreetingCards(), db.characters.toArray()]);
    setCards(list);
    setCharacters(chars);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    return subscribeGreetingCards(load);
  }, [load]);

  // 推进"制作中 -> 送到"。页面挂载期间每 3 秒检查一次；有卡刚送到就弹提示。
  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const ready = await reconcileGreetingCards();
        if (!alive) return;
        for (const card of ready) {
          const character = await db.characters.get(card.characterId);
          const name = character?.name || 'TA';
          triggerGlobalToast({
            title: `${name} 做好了一张贺卡`,
            content: '去收藏夹拆开看看',
            iconType: 'bell',
          });
          showSystemNotification(name, character?.avatar);
        }
      } catch (error) {
        console.warn('推进贺卡状态失败：', error);
      }
    };

    tick();
    const timer = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // "制作中"卡片上的进度文字轮换。
  useEffect(() => {
    const timer = setInterval(() => setStageIndex((value) => value + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  const visibleCards = useMemo(() => cards.filter((card) => matchesFilter(card, filter)), [cards, filter]);
  const openCard = useMemo(() => cards.find((card) => card.id === openId) || null, [cards, openId]);
  const readyCount = cards.filter((card) => card.status === GREETING_STATUS.READY).length;

  const handleSubmitAsk = async (payload) => {
    setSubmitting(true);
    setAskError('');
    try {
      await requestGreetingCard({ ...payload, source: GREETING_SOURCE.REQUESTED });
      setShowAsk(false);
      setFilter('all');
    } catch (error) {
      setAskError(String(error?.message || '没能发出请求。'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseOpen = () => {
    const id = openId;
    setOpenId(null);
    setLandedId(id);
    setTimeout(() => setLandedId((current) => (current === id ? null : current)), 1200);
  };

  const handleConfirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    if (openId === target.id) setOpenId(null);
    await deleteGreetingCard(target.id);
  };

  const renderSlot = (card) => {
    const character = charactersById[card.characterId];
    const characterName = character?.name || '（角色已被删除）';

    if (card.status === GREETING_STATUS.MAKING) {
      return (
        <div className="gc-slot" key={card.id}>
          <div className="gc-making">
            <i className="gc-making__orb" />
            <i className="gc-making__scan" />
            <span className="gc-making__stage">{MAKING_STAGES[stageIndex % MAKING_STAGES.length]}</span>
            <span className="gc-making__eta">{characterName} 正在做</span>
          </div>
          <div className="gc-rule" />
          <div className="gc-meta">
            <span>制作中</span>
          </div>
        </div>
      );
    }

    if (card.status === GREETING_STATUS.FAILED) {
      return (
        <div className="gc-slot" key={card.id}>
          <div className="gc-making is-failed">
            <span className="gc-making__stage">没做成</span>
            <span className="gc-making__err">{card.error || '这次没有做成。'}</span>
          </div>
          <div className="gc-rule" />
          <div className="gc-meta gc-meta--actions">
            <button type="button" onClick={() => retryGreetingCard(card.id)}>
              <RotateCw size={11} /> 重试
            </button>
            <button type="button" onClick={() => setDeleteTarget(card)}>
              <Trash2 size={11} /> 删除
            </button>
          </div>
        </div>
      );
    }

    const unread = !card.isRead;
    return (
      <div className="gc-slot" key={card.id}>
        <button
          type="button"
          className={`gc-mini${unread ? ' is-unread' : ''}${landedId === card.id ? ' is-landed' : ''}`}
          onClick={() => setOpenId(card.id)}
          aria-label={`打开贺卡：${card.cover?.title || ''}`}
        >
          <GreetingCover card={card} signFallback={characterName} live={unread} showUnreadDot={unread} />
        </button>
        <div className="gc-rule" />
        <div className="gc-meta">
          <span>
            {unread ? '未拆 / ' : ''}
            {card.source === GREETING_SOURCE.PROACTIVE ? '主动送' : '点名做'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="gc-app animate-fade-in pb-24">
      <div className="gc-head">
        <button type="button" className="gc-back" onClick={onBackHub}>
          <ArrowLeft size={16} /> 主页
        </button>
        <button
          type="button"
          className="gc-ask-btn"
          onClick={() => {
            setAskError('');
            setShowAsk(true);
          }}
        >
          <Plus size={14} /> 请 TA 做一张
        </button>
      </div>

      <div className="gc-title">
        <h1>收藏夹</h1>
        <span className="gc-label">Collection</span>
      </div>

      <div className="gc-tabs">
        <button type="button" className="is-on">
          贺卡<i>{String(readyCount).padStart(2, '0')}</i>
        </button>
        <button type="button" disabled>
          立体书<em>SOON</em>
        </button>
      </div>

      <div className="gc-filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`gc-chip${filter === item.id ? ' is-on' : ''}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loaded && visibleCards.length === 0 ? (
        <div className="gc-empty">
          {cards.length === 0 ? '这里还空着。让 TA 为你做第一张吧。' : '这一格还空着'}
        </div>
      ) : (
        <div className="gc-rack">{visibleCards.map(renderSlot)}</div>
      )}

      <GreetingAskSheet
        open={showAsk}
        characters={characters}
        submitting={submitting}
        error={askError}
        onClose={() => setShowAsk(false)}
        onSubmit={handleSubmitAsk}
      />

      {openCard && openCard.status === GREETING_STATUS.READY && (
        <GreetingUnwrap
          key={openCard.id}
          card={openCard}
          onClose={handleCloseOpen}
          onOpened={markGreetingCardRead}
          onDelete={setDeleteTarget}
        />
      )}

      {/* 拆封层是 z-index 1200 的全屏层，确认框要叠在它上面 */}
      <div style={{ position: 'relative', zIndex: 1300 }}>
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="删除这张贺卡？"
        message="删除后就找不回来了。"
        confirmText="删除"
        cancelText="留着"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      </div>
    </div>
  );
};

export default GreetingApp;
