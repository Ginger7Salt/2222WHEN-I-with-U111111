import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
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
  // selectedFolder: null 时为抽屉整体视角（P1）；有选中时为半展开封面（P2）
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

  // 切换标签耳选中
  const handleTabClick = (folder) => {
    if (selectedGroupKey === folder.groupKey) {
      // 再次点击同一张：直接进入全屏阅读
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

  return (
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
          <span>{isFullscreen ? '合上封面' : selectedGroupKey ? '推回抽屉' : '返回唱片架'}</span>
        </button>

        <div className="cabinet-title-stamp">
          <span className="stamp-box">CONFIDENTIAL</span>
          <span className="cabinet-char-name">{characterName} 档案室</span>
        </div>

        <div className="cabinet-stat-pill">
          {folders.length} 卷封存
        </div>
      </header>

      {/* 主体区域：抽屉舞台 */}
      <main className="cabinet-stage">
        {isLoading && (
          <div className="cabinet-loading">
            <div className="cabinet-loading-box" />
            <p>正在拉开铁皮档案抽屉...</p>
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
            P1 视图：档案抽屉内部与错落排列的文件袋凸出标签（Tabs）
            ========================================================================= */}
        {!isLoading && folders.length > 0 && (
          <div className={`drawer-box ${selectedGroupKey ? 'has-extracted' : ''}`}>
            <div className="drawer-hanging-rail">
              {folders.map((folder, index) => {
                const isSelected = folder.groupKey === selectedGroupKey;
                // 模拟 P1 标签在 4 个槽位（左、偏左、偏右、右）错开排布的视觉节奏
                const tabPosition = `tab-slot-${index % 4}`;
                const folderIndexStr = String(folders.length - index).padStart(3, '0');

                return (
                  <div
                    key={folder.groupKey}
                    className={[
                      'drawer-folder-item',
                      tabPosition,
                      isSelected ? 'is-active-tab' : ''
                    ].join(' ')}
                    style={{
                      '--depth-index': index,
                      zIndex: folders.length - index + (isSelected ? 50 : 0)
                    }}
                    onClick={() => handleTabClick(folder)}
                  >
                    {/* 凸出的耳朵标签（Tab） */}
                    <div className="folder-protruding-tab">
                      <span className="tab-serial">№ {folderIndexStr}</span>
                      <span className="tab-date">{formatDisplayDate(folder.dayKey)}</span>
                      {folder.note && <span className="tab-note-dot" title={folder.note} />}
                    </div>

                    {/* 文件袋脊背横条 */}
                    <div className="folder-lip-edge" />
                  </div>
                );
              })}
            </div>

            {/* =========================================================================
                P2 视图：向上抽拔半展开的【黑白工业档案报纸封面】
                ========================================================================= */}
            {activeFolder && (
              <div
                className={`extracted-dossier-card ${isFullscreen ? 'dossier-full-mode' : ''}`}
                onClick={(e) => {
                  if (!isFullscreen) {
                    setIsFullscreen(true);
                  }
                }}
              >
                {/* 档案封面顶部把手条 / 工具条 */}
                <div className="dossier-topbar">
                  <div className="dossier-serial-code">
                    ARCHIVE DEPT. // CHAT-{chatId.slice(0, 6).toUpperCase()}
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
                      title="收纳回抽屉"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* 封面纸张主体（参考 P2 的版式构图） */}
                <div className="dossier-paper-sheet">
                  {/* 工业排版 Header */}
                  <div className="dossier-header-block">
                    <div className="dossier-brand-title">
                      <span className="title-lead">{characterName}</span>
                      <span className="title-sub">ARCHIVED DOSSIER</span>
                    </div>
                    <div className="dossier-wireframe-box">
                      <span className="wireframe-cross" />
                    </div>
                  </div>

                  {/* 核心时间印戳与网格图示（纯正 P2 风格） */}
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

                  {/* 备注手写条 */}
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

                  {/* =========================================================================
                      P2 展开的卷宗正文：对话记录清单（全屏时完整展示；非全屏时做渐隐预览）
                      ========================================================================= */}
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

            {/* P1 底部抽屉金属外壳与百叶拉手装饰 */}
            <div className="cabinet-drawer-front">
              <div className="drawer-metal-handle">
                <div className="handle-louver handle-1" />
                <div className="handle-louver handle-2" />
                <div className="handle-louver handle-3" />
              </div>
              <div className="drawer-yellow-tag">
                <span>{characterName.toLowerCase()}'s secret files</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ArchiveCabinetView;