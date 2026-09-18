import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import { ArrowLeft, X } from 'lucide-react';

import {
  getArchivedMessageFolders,
  getArchiveStats
} from '../archiveService';
import ArchiveOrganizerModal from './ArchiveOrganizerModal';
import '../archive.css';

const FOLDER_STEP_PX = 34;
const FOLDER_STEP_MAX = 10;

const formatFolderLabel = (dayKey) => {
  if (!dayKey) {
    return '未知日期';
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
  const [pulledGroupKey, setPulledGroupKey] = useState(null);
  const [showOrganizer, setShowOrganizer] = useState(false);

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

  const pulledIndex = useMemo(
    () => folders.findIndex((folder) => folder.groupKey === pulledGroupKey),
    [folders, pulledGroupKey]
  );

  const closeFolder = () => setPulledGroupKey(null);

  const cycleFolder = (step) => {
    if (folders.length === 0) {
      return;
    }

    const current = pulledIndex >= 0 ? pulledIndex : 0;
    let next = current + step;

    if (next >= folders.length) next = 0;
    if (next < 0) next = folders.length - 1;

    setPulledGroupKey(folders[next].groupKey);
  };

  const handleOrganizerClosed = async (didArchive) => {
    setShowOrganizer(false);

    if (didArchive) {
      await loadData();
      onStatsChanged?.();
    }
  };

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

        <span style={{ width: 90 }} />
      </div>

      <div className="archive-cabinet">
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
          <div
            className="archive-drawer-cavity"
            style={{
              minHeight:
                Math.min(folders.length, FOLDER_STEP_MAX) * FOLDER_STEP_PX
                + 40
            }}
          >
            {folders.map((folder, index) => {
              const isPulled = folder.groupKey === pulledGroupKey;
              const stepIndex = Math.min(index, FOLDER_STEP_MAX);

              return (
                <article
                  key={folder.groupKey}
                  className={[
                    'archive-folder',
                    isPulled ? 'is-pulled' : ''
                  ].join(' ')}
                  style={{
                    bottom: stepIndex * FOLDER_STEP_PX,
                    zIndex: isPulled ? 80 : 10 + index
                  }}
                  onClick={() => (
                    isPulled
                      ? closeFolder()
                      : setPulledGroupKey(folder.groupKey)
                  )}
                >
                  <div
                    className={[
                      'archive-folder-tab',
                      folder.offlineSessionId ? 'tab-offline' : ''
                    ].join(' ')}
                  >
                    <span>{formatFolderLabel(folder.dayKey)}</span>
                    <span className="archive-folder-count">
                      {folder.messages.length}
                    </span>
                  </div>

                  {isPulled && (
                    <div className="archive-folder-doc">
                      <div className="archive-folder-frame">
                        <div className="archive-folder-header">
                          <span className="archive-folder-title">
                            {folder.offlineSessionId ? '线下场景存档' : '聊天存档'}
                          </span>

                          <button
                            type="button"
                            className="archive-folder-close"
                            onClick={(event) => {
                              event.stopPropagation();
                              closeFolder();
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div
                          className="archive-folder-messages"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {folder.messages.map((message) => (
                            <div
                              key={message.id}
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
                          ))}
                        </div>

                        <p className="archive-folder-hint">
                          这份存档只读，不会影响记忆系统里已经保存的内容。
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {pulledGroupKey && (
        <div
          className="archive-dismiss-overlay is-active"
          onClick={closeFolder}
        />
      )}

      <div className="archive-drawer-front">
        <div className="archive-drawer-stats">
          <div className="archive-drawer-stat">
            <span className="archive-drawer-stat-num">
              {chatOverview.chattedDays}
            </span>
            <span className="archive-drawer-stat-label">已聊天(天)</span>
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
            <span className="archive-drawer-stat-label">已归档(天)</span>
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

          {folders.length > 1 && (
            <div
              className="archive-louver-handle"
              onClick={() => cycleFolder(1)}
              title="翻看下一份存档"
            >
              <div className="archive-louver-vent" />
              <div className="archive-louver-vent" />
              <div className="archive-louver-vent" />
            </div>
          )}
        </div>
      </div>

      {showOrganizer && (
        <ArchiveOrganizerModal
          chatOverview={chatOverview}
          onClose={handleOrganizerClosed}
        />
      )}
    </div>
  );
};

export default ArchiveCabinetView;