import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, X } from 'lucide-react';

import {
  MANUAL_SECTIONS,
  MANUAL_UI_TEXT,
} from '../../apps/manual/manualContent';
import {
  ManualLanguageSwitch,
  readStoredManualLang,
  renderManualBlocks,
  storeManualLang,
} from '../../apps/manual/manualBlocks';
import { TutorialLibrary } from '../../apps/manual/TutorialLibrary';

export const HouseManualModal = ({
  isOpen,
  onClose,
}) => {
  const [lang, setLang] = useState(() => readStoredManualLang());
  const [activeSection, setActiveSection] = useState('welcome');

  const handleLangChange = (nextLang) => {
    setLang(nextLang);
    storeManualLang(nextLang);
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const ui = MANUAL_UI_TEXT[lang];

  const currentSection =
    MANUAL_SECTIONS.find(
      (section) => section.id === activeSection,
    ) || MANUAL_SECTIONS[0];

  const currentText = currentSection.translations[lang];
  const SectionIcon = currentSection.icon;
  const currentIndex = MANUAL_SECTIONS.indexOf(currentSection);

  const selectSection = (sectionId) => {
    setActiveSection(sectionId);
  };

  const selectAdjacentSection = (offset) => {
    const nextIndex = Math.min(
      Math.max(currentIndex + offset, 0),
      MANUAL_SECTIONS.length - 1,
    );

    setActiveSection(MANUAL_SECTIONS[nextIndex].id);
  };

  return (
    <div
      className="house-manual-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="house-manual-title"
    >
      <div className="house-manual-modal__overlay" />

      <section className="house-manual-modal__window">
        <header className="house-manual-modal__header">
          <div className="house-manual-modal__identity">
            <span>{ui.kicker}</span>
            <h1 id="house-manual-title">{ui.heading}</h1>
          </div>

          <ManualLanguageSwitch
            lang={lang}
            onChange={handleLangChange}
            className="house-manual-modal__lang"
          />

          <button
            type="button"
            onClick={onClose}
            className="house-manual-modal__close"
            aria-label="关闭空间说明书"
            title="关闭空间说明书"
          >
            <X
              className="h-4 w-4"
              strokeWidth={1.6}
            />
          </button>
        </header>

        <div className="house-manual-modal__intro">
          <span>{ui.introEyebrow}</span>

          <h2>
            {ui.introTitle[0]}
            <br />
            {ui.introTitle[1]}
          </h2>

          <p>
            这不是规则清单，只是一些帮助你认识这间房子的文字。
          </p>
        </div>

        <div className="house-manual-modal__layout">
          <nav
            className="house-manual-modal__index"
            aria-label={ui.contentsAria}
          >
            <div className="house-manual-modal__index-label">
              {ui.contentsLabel}
            </div>

            <div className="house-manual-modal__index-list">
              {MANUAL_SECTIONS.map((section, index) => {
                const Icon = section.icon;
                const isActive =
                  section.id === currentSection.id;
                const sectionText = section.translations[lang];

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => selectSection(section.id)}
                    className={`house-manual-modal__index-item ${
                      isActive
                        ? 'house-manual-modal__index-item--active'
                        : ''
                    }`}
                  >
                    <span className="house-manual-modal__index-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.5}
                    />

                    <span>{sectionText.label}</span>

                    <ChevronRight
                      className="ml-auto h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.5}
                    />
                  </button>
                );
              })}
            </div>
          </nav>

          <article
            className="house-manual-modal__article animate-fade-in-up"
            key={`${currentSection.id}-${lang}`}
          >
            <div className="house-manual-modal__article-topline">
              <span>{currentText.eyebrow}</span>
              <span>
                {String(currentIndex + 1).padStart(2, '0')}
              </span>
            </div>

            <div className="house-manual-modal__article-icon">
              <SectionIcon
                className="h-5 w-5"
                strokeWidth={1.4}
              />
            </div>

            <h2>{currentText.title}</h2>

            <div className="house-manual-modal__article-body">
              {currentSection.id === 'tutorial' ? (
                <TutorialLibrary lang={lang} />
              ) : (
                renderManualBlocks(currentText.body)
              )}
            </div>

            <div className="house-manual-modal__pagination">
              <button
                type="button"
                onClick={() => selectAdjacentSection(-1)}
                disabled={currentIndex === 0}
              >
                上一章
              </button>

              <span>
                {currentIndex + 1} / {MANUAL_SECTIONS.length}
              </span>

              <button
                type="button"
                onClick={() => selectAdjacentSection(1)}
                disabled={
                  currentIndex === MANUAL_SECTIONS.length - 1
                }
              >
                下一章
              </button>
            </div>

            <div className="house-manual-modal__article-footer">
              <span>{ui.footerBrand}</span>
              <span>—</span>
              <span>{ui.footerTag}</span>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
};

export default HouseManualModal;