// src/apps/manual/TutorialLibrary.jsx
//
// "教程区域"的实际组件：左边一列可点的 tutorial-card，右边是选中教程的
// tutorial-detail 详情面板。样式全部复用 manual.css 里已经写好、之前
// 一直没被任何组件用到的那套 .tutorial-* class。
//
// 内容数据在 tutorialContent.js 里维护；这个文件只管把数据变成 JSX。

import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Info,
  TriangleAlert,
} from 'lucide-react';

import { TUTORIAL_ITEMS } from './tutorialContent';

const TUTORIAL_UI_TEXT = {
  zh: {
    eyebrow: 'DEPLOYMENT GUIDES',
    heading: '教程区域',
    description: '这里放的是需要自己动手部署的技术教程——跨域 Worker、各个 MCP 服务的接入方式等。',
    countLabel: '篇教程',
    navTitle: 'GUIDES',
    copy: '复制',
    copied: '已复制',
    emptyTitle: '选一篇教程看看',
    emptyText: '左边选一个条目，右边会展开对应的部署步骤、代码和检查清单。',
  },
  en: {
    eyebrow: 'DEPLOYMENT GUIDES',
    heading: 'Tutorials',
    description: 'Hands-on technical guides for things you deploy yourself — the CORS worker, and wiring up each MCP service.',
    countLabel: 'guides',
    navTitle: 'GUIDES',
    copy: 'Copy',
    copied: 'Copied',
    emptyTitle: 'Pick a guide to read',
    emptyText: 'Choose an entry on the left to see its steps, code, and checklist on the right.',
  },
  ko: {
    eyebrow: 'DEPLOYMENT GUIDES',
    heading: '튜토리얼',
    description: '직접 배포해야 하는 기술 가이드 모음입니다 — CORS Worker, 각 MCP 서비스 연동 방법 등.',
    countLabel: '개 가이드',
    navTitle: 'GUIDES',
    copy: '복사',
    copied: '복사됨',
    emptyTitle: '가이드를 선택하세요',
    emptyText: '왼쪽에서 항목을 고르면 오른쪽에 단계, 코드, 체크리스트가 나타납니다.',
  },
};

function TutorialCodeBlock({ label, code, copyLabel, copiedLabel }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      // clipboard 不可用（例如非 https、权限被拒）时静默失败，
      // 用户仍然可以在代码块里手动选中复制。
    }
  };

  return (
    <div className="tutorial-code-block">
      <div className="tutorial-code-block__header">
        <span>{label}</span>

        <button
          type="button"
          className="tutorial-code-block__copy"
          onClick={handleCopy}
        >
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>

      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderTutorialBlocks(blocks = [], ui) {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'paragraph':
        return (
          <div
            className="tutorial-block tutorial-block--paragraph"
            key={index}
          >
            {block.heading && <h3>{block.heading}</h3>}
            <p>{block.text}</p>
          </div>
        );

      case 'steps':
        return (
          <div
            className="tutorial-block"
            key={index}
          >
            {block.heading && <h3>{block.heading}</h3>}

            <ol className="tutorial-steps">
              {block.items.map((step, stepIndex) => (
                <li
                  className="tutorial-step"
                  key={stepIndex}
                >
                  <span className="tutorial-step__number">
                    {String(stepIndex + 1).padStart(2, '0')}
                  </span>

                  <div className="tutorial-step__content">
                    <h4>{step.title}</h4>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        );

      case 'code':
        return (
          <TutorialCodeBlock
            key={index}
            label={block.label}
            code={block.code}
            copyLabel={ui.copy}
            copiedLabel={ui.copied}
          />
        );

      case 'checklist':
        return (
          <div
            className="tutorial-block"
            key={index}
          >
            {block.heading && <h3>{block.heading}</h3>}

            <ul className="tutorial-checklist">
              {block.items.map((text, itemIndex) => (
                <li key={itemIndex}>
                  <span className="tutorial-checklist__mark">
                    <Check
                      className="h-3 w-3"
                      strokeWidth={2}
                    />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        );

      case 'callout': {
        const isWarning = block.tone === 'warning';

        return (
          <div
            className={`tutorial-callout ${isWarning ? 'tutorial-callout--warning' : ''}`}
            key={index}
          >
            <span className="tutorial-callout__icon">
              {isWarning ? (
                <TriangleAlert
                  className="h-4 w-4"
                  strokeWidth={1.6}
                />
              ) : (
                <Info
                  className="h-4 w-4"
                  strokeWidth={1.6}
                />
              )}
            </span>

            <div>
              {block.title && <strong>{block.title}</strong>}
              <p>{block.text}</p>
            </div>
          </div>
        );
      }

      case 'note':
        return (
          <p
            className="tutorial-inline-note"
            key={index}
          >
            {block.text}
          </p>
        );

      case 'links':
        return (
          <div
            className="tutorial-links"
            key={index}
          >
            {block.items.map((link, linkIndex) => (
              <a
                className="tutorial-link"
                href={link.href}
                target="_blank"
                rel="noreferrer"
                key={linkIndex}
              >
                <span>{link.label}</span>

                <ArrowUpRight
                  className="h-3.5 w-3.5"
                  strokeWidth={1.6}
                />
              </a>
            ))}
          </div>
        );

      case 'divider':
        return (
          <div
            className="tutorial-divider"
            key={index}
          />
        );

      default:
        return null;
    }
  });
}

export function TutorialLibrary({ lang }) {
  const [activeId, setActiveId] = useState(TUTORIAL_ITEMS[0]?.id ?? null);

  const ui = TUTORIAL_UI_TEXT[lang] || TUTORIAL_UI_TEXT.zh;

  const activeIndex = useMemo(
    () => TUTORIAL_ITEMS.findIndex((item) => item.id === activeId),
    [activeId],
  );

  const activeItem = activeIndex >= 0 ? TUTORIAL_ITEMS[activeIndex] : null;
  const activeText = activeItem ? activeItem.translations[lang] || activeItem.translations.zh : null;
  const ActiveIcon = activeItem?.icon;

  return (
    <div className="tutorial-library">
      <div className="tutorial-library__intro">
        <div>
          <span className="tutorial-library__eyebrow">{ui.eyebrow}</span>
          <h3>{ui.heading}</h3>
          <p>{ui.description}</p>
        </div>

        <div className="tutorial-library__count">
          <strong>{TUTORIAL_ITEMS.length}</strong>
          <span>{ui.countLabel}</span>
        </div>
      </div>

      <div className="tutorial-library__layout">
        <nav className="tutorial-library__nav">
          <div className="tutorial-library__nav-title">{ui.navTitle}</div>

          <div className="tutorial-library__cards">
            {TUTORIAL_ITEMS.map((item, index) => {
              const itemText = item.translations[lang] || item.translations.zh;
              const Icon = item.icon;
              const isActive = item.id === activeId;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`tutorial-card ${isActive ? 'tutorial-card--active' : ''}`}
                >
                  <span className="tutorial-card__number">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span className="tutorial-card__icon">
                    <Icon
                      className="h-4 w-4"
                      strokeWidth={1.5}
                    />
                  </span>

                  <span className="tutorial-card__content">
                    <strong>{itemText.title}</strong>
                    <small>{itemText.description}</small>
                  </span>

                  <ArrowUpRight
                    className="tutorial-card__arrow h-3.5 w-3.5 shrink-0"
                    strokeWidth={1.6}
                  />
                </button>
              );
            })}
          </div>
        </nav>

        <div className="tutorial-library__content">
          {activeItem ? (
            <article
              className={`tutorial-detail tutorial-theme-${activeItem.theme}`}
              key={`${activeItem.id}-${lang}`}
            >
              <header className="tutorial-detail__header">
                <div className="tutorial-detail__eyebrow">
                  <span>{ui.eyebrow}</span>
                  <span>
                    {String(activeIndex + 1).padStart(2, '0')} / {String(TUTORIAL_ITEMS.length).padStart(2, '0')}
                  </span>
                </div>

                <div className="tutorial-detail__identity">
                  <div className="tutorial-detail__icon">
                    <ActiveIcon
                      className="h-5 w-5"
                      strokeWidth={1.4}
                    />
                  </div>

                  <div>
                    <h2>{activeText.title}</h2>
                    <p>{activeText.description}</p>
                  </div>
                </div>
              </header>

              <div className="tutorial-detail__body">
                {renderTutorialBlocks(activeText.blocks, ui)}
              </div>
            </article>
          ) : (
            <div className="tutorial-empty-state">
              <Info
                className="tutorial-empty-state__icon h-6 w-6"
                strokeWidth={1.4}
              />
              <h3>{ui.emptyTitle}</h3>
              <p>{ui.emptyText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TutorialLibrary;