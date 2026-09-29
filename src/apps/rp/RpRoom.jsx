// src/apps/rp/RpApp.jsx
//
// 长RP子应用切片A：会话列表 + 新建会话弹窗。
// 结构照抄 src/apps/bubble/BubbleApp.jsx，但选角色这一步是单选
// （跟泡泡模式的多选建房不同——长RP一局只绑一个角色，且中途不能换，
// 已经跟用户确认过）。
//
// 这一版点进会话只会看到 RpRoom.jsx 的空壳（还没有消息收发/AI调用，
// 那是切片B之后的范围）。

import React, { useEffect, useState } from 'react';
import { ScrollText, Plus, ArrowLeft, Trash2 } from 'lucide-react';

import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import {
  getAllRpSessions,
  createRpSession,
  deleteRpSession,
} from './rpService';
import RpRoom from './RpRoom';

const RpApp = ({ onBackHub, onChatRoomStateChange }) => {
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [charactersById, setCharactersById] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // 建局向导
  const [allCharacters, setAllCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const [list, chars] = await Promise.all([
      getAllRpSessions(),
      db.characters.toArray(),
    ]);
    setSessions(list);
    setCharactersById(
      Object.fromEntries(chars.map((c) => [c.id, c]))
    );
  };

  const handleOpenCreate = async () => {
    const chars = await db.characters.toArray();
    setAllCharacters(chars);
    setSelectedCharacterId(null);
    setTitle('');
    setShowCreateModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !selectedCharacterId) return;

    const newId = await createRpSession({
      characterId: selectedCharacterId,
      title: title.trim(),
    });

    if (!newId) return;

    setShowCreateModal(false);
    await loadSessions();
    setActiveSessionId(newId);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    await deleteRpSession(deleteTargetId);
    setDeleteTargetId(null);
    loadSessions();
  };

  if (activeSessionId) {
    return (
      <RpRoom
        sessionId={activeSessionId}
        onBack={() => {
          setActiveSessionId(null);
          loadSessions();
        }}
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
          RP • 长文
        </h2>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          <Plus className="w-3.5 h-3.5" /> 新建
        </button>
      </div>

      {sessions.length === 0 ? (
        <div
          className="py-16 text-center rounded-3xl border opacity-60"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">暂无长RP会话，点击右上角新建</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sessions.map((session) => {
            const character = charactersById[session.characterId];
            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className="p-4 rounded-3xl border transition-all cursor-pointer relative group shadow-sm flex items-center gap-3"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)',
                }}
              >
                {character?.avatar ? (
                  <img
                    src={character.avatar}
                    alt={character.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: 'var(--control-soft-bg)' }}
                  >
                    {character?.name?.[0] || '?'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">{session.title}</h3>
                  <p className="text-xs opacity-60 mt-0.5 truncate">
                    {character?.name || '（角色已被删除）'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetId(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
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
              新建长RP会话
            </h3>

            <input
              type="text"
              required
              placeholder="会话标题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 rounded-xl text-xs border outline-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
            />

            <div className="space-y-1.5 pt-1">
              <span className="block opacity-60 text-[11px]">
                选择角色（创建后不能更换，换角色请新建会话）：
              </span>

              {allCharacters.length === 0 ? (
                <p className="text-[11px] opacity-50 py-2">还没有可选角色，先去角色库建一个吧。</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {allCharacters.map((c) => {
                    const checked = selectedCharacterId === c.id;
                    return (
                      <label
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer"
                        style={{
                          backgroundColor: checked ? 'var(--control-soft-bg)' : 'var(--bg-surface)',
                          borderColor: checked ? 'var(--accent-color)' : 'var(--card-border)',
                        }}
                      >
                        <span className="truncate">{c.name}</span>
                        <input
                          type="radio"
                          name="rp-character"
                          checked={checked}
                          onChange={() => setSelectedCharacterId(c.id)}
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
                disabled={!title.trim() || !selectedCharacterId}
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
          title="删除会话"
          message="确定删除此长RP会话吗？"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
};

export default RpApp;