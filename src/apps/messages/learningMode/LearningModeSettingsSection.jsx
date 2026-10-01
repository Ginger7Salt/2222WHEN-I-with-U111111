// src/apps/messages/learningMode/LearningModeSettingsSection.jsx
//
// 聊天设置里的"语言学习模式"区块：开关 + 角色回应语言 + 翻译语言 +
// 三档难度。四个字段都是 chats 表上新增的无索引字段（learningModeEnabled /
// learningReplyLanguage / learningTranslateLanguage / learningLevel），
// 不需要升级 db.version。
//
// 写法照抄 AwaySettingsSection.jsx：自己持有状态、自己读写 db.chats，
// 通过 onUpdated 通知外层 ChatSettingsModal 去重新拉取 chat（外层传的
// 就是 onUpdatedUserPersona，它自己会 loadChatData，不需要这里关心）。
import React, { useState } from 'react';
import { Languages } from 'lucide-react';
import db from '../../../db';
import {
  LEARNING_MODE_LANGUAGES,
  LEARNING_MODE_LEVELS,
  DEFAULT_LEARNING_LEVEL,
} from './learningModeOptions';

export const LearningModeSettingsSection = ({ chat, onUpdated }) => {
  const [isBusy, setIsBusy] = useState(false);

  const enabled = chat?.learningModeEnabled === true;
  const replyLanguage = chat?.learningReplyLanguage || '';
  const translateLanguage = chat?.learningTranslateLanguage || '';
  const level = chat?.learningLevel || DEFAULT_LEARNING_LEVEL;

  const commit = async (fields) => {
    if (!chat?.id || isBusy) return;

    setIsBusy(true);

    try {
      await db.chats.update(chat.id, fields);
      if (onUpdated) onUpdated(fields);
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggle = () => {
    // 关闭开关时不清空已经选好的语言/难度，下次重新打开还在，不用再选一遍。
    void commit({ learningModeEnabled: !enabled });
  };

  return (
    <div
      className="space-y-2.5 p-3.5 rounded-2xl border w-full"
      style={{
        background: 'var(--control-soft-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold">
          <Languages className="w-3.5 h-3.5" />
          <span>语言学习模式</span>
        </div>
        <span className="font-mono text-[9px] opacity-45">
          LEARNING MODE
        </span>
      </div>

      <p className="text-[10px] opacity-55 leading-relaxed">
        开启后，角色会用你选的语言回复，每条消息下面会带一条折叠的翻译，
        点一下展开查看。只影响这一个聊天窗。
      </p>

      <button
        type="button"
        onClick={handleToggle}
        disabled={isBusy}
        className="w-full flex items-center justify-between p-2.5 rounded-xl border transition-all active:scale-95"
        style={{
          background: enabled ? 'var(--accent-color)' : 'var(--bg-main)',
          borderColor: enabled ? 'var(--accent-color)' : 'var(--divider)',
          color: enabled ? 'var(--accent-foreground)' : 'var(--text-main)',
        }}
      >
        <span className="text-[12px] font-medium">
          {enabled ? '已开启' : '已关闭'}
        </span>
        <span
          className="block w-9 h-5 rounded-full relative transition-colors"
          style={{
            background: enabled ? 'var(--accent-foreground)' : 'var(--divider)',
            opacity: enabled ? 0.9 : 0.6,
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              background: enabled ? 'var(--accent-color)' : 'var(--bg-main)',
              transform: enabled ? 'translateX(16px)' : 'translateX(0)',
            }}
          />
        </span>
      </button>

      {enabled && (
        <div className="space-y-2.5 pt-1">
          <div>
            <p className="text-[10px] opacity-55 mb-1">角色回应语言</p>
            <select
              value={replyLanguage}
              disabled={isBusy}
              onChange={(e) => commit({ learningReplyLanguage: e.target.value })}
              className="w-full p-2 rounded-lg border text-[12px]"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--divider)',
                color: 'var(--text-main)',
              }}
            >
              <option value="">请选择语言</option>
              {LEARNING_MODE_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.label}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[10px] opacity-55 mb-1">翻译成什么语言</p>
            <select
              value={translateLanguage}
              disabled={isBusy}
              onChange={(e) => commit({ learningTranslateLanguage: e.target.value })}
              className="w-full p-2 rounded-lg border text-[12px]"
              style={{
                background: 'var(--bg-main)',
                borderColor: 'var(--divider)',
                color: 'var(--text-main)',
              }}
            >
              <option value="">请选择语言</option>
              {LEARNING_MODE_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.label}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[10px] opacity-55 mb-1">难度</p>
            <div className="grid grid-cols-3 gap-2">
              {LEARNING_MODE_LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => commit({ learningLevel: lvl.id })}
                  className="p-2 rounded-xl border text-center font-medium transition-all text-[11px] active:scale-95"
                  style={{
                    background: level === lvl.id ? 'var(--accent-color)' : 'var(--bg-main)',
                    borderColor: level === lvl.id ? 'var(--accent-color)' : 'var(--divider)',
                    color: level === lvl.id ? 'var(--accent-foreground)' : 'var(--text-main)',
                  }}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {(!replyLanguage || !translateLanguage) && (
            <p className="text-[10px]" style={{ color: 'var(--text-sub)' }}>
              角色回应语言和翻译语言都选好之后，学习模式才会真的在回复里生效。
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LearningModeSettingsSection;