import { useEffect, useState } from 'react';
import db from '../db';
import { ONBOARDING_INTRO_SCREENS, ONBOARDING_INTRO_UI_TEXT } from './onboardingIntroContent';
import './OnboardingIntro.css';

// 首次引导（5 屏）与 OnboardingGate 的"同意页"是两个独立的关卡：
// OnboardingGate 负责成年确认 + 同意条款，这个组件负责在通过同意页之后，
// 第一次带新用户认识各个"空间"。两者都各自在 db.settings 里存一个开关，
// 互不影响。

const SETTINGS_KEY = 'onboardingIntroSeen';
const REOPEN_EVENT = 'onboarding-intro:reopen';
const LANG_STORAGE_KEY = 'onboarding_lang'; // 与 OnboardingGate 共用同一个语言记忆，保持前后一致

function getInitialLang() {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  if (saved && ONBOARDING_INTRO_SCREENS[saved]) return saved;

  const navLang = (navigator.language || '').toLowerCase();
  if (navLang.startsWith('ko')) return 'ko';
  if (navLang.startsWith('en')) return 'en';
  return 'zh';
}

export default function OnboardingIntro({ children }) {
  const [lang, setLang] = useState(getInitialLang);
  const [showIntro, setShowIntro] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  // 首次挂载时判断：这个开关有没有被设置过；如果没有，再看看本地是不是
  // 已经有角色库数据——如果有，说明是升级前就在用的老用户，直接静默标记
  // 为"已看过"，不弹出引导；只有真正的全新安装才会弹。
  useEffect(() => {
    let active = true;

    async function decideVisibility() {
      try {
        const setting = await db.settings.get(SETTINGS_KEY);

        if (setting?.value?.seen === true) {
          return;
        }

        const characterCount = await db.characters.count();

        if (characterCount > 0) {
          // 老用户：静默标记已看过，不弹出，也不打断当前渲染。
          await db.settings.put({
            key: SETTINGS_KEY,
            value: { seen: true, seenAt: new Date().toISOString(), via: 'existing-user-backfill' },
          });
          return;
        }

        if (active) {
          setStepIndex(0);
          setShowIntro(true);
        }
      } catch (err) {
        // 读取/写入失败时，不阻塞主应用——宁可少弹一次引导，也不要卡住入口。
        console.error('读取/写入引导状态失败：', err);
      }
    }

    decideVisibility();

    return () => {
      active = false;
    };
  }, []);

  // 供说明书"序言"页的"重新查看引导"按钮触发：不影响 seen 状态的持久化，
  // 只是临时把引导再显示一次。
  useEffect(() => {
    function handleReopen() {
      setStepIndex(0);
      setShowIntro(true);
    }

    window.addEventListener(REOPEN_EVENT, handleReopen);
    return () => window.removeEventListener(REOPEN_EVENT, handleReopen);
  }, []);

  function switchLang(code) {
    setLang(code);
    localStorage.setItem(LANG_STORAGE_KEY, code);
  }

  async function markSeenAndClose() {
    if (finishing) return;
    setFinishing(true);

    try {
      await db.settings.put({
        key: SETTINGS_KEY,
        value: { seen: true, seenAt: new Date().toISOString(), via: 'completed-or-skipped' },
      });
    } catch (err) {
      console.error('保存引导完成状态失败：', err);
    } finally {
      setShowIntro(false);
      setFinishing(false);
    }
  }

  if (!showIntro) {
    return children;
  }

  const screens = ONBOARDING_INTRO_SCREENS[lang];
  const t = ONBOARDING_INTRO_UI_TEXT[lang];
  const screen = screens[stepIndex];
  const isLastStep = stepIndex === screens.length - 1;

  function handleNext() {
    if (isLastStep) {
      markSeenAndClose();
      return;
    }
    setStepIndex((index) => Math.min(index + 1, screens.length - 1));
  }

  return (
    <>
      {children}

      <div className="onboarding-intro-backdrop" role="presentation">
        <section
          className="onboarding-intro-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-intro-title"
        >
          <div className="onboarding-intro-top">
            <div
              className="onboarding-intro-lang-group"
              role="group"
              aria-label="Language selector"
            >
              {Object.keys(ONBOARDING_INTRO_SCREENS).map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`onboarding-intro-lang-item${lang === code ? ' is-active' : ''}`}
                  onClick={() => switchLang(code)}
                >
                  {code === 'zh' ? '中' : code === 'en' ? 'EN' : '한'}
                </button>
              ))}
            </div>

            <span className="onboarding-intro-step-label">
              {t.stepLabel(stepIndex + 1, screens.length)}
            </span>
          </div>

          <div className="onboarding-intro-dots" aria-hidden="true">
            {screens.map((_, index) => (
              <span
                key={index}
                className={`onboarding-intro-dot${index === stepIndex ? ' is-active' : ''}${
                  index < stepIndex ? ' is-done' : ''
                }`}
              />
            ))}
          </div>

          <div className="onboarding-intro-body" key={stepIndex}>
            {screen.eyebrow && (
              <p className="onboarding-intro-eyebrow">{screen.eyebrow}</p>
            )}

            <h2 id="onboarding-intro-title" className="onboarding-intro-title">
              {screen.title}
            </h2>

            {screen.paragraphs.map((paragraph, index) => (
              <p key={index} className="onboarding-intro-paragraph">
                {paragraph}
              </p>
            ))}

            {screen.bullets && (
              <div className="onboarding-intro-bullets">
                {screen.bullets.map((bullet) => (
                  <div className="onboarding-intro-bullet" key={bullet.title}>
                    <strong>{bullet.title}</strong>
                    <span>{bullet.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="onboarding-intro-actions">
            {!isLastStep && (
              <button
                type="button"
                className="onboarding-intro-skip"
                onClick={markSeenAndClose}
                disabled={finishing}
              >
                {t.skip}
              </button>
            )}

            <button
              type="button"
              className="onboarding-intro-next"
              onClick={handleNext}
              disabled={finishing}
            >
              {isLastStep ? t.finish : t.next}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export function reopenOnboardingIntro() {
  window.dispatchEvent(new CustomEvent(REOPEN_EVENT));
}