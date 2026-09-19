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

  const status = activeCall?.message?.metadata?.status;
  const direction = activeCall?.message?.metadata?.direction;
  const ringtone = activeCall?.character?.ringtone;

  // 铃声只认"响铃中 + 角色打进来"这一种状态，跟全屏/悬浮球这个
  // UI 形态无关——缩成悬浮球接听前依然要能听见铃声在响。
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
  }, [status, direction, ringtone]);

  if (!activeCall) return null;

  if (uiMode === 'bubble') {
    return <CallBubble character={activeCall.character} onExpand={expand} />;
  }

  return <CallScreen call={activeCall} onMinimize={minimize} />;
};

export default CallOverlayHost;