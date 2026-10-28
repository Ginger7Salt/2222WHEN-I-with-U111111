// src/apps/greeting/greetingNotify.js
//
// 贺卡送到时的提示：站内顶部提示 + （已授权时）系统通知。
//
// 站内提示直接派发 NotificationToast.jsx 监听的 WHEN_I_WITH_U_TOAST 事件，
// 不 import 那个组件——它会反向 import aiService.js，而 aiService.js 会
// （动态）加载贺卡主动送，避免形成循环依赖。事件的 detail 形状要和
// NotificationToast.jsx 里的 triggerGlobalToast 保持一致。

export const announceGreetingReady = (character) => {
  if (typeof window === 'undefined') return;

  const name = character?.name || 'TA';

  window.dispatchEvent(
    new CustomEvent('WHEN_I_WITH_U_TOAST', {
      detail: {
        title: `${name} 送来一张贺卡`,
        content: '去收藏夹拆开看看',
        iconType: 'bell',
        duration: 4000,
      },
    }),
  );

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    new Notification(`${name} 送来一张贺卡`, {
      body: '去收藏夹拆开看看',
      icon: character?.avatar || '/favicon.ico',
      tag: 'greeting-card-ready',
    });
  } catch (error) {
    console.warn('贺卡通知未能显示：', error);
  }
};
