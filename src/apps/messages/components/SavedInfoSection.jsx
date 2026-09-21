import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import {
  SAVED_INFO_LIMITS,
  listSavedInfo,
  addSavedInfo,
  updateSavedInfo,
  deleteSavedInfo,
} from '../../../services/userSavedInfoService';
import { triggerGlobalToast } from '../../../components/NotificationToast';

const inputStyle = {
  background: 'var(--bg-main)',
  color: 'var(--text-main)',
};

/**
 * 常用信息（全局，所有聊天窗共用）。
 * 默认折叠；第一次展开时才读取数据库，避免设置窗每次打开都多一次读取。
 */
export const SavedInfoSection = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [items, setItems] = useState([]);

  // null：没有在编辑；'new'：正在新增；数字：正在编辑某一条
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 删除需要点两下：第一下先标记，第二下才真正删除
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const pendingDeleteTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pendingDeleteTimerRef.current) {
        clearTimeout(pendingDeleteTimerRef.current);
      }
    };
  }, []);

  const reload = async () => {
    const list = await listSavedInfo();
    setItems(list);
  };

  const handleToggle = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen && !isLoaded) {
      try {
        await reload();
        setIsLoaded(true);
      } catch (error) {
        console.warn('[SavedInfo] 读取失败：', error);
      }
    }
  };

  const startAdd = () => {
    setEditingId('new');
    setDraftTitle('');
    setDraftContent('');
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setDraftTitle(item.title);
    setDraftContent(item.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftTitle('');
    setDraftContent('');
  };

  const commitEdit = async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      if (editingId === 'new') {
        await addSavedInfo({ title: draftTitle, content: draftContent });
      } else {
        await updateSavedInfo(editingId, {
          title: draftTitle,
          content: draftContent,
        });
      }

      await reload();
      cancelEdit();
    } catch (error) {
      triggerGlobalToast({
        title: '未能保存',
        content: error?.message || '请稍后再试。',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);

      if (pendingDeleteTimerRef.current) {
        clearTimeout(pendingDeleteTimerRef.current);
      }

      pendingDeleteTimerRef.current = setTimeout(() => {
        setPendingDeleteId(null);
      }, 3000);

      return;
    }

    if (pendingDeleteTimerRef.current) {
      clearTimeout(pendingDeleteTimerRef.current);
    }

    setPendingDeleteId(null);

    try {
      await deleteSavedInfo(id);
      await reload();
    } catch (error) {
      triggerGlobalToast({
        title: '未能删除',
        content: error?.message || '请稍后再试。',
      });
    }
  };

  const isEditing = editingId !== null;

  return (
    <div
      className="rounded-2xl border w-full"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between p-3"
      >
        <div className="flex items-center gap-1.5 font-bold">
          <MapPin className="w-3.5 h-3.5" />
          <span>常用信息</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] opacity-45">SAVED INFO</span>
          <ChevronDown
            className="w-3.5 h-3.5 opacity-60 transition-transform duration-300"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="space-y-2.5 px-3 pb-3">
            <p className="text-[10px] opacity-55 leading-relaxed">
              这里保存的地址、电话等信息，所有聊天窗共用。角色需要时会自己来查，不会每次对话都带上。
              被查阅的内容会随请求发送给你所配置的 AI 服务。
            </p>

            {items.length === 0 && !isEditing && (
              <p className="text-[10px] opacity-45 py-1">还没有保存任何信息。</p>
            )}

            {items.map((item) => {
              if (editingId === item.id) {
                return null;
              }

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-xl p-2"
                  style={{ background: 'var(--bg-main)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold truncate">
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-[10px] opacity-60 leading-relaxed whitespace-pre-wrap break-words">
                      {item.content}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-lg p-1.5 opacity-60 active:scale-90 transition-all"
                      title="编辑"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded-lg p-1.5 active:scale-90 transition-all"
                      style={{
                        background:
                          pendingDeleteId === item.id
                            ? 'var(--text-main)'
                            : 'transparent',
                        color:
                          pendingDeleteId === item.id
                            ? 'var(--bg-main)'
                            : 'var(--text-main)',
                        opacity: pendingDeleteId === item.id ? 1 : 0.6,
                      }}
                      title={
                        pendingDeleteId === item.id ? '再点一次确认删除' : '删除'
                      }
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {isEditing && (
              <div
                className="space-y-2 rounded-xl p-2"
                style={{ background: 'var(--bg-main)' }}
              >
                <input
                  type="text"
                  value={draftTitle}
                  maxLength={SAVED_INFO_LIMITS.maxTitleLength}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="标题，例如：家庭地址"
                  className="w-full rounded-lg p-2 text-xs outline-none border"
                  style={{ ...inputStyle, borderColor: 'var(--card-border)' }}
                />

                <textarea
                  value={draftContent}
                  maxLength={SAVED_INFO_LIMITS.maxContentLength}
                  onChange={(event) => setDraftContent(event.target.value)}
                  placeholder="内容"
                  rows={3}
                  className="w-full resize-none rounded-lg p-2 text-xs outline-none border"
                  style={{ ...inputStyle, borderColor: 'var(--card-border)' }}
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] active:scale-95 transition-all"
                    style={{ background: 'var(--control-soft-bg)' }}
                  >
                    <X className="w-3 h-3" />
                    <span>取消</span>
                  </button>

                  <button
                    type="button"
                    onClick={commitEdit}
                    disabled={isSaving}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold active:scale-95 transition-all disabled:opacity-50"
                    style={{
                      background: 'var(--text-main)',
                      color: 'var(--bg-main)',
                    }}
                  >
                    <Check className="w-3 h-3" />
                    <span>保存</span>
                  </button>
                </div>
              </div>
            )}

            {!isEditing && (
              <button
                type="button"
                onClick={startAdd}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-[11px] font-medium opacity-70 active:scale-95 transition-all"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <Plus className="w-3 h-3" />
                <span>添加一条</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SavedInfoSection;