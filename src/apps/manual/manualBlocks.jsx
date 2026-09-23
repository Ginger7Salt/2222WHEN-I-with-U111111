// src/apps/manual/manualBlocks.jsx
//
// 说明书内容块的公共渲染逻辑 + 语言切换的公共 UI/状态读写。
// ManualApp.jsx（设置页里的完整说明书）和 HouseManualModal.jsx（弹层版说明书）
// 共用这一份逻辑，避免同样的东西在两个地方各写一遍、以后改一个忘了改另一个。

import React from 'react';
import { Globe } from 'lucide-react';

import { MANUAL_LANGUAGES, MANUAL_DEFAULT_LANG } from './manualContent';

export const MANUAL_LANG_STORAGE_KEY = 'wiwu-manual-lang';

// 读取上一次选择的说明书语言；拿不到 localStorage（隐私模式等）时安全回退。
export function readStoredManualLang() {
  try {
    const stored = window.localStorage.getItem(MANUAL_LANG_STORAGE_KEY);

    if (stored && MANUAL_LANGUAGES.some((item) => item.code === stored)) {
      return stored;
    }
  } catch (error) {
    // 忽略读取失败（隐私模式 / 存储被禁用），直接回退到默认语言。
  }

  return MANUAL_DEFAULT_LANG;
}

export function storeManualLang(langCode) {
  try {
    window.localStorage.setItem(MANUAL_LANG_STORAGE_KEY, langCode);
  } catch (error) {
    // 存不进去也不影响当次切换，静默忽略即可。
  }
}

// 卡片式条目（对应原来 ManualApp.jsx 里导出的同名组件，保持同一个视觉样式）。
export function ManualItem({ title, description }) {
  return (
    <div className="manual-item">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

// 把 manualContent.js 里某个 section/语言 的 body 块数组渲成实际 JSX。
// 支持的块类型见 manualContent.js 顶部的注释。
export function renderManualBlocks(blocks = []) {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'p':
        return <p key={index}>{block.text}</p>;

      case 'note':
        return (
          <div
            className="manual-note"
            key={index}
          >
            <p>{block.text}</p>
          </div>
        );

      case 'items':
        return (
          <div
            className="space-y-4"
            key={index}
          >
            {block.items.map((item, itemIndex) => (
              <ManualItem
                key={itemIndex}
                title={item.title}
                description={item.text}
              />
            ))}
          </div>
        );

      case 'numbered':
        return (
          <ol
            className="manual-numbered-list"
            key={index}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        );

      default:
        return null;
    }
  });
}

// 顶部固定的三语切换按钮组：中 / EN / 한。两处说明书共用同一套交互和样式类。
export function ManualLanguageSwitch({ lang, onChange, className = '' }) {
  return (
    <div
      className={`manual-lang-switch ${className}`}
      role="group"
      aria-label="切换说明书语言 / Switch manual language"
    >
      <Globe
        className="manual-lang-switch__icon h-3.5 w-3.5"
        strokeWidth={1.6}
        aria-hidden="true"
      />

      {MANUAL_LANGUAGES.map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => onChange(item.code)}
          className={`manual-lang-switch__item ${
            item.code === lang ? 'manual-lang-switch__item--active' : ''
          }`}
          aria-pressed={item.code === lang}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}