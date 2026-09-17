import React, { useEffect, useState } from 'react';

import { getCompanionshipStats } from '../services/almanacCompanionshipStatsService';

export const AlmanacCompanionshipCard = ({ chatId }) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    if (!chatId) {
      setStats(null);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);

    getCompanionshipStats(chatId)
      .then((result) => {
        if (active) {
          setStats(result);
        }
      })
      .catch((error) => {
        console.error('[Almanac] 读取陪伴统计失败：', error);

        if (active) {
          setStats(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [chatId]);

  if (isLoading) {
    return (
      <div className="almanac-companionship-card almanac-companionship-loading">
        <span className="almanac-loading-dot" />
        正在计算陪伴的痕迹
      </div>
    );
  }

  if (!stats || stats.totalMessageCount === 0) {
    return (
      <div className="almanac-companionship-card almanac-companionship-empty">
        还没有足够的相处记录，慢慢来。
      </div>
    );
  }

  return (
    <div className="almanac-companionship-card">
      <div className="almanac-companionship-stat">
        <strong>{stats.daysTogether}</strong>
        <span>天的相识</span>
      </div>

      <div className="almanac-companionship-stat">
        <strong>{stats.totalMessageCount}</strong>
        <span>句留下的话</span>
      </div>

      {stats.funFact && (
        <p className="almanac-companionship-funfact">
          {stats.funFact.text}
        </p>
      )}
    </div>
  );
};

export default AlmanacCompanionshipCard;