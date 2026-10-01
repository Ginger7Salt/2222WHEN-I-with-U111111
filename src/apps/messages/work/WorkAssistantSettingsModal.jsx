// src/apps/messages/work/WorkAssistantSettingsModal.jsx
//
// work 聊天窗专用的轻量设置面板：只管"助理身份"这几件事——名字、头像、
// 人设、对 User 的偏好记忆，而且是全局共享的（所有 work 聊天窗改了都会
// 同步），不走完整的 CharacterEditor.jsx（那个是给 RP/现实陪伴角色用的，
// 世界书、称呼语气这些字段对 work 没意义）。
//
// 聊天窗自己的视觉设置（背景/字号/气泡颜色等）另外走现有的
// ChatSettingsModal.jsx，这里不重复做。

import React, { useRef, useState } from 'react';
import { X, User, Sparkles, Heart } from 'lucide-react';
import { compressImageFile } from '../../../utils/imageHelper';
import { updateWorkAssistantIdentity } from './workAssistantService';

const DEFAULT_NAME_FALLBACK = '助理';

export const WorkAssistantSettingsModal = ({ character, onClose, onUpdated }) => {
  const avatarInputRef = useRef(null);

  const [name, setName] = useState(character?.name || '');
  const [avatar, setAvatar] = useState(character?.avatar || '');
  const [bio, setBio] = useState(character?.bio || '');
  const [userPersona, setUserPersona] = useState(character?.userPersona || '');
  const [isSaving, setIsSaving] = useState(false);

  const controlBoxStyle = {
    background: 'var(--bg-main)',
    borderColor: 'var(--card-border)',
    color: 'var(--text-main)',
  };

  const sectionStyle = {
    background: 'var(--control-soft-bg)',
    borderColor: 'var(--card-border)',
  };

  const persist = async (patch) => {
    if (!character?.id) return;

    try {
      setIsSaving(true);
      await updateWorkAssistantIdentity(character.id, patch);
      onUpdated?.(patch);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file);
      setAvatar(compressed);
      await persist({ avatar: compressed });
    } catch (error) {
      console.error('[WorkAssistantSettings] 头像上传失败：', error);
    }

    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up">
      <div
        className="fixed inset-0 backdrop-blur-md"
        style={{
          background: 'var(--modal-backdrop, color-mix(in srgb, var(--bg-main) 72%, transparent))',
        }}
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-sm rounded-[2rem] p-5 space-y-4 shadow-2xl text-xs text-left z-10 overflow-y-auto max-h-[90vh] no-scrollbar"
        style={{
          background: 'var(--card-bg-gradient)',
          border: '1px solid var(--card-border)',
          color: 'var(--text-main)',
        }}
      >
        <div
          className="flex items-center justify-between pb-2 border-b"
          style={{ borderColor: 'var(--divider)' }}
        >
          <span className="font-bold text-sm">助理设置</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[10px] leading-relaxed opacity-55">
          这里改的是助理本身——名字、头像、人设、对你的偏好记忆。所有 work
          聊天窗共用同一份，改了会同步到全部窗口。每个聊天窗自己的背景、
          气泡颜色、字号等视觉设置，去对话右上角的「对话空间设置」里改。
        </p>

        {/* 名字 + 头像 */}
        <div className="space-y-3 p-3 rounded-2xl border" style={sectionStyle}>
          <div className="flex items-center gap-1.5 font-bold">
            <User className="w-3.5 h-3.5" />
            <span>名字 & 头像</span>
          </div>

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="w-14 h-14 shrink-0 rounded-2xl border flex items-center justify-center overflow-hidden relative transition-all active:scale-95"
              style={{ background: 'var(--bg-main)', borderColor: 'var(--divider)' }}
              title="上传助理头像"
            >
              {avatar ? (
                <img src={avatar} alt="助理头像" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <User className="w-5 h-5 opacity-35" />
              )}
            </button>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />

            <div className="flex-1 min-w-0 space-y-1">
              <label className="block text-[10px] opacity-60">助理名称</label>
              <input
                type="text"
                value={name}
                placeholder="给它起个名字"
                onChange={(e) => setName(e.target.value)}
                onBlur={() => persist({ name: name.trim() || DEFAULT_NAME_FALLBACK })}
                className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs"
                style={controlBoxStyle}
              />
              <p className="text-[9px] opacity-45 leading-relaxed pt-1">
                没传头像时，它会用一个颜文字代表当前状态来代替头像，跟着每次回复变化。
              </p>
            </div>
          </div>
        </div>

        {/* 人设 */}
        <div className="space-y-2 p-3 rounded-2xl border" style={sectionStyle}>
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>人设</span>
          </div>
          <p className="text-[10px] opacity-55 leading-relaxed">
            它说话的调性、习惯、性格偏好。留空则使用默认的松弛高效助理风格。
          </p>
          <textarea
            rows={4}
            value={bio}
            placeholder="例如：说话直接不绕弯子，偶尔开个无害的玩笑，不喜欢用过多敬语..."
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => persist({ bio })}
            className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs leading-relaxed resize-y max-h-40 min-h-[72px]"
            style={controlBoxStyle}
          />
        </div>

        {/* User 偏好记忆 */}
        <div className="space-y-2 p-3 rounded-2xl border" style={sectionStyle}>
          <div className="flex items-center gap-1.5 font-bold">
            <Heart className="w-3.5 h-3.5" />
            <span>对你的偏好记忆</span>
          </div>
          <p className="text-[10px] opacity-55 leading-relaxed">
            记一些它该记住的、关于你工作习惯的事，比如"不喜欢被追问进度"、
            "周报喜欢分点不喜欢大段文字"。所有 work 聊天窗共用这份记忆。
          </p>
          <textarea
            rows={4}
            value={userPersona}
            placeholder={'例如：我是程序员，习惯简短直接的回复，不用每次都加"收到"之类的客套话...'}
            onChange={(e) => setUserPersona(e.target.value)}
            onBlur={() => persist({ userPersona })}
            className="w-full px-3 py-1.5 rounded-xl border outline-none text-xs leading-relaxed resize-y max-h-40 min-h-[72px]"
            style={controlBoxStyle}
          />
        </div>

        {isSaving && (
          <p className="text-[9px] opacity-40 text-center">正在保存...</p>
        )}
      </div>
    </div>
  );
};

export default WorkAssistantSettingsModal;