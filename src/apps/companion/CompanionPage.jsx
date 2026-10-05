import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Droplets,
  Gamepad2,
  Hand,
  Palette,
  Pencil,
  Sparkles,
  Store,
  Upload,
  UtensilsCrossed,
  X,
} from 'lucide-react';

import {
  adoptCompanion,
  buyShopItem,
  equipOutfit,
  getCompanionByChat,
  getInventory,
  getRecentLogs,
  performFreeAction,
  pokeCompanion,
  renameCompanion,
  setCompanionScene,
  updateCompanionAvatar,
} from './companionService';
import { COMPANION_SCENES, DEFAULT_AVATARS, findScene, findShopItem } from './companionShopData';
import CompanionShopModal from './CompanionShopModal';
import CompanionSceneModal from './CompanionSceneModal';
import CompanionHeartIcon from './CompanionHeartIcon';
import './companionPage.css';

/*
 * 把用户上传的图片压到一个头像该有的尺寸、保留透明通道、输出 PNG。
 *
 * 思路照抄 src/apps/pet/petWidgetService.js 的 compressPetAvatar，
 * 但按第 9.1 节的约定这里是新写的一份、不 import 那边的代码。
 */
const compressAvatarFile = (file) => new Promise((resolve, reject) => {
  if (!file?.type?.startsWith('image/')) {
    reject(new Error('请选择有效的图片文件。'));
    return;
  }

  const reader = new FileReader();
  reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'));

  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error('图片无法处理，请尝试其他文件。'));

    image.onload = () => {
      const maxEdge = 512;
      const longestEdge = Math.max(image.width, image.height);
      const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1;
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('当前浏览器无法处理图片。'));
        return;
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };

    image.src = String(reader.result || '');
  };

  reader.readAsDataURL(file);
});

// ---- 漂浮数值小动画：渲染挂在某个锚点（satiety/mood/hearts）上的一批 +N ----
const FloatingNumbers = ({ floaters, anchor, color }) => {
  const items = floaters.filter((item) => item.anchor === anchor);
  if (items.length === 0) return null;

  return (
    <>
      {items.map((item, index) => (
        <span
          key={item.id}
          className="cp-floating-number"
          style={{ right: 0, top: '-2px', color, marginRight: `${index * 18}px` }}
        >
          {item.text}
        </span>
      ))}
    </>
  );
};

const StatBar = ({ icon: Icon, label, value, floaters, anchor }) => (
  <div className="mb-4">
    <div
      className="relative mb-1.5 flex items-center justify-between text-[12px]"
      style={{ color: 'var(--text-sub)' }}
    >
      <span className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="relative font-medium" style={{ color: 'var(--text-main)' }}>
        {Math.round(value)}
        <FloatingNumbers floaters={floaters} anchor={anchor} color="var(--accent-color)" />
      </span>
    </div>
    <div
      className="h-3 w-full overflow-hidden rounded-full"
      style={{ background: 'var(--control-soft-bg)' }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          borderRadius: '9999px',
          background: 'var(--accent-color)',
          transition: 'width 300ms ease',
        }}
      />
    </div>
  </div>
);

const ACTIONS = [
  { id: 'feed', label: '喂食', icon: UtensilsCrossed },
  { id: 'clean', label: '清洁', icon: Droplets },
  { id: 'play', label: '玩耍', icon: Gamepad2 },
];

const FLOATER_LIFETIME_MS = 1100;

const CompanionPage = ({ chatId, character, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [companion, setCompanion] = useState(null);
  const [logs, setLogs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showScenePicker, setShowScenePicker] = useState(false);
  const [isPoking, setIsPoking] = useState(false);
  const [floaters, setFloaters] = useState([]);

  // 领养表单
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_AVATARS[0]?.id || null);
  const [uploadedAvatar, setUploadedAvatar] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [isAdopting, setIsAdopting] = useState(false);
  const [adoptError, setAdoptError] = useState('');

  // 改名
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  const feedbackTimerRef = useRef(null);
  const pokeTimerRef = useRef(null);
  const avatarInputRef = useRef(null);
  const adoptFileInputRef = useRef(null);
  const floaterTimersRef = useRef([]);

  const reload = async () => {
    const found = await getCompanionByChat(chatId);
    setCompanion(found);

    if (found) {
      const [recentLogs, ownedItems] = await Promise.all([
        getRecentLogs(found.id),
        getInventory(found.id),
      ]);
      setLogs(recentLogs);
      setInventory(ownedItems);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void reload();
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (pokeTimerRef.current) window.clearTimeout(pokeTimerRef.current);
      floaterTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      floaterTimersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const showFeedback = (text) => {
    setFeedback(text);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(''), 4000);
  };

  // ---- 漂浮数值：喂食/清洁/玩耍/戳一戳之后，在对应的数值条上飘一个 +N ----
  const spawnFloater = (anchor, text) => {
    const id = `${anchor}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFloaters((prev) => [...prev, { id, anchor, text }]);
    const timerId = window.setTimeout(() => {
      setFloaters((prev) => prev.filter((item) => item.id !== id));
    }, FLOATER_LIFETIME_MS);
    floaterTimersRef.current.push(timerId);
  };

  const spawnDeltaFloaters = (before, after) => {
    if (!before || !after) return;

    const satietyDelta = Math.round(after.satiety - before.satiety);
    const moodDelta = Math.round(after.mood - before.mood);
    const heartsDelta = Math.round((after.hearts - before.hearts) * 10) / 10;

    if (satietyDelta !== 0) spawnFloater('satiety', `${satietyDelta > 0 ? '+' : ''}${satietyDelta}`);
    if (moodDelta !== 0) spawnFloater('mood', `${moodDelta > 0 ? '+' : ''}${moodDelta}`);
    if (heartsDelta !== 0) spawnFloater('hearts', `${heartsDelta > 0 ? '+' : ''}${heartsDelta}`);
  };

  const handlePickAdoptFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await compressAvatarFile(file);
      setUploadedAvatar(dataUrl);
      setSelectedPreset(null);
      setAdoptError('');
    } catch (error) {
      setAdoptError(error.message || '图片处理失败');
    }
  };

  const handleAdopt = async () => {
    const avatarUrl = uploadedAvatar || DEFAULT_AVATARS.find((item) => item.id === selectedPreset)?.url;

    if (!avatarUrl) {
      setAdoptError('先选一个形态，或上传自己的图。');
      return;
    }
    if (!nameDraft.trim()) {
      setAdoptError('给它起个名字吧。');
      return;
    }

    setIsAdopting(true);
    setAdoptError('');

    try {
      await adoptCompanion({
        chatId,
        characterId: character?.id ?? null,
        name: nameDraft.trim(),
        avatarUrl,
      });
      await reload();
    } catch (error) {
      setAdoptError(error.message || '领养失败，请重试。');
    } finally {
      setIsAdopting(false);
    }
  };

  const handleChangeAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !companion) return;

    try {
      const dataUrl = await compressAvatarFile(file);
      const updated = await updateCompanionAvatar(companion.id, dataUrl);
      setCompanion(updated);
    } catch (error) {
      showFeedback(error.message || '换图失败，请重试。');
    }
  };

  const handleFreeAction = async (actionType) => {
    if (!companion || isActing) return;
    setIsActing(true);
    const before = companion;

    try {
      const result = await performFreeAction(companion.id, actionType);
      if (result) {
        spawnDeltaFloaters(before, result.companion);
        setCompanion(result.companion);
        showFeedback(result.feedbackText);
        setLogs(await getRecentLogs(companion.id));
      }
    } catch (error) {
      showFeedback('这次没成功，稍后再试试。');
    } finally {
      setIsActing(false);
    }
  };

  const handlePoke = async () => {
    if (!companion) return;
    const before = companion;

    setIsPoking(true);
    if (pokeTimerRef.current) window.clearTimeout(pokeTimerRef.current);
    pokeTimerRef.current = window.setTimeout(() => setIsPoking(false), 260);

    try {
      const result = await pokeCompanion(companion.id);
      if (result) {
        spawnDeltaFloaters(before, result.companion);
        setCompanion(result.companion);
        showFeedback(result.line);
      }
    } catch (error) {
      // 戳一戳很轻量，失败了就当没发生，不打扰用户
    }
  };

  const handleBuy = async (itemId) => {
    if (!companion) return;
    const updated = await buyShopItem(companion.id, itemId);
    setCompanion(updated);
    setInventory(await getInventory(companion.id));
    setLogs(await getRecentLogs(companion.id));
  };

  const handleToggleOutfit = async (itemName) => {
    if (!companion) return;
    const next = companion.equippedOutfit === itemName ? null : itemName;
    const updated = await equipOutfit(companion.id, next);
    setCompanion(updated);
  };

  const handleSelectScene = async (sceneId) => {
    if (!companion) return;
    const updated = await setCompanionScene(companion.id, sceneId);
    setCompanion(updated);
    setShowScenePicker(false);
  };

  const handleStartRename = () => {
    if (!companion) return;
    setRenameDraft(companion.name);
    setIsRenaming(true);
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setRenameDraft('');
  };

  const handleSaveRename = async () => {
    if (!companion) return;
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === companion.name) {
      setIsRenaming(false);
      return;
    }

    setIsSavingRename(true);
    try {
      const updated = await renameCompanion(companion.id, trimmed);
      setCompanion(updated);
      setIsRenaming(false);
      setLogs(await getRecentLogs(companion.id));
    } catch (error) {
      showFeedback(error.message || '改名失败，请重试。');
    } finally {
      setIsSavingRename(false);
    }
  };

  const ownedClothingNames = useMemo(() => (
    inventory
      .filter((row) => row.category === 'clothing')
      .map((row) => findShopItem(row.itemId))
      .filter(Boolean)
  ), [inventory]);

  const activeScene = useMemo(() => (
    findScene(companion?.background) || COMPANION_SCENES[0]
  ), [companion?.background]);

  const statusLine = useMemo(() => {
    if (!companion) return '';
    if (companion.satiety < 30) return '好像有点饿了呀……';
    if (companion.mood < 30) return '看起来不太开心，需要陪陪它。';
    return '状态很不错，暖暖的。';
  }, [companion]);

  const floatingBackButton = (
    <button
      type="button"
      onClick={onBack}
      title="返回"
      aria-label="返回"
      className="absolute left-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border transition-transform active:scale-90"
      style={{
        color: 'var(--text-main)',
        backgroundColor: 'var(--bg-surface, var(--card-bg))',
        borderColor: 'var(--card-border)',
      }}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );

  if (isLoading) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--bg-main)' }}>
        <div className="relative flex-1 overflow-y-auto px-4 pb-6 pt-16">
          {floatingBackButton}
        </div>
      </div>
    );
  }

  if (!companion) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden" style={{ background: 'var(--bg-main)' }}>
        <div className="relative flex-1 overflow-y-auto px-5 pb-8 pt-16">
          {floatingBackButton}

          <div className="relative mb-6 overflow-hidden rounded-[2rem] p-6 text-center" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <div
              className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full opacity-20"
              style={{ background: 'var(--accent-color)' }}
            />
            <div
              className="pointer-events-none absolute -bottom-10 -right-6 h-24 w-24 rounded-full opacity-15"
              style={{ background: 'var(--accent-color)' }}
            />
            <CompanionHeartIcon className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--accent-color)' }} />
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-sub)' }}>
              这个聊天窗还没有养小伙伴。选一个形态、起个名字，从今天开始由你和
              {character?.name ? ` ${character.name} ` : '它'}一起照顾它吧。
            </p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-3">
            {DEFAULT_AVATARS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setSelectedPreset(preset.id);
                  setUploadedAvatar(null);
                }}
                className="flex flex-col items-center gap-2 rounded-[1.5rem] p-3 transition-transform active:scale-95"
                style={{
                  border: `2px solid ${selectedPreset === preset.id && !uploadedAvatar ? 'var(--accent-color)' : 'var(--card-border)'}`,
                  background: 'var(--card-bg)',
                }}
              >
                <img src={preset.url} alt={preset.label} className="h-20 w-20 rounded-full object-cover" />
                <span className="text-[11px]" style={{ color: 'var(--text-sub)' }}>{preset.label}</span>
              </button>
            ))}
          </div>

          <input
            ref={adoptFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickAdoptFile}
          />

          <button
            type="button"
            onClick={() => adoptFileInputRef.current?.click()}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-[1.5rem] py-3 text-xs transition-transform active:scale-[0.98]"
            style={{
              border: `2px dashed ${uploadedAvatar ? 'var(--accent-color)' : 'var(--card-border)'}`,
              color: 'var(--text-sub)',
              background: 'var(--card-bg)',
            }}
          >
            {uploadedAvatar ? (
              <img src={uploadedAvatar} alt="自定义形态" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>{uploadedAvatar ? '已选择自己上传的图，点击重新选择' : '或上传自己的图片'}</span>
          </button>

          <input
            type="text"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value.slice(0, 20))}
            placeholder="给小伙伴起个名字"
            className="mb-3 w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)',
            }}
          />

          {adoptError && (
            <p className="mb-3 text-[11px]" style={{ color: '#e0685a' }}>{adoptError}</p>
          )}

          <button
            type="button"
            disabled={isAdopting}
            onClick={handleAdopt}
            className="w-full rounded-2xl py-3 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            {isAdopting ? '正在领养…' : '开始养它'}
          </button>

          <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
            形态图、名字之后都可以在这里随时重新上传/修改，场景领养之后也能换。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden" style={{ color: 'var(--text-main)' }}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ background: 'var(--bg-main)' }}>
        <div
          className="cp-scene-bg absolute inset-0"
          style={{ backgroundImage: `url(${activeScene.url})` }}
        />
        <div className="absolute inset-0" style={{ background: 'var(--bg-main)', opacity: 0.5 }} />
      </div>

      <div className="relative flex-1 overflow-y-auto px-5 pb-6 pt-16">
        {floatingBackButton}

        <button
          type="button"
          onClick={() => setShowScenePicker(true)}
          title="换场景"
          aria-label="换场景"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border transition-transform active:scale-90"
          style={{
            color: 'var(--text-main)',
            backgroundColor: 'var(--bg-surface, var(--card-bg))',
            borderColor: 'var(--card-border)',
          }}
        >
          <Palette className="h-4 w-4" />
        </button>

        {/* 头像区：大一圈、带柔和光晕装饰，点一下会"戳一戳" */}
        <div
          className="relative mb-5 overflow-hidden rounded-[2rem] px-5 pb-5 pt-8 text-center"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 10px 30px -18px rgba(0,0,0,0.35)' }}
        >
          <div
            className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full opacity-20"
            style={{ background: 'var(--accent-color)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-14 -right-10 h-28 w-28 rounded-full opacity-15"
            style={{ background: 'var(--accent-color)' }}
          />

          <button
            type="button"
            onClick={handlePoke}
            className="relative mx-auto mb-3 block h-28 w-28"
            style={{
              transform: isPoking ? 'scale(0.92)' : 'scale(1)',
              transition: 'transform 160ms ease',
            }}
            title="戳一戳"
            aria-label="戳一戳"
          >
            <img
              src={companion.avatarUrl}
              alt={companion.name}
              className="h-28 w-28 rounded-full object-cover"
              style={{ border: '3px solid var(--card-bg)', boxShadow: '0 0 0 2px var(--card-border)' }}
            />
            <span
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              <Hand className="h-4 w-4" />
            </span>
          </button>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChangeAvatar}
          />

          <div className="mb-1 flex items-center justify-center gap-1.5">
            {isRenaming ? (
              <>
                <input
                  type="text"
                  autoFocus
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value.slice(0, 20))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSaveRename();
                    if (event.key === 'Escape') handleCancelRename();
                  }}
                  className="w-28 rounded-full px-3 py-1 text-center text-sm outline-none"
                  style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
                />
                <button
                  type="button"
                  onClick={handleSaveRename}
                  disabled={isSavingRename}
                  aria-label="保存名字"
                  className="flex h-6 w-6 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-50"
                  style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelRename}
                  aria-label="取消改名"
                  className="flex h-6 w-6 items-center justify-center rounded-full transition-transform active:scale-90"
                  style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="text-lg font-medium" style={{ color: 'var(--text-main)' }}>{companion.name}</span>
                <button
                  type="button"
                  onClick={handleStartRename}
                  aria-label="改名字"
                  title="改名字"
                  className="flex h-6 w-6 items-center justify-center rounded-full opacity-70 transition-transform active:scale-90 hover:opacity-100"
                  style={{ background: 'var(--control-soft-bg)' }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <span className="relative flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}>
                  <CompanionHeartIcon className="h-3.5 w-3.5" style={{ color: 'var(--accent-color)' }} />
                  {companion.hearts}
                  <FloatingNumbers floaters={floaters} anchor="hearts" color="var(--accent-color)" />
                </span>
              </>
            )}
          </div>

          <p className="text-[12px]" style={{ color: 'var(--text-sub)' }}>{statusLine}</p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            当前穿着：{companion.equippedOutfit || '什么都没穿'}
          </p>

          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="mx-auto mt-3 flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] transition-transform active:scale-95"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-sub)' }}
          >
            <Upload className="h-3 w-3" />
            更换形态图
          </button>
        </div>

        {feedback && (
          <div
            className="mb-4 rounded-2xl px-4 py-2.5 text-[13px] animate-fade-in-up"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
          >
            {feedback}
          </div>
        )}

        {/* 数值条卡片 */}
        <div className="mb-4 rounded-[1.75rem] p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 10px 30px -20px rgba(0,0,0,0.35)' }}>
          <StatBar icon={UtensilsCrossed} label="饱食度" value={companion.satiety} floaters={floaters} anchor="satiety" />
          <StatBar icon={Sparkles} label="心情" value={companion.mood} floaters={floaters} anchor="mood" />
        </div>

        {/* 互动按钮卡片 */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          {ACTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={isActing}
              onClick={() => handleFreeAction(id)}
              className="flex flex-col items-center gap-1.5 rounded-[1.5rem] py-4 text-xs transition-transform active:scale-90 disabled:opacity-60"
              style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
            >
              <Icon className="h-5 w-5" style={{ color: 'var(--accent-color)' }} />
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowShop(true)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-[1.5rem] py-3.5 text-sm font-medium transition-transform active:scale-[0.98]"
          style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          <Store className="h-4 w-4" />
          <span>去商店</span>
          <span className="flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-[11px]">
            <CompanionHeartIcon className="h-3 w-3" />
            {companion.hearts}
          </span>
        </button>

        {ownedClothingNames.length > 0 && (
          <div className="mb-4 rounded-[1.5rem] p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <p className="mb-3 text-[12px]" style={{ color: 'var(--text-sub)' }}>穿着</p>
            <div className="flex flex-wrap gap-2">
              {ownedClothingNames.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleOutfit(item.name)}
                  className="rounded-full px-3.5 py-1.5 text-[12px] transition-transform active:scale-95"
                  style={{
                    background: companion.equippedOutfit === item.name ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                    color: companion.equippedOutfit === item.name ? 'var(--accent-foreground)' : 'var(--text-main)',
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pb-4">
          <p className="mb-2 text-[12px]" style={{ color: 'var(--text-sub)' }}>最近的动态</p>
          <div className="space-y-2.5">
            {logs.length === 0 && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>还没有记录。</p>
            )}
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-[1.25rem] px-4 py-3 text-[12px] leading-relaxed"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)' }}
              >
                {log.logType === 'co_care' && (
                  <span className="mr-1 opacity-70">
                    {character?.name || 'TA'} 自己来看过：
                  </span>
                )}
                {log.content}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showShop && (
        <CompanionShopModal
          hearts={companion.hearts}
          ownedClothingIds={ownedClothingNames.map((item) => item.id)}
          onBuy={handleBuy}
          onClose={() => setShowShop(false)}
        />
      )}

      {showScenePicker && (
        <CompanionSceneModal
          currentSceneId={activeScene.id}
          onSelect={handleSelectScene}
          onClose={() => setShowScenePicker(false)}
        />
      )}
    </div>
  );
};

export default CompanionPage;