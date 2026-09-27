import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  Upload,
  X
} from 'lucide-react';

import ConfirmModal from '../../../components/ConfirmModal';
import {
  MEMORY_STATUSES,
  MEMORY_TYPE_OPTIONS,
  MEMORY_TYPES
} from '../memoryConstants';
import {
  importOperitEntries,
  parseOperitArchiveFile
} from './operitImportService';
import './operitImport.css';

const getChatLabel = (chat) => (
  chat?.title || `消息框 ${chat?.id || ''}`
);

const collectAllEntryIds = (parseResult) => (
  new Set(
    (parseResult?.folders || [])
      .flatMap((folder) => folder.entries.map((entry) => entry.clientEntryId))
  )
);

export const OperitImportModal = ({
  chats = [],
  initialChatId = null,
  onClose,
  onCompleted,
  onError
}) => {
  const fileInputRef = useRef(null);

  const [parseResult, setParseResult] = useState(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set());
  const [targetChatId, setTargetChatId] = useState(initialChatId || '');
  const [defaultType, setDefaultType] = useState(MEMORY_TYPES.FACT);
  const [defaultImportance, setDefaultImportance] = useState(3);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError] = useState('');

  const selectedChat = useMemo(
    () => chats.find((chat) => String(chat.id) === String(targetChatId)) || null,
    [chats, targetChatId]
  );

  const selectedCount = selectedEntryIds.size;

  const handleFileChange = async (event) => {
    const files = event.target.files;

    if (!files || files.length === 0) return;

    setIsParsing(true);
    setLocalError('');

    try {
      const result = await parseOperitArchiveFile(files);

      setParseResult(result);
      setSelectedEntryIds(collectAllEntryIds(result));
    } catch (error) {
      const message = error?.message || '读取 Operit 记忆归档失败。';

      setLocalError(message);
      onError?.(message);
      setParseResult(null);
    } finally {
      setIsParsing(false);

      // 允许再次选择同一个文件（例如 Operit 那边重新导出后覆盖导入）。
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleEntry = (clientEntryId) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);

      if (next.has(clientEntryId)) {
        next.delete(clientEntryId);
      } else {
        next.add(clientEntryId);
      }

      return next;
    });
  };

  const setAllEntries = (checked) => {
    if (!parseResult) return;

    if (!checked) {
      setSelectedEntryIds(new Set());
      return;
    }

    setSelectedEntryIds(collectAllEntryIds(parseResult));
  };

  const handleStartImport = () => {
    if (!parseResult) {
      setLocalError('请先选择一个 Operit 记忆归档文件（.json）。');
      return;
    }

    if (!selectedChat) {
      setLocalError('请选择记忆要进入的消息框。');
      return;
    }

    if (selectedCount === 0) {
      setLocalError('请至少勾选一条要导入的记忆。');
      return;
    }

    setLocalError('');
    setShowConfirm(true);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || !selectedChat) return;

    setShowConfirm(false);
    setIsImporting(true);
    setLocalError('');

    try {
      const result = await importOperitEntries({
        chatId: selectedChat.id,
        folders: parseResult.folders,
        selectedEntryIds: Array.from(selectedEntryIds),
        defaultType,
        defaultImportance,
        defaultStatus: MEMORY_STATUSES.ACTIVE
      });

      const failedNote = result.failedCount > 0
        ? `，${result.failedCount} 条导入失败`
        : '';

      onCompleted?.(
        `Operit 归档导入完成：新增 ${result.insertedCount} 条记忆，`
        + `更新 ${result.updatedCount} 条${failedNote}。`
      );

      onClose?.();
    } catch (error) {
      const message = error?.message || '导入 Operit 记忆归档失败。';

      setLocalError(message);
      onError?.(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <div className="memory-modal-backdrop">
        <section
          className="memory-modal operit-import-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="operit-import-title"
        >
          <div className="memory-modal-header">
            <div>
              <p className="memory-eyebrow">OPERIT INTAKE</p>
              <h2 id="operit-import-title">导入 Operit 记忆归档</h2>
            </div>

            <button
              type="button"
              className="memory-modal-close"
              onClick={onClose}
              aria-label="关闭导入窗口"
              disabled={isImporting}
            >
              <X className="memory-icon" />
            </button>
          </div>

          <div className="memory-import-copy">
            <p>
              选择一份 Operit 导出的记忆归档文件（.json），里面的每条记忆
              会各自成为一条独立的记忆。归档本身不绑定角色，导入到哪个
              消息框由你在下面手动选择。
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="memory-hidden-file-input"
            onChange={handleFileChange}
          />

          <button
            type="button"
            className="memory-file-picker"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing || isImporting}
          >
            <FileText className="memory-file-picker-icon" />
            <span>
              <strong>
                {isParsing
                  ? '正在读取归档'
                  : parseResult
                    ? '已读取归档文件'
                    : '选择 Operit 归档文件（.json）'}
              </strong>
              <small>
                {parseResult
                  ? `共 ${parseResult.summary.totalEntryCount} 条记忆`
                    + (parseResult.summary.invalidEntryCount > 0
                      ? `，${parseResult.summary.invalidEntryCount} 条无正文已跳过`
                      : '')
                  : '每次导入一份归档文件'}
              </small>
            </span>
            <Upload className="memory-icon" />
          </button>

          {localError && (
            <div className="memory-message memory-message-error">
              <span>{localError}</span>
            </div>
          )}

          {parseResult && (
            <>
              {parseResult.summary.invalidEntryCount > 0 && (
                <div className="memory-import-warning">
                  <AlertTriangle className="memory-action-icon" />
                  有 {parseResult.summary.invalidEntryCount} 条记忆没有正文
                  内容，已跳过，不影响其余记忆导入。
                </div>
              )}

              <label className="memory-form-label">
                <span>导入到哪一个消息框</span>
                <select
                  value={targetChatId}
                  onChange={(event) => setTargetChatId(event.target.value)}
                  disabled={isImporting}
                >
                  <option value="">请选择消息框</option>
                  {chats.map((chat) => (
                    <option key={chat.id} value={chat.id}>
                      {getChatLabel(chat)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="operit-default-fields">
                <label className="memory-form-label">
                  <span>记忆类型（Operit 归档里没有这个字段，统一按此设定）</span>
                  <select
                    value={defaultType}
                    onChange={(event) => setDefaultType(event.target.value)}
                    disabled={isImporting}
                  >
                    {MEMORY_TYPE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="memory-form-label">
                  <span>重要度（1-5，统一按此设定）</span>
                  <select
                    value={defaultImportance}
                    onChange={(event) => setDefaultImportance(
                      Number(event.target.value)
                    )}
                    disabled={isImporting}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="operit-select-actions">
                <span className="memory-form-label-title">
                  已选择 {selectedCount} / {parseResult.summary.totalEntryCount} 条
                </span>
                <button
                  type="button"
                  onClick={() => setAllEntries(true)}
                  disabled={isImporting}
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => setAllEntries(false)}
                  disabled={isImporting}
                >
                  全不选
                </button>
              </div>

              <div className="operit-entry-list">
                {parseResult.folders.map((folder) => (
                  <div
                    key={folder.folderPath}
                    className="operit-folder-group"
                  >
                    <p className="operit-folder-group-title">
                      {folder.folderPath}
                    </p>

                    {folder.entries.map((entry) => (
                      <label
                        key={entry.clientEntryId}
                        className={[
                          'memory-choice-item',
                          selectedEntryIds.has(entry.clientEntryId)
                            ? 'memory-choice-item-active'
                            : ''
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEntryIds.has(entry.clientEntryId)}
                          onChange={() => toggleEntry(entry.clientEntryId)}
                          disabled={isImporting}
                        />
                        <span>
                          <strong>{entry.title}</strong>
                          <small>{entry.content}</small>
                          <small className="operit-entry-meta">
                            {entry.tags.length > 0 && `标签：${entry.tags.join('、')} · `}
                            {entry.operitSource || '未标注来源'}
                            {!entry.hasStableId && ' · 无稳定 ID，重复导入会新增而非更新'}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="memory-modal-actions">
            <button
              type="button"
              className="memory-secondary-button"
              onClick={onClose}
              disabled={isImporting}
            >
              取消
            </button>

            <button
              type="button"
              className="memory-primary-button"
              onClick={handleStartImport}
              disabled={
                !parseResult
                || !selectedChat
                || selectedCount === 0
                || isImporting
              }
            >
              {isImporting ? '正在写入档案' : '继续导入'}
            </button>
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="确认导入 Operit 记忆归档"
        message={
          `确定要把选中的 ${selectedCount} 条记忆导入`
          + `“${selectedChat?.title || '当前消息框'}”吗？`
          + '与之前导入过、同一条 Operit 记忆会被覆盖更新，其余内容将新增为记忆。'
        }
        confirmText="确认导入"
        cancelText="返回检查"
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmImport}
      />
    </>
  );
};

export default OperitImportModal;