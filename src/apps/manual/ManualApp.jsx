import React, { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';

import {
  MANUAL_SECTIONS,
  MANUAL_UI_TEXT,
} from './manualContent';
import {
  ManualItem,
  ManualLanguageSwitch,
  readStoredManualLang,
  renderManualBlocks,
  storeManualLang,
} from './manualBlocks';
import { TutorialLibrary } from './TutorialLibrary';

// 说明书的文案已经全部搬到 manualContent.js（按 zh / en / ko 三语分层存放）。
// 这个文件只负责：管理"当前选的是哪个语言"这一个状态，然后把对应语言的
// 文案交给 manualBlocks.jsx 里的公共渲染函数变成 JSX。
// 想改文字 —— 改 manualContent.js；想改说明书长什么样 —— 改这个文件。

// 继续导出这两个名字，是因为 HouseManualModal.jsx（弹层版说明书）也在用它们，
// 保持导出不变可以不用去改那边的 import 路径。
export { MANUAL_SECTIONS, ManualItem };

export const ManualApp = ({ onBack }) => {
  const [lang, setLang] = useState(() => readStoredManualLang());
  const [activeSection, setActiveSection] = useState('welcome');

  const handleLangChange = (nextLang) => {
    setLang(nextLang);
    storeManualLang(nextLang);
  };

  const ui = MANUAL_UI_TEXT[lang];

  const currentSection = useMemo(
    () =>
      MANUAL_SECTIONS.find((section) => section.id === activeSection) ||
      MANUAL_SECTIONS[0],
    [activeSection],
  );

  const currentIndex = MANUAL_SECTIONS.indexOf(currentSection);
  const currentText = currentSection.translations[lang];
  const SectionIcon = currentSection.icon;

  return (
    <div className="manual-page">
      <header className="manual-header">
        <button
          type="button"
          onClick={onBack}
          className="manual-back-button"
          aria-label={ui.backAria}
          title={ui.backTitle}
        >
          <ArrowLeft
            className="h-4 w-4"
            strokeWidth={1.7}
          />
        </button>

        <div className="manual-header__title">
          <span>{ui.kicker}</span>
          <h1>{ui.heading}</h1>
        </div>

        <ManualLanguageSwitch
          lang={lang}
          onChange={handleLangChange}
          className="manual-header__lang"
        />

        <div className="manual-header__mark">
          <BookOpen
            className="h-4 w-4"
            strokeWidth={1.5}
          />
        </div>
      </header>

      <section className="manual-intro">
        <p className="manual-intro__eyebrow">{ui.introEyebrow}</p>

        <h2>
          {ui.introTitle[0]}
          <br />
          {ui.introTitle[1]}
        </h2>

        <p>{ui.introText}</p>
      </section>

      <nav
        className="manual-index"
        aria-label={ui.contentsAria}
      >
        <div className="manual-index__label">{ui.contentsLabel}</div>

        <div className="manual-index__list">
          {MANUAL_SECTIONS.map((section, index) => {
            const Icon = section.icon;
            const isActive = section.id === activeSection;
            const sectionText = section.translations[lang];

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`manual-index__item ${
                  isActive ? 'manual-index__item--active' : ''
                }`}
              >
                <span className="manual-index__number">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <Icon
                  className="h-3.5 w-3.5"
                  strokeWidth={1.5}
                />

                <span>{sectionText.label}</span>

                <ChevronRight
                  className="ml-auto h-3.5 w-3.5"
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>
      </nav>

      <article
        className="manual-article animate-fade-in-up"
        key={`${currentSection.id}-${lang}`}
      >
        <div className="manual-article__topline">
          <span>{currentText.eyebrow}</span>

          <span>{String(currentIndex + 1).padStart(2, '0')}</span>
        </div>

        <div className="manual-article__icon">
          <SectionIcon
            className="h-5 w-5"
            strokeWidth={1.4}
          />
        </div>

        <h2>{currentText.title}</h2>

        <div className="manual-article__body">
          {currentSection.id === 'tutorial' ? (
            <TutorialLibrary lang={lang} />
          ) : (
            renderManualBlocks(currentText.body)
          )}
        </div>

        <div className="manual-article__footer">
          <span>{ui.footerBrand}</span>
          <span>—</span>
          <span>{ui.footerTag}</span>
        </div>
      </article>

      <p className="manual-page__footer">{ui.pageFooter}</p>
    </div>
  );
};

export default ManualApp;