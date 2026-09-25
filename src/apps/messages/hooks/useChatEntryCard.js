import { useCallback, useEffect, useState } from 'react';

import db from '../../../db';
import {
  getTodayFestival,
  getGreetingPeriod,
  getGreetingCardContent,
  getLocalDateKey,
} from '../../../services/festivalService';

// 判断"这次进这个聊天窗，要不要弹一张节日/问候卡"，并负责去重——
// 同一个聊天窗、同一天、同一种卡片只弹一次。记录存在
// chat.lastEntryCardShown 里（Dexie 的非索引字段，加它不需要升级
// 数据库版本），每个聊天窗各自独立判断，互不影响。
//
// 节日和问候撞在一起时，节日优先——万圣节当天进聊天窗，先看到的是
// 万圣节卡片，不是早安/晚安卡片。
export default function useChatEntryCard(chat) {
  const [entryCard, setEntryCard] = useState(null);

  useEffect(() => {
    if (!chat?.id) return;

    const todayKey = getLocalDateKey();
    const festival = getTodayFestival();

    let nextCard = null;

    if (festival) {
      nextCard = {
        kind: `festival:${festival.key}`,
        title: festival.title,
        subtitle: festival.subtitle,
        accent: festival.accent,
      };
    } else {
      const period = getGreetingPeriod();
      const content = period ? getGreetingCardContent(period) : null;

      if (content) {
        nextCard = {
          kind: `greeting:${period}`,
          title: content.title,
          subtitle: content.subtitle,
          accent: content.accent,
        };
      }
    }

    if (!nextCard) return;

    const lastShown = chat.lastEntryCardShown;
    const alreadyShownToday = (
      lastShown
      && lastShown.date === todayKey
      && lastShown.kind === nextCard.kind
    );

    if (alreadyShownToday) return;

    setEntryCard(nextCard);

    void db.chats.update(chat.id, {
      lastEntryCardShown: { date: todayKey, kind: nextCard.kind },
    });

    // 只在切换到某个聊天窗时判断一次，不跟着 chat 对象其它字段的变化
    // （比如消息列表刷新）反复重新判断。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  const dismissEntryCard = useCallback(() => {
    setEntryCard(null);
  }, []);

  return { entryCard, dismissEntryCard };
}