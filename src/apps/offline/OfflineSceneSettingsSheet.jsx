// src/apps/offline/OfflineSceneSettingsSheet.jsx
//
// 线下场景专属的背景设置面板，从 OfflineChatRoom.jsx 头部的设置按钮打开。
// 存储字段 offlineBgImage / offlineBgOpacity / offlineIsBgDimmed 全部落在
// db.chats 上，但和线上聊天用的 bgImage / bgOpacity / isBgDimmed 完全独立
// 互不影响——改线下背景不会动到线上聊天室的背景，反之亦然。
// 交互方式照抄 ChatSettingsModal.jsx 里背景图配置那一块的现成写法。
import React, { useRef, useState } from 'react';
import { X, Upload, Trash2, Eye, EyeOff } from 'lucide-react';

import db from '../../db';

const OfflineSceneSettingsSheet = ({ chat, onClose, onUpdated }) => {
  const fileInputRef = useRef(null);

  const [bgImage, setBgImage] = useState(chat?.offlineBgImage || '');
  const [isBgDimmed, setIsBgDimmed] = useState(chat?.offlineIsBgDimmed ?? true);
  const [bgOpacity, setBgOpacity] = useState(chat?.offlineBgOpacity ?? 0.3);

  const persist = async (patch) => {
    if (!chat?.id) return;
    await db.chats.update(chat.id, patch);
    onUpdated?.(patch);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setBgImage(dataUrl);
      void persist({ offlineBgImage: dataUrl });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleRemoveImage = () => {
    setBgImage('');
    void persist({ offlineBgImage: '' });
  };

  const handleToggleDimmed = () => {
    const next = !isBgDimmed;
    setIsBgDimmed(next);
    void persist({ offlineIsBgDimmed: next });
  };

  const handleOpacityChange = (event) => {
    const next = Number(event.target.value);
    setBgOpacity(next);
    void persist({ offlineBgOpacity: next });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-4 text-xs"
        style={{ background: 'var(--card-bg-gradient)', color: 'var(--text-main)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">线下场景背景</span>
          <button type="button" onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="space-y-2 rounded-2xl border p-3"
          style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
        >
          <div className="flex items-center justify-between">
            <label className="block font-mono text-[10px] opacity-60">
              OFFLINE SCENE BACKGROUND / 线下专属背景
            </label>

            <button
              type="button"
              onClick={handleToggleDimmed}
              className="flex items-center gap-1.5 text-[10px] font-semibold opacity-75 transition-opacity hover:opacity-100"
              style={{ color: isBgDimmed ? 'var(--accent-color)' : 'var(--text-muted)' }}
              title="切换背景图淡化"
            >
              {isBgDimmed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              <span>{isBgDimmed ? '背景已淡化' : '显示原图'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border"
              style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}
            >
              {bgImage ? (
                <img src={bgImage} alt="线下场景背景" className="h-full w-full object-cover" />
              ) : (
                <Upload className="h-4 w-4 opacity-40" />
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            <div className="flex flex-1 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-xl border py-1.5 text-center text-[11px] font-medium transition-all"
                style={{
                  background: 'var(--control-soft-bg)',
                  borderColor: 'var(--divider)',
                  color: 'var(--text-main)',
                }}
              >
                {bgImage ? '更换背景' : '选择图片'}
              </button>

              {bgImage && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="rounded-xl border px-2.5 py-1.5 text-center font-medium text-red-500 transition-all hover:bg-red-50 dark:hover:bg-red-950/20"
                  style={{ borderColor: 'var(--divider)' }}
                  title="删除背景图"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {isBgDimmed && (
            <div className="space-y-1 border-t pt-2" style={{ borderColor: 'var(--divider)' }}>
              <div className="flex items-center justify-between text-[10px] opacity-60">
                <span>背景图透明度</span>
                <span>{Math.round(bgOpacity * 100)}%</span>
              </div>

              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={bgOpacity}
                onChange={handleOpacityChange}
                className="w-full"
                style={{ accentColor: 'var(--accent-color)' }}
              />
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-[10px] opacity-50">
          这里设置的背景只在这个聊天窗的线下场景里生效，不会影响线上聊天室的背景。
        </p>
      </div>
    </div>
  );
};

export default OfflineSceneSettingsSheet;