import React, { useEffect, useRef, useState } from 'react';
import { PawPrint, Trash2, Upload } from 'lucide-react';

import GlassCard from '../../components/GlassCard';
import { triggerGlobalToast } from '../../components/NotificationToast';
import {
  compressPetAvatar,
  getBindablePetChats,
  getPetWidgetConfig,
  savePetWidgetConfig,
} from './petWidgetService';

export const PetWidgetSettings = () => {
  const avatarInputRef = useRef(null);

  const [config, setConfig] = useState({
    enabled: false,
    chatId: null,
    customAvatar: null,
    aiReactionsEnabled: false,
  });
  const [bindableChats, setBindableChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const loadData = async () => {
    const [nextConfig, chats] = await Promise.all([
      getPetWidgetConfig(),
      getBindablePetChats(),
    ]);

    setConfig(nextConfig);
    setBindableChats(chats);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await loadData();
      } catch (error) {
        console.error('[PetWidgetSettings] 读取设置失败:', error);
        triggerGlobalToast({
          title: '桌宠',
          content: '设置暂时无法读取，请稍后再试。',
          duration: 4000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const handleToggle = async (event) => {
    const enabled = event.target.checked;

    if (enabled && !config.chatId) {
      triggerGlobalToast({
        title: '桌宠',
        content: '先选一个要绑定的消息框，再打开桌宠。',
        duration: 3600,
      });
      return;
    }

    setConfig((previous) => ({ ...previous, enabled }));

    try {
      await savePetWidgetConfig({ enabled });
    } catch (error) {
      console.error('[PetWidgetSettings] 保存开关失败:', error);
      triggerGlobalToast({
        title: '桌宠',
        content: '开关状态未能保存。',
        duration: 4000,
      });
    }
  };

  const handleChatChange = async (event) => {
    const nextValue = event.target.value;
    const chatId = nextValue ? Number(nextValue) : null;

    setConfig((previous) => ({ ...previous, chatId }));

    try {
      await savePetWidgetConfig({ chatId });

      triggerGlobalToast({
        title: '桌宠',
        content: chatId ? '已绑定消息框，桌宠会继承这里的聊天上下文和记忆。' : '已取消绑定。',
        duration: 3600,
      });
    } catch (error) {
      console.error('[PetWidgetSettings] 保存绑定失败:', error);
      triggerGlobalToast({
        title: '桌宠',
        content: '绑定未能保存。',
        duration: 4000,
      });
    }
  };

  const handleAvatarSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setIsUploading(true);

    try {
      const dataUrl = await compressPetAvatar(file);

      setConfig((previous) => ({ ...previous, customAvatar: dataUrl }));
      await savePetWidgetConfig({ customAvatar: dataUrl });

      triggerGlobalToast({
        title: '桌宠',
        content: '外观已更新。',
        duration: 3000,
      });
    } catch (error) {
      triggerGlobalToast({
        title: '桌宠',
        content: error?.message || '图片处理失败，请重新选择。',
        duration: 4000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleAiReactions = async (event) => {
    const aiReactionsEnabled = event.target.checked;

    setConfig((previous) => ({ ...previous, aiReactionsEnabled }));

    try {
      await savePetWidgetConfig({ aiReactionsEnabled });
    } catch (error) {
      console.error('[PetWidgetSettings] 保存 AI 反应开关失败:', error);
      triggerGlobalToast({
        title: '桌宠',
        content: '这个开关暂时没保存上，稍后再试试。',
        duration: 4000,
      });
    }
  };

  const handleResetAvatar = async () => {
    setConfig((previous) => ({ ...previous, customAvatar: null }));

    try {
      await savePetWidgetConfig({ customAvatar: null });
    } catch (error) {
      console.error('[PetWidgetSettings] 重置头像失败:', error);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <GlassCard className="space-y-4 text-left">
      <div className="flex items-center gap-2 text-sm font-bold">
        <PawPrint className="h-4 w-4" />
        <span>桌宠 (Desktop Pet)</span>
      </div>

      <div
        className="flex items-center justify-between gap-4 rounded-2xl border p-3"
        style={{
          background: 'var(--control-soft-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium">显示桌宠悬浮球</p>
          <p
            className="mt-1 text-[10px] leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            开启后，跨页面常驻一个可拖动的小悬浮球，点开能看心情、也能随时说句话。
          </p>
        </div>

        <input
          type="checkbox"
          checked={config.enabled}
          onChange={handleToggle}
          className="h-4 w-4 shrink-0 cursor-pointer"
          style={{ accentColor: 'var(--accent-color)' }}
          aria-label="显示桌宠悬浮球"
        />
      </div>

            <div
        className="flex items-center justify-between gap-4 rounded-2xl border p-3"
        style={{
          background: 'var(--control-soft-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium">戳一戳等小动作用 AI 生成回复</p>
          <p
            className="mt-1 text-[10px] leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            关闭时（默认）用固定的几句话瞬间回应，不花 API 额度；打开后会调用你配置的 API，为每次小动作单独生成一句符合角色性格和当下心情的话，会有几秒等待，也会消耗一点 API 用量。没配置 API 时会自动退回固定回应。
          </p>
        </div>

        <input
          type="checkbox"
          checked={config.aiReactionsEnabled}
          onChange={handleToggleAiReactions}
          className="h-4 w-4 shrink-0 cursor-pointer"
          style={{ accentColor: 'var(--accent-color)' }}
          aria-label="戳一戳等小动作用 AI 生成回复"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs opacity-70">绑定消息框</label>

        {bindableChats.length === 0 ? (
          <p
            className="rounded-xl border px-3 py-2 text-[11px]"
            style={{
              borderColor: 'var(--card-border)',
              color: 'var(--text-muted)',
            }}
          >
            还没有可绑定的消息框，先去开始一段聊天吧。
          </p>
        ) : (
          <select
            value={config.chatId ?? ''}
            onChange={handleChatChange}
            className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
            style={{
              color: 'var(--text-main)',
              backgroundColor: 'var(--control-soft-bg)',
              borderColor: 'var(--card-border)',
            }}
          >
            <option value="">未绑定</option>
            {bindableChats.map((item) => (
              <option key={item.chatId} value={item.chatId}>
                {item.characterName} · {item.chatTitle}
              </option>
            ))}
          </select>
        )}

        <p
          className="mt-1.5 text-[10px] leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          桌宠会继承这个消息框已有的聊天记录、记忆和当前心情，在这里说的话也会写进同一个消息框。
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs opacity-70">外观</label>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarSelect}
        />

        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border"
            style={{
              borderColor: 'var(--card-border)',
              backgroundColor: 'var(--control-soft-bg)',
            }}
          >
            {config.customAvatar ? (
              <img
                src={config.customAvatar}
                alt="桌宠头像"
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <PawPrint className="h-6 w-6 opacity-50" strokeWidth={1.6} />
            )}
          </div>

          <div className="flex flex-1 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium disabled:opacity-50"
              style={{
                borderColor: 'var(--card-border)',
                backgroundColor: 'var(--control-soft-bg)',
                color: 'var(--text-main)',
              }}
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={1.7} />
              {isUploading ? '处理中…' : '上传图片'}
            </button>

            {config.customAvatar && (
              <button
                type="button"
                onClick={handleResetAvatar}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium"
                style={{
                  borderColor: 'var(--card-border)',
                  color: 'var(--text-muted)',
                }}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                恢复默认
              </button>
            )}
          </div>
        </div>

        <p
          className="mt-1.5 text-[10px] leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          没有上传图片之前，悬浮球会用一个占位小图标，不会自动使用角色的头像。
        </p>
      </div>
    </GlassCard>
  );
};

export default PetWidgetSettings;