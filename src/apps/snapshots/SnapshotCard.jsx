// src/apps/snapshots/SnapshotCard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import db from '../../db';
import { generateSnapshotComment, generateSnapshotReply } from './services/snapshotAiService';

export const SnapshotCard = ({
  snapshot,
  currentChatId,
  onDelete,
  onOpenUserProfile,
  onOpenCharProfile
}) => {
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [isSummoning, setIsSummoning] = useState(false);
  const [showPromptDetail, setShowPromptDetail] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const list = await db.snapshotComments
        .where('snapshotId')
        .equals(snapshot.id)
        .sortBy('createdAt');
      setComments(list);
    } catch (err) {
      console.error('加载评论失败:', err);
    }
  }, [snapshot.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // 点赞切换
  const handleToggleLike = async () => {
    try {
      const nextState = !snapshot.isLiked;
      const nextCount = nextState ? (snapshot.likes || 0) + 1 : Math.max(0, (snapshot.likes || 1) - 1);
      await db.snapshots.update(snapshot.id, { isLiked: nextState, likes: nextCount });
      snapshot.isLiked = nextState;
      snapshot.likes = nextCount;
      setComments((prev) => [...prev]);
    } catch (err) {
      console.error('点赞失败:', err);
    }
  };

  // 用户发表评论或回复
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const text = commentInput.trim();
    if (!text) return;

    try {
      // 获取当前 Chat 下的 User 主页人设
      const profileKey = `user_${currentChatId}`;
      const customProfile = await db.snapshotProfiles.get(profileKey);
      const chat = await db.chats.get(Number(currentChatId));

      const senderName = customProfile?.name || chat?.userName || '我';
      const senderAvatar = customProfile?.avatar || chat?.userAvatar || '';

      const newComment = {
        snapshotId: snapshot.id,
        chatId: Number(currentChatId),
        senderType: 'user',
        senderName,
        senderAvatar,
        replyToCommentId: replyTarget ? replyTarget.id : null,
        replyToName: replyTarget ? replyTarget.name : null,
        content: text,
        createdAt: Date.now()
      };

      const addedId = await db.snapshotComments.add(newComment);
      setCommentInput('');
      const target = replyTarget;
      setReplyTarget(null);
      await loadComments();

      // 如果回复的是 Character 或 NPC，触发对方的 AI 追评
      if (target && (target.type === 'character' || target.type === 'npc')) {
        setTimeout(async () => {
          try {
            const replyText = await generateSnapshotReply(
              snapshot,
              target,
              { senderName, content: text },
              text
            );
            if (replyText) {
              await db.snapshotComments.add({
  snapshotId: snapshot.id,
  chatId: Number(currentChatId),
  senderType: chosen.type,
  characterId: chosen.type === 'character' ? chosen.id : null,
  npcId: chosen.type === 'npc' ? chosen.id : null,
  senderName: chosen.name,
  roleTag: chosen.type === 'npc' ? (chosen.roleTag || '街区邻里') : '', // 新增这一行
  senderAvatar: chosen.avatar || '',
  content: commentText,
  createdAt: Date.now()
});

              await loadComments();
            }
          } catch (replyErr) {
            console.error('追评生成失败:', replyErr);
          }
        }, 1200);
      }
    } catch (err) {
      console.error('提交评论失败:', err);
    }
  };

  // 智能召唤首评（邻里/伴侣留笔）
  const handleAutoSummon = async () => {
    if (isSummoning) return;
    setIsSummoning(true);
    try {
      // 构建候选人池：本 Chat 的角色，以及系统预设 NPC
      const chat = await db.chats.get(Number(currentChatId));
      const pool = [];

      if (chat?.characterId && String(snapshot.characterId) !== String(chat.characterId)) {
        const char = await db.characters.get(chat.characterId);
        if (char) {
          pool.push({ type: 'character', id: char.id, name: char.name, avatar: char.avatar });
        }
      }

      const savedNpcs = await db.snapshotSettings.get('npcs');
      const npcs = savedNpcs?.value || [];
      npcs.forEach((n) => {
        if (String(snapshot.npcId) !== String(n.id)) {
          pool.push({ type: 'npc', id: n.id, name: n.name, roleTag: n.roleTag, avatar: '' });
        }
      });

      const chosen = pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : { type: 'npc', id: null, name: '街角常客', roleTag: '路人', avatar: '' };

      const commentText = await generateSnapshotComment(snapshot, chosen);

      if (commentText) {
        await db.snapshotComments.add({
          snapshotId: snapshot.id,
          chatId: Number(currentChatId),
          senderType: chosen.type,
          characterId: chosen.type === 'character' ? chosen.id : null,
          npcId: chosen.type === 'npc' ? chosen.id : null,
          senderName: chosen.name,
          senderAvatar: chosen.avatar || '',
          content: commentText,
          createdAt: Date.now()
        });
        await loadComments();
      }
    } catch (err) {
      console.error('智能召唤失败:', err);
    } finally {
      setIsSummoning(false);
    }
  };

  // 点击头像跳转
  const handleAuthorClick = () => {
    if (snapshot.authorType === 'user') {
      onOpenUserProfile && onOpenUserProfile();
    } else if (snapshot.authorType === 'character' && snapshot.characterId) {
      onOpenCharProfile && onOpenCharProfile(snapshot.characterId);
    }
  };

  const formattedTime = new Date(snapshot.timestamp || snapshot.createdAt).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="w-full bg-white/80 backdrop-blur-2xl rounded-[32px] p-5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] border border-white/60 space-y-4 text-left transition-all duration-300 hover:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.08)]">
      {/* 头部：作者与时间 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleAuthorClick}>
          <div className="w-10 h-10 rounded-2xl overflow-hidden p-[2px] bg-gradient-to-tr from-neutral-200 to-neutral-400 shadow-sm transition-transform active:scale-95">
            {snapshot.authorAvatar ? (
              <img src={snapshot.authorAvatar} alt={snapshot.authorName} className="w-full h-full object-cover rounded-[14px]" />
            ) : (
              <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600 rounded-[14px]">
                {(snapshot.authorName || 'U')[0]}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold tracking-tight text-neutral-900 group-hover:opacity-75 transition-opacity">
                {snapshot.authorName}
              </h4>
              {snapshot.authorType === 'character' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-neutral-900 text-white font-medium">伴侣</span>
              )}
              {snapshot.authorType === 'npc' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-600 font-medium">邻里</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
              <span>{formattedTime}</span>
              {snapshot.location && (
                <span className="flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {snapshot.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDeleting(true)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100/60 transition-colors"
          title="删除动态"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>

      {/* 视觉主图 / 画面意境区 */}
      {snapshot.mediaUrl ? (
        <div className="w-full aspect-square rounded-[24px] overflow-hidden bg-neutral-100 shadow-inner relative group">
          <img src={snapshot.mediaUrl} alt="Moment snapshot" className="w-full h-full object-cover" />
          {snapshot.imagePrompt && (
            <button
              type="button"
              onClick={() => setShowPromptDetail(!showPromptDetail)}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-medium text-white/90 border border-white/20 hover:bg-black/60 transition-all"
            >
              画面定格描摹
            </button>
          )}
        </div>
      ) : snapshot.imagePrompt ? (
        <div className="w-full aspect-[4/3] rounded-[24px] bg-gradient-to-br from-neutral-50 to-neutral-100/80 p-6 flex flex-col justify-between border border-neutral-200/50 shadow-inner">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[9px] uppercase tracking-widest font-semibold">Polaroid Vision Frame</span>
            <svg className="w-4 h-4 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"/></svg>
          </div>
          <p className="text-xs leading-relaxed text-neutral-700 font-serif italic text-center px-2">
            "{snapshot.imagePrompt}"
          </p>
          <div className="text-center text-[10px] text-neutral-400">光影捕捉与意象留白</div>
        </div>
      ) : null}

      {/* 意境抽屉浮层 */}
      {showPromptDetail && snapshot.imagePrompt && (
        <div className="p-3 bg-neutral-50/90 backdrop-blur-md rounded-2xl border border-neutral-200/60 text-[11px] text-neutral-600 leading-relaxed font-serif italic">
          "{snapshot.imagePrompt}"
        </div>
      )}

      {/* 随笔正文 */}
      {snapshot.content && (
        <p className="text-xs leading-relaxed text-neutral-800 font-sans tracking-wide px-1">
          {snapshot.content}
        </p>
      )}

      {/* 交互操作栏 */}
      <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
              snapshot.isLiked
                ? 'bg-red-50 text-red-500'
                : 'bg-neutral-100/70 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            <svg className={`w-3.5 h-3.5 ${snapshot.isLiked ? 'fill-current text-red-500' : 'stroke-current'}`} viewBox="0 0 24 24" fill="none" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>{snapshot.likes || 0}</span>
          </button>

          <div className="flex items-center gap-1 text-xs text-neutral-400 font-medium px-2 py-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{comments.length}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAutoSummon}
          disabled={isSummoning}
          className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-700 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
        >
          <svg className={`w-3 h-3 ${isSummoning ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>{isSummoning ? '呼唤中...' : '邀约邻里留笔'}</span>
        </button>
      </div>

      {/* 评论流 */}
      {comments.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-neutral-100/80">
          {comments.map((c) => (
            <div key={c.id} className="text-xs group flex items-start justify-between gap-2 p-1.5 rounded-xl hover:bg-neutral-50/60 transition-colors">
              <div className="min-w-0 flex-1 leading-relaxed">
                <span className="font-bold text-neutral-900 mr-1.5">{c.senderName}:</span>
                {c.replyToName && (
                  <span className="text-neutral-400 text-[11px] mr-1">
                    @{c.replyToName}
                  </span>
                )}
                <span className="text-neutral-700">{c.content}</span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 shrink-0">
                <button
  type="button"
  onClick={() => setReplyTarget({
    id: c.characterId || c.npcId || c.id,
    name: c.senderName,
    type: c.senderType,
    roleTag: c.roleTag || (c.senderType === 'npc' ? '街区邻里' : ''), // 新增这一行
    avatar: c.senderAvatar
  })}
  className="text-[10px] font-bold text-neutral-500 hover:text-neutral-900"
>
  回复
</button>

                <button
                  type="button"
                  onClick={async () => {
                    await db.snapshotComments.delete(c.id);
                    loadComments();
                  }}
                  className="text-neutral-300 hover:text-red-500 p-0.5"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <form onSubmit={handleSubmitComment} className="flex items-center gap-2 pt-1">
        {replyTarget && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-neutral-100 text-[10px] text-neutral-700 font-semibold shrink-0">
            <span>@{replyTarget.name}</span>
            <button type="button" onClick={() => setReplyTarget(null)}>
              <svg className="w-3 h-3 text-neutral-400 hover:text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}
        <input
          type="text"
          placeholder={replyTarget ? `回复 ${replyTarget.name}...` : '写下一笔短语...'}
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          className="flex-1 text-xs px-3.5 py-2.5 rounded-2xl bg-neutral-100/80 border-none outline-none text-neutral-800 placeholder-neutral-400 focus:bg-white focus:ring-1 focus:ring-neutral-300 transition-all"
        />
        <button
          type="submit"
          disabled={!commentInput.trim()}
          className="w-8 h-8 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shrink-0 disabled:opacity-30 transition-transform active:scale-95 shadow-sm"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </form>

      {/* 彻底删除确认弹窗 */}
      {isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xs bg-white rounded-[28px] p-6 space-y-4 shadow-2xl text-center">
            <h4 className="text-sm font-bold text-neutral-900">撕下这一页动态？</h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              彻底删除此条拍立得记录及所有留言，此操作无法撤回。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-xs font-bold text-neutral-700"
              >
                保留
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDeleting(false);
                  onDelete && onDelete(snapshot.id);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-xs font-bold text-white shadow-sm"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SnapshotCard;
