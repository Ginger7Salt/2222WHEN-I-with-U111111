import React from 'react';
import { useActiveCall } from '../../../hooks/useActiveCall';
import CallScreen from './CallScreen';
import CallBubble from './CallBubble';

// 挂在 App.jsx 顶层的小宿主组件：只负责"当前有没有通话、该显示
// 全屏还是悬浮球"，具体 UI 都交给 CallScreen / CallBubble。这样
// App.jsx 只需要多一行挂载，不用把通话状态搬进它本来就很大的状态里。
const CallOverlayHost = () => {
  const { activeCall, uiMode, minimize, expand } = useActiveCall();

  if (!activeCall) return null;

  if (uiMode === 'bubble') {
    return <CallBubble character={activeCall.character} onExpand={expand} />;
  }

  return <CallScreen call={activeCall} onMinimize={minimize} />;
};

export default CallOverlayHost;
