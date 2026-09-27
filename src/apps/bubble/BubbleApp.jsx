// src/apps/bubble/BubbleApp.jsx
//
// 泡泡模式（Bubble Mode）切片A：房间列表 + 建房弹窗。
// 整体结构参照 src/apps/ensemble/EnsembleApp.jsx，但建房这一步直接把
// "勾选最多8个角色"做进创建弹窗里一次性完成（泡泡模式的确认设计里没有
// "本群专属角色"这个概念，只从已有角色库里选人，所以不需要 Ensemble
// 那种"先建房、再进设置页勾人"的两段式流程）。
//
// 这一版点进房间只会看到 BubbleRoom.jsx 的空壳（还没有消息收发，那是
// 切片B的范围）。

import React, { useEffect, useState } from 'react';
import { MessagesSquare, Plus, ArrowLeft, Trash2 } from 'lucide-react';

import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import {
  getAllBubbleRooms,
  createBubbleRoom,
  deleteBubbleRoom,
  MAX_MEMBERS,
} from './bubbleService';
import BubbleRoom from './BubbleRoom';

const BubbleApp = ({ onBackHub, onChatRoomStateChange }) => {
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // 建房向导
  const [allCharacters, setAllCharacters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [title, setTitle] = useState('');

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    const list = await getAllBubbleRooms();
    setRooms(list);
  };

  const handleOpenCreate = async () => {
    const chars = await db.characters.toArray();
    setAllCharacters(chars);
    setSelectedIds([]);
    setTitle('');
    setShowCreateModal(true);
  };

  const handleToggleCharacter = (characterId) => {
    setSelectedIds((prev) => {
      if (prev.includes(characterId)) {
        return prev.filter((id) => id !== characterId);
      }
      if (prev.length >= MAX_MEMBERS) {
        return prev;
      }
      return [...prev, characterId];
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || selectedIds.length === 0) return;

    const newId = await createBubbleRoom({
      title: title.trim(),
      selectedCharacterIds: selectedIds,
    });

    if (!newId) return;

    setShowCreateModal(false);
    await loadRooms();
    setActiveRoomId(newId);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    await deleteBubbleRoom(deleteTargetId);
    setDeleteTargetId(null);
    loadRooms();
  };

  if (activeRoomId) {
    return (
      <BubbleRoom
        roomId={activeRoomId}
        onBack={() => setActiveRoomId(null)}
        onChatRoomStateChange={onChatRoomStateChange}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-1 text-xs font-semibold opacity-70 hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="w-4 h-4" /> 返回主页
        </button>
        <h2
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: 'var(--text-main)' }}
        >
          Bubble • 泡泡
        </h2>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          <Plus className="w-3.5 h-3.5" /> 建房
        </button>
      </div>

      {rooms.length === 0 ? (
        <div
          className="py-16 text-center rounded-3xl border opacity-60"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <MessagesSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">暂无泡泡房间，点击右上角建房</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className="p-4 rounded-3xl border transition-all cursor-pointer relative group shadow-sm"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)',
              }}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-sm">{room.title}</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetId(room.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs opacity-60 mt-1">
                {(room.selectedCharacterIds || []).length} 位角色
              </p>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-xs rounded-3xl p-5 space-y-3 shadow-2xl max-h-[80vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--modal-bg)',
              border: '1px solid var(--modal-border)',
              color: 'var(--text-main)',
            }}
          >
            <h3
              className="text-xs font-semibold border-b pb-2"
              style={{ borderColor: 'var(--divider)' }}
            >
              新建泡泡房间
            </h3>

            <input
              type="text"
              required
              placeholder="房间名称..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 rounded-xl text-xs border outline-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
            />

            <div className="space-y-1.5 pt-1">
              <span className="block opacity-60 text-[11px]">
                选择角色（最多 {MAX_MEMBERS} 位，已选 {selectedIds.length}）：
              </span>

              {allCharacters.length === 0 ? (
                <p className="text-[11px] opacity-50 py-2">还没有可选角色，先去角色库建一个吧。</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {allCharacters.map((c) => {
                    const checked = selectedIds.includes(c.id);
                    const disabled = !checked && selectedIds.length >= MAX_MEMBERS;
                    return (
                      <label
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded-xl border text-xs"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--card-border)',
                          opacity: disabled ? 0.4 : 1,
                        }}
                      >
                        <span className="truncate">{c.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => handleToggleCharacter(c.id)}
                          className="accent-current w-4 h-4"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1 text-xs opacity-60"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!title.trim() || selectedIds.length === 0}
                className="px-4 py-1 rounded-xl text-xs font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                创建
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTargetId && (
        <ConfirmModal
          isOpen={Boolean(deleteTargetId)}
          title="删除房间"
          message="确定删除此泡泡房间吗？"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
};

export default BubbleApp;