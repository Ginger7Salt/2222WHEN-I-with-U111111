import React from 'react';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing } from 'lucide-react';

// 消息流里的通话记录条，跟微信的通话记录行是同一个思路：正常情况下
// 只是一条不可点的小标签；如果这通电话还"活着"（响铃中/进行中），
// 点一下会把已经存在的全局通话悬浮/全屏界面重新唤出来。
const formatCallDuration = (metadata) => {
  const { connectedAt, endedAt } = metadata;
  if (!connectedAt || !endedAt) return null;

  const totalSeconds = Math.max(
    0,
    Math.round((new Date(endedAt) - new Date(connectedAt)) / 1000)
  );

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const CallLogEntry = ({ message, isUser }) => {
  const metadata = message.metadata || {};
  const { status, direction, declined } = metadata;
  const isLive = status === 'ringing' || status === 'active';
  const duration = formatCallDuration(metadata);

  let label;
  let Icon;

  if (status === 'ringing') {
    label = direction === 'incoming' ? '来电响铃中...' : '正在呼叫...';
    Icon = direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
  } else if (status === 'active') {
    label = '通话进行中...';
    Icon = Phone;
  } else if (declined) {
    label = direction === 'incoming' ? '未接听的来电' : '对方拒绝了通话';
    Icon = PhoneMissed;
  } else if (duration) {
    label = `通话时长 ${duration}`;
    Icon = direction === 'incoming' ? PhoneIncoming : PhoneOutgoing;
  } else {
    label = '通话已结束';
    Icon = Phone;
  }

  const handleClick = () => {
    if (!isLive || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('call-overlay-open'));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isLive}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] transition-transform ${
        isLive ? 'active:scale-95' : 'opacity-75'
      } ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--divider)',
        color: 'var(--text-sub)',
      }}
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'ringing' ? 'animate-pulse' : ''}`} />
      <span>{label}</span>
    </button>
  );
};

export default CallLogEntry;
