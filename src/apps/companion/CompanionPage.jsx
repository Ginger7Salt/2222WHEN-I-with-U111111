import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Heart, PawPrint, Store, Upload } from 'lucide-react';

import {
  adoptCompanion,
  buyShopItem,
  equipOutfit,
  getCompanionByChat,
  getInventory,
  getRecentLogs,
  performFreeAction,
  updateCompanionAvatar,
} from './companionService';
import { DEFAULT_AVATARS, findShopItem } from './companionShopData';
import CompanionShopModal from './CompanionShopModal';

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

const StatBar = ({ label, value }) => (
  <div className="mb-3">
    <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--text-sub)' }}>
      <span>{label}</span>
      <span>{Math.round(value)}</span>
    </div>
    <div
      className="h-2 w-full overflow-hidden rounded-full"
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

const CompanionPage = ({ chatId, character, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [companion, setCompanion] = useState(null);
  const [logs, setLogs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [showShop, setShowShop] = useState(false);

  // 领养表单
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_AVATARS[0]?.id || null);
  const [uploadedAvatar, setUploadedAvatar] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [isAdopting, setIsAdopting] = useState(false);
  const [adoptError, setAdoptError] = useState('');

  const feedbackTimerRef = useRef(null);
  const avatarInputRef = useRef(null);
  const adoptFileInputRef = useRef(null);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const showFeedback = (text) => {
    setFeedback(text);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(''), 4000);
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

    try {
      const result = await performFreeAction(companion.id, actionType);
      if (result) {
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

  const ownedClothingNames = useMemo(() => (
    inventory
      .filter((row) => row.category === 'clothing')
      .map((row) => findShopItem(row.itemId))
      .filter(Boolean)
  ), [inventory]);

  const statusLine = useMemo(() => {
    if (!companion) return '';
    if (companion.satiety < 30) return '好像有点饿了……';
    if (companion.mood < 30) return '看起来不太开心，需要陪陪它。';
    return '看起来状态不错。';
  }, [companion]);

  const headerBar = (
    <div
      className="flex items-center gap-2 border-b px-4 py-3"
      style={{ borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center justify-center rounded-full p-2 opacity-80 transition-opacity hover:opacity-100"
        style={{ background: 'var(--control-soft-bg)' }}
        title="返回"
        aria-label="返回"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <PawPrint className="h-4 w-4" />
      <span className="text-sm font-medium">小伙伴</span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] flex-col" style={{ background: 'var(--bg-main)' }}>
        {headerBar}
      </div>
    );
  }

  if (!companion) {
    return (
      <div className="flex h-[100dvh] flex-col" style={{ background: 'var(--bg-main)' }}>
        {headerBar}

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-4 text-xs" style={{ color: 'var(--text-sub)' }}>
            这个聊天窗还没有养小伙伴。选一个形态、起个名字，从今天开始由你和
            {character?.name ? ` ${character.name} ` : '它'}一起照顾它吧。
          </p>

          <div className="mb-4 grid grid-cols-3 gap-3">
            {DEFAULT_AVATARS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setSelectedPreset(preset.id);
                  setUploadedAvatar(null);
                }}
                className="flex flex-col items-center gap-1 rounded-2xl p-2 transition-opacity"
                style={{
                  border: `2px solid ${selectedPreset === preset.id && !uploadedAvatar ? 'var(--accent-color)' : 'var(--card-border)'}`,
                  background: 'var(--card-bg)',
                }}
              >
                <img src={preset.url} alt={preset.label} className="h-16 w-16 rounded-full object-cover" />
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
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-2 text-xs"
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
            className="mb-3 w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--bg-main)',
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
            className="w-full rounded-xl py-2 text-sm font-medium disabled:opacity-60"
            style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            {isAdopting ? '正在领养…' : '开始养它'}
          </button>

          <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            形态图之后随时可以在这里重新上传更换，名字暂时还不支持修改。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: 'var(--bg-main)' }}>
      {headerBar}

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="relative">
            <img
              src={companion.avatarUrl}
              alt={companion.name}
              className="h-20 w-20 rounded-full object-cover"
              style={{ border: '1px solid var(--card-border)' }}
            />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleChangeAvatar}
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: 'var(--control-soft-bg)', border: '1px solid var(--card-border)' }}
              title="更换形态图"
              aria-label="更换形态图"
            >
              <Upload className="h-3 w-3" style={{ color: 'var(--text-main)' }} />
            </button>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium" style={{ color: 'var(--text-main)' }}>{companion.name}</span>
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-sub)' }}>
                <Heart className="h-3 w-3" style={{ color: 'var(--accent-color)' }} />
                {companion.hearts}
              </span>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-sub)' }}>{statusLine}</p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              当前穿着：{companion.equippedOutfit || '什么都没穿'}
            </p>
          </div>
        </div>

        <StatBar label="饱食度" value={companion.satiety} />
        <StatBar label="心情" value={companion.mood} />

        {feedback && (
          <div
            className="mb-3 rounded-xl px-3 py-2 text-xs"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
          >
            {feedback}
          </div>
        )}

        <div className="mb-4 grid grid-cols-3 gap-2">
          {['feed', 'clean', 'play'].map((actionType) => (
            <button
              key={actionType}
              type="button"
              disabled={isActing}
              onClick={() => handleFreeAction(actionType)}
              className="rounded-xl py-2 text-xs disabled:opacity-60"
              style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
            >
              {actionType === 'feed' ? '喂食' : actionType === 'clean' ? '清洁' : '玩耍'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowShop(true)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs"
          style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}
        >
          <Store className="h-4 w-4" />
          <span>去商店（{companion.hearts} ❤️）</span>
        </button>

        {ownedClothingNames.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[11px]" style={{ color: 'var(--text-sub)' }}>穿着</p>
            <div className="flex flex-wrap gap-2">
              {ownedClothingNames.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleOutfit(item.name)}
                  className="rounded-full px-3 py-1 text-[11px]"
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

        <div>
          <p className="mb-2 text-[11px]" style={{ color: 'var(--text-sub)' }}>最近的动态</p>
          <div className="space-y-2">
            {logs.length === 0 && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>还没有记录。</p>
            )}
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl px-3 py-2 text-[11px]"
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
    </div>
  );
};

export default CompanionPage;