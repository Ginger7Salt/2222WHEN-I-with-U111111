import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pencil,
  Trash2,
  X
} from 'lucide-react';

import {
  deleteArchivedFolder,
  deleteArchivedMessage,
  getArchivedMessageFolders,
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

  // 三段式交互状态：
  // selectedFolder: null 时为书架整体视角；有选中时为半展开封面
  // isFullscreen: true 时为全屏深度查阅卷宗内容
  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 备注编辑状态
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');

  const loadFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getArchivedMessageFolders(chatId);
      setFolders(result);
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

  // 点击某本"书"
  const handleBookClick = (folder) => {
    if (selectedGroupKey === folder.groupKey) {
      // 再次点击同一本：直接进入全屏阅读
      setIsFullscreen(true);
    } else {
      setSelectedGroupKey(folder.groupKey);
      setIsFullscreen(false);
      setEditingNote(false);
    }
  };

  // 保存备注
  const handleSaveNote = async () => {
    if (!activeFolder) return;
    await setArchiveFolderNote(chatId, activeFolder.groupKey, noteInput.trim());
    setEditingNote(false);
    await loadFolders();
  };

  // 删除整份卷宗
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

  // 删除单条归档
  const handleDeleteSingleMessage = async (messageId) => {
    const confirm = window.confirm('确认抹去这条记录吗？');
    if (!confirm) return;

    await deleteArchivedMessage(chatId, messageId);
    await loadFolders();
    onStatsChanged?.();
  };

  const content = (
    <div className="cabinet-viewport">
      {/* 顶部极简 HUD 导航 */}
      <header className="cabinet-hud">
        <button
          type="button"
          className="cabinet-hud-btn"
          onClick={() => {
            if (isFullscreen) {
              setIsFullscreen(false);
            } else if (selectedGroupKey) {
              setSelectedGroupKey(null);
            } else {
              onBack();
            }
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{isFullscreen ? '合上封面' : selectedGroupKey ? '推回书架' : '返回唱片架'}</span>
        </button>

        <div className="cabinet-title-stamp">
          <span className="stamp-box">CONFIDENTIAL</span>
          <span className="cabinet-char-name">{characterName} 档案室</span>
        </div>

        <div className="cabinet-stat-pill">
          {folders.length} 卷封存
        </div>
      </header>

      {/* 主体区域：书架舞台 */}
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

        {/* =========================================================================
            书架视图：一排小书脊，点一本抽出来
            ========================================================================= */}
        {!isLoading && folders.length > 0 && (
          <div className={`drawer-box ${selectedGroupKey ? 'has-extracted' : ''}`}>
            <div className="cabinet-bookshelf">
              {folders.map((folder, index) => {
                const isSelected = folder.groupKey === selectedGroupKey;
                const folderIndexStr = String(folders.length - index).padStart(3, '0');

                return (
                  <button
                    key={folder.groupKey}
                    type="button"
                    className={[
                      'cabinet-book',
                      isSelected ? 'is-active' : ''
                    ].join(' ')}
                    onClick={() => handleBookClick(folder)}
                  >
                    <span className="cabinet-book-index">№{folderIndexStr}</span>
                    <span className="cabinet-book-spine-label">
                      {formatDisplayDate(folder.dayKey)}
                    </span>
                    {folder.note && (
                      <span className="cabinet-book-note-dot" title={folder.note} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* =========================================================================
                抽出的书：半展开的【黑白工业档案封面】
                ========================================================================= */}
            {activeFolder && (
              <div
                className={`extracted-dossier-card ${isFullscreen ? 'dossier-full-mode' : ''}`}
                onClick={() => {
                  if (!isFullscreen) {
                    setIsFullscreen(true);
                  }
                }}
              >
                {/* 档案封面顶部工具条 */}
                <div className="dossier-topbar">
                  <div className="dossier-serial-code">
                    ARCHIVE DEPT. // CHAT-{String(chatId).slice(0, 6).toUpperCase()}
                  </div>
                  <div className="dossier-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="dossier-icon-btn"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      title={isFullscreen ? '折叠为封面' : '全屏展开阅读'}
                    >
                      {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      className="dossier-icon-btn danger"
                      onClick={handleDeleteFolder}
                      title="销毁整份卷宗"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="dossier-icon-btn"
                      onClick={() => {
                        setSelectedGroupKey(null);
                        setIsFullscreen(false);
                      }}
                      title="收纳回书架"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* 封面纸张主体 */}
                <div className="dossier-paper-sheet">
                  <div className="dossier-header-block">
                    <div className="dossier-brand-title">
                      <span className="title-lead">{characterName}</span>
                      <span className="title-sub">ARCHIVED DOSSIER</span>
                    </div>
                    <div className="dossier-wireframe-box">
                      <span className="wireframe-cross" />
                    </div>
                  </div>

                  <div className="dossier-spec-row">
                    <div className="dossier-blueprint-grid">
                      <div className="blueprint-cells">
                        {Array.from({ length: 18 }).map((_, i) => (
                          <div
                            key={i}
                            className={`bp-cell ${i === activeFolder.messages.length % 18 ? 'is-marked' : ''}`}
                          />
                        ))}
                      </div>
                      <span className="blueprint-label">INDEX REF</span>
                    </div>

                    <div className="dossier-date-badge">
                      <div className="date-badge-label">RECORD DATE</div>
                      <div className="date-badge-value">{activeFolder.dayKey}</div>
                      <div className="date-badge-stat">
                        TOTAL: {activeFolder.messages.length} MESSAGES
                      </div>
                    </div>
                  </div>

                  <div
                    className="dossier-note-banner"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNote(true);
                      setNoteInput(activeFolder.note || '');
                    }}
                  >
                    <span className="note-label">卷宗备注:</span>
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
                      <div className="note-text">
                        {activeFolder.note || <span className="note-placeholder">点击添加备注条目...</span>}
                        <Pencil className="h-2.5 w-2.5 ml-1 inline opacity-60" />
                      </div>
                    )}
                  </div>

                  <div className="dossier-records-container">
                    <div className="records-header-line">
                      <span>TRANSCRIPT LOG</span>
                      <span>SECURE // READ-ONLY</span>
                    </div>

                    <div className="dossier-records-scroll">
                      {activeFolder.messages.map((msg, i) => (
                        <div key={msg.id || i} className="dossier-msg-row">
                          <div className="msg-sidebar">
                            <span className="msg-seq">#{String(i + 1).padStart(2, '0')}</span>
                            <span className="msg-time">{formatTimeOnly(msg.timestamp)}</span>
                          </div>
                          <div className="msg-body">
                            <div className="msg-sender-tag">
                              {msg.role === 'user' ? 'YOU' : characterName.toUpperCase()}
                            </div>
                            <div className="msg-text">{msg.content}</div>
                          </div>
                          {isFullscreen && (
                            <button
                              type="button"
                              className="msg-del-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteSingleMessage(msg.id);
                              }}
                              title="抹去该条消息"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {!isFullscreen && (
                      <div className="dossier-click-hint">
                        <span>轻触卡片展开全屏卷宗</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 底部只留一张纸标签 */}
            <div className="cabinet-drawer-front">
              <div className="drawer-yellow-tag">
                <span>{characterName.toLowerCase()}'s secret files</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );

  // 同样用 Portal 挂到 body，避免被上层 max-w-[420px] 的容器关住。
  return createPortal(content, document.body);
};

export default ArchiveCabinetView;