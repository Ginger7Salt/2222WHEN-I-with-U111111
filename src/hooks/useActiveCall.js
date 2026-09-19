import { useCallback, useEffect, useState } from 'react';
import db from '../db';

// 全局唯一的"当前通话"状态,跟 KeepAliveIndicator / DesktopPetWidget
// 一样挂载在 App.jsx 顶层,这样切换到聊天列表、别的 App 页面时通话
// 依然挂在屏幕上,不会被 currentApp 的条件渲染卸载掉。
//
// 没有用 dexie-react-hooks 的 useLiveQuery（项目里没有引入这个依赖),
// 而是复用项目已有的"本地事件 + 手动刷新"约定
// （参考 interactionService.js 的 new-local-message-inserted）。
export const useActiveCall = () => {
  const [activeCall, setActiveCall] = useState(null);
  const [uiMode, setUiMode] = useState('hidden');

  const refresh = useCallback(async () => {
    const liveCalls = await db.messages
      .where('type')
      .equals('call')
      .filter((message) => (
        message.metadata?.status === 'ringing'
        || message.metadata?.status === 'active'
      ))
      .toArray();

    const latest = liveCalls.sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    )[0] || null;

    if (!latest) {
      setActiveCall(null);
      setUiMode('hidden');
      return;
    }

    const [chat, character] = await Promise.all([
      db.chats.get(latest.chatId),
      db.characters.get(latest.characterId),
    ]);

    setActiveCall({ message: latest, chat, character });

    // 通话是新出现的（之前没有）就默认全屏展示；已经在悬浮球状态
    // 就保持悬浮球,不要每次消息更新都把它弹回全屏。
    setUiMode((previous) => (previous === 'hidden' ? 'fullscreen' : previous));
  }, []);

  useEffect(() => {
    void refresh();

    const handleChanged = () => {
      void refresh();
    };

    const handleOpenOverlay = () => {
      setUiMode('fullscreen');
    };

    window.addEventListener('call-state-changed', handleChanged);
    window.addEventListener('call-overlay-open', handleOpenOverlay);

    return () => {
      window.removeEventListener('call-state-changed', handleChanged);
      window.removeEventListener('call-overlay-open', handleOpenOverlay);
    };
  }, [refresh]);

  return {
    activeCall,
    uiMode,
    minimize: () => setUiMode('bubble'),
    expand: () => setUiMode('fullscreen'),
  };
};

export default useActiveCall;
