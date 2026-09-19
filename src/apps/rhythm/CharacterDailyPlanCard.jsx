import { useEffect, useRef, useState } from 'react';
import db from '../../db';
import {
  getTodayDailyPlan,
  generateDailyPlanIfNeeded,
  maybeGenerateCharacterMurmur,
  getCurrentPeriodIndex
} from '../../services/characterDailyPlanService';

/**
 * "今日安排"：角色在这个聊天窗里对今天的大致想法，独立于用户的
 * 真实课表，只在 Rhythm App 里作为一个小小的趣味模块展示。
 *
 * 按聊天窗（chatId）绑定，而不是按角色：同一个角色如果挂在多个
 * 聊天窗下，每个聊天窗会各自拥有一份独立的"今日安排"，
 * 更贴近"平行的关系线各自有各自的今天"这种感觉。
 *
 * 视觉上延续 RhythmApp 已有的纸质/时光感——复用同一套
 * CSS 变量（--rhythm-serif、--rhythm-mono、--rhythm-spring、
 * --rhythm-elastic）和入场动效关键帧命名习惯，
 * 不引入新的动效语言。
 */
export default function CharacterDailyPlanCard({ chatId }) {
  const [plan, setPlan] = useState(null);
  const [chatTitle, setChatTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const checkedChatIdRef = useRef(null);

  useEffect(() => {
    if (!chatId) {
      setPlan(null);
      setChatTitle('');
      return;
    }

    if (checkedChatIdRef.current === chatId) {
      return;
    }

    checkedChatIdRef.current = chatId;

    let cancelled = false;

    const load = async () => {
      const chat = await db.chats.get(chatId);

      if (!cancelled) {
        setChatTitle(chat?.title || '');
      }

      const existing = await getTodayDailyPlan(chatId);

      if (cancelled) return;

      if (existing) {
        setPlan(existing);
      } else {
        setIsLoading(true);

        const result = await generateDailyPlanIfNeeded(chatId);

        if (!cancelled) {
          if (result?.plan) {
            setPlan(result.plan);
          }
          setIsLoading(false);
        }
      }

      // 碎碎念是否生成由冷却时间和是否已有安排共同决定，
      // 这里只是给它一个"检查一次"的机会，不代表一定会写入新内容。
      const murmurResult = await maybeGenerateCharacterMurmur(chatId);

      if (!cancelled && murmurResult?.status === 'success') {
        const refreshed = await getTodayDailyPlan(chatId);

        if (!cancelled && refreshed) {
          setPlan(refreshed);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  if (!chatId) {
    return null;
  }

  const currentPeriodIndex = getCurrentPeriodIndex(new Date().getHours());

  return (
    <div className="rhythm-daily-plan mb-5">
      <style>{`
        .rhythm-daily-plan {
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 14px 16px 16px;
          background: var(--control-soft-bg);
          animation: rhythm-rise .5s var(--rhythm-spring) both;
        }

        .rhythm-daily-plan__eyebrow {
          font-family: var(--rhythm-mono);
          font-size: 9px;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: var(--text-sub);
          margin-bottom: 2px;
        }

        .rhythm-daily-plan__header-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }

        .rhythm-daily-plan__title {
          font-family: var(--rhythm-serif);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main);
        }

        .rhythm-daily-plan__chat-tag {
          font-family: var(--rhythm-mono);
          font-size: 9px;
          color: var(--text-sub);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 40%;
        }

        .rhythm-daily-plan__loading {
          font-size: 11px;
          color: var(--text-sub);
          padding: 6px 0;
        }

        .rhythm-daily-plan__timeline {
          position: relative;
          padding-left: 18px;
        }

        .rhythm-daily-plan__timeline::before {
          content: '';
          position: absolute;
          left: 4px;
          top: 6px;
          bottom: 6px;
          width: 1px;
          background: var(--card-border);
        }

        .rhythm-daily-plan__item {
          position: relative;
          padding-bottom: 14px;
          opacity: 0;
          animation: rhythm-fade-in .45s var(--rhythm-spring) forwards;
        }

        .rhythm-daily-plan__item:last-child {
          padding-bottom: 0;
        }

        .rhythm-daily-plan__dot {
          position: absolute;
          left: -18px;
          top: 4px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--card-border);
          transition: transform .35s var(--rhythm-elastic), background-color .35s;
        }

        .rhythm-daily-plan__item--current .rhythm-daily-plan__dot {
          background: var(--accent-color);
          transform: scale(1.25);
        }

        .rhythm-daily-plan__item--past {
          opacity: .5 !important;
        }

        .rhythm-daily-plan__period {
          font-family: var(--rhythm-mono);
          font-size: 9px;
          letter-spacing: .14em;
          color: var(--text-sub);
          margin-bottom: 2px;
        }

        .rhythm-daily-plan__item-title {
          font-family: var(--rhythm-serif);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 2px;
        }

        .rhythm-daily-plan__item-blurb {
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--text-sub);
        }

        .rhythm-daily-plan__murmur {
          margin-top: 8px;
          padding: 8px 10px;
          border-radius: 10px;
          background: var(--bg-main);
          border: 1px dashed var(--card-border);
          font-family: var(--rhythm-serif);
          font-style: italic;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--text-main);
          transform: rotate(-.4deg);
          animation: rhythm-ticket-in .5s var(--rhythm-elastic) both;
        }
      `}</style>

      <p className="rhythm-daily-plan__eyebrow">Today, Elsewhere</p>

      <div className="rhythm-daily-plan__header-row">
        <h2 className="rhythm-daily-plan__title">今日安排</h2>
        {chatTitle && (
          <span className="rhythm-daily-plan__chat-tag" title={chatTitle}>
            来自「{chatTitle}」
          </span>
        )}
      </div>

      {isLoading && !plan && (
        <p className="rhythm-daily-plan__loading">正在写下今天的打算……</p>
      )}

      {plan && Array.isArray(plan.items) && plan.items.length > 0 && (
        <div className="rhythm-daily-plan__timeline">
          {plan.items.map((item, index) => {
            const isCurrent = index === currentPeriodIndex;
            const isPast = index < currentPeriodIndex;
            const murmur =
              plan.murmur && plan.murmur.itemId === item.id
                ? plan.murmur
                : null;

            const itemClassName = [
              'rhythm-daily-plan__item',
              isCurrent ? 'rhythm-daily-plan__item--current' : '',
              isPast ? 'rhythm-daily-plan__item--past' : ''
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={item.id}
                className={itemClassName}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="rhythm-daily-plan__dot" />
                <p className="rhythm-daily-plan__period">{item.periodLabel}</p>
                <p className="rhythm-daily-plan__item-title">{item.title}</p>
                <p className="rhythm-daily-plan__item-blurb">{item.blurb}</p>

                {murmur && (
                  <p className="rhythm-daily-plan__murmur">{murmur.text}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}