import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import { X } from 'lucide-react';

import {
  archiveSpecificMessages,
  getArchivableMessagePreview
} from '../archiveService';
import '../archive.css';

const QUICK_PRESETS = [
  { key: '7d', label: '7 天前', days: 7 },
  { key: '14d', label: '14 天前', days: 14 },
  { key: '30d', label: '30 天前', days: 30 },
  { key: 'all', label: '全选可归档', days: null }
];

const toSafeTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const formatMessageTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getMessagePreviewText = (message) => {
  if (message.type === 'sticker') {
    return `[贴纸] ${message.content || message.metadata?.name || ''}`;
  }

  if (message.type === 'photo') {
    return '[照片]';
  }

  return message.content || '（空消息）';
};

const ArchiveOrganizerModal = ({ chatOverview, onClose }) => {
  const chatId = chatOverview.chatId;

  const [dayGroups, setDayGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [activePreset, setActivePreset] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultNote, setResultNote] = useState('');
  const [hasArchivedAnything, setHasArchivedAnything] = useState(false);

  const loadPreview = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await getArchivableMessagePreview(chatId);
      setDayGroups(result);
    } catch (error) {
      console.error('[Archive] 读取待归档预览失败：', error);
      setDayGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const allMessages = useMemo(
    () => dayGroups.flatMap((group) => group.messages),
    [dayGroups]
  );

  const selectableCount = useMemo(
    () => allMessages.filter((message) => message.isMemorySafe).length,
    [allMessages]
  );

  const toggleMessage = (message) => {
    if (!message.isMemorySafe) {
      return;
    }

    setActivePreset(null);

    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(message.id)) {
        next.delete(message.id);
      } else {
        next.add(message.id);
      }

      return next;
    });
  };

  const toggleDay = (group) => {
    const safeIds = group.messages
      .filter((message) => message.isMemorySafe)
      .map((message) => message.id);

    const allSelected = safeIds.every((id) => selectedIds.has(id));

    setActivePreset(null);

    setSelectedIds((previous) => {
      const next = new Set(previous);

      safeIds.forEach((id) => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });

      return next;
    });
  };

  const applyPreset = (preset) => {
    setActivePreset(preset.key);

    if (preset.key === 'all') {
      setSelectedIds(new Set(
        allMessages
          .filter((message) => message.isMemorySafe)
          .map((message) => message.id)
      ));
      return;
    }

    const cutoffTime = Date.now() - preset.days * 24 * 60 * 60 * 1000;

    setSelectedIds(new Set(
      allMessages
        .filter((message) => {
          if (!message.isMemorySafe) {
            return false;
          }

          const time = toSafeTime(message.timestamp);
          return time !== null && time < cutoffTime;
        })
        .map((message) => message.id)
    ));
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await archiveSpecificMessages(
        chatId,
        Array.from(selectedIds)
      );

      setResultNote(
        result.skippedProtectedCount > 0
          ? `已归档 ${result.archivedCount} 条，${result.skippedProtectedCount} 条因记忆系统还没处理到而跳过`
          : `已归档 ${result.archivedCount} 条`
      );

      if (result.archivedCount > 0) {
        setHasArchivedAnything(true);
        setSelectedIds(new Set());
        setActivePreset(null);
        await loadPreview();
      }
    } catch (error) {
      console.error('[Archive] 手动归档失败：', error);
      setResultNote('归档失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="archive-organizer-overlay">
      <section className="archive-organizer-panel">
        <header className="archive-organizer-header">
          <div>
            <div className="archive-organizer-title">整理归档</div>
            <div className="archive-organizer-sub">
              勾选想要提前收进档案柜的旧消息
            </div>
          </div>

          <button
            type="button"
            className="archive-organizer-close"
            onClick={() => onClose(hasArchivedAnything)}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="archive-organizer-quickrow">
          {QUICK_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.key}
              className={[
                'archive-organizer-quickbtn',
                activePreset === preset.key ? 'is-active' : ''
              ].join(' ')}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}

          <button
            type="button"
            className="archive-organizer-quickbtn"
            onClick={() => {
              setActivePreset(null);
              setSelectedIds(new Set());
            }}
          >
            清空
          </button>
        </div>

        <div className="archive-organizer-list">
          {isLoading && (
            <div className="archive-organizer-empty">正在整理旧消息。</div>
          )}

          {!isLoading && dayGroups.length === 0 && (
            <div className="archive-organizer-empty">
              没有还能归档的消息了。
            </div>
          )}

          {!isLoading && dayGroups.map((group) => {
            const safeIds = group.messages
              .filter((message) => message.isMemorySafe)
              .map((message) => message.id);

            const allSelected =
              safeIds.length > 0 &&
              safeIds.every((id) => selectedIds.has(id));

            return (
              <div className="archive-organizer-day" key={group.dayKey}>
                <div className="archive-organizer-day-header">
                  <input
                    type="checkbox"
                    className="archive-organizer-day-checkbox"
                    checked={allSelected}
                    disabled={safeIds.length === 0}
                    onChange={() => toggleDay(group)}
                  />
                  <span>{group.dayKey}</span>
                  <span style={{ opacity: 0.5, fontWeight: 400 }}>
                    ({group.messages.length} 条)
                  </span>
                </div>

                {group.messages.map((message) => (
                  <label
                    className={[
                      'archive-organizer-row',
                      !message.isMemorySafe ? 'is-protected' : ''
                    ].join(' ')}
                    key={message.id}
                  >
                    <input
                      type="checkbox"
                      className="archive-organizer-row-checkbox"
                      checked={selectedIds.has(message.id)}
                      disabled={!message.isMemorySafe}
                      onChange={() => toggleMessage(message)}
                    />

                    <div className="archive-organizer-row-content">
                      <div className="archive-organizer-row-meta">
                        {message.sender === 'user'
                          ? chatOverview.userName
                          : chatOverview.characterName}
                        {' · '}
                        {formatMessageTime(message.timestamp)}
                      </div>

                      <div className="archive-organizer-row-text">
                        {getMessagePreviewText(message)}
                      </div>

                      {!message.isMemorySafe && (
                        <div className="archive-organizer-row-protected-tag">
                          记忆系统还没处理到这条，暂时不能归档
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        <footer className="archive-organizer-footer">
          <span className="archive-organizer-footer-count">
            已选择 {selectedIds.size} / {selectableCount} 条可归档消息
          </span>

          <button
            type="button"
            className="archive-organizer-confirm"
            disabled={selectedIds.size === 0 || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? '归档中…' : '确认归档'}
          </button>
        </footer>

        {resultNote && (
          <p style={{
            textAlign: 'center',
            fontSize: 11,
            color: '#6f747a',
            padding: '0 20px 14px'
          }}>
            {resultNote}
          </p>
        )}
      </section>
    </div>
  );
};

export default ArchiveOrganizerModal;