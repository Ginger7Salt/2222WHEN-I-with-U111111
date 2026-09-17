// src/apps/snapshots/CreateSnapshotModal.jsx
//
// 【整体替换说明】相对旧版的改动：
// 删除"伴侣随写""邻里生活"两个手动邀约 tab（mode='aiChar'/'aiNpc' 及相关状态、
// handleInvitePost 函数、npc/char 的 context 加载），只保留"自己记录"一种模式。
// "让大家发点什么"的批量随机生成已移到主页级别的独立入口
// （SnapshotsApp.jsx 里的 triggerRandomDailyPosts），不再放在这个弹窗里。
// 表单样式本次未调整（美化阶段再处理），仅做逻辑层删减。
//
import React, { useState } from 'react';
import db from '../../db';
import { compressImageFile } from './services/snapshotMediaService';

export const CreateSnapshotModal = ({ isOpen, onClose, currentChatId, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 用户自主发帖（支持纯文字、带图或纯画面描摹）
  const handleSubmitUser = async (e) => {
    e.preventDefault();
    if (!content.trim() && !imagePrompt.trim() && !mediaUrl) return;

    setIsSubmitting(true);
    try {
      const profileKey = `user_${currentChatId}`;
      const customProfile = await db.snapshotProfiles.get(profileKey);
      const chat = await db.chats.get(Number(currentChatId));

      const authorName = customProfile?.name || chat?.userName || '我';
      const authorAvatar = customProfile?.avatar || chat?.userAvatar || '';

      await db.snapshots.add({
        chatId: Number(currentChatId),
        authorType: 'user',
        authorName,
        authorAvatar,
        mediaUrl: mediaUrl || '',
        imagePrompt: imagePrompt.trim(),
        content: content.trim(),
        location: location.trim() || '某处日常',
        likes: 0,
        isLiked: false,
        timestamp: Date.now(),
        createdAt: Date.now()
      });

      setContent('');
      setImagePrompt('');
      setMediaUrl('');
      setLocation('');
      onPostCreated && onPostCreated();
      onClose();
    } catch (err) {
      console.error('发帖失败:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-md animate-fade-in text-left">
      <div className="w-full max-w-sm bg-white rounded-[36px] p-6 shadow-2xl space-y-4 border border-white/60 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <h3 className="text-sm font-black text-neutral-900">创作拍立得动态</h3>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          <form onSubmit={handleSubmitUser} className="space-y-3">
            {/* 图片上传/预览（可选） */}
            <div>
              <label className="text-[11px] font-semibold text-neutral-500 block mb-1">附带相片 (可选，不传则为纯文字动态)</label>
              <div className="h-28 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center relative overflow-hidden bg-neutral-50 hover:bg-neutral-100/60 transition-colors cursor-pointer">
                {mediaUrl ? (
                  <>
                    <img src={mediaUrl} alt="Upload" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setMediaUrl(''); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="text-center text-neutral-400 text-xs space-y-1">
                    <svg className="w-5 h-5 mx-auto opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span>点击选择本地照片</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
              </div>
            </div>

            {/* 画面意境描摹（可选） */}
            <div>
              <label className="text-[11px] font-semibold text-neutral-500 block mb-1">画面光影描摹 (可选，留给 AI 的视觉意象)</label>
              <input
                type="text"
                placeholder="例: 窗边逆光下的温热红茶、被风吹翻的书页..."
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl bg-neutral-100/80 outline-none"
              />
            </div>

            {/* 正文 */}
            <div>
              <label className="text-[11px] font-semibold text-neutral-500 block mb-1">随感文字</label>
              <textarea
                placeholder="写下当下的心境..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl bg-neutral-100/80 outline-none h-20 resize-none"
              />
            </div>

            {/* 地点 */}
            <div>
              <label className="text-[11px] font-semibold text-neutral-500 block mb-1">打卡地点</label>
              <input
                type="text"
                placeholder="例如：午后书房、街角长椅"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl bg-neutral-100/80 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || (!content.trim() && !imagePrompt.trim() && !mediaUrl)}
              className="w-full py-3 rounded-2xl bg-neutral-900 text-white text-xs font-bold shadow-md active:scale-95 disabled:opacity-30 transition-all"
            >
              {isSubmitting ? '正在发布...' : '发布到世界线'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateSnapshotModal;