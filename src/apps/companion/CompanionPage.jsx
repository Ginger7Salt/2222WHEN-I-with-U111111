import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Droplets,
  Gamepad2,
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
  claimCompanionEvent,
  equipOutfit,
  getActiveEvents,
  getInventory,
  getRecentLogs,
  openCompanionSession,
  performFreeAction,
  pokeCompanion,
  renameCompanion,
  setCompanionScene,
  updateCompanionAvatar,
  useLegendaryFood,
} from './companionService';
import { DEFAULT_AVATARS, findScene, findShopItem, getAllSceneOptions } from './companionShopData';
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
          style={{ color, '--cp-i': index }}
        >
          {item.text}
        </span>
      ))}
    </>
  );
};

// 数值量杯：竖着的果冻管，液面随 value 升降。props 与之前的横条保持一致。
const StatBar = ({ icon: Icon, label, value, floaters, anchor }) => (
  <div className={`cp-gauge-col cp-gauge-${anchor}`}>
    <div className="cp-gauge-icon">
      <Icon className="cp-ic" />
    </div>
    <div
      className="cp-gauge"
      role="img"
      aria-label={`${label} ${Math.round(value)}`}
      title={label}
    >
      <div
        className="cp-liquid"
        style={{ height: `${Math.max(0, Math.min(100, value))}%` }}
      >
        <i />
        <i />
        <i />
      </div>
    </div>
    <span className="cp-gauge-value">
      {Math.round(value)}
      <FloatingNumbers floaters={floaters} anchor={anchor} color="var(--cp-accent)" />
    </span>
    <span className="cp-gauge-label">{label}</span>
  </div>
);

const ACTIONS = [
  { id: 'feed', label: '喂食', icon: UtensilsCrossed, tone: 'sun', anim: 'munch', particle: 'crumb' },
  { id: 'clean', label: '清洁', icon: Droplets, tone: 'sky', anim: 'wiggle', particle: 'bubble' },
  { id: 'play', label: '玩耍', icon: Gamepad2, tone: 'mint', anim: 'hop', particle: 'spark' },
];

const FLOATER_LIFETIME_MS = 1100;

// 领取事件时的彩纸：位置按序号算好，渲染时不依赖随机数
const CONFETTI_PIECES = Array.from({ length: 26 }, (_, index) => {
  const angle = index * 2.399;
  const radius = 110 + (index % 5) * 28;
  return {
    id: index,
    dx: Math.round(Math.cos(angle) * radius),
    dy: Math.round(Math.sin(angle) * radius - 70),
    rot: ((index * 67) % 720) - 360,
    tone: index % 5,
  };
});

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
  const [eventPopup, setEventPopup] = useState(null);

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

  // 纯视觉用的状态：抽屉开合、标签页、动作动画、粒子、彩纸、场景切换
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('logs');
  const [actionAnim, setActionAnim] = useState('');
  const [particles, setParticles] = useState([]);
  const [hasPoked, setHasPoked] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [shownSceneUrl, setShownSceneUrl] = useState('');
  const [revealSceneUrl, setRevealSceneUrl] = useState(null);

  const feedbackTimerRef = useRef(null);
  const pokeTimerRef = useRef(null);
  const animTimerRef = useRef(null);
  const avatarInputRef = useRef(null);
  const adoptFileInputRef = useRef(null);
  const floaterTimersRef = useRef([]);
  const rootRef = useRef(null);
  const sheetRef = useRef(null);
  const peekRef = useRef(null);
  const dragRef = useRef(null);
  const sceneInitRef = useRef(false);

  const reload = async () => {
    const { companion: found, newEvents } = await openCompanionSession(chatId);
    setCompanion(found);

    if (found) {
      const [recentLogs, ownedItems] = await Promise.all([
        getRecentLogs(found.id),
        getInventory(found.id),
      ]);
      setLogs(recentLogs);
      setInventory(ownedItems);

      // 新出现的事件，自动弹一个详情（只弹第一个，另一个留在横幅里点开看）。
      if (newEvents.length > 0) {
        setEventPopup(newEvents[0]);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void reload();
    return () => {
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (pokeTimerRef.current) window.clearTimeout(pokeTimerRef.current);
      if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
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

  // ---- 纯视觉：小伙伴身上的粒子（面包屑/泡泡/星光/爱心/波纹） ----
  const spawnParticles = (kind, count, gap = 70) => {
    const stamp = Date.now();
    const batch = Array.from({ length: count }, (_, index) => ({
      id: `${kind}-${stamp}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      dx: Math.round((Math.random() * 2 - 1) * 70),
      dy: Math.round(-(20 + Math.random() * 90)),
      size: kind === 'ripple' ? 44 : Math.round(10 + Math.random() * 12),
      delay: index * gap,
    }));

    setParticles((prev) => [...prev, ...batch]);
    const timerId = window.setTimeout(() => {
      setParticles((prev) => prev.filter((item) => !batch.some((entry) => entry.id === item.id)));
    }, 2000 + count * gap);
    floaterTimersRef.current.push(timerId);
  };

  const playPetAnimation = (name, duration) => {
    setActionAnim(name);
    if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
    animTimerRef.current = window.setTimeout(() => setActionAnim(''), duration);
  };

  const playActionEffect = (actionType) => {
    const action = ACTIONS.find((item) => item.id === actionType);
    if (!action) return;
    playPetAnimation(action.anim, action.anim === 'munch' ? 1400 : 1000);
    spawnParticles(action.particle, action.particle === 'bubble' ? 10 : 8, action.particle === 'spark' ? 40 : 80);
  };

  const burstConfetti = () => {
    setConfettiKey(Date.now());
    const timerId = window.setTimeout(() => setConfettiKey(0), 1500);
    floaterTimersRef.current.push(timerId);
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
        playActionEffect(actionType);
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

    setHasPoked(true);
    setIsPoking(true);
    if (pokeTimerRef.current) window.clearTimeout(pokeTimerRef.current);
    pokeTimerRef.current = window.setTimeout(() => setIsPoking(false), 520);

    try {
      const result = await pokeCompanion(companion.id);
      if (result) {
        spawnParticles('ripple', 1);
        spawnParticles('heart', 1);
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
    if (next) spawnParticles('spark', 5, 50);
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

  const ownedSceneIds = useMemo(() => (
    inventory.filter((row) => row.category === 'scene').map((row) => row.itemId)
  ), [inventory]);

  const activeEvents = useMemo(() => (
    companion ? getActiveEvents(companion) : []
  ), [companion]);

  const handleClaimEvent = async (activeEventId) => {
    if (!companion) return;
    burstConfetti();
    const updated = await claimCompanionEvent(companion.id, activeEventId);
    if (updated) setCompanion(updated);
    setEventPopup(null);
  };

  const handleUseLegendaryFood = async (foodId) => {
    if (!companion) return;
    const updated = await useLegendaryFood(companion.id, foodId);
    setCompanion(updated);
    setLogs(await getRecentLogs(companion.id));
  };

  const handleBuyScene = async (itemId) => {
    if (!companion) return;
    const updated = await buyShopItem(companion.id, itemId);
    setCompanion(updated);
    setInventory(await getInventory(companion.id));
  };

  const activeScene = useMemo(() => (
    findScene(companion?.background) || getAllSceneOptions()[0]
  ), [companion?.background]);

  const statusLine = useMemo(() => {
    if (!companion) return '';
    if (companion.satiety < 30) return '好像有点饿了呀……';
    if (companion.mood < 30) return '看起来不太开心，需要陪陪它。';
    return '状态很不错，暖暖的。';
  }, [companion]);

  const hasCompanion = Boolean(companion);
  const activeSceneUrl = activeScene?.url || '';

  // ---- 场景切换：新场景从调色板按钮处圆形展开，盖住旧场景 ----
  useEffect(() => {
    if (!hasCompanion) return undefined;

    if (!sceneInitRef.current) {
      sceneInitRef.current = true;
      setShownSceneUrl(activeSceneUrl);
      return undefined;
    }
    if (activeSceneUrl === shownSceneUrl) return undefined;

    setRevealSceneUrl(activeSceneUrl);
    const timerId = window.setTimeout(() => {
      setShownSceneUrl(activeSceneUrl);
      setRevealSceneUrl(null);
    }, 780);
    return () => window.clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSceneUrl, hasCompanion]);

  // ---- 底部抽屉：直接操作 DOM 的 transform，拖动时不触发 React 重渲染 ----
  const applySheet = (open) => {
    const sheet = sheetRef.current;
    const peek = peekRef.current;
    const root = rootRef.current;
    if (!sheet || !peek || !root) return;

    const offset = sheet.offsetHeight - peek.offsetHeight;
    sheet.style.transform = open ? 'translateY(0)' : `translateY(${offset}px)`;
    root.style.setProperty('--cp-p', open ? '1' : '0');
  };

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return undefined;

    applySheet(sheetOpen);
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => applySheet(sheetOpen));
    observer.observe(sheet);
    if (peekRef.current) observer.observe(peekRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasCompanion, sheetOpen]);

  const handleSheetPointerDown = (event) => {
    if (event.target.closest('.cp-dock-btn')) return;
    const sheet = sheetRef.current;
    const peek = peekRef.current;
    if (!sheet || !peek) return;

    const offset = sheet.offsetHeight - peek.offsetHeight;
    dragRef.current = {
      startY: event.clientY,
      from: sheetOpen ? 0 : offset,
      offset,
      moved: false,
      last: null,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleSheetPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || !sheetRef.current || !rootRef.current) return;

    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) < 5) return;

    drag.moved = true;
    rootRef.current.dataset.dragging = '1';
    const next = Math.max(0, Math.min(drag.offset, drag.from + deltaY));
    drag.last = next;
    sheetRef.current.style.transform = `translateY(${next}px)`;
    rootRef.current.style.setProperty('--cp-p', String(1 - next / (drag.offset || 1)));
  };

  const handleSheetPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (rootRef.current) delete rootRef.current.dataset.dragging;

    if (!drag.moved) {
      setSheetOpen((prev) => !prev);
      return;
    }

    const shouldOpen = (drag.last ?? drag.from) < drag.offset * 0.5;
    if (shouldOpen === sheetOpen) {
      applySheet(shouldOpen);
    } else {
      setSheetOpen(shouldOpen);
    }
  };

  const handleSheetPointerCancel = () => {
    dragRef.current = null;
    if (rootRef.current) delete rootRef.current.dataset.dragging;
    applySheet(sheetOpen);
  };

  const handleGrabberKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSheetOpen((prev) => !prev);
    }
  };

  const floatingBackButton = (
    <button
      type="button"
      onClick={onBack}
      title="返回"
      aria-label="返回"
      className="cp-round-btn cp-back"
    >
      <ArrowLeft className="cp-ic" />
    </button>
  );

  if (isLoading) {
    return (
      <div className="cp-root">
        {floatingBackButton}
        <div className="cp-loading">
          <span className="cp-loading-dot" />
          <span className="cp-loading-dot" />
          <span className="cp-loading-dot" />
        </div>
      </div>
    );
  }

  if (!companion) {
    const adoptPreviewUrl = uploadedAvatar
      || DEFAULT_AVATARS.find((item) => item.id === selectedPreset)?.url
      || '';

    return (
      <div className="cp-root cp-adopt-root">
        {floatingBackButton}
        <i className="cp-blob cp-blob-a" />
        <i className="cp-blob cp-blob-b" />

        <div className="cp-adopt-scroll">
          <div className="cp-adopt-inner">
            <div className="cp-hello">
              这个聊天窗还没有养小伙伴。选一个形态、起个名字，从今天开始由你和
              {character?.name ? ` ${character.name} ` : '它'}一起照顾它吧。
            </div>

            <div className={`cp-arch ${isAdopting ? 'is-hatching' : ''}`}>
              <div className="cp-pet cp-pet-static" key={`${selectedPreset}-${uploadedAvatar ? 'u' : 'p'}`}>
                <span className="cp-pet-ring" />
                {adoptPreviewUrl ? (
                  <img src={adoptPreviewUrl} alt="形态预览" className="cp-pet-img" draggable={false} />
                ) : (
                  <span className="cp-pet-img cp-pet-placeholder" />
                )}
              </div>
              <i className="cp-orn cp-orn-a" />
              <i className="cp-orn cp-orn-b" />
              <i className="cp-orn cp-orn-c" />
            </div>

            <div className="cp-ribbon">{nameDraft.trim() || '?'}</div>

            <div className="cp-presets">
              {DEFAULT_AVATARS.map((preset) => {
                const isOn = selectedPreset === preset.id && !uploadedAvatar;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset.id);
                      setUploadedAvatar(null);
                    }}
                    className={`cp-preset ${isOn ? 'is-on' : ''}`}
                    aria-label={preset.label}
                    aria-pressed={isOn}
                  >
                    <span className="cp-preset-face">
                      {preset.url && <img src={preset.url} alt="" draggable={false} />}
                    </span>
                    <span className="cp-preset-label">{preset.label}</span>
                  </button>
                );
              })}

              <input
                ref={adoptFileInputRef}
                type="file"
                accept="image/*"
                className="cp-hidden"
                onChange={handlePickAdoptFile}
              />
              <button
                type="button"
                onClick={() => adoptFileInputRef.current?.click()}
                className={`cp-preset cp-preset-upload ${uploadedAvatar ? 'is-on' : ''}`}
                aria-label={uploadedAvatar ? '已选择自己上传的图，点击重新选择' : '上传自己的图片'}
              >
                <span className="cp-preset-face">
                  {uploadedAvatar ? (
                    <img src={uploadedAvatar} alt="自定义形态" draggable={false} />
                  ) : (
                    <Upload className="cp-ic" />
                  )}
                </span>
                <span className="cp-preset-label">{uploadedAvatar ? '重新选择' : '上传图片'}</span>
              </button>
            </div>

            <div className="cp-name-field">
              <input
                type="text"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value.slice(0, 20))}
                placeholder="给小伙伴起个名字"
                autoComplete="off"
              />
              <small>{nameDraft.length}/20</small>
            </div>

            <p className="cp-err" key={adoptError || 'ok'}>{adoptError}</p>

            <button
              type="button"
              disabled={isAdopting}
              onClick={handleAdopt}
              className="cp-go"
            >
              {isAdopting ? '正在领养…' : '开始养它'}
            </button>

            <p className="cp-note">
              形态图、名字之后都可以在这里随时重新上传/修改，场景领养之后也能换。
            </p>
          </div>
        </div>
      </div>
    );
  }

  const bubbleText = feedback || statusLine;
  const baseSceneUrl = shownSceneUrl || activeSceneUrl;
  const sceneImageStyle = (url) => (url ? { backgroundImage: `url(${url})` } : undefined);

  return (
    <div
      className="cp-root cp-home"
      ref={rootRef}
      data-expanded={sheetOpen ? '1' : undefined}
    >
      {/* 场景：整页铺满；换场景时新图层从右上角圆形展开 */}
      <div className="cp-scene" aria-hidden="true">
        <div className="cp-scene-bg" style={sceneImageStyle(baseSceneUrl)} />
        {revealSceneUrl !== null && (
          <div
            className="cp-scene-bg cp-scene-reveal"
            style={sceneImageStyle(revealSceneUrl)}
          />
        )}
        <div className="cp-scene-veil" />
        {!baseSceneUrl && revealSceneUrl === null && (
          <>
            <i className="cp-cloud cp-cloud-a" />
            <i className="cp-cloud cp-cloud-b" />
          </>
        )}
      </div>

      {floatingBackButton}

      <button
        type="button"
        onClick={() => setShowScenePicker(true)}
        title="换场景"
        aria-label="换场景"
        className="cp-round-btn cp-palette"
      >
        <Palette className="cp-ic" />
      </button>

      {/* 特殊事件：吊牌，最多同时显示 2 个，点一下看详情/领取 */}
      {activeEvents.length > 0 && (
        <div className="cp-tags">
          {activeEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setEventPopup(event)}
              className={`cp-tag ${event.claimed ? 'is-done' : ''}`}
            >
              <b>{event.title}</b>
              <small>{event.bannerText}</small>
              {!event.claimed && <span className="cp-tag-claim">领取</span>}
            </button>
          ))}
        </div>
      )}

      {/* 舞台：左右是果冻量杯，中间是小伙伴 */}
      <div className="cp-stage">
        <StatBar icon={UtensilsCrossed} label="饱食度" value={companion.satiety} floaters={floaters} anchor="satiety" />

        <div className={`cp-zone ${actionAnim ? `is-${actionAnim}` : ''}`}>
          <div className="cp-bubble">
            <span key={bubbleText} className="cp-bubble-text">{bubbleText}</span>
          </div>

          <div className="cp-pet-wrap">
            <button
              type="button"
              onClick={handlePoke}
              className={`cp-pet ${isPoking ? 'is-poking' : ''} ${hasPoked ? '' : 'has-hint'}`}
              title="戳一戳"
              aria-label="戳一戳"
            >
              <span className="cp-pet-ring" />
              <img
                src={companion.avatarUrl}
                alt={companion.name}
                className="cp-pet-img"
                draggable={false}
              />
            </button>

            <i className="cp-orn cp-orn-a" />
            <i className="cp-orn cp-orn-b" />
            <i className="cp-orn cp-orn-c" />

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="cp-hidden"
              onChange={handleChangeAvatar}
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="cp-pet-edit"
              title="更换形态图"
              aria-label="更换形态图"
            >
              <Upload className="cp-ic" />
            </button>

            {companion.equippedOutfit && (
              <span className="cp-outfit-tag">{companion.equippedOutfit}</span>
            )}

            <div className="cp-fx" aria-hidden="true">
              {particles.map((item) => (
                <i
                  key={item.id}
                  className={`cp-p cp-p-${item.kind}`}
                  style={{
                    '--dx': `${item.dx}px`,
                    '--dy': `${item.dy}px`,
                    '--s': `${item.size}px`,
                    animationDelay: `${item.delay}ms`,
                  }}
                >
                  {item.kind === 'heart' && <CompanionHeartIcon className="cp-ic" />}
                </i>
              ))}
            </div>
          </div>

          <div className="cp-pet-shadow" />

          <div className="cp-nameplate">
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
                  className="cp-rename-input"
                />
                <button
                  type="button"
                  onClick={handleSaveRename}
                  disabled={isSavingRename}
                  aria-label="保存名字"
                  className="cp-mini-btn is-ok"
                >
                  <Check className="cp-ic" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelRename}
                  aria-label="取消改名"
                  className="cp-mini-btn"
                >
                  <X className="cp-ic" />
                </button>
              </>
            ) : (
              <>
                <span className="cp-name">{companion.name}</span>
                <button
                  type="button"
                  onClick={handleStartRename}
                  aria-label="改名字"
                  title="改名字"
                  className="cp-mini-btn"
                >
                  <Pencil className="cp-ic" />
                </button>
              </>
            )}
            <span className="cp-heart-pill">
              <CompanionHeartIcon className="cp-ic" />
              <span key={companion.hearts} className="cp-bump">{companion.hearts}</span>
              <FloatingNumbers floaters={floaters} anchor="hearts" color="var(--cp-accent)" />
            </span>
          </div>
        </div>

        <StatBar icon={Sparkles} label="心情" value={companion.mood} floaters={floaters} anchor="mood" />
      </div>

      {/* 底部抽屉：收起时只露出互动按钮，往上拖可以看动态和衣橱 */}
      <div className="cp-sheet" ref={sheetRef}>
        <div
          className="cp-sheet-peek"
          ref={peekRef}
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          onPointerCancel={handleSheetPointerCancel}
        >
          <div
            className="cp-grabber"
            role="button"
            tabIndex={0}
            aria-label={sheetOpen ? '收起面板' : '展开面板'}
            aria-expanded={sheetOpen}
            onKeyDown={handleGrabberKeyDown}
          >
            <i />
          </div>

          <div className="cp-dock">
            {ACTIONS.map(({ id, label, icon: Icon, tone }) => (
              <button
                key={id}
                type="button"
                disabled={isActing}
                onClick={() => handleFreeAction(id)}
                className={`cp-dock-btn cp-tone-${tone}`}
              >
                <span className="cp-dock-ico">
                  <Icon className="cp-ic" />
                </span>
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowShop(true)}
              className="cp-dock-btn cp-tone-pink"
            >
              <span className="cp-dock-ico">
                <Store className="cp-ic" />
                <b className="cp-badge">
                  <CompanionHeartIcon className="cp-ic" />
                  {companion.hearts}
                </b>
              </span>
              去商店
            </button>
          </div>
        </div>

        <div className="cp-sheet-body">
          <div className="cp-tabs" data-tab={activeTab}>
            <i className="cp-tabs-ind" />
            <button
              type="button"
              className={activeTab === 'logs' ? 'is-on' : ''}
              onClick={() => setActiveTab('logs')}
            >
              最近的动态
            </button>
            <button
              type="button"
              className={activeTab === 'outfit' ? 'is-on' : ''}
              onClick={() => setActiveTab('outfit')}
            >
              穿着
            </button>
          </div>

          <div className="cp-sheet-scroll">
            {activeTab === 'logs' ? (
              <div className="cp-timeline">
                {logs.length === 0 && (
                  <p className="cp-empty">还没有记录。</p>
                )}
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`cp-log ${log.logType === 'co_care' ? 'is-co' : ''}`}
                  >
                    {log.logType === 'co_care' && (
                      <span className="cp-log-who">
                        {character?.name || 'TA'} 自己来看过：
                      </span>
                    )}
                    {log.content}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p className="cp-outfit-now">
                  当前穿着：{companion.equippedOutfit || '什么都没穿'}
                </p>
                {ownedClothingNames.length === 0 ? (
                  <p className="cp-empty">还没有衣服，去商店看看吧。</p>
                ) : (
                  <div className="cp-hangers">
                    {ownedClothingNames.map((item) => {
                      const isOn = companion.equippedOutfit === item.name;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleToggleOutfit(item.name)}
                          className={`cp-hanger ${isOn ? 'is-on' : ''}`}
                          aria-pressed={isOn}
                        >
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showShop && (
        <CompanionShopModal
          hearts={companion.hearts}
          ownedClothingIds={ownedClothingNames.map((item) => item.id)}
          unlockedRareFoodIds={companion.unlockedRareFoodIds || []}
          legendaryStock={companion.legendaryStock || {}}
          onBuy={handleBuy}
          onUseLegendary={handleUseLegendaryFood}
          onClose={() => setShowShop(false)}
        />
      )}

      {showScenePicker && (
        <CompanionSceneModal
          currentSceneId={activeScene.id}
          ownedSceneIds={ownedSceneIds}
          hearts={companion.hearts}
          onSelect={handleSelectScene}
          onBuy={handleBuyScene}
          onClose={() => setShowScenePicker(false)}
        />
      )}

      {eventPopup && (
        <div className="cp-overlay">
          <div className="cp-overlay-mask" onClick={() => setEventPopup(null)} />
          <div className="cp-event-card">
            <div className="cp-gift" aria-hidden="true">
              <i className="cp-gift-box" />
              <i className="cp-gift-lid" />
              <i className="cp-gift-rib" />
              <i className="cp-gift-bow" />
            </div>
            <p className="cp-event-title">{eventPopup.title}</p>
            <p className="cp-event-text">{eventPopup.bannerText}</p>
            {eventPopup.grantsFoodId && (
              <p className="cp-event-got">
                获得了「{findShopItem(eventPopup.grantsFoodId)?.name || '新食物'}」
              </p>
            )}
            <div className="cp-btn-row">
              <button
                type="button"
                onClick={() => setEventPopup(null)}
                className="cp-btn"
              >
                先这样
              </button>
              <button
                type="button"
                onClick={() => handleClaimEvent(eventPopup.id)}
                className="cp-btn is-main"
              >
                知道啦
              </button>
            </div>
          </div>
        </div>
      )}

      {confettiKey > 0 && (
        <div className="cp-confetti" key={confettiKey} aria-hidden="true">
          {CONFETTI_PIECES.map((piece) => (
            <i
              key={piece.id}
              className={`cp-conf cp-conf-${piece.tone}`}
              style={{
                '--dx': `${piece.dx}px`,
                '--dy': `${piece.dy}px`,
                '--r': `${piece.rot}deg`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CompanionPage;