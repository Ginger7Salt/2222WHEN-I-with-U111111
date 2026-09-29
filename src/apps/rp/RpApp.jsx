// src/apps/rp/RpApp.jsx
//
// 长RP子应用切片A：会话列表 + 新建会话弹窗。
// 2026-09 视觉重做：用户反馈"标题干巴巴地贴在最顶上、选角色就是一排
// 表单行"太单调，改成渐变hero头部 + 横向头像轮播选角色，跟长RP本身
// "小说感"的视觉方向靠拢，不再是标准后台管理列表的样子。
//
// 选角色这一步是单选（跟泡泡模式的多选建房不同——长RP一局只绑一个
// 角色，且中途不能换，已经跟用户确认过）。
//
// 这一版点进会话只会看到 RpRoom.jsx 的空壳（还没有消息收发/AI调用，
// 那是切片B之后的范围）。

import React, { useEffect, useState } from 'react';
import { ScrollText, Plus, ArrowLeft, Trash2, Check } from 'lucide-react';

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
    <div className="animate-fade-in pb-12">
      {/* Hero头部：渐变底色 + 悬浮返回按钮 + 衬线大标题，
          不再是"一行文字贴在最顶上"的干巴巴样式 */}
      <div
        className="relative overflow-hidden rounded-b-[2.5rem] px-5 pb-7 pt-14"
        style={{
          background: `linear-gradient(160deg, var(--bg-blob-1) 0%, var(--bg-surface) 70%)`,
        }}
      >
        <button
          type="button"
          onClick={onBackHub}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--card-shadow)',
            color: 'var(--text-main)',
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <p
          className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60"
          style={{ color: 'var(--text-main)' }}
        >
          Long RP
        </p>
        <h1
          className="mt-1 text-2xl font-bold"
          style={{
            color: 'var(--text-main)',
            fontFamily: 'Georgia, "Noto Serif SC", serif',
          }}
        >
          长文角色扮演
        </h1>
        <p
          className="mt-1 text-xs opacity-60"
          style={{ color: 'var(--text-sub)' }}
        >
          沉浸式、小说感的长篇故事
        </p>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="mt-5 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold shadow-sm"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          <Plus className="h-3.5 w-3.5" /> 开启新故事
        </button>
      </div>

      <div className="px-4 pt-5">
        {sessions.length === 0 ? (
          <div
            className="py-16 text-center rounded-3xl border opacity-60"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">暂无长RP会话，点上面"开启新故事"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {sessions.map((session) => {
              const character = charactersById[session.characterId];
              return (
                <div
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className="group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-3xl p-4 pl-5 shadow-sm transition-transform active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--text-main)',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  {/* 左侧色条，用主题自带的装饰色，跟RP房间的视觉体系呼应 */}
                  <span
                    className="absolute left-0 top-0 h-full w-1.5"
                    style={{ backgroundColor: 'var(--bg-blob-1)' }}
                  />

                  {character?.avatar ? (
                    <img
                      src={character.avatar}
                      alt={character.name}
                      className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm"
                    />
                  ) : (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{ backgroundColor: 'var(--control-soft-bg)' }}
                    >
                      {character?.name?.[0] || '?'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3
                      className="truncate text-sm font-semibold"
                      style={{ fontFamily: 'Georgia, "Noto Serif SC", serif' }}
                    >
                      {session.title}
                    </h3>
                    <p className="mt-0.5 truncate text-xs opacity-60">
                      {character?.name || '（角色已被删除）'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(session.id);
                    }}
                    className="shrink-0 p-1.5 text-red-500 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-sm rounded-[2rem] p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--modal-bg)',
              border: '1px solid var(--modal-border)',
              color: 'var(--text-main)',
            }}
          >
            <h3
              className="text-sm font-semibold"
              style={{ fontFamily: 'Georgia, "Noto Serif SC", serif' }}
            >
              开启新故事
            </h3>

            <div className="space-y-1.5">
              <span className="block text-[11px] opacity-60">
                选一位角色（开局后不能更换，想换角色请另开一局）
              </span>

              {allCharacters.length === 0 ? (
                <p className="py-2 text-[11px] opacity-50">还没有可选角色，先去角色库建一个吧。</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar">
                  {allCharacters.map((c) => {
                    const checked = selectedCharacterId === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedCharacterId(c.id)}
                        className="flex shrink-0 flex-col items-center gap-1.5"
                      >
                        <div className="relative">
                          {c.avatar ? (
                            <img
                              src={c.avatar}
                              alt={c.name}
                              className="h-16 w-16 rounded-full object-cover transition-all"
                              style={{
                                boxShadow: checked
                                  ? `0 0 0 3px var(--accent-color)`
                                  : `0 0 0 1px var(--card-border)`,
                                opacity: checked ? 1 : 0.7,
                              }}
                            />
                          ) : (
                            <div
                              className="flex h-16 w-16 items-center justify-center rounded-full text-base font-bold transition-all"
                              style={{
                                backgroundColor: 'var(--control-soft-bg)',
                                boxShadow: checked
                                  ? `0 0 0 3px var(--accent-color)`
                                  : `0 0 0 1px var(--card-border)`,
                              }}
                            >
                              {c.name?.[0]}
                            </div>
                          )}

                          {checked && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full"
                              style={{ backgroundColor: 'var(--accent-color)' }}
                            >
                              <Check className="h-3 w-3" style={{ color: 'var(--accent-foreground)' }} />
                            </span>
                          )}
                        </div>

                        <span
                          className="max-w-[64px] truncate text-[10px]"
                          style={{ color: checked ? 'var(--text-main)' : 'var(--text-muted)' }}
                        >
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <input
                type="text"
                required
                placeholder="给这段故事起个名字..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-2xl border p-3 text-xs outline-none"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-2 text-xs opacity-60"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !selectedCharacterId}
                className="rounded-full px-5 py-2 text-xs font-semibold disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
              >
                开始
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