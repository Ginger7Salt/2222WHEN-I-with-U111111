// src/apps/hourglass/HourglassApp.jsx
//
// 「信号沙漏」：一个只给自己看的极简仪表盘，汇总最近这段时间里，主聊天
// 到底发生过多少次模型请求、成没成功，以及聊天过程里用过哪些 MCP 工具。
//
// 两类数据来源不一样：
// - 主聊天模型请求：来自新表 apiCallLogs（见 apiCallLogService.js），
//   这里才开始记录，之前发生过的没有历史数据。
// - MCP 工具调用：不是新记的，直接读现有 messages 表里已经存在的
//   metadata.mcpTrace（聊天界面"用了xx工具"提示用的就是这份数据），
//   这里只是把它们汇总展示出来。
//
// 「清空记录」只清 apiCallLogs 这张新表，不会动 messages，更不会影响
// 任何聊天记录本身。
//
// 页面结构照抄 memory.css / MemoryApp.jsx 那一套（根容器 min-height:
// 100vh + 内容居中限宽），不用 h-[100dvh] + 内部单独滚动区域的写法——
// 后者嵌在 Hub 的 currentApp 容器里撑不满整页。

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Hourglass } from 'lucide-react';

import db from '../../db';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  DEFAULT_RETENTION_DAYS,
  RETENTION_DAY_OPTIONS,
  clearApiCallLogs,
  getApiCallLogs,
  getRetentionDays,
  pruneApiCallLogs,
  setRetentionDays,
} from '../../services/apiCallLogService';
import './hourglass.css';

const HourglassGlyph = () => (
  <div className="hourglass-glyph" aria-hidden="true">
    <div className="hourglass-glyph__bulb hourglass-glyph__bulb--top" />
    <div className="hourglass-glyph__bulb hourglass-glyph__bulb--bottom" />
    <div className="hourglass-glyph__frame" />
    <span className="hourglass-glyph__grain" />
    <span className="hourglass-glyph__grain" />
  </div>
);

const formatTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isSameDay = (isoA, isoB) => {
  if (!isoA || !isoB) return false;
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

// 把 messages 表里带 metadata.mcpTrace 的消息，摊平成一条条独立的
// "工具调用"记录，方便跟主聊天日志合并在同一条时间线里展示。
const flattenMcpCalls = (messages) => {
  const rows = [];

  messages.forEach((message) => {
    const calls = message?.metadata?.mcpTrace?.calls;
    if (!Array.isArray(calls) || calls.length === 0) return;

    calls.forEach((call) => {
      rows.push({
        kind: 'mcp',
        id: `mcp_${call.id || `${message.id}_${call.toolName}`}`,
        chatId: message.chatId,
        characterId: message.characterId,
        timestamp: call.startedAt || message.timestamp,
        title: call.toolLabel || call.toolName || 'MCP 工具',
        meta: call.connectionName || '外接能力',
        status: call.status === 'success' ? 'success' : 'error',
        latencyMs:
          call.startedAt && call.completedAt
            ? new Date(call.completedAt).getTime() -
              new Date(call.startedAt).getTime()
            : null,
      });
    });
  });

  return rows;
};

export const HourglassApp = ({ onBackHub }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [chatLogs, setChatLogs] = useState([]);
  const [mcpRows, setMcpRows] = useState([]);
  const [characterNameById, setCharacterNameById] = useState(new Map());
  const [chatTitleById, setChatTitleById] = useState(new Map());
  const [retentionDays, setRetentionDays_] = useState(DEFAULT_RETENTION_DAYS);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const loadAll = async () => {
    setIsLoading(true);

    await pruneApiCallLogs();
    const days = await getRetentionDays();
    setRetentionDays_(days);

    const cutoff = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [logs, recentMessages, chats, characters] = await Promise.all([
      getApiCallLogs(),
      db.messages.where('timestamp').above(cutoff).toArray(),
      db.chats.toArray(),
      db.characters.toArray(),
    ]);

    setChatLogs(logs);
    setMcpRows(flattenMcpCalls(recentMessages));
    setChatTitleById(new Map(chats.map((chat) => [chat.id, chat.title])));
    setCharacterNameById(
      new Map(characters.map((character) => [character.id, character.name])),
    );

    setIsLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickRetention = async (days) => {
    await setRetentionDays(days);
    await loadAll();
  };

  const handleClear = async () => {
    await clearApiCallLogs();
    setConfirmingClear(false);
    await loadAll();
  };

  const rows = useMemo(() => {
    const chatRows = chatLogs.map((log) => ({
      kind: 'chat',
      id: `chat_${log.id}`,
      chatId: log.chatId,
      characterId: log.characterId,
      timestamp: log.timestamp,
      title: log.model || '主聊天',
      meta: log.host || '',
      status: log.status,
      latencyMs: log.latencyMs,
    }));

    return [...chatRows, ...mcpRows].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [chatLogs, mcpRows]);

  const todayCount = useMemo(
    () => rows.filter((row) => isSameDay(row.timestamp, new Date().toISOString())).length,
    [rows],
  );

  const nameForRow = (row) => {
    const chatTitle = chatTitleById.get(row.chatId);
    if (chatTitle) return chatTitle;
    const characterName = characterNameById.get(row.characterId);
    return characterName || '未知聊天';
  };

  return (
    <div className="hourglass-app">
      <div className="hourglass-section">
        <header className="hourglass-header">
          <button
            type="button"
            onClick={onBackHub}
            className="hourglass-back-button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>返回主页</span>
          </button>

          <div className="hourglass-header-mark">
            <Hourglass className="h-4 w-4" />
            <span className="hourglass-kicker">SIGNAL LOG</span>
          </div>
        </header>

        <section className="hourglass-intro">
          <p className="hourglass-eyebrow">HOURGLASS</p>
          <h1>信号沙漏</h1>
          <p className="hourglass-intro-text">
            主聊天用了哪个模型、成没成功，聊天里又用过哪些 MCP 工具，
            都安静地落在这里。
          </p>
        </section>

        <div className="hourglass-summary-card">
          <HourglassGlyph />

          <div className="hourglass-stats">
            <div className="hourglass-stat-pill">
              <span className="num">{todayCount}</span>
              <span className="label">今日信号</span>
            </div>
            <div className="hourglass-stat-pill">
              <span className="num">{rows.length}</span>
              <span className="label">最近 {retentionDays} 天</span>
            </div>
          </div>
        </div>

        <div className="hourglass-retention-row">
          {RETENTION_DAY_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => handlePickRetention(days)}
              className={`hourglass-retention-option ${
                days === retentionDays ? 'is-active' : ''
              }`}
            >
              {days}天
            </button>
          ))}
        </div>

        {isLoading ? null : rows.length === 0 ? (
          <div className="hourglass-empty">
            这段时间还没有信号需要被记下。
            <br />
            主聊天发生请求、或用到 MCP 工具时，会落在这里。
          </div>
        ) : (
          <div className="hourglass-list">
            {rows.map((row) => (
              <div key={row.id} className="hourglass-row">
                <span
                  className={`hourglass-row__dot ${
                    row.status === 'success' ? 'is-success' : 'is-error'
                  }`}
                />
                <div className="hourglass-row__body">
                  <div className="hourglass-row__title">
                    {nameForRow(row)} · {row.title}
                  </div>
                  <div className="hourglass-row__meta">
                    {row.kind === 'chat' ? '主聊天' : 'MCP 工具'}
                    {row.meta ? ` · ${row.meta}` : ''}
                    {Number.isFinite(row.latencyMs)
                      ? ` · ${(row.latencyMs / 1000).toFixed(1)}s`
                      : ''}
                  </div>
                </div>
                <span className="hourglass-row__time">
                  {formatTime(row.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}

        {chatLogs.length > 0 && (
          <div className="hourglass-clear-row">
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="hourglass-clear-button"
            >
              清空主聊天调用记录
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmingClear}
        title="清空调用记录"
        message="只会清掉这份沙漏自己记的主聊天请求记录，不会影响任何聊天消息本身。确定要清空吗？"
        confirmText="清空"
        cancelText="取消"
        onConfirm={handleClear}
        onCancel={() => setConfirmingClear(false)}
      />
    </div>
  );
};

export default HourglassApp;