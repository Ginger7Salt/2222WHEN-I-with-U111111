// src/apps/messages/components/FandomCharacterPanel.jsx
//
// 角色编辑器里"同人角色"小节：打开开关才显示下面这块内容（不打开的话
// 普通原创角色编辑页不会多这些用不到的栏位）。一键 AI 生成"原作设定/
// 世界观"草稿 + 一句"强提醒"，生成完用户可以直接在文本框里手改。
//
// 跟 VoiceProfilePanel/RingtonePanel 一样是受控组件：上层
// CharacterEditor.jsx 把 character.fandom 整个对象当 value 传进来，
// 这里改动了就整个新对象传回去，不在这里直接碰 db。
import React, { useState } from 'react';
import { Sparkles, Wand2, Loader2 } from 'lucide-react';
import GlassCard from '../../../components/GlassCard';
import ConfirmModal from '../../../components/ConfirmModal';
import { generateFandomDraft } from '../fandomCharacterService';

// 跟 CharacterEditor.jsx 里的 AutoGrowingTextarea 是同一个实现，这里
// 独立复制一份而不是从 CharacterEditor.jsx 里导出复用——那个文件本来
// 就已经很大了，不想为了导出一个小组件而在它身上多开一个口子。
const AutoGrowingTextarea = ({
  value,
  onChange,
  placeholder,
  minHeight = '96px',
  maxHeight = '240px',
  className = '',
  ...props
}) => {
  const textareaRef = React.useRef(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  React.useEffect(() => {
    adjustHeight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        adjustHeight();
        onChange?.(e);
      }}
      placeholder={placeholder}
      style={{ minHeight, maxHeight }}
      className={`w-full bg-black/5 dark:bg-white/10 rounded-xl p-3 outline-none resize-none overflow-y-auto leading-relaxed transition-[height] duration-75 text-xs sm:text-sm custom-scrollbar ${className}`}
      {...props}
    />
  );
};

export default function FandomCharacterPanel({ value, onChange }) {
  const fandom = value;

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [pendingOverwrite, setPendingOverwrite] = useState(false);

  const update = (patch) => onChange({ ...fandom, ...patch });

  const hasExistingDraft = Boolean(
    fandom.canonSetting.trim() || fandom.reminder.trim()
  );

  const runGenerate = async () => {
    setGenerateError('');
    setIsGenerating(true);

    try {
      const { setting, reminder } = await generateFandomDraft({
        sourceWork: fandom.sourceWork,
        referenceMaterial: fandom.referenceMaterial,
      });

      update({ canonSetting: setting, reminder });
    } catch (err) {
      setGenerateError(err?.message || 'AI 生成失败，再试一次吧');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateClick = () => {
    if (!fandom.sourceWork.trim()) {
      setGenerateError('请先填写作品名称');
      return;
    }

    if (hasExistingDraft) {
      setPendingOverwrite(true);
      return;
    }

    runGenerate();
  };

  return (
    <GlassCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Sparkles className="w-4 h-4" />
          <span>同人角色 (Fandom Character)</span>
        </div>
        <input
          type="checkbox"
          checked={fandom.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          className="w-4 h-4 accent-black dark:accent-white"
        />
      </div>

      {fandom.enabled && (
        <div className="space-y-4 pt-1">
          <div>
            <label className="block opacity-60 mb-1">作品名称</label>
            <input
              type="text"
              placeholder="例如：某某动画/某某小说"
              value={fandom.sourceWork}
              onChange={(e) => update({ sourceWork: e.target.value })}
              className="w-full bg-black/5 dark:bg-white/10 rounded-lg p-2 outline-none"
            />
          </div>

          <div>
            <label className="block opacity-60 mb-1">
              参考资料（可选，留空则由 AI 凭自己知识写）
            </label>
            <AutoGrowingTextarea
              placeholder="可以贴角色百科、原作设定片段等，不填也可以直接生成..."
              value={fandom.referenceMaterial}
              minHeight="80px"
              maxHeight="200px"
              onChange={(e) => update({ referenceMaterial: e.target.value })}
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 rounded-xl p-2.5 bg-black/5 dark:bg-white/10 font-medium disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            <span>{isGenerating ? '生成中...' : 'AI 一键生成设定草稿'}</span>
          </button>

          {generateError && (
            <p className="text-xs text-red-500">{generateError}</p>
          )}

          <div>
            <label className="block opacity-60 mb-1">原作设定 / 世界观</label>
            <AutoGrowingTextarea
              placeholder="生成后会出现在这里，也可以直接手写..."
              value={fandom.canonSetting}
              minHeight="120px"
              maxHeight="320px"
              onChange={(e) => update({ canonSetting: e.target.value })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="opacity-60">强提醒</label>
              <input
                type="checkbox"
                checked={fandom.reminderEnabled}
                onChange={(e) => update({ reminderEnabled: e.target.checked })}
                className="w-4 h-4 accent-black dark:accent-white"
              />
            </div>
            <AutoGrowingTextarea
              placeholder="一句话提醒 AI 这是同人角色，例如：这是《XX》里的角色……"
              value={fandom.reminder}
              minHeight="60px"
              maxHeight="140px"
              onChange={(e) => update({ reminder: e.target.value })}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={pendingOverwrite}
        title="重新生成"
        message="已经有设定/强提醒内容了，重新生成会覆盖掉当前内容（包括你手改过的部分），确定吗？"
        confirmText="覆盖重新生成"
        onConfirm={() => {
          setPendingOverwrite(false);
          runGenerate();
        }}
        onCancel={() => setPendingOverwrite(false)}
      />
    </GlassCard>
  );
}