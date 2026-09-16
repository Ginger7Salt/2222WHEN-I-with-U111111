import React from 'react';
import { MapPin } from 'lucide-react';

// 类社交软件"发送位置"的卡片样式。
// metadata: { name, note }（由 aiService 解析 [LOCATION: 地点名称 | 附加感想] 得来）
const LocationCard = ({ metadata = {}, isUser }) => {
  const name = metadata?.name || '未知地点';
  const note = metadata?.note || '';

  return (
    <div
      className="flex min-w-[190px] max-w-[240px] items-center gap-3 rounded-2xl border p-3"
      style={{
        background: isUser ? 'var(--accent-color)' : 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
        color: isUser ? 'var(--accent-foreground)' : 'var(--text-main)',
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{
          background: isUser ? 'rgba(255,255,255,0.25)' : 'var(--accent-color)',
        }}
      >
        <MapPin
          className="h-4 w-4"
          style={{
            color: isUser ? 'var(--accent-foreground)' : 'var(--accent-foreground)',
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{name}</p>
        {note && (
          <p className="mt-0.5 truncate text-[10px] opacity-70">{note}</p>
        )}
      </div>
    </div>
  );
};

export default LocationCard;