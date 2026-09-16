import React, { useState } from 'react';
import { MapPin, X } from 'lucide-react';

/**
 * 出现在输入框上方的轻量横幅：提示"发现一个新地点，帮它起个名字吧"。
 * 不解析聊天文字，直接给一个输入框 + 确认按钮，命名结果直接写回 places 表。
 *
 * props:
 * - onConfirm(name): 用户输入完名字并确认
 * - onDismiss(): 用户选择"暂不命名"，先隐藏横幅（下次再出现同一地点仍会提示）
 */
const PendingPlaceBanner = ({ onConfirm, onDismiss }) => {
  const [name, setName] = useState('');

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(name.trim());
    setName('');
  };

  return (
    <div
      className="mb-2 flex items-center gap-2 rounded-2xl border p-2.5 text-xs shadow-sm"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
        color: 'var(--text-main)',
      }}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'var(--accent-color)' }}
      >
        <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--accent-foreground)' }} />
      </div>

      <span className="shrink-0 opacity-75">这是哪呀？</span>

      <input
        type="text"
        value={name}
        placeholder="例如：家 / 公司 / 常去的咖啡馆"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleConfirm();
        }}
        className="min-w-0 flex-1 rounded-xl border px-2.5 py-1 text-xs outline-none"
        style={{
          background: 'var(--bg-main)',
          borderColor: 'var(--divider)',
          color: 'var(--text-main)',
        }}
      />

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!name.trim()}
        className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-40"
        style={{
          background: 'var(--accent-color)',
          color: 'var(--accent-foreground)',
        }}
      >
        记住
      </button>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-1 opacity-50 hover:opacity-100"
        title="暂不命名"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default PendingPlaceBanner;