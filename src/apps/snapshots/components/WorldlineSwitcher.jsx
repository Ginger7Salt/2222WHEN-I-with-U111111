// src/apps/snapshots/components/WorldlineSwitcher.jsx
//
// 【新建文件说明】
// 可复用的"世界线切换胶囊"：默认收起为一个紧凑的小胶囊（圆点+当前世界线名字），
// 点击后用 opacity+scale 的过渡动效展开成完整的世界线列表，点击列表外部区域收起。
// 只用 Tailwind 内置的 transition/duration/scale/opacity 工具类实现动效，
// 不依赖项目里可能没有定义的自定义 keyframes。
//
// tone: 'light' | 'dark' —— 供浅色页面（SnapshotsApp）与深色玻璃卡片页面
// （UserProfileSheet）分别使用对应的配色。
//
import React, { useState } from 'react';

export const WorldlineSwitcher = ({ chats = [], currentChatId, onChangeChat, tone = 'light' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentChat = chats.find((c) => Number(c.id) === Number(currentChatId));
  const isDark = tone === 'dark';

  const collapsedClasses = isDark
    ? 'bg-black/40 border-white/15 text-white'
    : 'bg-white border-neutral-200/60 text-neutral-800';

  const panelClasses = isDark
    ? 'bg-neutral-900/95 border-white/10'
    : 'bg-white border-neutral-200/60';

  const handleSelect = (id) => {
    onChangeChat && onChangeChat(id);
    setIsExpanded(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm border backdrop-blur-md transition-all active:scale-95 ${collapsedClasses}`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        <span className="text-xs font-bold tracking-tight max-w-[96px] truncate">
          {currentChat?.title || '选择世界线'}
        </span>
        <svg
          className={`w-3 h-3 opacity-60 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* 点击外部收起的透明遮罩，始终挂载但用 pointer-events 控制是否可点击 */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsExpanded(false)}
      />

      {/* 展开面板：始终挂载，用 opacity+scale 做展开/收起动效 */}
      <div
        className={`absolute top-full left-0 mt-2 w-56 max-h-72 overflow-y-auto rounded-2xl border shadow-2xl p-1.5 z-50 origin-top-left transition-all duration-200 ease-out ${panelClasses} ${
          isExpanded ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {chats.length === 0 ? (
          <div className={`px-3 py-3 text-xs ${isDark ? 'text-white/50' : 'text-neutral-400'}`}>暂无世界线</div>
        ) : (
          chats.map((c) => {
            const active = Number(c.id) === Number(currentChatId);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between gap-2 ${
                  active
                    ? (isDark ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-900')
                    : (isDark ? 'text-white/70 hover:bg-white/10' : 'text-neutral-500 hover:bg-neutral-50')
                }`}
              >
                <span className="truncate">{c.title}</span>
                {active && (
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WorldlineSwitcher;