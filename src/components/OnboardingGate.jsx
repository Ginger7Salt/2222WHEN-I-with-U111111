import { useEffect, useState } from 'react';
import db from '../db';
import './OnboardingGate.css';

const CONSENT_TEXT = '【我已知情并同意】';

function getNowIso() {
  return new Date().toISOString();
}

export default function OnboardingGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function checkConsent() {
      try {
        const setting = await db.settings.get('onboardingConsent');
        const hasAccepted = setting?.value?.accepted === true;

        if (active) {
          setAccepted(hasAccepted);
          setLoading(false);
        }
      } catch (readError) {
        console.error('读取首次确认状态失败：', readError);

        if (active) {
          setError('暂时无法读取确认状态，请刷新页面后再试。');
          setLoading(false);
        }
      }
    }

    checkConsent();

    return () => {
      active = false;
    };
  }, []);

  async function handleConfirm() {
    if (inputValue !== CONSENT_TEXT || saving) return;

    setSaving(true);
    setError('');

    try {
      await db.settings.put({
        key: 'onboardingConsent',
        value: {
          accepted: true,
          acceptedAt: getNowIso(),
        },
      });

      setAccepted(true);
    } catch (writeError) {
      console.error('保存首次确认状态失败：', writeError);
      setError('保存失败了，请再试一次。');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="onboarding-loading" aria-label="正在准备熔巧机">
        <span className="onboarding-loading-dot" />
      </div>
    );
  }

  if (accepted) {
    return children;
  }

  const isMatched = inputValue === CONSENT_TEXT;

  return (
    <main className="onboarding-page">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-brand">
          <span className="onboarding-brand-mark" />
          <span>熔巧机 · WELCOME</span>
        </div>

        <h1 id="onboarding-title">感谢您使用【熔巧机】</h1>

        <p className="onboarding-intro">
          这是一个完全非商业化的小手机，之后也没有商业化的打算，
          欢迎把链接分享给朋友～
        </p>

        <div className="onboarding-note">
          <p>请确保您已经成年哦。</p>
          <p>
            熔巧机不自带任何角色人设和 API，需要您根据自己的需要填写。
          </p>
          <p>
            如果遇到问题，可以查看接下来的说明；之后也可以在「设置」页面再次找到它，
            或者来咖啡屋询问。
          </p>
        </div>

        <p className="onboarding-request">
          请您输入下面这句话进入熔巧机，感谢您的配合！
        </p>

        <label className="onboarding-label" htmlFor="onboarding-consent-input">
          请完整输入
        </label>

        <input
          id="onboarding-consent-input"
          className="onboarding-input"
          type="text"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleConfirm();
            }
          }}
          placeholder={CONSENT_TEXT}
          autoComplete="off"
          spellCheck="false"
          disabled={saving}
        />

        <button
          className="onboarding-button"
          type="button"
          disabled={!isMatched || saving}
          onClick={handleConfirm}
        >
          {saving ? '正在进入…' : '进入熔巧机'}
        </button>

        <p
          className={`onboarding-hint${isMatched ? ' is-ready' : ''}`}
          aria-live="polite"
        >
          {error || (isMatched ? '好啦，可以进入了' : '输入内容完全匹配后即可继续')}
        </p>

        <p className="onboarding-footer">祝您使用愉快 ♡</p>
      </section>
    </main>
  );
}
