// src/apps/messages/interactions/halloween/SpiderEgg.jsx
//
// 蜘蛛彩蛋：新消息气泡渲染出来的瞬间，有一个很小的概率从气泡顶部垂丝
// 爬下来，晃一下再收回去，不需要打关键词、纯随机。只在消息"新鲜"（刚
// 在这个聊天窗打开期间发生，不是翻旧记录翻到的）时才有机会抽中，而且
// 只抽一次——用 useRef 守一下，避免同一条消息因为父组件重渲染反复
// 重新抽奖，抽中了却又在下一次渲染里"抽没了"导致蜘蛛忽隐忽现。

import React, { useEffect, useRef, useState } from 'react';

import { isHalloweenSeasonActive } from './halloweenSeason';
import './halloween.css';

const RECENT_WINDOW_MS = 8000;
const SPIDER_PROBABILITY = 0.035;

const SpiderEgg = ({ message }) => {
  const [show, setShow] = useState(false);
  const rolledRef = useRef(false);

  useEffect(() => {
    if (rolledRef.current || !isHalloweenSeasonActive()) return;

    rolledRef.current = true;

    const timestampMs = new Date(message?.timestamp || 0).getTime();
    const isFresh = Number.isFinite(timestampMs)
      && (Date.now() - timestampMs) < RECENT_WINDOW_MS;

    if (isFresh && Math.random() < SPIDER_PROBABILITY) {
      setShow(true);
    }
    // 只在这个消息气泡组件实例第一次渲染时抽一次奖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  return (
    <div className="hwe-spider-drop hwe-spider-drop--go">
      <svg viewBox="0 0 40 34">
        <use href="#hwe-spider" />
      </svg>
    </div>
  );
};

export default SpiderEgg;