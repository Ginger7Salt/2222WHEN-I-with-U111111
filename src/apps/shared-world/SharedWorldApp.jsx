// src/apps/shared-world/SharedWorldApp.jsx
//
// 「共享世界」：一本本小册子，记录适用于全局的设定 / 规则 / 统一世界观。
// 书架页列出所有小册子，点开一本进入"翻开的书页"进行编辑。

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BookMarked,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';

import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';

import {
  SCOPE_ALL,
  SCOPE_SELECTED,
  SHARED_WORLD_LENGTH_WARNING,
  createSharedWorldEntry,
  deleteSharedWorldEntry,
  listSharedWorldEntries,
  moveSharedWorldEntry,
  updateSharedWorldEntry,
} from './sharedWorldService';

import './shared-world.css';

const EMPTY_DRAFT = {
  id: null,
  title: '',
  content: '',
  isEnabled: 1,
  scopeMode: SCOPE_ALL,
  characterIds: [],
};

const getScopeLabel = (entry, characters) => {
  if (entry.scopeMode !== SCOPE_SELECTED) return '全部角色';

  const ids = Array.isArray(entry.characterIds) ? entry.characterIds : [];
  const names = ids
    .map((id) => characters.find((character) => Number(character.id) === Number(id))?.name)
    .filter(Boolean);

  if (names.length === 0) return '未选择角色';
  if (names.length <= 2) return names.join('、');
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 位`;
};

const formatIndex = (index) => `No.${String(index + 1).padStart(2, '0')}`;

const Switch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`sw-switch ${checked ? 'is-on' : ''}`}
  >
    <span className="sw-switch-knob" />
  </button>
);

export const SharedWorldApp = ({ onBackHub }) => {
  const [entries, setEntries] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // null = 书架页；对象 = 正在翻开的一本
  const [draft, setDraft] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [entryList, characterList] = await Promise.all([
        listSharedWorldEntries(),
        db.characters.toArray(),
      ]);
      setEntries(entryList);
      setCharacters(characterList);
    } catch (error) {
      console.error('[SharedWorld] 读取失败：', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const enabled = entries.filter((entry) => entry.isEnabled);
    const enabledLength = enabled.reduce(
      (sum, entry) => sum + String(entry.content || '').length,
      0,
    );
    return {
      total: entries.length,
      enabledCount: enabled.length,
      enabledLength,
    };
  }, [entries]);

  const serializeDraft = (value) => JSON.stringify({
    title: value.title,
    content: value.content,
    isEnabled: value.isEnabled,
    scopeMode: value.scopeMode,
    characterIds: [...(value.characterIds || [])].sort(),
  });

  const openDraft = (entry) => {
    const next = entry
      ? {
        id: entry.id,
        title: entry.title || '',
        content: entry.content || '',
        isEnabled: entry.isEnabled ? 1 : 0,
        scopeMode: entry.scopeMode === SCOPE_SELECTED ? SCOPE_SELECTED : SCOPE_ALL,
        characterIds: Array.isArray(entry.characterIds) ? entry.characterIds : [],
      }
      : { ...EMPTY_DRAFT };

    setDraft(next);
    setSavedSnapshot(serializeDraft(next));
  };

  const isDirty = draft ? serializeDraft(draft) !== savedSnapshot : false;

  const closeDraft = () => {
    setDraft(null);
    setShowDiscardConfirm(false);
  };

  const handleBackFromDraft = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    closeDraft();
  };

  const handleSaveDraft = async () => {
    if (!draft || isSaving) return;

    setIsSaving(true);
    try {
      const payload = {
        title: draft.title,
        content: draft.content,
        isEnabled: draft.isEnabled,
        scopeMode: draft.scopeMode,
        characterIds: draft.characterIds,
      };

      if (draft.id === null) {
        await createSharedWorldEntry(payload);
      } else {
        await updateSharedWorldEntry(draft.id, payload);
      }

      await loadData();
      closeDraft();
    } catch (error) {
      console.error('[SharedWorld] 保存失败：', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (entry) => {
    await updateSharedWorldEntry(entry.id, { isEnabled: entry.isEnabled ? 0 : 1 });
    await loadData();
  };

  const handleMove = async (entry, direction) => {
    await moveSharedWorldEntry(entry.id, direction);
    await loadData();
  };

  const handleConfirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (id === null) return;

    await deleteSharedWorldEntry(id);
    await loadData();

    // 如果删的正是正在翻开的这一本，回到书架
    if (draft && draft.id === id) {
      closeDraft();
    }
  };

  const toggleDraftCharacter = (characterId) => {
    setDraft((previous) => {
      const current = previous.characterIds || [];
      const exists = current.some((id) => Number(id) === Number(characterId));

      return {
        ...previous,
        characterIds: exists
          ? current.filter((id) => Number(id) !== Number(characterId))
          : [...current, characterId],
      };
    });
  };

  /* ------------------------------ 翻开的书页 ------------------------------ */
  if (draft) {
    const contentLength = draft.content.length;
    const noCharacterSelected = draft.scopeMode === SCOPE_SELECTED
      && draft.characterIds.length === 0;

    return (
      <div className="shared-world-app">
        <header className="sw-header">
          <button
            type="button"
            onClick={handleBackFromDraft}
            className="sw-icon-button"
            aria-label="返回书架"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="sw-header-title">
            <h1>{draft.id === null ? '新的小册子' : '翻开这一本'}</h1>
            <p>Shared World</p>
          </div>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="sw-primary-button"
          >
            <Check className="h-3.5 w-3.5" />
            保存
          </button>
        </header>

        <main className="sw-scroll">
          <section className="sw-open-book">
            <label className="sw-field-label" htmlFor="sw-title">册名</label>
            <input
              id="sw-title"
              type="text"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="例如：雾港城的规矩"
              maxLength={40}
              className="sw-title-input"
            />

            <div className="sw-rule" />

            <label className="sw-field-label" htmlFor="sw-content">正文</label>
            <textarea
              id="sw-content"
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              placeholder="写下适用于这个世界的设定、规则或语气约定。每次聊天都会带上这里的内容，尽量写得精炼。"
              rows={12}
              className="sw-content-input"
            />
            <p className="sw-hint sw-hint-right">{contentLength} 字</p>
          </section>

          <section className="sw-panel">
            <div className="sw-panel-row">
              <div>
                <p className="sw-panel-title">启用这一本</p>
                <p className="sw-hint">关闭后保留内容，但不再写进提示词。</p>
              </div>
              <Switch
                checked={Boolean(draft.isEnabled)}
                label="启用这一本"
                onChange={() => setDraft({ ...draft, isEnabled: draft.isEnabled ? 0 : 1 })}
              />
            </div>
          </section>

          <section className="sw-panel">
            <p className="sw-panel-title">适用于</p>

            <div className="sw-segmented">
              <button
                type="button"
                className={draft.scopeMode === SCOPE_ALL ? 'is-active' : ''}
                onClick={() => setDraft({ ...draft, scopeMode: SCOPE_ALL })}
              >
                全部角色
              </button>
              <button
                type="button"
                className={draft.scopeMode === SCOPE_SELECTED ? 'is-active' : ''}
                onClick={() => setDraft({ ...draft, scopeMode: SCOPE_SELECTED })}
              >
                指定角色
              </button>
            </div>

            {draft.scopeMode === SCOPE_ALL ? (
              <p className="sw-hint">包括以后新建的角色，不需要再回来补勾选。</p>
            ) : (
              <>
                {characters.length === 0 ? (
                  <p className="sw-hint">还没有角色。</p>
                ) : (
                  <div className="sw-chip-list">
                    {characters.map((character) => {
                      const selected = draft.characterIds.some(
                        (id) => Number(id) === Number(character.id),
                      );

                      return (
                        <button
                          key={character.id}
                          type="button"
                          onClick={() => toggleDraftCharacter(character.id)}
                          className={`sw-chip ${selected ? 'is-selected' : ''}`}
                        >
                          {character.name || '未命名角色'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {noCharacterSelected && (
                  <p className="sw-warning">
                    还没有选择角色，这一本暂时不会对任何角色生效。
                  </p>
                )}
              </>
            )}
          </section>

          {draft.id !== null && (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(draft.id)}
              className="sw-danger-button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除这本小册子
            </button>
          )}
        </main>

        <ConfirmModal
          isOpen={showDiscardConfirm}
          title="放弃修改"
          message="这一本还有没保存的修改，确定要离开吗？"
          confirmText="放弃修改"
          cancelText="继续编辑"
          onCancel={() => setShowDiscardConfirm(false)}
          onConfirm={closeDraft}
        />

        <ConfirmModal
          isOpen={confirmDeleteId !== null}
          title="删除小册子"
          message="删除后不可恢复，确定要删除这本小册子吗？"
          confirmText="删除"
          cancelText="取消"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={handleConfirmDelete}
        />
      </div>
    );
  }

  /* -------------------------------- 书架页 -------------------------------- */
  const isTooLong = stats.enabledLength > SHARED_WORLD_LENGTH_WARNING;

  return (
    <div className="shared-world-app">
      <header className="sw-header">
        <button
          type="button"
          onClick={onBackHub}
          className="sw-icon-button"
          aria-label="返回首页"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="sw-header-title">
          <h1>共享世界</h1>
          <p>Shared World</p>
        </div>

        <button
          type="button"
          onClick={() => openDraft(null)}
          className="sw-primary-button"
        >
          <Plus className="h-3.5 w-3.5" />
          新建
        </button>
      </header>

      <main className="sw-scroll">
        <section className="sw-summary">
          <p>
            共 {stats.total} 本，启用 {stats.enabledCount} 本，约 {stats.enabledLength} 字
          </p>
          <p className="sw-hint">
            这里的内容会写进所选角色的每一次聊天与线下见面，
            位置在核心总提示词之后、角色设定之前。
          </p>
          {isTooLong && (
            <p className="sw-warning">
              启用的内容已超过 {SHARED_WORLD_LENGTH_WARNING} 字，每次对话都会带上，会占用较多 token，可以精简或暂时关闭几本。
            </p>
          )}
        </section>

        {isLoading ? (
          <p className="sw-empty">正在取书...</p>
        ) : entries.length === 0 ? (
          <div className="sw-empty">
            <BookMarked className="mx-auto mb-3 h-6 w-6 opacity-50" />
            <p>书架还是空的。</p>
            <p className="sw-hint">新建一本，写下同一个世界里大家都该知道的事。</p>
          </div>
        ) : (
          <div className="sw-shelf">
            {entries.map((entry, index) => {
              const snippet = String(entry.content || '').trim();

              return (
                <article
                  key={entry.id}
                  className={`sw-booklet ${entry.isEnabled ? '' : 'is-disabled'}`}
                  style={{ '--sw-spine-strength': `${34 + (index % 4) * 12}%` }}
                >
                  <div className="sw-spine" />

                  <button
                    type="button"
                    className="sw-cover"
                    onClick={() => openDraft(entry)}
                  >
                    <span className="sw-index">{formatIndex(index)}</span>
                    <h3 className="sw-booklet-title">{entry.title}</h3>
                    <p className="sw-snippet">
                      {snippet || '这一本还是空白的。'}
                    </p>
                    <span className="sw-meta">
                      {getScopeLabel(entry, characters)}
                      {' · '}
                      {snippet.length} 字
                      {entry.isEnabled ? '' : ' · 已关闭'}
                    </span>
                  </button>

                  <div className="sw-tools">
                    <button
                      type="button"
                      onClick={() => handleMove(entry, -1)}
                      disabled={index === 0}
                      className="sw-tool-button"
                      aria-label="上移"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(entry, 1)}
                      disabled={index === entries.length - 1}
                      className="sw-tool-button"
                      aria-label="下移"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <Switch
                      checked={Boolean(entry.isEnabled)}
                      label="启用"
                      onChange={() => handleToggleEnabled(entry)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default SharedWorldApp;