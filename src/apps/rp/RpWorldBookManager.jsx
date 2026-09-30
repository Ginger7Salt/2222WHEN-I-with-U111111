// src/apps/rp/RpWorldBookManager.jsx
//
// 长RP子应用切片E：世界书管理入口，从 RpRoom 头部的"世界书"按钮打开。
//
// 结构照抄 RpPresetManager.jsx 的两层形状（列表层 + 内嵌编辑器），区别是
// 世界书是共享库，一个会话可以同时挂多本（不是单选），所以列表层每本书
// 前面是个勾选框（挂/不挂到当前会话），不是"点了就切换"的单选高亮。

import React, { useEffect, useState } from 'react';
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, Check, Info,
} from 'lucide-react';

import ConfirmModal from '../../components/ConfirmModal';
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
      {/* 头部不做满宽的一条横杠、也不做背景色块。用三栏flex（不是
          position:absolute）让关闭/保存分落两侧、标题居中——RpRoom外壳有
          一个"forwards"填充的transform入场动画，会让absolute定位的子元素
          在部分浏览器（尤其iOS Safari）上出现"看着在原位、实际点不中"的
          已知渲染错位问题，这里的按钮全部改回普通flow布局。 */}
      <div className="flex shrink-0 items-center gap-2 px-4 pb-4 pt-5">
        <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-center text-[15px] font-bold outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
        >
          保存
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-5 pt-1">
        <div className="flex items-center justify-between px-0.5">
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
                className="overflow-hidden rounded-2xl"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  boxShadow: 'var(--card-shadow)',
                  border: '1px solid color-mix(in srgb, var(--card-border) 70%, transparent)',
                }}
              >
                <div className="flex items-center gap-2.5 p-3">
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
                  <div className="space-y-2 p-3 pt-0.5">
                    <input
                      value={(entry.keywords || []).join('，')}
                      onChange={(e) => updateEntryKeywords(entry.id, e.target.value)}
                      placeholder="触发关键词，用逗号分隔，比如：深渊、猎人协会"
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)' }}
                    />
                    <textarea
                      value={entry.content}
                      onChange={(e) => updateEntryField(entry.id, 'content', e.target.value)}
                      placeholder="命中关键词后要注入给AI的背景设定内容"
                      rows={4}
                      className="w-full rounded-lg px-2.5 py-2 text-xs outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)' }}
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

// 书封渐变——跟电台卡片同一套三色循环，书架跟电台是同一批视觉重做，
// 用同一个取色节奏。
const SHELF_GRADIENT_VARS = ['--bg-blob-1', '--bg-blob-2', '--bg-blob-3'];

const RpWorldBookManager = ({ attachedWorldBookIds = [], onToggleAttach, onClose }) => {
  const [books, setBooks] = useState([]);
  const [editingBook, setEditingBook] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const handleDelete = async (bookId) => {
    await deleteRpWorldBook(bookId);
    setDeleteTarget(null);
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
      {/* 三栏flex，不用position:absolute（原因见WorldBookEditor头部的注释）。 */}
      <div className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-5">
        <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">World Books</p>
          <h3 className="mt-1 text-lg font-bold">书架</h3>
        </div>
        <button type="button" onClick={handleCreate} className="flex h-8 w-8 shrink-0 items-center justify-center opacity-60 hover:opacity-100" title="新建世界书">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 pt-1">
        <div className="mb-4 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-[10.5px] leading-relaxed opacity-70" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            点封面挂载/取消挂载到本局，一局可以同时挂多本。生成时只会扫描最近几层楼里命中关键词的条目注入给AI，不是整本无条件塞给AI。删除某本世界书无法恢复。
          </span>
        </div>

        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-xs opacity-50">还没有世界书，先新建一个</p>
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
            >
              <Plus className="h-3.5 w-3.5" /> 新建世界书
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {books.map((book, idx) => {
              const isAttached = attachedWorldBookIds.includes(book.id);
              const gradientVar = SHELF_GRADIENT_VARS[idx % SHELF_GRADIENT_VARS.length];
              return (
                <div key={book.id} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => onToggleAttach(book.id)}
                    className="relative overflow-hidden rounded-lg text-left"
                    style={{
                      aspectRatio: '3 / 4',
                      boxShadow: isAttached
                        ? '0 10px 22px rgba(0,0,0,.18), 0 0 0 2px var(--accent-color)'
                        : '0 10px 22px rgba(0,0,0,.16)',
                    }}
                  >
                    {/* 封面上半部：渐变色块 + 书名首字，e-book 封面的极简画风 */}
                    <div
                      className="absolute inset-x-0 top-0 flex items-center justify-center"
                      style={{
                        height: '64%',
                        background: `linear-gradient(150deg, color-mix(in srgb, var(${gradientVar}) 88%, var(--card-bg)), var(--card-bg))`,
                      }}
                    >
                      <span
                        className="text-4xl font-bold"
                        style={{ color: 'rgba(255,255,255,.92)', textShadow: '0 2px 10px rgba(0,0,0,.15)' }}
                      >
                        {book.name?.[0] || '书'}
                      </span>
                    </div>

                    {/* 封面下半部：标题铭牌 */}
                    <div
                      className="absolute inset-x-0 bottom-0 flex flex-col justify-center px-2.5 py-2"
                      style={{ top: '64%', backgroundColor: 'var(--card-bg)' }}
                    >
                      <p className="line-clamp-2 text-[12.5px] font-bold leading-tight">{book.name}</p>
                      <p className="mt-0.5 text-[9px] font-semibold opacity-50">{(book.entries || []).length} 条目</p>
                    </div>

                    {/* 折角：挂载状态用主题色，未挂载用灰色 */}
                    <div
                      className="absolute right-0 top-0"
                      style={{
                        width: 0,
                        height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 20px 20px 0',
                        borderColor: isAttached
                          ? `transparent var(--accent-color) transparent transparent`
                          : `transparent color-mix(in srgb, var(--text-muted) 35%, transparent) transparent transparent`,
                      }}
                    />
                    {isAttached ? (
                      <Check
                        className="absolute right-0.5 top-0.5 h-2.5 w-2.5"
                        style={{ color: 'var(--accent-foreground)' }}
                      />
                    ) : null}
                  </button>

                  <div className="mt-1.5 flex items-center justify-center gap-3 text-[10.5px]">
                    <button
                      type="button"
                      onClick={() => setEditingBook(book)}
                      className="opacity-60 hover:opacity-100"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(book)}
                      className="text-red-500 opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          title="删除世界书"
          message={`确定要删除世界书『${deleteTarget.name}』吗？这个操作无法撤销，正在挂载它的会话会自动失去这本书里所有条目。`}
          confirmText="删除"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default RpWorldBookManager;