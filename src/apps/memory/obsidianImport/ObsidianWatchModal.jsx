import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';

import ConfirmModal from '../../../components/ConfirmModal';
import ObsidianImportModal from './ObsidianImportModal';
import { parseObsidianFileEntries } from './obsidianImportService';
import {
  commitWatchFolderScan,
  connectObsidianWatchFolder,
  getObsidianWatchFolders,
  getWatchFolderPermissionState,
  isObsidianWatchSupported,
  removeObsidianWatchFolder,
  requestWatchFolderPermission,
  scanObsidianWatchFolder
} from './obsidianWatchService';
import './obsidianImport.css';

const getChatLabel = (chat) => (
  chat?.title || `消息框 ${chat?.id || ''}`
);

const PERMISSION_LABELS = {
  granted: '已授权',
  prompt: '需要重新授权',
  denied: '授权被拒绝',
  unsupported: '无法识别授权状态'
};

// The folder-watch management screen: connect a new Obsidian folder to a
// chat, see each watched folder's authorization state, re-authorize or
// remove one, and check a folder for changes on demand. A manual "立即
// 检查" here is a convenience on top of the confirmed "打开记忆页时检查
// 一次" behavior (MemoryApp's own mount-time scan) - not a replacement
// for it.
export const ObsidianWatchModal = ({
  chats = [],

  // Folders MemoryApp's own mount-time scan already found changes for, so
  // this screen can offer "查看" immediately instead of making the user
  // press "检查更新" again for something already detected.
  initialPendingUpdates = [],

  onClose,
  onCompleted,
  onError
}) => {
  const [watchFolders, setWatchFolders] = useState([]);
  const [permissionByFolderId, setPermissionByFolderId] = useState({});
  const [connectTargetChatId, setConnectTargetChatId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [checkingFolderId, setCheckingFolderId] = useState(null);
  const [removingFolder, setRemovingFolder] = useState(null);
  const [localError, setLocalError] = useState('');
  const [localNotice, setLocalNotice] = useState('');

  // { watchFolder, parseResult, changedFiles } while the review screen for
  // one folder's changes is open.
  const [reviewState, setReviewState] = useState(null);

  const supported = isObsidianWatchSupported();

  const refreshFolders = async () => {
    const folders = await getObsidianWatchFolders();

    setWatchFolders(folders);

    const nextPermissions = {};

    for (const folder of folders) {
      nextPermissions[folder.id] = await getWatchFolderPermissionState(
        folder
      );
    }

    setPermissionByFolderId(nextPermissions);

    return folders;
  };

  useEffect(() => {
    refreshFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openReview = async (watchFolder, changedFiles) => {
    const parseResult = await parseObsidianFileEntries(changedFiles);

    setReviewState({ watchFolder, parseResult, changedFiles });
  };

  // Surface any folders MemoryApp's mount-time scan already flagged, the
  // first time this screen has folders loaded to match them against. Runs
  // at most once per time this screen is opened (a ref, not a dependency
  // on watchFolders) - otherwise every later refreshFolders() call (after
  // connecting a folder, after a completed review, ...) would re-trigger
  // this effect and pop the very same already-handled update back open,
  // since initialPendingUpdates itself never changes after mount.
  const hasAutoOpenedPendingReview = useRef(false);

  useEffect(() => {
    if (hasAutoOpenedPendingReview.current) return;
    if (reviewState || watchFolders.length === 0) return;

    const firstPending = initialPendingUpdates.find(
      (pending) => watchFolders.some(
        (folder) => folder.id === pending.watchFolder.id
      )
    );

    if (firstPending) {
      hasAutoOpenedPendingReview.current = true;
      openReview(firstPending.watchFolder, firstPending.changedFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchFolders]);

  const handleConnect = async () => {
    setLocalError('');
    setLocalNotice('');

    if (!connectTargetChatId) {
      setLocalError('请先选择这个文件夹要绑定到哪个消息框。');
      return;
    }

    setIsConnecting(true);

    try {
      const watchFolder = await connectObsidianWatchFolder({
        chatId: Number(connectTargetChatId)
      });

      await refreshFolders();

      // 首次连接时 fileState 是空的，第一次扫描等于"整个文件夹都是新内容"，
      // 直接进入同一套确认界面，相当于一次性导入整个仓库，不需要用户再点一次
      // "检查更新"。
      const { changedFiles } = await scanObsidianWatchFolder(watchFolder);

      if (changedFiles.length > 0) {
        await openReview(watchFolder, changedFiles);
      } else {
        setLocalNotice('文件夹已连接，但没有找到 .md 笔记。');
      }
    } catch (error) {
      const message = error?.message || '连接 Obsidian 文件夹失败。';

      setLocalError(message);
      onError?.(message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReauthorize = async (watchFolder) => {
    setLocalError('');

    try {
      const permission = await requestWatchFolderPermission(watchFolder);

      setPermissionByFolderId((prev) => ({
        ...prev,
        [watchFolder.id]: permission
      }));

      if (permission !== 'granted') {
        setLocalError('还没有获得这个文件夹的读取授权。');
      }
    } catch (error) {
      const message = error?.message || '重新授权失败。';

      setLocalError(message);
      onError?.(message);
    }
  };

  const handleCheckNow = async (watchFolder) => {
    setLocalError('');
    setLocalNotice('');
    setCheckingFolderId(watchFolder.id);

    try {
      const { permission, changedFiles } = await scanObsidianWatchFolder(
        watchFolder
      );

      if (permission !== 'granted') {
        setLocalError('这个文件夹需要重新授权才能检查更新。');
        return;
      }

      if (changedFiles.length === 0) {
        setLocalNotice(`「${watchFolder.folderName}」没有发现新的改动。`);
        await refreshFolders();
        return;
      }

      await openReview(watchFolder, changedFiles);
    } catch (error) {
      const message = error?.message || '检查更新失败。';

      setLocalError(message);
      onError?.(message);
    } finally {
      setCheckingFolderId(null);
    }
  };

  const handleReviewCompleted = async (message) => {
    if (!reviewState) return;

    await commitWatchFolderScan(
      reviewState.watchFolder.id,
      reviewState.changedFiles
    );

    setReviewState(null);
    await refreshFolders();
    onCompleted?.(message);
  };

  const handleConfirmRemove = async () => {
    if (!removingFolder) return;

    await removeObsidianWatchFolder(removingFolder.id);
    setRemovingFolder(null);
    await refreshFolders();
  };

  return (
    <>
      <div className="memory-modal-backdrop">
        <section
          className="memory-modal obsidian-import-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="obsidian-watch-title"
        >
          <div className="memory-modal-header">
            <div>
              <p className="memory-eyebrow">OBSIDIAN SYNC</p>
              <h2 id="obsidian-watch-title">自动同步 Obsidian 文件夹</h2>
            </div>

            <button
              type="button"
              className="memory-modal-close"
              onClick={onClose}
              aria-label="关闭窗口"
            >
              <X className="memory-icon" />
            </button>
          </div>

          <div className="memory-import-copy">
            <p>
              连接一个 Obsidian 文件夹后，整个文件夹会绑定到你选择的一个
              消息框；打开记忆页时会自动检查一次有没有新增或修改的笔记，
              发现变化会先让你确认再写入记忆，不会静默改动。
            </p>
          </div>

          {!supported && (
            <div className="memory-import-warning">
              <AlertTriangle className="memory-action-icon" />
              当前浏览器不支持这个功能（需要 Chrome 或 Edge），
              请使用上面的手动上传来导入 Obsidian 笔记。
            </div>
          )}

          {localError && (
            <div className="memory-message memory-message-error">
              <span>{localError}</span>
            </div>
          )}

          {localNotice && (
            <div className="memory-message memory-message-success">
              <span>{localNotice}</span>
            </div>
          )}

          {supported && (
            <div className="obsidian-default-fields">
              <label className="memory-form-label">
                <span>新文件夹绑定到哪一个消息框</span>
                <select
                  value={connectTargetChatId}
                  onChange={(event) => (
                    setConnectTargetChatId(event.target.value)
                  )}
                  disabled={isConnecting}
                >
                  <option value="">请选择消息框</option>
                  {chats.map((chat) => (
                    <option key={chat.id} value={chat.id}>
                      {getChatLabel(chat)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="memory-file-picker"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                <FileText className="memory-file-picker-icon" />
                <span>
                  <strong>
                    {isConnecting ? '正在打开文件夹选择器' : '连接新的文件夹'}
                  </strong>
                  <small>会请求这个文件夹的读取权限</small>
                </span>
              </button>
            </div>
          )}

          <div className="obsidian-entry-list">
            {watchFolders.length === 0 && (
              <p className="obsidian-note-error">还没有连接任何文件夹。</p>
            )}

            {watchFolders.map((watchFolder) => {
              const permission = permissionByFolderId[watchFolder.id];
              const chat = chats.find(
                (item) => String(item.id) === String(watchFolder.chatId)
              );

              return (
                <div
                  key={watchFolder.id}
                  className="obsidian-watch-folder-row"
                >
                  <span className="obsidian-watch-folder-info">
                    <strong>{watchFolder.folderName}</strong>
                    <small>
                      绑定到「{getChatLabel(chat)}」 ·{' '}
                      {PERMISSION_LABELS[permission] || '检查中'}
                    </small>
                  </span>

                  {permission === 'granted' ? (
                    <button
                      type="button"
                      className="memory-secondary-button"
                      onClick={() => handleCheckNow(watchFolder)}
                      disabled={checkingFolderId === watchFolder.id}
                    >
                      <RefreshCw className="memory-icon" />
                      {checkingFolderId === watchFolder.id
                        ? '检查中'
                        : '立即检查'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="memory-secondary-button"
                      onClick={() => handleReauthorize(watchFolder)}
                    >
                      重新授权
                    </button>
                  )}

                  <button
                    type="button"
                    className="memory-secondary-button"
                    onClick={() => setRemovingFolder(watchFolder)}
                    aria-label="移除这个文件夹"
                  >
                    <Trash2 className="memory-icon" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="memory-modal-actions">
            <button
              type="button"
              className="memory-secondary-button"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </section>
      </div>

      {reviewState && (
        <ObsidianImportModal
          chats={chats}
          initialChatId={reviewState.watchFolder.chatId}
          initialParseResult={reviewState.parseResult}
          allowFileUpload={false}
          eyebrow="OBSIDIAN SYNC"
          title={`「${reviewState.watchFolder.folderName}」有更新`}
          description={
            `检测到 ${reviewState.parseResult.summary.totalEntryCount} `
            + '条新增或修改的内容，确认后会写入记忆；未勾选的内容这次不会'
            + '导入，但下次这份笔记再变化时还会重新出现在这里。'
          }
          onClose={() => setReviewState(null)}
          onCompleted={handleReviewCompleted}
          onError={onError}
        />
      )}

      <ConfirmModal
        isOpen={!!removingFolder}
        title="移除这个 Obsidian 文件夹"
        message={
          `确定要移除「${removingFolder?.folderName || ''}」吗？`
          + '这只会停止自动检查，不会删除已经导入的记忆。'
        }
        confirmText="移除"
        cancelText="取消"
        onCancel={() => setRemovingFolder(null)}
        onConfirm={handleConfirmRemove}
      />
    </>
  );
};

export default ObsidianWatchModal;