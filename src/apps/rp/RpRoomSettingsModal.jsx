// src/apps/rp/RpRoomSettingsModal.jsx
//
// RP模式的会话设置面板（齿轮按钮打开）。用户反馈"之前有一个齿轮按钮"，
// 经过完整排查确认RP这边从来没做过这个面板（跟user人设/背景图相关的字段
// 早就存在 rpSessions/characters 表里了，就是一直没有编辑入口——见
// rpService.js 和 RpMessageCard.jsx 顶部注释）。这个文件是照抄
// BubbleRoomSettingsModal.jsx 的结构和图片上传/压缩写法新建的，不是恢复
// 什么旧代码。
//
// 分成六块：
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
// 5. 前情提要：session.summaryEntries 是一个数组，每次自动总结是独立的
//    一条（不是滚动覆盖成一份大文本——跟用户确认过，总结内容不能挤在
//    一起），这里把每条都单独列出来，各自可以编辑正文、也可以单独删除
//    （删除要走 ConfirmModal 二次确认，跟预设/世界书删除的规则一致）。
// 6. 思维链折叠（foldTagNames/thinkingLabelText）——要折叠哪些标签、收起
//    时显示什么字，都是用户自己填，不写死。
//
// 图片上传统一复用 snapshots 那边已经在用的 compressImageFile（限制最大
// 尺寸+压缩质量，不是snapshot专属的逻辑，这个工具函数本来就是通用的，没
// 有理由再写一份）。

import React, { useRef, useState } from 'react';
import {
  X, Upload, Trash2, Eye, EyeOff, Image as ImageIcon, User, Tag, ScrollText, Brain,
} from 'lucide-react';

import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { compressImageFile } from '../snapshots/services/snapshotMediaService';
import {
  updateRpSessionBackground,
  updateRpSessionAvatarBackdrop,
  updateRpSessionUserProfile,
  updateRpSessionSummaryEntryText,
  deleteRpSessionSummaryEntry,
  updateRpSessionThinkingFold,
} from './rpService';
import { parseFoldTagNamesInput, DEFAULT_THINKING_LABEL_TEXT } from './rpThinkingFold';

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

// 单条总结条目：本地草稿 + onBlur 才提交，跟其他文本输入框一个写法，避免
// 每敲一个字就写一次 Dexie。
const SummaryEntryCard = ({ ordinal, entry, onCommitText, onRequestDelete }) => {
  const [draft, setDraft] = useState(entry.text || '');

  return (
    <div
      className="space-y-1.5 rounded-xl border px-2.5 py-2"
      style={{ borderColor: 'var(--divider)', backgroundColor: 'var(--bg-main)' }}
    >
      <div className="flex items-center justify-between text-[9px] opacity-50">
        <span>第 {ordinal} 次总结{entry.createdAt ? ` · ${formatTime(entry.createdAt)}` : ''}</span>
        <button
          type="button"
          onClick={() => onRequestDelete(entry.id)}
          className="text-red-500 opacity-80 hover:opacity-100"
          title="删除这一条"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommitText(entry.id, draft.trim())}
        className="w-full resize-y overflow-y-auto rounded-lg border px-2 py-1.5 text-[10.5px] leading-relaxed outline-none max-h-32 min-h-[48px]"
        style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)', color: 'var(--text-main)' }}
      />
    </div>
  );
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

  const [summaryEntries, setSummaryEntries] = useState(
    Array.isArray(session?.summaryEntries) ? session.summaryEntries : []
  );
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState(null);

  const [foldTagNamesInput, setFoldTagNamesInput] = useState(
    (Array.isArray(session?.foldTagNames) ? session.foldTagNames : ['thinking']).join('、')
  );
  const [thinkingLabelText, setThinkingLabelText] = useState(
    session?.thinkingLabelText || DEFAULT_THINKING_LABEL_TEXT
  );

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

  const handleCommitSummaryEntryText = (entryId, text) => {
    void (async () => {
      await updateRpSessionSummaryEntryText(session.id, entryId, text);
      const next = summaryEntries.map((e) => (e.id === entryId ? { ...e, text } : e));
      setSummaryEntries(next);
      void commitSession({ summaryEntries: next });
    })();
  };

  const handleDeleteSummaryEntry = (entryId) => {
    void (async () => {
      await deleteRpSessionSummaryEntry(session.id, entryId);
      const next = summaryEntries.filter((e) => e.id !== entryId);
      setSummaryEntries(next);
      void commitSession({ summaryEntries: next });
      setPendingDeleteEntryId(null);
    })();
  };

  const handleCommitThinkingFold = () => {
    const foldTagNames = parseFoldTagNamesInput(foldTagNamesInput);
    const label = thinkingLabelText.trim() || DEFAULT_THINKING_LABEL_TEXT;
    setThinkingLabelText(label);
    void (async () => {
      await updateRpSessionThinkingFold(session.id, { foldTagNames, thinkingLabelText: label });
      void commitSession({ foldTagNames, thinkingLabelText: label });
    })();
  };

  // 展示顺序是最新的在最上面，但"第几次"这个序号按发生的时间顺序算，
  // 不受展示顺序影响。
  const displayEntries = summaryEntries
    .map((entry, idx) => ({ entry, ordinal: idx + 1 }))
    .reverse();

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

        {/* 5. 前情提要：每次总结是独立条目，各自可编辑/删除 */}
        <SectionCard
          icon={ScrollText}
          title="前情提要"
          tag="SUMMARY"
          description="每隔一段楼层AI会自动生成一条新的总结，各条互不覆盖，可以单独编辑或删除。组装给AI的前情提要是把下面所有条目按发生顺序拼起来。"
        >
          {displayEntries.length === 0 ? (
            <p className="text-[10.5px] opacity-45">还没有生成过总结条目，攒够楼层数会自动生成第一条。</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {displayEntries.map(({ entry, ordinal }) => (
                <SummaryEntryCard
                  key={entry.id}
                  ordinal={ordinal}
                  entry={entry}
                  onCommitText={handleCommitSummaryEntryText}
                  onRequestDelete={setPendingDeleteEntryId}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* 6. 思维链折叠 */}
        <SectionCard
          icon={Brain}
          title="思维链折叠"
          tag="THINKING FOLD"
          description="被这里填写的标签包住的内容（比如 <thinking>...</thinking>）会被折叠成一个可展开的小条，不会直接铺在正文里。留空则不折叠任何内容。"
        >
          <div>
            <label className="block text-[10px] opacity-60 mb-1">要折叠的标签名（可填多个，用顿号/逗号分隔）</label>
            <input
              type="text"
              value={foldTagNamesInput}
              placeholder="例如：thinking、think"
              onChange={(e) => setFoldTagNamesInput(e.target.value)}
              onBlur={handleCommitThinkingFold}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs font-mono"
              style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <label className="block text-[10px] opacity-60 mb-1">折叠框收起时显示的文字</label>
            <input
              type="text"
              value={thinkingLabelText}
              placeholder={DEFAULT_THINKING_LABEL_TEXT}
              onChange={(e) => setThinkingLabelText(e.target.value)}
              onBlur={handleCommitThinkingFold}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
              style={{ background: 'var(--bg-main)', borderColor: 'var(--card-border)', color: 'var(--text-main)' }}
            />
          </div>
        </SectionCard>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingDeleteEntryId)}
        title="删除这条总结"
        message="删除之后，AI以后就看不到这一条总结覆盖的那段剧情梗概了（原始消息本身不受影响，除非已经被存档移出）。这个操作不能撤销，确定吗？"
        confirmText="删除"
        onConfirm={() => handleDeleteSummaryEntry(pendingDeleteEntryId)}
        onCancel={() => setPendingDeleteEntryId(null)}
      />
    </div>
  );
};

export default RpRoomSettingsModal;