import React, { useEffect, useState } from 'react';

import {
  getMemoryTidyAutoExecute,
  setMemoryTidyAutoExecute
} from '../../services/memoryTidySettingsService';

import { runMemoryTidyForChat } from './memoryTidyService';

const buildResultMessage = (result) => {
  if (!result) {
    return '本次整理已完成。';
  }

  if (result.skipped) {
    return '整理正在进行中，请稍后再试。';
  }

  const parts = [];

  const dormantCount = result.decay?.dormantCount || 0;


  if (dormantCount > 0) {
    parts.push(`已把 ${dormantCount} 条淡去的旧记忆暂存起来（可在记忆页恢复）`);
  }

  const compoundCreated = result.compound?.created || 0;
  const compoundAbsorbed = result.compound?.absorbed || 0;

  if (compoundCreated > 0) {
    parts.push(`零散的情绪累积成了 ${compoundCreated} 份更重的情绪`);
  }

  if (compoundAbsorbed > 0) {
    parts.push(`${compoundAbsorbed} 份已有的情绪又叠加了新的内容`);
  }

  const mergeApplied = result.merge?.applied || 0;
  const mergeProposed = result.merge?.proposed || 0;
  const emotionApplied = result.emotion?.applied || 0;
  const emotionProposed = result.emotion?.proposed || 0;

  if (mergeApplied > 0) {
    parts.push(`已合并 ${mergeApplied} 组重复记忆`);
  }

  if (mergeProposed > 0) {
    parts.push(`${mergeProposed} 组重复记忆等待你确认合并`);
  }

  if (emotionApplied > 0) {
    parts.push(`已写入 ${emotionApplied} 条情绪回顾`);
  }

  if (emotionProposed > 0) {
    parts.push(`${emotionProposed} 条情绪回顾等待你确认`);
  }

  if (parts.length === 0) {
    if (result.error) {
      return result.error;
    }

    const notEnoughEmotion = (
      result.emotion?.reason === 'not_enough_emotion_memories'
    );

    return notEnoughEmotion
      ? '目前没有发现需要合并的重复记忆，新的情绪痕迹也还不够多，暂时不需要回顾。'
      : '目前没有发现需要合并的重复记忆，也没有新的情绪回顾。';
  }

  return `${parts.join('；')}。`;
};

/**
 * 「记忆」App 里的整理设置：
 *   - 自主程度开关：整理动作先等你确认（默认），或者由角色直接执行；
 *   - "现在整理一次"：不用等自动触发，手动跑一轮，方便验证效果。
 */
export const MemoryTidySection = ({
  chatId = null,
  onFinished = null
}) => {
  const [autoExecute, setAutoExecute] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const value = await getMemoryTidyAutoExecute();

      if (cancelled) return;

      setAutoExecute(value);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = async (value) => {
    if (value === autoExecute || isBusy) return;

    setIsBusy(true);

    try {
      await setMemoryTidyAutoExecute(value);
      setAutoExecute(value);
    } finally {
      setIsBusy(false);
    }
  };

  const hasChat = (
    chatId !== null &&
    chatId !== undefined &&
    chatId !== ''
  );

  const handleRunNow = async () => {
    if (!hasChat || isRunning) return;

    setIsRunning(true);
    setMessage('');

    try {
      const result = await runMemoryTidyForChat(chatId, { force: true });

      setMessage(buildResultMessage(result));

      if (typeof onFinished === 'function') {
        await onFinished();
      }
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return null;
  }

  const hint = autoExecute
    ? '角色会自己合并重复的记忆、回顾最近的情绪。被合并的旧记忆只是归档，可以在已归档里找回，每一步都有修订记录。你手动写过或改过的记忆不会被自动合并，仍然会先问你。'
    : '合并重复记忆、回顾最近的情绪，都会先放到待确认列表，等你确认后才生效。';

  return (
    <section className="memory-chat-section">
      <div className="memory-section-label">
        <span>记忆整理</span>
        <span className="memory-section-line" />
      </div>

      <div className="flex gap-2 mt-3">
        {[
          { value: false, label: '先让我确认' },
          { value: true, label: '角色直接整理' }
        ].map((option) => (
          <button
            key={String(option.value)}
            type="button"
            disabled={isBusy}
            onClick={() => handleSelect(option.value)}
            className="flex-1 rounded-full border px-2 py-1.5 text-[11px] transition-colors"
            style={{
              borderColor:
                autoExecute === option.value
                  ? 'var(--accent-color)'
                  : 'var(--card-border)',
              background:
                autoExecute === option.value
                  ? 'var(--accent-color)'
                  : 'var(--card-bg)',
              color:
                autoExecute === option.value
                  ? 'var(--accent-foreground)'
                  : 'var(--text-main)'
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p
        className="mt-2 text-[11px] leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        {hint}
      </p>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!hasChat || isRunning}
          onClick={handleRunNow}
          className="rounded-full border px-3 py-1.5 text-[11px]"
          style={{
            borderColor: 'var(--card-border)',
            color: hasChat ? 'var(--text-main)' : 'var(--text-muted)',
            background: 'var(--card-bg)'
          }}
        >
          {isRunning ? '整理中...' : '现在整理一次'}
        </button>
      </div>

      {!hasChat && (
        <p
          className="mt-2 text-[11px] leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          先在下面选择一个消息框，才能手动整理它的记忆。
        </p>
      )}

      {message && (
        <p
          className="mt-2 text-[11px] leading-relaxed"
          style={{ color: 'var(--text-sub)' }}
        >
          {message}
        </p>
      )}
    </section>
  );
};

export default MemoryTidySection;