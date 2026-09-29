// src/apps/bubble/BubbleRoomSettingsModal.jsx
//
// 泡泡模式（Bubble Mode）房间的外观设置面板。参照
// src/apps/messages/components/ChatSettingsModal.jsx 里"背景图 / 输入框与
// 按钮颜色 / 按钮外观"那几块原样搬过来，作用域从 .chat-room-container 换成
// .bubble-room-container，字段存在 bubbleRooms 表对应记录上（都是非索引
// 附加字段，不需要 db 版本升级）。
//
// 注意命名：这里的"气泡"指消息气泡（跟 messages 聊天室 BubbleCustomizer
// 定制的是同一个概念——.user-bubble / .ai-bubble 的配色和装饰），跟"泡泡
// 模式"（Bubble Mode，这整个多角色房间功能的名字）不是一回事，只是撞了同
// 一个中文词。消息气泡配色/装饰这块直接复用 messages 那边现成的
// BubbleCustomizer 组件（它本来就是跟 chat 解耦的通用组件，接收
// currentCss/onSave/currentDecoration/onSaveDecoration，这里传 room 的字
// 段进去即可）——本文件只负责"打开它"的入口按钮，弹窗本体由父组件
// BubbleRoom.jsx 渲染（跟 ChatRoom.jsx 管理 showBubbleCustomizer 的方式一致）。
//
// 切片B已经把消息收发接上了，气泡配色/装饰、气泡文字颜色这几项现在都能看
// 到实际效果。发送按钮颜色（sendBtnColor）这一轮仍然没加对应设置项——泡
// 泡模式的发送按钮目前固定用 --control-soft-bg，跟消息 app 那边可自定义
// 的 sendBtnColor 不是一回事，等真有需求再补。
//
// 房间人设（userName/userPersona）：整个房间共用一份（已跟用户确认，不是
// 每个角色单独一份），字段直接存在 bubbleRooms 记录上，跟角色自己的一对
// 一聊天人设完全独立。生成回复时 bubbleAiService.js 的
// buildBubbleSystemPrompt 优先用 room.userName/room.userPersona，房间没填
// 才退回角色自己的默认人设。UI 上照抄 messages/ChatSettingsModal.jsx 编辑
// 用户人设那两个输入框的写法：本地 state + onBlur 才提交，不是每敲一个字
// 就写一次 Dexie。

import React, { useRef, useState } from 'react';
import { X, Upload, Trash2, Eye, EyeOff, Palette, Image as ImageIcon } from 'lucide-react';

import db from '../../db';
import ColorSettingRow from '../messages/components/ColorSettingRow';
import { CHAT_CONTROL_STYLE_OPTIONS } from '../messages/chatControlStylePresets';

const SectionCard = ({ title, tag, description, children }) => (
  <div
    className="space-y-2.5 p-3 rounded-2xl border w-full"
    style={{
      background: 'var(--control-soft-bg)',
      borderColor: 'var(--card-border)',
    }}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 font-bold text-[11px]">
        <Palette className="w-3.5 h-3.5" />
        <span>{title}</span>
      </div>
      {tag && <span className="font-mono text-[9px] opacity-45">{tag}</span>}
    </div>

    {description && (
      <p className="text-[10px] opacity-55 leading-relaxed">{description}</p>
    )}

    {children}
  </div>
);

const BubbleRoomSettingsModal = ({ room, onClose, onUpdated, onOpenBubbleCustomizer }) => {
  const fileInputRef = useRef(null);

  const [isBgDimmed, setIsBgDimmed] = useState(room?.isBgDimmed ?? true);
  const [bgOpacity, setBgOpacity] = useState(room?.bgOpacity ?? 0.3);
  const bgImage = room?.bgImage || '';

  const [userName, setUserName] = useState(room?.userName || '');
  const [userPersona, setUserPersona] = useState(room?.userPersona || '');

  if (!room?.id) return null;

  const commit = async (patch) => {
    await db.bubbleRooms.update(room.id, patch);
    onUpdated?.(patch);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      void commit({ bgImage: reader.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleToggleBgDimmed = () => {
    const next = !isBgDimmed;
    setIsBgDimmed(next);
    void commit({ isBgDimmed: next });
  };

  const handleBgOpacityChange = (e) => {
    const next = Number(e.target.value);
    setBgOpacity(next);
    void commit({ bgOpacity: next });
  };

  const handleCommitColor = (field, value) => {
    void commit({ [field]: value || '' });
  };

  const handleCommitControlStyle = (styleId) => {
    const next = styleId || 'default';
    if (next === (room?.controlStyle || 'default')) return;
    void commit({ controlStyle: next });
  };

  const handleCommitUserIdentity = () => {
    void commit({
      userName: (userName || '').trim(),
      userPersona: (userPersona || '').trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in-up">
      <div className="fixed inset-0 backdrop-blur-md bg-black/20" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] p-5 space-y-3.5 shadow-2xl text-xs z-10"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">房间外观设置</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 背景图 */}
        <SectionCard title="房间背景图" tag="BACKGROUND">
          <div className="flex items-center justify-between">
            <span className="text-[10px] opacity-60">仅影响这一个房间</span>
            <button
              type="button"
              onClick={handleToggleBgDimmed}
              className="flex items-center gap-1.5 text-[10px] font-semibold opacity-75 hover:opacity-100"
              style={{ color: isBgDimmed ? 'var(--accent-color)' : 'var(--text-muted)' }}
            >
              {isBgDimmed ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>{isBgDimmed ? '背景已淡化' : '显示原图'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-2xl border flex items-center justify-center cursor-pointer overflow-hidden"
              style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)' }}
            >
              {bgImage ? (
                <img src={bgImage} alt="背景" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <ImageIcon className="w-4 h-4 opacity-40" />
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

            <div className="flex-1 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-1.5 rounded-xl border text-center font-medium text-[11px]"
                style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--divider)', color: 'var(--text-main)' }}
              >
                <span className="inline-flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  {bgImage ? '更换背景' : '选择图片'}
                </span>
              </button>

              {bgImage && (
                <button
                  type="button"
                  onClick={() => void commit({ bgImage: '' })}
                  className="px-2.5 py-1.5 rounded-xl border text-red-500"
                  style={{ borderColor: 'var(--divider)' }}
                  title="删除背景图"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isBgDimmed && bgImage && (
            <div className="pt-2 space-y-1 border-t" style={{ borderColor: 'var(--divider)' }}>
              <div className="flex items-center justify-between text-[10px] opacity-60">
                <span>背景图透明度</span>
                <span>{Math.round(bgOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={bgOpacity}
                onChange={handleBgOpacityChange}
                className="w-full"
                style={{ accentColor: 'var(--accent-color)' }}
              />
            </div>
          )}
        </SectionCard>

        {/* 输入框与按钮颜色 */}
        <SectionCard
          title="输入框与按钮颜色"
          tag="ROOM COLORS"
          description="点色块选颜色，图标文字会自动挑深色或白色。"
        >
          <ColorSettingRow
            label="输入框底色"
            value={room?.inputBarColor || ''}
            onCommit={(value) => handleCommitColor('inputBarColor', value)}
          />
          <ColorSettingRow
            label="输入框文字颜色"
            value={room?.inputTextColor || ''}
            onCommit={(value) => handleCommitColor('inputTextColor', value)}
          />
          <ColorSettingRow
            label="顶部按钮"
            value={room?.topBtnColor || ''}
            onCommit={(value) => handleCommitColor('topBtnColor', value)}
          />
          <ColorSettingRow
            label="我的气泡文字颜色"
            value={room?.userBubbleTextColor || ''}
            onCommit={(value) => handleCommitColor('userBubbleTextColor', value)}
          />
          <ColorSettingRow
            label="角色气泡文字颜色"
            value={room?.aiBubbleTextColor || ''}
            onCommit={(value) => handleCommitColor('aiBubbleTextColor', value)}
          />
        </SectionCard>

        {/* 房间共用人设 */}
        <SectionCard
          title="房间人设"
          tag="ROOM PERSONA"
          description="整个房间共用一份，房间里所有角色生成回复时都会看到这份人设；不填就退回每个角色自己一对一聊天的默认人设。"
        >
          <div>
            <label className="block text-[10px] opacity-60 mb-1">
              你在本房间的称呼
            </label>
            <input
              type="text"
              value={userName}
              placeholder="例如：阿泽 / 主人 / User"
              onChange={(e) => setUserName(e.target.value)}
              onBlur={handleCommitUserIdentity}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)',
              }}
            />
          </div>

          <div>
            <label className="block text-[10px] opacity-60 mb-1">
              本房间你的专属人设
            </label>
            <textarea
              rows={3}
              value={userPersona}
              placeholder="例如：刚下班的程序员 / 喜欢弹吉他的室友..."
              onChange={(e) => setUserPersona(e.target.value)}
              onBlur={handleCommitUserIdentity}
              className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs leading-relaxed overflow-y-auto resize-y max-h-32 min-h-[48px]"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-main)',
              }}
            />
          </div>
        </SectionCard>

        {/* 按钮外观预设 */}
        <SectionCard
          title="按钮外观"
          tag="CONTROL STYLE"
          description="切换输入栏和顶部按钮的质感（毛玻璃/黑玻璃），跟上面的颜色可以叠加。"
        >
          <div className="grid grid-cols-3 gap-2 mt-1">
            {CHAT_CONTROL_STYLE_OPTIONS.map((styleOpt) => {
              const isActive = (room?.controlStyle || 'default') === styleOpt.id;
              return (
                <button
                  key={styleOpt.id}
                  type="button"
                  onClick={() => handleCommitControlStyle(styleOpt.id)}
                  className="p-2.5 rounded-xl border text-center font-medium text-[11px] active:scale-95"
                  style={{
                    background: isActive ? 'var(--accent-color)' : 'var(--bg-main)',
                    borderColor: isActive ? 'var(--accent-color)' : 'var(--divider)',
                    color: isActive ? 'var(--accent-foreground)' : 'var(--text-main)',
                  }}
                >
                  {styleOpt.label}
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* 消息气泡配色与装饰（复用 messages 的 BubbleCustomizer） */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenBubbleCustomizer?.();
          }}
          className="w-full p-2.5 rounded-xl flex items-center justify-between border"
          style={{ background: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
        >
          <span className="font-semibold">消息气泡配色与装饰</span>
          <Palette className="w-3.5 h-3.5 opacity-60" />
        </button>
      </div>
    </div>
  );
};

export default BubbleRoomSettingsModal;