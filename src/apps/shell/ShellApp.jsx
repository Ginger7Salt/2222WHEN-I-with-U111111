// src/apps/shell/ShellApp.jsx
//
// 潮汐贝壳（原"漂流瓶"构想的落地版）。两个页面用文字链接切换，不用
// 底部 tab bar（跟已确认的视觉方向一致）：
// - 打捞（dive）：选角色 → 按住蓄潮 → 满潮后 AI 现场生成内容 → 开壳
//   动画揭晓。
// - 贝壳册（book）：全局一本，收着所有角色打捞过的贝壳。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Waves, X } from 'lucide-react';
import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { triggerGlobalToast } from '../../components/NotificationToast';
import {
  salvageShell,
  getRemainingQuota,
  getShellCollection,
  deleteShellCatch,
} from './shellService';
import {
  DAILY_QUOTA,
  IDENTITY,
  IDENTITY_LABEL,
  FORM_LABEL,
  TIER_LABEL,
} from './shellTypes';
import ShellIcon from './ShellIcon';

const HOLD_MS = 1300;

export default function ShellApp({ onBackHub }) {
  const [view, setView] = useState('dive'); // 'dive' | 'book'

  const [characters, setCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [remaining, setRemaining] = useState(DAILY_QUOTA);

  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isSalvaging, setIsSalvaging] = useState(false);
  const holdRef = useRef({ startedAt: 0, raf: null });

  const [revealItem, setRevealItem] = useState(null);
  const [revealOpen, setRevealOpen] = useState(false);

  const [collection, setCollection] = useState([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [identityFilter, setIdentityFilter] = useState('all');
  const [expandedItem, setExpandedItem] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  useEffect(() => {
    (async () => {
      const list = await db.characters.toArray();
      setCharacters(list);

      if (list.length > 0) {
        setSelectedCharacterId(list[0].id);
      }
    })();
  }, []);

  const refreshQuota = useCallback(async (characterId) => {
    if (!characterId) {
      setRemaining(DAILY_QUOTA);
      return;
    }

    const left = await getRemainingQuota(characterId);
    setRemaining(left);
  }, []);

  useEffect(() => {
    refreshQuota(selectedCharacterId);
  }, [selectedCharacterId, refreshQuota]);

  const loadCollection = useCallback(async () => {
    setCollectionLoading(true);

    try {
      const rows = await getShellCollection();
      setCollection(rows);
    } finally {
      setCollectionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'book') {
      loadCollection();
    }
  }, [view, loadCollection]);

  const stopHoldLoop = () => {
    if (holdRef.current.raf) {
      cancelAnimationFrame(holdRef.current.raf);
      holdRef.current.raf = null;
    }
  };

  const handleFullCharge = useCallback(async () => {
    if (!selectedCharacterId || isSalvaging) return;

    setIsSalvaging(true);

    try {
      const chat = await db.chats.where('characterId').equals(selectedCharacterId).first();
      const item = await salvageShell({
        characterId: selectedCharacterId,
        chatId: chat?.id || null,
      });

      setRevealItem(item);
      setRevealOpen(false);
      // 先挂到 DOM，下一帧再点亮 open class，触发开壳的 CSS 过渡。
      requestAnimationFrame(() => requestAnimationFrame(() => setRevealOpen(true)));

      refreshQuota(selectedCharacterId);
    } catch (error) {
      triggerGlobalToast({
        title: '打捞失败',
        content: error?.message || '潮水好像有点乱，稍后再试试',
        iconType: 'bell',
      });
    } finally {
      setIsSalvaging(false);
      setHoldProgress(0);
    }
  }, [selectedCharacterId, isSalvaging, refreshQuota]);

  const tickHold = useCallback(() => {
    const elapsed = Date.now() - holdRef.current.startedAt;
    const p = Math.min(1, elapsed / HOLD_MS);
    setHoldProgress(p);

    if (p >= 1) {
      stopHoldLoop();
      setIsHolding(false);
      handleFullCharge();
      return;
    }

    holdRef.current.raf = requestAnimationFrame(tickHold);
  }, [handleFullCharge]);

  const handlePointerDown = () => {
    if (isSalvaging || remaining <= 0 || !selectedCharacterId) return;

    setIsHolding(true);
    holdRef.current.startedAt = Date.now();
    holdRef.current.raf = requestAnimationFrame(tickHold);
  };

  const handlePointerUp = () => {
    if (!isHolding) return;

    stopHoldLoop();
    setIsHolding(false);

    // 提前松手：不扣配额，只是潮水退回去，允许马上重新按住再来。
    if (holdProgress < 1) {
      setHoldProgress(0);
    }
  };

  useEffect(() => stopHoldLoop, []);

  const closeReveal = () => {
    setRevealOpen(false);
    setTimeout(() => setRevealItem(null), 260);
  };

  const filteredCollection = collection.filter(
    (row) => identityFilter === 'all' || row.identity === identityFilter
  );

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    await deleteShellCatch(deleteTargetId);
    setDeleteTargetId(null);
    setExpandedItem(null);
    loadCollection();
  };

  return (
    <div className="flex flex-col space-y-6 min-h-[85vh] text-[var(--text-main)] font-sans">
      <header
        className="flex items-center justify-between pb-2 border-b"
        style={{ borderColor: 'var(--divider)' }}
      >
        <button
          onClick={onBackHub}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <span className="font-serif text-[10px] uppercase tracking-[0.25em] opacity-40">
          Tidal Shell · 潮汐贝壳
        </span>
      </header>

      <div className="space-y-1">
        <h2 className="font-serif text-4xl font-normal tracking-tight leading-none">
          潮汐贝壳
        </h2>

        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-widest uppercase opacity-40">
            Fragments washed ashore
          </p>
          <div
            className="h-px flex-1 mx-4 opacity-15"
            style={{ backgroundColor: 'var(--text-main)' }}
          />
          <button
            type="button"
            onClick={() => setView(view === 'dive' ? 'book' : 'dive')}
            className="text-[11px] tracking-[0.22em] opacity-80 hover:opacity-100 transition-opacity relative"
          >
            {view === 'dive' ? '贝壳册' : '回去打捞'}
          </button>
        </div>
      </div>

      {view === 'dive' && (
        <div className="flex flex-col items-center space-y-8 pt-4">
          <select
            value={selectedCharacterId || ''}
            onChange={(e) => setSelectedCharacterId(Number(e.target.value))}
            className="text-sm rounded-xl px-3 py-2 outline-none"
            style={{
              background: 'var(--control-soft-bg)',
              border: '1px solid var(--divider)',
              color: 'var(--text-main)',
            }}
          >
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            {Array.from({ length: DAILY_QUOTA }, (_, i) => (
              <i
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: i < remaining ? 'var(--text-main)' : 'var(--divider)',
                }}
              />
            ))}
          </div>
          <p className="text-[10px] tracking-widest uppercase opacity-40 -mt-6">
            今日余 {remaining} / {DAILY_QUOTA}
          </p>

          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            disabled={isSalvaging || remaining <= 0 || !selectedCharacterId}
            className="relative flex h-40 w-40 items-center justify-center rounded-full select-none disabled:opacity-40"
            style={{
              background: `conic-gradient(var(--text-main) ${holdProgress * 360}deg, var(--control-soft-bg) 0deg)`,
              transition: isHolding ? 'none' : 'background .4s ease',
            }}
          >
            <span
              className="flex h-32 w-32 items-center justify-center rounded-full text-sm tracking-[0.2em]"
              style={{
                background: 'var(--card-bg)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              {isSalvaging ? (
                <Waves className="h-6 w-6 animate-pulse opacity-70" />
              ) : remaining <= 0 ? (
                '潮已退'
              ) : (
                '按住蓄潮'
              )}
            </span>
          </button>

          <p className="text-[11px] opacity-50 tracking-widest">
            {remaining <= 0 ? '今日潮水已退，明天再来' : '按住不放，等潮水涨满自动打捞'}
          </p>
        </div>
      )}

      {view === 'book' && (
        <div className="space-y-4">
          <div className="flex gap-4 border-b" style={{ borderColor: 'var(--divider)' }}>
            {[
              ['all', '全部'],
              [IDENTITY.SELF, IDENTITY_LABEL[IDENTITY.SELF]],
              [IDENTITY.PARALLEL, IDENTITY_LABEL[IDENTITY.PARALLEL]],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setIdentityFilter(key)}
                className={`relative pb-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  identityFilter === key ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] opacity-60'
                }`}
              >
                {label}
                {identityFilter === key && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--text-main)]" />
                )}
              </button>
            ))}
          </div>

          {collectionLoading && (
            <p className="text-xs opacity-50 text-center py-8">潮水正涌上来…</p>
          )}

          {!collectionLoading && filteredCollection.length === 0 && (
            <p className="text-xs opacity-50 text-center py-8">还没有捞到过贝壳</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {filteredCollection.map((item) => (
              <button
                key={item.id}
                onClick={() => setExpandedItem(item)}
                className="text-left rounded-2xl p-3 space-y-2"
                style={{
                  background: item.tier === 2 ? 'var(--ink-card-bg)' : 'var(--card-bg-gradient)',
                  border: `1px solid ${item.tier === 2 ? 'var(--ink-card-border)' : 'var(--card-border)'}`,
                  color: item.tier === 2 ? 'var(--text-on-ink)' : 'var(--text-main)',
                  boxShadow: item.tier === 2 ? 'var(--ink-card-shadow)' : 'var(--card-shadow)',
                }}
              >
                <ShellIcon tier={item.tier} className="h-14 w-14 mx-auto" />
                <p className="text-[11px] font-serif leading-snug line-clamp-2">{item.title}</p>
                <p className="text-[9px] opacity-60 tracking-wider uppercase">
                  {item.character?.name || '未知角色'} · {TIER_LABEL[item.tier]}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {revealItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="fixed inset-0 backdrop-blur-md bg-black/20 transition-opacity"
            style={{ opacity: revealOpen ? 1 : 0 }}
            onClick={closeReveal}
          />

          <div
            className="relative w-full max-w-sm rounded-[2rem] p-6 space-y-4 z-10 transition-all duration-500"
            style={{
              background: revealItem.tier === 2 ? 'var(--ink-card-bg)' : 'var(--card-bg-gradient)',
              border: `1px solid ${revealItem.tier === 2 ? 'var(--ink-card-border)' : 'var(--card-border)'}`,
              color: revealItem.tier === 2 ? 'var(--text-on-ink)' : 'var(--text-main)',
              boxShadow: revealItem.tier === 2 ? 'var(--ink-card-shadow)' : 'var(--modal-shadow)',
              opacity: revealOpen ? 1 : 0,
              transform: revealOpen ? 'scale(1) translateY(0)' : 'scale(.85) translateY(12px)',
            }}
          >
            <button
              onClick={closeReveal}
              className="absolute right-4 top-4 opacity-50 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>

            <ShellIcon
              tier={revealItem.tier}
              className="h-24 w-24 mx-auto transition-transform duration-700"
              style={{ transform: revealOpen ? 'rotate(0deg) scale(1)' : 'rotate(-18deg) scale(.7)' }}
            />

            <p className="text-center text-[10px] tracking-[0.25em] uppercase opacity-50">
              {TIER_LABEL[revealItem.tier]} · {IDENTITY_LABEL[revealItem.identity]} · {FORM_LABEL[revealItem.form]}
            </p>

            <h3 className="text-center font-serif text-xl leading-snug">{revealItem.title}</h3>

            <p className="font-serif text-sm leading-loose whitespace-pre-wrap opacity-90 max-h-64 overflow-y-auto">
              {revealItem.content}
            </p>
          </div>
        </div>
      )}

      {expandedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="fixed inset-0 backdrop-blur-md bg-black/20"
            onClick={() => setExpandedItem(null)}
          />

          <div
            className="relative w-full max-w-sm rounded-[2rem] p-6 space-y-4 z-10"
            style={{
              background: expandedItem.tier === 2 ? 'var(--ink-card-bg)' : 'var(--card-bg-gradient)',
              border: `1px solid ${expandedItem.tier === 2 ? 'var(--ink-card-border)' : 'var(--card-border)'}`,
              color: expandedItem.tier === 2 ? 'var(--text-on-ink)' : 'var(--text-main)',
              boxShadow: expandedItem.tier === 2 ? 'var(--ink-card-shadow)' : 'var(--modal-shadow)',
            }}
          >
            <button
              onClick={() => setExpandedItem(null)}
              className="absolute right-4 top-4 opacity-50 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>

            <ShellIcon tier={expandedItem.tier} className="h-20 w-20 mx-auto" />

            <p className="text-center text-[10px] tracking-[0.25em] uppercase opacity-50">
              {expandedItem.character?.name || '未知角色'} · {TIER_LABEL[expandedItem.tier]}
            </p>

            <h3 className="text-center font-serif text-xl leading-snug">{expandedItem.title}</h3>

            <p className="font-serif text-sm leading-loose whitespace-pre-wrap opacity-90 max-h-64 overflow-y-auto">
              {expandedItem.content}
            </p>

            <button
              onClick={() => setDeleteTargetId(expandedItem.id)}
              className="w-full text-center text-[11px] tracking-widest uppercase opacity-50 hover:opacity-90 hover:text-rose-500 transition-colors pt-2"
            >
              放回大海（删除）
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="放回大海"
        message="这枚贝壳会从贝壳册里彻底删除，确定吗？"
        confirmText="放回大海"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}