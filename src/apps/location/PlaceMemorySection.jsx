import React, { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';

import {
  PLACE_MEMORY_USER_MAX_CHARS,
  addUserPlaceMemory,
  deletePlaceMemory,
  listPlaceMemories,
  updatePlaceMemory,
} from './placeMemoryService';

// 地点小册子里，选中地点下方的"这里发生过的事"：
// 一条条带日期的短句，用户和角色都能留，用户可以编辑、删除任何一条。
// 视觉沿用小册子自己的纸质风格（用 .place-booklet 上的 --place-* 变量）。
const formatMemoryDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

const PlaceMemorySection = ({ place, chatId, characterName }) => {
  const [memories, setMemories] = useState([]);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const placeId = place?.id;

  const reload = useCallback(async () => {
    if (!placeId) {
      setMemories([]);
      return;
    }

    try {
      setMemories(await listPlaceMemories(placeId));
    } catch (error) {
      console.warn('[Location] 读取地点小记录失败：', error);
      setMemories([]);
    }
  }, [placeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!place) return null;

  const handleAdd = async () => {
    if (!draft.trim()) return;

    try {
      await addUserPlaceMemory({ chatId, placeId, text: draft });
      setDraft('');
      await reload();
    } catch (error) {
      console.warn('[Location] 添加地点小记录失败：', error);
    }
  };

  const handleStartEdit = (memory) => {
    setConfirmingDeleteId(null);
    setEditingId(memory.id);
    setEditingText(memory.text);
  };

  const handleSaveEdit = async () => {
    if (!editingText.trim()) return;

    try {
      await updatePlaceMemory(editingId, editingText);
      setEditingId(null);
      await reload();
    } catch (error) {
      console.warn('[Location] 修改地点小记录失败：', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePlaceMemory(id);
      setConfirmingDeleteId(null);
      await reload();
    } catch (error) {
      console.warn('[Location] 删除地点小记录失败：', error);
    }
  };

  return (
    <div className="pm-section">
      <style>{`
        .pm-section {
          margin: 40px 2px 0;
        }

        .pm-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .pm-place-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.3px;
          color: var(--place-muted);
        }

        .pm-list {
          margin: 10px 0 0;
          padding: 0;
          list-style: none;
        }

        .pm-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          padding: 14px 0;
          border-bottom: 1px solid var(--place-line);
        }

        .pm-text {
          margin: 0;
          font-family: Georgia, "Times New Roman", "Noto Serif SC", serif;
          font-size: 13px;
          line-height: 1.65;
          color: var(--place-ink);
          overflow-wrap: anywhere;
        }

        .pm-meta {
          margin: 5px 0 0;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .4px;
          color: var(--place-muted);
        }

        .pm-author-char {
          color: var(--place-ink);
        }

        .pm-actions {
          display: flex;
          align-items: flex-start;
          gap: 2px;
        }

        .pm-icon-button {
          display: inline-flex;
          width: 30px;
          height: 30px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: var(--place-soft);
          cursor: pointer;
          transition: background .3s ease, color .3s ease, transform .3s var(--place-ease);
        }

        .pm-icon-button:hover {
          background: var(--place-wash);
          color: var(--place-ink);
        }

        .pm-icon-button:active {
          transform: scale(.9);
        }

        .pm-confirm {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--place-muted);
        }

        .pm-confirm button {
          border: 0;
          background: transparent;
          padding: 4px 2px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          color: var(--place-ink);
        }

        .pm-confirm button.danger {
          color: #b3413a;
        }

        .pm-input,
        .pm-textarea {
          width: 100%;
          border: 1px solid var(--place-line);
          border-radius: 14px;
          background: rgba(255,255,255,.7);
          padding: 9px 13px;
          font-family: inherit;
          font-size: 13px;
          line-height: 1.5;
          color: var(--place-ink);
          outline: none;
          transition: border-color .3s ease, background .3s ease;
        }

        .pm-input:focus,
        .pm-textarea:focus {
          border-color: rgba(17,17,15,.35);
          background: #ffffff;
        }

        .pm-textarea {
          resize: none;
        }

        .pm-edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 6px;
        }

        .pm-add {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
        }

        .pm-add-button {
          display: inline-flex;
          flex-shrink: 0;
          height: 38px;
          align-items: center;
          gap: 5px;
          padding: 0 15px;
          border: 0;
          border-radius: 999px;
          background: var(--place-black);
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: transform .4s var(--place-ease), opacity .3s ease;
        }

        .pm-add-button:active {
          transform: scale(.95);
        }

        .pm-add-button:disabled {
          opacity: .3;
          cursor: not-allowed;
        }

        .pm-empty {
          margin: 14px 0 0;
          font-family: Georgia, "Times New Roman", "Noto Serif SC", serif;
          font-size: 12px;
          font-style: italic;
          line-height: 1.7;
          color: var(--place-muted);
        }
      `}</style>

      <div className="pm-heading">
        <span className="font-serif text-[26px] tracking-tight text-[#11110f]">
          这里发生过的事
        </span>
        <span className="pm-place-name">{place.name}</span>
      </div>

      {memories.length === 0 ? (
        <p className="pm-empty">
          这里还没有留下故事。你可以写一句，也可以等 {characterName || 'TA'} 悄悄留一句。
        </p>
      ) : (
        <ul className="pm-list">
          {memories.map((memory) => (
            <li key={memory.id} className="pm-item">
              {editingId === memory.id ? (
                <div style={{ gridColumn: '1 / -1' }}>
                  <textarea
                    className="pm-textarea"
                    rows={2}
                    value={editingText}
                    maxLength={PLACE_MEMORY_USER_MAX_CHARS}
                    onChange={(event) => setEditingText(event.target.value)}
                    autoFocus
                  />
                  <div className="pm-edit-actions">
                    <button
                      type="button"
                      className="pm-icon-button"
                      onClick={() => setEditingId(null)}
                      aria-label="取消修改"
                      title="取消"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="pm-icon-button"
                      onClick={() => void handleSaveEdit()}
                      disabled={!editingText.trim()}
                      aria-label="保存修改"
                      title="保存"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="pm-text">{memory.text}</p>
                    <p className="pm-meta">
                      <span className={memory.author === 'char' ? 'pm-author-char' : ''}>
                        {memory.author === 'char' ? (characterName || 'TA') : '我'}
                      </span>
                      {' · '}
                      {formatMemoryDate(memory.createdAt)}
                    </p>
                  </div>

                  {confirmingDeleteId === memory.id ? (
                    <div className="pm-confirm">
                      <span>删除这条？</span>
                      <button type="button" className="danger" onClick={() => void handleDelete(memory.id)}>
                        删除
                      </button>
                      <button type="button" onClick={() => setConfirmingDeleteId(null)}>
                        保留
                      </button>
                    </div>
                  ) : (
                    <div className="pm-actions">
                      <button
                        type="button"
                        className="pm-icon-button"
                        onClick={() => handleStartEdit(memory)}
                        aria-label="编辑这条记录"
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="pm-icon-button"
                        onClick={() => setConfirmingDeleteId(memory.id)}
                        aria-label="删除这条记录"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="pm-add">
        <input
          className="pm-input"
          type="text"
          value={draft}
          maxLength={PLACE_MEMORY_USER_MAX_CHARS}
          placeholder="在这里留一句话..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void handleAdd();
            }
          }}
        />
        <button
          type="button"
          className="pm-add-button"
          onClick={() => void handleAdd()}
          disabled={!draft.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
          记下
        </button>
      </div>
    </div>
  );
};

export default PlaceMemorySection;