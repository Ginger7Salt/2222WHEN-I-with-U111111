import React from 'react';

const formatStatValue = (value) => {
  if (value === null || value === undefined) {
    return '0';
  }

  return String(value);
};

export const AlmanacObservation = ({
  stats = {},
  rhythmObservation,
}) => {
  const statItems = [
    {
      key: 'active-days',
      value: stats.activeDays,
      label: '个有记录的日子',
    },
    {
      key: 'user-messages',
      value: stats.userMessageCount,
      label: '条消息痕迹',
    },
    {
      key: 'chat-opens',
      value: stats.chatOpenCount,
      label: '次回来',
    },
  ];

  // 注意：这里不再渲染自己的标题（原来的 "A QUIET RECORD / 这里留下过"）。
  // 外层 AlmanacApp.jsx 的 almanac-record-heading 已经渲染了同一个标题，
  // 两处重复会导致页面上出现两次一样的文字。标题统一交给外层容器负责。

  return (
    <section className="almanac-panel almanac-observation-panel">
      <div
        className="almanac-stat-grid"
        aria-label="Almanac 记录统计"
      >
        {statItems.map((item) => (
          <div
            key={item.key}
            className="almanac-stat-card"
          >
            <strong className="almanac-stat-value">
              {formatStatValue(item.value)}
            </strong>

            <span className="almanac-stat-label">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {rhythmObservation?.enabled && (
        <div className="almanac-observation-note">
          <p className="almanac-eyebrow">
            RHYTHM OBSERVATION
          </p>

          {rhythmObservation.ready ? (
            <>
              <p className="almanac-observation-message">
                {rhythmObservation.message}
              </p>

              <small className="almanac-observation-meta">
                基于{' '}
                <strong>
                  {rhythmObservation.sampleDays}
                </strong>{' '}
                天记录，置信度约为{' '}
                <strong>
                  {Math.round(
                    rhythmObservation.confidence * 100,
                  )}
                  %
                </strong>
                。
              </small>
            </>
          ) : (
            <p className="almanac-observation-message">
              {rhythmObservation.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default AlmanacObservation;