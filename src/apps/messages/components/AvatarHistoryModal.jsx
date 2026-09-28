// src/apps/messages/components/AvatarHistoryModal.jsx
//
// "历史相册"——查看/选回/删除某个角色以前用过的头像。对应待办 3 后半段，
// 只覆盖角色头像（characters.avatar），跟 BubbleCustomizer.jsx 一样是个
// 简单的浮层弹窗，样式沿用同一套 card-bg-gradient 毛玻璃卡片惯例。
//
// 这里选中一张图只是把它放进 CharacterEditor.jsx 的编辑草稿里
// （onRestore 回调），真正写库要等用户点编辑页顶部的"保存"——具体的
// "保存时才记录旧图/消费这条历史记录"逻辑写在 CharacterEditor.jsx，
// 这个弹窗本身不直接碰 characters 表。删除历史记录则是立即生效的
// （不可恢复），这里会先弹 ConfirmModal 二次确认。

import React, { useEffect, useState } from 'react';
import { X, Image as ImageIcon, RotateCcw, Trash2 } from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import { getAvatarHistory, deleteAvatarHistoryEntry } from '../avatarHistoryService';

const formatHistoryTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');

  return sameYear
    ? `${month}月${day}日 ${hh}:${mm}`
    : `${date.getFullYear()}年${month}月${day}日`;
};

export const AvatarHistoryModal = ({ characterId, onClose, onRestore }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const reload = async () => {
    setLoading(true);
    const list = await getAvatarHistory(characterId);
    setHistory(list);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const handleConfirmDelete = async () => {
    if (pendingDeleteId != null) {
      await deleteAvatarHistoryEntry(pendingDeleteId);
      setPendingDeleteId(null);
      await reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      <div
        className="fixed inset-0 backdrop-blur-md bg-white/5 dark:bg-black/5"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-sm rounded-[2rem] p-5 space-y-3.5 shadow-2xl text-xs text-left z-10 max-h-[80vh] overflow-hidden flex flex-col"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        <div className="flex items-center justify-between border-b pb-2.5 shrink-0" style={{ borderColor: 'var(--divider)' }}>
          <div className="flex items-center gap-1.5 font-bold">
            <ImageIcon className="w-4 h-4" />
            <span>历史相册</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar -mx-1 px-1 flex-1">
          {loading ? (
            <div className="py-10 text-center opacity-50">加载中...</div>
          ) : history.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 opacity-50">
              <ImageIcon className="w-8 h-8" />
              <span>换过头像之后，旧头像会自动存在这里</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 pb-1">
              {history.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div
                    className="relative aspect-square rounded-2xl overflow-hidden border group"
                    style={{ borderColor: 'var(--card-border)' }}
                  >
                    <img
                      src={item.avatar}
                      alt="历史头像"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onRestore?.(item)}
                        className="p-1.5 rounded-full bg-white/90 text-black active:scale-90 transition-transform"
                        title="选用这张"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(item.id)}
                        className="p-1.5 rounded-full bg-white/90 text-rose-500 active:scale-90 transition-transform"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <span className="block text-[9px] text-center opacity-50 font-mono">
                    {formatHistoryTime(item.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={pendingDeleteId != null}
        title="删除这张历史头像？"
        message="删除后不可恢复，确定要删掉吗？"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
};

export default AvatarHistoryModal;