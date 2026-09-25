import React, { useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { Building, MonumentDefs, getPalette, useIsDarkTheme } from './almanacMonumentArt';

/*
 * 点亮详情：从底部弹出的面板。
 * 只写事实（日期、时间、相识第几天），不放任何 AI 写的句子。
 */

const periodOf = (hour) => {
  if (hour < 5) return '凌晨';
  if (hour < 11) return '早上';
  if (hour < 13) return '中午';
  if (hour < 18) return '下午';
  return '晚上';
};

const formatWhen = (timestamp, timeZone, withTime) => {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(timestamp));

    const get = (type) => parts.find((part) => part.type === type)?.value;
    const hour = Number(get('hour')) % 24;
    const date = `${get('month')}月${get('day')}日`;

    if (!withTime) return date;

    const shown = hour > 12 ? hour - 12 : hour;
    return `${date} ${periodOf(hour)} ${shown}:${get('minute')}`;
  } catch {
    return '';
  }
};

const factFor = (node) => {
  if (!node.lit) return node.hint;

  if (node.type === 'days') return `这一天是你们相识的第 ${node.threshold} 天。`;
  if (node.type === 'messages') return `这一天，你们的对话累计到了第 ${node.threshold} 条。`;
  if (node.type === 'streak') return `从这一天起，你们已经连续 ${node.threshold} 天都有聊天。`;
  if (node.type === 'first_night') return '这一天过了 0 点，你还在这里。';

  return '';
};

const kickerFor = (node) => {
  if (node.type === 'first_night') return 'FIRST TIME';
  if (node.type === 'days') return 'DAYS TOGETHER';
  if (node.type === 'messages') return 'MESSAGES';
  if (node.type === 'streak') return 'STREAK';
  return 'MILESTONE';
};

export const AlmanacMilestoneSheet = ({ node, timeZone, effects, onClose }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const isDark = useIsDarkTheme();
  const pal = useMemo(() => getPalette(isDark), [isDark]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!node) return null;

  const showTime = node.type !== 'days';

  return createPortal(
    <div className="ams-backdrop" onClick={onClose}>
      <div
        className="ams-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={node.title}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="ams-grip" aria-hidden="true" />

        <div className="ams-art" aria-hidden="true">
          <svg width="240" height="210" viewBox="-120 -150 240 210" style={{ overflow: 'visible' }}>
            <MonumentDefs uid={uid} isDark={isDark} />
            {effects && node.lit && (
              <ellipse cx="0" cy="-10" rx="180" ry="110" fill={`url(#halo${uid})`} />
            )}
            <g transform="scale(2.3)">
              <g filter={node.lit && effects ? `url(#glow${uid})` : undefined}>
                <Building kind={node.building} x={0} y={0} lit={node.lit} pal={pal} uid={uid} effects={effects} />
              </g>
            </g>
          </svg>
        </div>

        <div className="ams-body">
          <p className="ams-kicker">{kickerFor(node)}</p>
          <h3 className="ams-title">{node.title}</h3>

          {node.lit && node.unlockedAt && (
            <div className="ams-pills">
              <span>{formatWhen(node.unlockedAt, timeZone, showTime)}</span>
              {node.unlockedDay ? <span>相识的第 {node.unlockedDay} 天</span> : null}
            </div>
          )}

          <p className="ams-fact">{factFor(node)}</p>
        </div>

        <button type="button" className="ams-close" onClick={onClose}>
          回到路上
        </button>
      </div>
    </div>,
    document.body
  );
};

export default AlmanacMilestoneSheet;