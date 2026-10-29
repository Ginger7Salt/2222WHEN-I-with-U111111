// src/apps/greeting/GreetingGiftNotice.jsx
//
// 聊天室里的"礼物小卡片"（消息类型 greeting_gift，见 greetingGift.js）：
// 角色送来的贺卡 / 立体书，点一下就地拆开 / 翻开，不用跳去收藏夹。
// 视觉照 ChatParcelArrivedNotice：居中一张带强调色描边的小卡，右侧箭头。
//
// 打开用的是收藏夹里同一套组件（GreetingUnwrap / PopupBookReader），用 React.lazy 延迟加载，
// 所以聊天室页面本身不会因此变重。样式表也是第一次点开时才加载。
// 卡 / 书可能已经在收藏夹里被删掉：这时小卡片显示"已经不在了"，不会报错。

import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronRight, Mail } from 'lucide-react';

import db from '../../db';
import ConfirmModal from '../../components/ConfirmModal';
import { deleteGreetingCard, markGreetingCardRead } from './greetingService';
import { deletePopupBook, markPopupBookRead } from './popupBookService';
import { BOOK_STATUS } from './popupBookConstants';
import { GREETING_STATUS } from './greetingConstants';
import { GIFT_KIND } from './greetingGift';

const GreetingUnwrap = lazy(() => import('./GreetingUnwrap'));
const PopupBookReader = lazy(() => import('./PopupBookReader'));

const loadItem = async (kind, id) => {
  const row = kind === GIFT_KIND.BOOK ? await db.popupBooks.get(id) : await db.greetingCards.get(id);
  if (!row) return { state: 'gone', row: null };
  const ready = kind === GIFT_KIND.BOOK ? row.status === BOOK_STATUS.READY : row.status === GREETING_STATUS.READY;
  return { state: ready ? 'ready' : 'pending', row };
};

const GreetingGiftNotice = ({ message }) => {
  const kind = message?.metadata?.kind === GIFT_KIND.BOOK ? GIFT_KIND.BOOK : GIFT_KIND.CARD;
  const itemId = message?.metadata?.itemId;
  const title = message?.metadata?.title || '';
  const isBook = kind === GIFT_KIND.BOOK;
  const Icon = isBook ? BookOpen : Mail;

  const [item, setItem] = useState({ state: 'loading', row: null });
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItem(await loadItem(kind, itemId));
    } catch (error) {
      console.warn('读取礼物状态失败：', error);
    }
  }, [kind, itemId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleOpen = async () => {
    const latest = await loadItem(kind, itemId).catch(() => null);
    if (!latest || latest.state !== 'ready') return;
    setItem(latest);
    // 拆封 / 阅读器用到收藏夹的样式；第一次点开时才加载。
    import('./greeting.css').catch(() => {});
    setOpen(true);
  };

  // 打开过之后把这条消息标成"已打开"，角色下一轮聊天时就知道用户看过了。
  const markOpenedOnMessage = useCallback(async () => {
    try {
      if (message?.id == null || message?.metadata?.opened) return;
      await db.messages.update(message.id, { metadata: { ...(message.metadata || {}), opened: true } });
    } catch (error) {
      console.warn('标记礼物已打开失败：', error);
    }
  }, [message]);

  const handleOpened = useCallback(
    (id) => {
      if (isBook) markPopupBookRead(id);
      else markGreetingCardRead(id);
      markOpenedOnMessage();
    },
    [isBook, markOpenedOnMessage],
  );

  const handleClose = () => {
    setOpen(false);
    refresh();
  };

  const handleConfirmDelete = async () => {
    setConfirmDelete(false);
    setOpen(false);
    if (isBook) await deletePopupBook(itemId);
    else await deleteGreetingCard(itemId);
    refresh();
  };

  const gone = item.state === 'gone';
  const noun = isBook ? '立体书' : '贺卡';
  const actionText = isBook ? '点这里翻开看看' : '点这里拆开看看';

  return (
    <>
      <div
        className="mx-auto my-3 w-[calc(100%-1rem)] max-w-[340px] overflow-hidden rounded-[1.75rem] p-4 backdrop-blur-xl transition-all duration-200"
        style={{
          background: 'var(--card-bg-gradient)',
          color: 'var(--text-main)',
          border: gone ? '1px solid var(--divider)' : '1px solid var(--accent-color)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
          opacity: gone ? 0.6 : 1,
        }}
      >
        <button
          type="button"
          disabled={gone}
          onClick={handleOpen}
          className="flex w-full items-center justify-between gap-3 text-left transition-opacity active:opacity-70"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: 'var(--control-soft-bg)', color: 'var(--accent-color)' }}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[13px] leading-relaxed">
                {gone ? `这份${noun}已经不在了` : title ? `${noun}「${title}」` : message?.content || `一份${noun}`}
              </div>
              <div
                className="mt-0.5 flex items-center gap-1.5 text-[12px]"
                style={{ color: gone ? 'var(--text-muted)' : 'var(--accent-color)' }}
              >
                {gone ? (
                  '已从收藏夹里删除'
                ) : (
                  <>
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                        style={{ background: 'var(--accent-color)' }}
                      />
                      <span
                        className="relative inline-flex h-1.5 w-1.5 rounded-full"
                        style={{ background: 'var(--accent-color)' }}
                      />
                    </span>
                    {item.state === 'pending' ? '还在准备' : actionText}
                  </>
                )}
              </div>
            </div>
          </div>

          {!gone && <ChevronRight className="h-5 w-5 shrink-0 opacity-50" />}
        </button>
      </div>

      {open && item.row && (
        <Suspense fallback={null}>
          {isBook ? (
            <PopupBookReader key={item.row.id} book={item.row} onClose={handleClose} onOpened={handleOpened} />
          ) : (
            <GreetingUnwrap
              key={item.row.id}
              card={item.row}
              onClose={handleClose}
              onOpened={handleOpened}
              onDelete={() => setConfirmDelete(true)}
            />
          )}
        </Suspense>
      )}

      {/* 拆封层是 z-index 1200 的全屏层，确认框要叠在它上面 */}
      <div style={{ position: 'relative', zIndex: 1300 }}>
        <ConfirmModal
          isOpen={confirmDelete}
          title={`删除这${isBook ? '本立体书' : '张贺卡'}？`}
          message="删除后就找不回来了。"
          confirmText="删除"
          cancelText="留着"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      </div>
    </>
  );
};

export default GreetingGiftNotice;