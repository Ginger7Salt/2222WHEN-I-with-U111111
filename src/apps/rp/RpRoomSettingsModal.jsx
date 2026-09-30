// src/apps/rp/RpRoomSettingsModal.jsx
//
// RP模式的会话设置面板（齿轮按钮打开）。用户反馈"之前有一个齿轮按钮"，
// 经过完整排查确认RP这边从来没做过这个面板（跟user人设/背景图相关的字段
// 早就存在 rpSessions/characters 表里了，就是一直没有编辑入口——见
// rpService.js 和 RpMessageCard.jsx 顶部注释）。这个文件是照抄
// BubbleRoomSettingsModal.jsx 的结构和图片上传/压缩写法新建的，不是恢复
// 什么旧代码。
//
// 分成五块：
// 1. 整间聊天室背景图（bgImage/bgOpacity/isBgDimmed）——跟泡泡模式的
//    BubbleRoomSettingsModal 同一套字段名、同一套"淡化叠加/显示原图"逻辑。
// 2. 头像背后的背景图（avatarBackdropEnabled/avatarBackdropImage）——注意
//    这跟上面①是两回事：①是整个房间的底图，这个是角色和user头像各自背后
//    单独的一小块装饰图，关掉就是透明，不会用①的图顶替。也跟
//    RpMessageCard.jsx 里 message.sceneImage（每条消息自己的场景图）是第
//    三件事，互不影响。
// 3. 本会话的user人设（userName/userPersona/userTitle/userSignature/
//    userBadgeImage）——这些字段只属于这一局会话，不会影响用户在别的RP
//    会话或者别的app里的人设。
// 4. 角色的签名/徽章（character.rpTitle/rpSignature/rpBadgeImage）——这些
//    字段是挂在角色卡本身上的，不是挂在会话上，所以改了之后这个角色在
//    "所有"用到TA的RP会话里都会看到新的签名/徽章，这一点在UI里明确提示
//    用户，不能让人以为只改了当前这一局。
// 5. 前情提要：编辑当前 summaryText（手动改一次，旧版本会自动存进
//    summaryHistory，不会丢），以及展开查看最近的历史版本列表（只读）。
//
// 图片上传统一复用 snapshots 那边已经在用的 compressImageFile（限制最大
// 尺寸+压缩质量，不是snapshot专属的逻辑，这个工具函数本来就是通用的，没
// 有理由再写一份）。

import React, { useRef, useState } from 'react';
import {
  X, Upload, Trash2, Eye, EyeOff, Image as ImageIcon, User, Tag, ScrollText, ChevronDown, ChevronUp,
} from 'lucide-react';

import db from '../../db';
import { compressImageFile } from '../snapshots/services/snapshotMediaService';
import {
  updateRpSessionBackground,
  updateRpSessionAvatarBackdrop,
  updateRpSessionUserProfile,
  updateRpSessionSummaryManual,
} from './rpService';

const SectionCard = ({ icon: Icon, title, tag, description, children }) => (
  <div
    className="space-y-2.5 p-3 rounded-2xl border w-full"
    style={{
      background: 'var(--control-soft-bg)',
      borderColor: 'var(--card-border)',
    }}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 font-bold text-[11px]">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
        <span>{title}</span>
      </div>
      {tag && <span className="font-mono text-[9px] opacity-45">{tag}</span>}
    </div>

    {description && (
      <p className="text-[10px] opacity-55 leading-relaxed">{description}</p>
    )}

    {children}
  </div>
);

const ImagePickerRow = ({ label, imageUrl, onPick, onClear, shape = 'square' }) => {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImageFile(file, 1200, 1200, 0.82);
      onPick(dataUrl);
    } catch (err) {
      console.error('[RpRoomSettingsModal] 图片处理失败:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`w-12 h-12 border flex items-center justify-center cursor-pointer overflow-hidden shrink-0 ${shape === 'circle' ? 'rounded-full' : 'rounded-2xl'}`}
        style={{ background: 'var(--bg-main)', borderColor: 'var(--divider)' }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <ImageIcon className="w-4 h-4 opacity-40" />
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <div className="flex-1 flex flex-col gap-1">
        <span className="text-[10px] opacity-60">{label}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-1.5 rounded-xl border text-center font-medium text-[11px] disabled:opacity-50"
            style={{ background: 'var(--bg-main)', borderColor: 'var(--divider)', color: 'var(--text-main)' }}
          >
            <span className="inline-flex items-center gap-1">
              <Upload className="w-3 h-3" />
              {busy ? '处理中...' : imageUrl ? '更换' : '上传'}
            </span>
          </button>

          {imageUrl && (
            <button
              type="button"
              onClick={onClear}
              className="px-2.5 py-1.5 rounded-xl border text-red-500"
              style={{ borderColor: 'var(--divider)' }}
              title="清除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const formatTime = (ts) => {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
};

const RpRoomSettingsModal = ({ session, character, onClose, onSessionUpdated, onCharacterUpdated }) => {
  const [isBgDimmed, setIsBgDimmed] = useState(session?.isBgDimmed ?? true);
  const [bgOpacity, setBgOpacity] = useState(session?.bgOpacity ?? 0.3);
  const bgImage = session?.bgImage || '';

  const [avatarBackdropEnabled, setAvatarBackdropEnabled] = useState(Boolean(session?.avatarBackdropEnabled));
  const avatarBackdropImage = session?.avatarBackdropImage || '';

  const [userName, setUserName] = useState(session?.userName || '');
  const [userPersona, setUserPersona] = useState(session?.userPersona || '');
  const [userTitle, setUserTitle] = useState(session?.userTitle || '');
  const [userSignature, setUserSignature] = useState(session?.userSignature || '');

  const [rpTitle, setRpTitle] = useState(character?.rpTitle || '');
  const [rpSignature, setRpSignature] = useState(character?.rpSignature || '');

  const [summaryDraft, setSummaryDraft] = useState(session?.summaryText || '');
  const [showHistory, setShowHistory] = useState(false);

  if (!session?.id) return null;

  const commitSession = async (patch) => {
    onSessionUpdated?.(patch);
  };

  const handleBackgroundChange = async (patch) => {
    await updateRpSessionBackground(session.id, patch);
    void commitSession(patch);
  };

  const handleToggleBgDimmed = () => {
    const next = !isBgDimmed;
    setIsBgDimmed(next);
    void handleBackgroundChange({ isBgDimmed: next });
  };

  const handleBgOpacityChange = (e) => {
    const next = Number(e.target.value);
    setBgOpacity(next);
    void handleBackgroundChange({ bgOpacity: next });
  };

  const handleToggleAvatarBackdrop = () => {
    const next = !avatarBackdropEnabled;
    setAvatarBackdropEnabled(next);
    void (async () => {
      await updateRpSessionAvatarBackdrop(session.id, { avatarBackdropEnabled: next });
      void commitSession({ avatarBackdropEnabled: next });
    })();
  };

  const handleAvatarBackdropImage = async (dataUrl) => {
    await updateRpSessionAvatarBackdrop(session.id, { avatarBackdropImage: dataUrl });
    void commitSession({ avatarBackdropImage: dataUrl });
  };

  const handleUserBadgeImage = async (dataUrl) => {
    await updateRpSessionUserProfile(session.id, { userBadgeImage: dataUrl });
    void commitSession({ userBadgeImage: dataUrl });
  };

  const handleCommitUserProfile = () => {
    const patch = {
      userName: userName.trim(),
      userPersona: userPersona.trim(),
      userTitle: userTitle.trim(),
      userSignature: userSignature.trim(),
    };
    void (async () => {
      await updateRpSessionUserProfile(session.id, patch);
      void commitSession(patch);
    })();
  };

  const handleCharacterBadgeImage = async (dataUrl) => {
    if (!character?.id) return;
    await db.characters.update(character.id, { rpBadgeImage: dataUrl });
    onCharacterUpdated?.({ rpBadgeImage: dataUrl });
  };

  const handleCommitCharacterProfile = () => {
    if (!character?.id) return;
    const patch = { rpTitle: rpTitle.trim(), rpSignature: rpSignature.trim() };
    void (async () => {
      await db.characters.update(character.id, patch);
      onCharacterUpdated?.(patch);
    })();
  };

  const handleCommitSummary = () => {
    void (async () => {
      await updateRpSessionSummaryManual(session.id, summaryDraft.trim());
      void commitSession({ summaryText: summaryDraft.trim() });
    })();
  };

  const summaryHistory = Array.isArray(session?.summaryHistory) ? [...session.summaryHistory].reverse() : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in-up">
      <div className="fixed inset-0 backdrop-blur-md bg-black/20" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] p-5 space-y-3.5 shadow-2xl text-xs z-10"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">会话设置</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. 整间聊天室背景图 */}
        <SectionCard icon={ImageIcon} title="聊天室背景图" tag="ROOM BACKGROUND">
          <div className="flex items-center justify-between">
            <span className="text-[10px] opacity-60">仅影响这一局会话</span>
            <button
              type="button"
              onClick={handleToggleBgDimmed}
              className="flex items-center gap-1.5 text-[10px] font-semibold opacity-75 hover:opacity-100"
              style={{ color: isBgDimmed ? 'var(--accent-color)' : 'var(--text-muted)' }}
            >
              {isBgDimmed ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>{isBgDimmed ? '背景已淡化' : '显示原图'}</span>
            </button>
          </div>

          <ImagePickerRow
            label={bgImage ? '更换背景图' : '选择背景图'}
            imageUrl={bgImage}
            onPick={(dataUrl) => void handleBackgroundChange({ bgImage: dataUrl })}
            onClear={() => void handleBackgroundChange({ bgImage: '' })}
          />

          {isBgDimmed && bgImage && (
            <div className="pt-2 space-y-1 border-t" style={{ borderColor: 'var(--divider)' }}>
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
                onChange={handleBgOpacityChange}
                className="w-full"
                style={{ accentColor: 'var(--accent-color)' }}
              />
            </div>
          )}
        </SectionCard>

        {/* 2. 头像背后的背景图 */}
        <SectionCard
          icon={ImageIcon}
          title="头像背后的背景图"
          tag="AVATAR BACKDROP"
          description="跟上面整间聊天室的背景图是两回事——这个只在角色和你的头像正后方显示一小块。关闭时头像背后是透明的。"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] opacity-60">在头像背后显示这张图</span>
            <button
              type="button"
              onClick={handleToggleAvatarBackdrop}
              className="flex items-center gap-1.5 text-[10px] font-semibold opacity-75 hover:opacity-100"
              style={{ color: avatarBackdropEnabled ? 'var(--accent-color)' : 'var(--text-muted)' }}
            >
              {avatarBackdropEnabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>{avatarBackdropEnabled ? '已开启' : '已关闭（透明）'}</span>
            </button>
          </div>

          {avatarBackdropEnabled && (
            <ImagePickerRow
              label={avatarBackdropImage ? '更换头像背景图' : '上传头像背景图'}
              imageUrl={avatarBackdropImage}
              onPick={(dataUrl) => void handleAvatarBackdropImage(dataUrl)}
              onClear={() => void handleAvatarBackdropImage('')}
              shape="circle"
            />
          )}
        </SectionCard>

        {/* 3. 本会话的user人设 */}
        <SectionCard
          icon={User}
          title="你的人设"
          tag="YOUR PROFILE · 本会话独立"
          description="只属于这一局会话，不会影响你在别的RP会话或其他功能里的人设。"
        >
          <div>
            <label className="block text-[10px] opacity-60 mb-1">你的称呼</label>
            <input
              type="text"
              value={userName}
              placeholder="例如：阿泽 / 主人 / User"
              onChange={(e) => setUserName(e.target.value)}
              onBlur={handleCommitUserProfile}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
              style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <label className="block text-[10px] opacity-60 mb-1">你在本局的人设</label>
            <textarea
              rows={3}
              value={userPersona}
              placeholder="性格、背景、跟角色的关系……"
              onChange={(e) => setUserPersona(e.target.value)}
              onBlur={handleCommitUserProfile}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs leading-relaxed overflow-y-auto resize-y max-h-32 min-h-[48px]"
              style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <label className="block text-[10px] opacity-60 mb-1">头衔（可选）</label>
            <input
              type="text"
              value={userTitle}
              placeholder="显示在签名旁边的小头衔"
              onChange={(e) => setUserTitle(e.target.value)}
              onBlur={handleCommitUserProfile}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
              style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <label className="block text-[10px] opacity-60 mb-1">签名文字</label>
            <input
              type="text"
              value={userSignature}
              placeholder="显示在你头像下方的一小行字"
              onChange={(e) => setUserSignature(e.target.value)}
              onBlur={handleCommitUserProfile}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
              style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            />
          </div>

          <ImagePickerRow
            label="签名徽章图（显示在签名文字前）"
            imageUrl={session?.userBadgeImage || ''}
            onPick={(dataUrl) => void handleUserBadgeImage(dataUrl)}
            onClear={() => void handleUserBadgeImage('')}
            shape="circle"
          />
        </SectionCard>

        {/* 4. 角色的签名/徽章（角色级别，不是会话级别） */}
        {character?.id && (
          <SectionCard
            icon={Tag}
            title="角色的签名/徽章"
            tag="CHARACTER · 影响这个角色的所有会话"
            description="这几项存在角色卡本身上，不是存在这一局会话里——改了之后，这个角色在其他RP会话里也会用新的签名/徽章，不只是当前这一局。"
          >
            <div>
              <label className="block text-[10px] opacity-60 mb-1">头衔（可选）</label>
              <input
                type="text"
                value={rpTitle}
                placeholder="显示在角色签名旁边的小头衔"
                onChange={(e) => setRpTitle(e.target.value)}
                onBlur={handleCommitCharacterProfile}
                className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
                style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label className="block text-[10px] opacity-60 mb-1">签名文字</label>
              <input
                type="text"
                value={rpSignature}
                placeholder="显示在角色头像下方的一小行字"
                onChange={(e) => setRpSignature(e.target.value)}
                onBlur={handleCommitCharacterProfile}
                className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
                style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
              />
            </div>

            <ImagePickerRow
              label="签名徽章图（显示在签名文字前）"
              imageUrl={character?.rpBadgeImage || ''}
              onPick={(dataUrl) => void handleCharacterBadgeImage(dataUrl)}
              onClear={() => void handleCharacterBadgeImage('')}
              shape="circle"
            />
          </SectionCard>
        )}

        {/* 5. 前情提要：编辑 + 历史 */}
        <SectionCard
          icon={ScrollText}
          title="前情提要"
          tag="SUMMARY"
          description="每隔一段楼层AI会自动重新总结一次并整份覆盖这里的文本；你也可以手动改。改之前的旧版本都会存进下面的历史里，不会丢。"
        >
          <textarea
            rows={4}
            value={summaryDraft}
            placeholder="还没有生成过前情提要"
            onChange={(e) => setSummaryDraft(e.target.value)}
            onBlur={handleCommitSummary}
            className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs leading-relaxed overflow-y-auto resize-y max-h-40 min-h-[64px]"
            style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
          />

          {summaryHistory.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-semibold opacity-70 hover:opacity-100"
              >
                {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>{showHistory ? '收起历史版本' : `查看历史版本（${summaryHistory.length}）`}</span>
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                  {summaryHistory.map((entry, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border px-2.5 py-2 text-[10.5px] leading-relaxed opacity-70"
                      style={{ borderColor: 'var(--divider)', backgroundColor: 'var(--bg-main)' }}
                    >
                      <div className="mb-1 text-[9px] opacity-50">{formatTime(entry.archivedAt)}</div>
                      <div className="whitespace-pre-wrap">{entry.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default RpRoomSettingsModal;