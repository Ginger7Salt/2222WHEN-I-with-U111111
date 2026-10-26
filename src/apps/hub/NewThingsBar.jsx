// src/apps/hub/NewThingsBar.jsx
// 首页「新东西」订阅条：汇总后台自动触发的更新（心情日历判定、小伙伴/角色日记、
// 潮汐贝壳新捞、徽章解锁、和好券到账），不含 DIY小屋新布置和"匹配类"通知，
// 也跟 QuickBoard 自己的未读角标是两件事。纯提醒用完就扔——点一条就物理删除。
// 视觉：收起是一条 52px 的反色胶囊，展开是一张「乐谱」——每条消息是一行歌词，
// 自带一截五线谱+一个音符，新的在最上面最大最亮，往下渐渐变小变淡。
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeBackgroundUpdates,
  getBackgroundUpdates,
  takeBackgroundUpdate,
  takeAllBackgroundUpdates,
} from './newThingsService';
import './newThingsBar.css';

const MOOD_COLOR = { 开心: '#f5b94a', 平静: '#6fc2ae', 难过: '#7b95dc', 惊讶: '#c58be0', 生气: '#ec7a5e' };
const SOURCE_COLOR = { diary: '#7b86f0', cdiary: '#a77fe0', shell: '#2fb9a7', badge: '#e0a526', coupon: '#e8628f' };
const SOURCE_LABEL = { mood: '心情日历', diary: '小伙伴日记', cdiary: '角色日记', shell: '潮汐贝壳', badge: '徽章', coupon: '和好券' };

const colorOf = (item) => {
  if (!item) return 'var(--accent-color)';
  if (item.source === 'mood') return MOOD_COLOR[item.extra?.mood] || 'var(--accent-color)';
  return SOURCE_COLOR[item.source] || 'var(--accent-color)';
};

const ago = (ts) => {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m === 0) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  return `${Math.floor(m / 60)} 小时前`;
};

// 把一段文字拆成「字」数组，用于逐字落下的动画（英文/数字按词拆，其余按字符拆）。
const splitChars = (str) => (String(str || '').match(/[A-Za-z0-9]+|[\s\S]/g) || []);

const Chars = ({ text }) => (
  <>
    {splitChars(text).map((c, i) => (
      // eslint-disable-next-line react/no-array-index-key
      <span className="ntb-ch" style={{ '--n': i }} key={i}>{c}</span>
    ))}
  </>
);

const Eq = ({ seed = 0 }) => {
  const H = [55, 100, 40, 75];
  return (
    <span className="ntb-eq" aria-hidden="true">
      {[0, 1, 2, 3].map((k) => (
        <b key={k} style={{ '--h': `${H[(k + seed) % 4]}%`, '--k': k }} />
      ))}
    </span>
  );
};

const Stars = ({ n = 0 }) => (
  <span className="ntb-stars" aria-hidden="true">
    {[0, 1, 2].map((i) => (i < n ? '★' : <u key={i}>★</u>))}
  </span>
);

const EYES = <path d="M9 10.2h.01M15 10.2h.01" />;
const MOOD_FACE = {
  开心: <path d="M8.3 14c1 1.6 2.2 2.3 3.7 2.3s2.7-.7 3.7-2.3" />,
  平静: <path d="M9 15.2h6" />,
  难过: <path d="M8.6 16.4c.9-1.3 2-1.9 3.4-1.9s2.5.6 3.4 1.9" />,
  惊讶: <circle cx="12" cy="15.4" r="1.6" />,
  生气: <path d="M9 16h6" />,
};
const ANGRY_EYES = <><path d="M7.8 8l3 1.3M16.2 8l-3 1.3" /><path d="M9.2 11.3h.01M14.8 11.3h.01" /></>;

const Icon = ({ item }) => {
  if (item.source === 'mood') {
    const mood = item.extra?.mood;
    return (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        {mood === '生气' ? ANGRY_EYES : EYES}
        {MOOD_FACE[mood] || MOOD_FACE['平静']}
      </svg>
    );
  }
  if (item.source === 'diary') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
        <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
        <path d="M9 8h6" />
      </svg>
    );
  }
  if (item.source === 'cdiary') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M6 3.5h11A1.5 1.5 0 0 1 18.5 5v14a1.5 1.5 0 0 1-1.5 1.5H6z" />
        <path d="M6 3.5v17" />
        <path d="M10.5 12V3.5M10.5 12l1.9-1.4 1.9 1.4V3.5" />
      </svg>
    );
  }
  if (item.source === 'shell') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M12 3.5c4.4 0 8 3.3 8 7.4 0 4.6-3.5 8.3-8 9.6-4.5-1.3-8-5-8-9.6 0-4.1 3.6-7.4 8-7.4z" />
        <path d="M12 20.5V9M8 18.8l4-8.8M16 18.8L12 10" />
      </svg>
    );
  }
  if (item.source === 'coupon') {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M3.5 9V7A1.5 1.5 0 0 1 5 5.5h14A1.5 1.5 0 0 1 20.5 7v2a2.5 2.5 0 0 0 0 5v3a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17v-3a2.5 2.5 0 0 0 0-5z" />
        <path d="M14 8v8" strokeDasharray="1.5 2.5" />
      </svg>
    );
  }
  // badge（以及任何未来新增、还没单独画图标的 source 的兜底样式）
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.6 13.6L7 21l5-2.6 5 2.6-1.6-7.4" />
    </svg>
  );
};

const Row = ({ item, index, fresh, onTake }) => {
  const label = `${SOURCE_LABEL[item.source] || ''} · ${ago(item.createdAt)}`;
  const body = (
    <span className="ntb-body" data-l={label}>
      <span className="ntb-body-label">{label}</span>
      <span className="ntb-t">
        <span><Chars text={item.title} /></span>
        {index === 0 && <em className="ntb-new">最新</em>}
      </span>
      {item.source === 'shell' && (
        <span className="ntb-s"><Stars n={item.extra?.stars || 0} />{item.sub}</span>
      )}
      {(item.source === 'diary' || item.source === 'cdiary') && (
        <span className="ntb-quote">{item.sub}</span>
      )}
      {item.source === 'mood' && (
        <span className="ntb-dots">
          {Object.keys(MOOD_COLOR).map((m) => (
            <i key={m} className={m === item.extra?.mood ? 'is-on' : ''} style={{ '--d': MOOD_COLOR[m] }} />
          ))}
          <span className="ntb-mname">{item.extra?.mood}</span>
        </span>
      )}
      {item.source !== 'shell' && item.source !== 'diary' && item.source !== 'cdiary' && item.source !== 'mood' && (
        <span className="ntb-s"><span className="ntb-rare">NEW</span>{item.sub}</span>
      )}
    </span>
  );

  return (
    <li className="ntb-row" data-i={index % 5} data-p={index % 5} data-g={index % 3}>
      <div className="ntb-row-in">
        <button
          type="button"
          className={`ntb-item${fresh ? ' is-fresh' : ''}`}
          style={{ '--c': colorOf(item), '--i': index % 5 }}
          onClick={(e) => onTake(item.id, e)}
          title="点一下收下这条"
        >
          <span className="ntb-chip" aria-hidden="true"><Icon item={item} /></span>
          {body}
          <span className="ntb-meta">
            <Eq seed={item.id} />
            <span className="ntb-take">收下</span>
          </span>
        </button>
      </div>
    </li>
  );
};

export const NewThingsBar = ({ delay = 260 }) => {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [freshId, setFreshId] = useState(null);
  const [arrive, setArrive] = useState(false);
  const [bump, setBump] = useState(false);

  const openingTimerRef = useRef(null);
  const arriveTimersRef = useRef([]);
  const prevIdsRef = useRef(new Set());
  const loadRunsRef = useRef(0);

  const load = useCallback(async () => {
    const list = await getBackgroundUpdates();
    setItems(list);
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = subscribeBackgroundUpdates(load);
    return unsubscribe;
  }, [load]);

  // 识别"真的有新的一条到达"（而不是因为收下了旧的最新一条，另一条顶上来），
  // 只有前者才放胶囊的到达动效。前两次 effect（挂载时的空数组 + load() 首次返回的初始数据）
  // 只建立基线，不触发动画。
  useEffect(() => {
    loadRunsRef.current += 1;
    const top = items[0];
    if (loadRunsRef.current <= 2) {
      prevIdsRef.current = new Set(items.map((it) => it.id));
      return;
    }
    if (top && !prevIdsRef.current.has(top.id)) {
      setFreshId(top.id);
      setArrive(true);
      setBump(true);
      arriveTimersRef.current.forEach(clearTimeout);
      arriveTimersRef.current = [
        setTimeout(() => setArrive(false), 900),
        setTimeout(() => setBump(false), 520),
        setTimeout(() => setFreshId(null), 1900),
      ];
    }
    prevIdsRef.current = new Set(items.map((it) => it.id));
  }, [items]);

  useEffect(() => () => {
    clearTimeout(openingTimerRef.current);
    arriveTimersRef.current.forEach(clearTimeout);
  }, []);

  const handleToggleOpen = () => {
    if (!items.length) return;
    const next = !open;
    setOpen(next);
    if (next) {
      setOpening(true);
      clearTimeout(openingTimerRef.current);
      openingTimerRef.current = setTimeout(() => setOpening(false), 3400);
    }
  };

  const handleTake = async (id, e) => {
    e.stopPropagation();
    await takeBackgroundUpdate(id);
  };

  const handleTakeAll = async () => {
    await takeAllBackgroundUpdates();
    setOpen(false);
  };

  if (!items.length) return null;

  const top = items[0];

  return (
    <div
      className="ntb-root animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`ntb-ring${arrive ? ' is-arrive' : ''}`} style={{ '--c': colorOf(top) }}>
        <button
          type="button"
          className={`ntb-pill${open ? ' is-open' : ''}`}
          onClick={handleToggleOpen}
          aria-expanded={open}
          aria-controls="ntb-sheet"
        >
          <span className={`ntb-orb${bump ? ' is-flip' : ''}`} aria-hidden="true"><Icon item={top} /></span>
          <span className="ntb-ticker" aria-live="polite">
            <span className="ntb-tk" key={top.id}>
              <span className="ntb-tk-label"><i />{SOURCE_LABEL[top.source]} · {ago(top.createdAt)}</span>
              <span className="ntb-tk-main"><b>{top.title}</b><span>{top.sub}</span></span>
            </span>
          </span>
          <span className={`ntb-count${bump ? ' is-bump' : ''}`}>{items.length}</span>
          <svg className="ntb-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      <div id="ntb-sheet" className={`ntb-sheet${open ? ' is-open' : ''}${opening ? ' is-opening' : ''}`}>
        <div className="ntb-sheet-in">
          <div className="ntb-card">
            <ul className="ntb-rows">
              {items.map((it, i) => (
                <Row key={it.id} item={it} index={i} fresh={it.id === freshId} onTake={handleTake} />
              ))}
            </ul>
            <div className="ntb-foot">
              <p>点一条就收下，不会跳转</p>
              <button type="button" onClick={handleTakeAll}>全部收下</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewThingsBar;