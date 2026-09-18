import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ChevronRight,
  Play,
  Trash2,
  X,
  Pencil
} from 'lucide-react';

import {
  deleteArchivedFolder,
  deleteArchivedMessage,
  getArchivedMessageFolders,
  setArchiveFolderCoverImage,
  setArchiveFolderNote
} from '../archiveService';
import '../archive.css';
import '../archive-cabinet-visual.css';

const formatDisplayDate = (dayKey) => {
  if (!dayKey) return '未知日期';
  const parts = dayKey.split('-');
  if (parts.length === 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return dayKey;
};

const formatDayNumber = (dayKey) => {
  if (!dayKey) return '--';
  const parts = dayKey.split('-');
  return parts.length === 3 ? parts[2] : dayKey.slice(-2);
};

const formatTimeOnly = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const ArchiveCabinetView = ({ chatOverview, onBack, onStatsChanged }) => {
  const { chatId, characterName } = chatOverview;

  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');

  const coverInputRef = useRef(null);

  const loadFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getArchivedMessageFolders(chatId);
      setFolders(result);
      setSelectedGroupKey((prev) => prev || result[0]?.groupKey || null);
    } catch (error) {
      console.error('[ArchiveCabinet] 获取归档文件夹失败：', error);
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  const activeFolder = useMemo(
    () => folders.find((f) => f.groupKey === selectedGroupKey) || null,
    [folders, selectedGroupKey]
  );

  const handleRowClick = (folder) => {
    if (selectedGroupKey === folder.groupKey) {
      setIsFullscreen(true);
    } else {
      setSelectedGroupKey(folder.groupKey);
      setEditingNote(false);
    }
  };

  const handleSaveNote = async () => {
    if (!activeFolder) return;
    await setArchiveFolderNote(chatId, activeFolder.groupKey, noteInput.trim());
    setEditingNote(false);
    await loadFolders();
  };

  const handleDeleteFolder = async () => {
    if (!activeFolder) return;
    const confirm = window.confirm(`确认永久销毁该卷宗（${activeFolder.dayKey}）的全部档案吗？`);
    if (!confirm) return;

    await deleteArchivedFolder(chatId, activeFolder.groupKey);
    setSelectedGroupKey(null);
    setIsFullscreen(false);
    await loadFolders();
    onStatsChanged?.();
  };

  const handleDeleteSingleMessage = async (messageId) => {
    const confirm = window.confirm('确认抹去这条记录吗？');
    if (!confirm) return;

    await deleteArchivedMessage(chatId, messageId);
    await loadFolders();
    onStatsChanged?.();
  };

  const handlePickCoverImage = () => {
    coverInputRef.current?.click();
  };

  const handleCoverImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !activeFolder) {
      return;
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    await setArchiveFolderCoverImage(chatId, activeFolder.groupKey, dataUrl);
    await loadFolders();
  };

  const content = (
    <div className="cabinet-viewport">
      <header className="cabinet-hud">
        <button
          type="button"
          className="cabinet-hud-btn"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回唱片架</span>
        </button>

        <div className="cabinet-title-stamp">
          <span className="stamp-box">CONFIDENTIAL</span>
          <span className="cabinet-char-name">{characterName} 档案室</span>
        </div>

        <div className="cabinet-stat-pill">
          {folders.length} 卷封存
        </div>
      </header>

      <main className="cabinet-stage">
        {isLoading && (
          <div className="cabinet-loading">
            <div className="cabinet-loading-box" />
            <p>正在拉开档案抽屉...</p>
          </div>
        )}

        {!isLoading && folders.length === 0 && (
          <div className="cabinet-empty">
            <div className="cabinet-empty-folder">
              <span className="empty-tab">EMPTY</span>
              <p>当前档案盒内尚无归档卷宗</p>
            </div>
          </div>
        )}

        {!isLoading && folders.length > 0 && (
          <div className="player-scroll">
            {activeFolder && (
              <div className="player-hero">
                <div
                  className={['player-hero-cover', activeFolder.coverImage ? 'has-cover' : ''].join(' ')}
                  style={
                    activeFolder.coverImage
                      ? { backgroundImage: `url(${activeFolder.coverImage})` }
                      : { '--tone': folders.indexOf(activeFolder) % 4 }
                  }
                >
                  {!activeFolder.coverImage && (
                    <span className="player-hero-daynum">
                      {formatDayNumber(activeFolder.dayKey)}
                    </span>
                  )}

                  <button
                    type="button"
                    className="player-cover-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePickCoverImage();
                    }}
                    title="更换封面"
                    aria-label="更换封面"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>

                <div className="player-hero-info">
                  <div className="player-hero-title">{formatDisplayDate(activeFolder.dayKey)}</div>
                  <div className="player-hero-sub">
                    与 {characterName} · {activeFolder.messages.length} 条记录
                  </div>

                  <button
                    type="button"
                    className="player-hero-play"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    展开阅读
                  </button>
                </div>
              </div>
            )}

            <div className="player-list-head">全部卷宗</div>

            <div className="player-list">
              {folders.map((folder, index) => {
                const isSelected = folder.groupKey === selectedGroupKey;

                return (
                  <button
                    key={folder.groupKey}
                    type="button"
                    className={['player-row', isSelected ? 'is-active' : ''].join(' ')}
                    onClick={() => handleRowClick(folder)}
                  >
                    <span
                      className={['player-row-cover', folder.coverImage ? 'has-cover' : ''].join(' ')}
                      style={
                        folder.coverImage
                          ? { backgroundImage: `url(${folder.coverImage})` }
                          : { '--tone': index % 4 }
                      }
                    >
                      {!folder.coverImage && formatDayNumber(folder.dayKey)}
                    </span>

                    <span className="player-row-info">
                      <span className="player-row-title">{formatDisplayDate(folder.dayKey)}</span>
                      <span className="player-row-sub">
                        {folder.messages.length} 条{folder.note ? ` · ${folder.note}` : ''}
                      </span>
                    </span>

                    <ChevronRight className="h-4 w-4 player-row-chevron" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <input
        type="file"
        accept="image/*"
        ref={coverInputRef}
        style={{ display: 'none' }}
        onChange={handleCoverImageChange}
      />

      {isFullscreen && activeFolder && (
        <div className="player-fullscreen">
          <div className="player-fs-topbar">
            <button
              type="button"
              className="player-fs-icon-btn"
              onClick={() => setIsFullscreen(false)}
              title="收起播放器"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="player-fs-serial">
              ARCHIVE DEPT. // CHAT-{String(chatId).slice(0, 6).toUpperCase()}
            </span>
            <button
              type="button"
              className="player-fs-icon-btn danger"
              onClick={handleDeleteFolder}
              title="销毁整份卷宗"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div
            className={['player-fs-cover', activeFolder.coverImage ? 'has-cover' : ''].join(' ')}
            style={
              activeFolder.coverImage
                ? { backgroundImage: `url(${activeFolder.coverImage})` }
                : { '--tone': folders.indexOf(activeFolder) % 4 }
            }
          >
            {!activeFolder.coverImage && (
              <span className="player-fs-daynum">
                {formatDayNumber(activeFolder.dayKey)}
              </span>
            )}

            <button
              type="button"
              className="player-cover-edit-btn"
              onClick={handlePickCoverImage}
              title="更换封面"
              aria-label="更换封面"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>

          <div className="player-fs-title">{formatDisplayDate(activeFolder.dayKey)}</div>
          <div className="player-fs-sub">
            与 {characterName} · TOTAL {activeFolder.messages.length} MESSAGES
          </div>

          <div
            className="player-fs-note"
            onClick={() => {
              setEditingNote(true);
              setNoteInput(activeFolder.note || '');
            }}
          >
            {editingNote ? (
              <div className="note-input-row" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={noteInput}
                  placeholder="为此段封存记录输入简注..."
                  autoFocus
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleSaveNote()}
                />
                <button type="button" onClick={handleSaveNote}>保存</button>
              </div>
            ) : (
              <span>
                {activeFolder.note || '点击添加备注...'}
                <Pencil className="h-2.5 w-2.5 ml-1 inline opacity-60" />
              </span>
            )}
          </div>

          <div className="player-fs-queue-head">
            <span>TRANSCRIPT</span>
            <span>{activeFolder.messages.length} 条</span>
          </div>

          <div className="player-fs-queue">
            {activeFolder.messages.map((msg, i) => (
              <div key={msg.id || i} className="player-fs-line">
                <span className="player-fs-line-seq">{String(i + 1).padStart(2, '0')}</span>
                <div className="player-fs-line-body">
                  <div className="player-fs-line-meta">
                    <span>{msg.role === 'user' ? 'YOU' : characterName.toUpperCase()}</span>
                    <span>{formatTimeOnly(msg.timestamp)}</span>
                  </div>
                  <div className="player-fs-line-text">{msg.content}</div>
                </div>
                <button
                  type="button"
                  className="player-fs-line-del"
                  onClick={() => void handleDeleteSingleMessage(msg.id)}
                  title="抹去该条消息"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default ArchiveCabinetView;