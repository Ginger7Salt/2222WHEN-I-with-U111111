import React, { useEffect } from 'react';
import { useActiveCall } from '../../../hooks/useActiveCall';
import CallScreen from './CallScreen';
import CallBubble from './CallBubble';
import { startRingtone, stopRingtone } from '../../../services/ringtoneService';

// 挂在 App.jsx 顶层的小宿主组件：只负责"当前有没有通话、该显示
// 全屏还是悬浮球"，具体 UI 都交给 CallScreen / CallBubble。这样
// App.jsx 只需要多一行挂载，不用把通话状态搬进它本来就很大的状态里。
const CallOverlayHost = () => {
  const { activeCall, uiMode, minimize, expand } = useActiveCall();

  const callMessageId = activeCall?.message?.id;
  const status = activeCall?.message?.metadata?.status;
  const direction = activeCall?.message?.metadata?.direction;

  // 铃声只认"响铃中 + 角色打进来"这一种状态，跟全屏/悬浮球这个
  // UI 形态无关——缩成悬浮球接听前依然要能听见铃声在响。
  // 依赖项里特意不放 activeCall.character 本身：铃声现在存的是 Blob，
  // 每次从 Dexie 读出角色记录都会拿到一个新的 Blob 引用，如果拿它做
  // 依赖，只要 useActiveCall 刷新一次（哪怕这通电话什么都没变），
  // 这个 effect 就会重新触发、把铃声从头打断重播一遍。用这通电话
  // 自己的 messageId 才是"这通电话有没有变"的正确信号。
  useEffect(() => {
    const shouldRing = status === 'ringing' && direction === 'incoming';

    if (shouldRing) {
      startRingtone(activeCall?.character);
    } else {
      stopRingtone();
    }

    return () => {
      stopRingtone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callMessageId, status, direction]);

  if (!activeCall) return null;

  if (uiMode === 'bubble') {
    return <CallBubble character={activeCall.character} onExpand={expand} />;
  }

  return <CallScreen call={activeCall} onMinimize={minimize} />;
};

export default CallOverlayHost;