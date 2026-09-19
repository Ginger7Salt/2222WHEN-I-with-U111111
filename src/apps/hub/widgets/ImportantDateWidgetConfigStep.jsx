// src/apps/hub/widgets/ImportantDateWidgetConfigStep.jsx
//
// "纪念日倒数"小组件在添加时的配置步骤：先选一个角色/聊天，再从这个
// 角色已有的重要日期里选一条，或者当场新建一条。新建走的是 Almanac
// 现成的 createAlmanacImportantDate，新建出来的日期同时也会出现在
// Almanac 自己的"重要日期"列表里，不是首页私有的另一份数据。

import React, { useEffect, useState } from 'react';
import { getWorkflowCandidateChats } from '../../../services/workflow/workflowService';
import {
  getAlmanacImportantDates,
  createAlmanacImportantDate,
} from '../../almanac/services/almanacImportantDateService';

const inputStyle = {
  backgroundColor: 'var(--control-soft-bg)',
  borderColor: 'var(--card-border)',
  color: 'var(--text-main)',
};

export const ImportantDateWidgetConfigStep = ({ onConfirm, onCancel }) => {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState('');
  const [existingDates, setExistingDates] = useState([]);
  const [selectedDateId, setSelectedDateId] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newIsRecurringYearly, setNewIsRecurringYearly] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getWorkflowCandidateChats().then(setChats);
  }, []);

  useEffect(() => {
    if (!selectedChatId) {
      setExistingDates([]);
      return;
    }

    getAlmanacImportantDates(selectedChatId).then((dates) => {
      setExistingDates(dates);
      setIsCreatingNew(dates.length === 0);
    });

    setSelectedDateId('');
  }, [selectedChatId]);

  const handleConfirm = async () => {
    if (isCreatingNew) {
      if (!newTitle.trim() || !newDate) return;

      setIsSaving(true);
      try {
        const createdId = await createAlmanacImportantDate({
          chatId: selectedChatId,
          title: newTitle,
          date: newDate,
          isRecurringYearly: newIsRecurringYearly,
        });

        if (createdId) {
          onConfirm({ importantDateId: createdId });
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (selectedDateId) {
      onConfirm({ importantDateId: Number(selectedDateId) });
    }
  };

  const canConfirm = selectedChatId
    ? isCreatingNew
      ? Boolean(newTitle.trim() && newDate)
      : Boolean(selectedDateId)
    : false;

  return (
    <div className="space-y-3 text-left text-xs">
      <label className="block space-y-1.5">
        <span className="opacity-60">选择角色/聊天</span>
        <select
          value={selectedChatId}
          onChange={(event) => {
            // chats 表的 id 是数字型主键，select 的 value 永远是字符串，
            // 这里转回数字，避免后面按 chatId 查询时数字/字符串类型不
            // 匹配查不到数据（IndexedDB 的索引比较是区分类型的）。
            const value = event.target.value;
            setSelectedChatId(value ? Number(value) : '');
          }}
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={inputStyle}
        >
          <option value="">请选择</option>
          {chats.map((chat) => (
            <option value={chat.id} key={chat.id}>
              {chat.title || chat.character?.name || '未命名聊天'}
            </option>
          ))}
        </select>
      </label>

      {selectedChatId && existingDates.length > 0 && (
        <label className="block space-y-1.5">
          <span className="opacity-60">选择一条已有的纪念日</span>
          <select
            value={isCreatingNew ? '' : selectedDateId}
            onChange={(event) => {
              setIsCreatingNew(false);
              setSelectedDateId(event.target.value);
            }}
            className="w-full rounded-xl border px-3 py-2 text-xs"
            style={inputStyle}
          >
            <option value="">请选择</option>
            {existingDates.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title} · {item.date}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedChatId && (
        <button
          type="button"
          onClick={() => {
            setIsCreatingNew(true);
            setSelectedDateId('');
          }}
          className="text-[11px] underline opacity-60 hover:opacity-100"
        >
          {existingDates.length > 0 ? '或者新建一条纪念日' : '新建一条纪念日'}
        </button>
      )}

      {selectedChatId && isCreatingNew && (
        <div
          className="space-y-2 rounded-xl border p-3"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <input
            type="text"
            placeholder="纪念日标题，比如生日、在一起纪念日"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-xs"
            style={inputStyle}
          />
          <input
            type="date"
            value={newDate}
            onChange={(event) => setNewDate(event.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-xs"
            style={inputStyle}
          />
          <label className="flex items-center gap-2 text-[11px] opacity-70">
            <input
              type="checkbox"
              checked={newIsRecurringYearly}
              onChange={(event) => setNewIsRecurringYearly(event.target.checked)}
            />
            每年重复（生日/纪念日）
          </label>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border py-2 text-center opacity-80"
          style={{
            borderColor: 'var(--card-border)',
            backgroundColor: 'var(--control-soft-bg)',
          }}
        >
          取消
        </button>
        <button
          type="button"
          disabled={!canConfirm || isSaving}
          onClick={handleConfirm}
          className="flex-1 rounded-xl py-2 text-center font-semibold disabled:opacity-40"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--accent-foreground)',
          }}
        >
          {isSaving ? '添加中...' : '添加小组件'}
        </button>
      </div>
    </div>
  );
};

export default ImportantDateWidgetConfigStep;