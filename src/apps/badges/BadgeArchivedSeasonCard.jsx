// src/apps/badges/BadgeArchivedSeasonCard.jsx
//
// "往期徽章" tab 用的卡片：赛季已经结束，三个条件的过程不用再展示（已经没有
// 意义——要么当时解锁了、要么没有，现在都只剩"能不能戴"），只展示这一季的
// 图标网格 + 结束标签 + 解锁时间。

import React from 'react';

const formatUnlockedDate = (iso) => {
  if (!iso) return null;

  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  } catch {
    return null;
  }
};

export const BadgeArchivedSeasonCard = ({ season, equippedBadgeId, onEquip }) => {
  const { seasonDef, seasonKey, unlocked, unlockedAt } = season;
  const unlockedDate = formatUnlockedDate(unlockedAt);

  return (
    <section className="badge-season badge-season--archived">
      <div className="badge-season-header">
        <h3>{seasonDef.seasonTitle}</h3>
        <span className="badge-season-key">{seasonKey}</span>
        <span className="badge-season-archived-tag">
          {unlocked ? '已结束，仅可佩戴' : '那个月没有解锁'}
        </span>
      </div>

      {unlocked && unlockedDate && <p className="badge-archived-unlocked-at">当时在 {unlockedDate} 解锁</p>}

      <div className="badge-grid">
        {seasonDef.badges.map((badge) => {
          const isEquipped = equippedBadgeId === badge.id;
          const isLocked = !unlocked;

          return (
            <button
              type="button"
              key={badge.id}
              className={`badge-tile ${isLocked ? 'badge-tile--locked' : ''} ${isEquipped ? 'badge-tile--equipped' : ''}`}
              onClick={() => !isLocked && onEquip(badge.id)}
              disabled={isLocked}
              title={badge.description}
            >
              <span className="badge-tile-image-wrap">
                <img src={badge.imageUrl} alt={badge.title} loading="lazy" />
              </span>
              <span className="badge-tile-title">{badge.title}</span>
              {isEquipped && <span className="badge-tile-equipped-tag">佩戴中</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default BadgeArchivedSeasonCard;