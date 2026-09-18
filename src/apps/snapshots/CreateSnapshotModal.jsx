// src/apps/snapshots/CreateSnapshotModal.jsx
//
// 【整体替换说明】相对上一轮的改动（本次是美化，逻辑保持不变）：
// 参考真实社交软件（IG/X）的发帖框视觉：
// 1. 顶部不再是"标题+说明文字"式弹窗头，改为 [关闭] ... [发布] 的极简顶栏，
//    发布按钮直接在右上角，未输入内容时禁用。
// 2. 大文本框直接放在最上方（配合 User 头像），像真的"分享点什么"输入框，
//    不再是一项一项 label+input 堆叠的表单感。
// 3. 图片、地点、光影描摹都改成底部工具栏的小图标按钮，点击才展开对应的
//    输入区域/预览，未使用时不占空间，减少表单的"填写感"。
// 数据写入逻辑（handleSubmitUser 的字段与 db.snapshots.add 调用）未做改动。
//
import React, { useState, useRef, useEffect } from 'react';
import db from '../../db';
import { compressImageFile } from './services/snapshotMediaService';

export const CreateSnapshotModal = ({ isOpen, onClose, currentChatId, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showImagePromptInput, setShowImagePromptInput] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);

  const [authorName, setAuthorName] = useState('我');
  const [authorAvatar, setAuthorAvatar] = useState('');

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !currentChatId) return;
    loadAuthorInfo();
    // 弹窗打开时自动聚焦文本框，贴近真实发帖框的体验
    setTimeout(() => textareaRef.current?.focus(), 60);
  }, [isOpen, currentChatId]);

  const loadAuthorInfo = async () => {
    try {
      const profileKey = `user_${currentChatId}`;
      const customProfile = await db.snapshotProfiles.get(profileKey);
      const chat = await db.chats.get(Number(currentChatId));
      setAuthorName(customProfile?.name || chat?.userName || '我');
      setAuthorAvatar(customProfile?.avatar || chat?.userAvatar || '');
    } catch (err) {
      console.error('加载作者信息失败:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1200, 1200, 0.82);
      setMediaUrl(compressed);
    } catch (err) {
      console.error('压缩图片失败:', err);
    }
  };

  const resetForm = () => {
    setContent('');
    setImagePrompt('');
    setMediaUrl('');
    setLocation('');
    setShowImagePromptInput(false);
    setShowLocationInput(false);
  };

  const handleSubmitUser = async () => {
    if (!content.trim() && !imagePrompt.trim() && !mediaUrl) return;

    setIsSubmitting(true);
    try {
      const profileKey = `user_${currentChatId}`;
      const customProfile = await db.snapshotProfiles.get(profileKey);
      const chat = await db.chats.get(Number(currentChatId));

      const finalAuthorName = customProfile?.name || chat?.userName || '我';
      const finalAuthorAvatar = customProfile?.avatar || chat?.userAvatar || '';

      await db.snapshots.add({
        chatId: Number(currentChatId),
        authorType: 'user',
        authorName: finalAuthorName,
        authorAvatar: finalAuthorAvatar,
        mediaUrl: mediaUrl || '',
        imagePrompt: imagePrompt.trim(),
        content: content.trim(),
        location: location.trim() || '某处日常',
        likes: 0,
        isLiked: false,
        timestamp: Date.now(),
        createdAt: Date.now()
      });

      resetForm();
      onPostCreated && onPostCreated();
      onClose();
    } catch (err) {
      console.error('发帖失败:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(content.trim() || imagePrompt.trim() || mediaUrl);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/60 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full sm:max-w-sm bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">

        {/* 极简顶栏：关闭 + 发布 */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900 active:scale-90 transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>

          <button
            type="button"
            onClick={handleSubmitUser}
            disabled={isSubmitting || !canSubmit}
            className="px-5 py-2 rounded-full bg-neutral-900 text-white text-xs font-bold shadow-sm active:scale-95 disabled:opacity-30 disabled:active:scale-100 transition-all"
          >
            {isSubmitting ? '发布中...' : '发布'}
          </button>
        </div>

        {/* 正文输入区：头像 + 大文本框，贴近真实发帖框 */}
        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">
              {authorAvatar ? (
                <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                authorName[0]
              )}
            </div>
            <textarea
              ref={textareaRef}
              placeholder="分享点什么..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 text-sm leading-relaxed outline-none resize-none min-h-[96px] placeholder-neutral-400 text-neutral-900 pt-1.5"
            />
          </div>

          {/* 已选图片预览 */}
          {mediaUrl && (
            <div className="relative rounded-2xl overflow-hidden bg-neutral-100 ml-12">
              <img src={mediaUrl} alt="预览" className="w-full max-h-64 object-cover" loading="lazy" decoding="async" />
              <button
                type="button"
                onClick={() => setMediaUrl('')}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs backdrop-blur-md"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          {/* 光影描摹展开输入（可选） */}
          {showImagePromptInput && (
            <div className="ml-12 flex items-start gap-2">
              <input
                type="text"
                autoFocus
                placeholder="画面光影描摹，例：窗边逆光下的温热红茶..."
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className="flex-1 text-xs italic p-2.5 rounded-xl bg-neutral-100/80 outline-none placeholder-neutral-400"
              />
              <button
                type="button"
                onClick={() => { setShowImagePromptInput(false); setImagePrompt(''); }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-300 hover:text-neutral-600 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          {/* 地点展开输入 / 已选地点 chip */}
          {showLocationInput ? (
            <div className="ml-12 flex items-center gap-2">
              <input
                type="text"
                autoFocus
                placeholder="添加地点，例：午后书房"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={() => { if (!location.trim()) setShowLocationInput(false); }}
                className="flex-1 text-xs p-2.5 rounded-xl bg-neutral-100/80 outline-none placeholder-neutral-400"
              />
              <button
                type="button"
                onClick={() => { setShowLocationInput(false); setLocation(''); }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-300 hover:text-neutral-600 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ) : location ? (
            <button
              type="button"
              onClick={() => setShowLocationInput(true)}
              className="ml-12 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-600"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {location}
            </button>
          ) : null}
        </div>

        {/* 底部工具栏：图片 / 光影描摹 / 地点，未使用时只是小图标，不占表单空间 */}
        <div className="flex items-center gap-1 px-4 py-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 active:scale-90 transition-all"
            title="添加照片"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

          <button
            type="button"
            onClick={() => setShowImagePromptInput((v) => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${
              showImagePromptInput ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
            title="光影描摹"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"/></svg>
          </button>

          <button
            type="button"
            onClick={() => setShowLocationInput((v) => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${
              showLocationInput || location ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
            title="添加地点"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSnapshotModal;