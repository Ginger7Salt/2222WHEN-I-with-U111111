import React, { useState } from 'react';
import { Download, X } from 'lucide-react';

import {
  buildMemoryExport,
  downloadMemoryExport
} from './memoryImportExport';
import { downloadObsidianMarkdownExport } from './obsidianImport/obsidianMarkdownExporter';

const EXPORT_FORMATS = {
  JSON: 'json',
  OBSIDIAN_MARKDOWN: 'obsidian_markdown'
};

const formatDate = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export const MemoryExportModal = ({
  currentChat,
  onClose,
  onCompleted,
  onError
}) => {
  const [scope, setScope] = useState('current_chat');
  const [format, setFormat] = useState(EXPORT_FORMATS.JSON);
  const [isExporting, setIsExporting] = useState(false);
  const [preview, setPreview] = useState(null);

  const handlePreview = async () => {
    try {
      const exportScope = scope === 'current_chat'
        ? { type: 'chat', chatId: currentChat?.id }
        : { type: 'all' };

      const payload = await buildMemoryExport(exportScope);

      setPreview({
        chatCount: payload.chatReferences?.length || 0,
        memoryCount: payload.memories?.length || 0,
        candidateCount: payload.candidates?.length || 0,
        revisionCount: payload.revisions?.length || 0,
        exportedAt: payload.exportedAt
      });
    } catch (error) {
      onError?.(error?.message || '生成导出预览失败。');
    }
  };

  const handleExport = async () => {
    if (scope === 'current_chat' && !currentChat?.id) {
      onError?.('请先选择一个消息框。');
      return;
    }

    setIsExporting(true);

    try {
      const exportScope = scope === 'current_chat'
        ? { type: 'chat', chatId: currentChat.id }
        : { type: 'all' };

      if (format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN) {
        const result = await downloadObsidianMarkdownExport(exportScope);

        onCompleted?.(
          result.fileCount > 1
            ? `已导出 ${result.fileCount} 个消息框、共 ${result.memoryCount} 条记忆的 .md 文件（打包为 zip）。`
            : `已导出“${currentChat?.title || '当前消息框'}”的 ${result.memoryCount} 条记忆为 .md 文件。`
        );
      } else {
        const payload = await downloadMemoryExport(exportScope);

        onCompleted?.(
          scope === 'current_chat'
            ? `已导出“${currentChat.title || '当前消息框'}”的 ${payload.memories?.length || 0} 条记忆。`
            : `已导出全部消息框的 ${payload.memories?.length || 0} 条记忆。`
        );
      }

      onClose?.();
    } catch (error) {
      onError?.(error?.message || '导出记忆失败。');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="memory-modal-backdrop">
      <section
        className="memory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-export-title"
      >
        <div className="memory-modal-header">
          <div>
            <p className="memory-eyebrow">TAKE A COPY</p>
            <h2 id="memory-export-title">带走一份记忆副本</h2>
          </div>

          <button
            type="button"
            className="memory-modal-close"
            onClick={onClose}
            aria-label="关闭导出窗口"
          >
            <X className="memory-icon" />
          </button>
        </div>

        <div className="memory-export-copy">
          {format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN ? (
            <>
              <p>
                导出为 Obsidian 可用的 .md 文件：每个消息框一个文件，每条
                记忆是一个二级标题，标题下会带一行类型和重要度的标注，方便
                以后重新导入时认出来。
              </p>
              <p>
                只导出正式记忆本身，不包含待确认片段、修订记录和原始聊天。
              </p>
            </>
          ) : (
            <>
              <p>
                导出的 JSON 可用于之后恢复记忆。它不包含聊天原文、API Key
                或运行中的任务状态。
              </p>
              <p>
                导出文件会保留记忆、待确认片段、修订记录，以及原始消息依据的状态。
              </p>
            </>
          )}
        </div>

        <div className="memory-choice-list">
          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportFormat"
              value={EXPORT_FORMATS.JSON}
              checked={format === EXPORT_FORMATS.JSON}
              onChange={() => {
                setFormat(EXPORT_FORMATS.JSON);
                setPreview(null);
              }}
            />
            <span>
              <strong>JSON（可以导回本项目）</strong>
              <small>用于之后恢复记忆，包含待确认片段和修订记录。</small>
            </span>
          </label>

          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportFormat"
              value={EXPORT_FORMATS.OBSIDIAN_MARKDOWN}
              checked={format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN}
              onChange={() => {
                setFormat(EXPORT_FORMATS.OBSIDIAN_MARKDOWN);
                setPreview(null);
              }}
            />
            <span>
              <strong>Obsidian Markdown（.md）</strong>
              <small>只包含正式记忆，方便放进 Obsidian 库里查看和编辑。</small>
            </span>
          </label>
        </div>

        <div className="memory-choice-list">
          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportScope"
              value="current_chat"
              checked={scope === 'current_chat'}
              onChange={() => {
                setScope('current_chat');
                setPreview(null);
              }}
              disabled={!currentChat}
            />
            <span>
              <strong>导出当前消息框</strong>
              <small>
                {currentChat
                  ? `仅导出“${currentChat.title || '当前消息框'}”的记忆。`
                  : '请先选择一个消息框。'}
              </small>
            </span>
          </label>

          <label className="memory-choice-item">
            <input
              type="radio"
              name="memoryExportScope"
              value="all"
              checked={scope === 'all'}
              onChange={() => {
                setScope('all');
                setPreview(null);
              }}
            />
            <span>
              <strong>导出全部记忆</strong>
              <small>
                {format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN
                  ? '每个消息框导出一个 .md 文件，打包成一个 zip。'
                  : '导出所有消息框中已保存的记忆档案。'}
              </small>
            </span>
          </label>
        </div>

        {format === EXPORT_FORMATS.JSON && (
          <button
            type="button"
            className="memory-preview-button"
            onClick={handlePreview}
          >
            查看导出内容概览
          </button>
        )}

        {format === EXPORT_FORMATS.JSON && preview && (
          <div className="memory-export-preview">
            <div>
              <span>涉及消息框</span>
              <strong>{preview.chatCount}</strong>
            </div>
            <div>
              <span>正式记忆</span>
              <strong>{preview.memoryCount}</strong>
            </div>
            <div>
              <span>待确认片段</span>
              <strong>{preview.candidateCount}</strong>
            </div>
            <div>
              <span>修订记录</span>
              <strong>{preview.revisionCount}</strong>
            </div>
            <small>预览生成时间：{formatDate(preview.exportedAt)}</small>
          </div>
        )}

        <div className="memory-modal-actions">
          <button
            type="button"
            className="memory-secondary-button"
            onClick={onClose}
            disabled={isExporting}
          >
            取消
          </button>

          <button
            type="button"
            className="memory-primary-button"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="memory-action-icon" />
            {isExporting
              ? '正在导出'
              : format === EXPORT_FORMATS.OBSIDIAN_MARKDOWN
                ? '导出 Markdown'
                : '导出 JSON'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default MemoryExportModal;