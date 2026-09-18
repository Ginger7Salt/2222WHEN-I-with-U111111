import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import { ArrowLeft, Trash2, X } from 'lucide-react';

import ConfirmModal from '../../../components/ConfirmModal';
import {
  deleteArchivedFolder,
  deleteArchivedMessage,
  getArchivedMessageFolders,
  getArchiveNarrativeLine,
  getArchiveStats,
  setArchiveFolderNote
} from '../archiveService';
import ArchiveOrganizerModal from './ArchiveOrganizerModal';
import '../archive.css';

const formatFolderLabel = (dayKey) => {
  if (!dayKey) {
    return '未知日期';
  }

  const parts = dayKey.split('-');

  if (parts.length !== 3) {
    return dayKey;
  }

  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
};

const formatShortLabel = (dayKey) => {
  if (!dayKey) {
    return '--.--';
  }

  const parts = dayKey.split('-');

  if (parts.length !== 3) {
    return dayKey;
  }

  return `${parts[1]}.${parts[2]}`;
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

const getMessageContentText = (message) => {
  if (message.type === 'sticker') {
    return `[贴纸] ${message.content || message.metadata?.name || ''}`;
  }

  if (message.type === 'photo') {
    return '[照片]';
  }

  if (message.type === 'offline_invite') {
    return `[线下邀约] ${message.content || ''}`;
  }

  return message.content || '（空消息）';
};

const ArchiveCabinetView = ({
  chatOverview,
  onBack,
  onStatsChanged
}) => {
  const chatId = chatOverview.chatId;

  const [folders, setFolders] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 三段式：closed（一沓关闭的文件夹） -> preview（点一下展开的预览卡）
  // -> full（再点一下进入的全屏完整内容）。同一时刻只有一个文件夹
  // 处于 preview 或 full。
  const [previewGroupKey, setPreviewGroupKey] = useState(null);
  const [fullGroupKey, setFullGroupKey] = useState(null);

  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showOrganizer, setShowOrganizer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [nextFolders, nextStats] = await Promise.all([
        getArchivedMessageFolders(chatId),
        getArchiveStats(chatId)
      ]);

      setFolders(nextFolders);
      setStats(nextStats);
    } catch (error) {
      console.error('[Archive] 读取档案柜失败：', error);
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const previewFolder = useMemo(
    () => folders.find((folder) => folder.groupKey === previewGroupKey) || null,
    [folders, previewGroupKey]
  );

  const fullFolder = useMemo(
    () => folders.find((folder) => folder.groupKey === fullGroupKey) || null,
    [folders, fullGroupKey]
  );

  const openPreview = (folder) => {
    setPreviewGroupKey(folder.groupKey);
  };

  const closePreview = () => setPreviewGroupKey(null);

  const openFull = (folder) => {
    setNoteDraft(folder.note || '');
    setFullGroupKey(folder.groupKey);
    setPreviewGroupKey(null);
  };

  const closeFull = () => setFullGroupKey(null);

  const handleSaveNote = async () => {
    if (!fullFolder) {
      return;
    }

    setIsSavingNote(true);

    try {
      await setArchiveFolderNote(chatId, fullFolder.groupKey, noteDraft.trim());
      await loadData();
    } catch (error) {
      console.error('[Archive] 保存备注失败：', error);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleOrganizerClosed = async (didArchive) => {
    setShowOrganizer(false);

    if (didArchive) {
      await loadData();
      onStatsChanged?.();
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      if (deleteTarget.type === 'folder') {
        await deleteArchivedFolder(chatId, deleteTarget.groupKey);
        setFullGroupKey(null);
        setPreviewGroupKey(null);
      } else if (deleteTarget.type === 'message') {
        await deleteArchivedMessage(chatId, deleteTarget.messageId);
      }

      await loadData();
      onStatsChanged?.();
    } catch (error) {
      console.error('[Archive] 删除存档失败：', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const narrativeLine = getArchiveNarrativeLine({
    chattedDays: chatOverview.chattedDays,
    totalArchivedDays: stats?.totalArchivedDays ?? chatOverview.totalArchivedDays,
    characterName: chatOverview.characterName
  });

  return (
    <div className="archive-app">
      <div className="archive-hud">
        <button
          type="button"
          className="archive-hud-back"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回选择
        </button>

        <span className="archive-hud-title">
          {chatOverview.characterName} 的档案柜
        </span>

        <span style={{ width: 36 }} />
      </div>

      <div className="archive-cabinet">
        <div className="archive-cabinet-narrative">
          {narrativeLine}
        </div>

        {isLoading && (
          <div className="archive-cabinet-empty">
            正在拉开抽屉。
          </div>
        )}

        {!isLoading && folders.length === 0 && (
          <div className="archive-cabinet-empty">
            这个聊天框还没有归档任何内容。
            <br />
            点击下方"整理归档"可以提前把旧消息收进来。
          </div>
        )}

        {!isLoading && folders.length > 0 && (
          <div className="archive-folder-stack-wrap">
            <div className="archive-folder-stack">
              {folders.map((folder, index) => (
                <button
                  type="button"
                  key={folder.groupKey}
                  className={[
                    'archive-folder-tab',
                    index % 2 === 0
                      ? 'archive-folder-tab--a'
                      : 'archive-folder-tab--b'
                  ].join(' ')}
                  style={{ zIndex: index + 1 }}
                  onClick={() => openPreview(folder)}
                >
                  <span className="archive-folder-tab-date">
                    {formatShortLabel(folder.dayKey)}
                  </span>

                  <span className="archive-folder-tab-count">
                    {folder.messages.length} 条
                  </span>

                  {folder.offlineSessionId && (
                    <span className="archive-folder-tab-dot" title="线下场景" />
                  )}

                  {folder.note && (
                    <span className="archive-folder-tab-note-dot" title="有备注" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="archive-drawer-front">
        <div className="archive-drawer-stats">
          <div className="archive-drawer-stat">
            <span className="archive-drawer-stat-num">
              {chatOverview.chattedDays}
            </span>
            <span className="archive-drawer-stat-label">已相伴(天)</span>
          </div>

          <div className="archive-drawer-stat">
            <span className="archive-drawer-stat-num">
              {chatOverview.activeMessages + chatOverview.archivedMessages}
            </span>
            <span className="archive-drawer-stat-label">总消息</span>
          </div>

          <div className="archive-drawer-stat">
            <span className="archive-drawer-stat-num">
              {stats?.totalArchivedDays ?? chatOverview.totalArchivedDays}
            </span>
            <span className="archive-drawer-stat-label">已封存(天)</span>
          </div>
        </div>

        <div className="archive-drawer-actions">
          <button
            type="button"
            className="archive-plaque-btn"
            onClick={() => setShowOrganizer(true)}
          >
            整理归档
          </button>
        </div>
      </div>

      {/* 预览态：P3 那种单卡展开，点一下文件夹之后、进全屏之前的中间态 */}
      {previewFolder && (
        <div className="archive-preview-overlay" onClick={closePreview}>
          <div
            className="archive-preview-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="archive-preview-close"
              onClick={closePreview}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="archive-preview-date">
              {formatFolderLabel(previewFolder.dayKey)}
            </div>

            <div className="archive-preview-count">
              {previewFolder.messages.length} 条消息
              {previewFolder.offlineSessionId ? '　·　线下场景' : ''}
            </div>

            {previewFolder.note && (
              <div className="archive-preview-note">
                「{previewFolder.note}」
              </div>
            )}

            <div className="archive-preview-snippets">
              <div className="archive-preview-snippet">
                <span className="archive-preview-snippet-label">开始</span>
                <p>{getMessageContentText(previewFolder.messages[0])}</p>
              </div>

              {previewFolder.messages.length > 1 && (
                <div className="archive-preview-snippet">
                  <span className="archive-preview-snippet-label">结尾</span>
                  <p>
                    {getMessageContentText(
                      previewFolder.messages[previewFolder.messages.length - 1]
                    )}
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              className="archive-preview-enter-btn"
              onClick={() => openFull(previewFolder)}
            >
              查看完整内容
            </button>
          </div>
        </div>
      )}

      {/* 全屏态：完整内容 + 备注编辑 + 删除 */}
      {fullFolder && (
        <div className="archive-app archive-fullscreen">
          <div className="archive-hud">
            <button
              type="button"
              className="archive-hud-back"
              onClick={closeFull}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              收起
            </button>

            <span className="archive-hud-title">
              {formatFolderLabel(fullFolder.dayKey)}
            </span>

            <span style={{ width: 36 }} />
          </div>

          <div className="archive-fullscreen-body">
            <div className="archive-folder-note-row">
              <input
                type="text"
                className="archive-folder-note-input"
                placeholder="写一句备注，方便以后辨认这份存档"
                value={noteDraft}
                maxLength={60}
                onChange={(event) => setNoteDraft(event.target.value)}
              />

              <button
                type="button"
                className="archive-folder-note-save"
                disabled={isSavingNote || noteDraft === (fullFolder.note || '')}
                onClick={handleSaveNote}
              >
                {isSavingNote ? '保存中' : '保存'}
              </button>
            </div>

            <div className="archive-folder-messages archive-folder-messages--full">
              {fullFolder.messages.map((message) => (
                <div
                  className="archive-folder-message-row"
                  key={message.id}
                >
                  <div
                    className={[
                      'archive-folder-message',
                      message.sender === 'character'
                        ? 'is-character'
                        : ''
                    ].join(' ')}
                  >
                    <div className="archive-folder-message-meta">
                      <span>
                        {message.sender === 'user'
                          ? chatOverview.userName
                          : chatOverview.characterName}
                      </span>
                      <span>
                        {formatMessageTime(message.timestamp)}
                      </span>
                    </div>
                    <div className="archive-folder-message-content">
                      {getMessageContentText(message)}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="archive-msg-delete-btn"
                    title="删除这条存档消息"
                    onClick={() => setDeleteTarget({
                      type: 'message',
                      messageId: message.id
                    })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <p className="archive-folder-hint">
              这份存档只读文本，不会影响记忆系统里已经保存的内容。
            </p>

            <div className="archive-folder-actions">
              <button
                type="button"
                className="archive-folder-delete-btn"
                onClick={() => setDeleteTarget({
                  type: 'folder',
                  groupKey: fullFolder.groupKey
                })}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除整份存档
              </button>
            </div>
          </div>
        </div>
      )}

      {showOrganizer && (
        <ArchiveOrganizerModal
          chatOverview={chatOverview}
          onClose={handleOrganizerClosed}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={
          deleteTarget?.type === 'folder'
            ? '删除整份存档？'
            : '删除这条存档消息？'
        }
        message={
          deleteTarget?.type === 'folder'
            ? '这份存档里的所有消息都会被永久删除，无法恢复。记忆系统里已经提炼好的内容不会受影响。'
            : '这条消息会被永久删除，无法恢复。记忆系统里已经提炼好的内容不会受影响。'
        }
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ArchiveCabinetView;