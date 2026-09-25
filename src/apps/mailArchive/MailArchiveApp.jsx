// src/apps/mailArchive/MailArchiveApp.jsx
//
// 「信件存档」：伴侣信盒的完整历史。首页的信盒现在只露出最新一封 +
// 所有未读的，其余全部信件都在这里，按时间倒序排列。
//
// 这一版是纯功能占位：视觉上先用跟首页信盒一样的卡片样式铺开，方便
// 现在就能用（读、标记已读、删除都跟首页共用同一张 db.homeBoard 表，
// 互相会同步）。等确定了具体想要的视觉方向（比如按角色分组的对话列表，
// 或者"信件漂在海里，点开才捞起来"那种概念）之后，再单独重做这个页面
// 的样式，不影响这里已经能用的功能。
//
// 页面结构照抄 memory.css / hourglass.css 那一套（根容器 min-height:
// 100vh + 内容居中限宽），不用 h-[100dvh] + 内部单独滚动区域的写法。

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Inbox, Trash2, CheckCircle2 } from 'lucide-react';
import db from '../../db';
import { ConfirmModal } from '../../components/ConfirmModal';
import './mailArchive.css';

export const MailArchiveApp = ({ onBackHub }) => {
  const [messages, setMessages] = useState([]);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    try {
      const list = await db.homeBoard.orderBy('timestamp').reverse().toArray();
      setMessages(list);
    } catch (err) {
      console.error('Failed to load homeBoard messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await db.homeBoard.update(id, { isRead: true });
      loadMessages();
    } catch (err) {
      console.error('Failed to mark message as read:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await db.homeBoard.delete(deletingId);
      setDeletingId(null);
      loadMessages();
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  return (
    <div className="mail-archive-app">
      <div className="mail-archive-section">
        <header className="mail-archive-header">
          <button type="button" onClick={onBackHub} className="mail-archive-back-button">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>返回主页</span>
          </button>

          <div className="mail-archive-header-mark">
            <Inbox className="h-4 w-4" />
            <span className="mail-archive-kicker">ALL LETTERS</span>
          </div>
        </header>

        <section className="mail-archive-intro">
          <p className="mail-archive-eyebrow">ARCHIVE</p>
          <h1>信件存档</h1>
          <p className="mail-archive-intro-text">
            伴侣写来的每一封信，都留在这里。首页只露出最新和未读的，
            其余的可以随时回来翻看。
          </p>
        </section>

        {isLoading ? null : messages.length === 0 ? (
          <div className="mail-archive-empty">
            这里还没有信件。
            <br />
            伴侣写来的信会按时间留在这里。
          </div>
        ) : (
          <div className="mail-archive-list">
            {messages.map((item) => {
              const isLong = item.content && item.content.length > 90;
              const isCardOpen = expandedCardId === item.id;
              const formattedTime = item.timestamp
                ? new Date(item.timestamp).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '刚刚';

              return (
                <div
                  key={item.id}
                  className={`mail-archive-card ${item.isRead ? 'is-read' : 'is-unread'}`}
                >
                  {!item.isRead && <div className="mail-archive-card__dot" />}

                  <div className="mail-archive-card__top">
                    <div className="mail-archive-card__who">
                      {item.avatar ? (
                        <img
                          src={item.avatar}
                          alt={item.characterName}
                          className="mail-archive-card__avatar"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="mail-archive-card__avatar mail-archive-card__avatar--fallback">
                          {item.characterName ? item.characterName[0] : 'C'}
                        </div>
                      )}
                      <div className="mail-archive-card__meta">
                        <h4>{item.characterName}</h4>
                        <span>{formattedTime}</span>
                      </div>
                    </div>

                    <div className="mail-archive-card__actions">
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(item.id, e)}
                          title="标记为已读"
                          className="mail-archive-card__action-btn"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeletingId(item.id)}
                        title="删除留言"
                        className="mail-archive-card__action-btn mail-archive-card__action-btn--delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="mail-archive-card__content">
                    "{isLong && !isCardOpen ? `${item.content.slice(0, 90)}...` : item.content}"
                  </p>

                  {isLong && (
                    <button
                      type="button"
                      onClick={() => setExpandedCardId(isCardOpen ? null : item.id)}
                      className="mail-archive-card__toggle"
                    >
                      {isCardOpen ? '收起全文' : '查看完整随笔'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(deletingId)}
        title="彻底删除随笔"
        message="确认要彻底删除这条伴侣留言吗？此操作无法撤销。"
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};

export default MailArchiveApp;