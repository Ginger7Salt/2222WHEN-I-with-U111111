// src/apps/rp/RpWorldBookManager.jsx
//
// 长RP子应用切片E：世界书管理入口，从 RpRoom 头部的"世界书"按钮打开。
//
// 结构照抄 RpPresetManager.jsx 的两层形状（列表层 + 内嵌编辑器），区别是
// 世界书是共享库，一个会话可以同时挂多本（不是单选），所以列表层每本书
// 前面是个勾选框（挂/不挂到当前会话），不是"点了就切换"的单选高亮。

import React, { useEffect, useState } from 'react';
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, Check,
} from 'lucide-react';

import {
  getAllRpWorldBooks,
  createRpWorldBook,
  updateRpWorldBook,
  deleteRpWorldBook,
} from './rpWorldBookService';

const emptyEntry = () => ({
  id: `wbe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  keywords: [],
  content: '',
  enabled: true,
});

function WorldBookEditor({ book, onClose, onSaved }) {
  const [name, setName] = useState(book.name);
  const [entries, setEntries] = useState(book.entries || []);
  const [expandedId, setExpandedId] = useState(null);

  const moveEntry = (index, dir) => {
    setEntries((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateEntryField = (id, field, value) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const updateEntryKeywords = (id, rawText) => {
    const keywords = rawText.split(/[，,]/).map((k) => k.trim()).filter(Boolean);
    updateEntryField(id, 'keywords', keywords);
  };

  const removeEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const addEntry = () => {
    const e = emptyEntry();
    setEntries((prev) => [...prev, e]);
    setExpandedId(e.id);
  };

  const handleSave = async () => {
    await updateRpWorldBook(book.id, {
      name: name.trim() || book.name,
      entries,
    });
    onSaved();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--divider)' }}>
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mx-2 flex-1 rounded-lg border bg-transparent px-2 py-1 text-center text-xs font-semibold outline-none"
          style={{ borderColor: 'var(--card-border)' }}
        />
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          保存
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold opacity-70">条目</h4>
          <button type="button" onClick={addEntry} className="flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100">
            <Plus className="h-3 w-3" /> 添加
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="py-8 text-center text-[11px] opacity-50">还没有条目，先添加一个</p>
        ) : (
          entries.map((entry, index) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--card-border)', backgroundColor: 'var(--card-bg)' }}
              >
                <div className="flex items-center gap-2 p-2.5">
                  <input
                    type="checkbox"
                    checked={entry.enabled !== false}
                    onChange={(e) => updateEntryField(entry.id, 'enabled', e.target.checked)}
                    className="h-3.5 w-3.5 accent-current shrink-0"
                  />
                  <span
                    className="flex-1 truncate text-xs font-semibold cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    {(entry.keywords || []).join('、') || '（未设置关键词）'}
                  </span>
                  <button type="button" onClick={() => moveEntry(index, -1)} disabled={index === 0} className="opacity-50 hover:opacity-100 disabled:opacity-20">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveEntry(index, 1)} disabled={index === entries.length - 1} className="opacity-50 hover:opacity-100 disabled:opacity-20">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeEntry(entry.id)} className="text-red-500 opacity-60 hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="space-y-2 border-t p-2.5" style={{ borderColor: 'var(--divider)' }}>
                    <input
                      value={(entry.keywords || []).join('，')}
                      onChange={(e) => updateEntryKeywords(entry.id, e.target.value)}
                      placeholder="触发关键词，用逗号分隔，比如：深渊、猎人协会"
                      className="w-full rounded-lg border px-2 py-1 text-xs outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                    />
                    <textarea
                      value={entry.content}
                      onChange={(e) => updateEntryField(entry.id, 'content', e.target.value)}
                      placeholder="命中关键词后要注入给AI的背景设定内容"
                      rows={4}
                      className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--card-border)' }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const RpWorldBookManager = ({ attachedWorldBookIds = [], onToggleAttach, onClose }) => {
  const [books, setBooks] = useState([]);
  const [editingBook, setEditingBook] = useState(null);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setBooks(await getAllRpWorldBooks());
  };

  const handleCreate = async () => {
    const newId = await createRpWorldBook({ name: `新世界书 ${books.length + 1}` });
    await loadBooks();
    const fresh = await getAllRpWorldBooks();
    const created = fresh.find((b) => b.id === newId);
    if (created) setEditingBook(created);
  };

  const handleDelete = async (e, bookId) => {
    e.stopPropagation();
    await deleteRpWorldBook(bookId);
    loadBooks();
  };

  if (editingBook) {
    return (
      <WorldBookEditor
        book={editingBook}
        onClose={() => setEditingBook(null)}
        onSaved={async () => {
          setEditingBook(null);
          await loadBooks();
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--divider)' }}>
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-xs font-bold">世界书（勾选挂载到本局）</h3>
        <div className="w-4" />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        <button
          type="button"
          onClick={handleCreate}
          className="flex w-full items-center justify-center gap-1 rounded-xl border py-2 text-xs font-semibold"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <Plus className="h-3.5 w-3.5" /> 新建世界书
        </button>

        {books.length === 0 ? (
          <p className="py-10 text-center text-xs opacity-50">还没有世界书，先新建一个</p>
        ) : (
          books.map((book) => {
            const isAttached = attachedWorldBookIds.includes(book.id);
            return (
              <div
                key={book.id}
                onClick={() => onToggleAttach(book.id)}
                className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"
                style={{
                  borderColor: isAttached ? 'var(--accent-color)' : 'var(--card-border)',
                  backgroundColor: 'var(--card-bg)',
                }}
              >
                <div
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isAttached ? 'var(--accent-color)' : 'var(--control-soft-bg)',
                  }}
                >
                  {isAttached && <Check className="h-2.5 w-2.5" style={{ color: 'var(--accent-foreground)' }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{book.name}</span>
                  <span className="block text-[10px] opacity-50">{(book.entries || []).length} 条目</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditingBook(book); }}
                  className="text-[11px] opacity-60 hover:opacity-100"
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, book.id)}
                  className="text-red-500 opacity-60 hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RpWorldBookManager;