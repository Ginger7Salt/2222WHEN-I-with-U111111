// src/apps/rp/RpApp.jsx
//
// 长RP子应用切片A：会话列表 + 新建会话弹窗。
//
// 2026-09 美化重做：会话列表改成"书签"造型（每张卡片左侧贴一条带
// V形缺口的丝带，像书里夹的书签），建局向导里选角色从"干巴巴的
// 勾选行"改成头像卡片网格。逻辑跟上一版完全一样，只动了样式。

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

// 书签丝带的配色轮换池——直接借用主题自带的装饰色变量，四套主题下
// 都有对应的取值，不用为长RP单独写一套颜色。
const RIBBON_VARS = ['--bg-blob-1', '--bg-blob-2', '--bg-blob-3', '--accent-color'];

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
    <div className="animate-fade-in pb-16">
      {/* 顶部不再是贴边的一条标题栏，往下留了呼吸空间，标题用衬线字体
          呼应长RP的"小说感" */}
      <div className="flex items-center justify-between pt-1 pb-2">
        <button
          type="button"
          onClick={onBackHub}
          className="flex items-center gap-1 text-xs font-semibold opacity-60 hover:opacity-100"
          style={{ color: 'var(--text-main)' }}
        >
          <ArrowLeft className="w-4 h-4" /> 主页
        </button>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          <Plus className="w-3.5 h-3.5" /> 新建
        </button>
      </div>

      <div className="pt-3 pb-6 text-center">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{
            color: 'var(--text-main)',
            fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif',
          }}
        >
          长文 · Roleplay
        </h1>
        <p className="mt-1 text-[11px] opacity-50">
          翻开一段更沉浸的故事
        </p>
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
        <div className="flex flex-col gap-4">
          {sessions.map((session, index) => {
            const character = charactersById[session.characterId];
            const ribbonVar = RIBBON_VARS[index % RIBBON_VARS.length];

            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className="relative flex cursor-pointer items-center gap-3 overflow-visible rounded-2xl border py-3 pl-7 pr-4 shadow-sm transition-transform active:scale-[0.98] group"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-main)',
                }}
              >
                {/* 书签丝带：贴在卡片左侧往上探出一截，底部V形缺口 */}
                <div
                  aria-hidden="true"
                  className="absolute -top-2 left-3 h-9 w-4"
                  style={{
                    background: `var(${ribbonVar})`,
                    clipPath: 'polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)',
                    filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.18))',
                  }}
                />

                {character?.avatar ? (
                  <img
                    src={character.avatar}
                    alt={character.name}
                    className="w-11 h-11 rounded-full object-cover shrink-0 border-2"
                    style={{ borderColor: 'var(--card-bg)', boxShadow: '0 0 0 1px var(--card-border)' }}
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: 'var(--control-soft-bg)' }}
                  >
                    {character?.name?.[0] || '?'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h3
                    className="font-semibold text-sm truncate"
                    style={{ fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif' }}
                  >
                    {session.title}
                  </h3>
                  <p className="text-[11px] opacity-55 mt-0.5 truncate">
                    {character?.name || '（角色已被删除）'}
                  </p>
                </div>

                {/* 删除按钮：之前是 opacity-0 group-hover:opacity-100，只有鼠标
                    悬停才会显示——这在手机上摸不到"悬停"这个状态，点一下卡片
                    直接就进房间了，等于删除功能形同虚设。改成常驻显示一个
                    淡一点的小图标，不需要悬停也能点到。 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetId(session.id);
                  }}
                  className="text-red-500 opacity-45 hover:opacity-100 active:opacity-100 shrink-0 p-1"
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
            className="w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--modal-bg)',
              border: '1px solid var(--modal-border)',
              color: 'var(--text-main)',
            }}
          >
            <h3
              className="text-sm font-semibold border-b pb-2"
              style={{
                borderColor: 'var(--divider)',
                fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif',
              }}
            >
              新建长RP会话
            </h3>

            <input
              type="text"
              required
              placeholder="给这段故事起个名字..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl text-xs border outline-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
            />

            <div className="space-y-2 pt-1">
              <span className="block opacity-60 text-[11px]">
                选择角色（创建后不能更换，换角色请新建会话）
              </span>

              {allCharacters.length === 0 ? (
                <p className="text-[11px] opacity-50 py-2">还没有可选角色，先去角色库建一个吧。</p>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1 pt-1">
                  {allCharacters.map((c) => {
                    const checked = selectedCharacterId === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedCharacterId(c.id)}
                        className="relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-all"
                        style={{
                          backgroundColor: checked ? 'var(--control-soft-bg)' : 'var(--bg-surface)',
                          borderColor: checked ? 'var(--accent-color)' : 'var(--card-border)',
                          borderWidth: checked ? '2px' : '1px',
                        }}
                      >
                        {checked && (
                          <div
                            className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full"
                            style={{ backgroundColor: 'var(--accent-color)' }}
                          >
                            <Check className="h-2.5 w-2.5" style={{ color: 'var(--accent-foreground)' }} />
                          </div>
                        )}

                        {c.avatar ? (
                          <img
                            src={c.avatar}
                            alt={c.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                            style={{ backgroundColor: 'var(--card-bg)' }}
                          >
                            {c.name?.[0]}
                          </div>
                        )}
                        <span className="text-[10px] truncate w-full text-center">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-xs opacity-60"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !selectedCharacterId}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40"
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