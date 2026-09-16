import React, { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import './app-update.css';

let globalRegistration = null;
const listeners = new Set();

const notifyListeners = (status) => {
  listeners.forEach((callback) => callback(status));
};

export const subscribeToUpdateStatus = (callback) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const triggerUpdateCheck = async () => {
  if (!globalRegistration) {
    return {
      status: 'unsupported',
      message: '离线或容器未就绪',
    };
  }

  try {
    await globalRegistration.update();

    if (!globalRegistration.waiting && !globalRegistration.installing) {
      return {
        status: 'latest',
        message: '已是最新布置',
      };
    }

    return {
      status: 'found',
      message: '已发现新的布置，正在下载',
    };
  } catch (error) {
    console.warn('[SW Update Check Error]', error);

    return {
      status: 'error',
      message: '检查未成功，请稍后再试',
    };
  }
};

const BatLoader = () => {
  return (
    <div
      className="relative flex h-16 w-24 items-center justify-center"
      aria-hidden="true"
    >
      <svg
        width="88"
        height="54"
        viewBox="0 0 88 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <filter
            id="bat-glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#bat-glow)">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="-7 1; 7 -2; -7 1"
            dur="2.4s"
            repeatCount="indefinite"
          />

          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-3 44 27; 3 44 27; -3 44 27"
              dur="1.2s"
              repeatCount="indefinite"
            />

            <path
              d="M44 23C40 17 34 16 27 12C28 18 27 22 30 26C24 23 18 22 11 23C17 28 22 33 31 34C35 34 39 32 44 29"
              fill="currentColor"
              className="text-purple-500"
            />

            <path
              d="M44 23C48 17 54 16 61 12C60 18 61 22 58 26C64 23 70 22 77 23C71 28 66 33 57 34C53 34 49 32 44 29"
              fill="currentColor"
              className="text-purple-500"
            />

            <path
              d="M44 21C40 20 37 22 37 26C37 31 40 34 44 37C48 34 51 31 51 26C51 22 48 20 44 21Z"
              fill="currentColor"
              className="text-purple-300"
            />

            <path
              d="M40 21L40 16L43 20M48 21L48 16L45 20"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-purple-300"
            />

            <circle cx="41.5" cy="25.5" r="1.2" fill="#F5D0FE" />
            <circle cx="46.5" cy="25.5" r="1.2" fill="#F5D0FE" />

            <path
              d="M42 29C43 30 45 30 46 29"
              stroke="#F5D0FE"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};

const LoadingProgress = () => {
  return (
    <div className="mt-5 w-full">
      <div className="mb-2 flex items-center justify-between text-[10px] tracking-[0.16em] text-purple-300/80">
        <span>正在载入新布置</span>
        <span className="animate-pulse">PLEASE WAIT</span>
      </div>

      <div className="h-[3px] w-full overflow-hidden bg-purple-950/70">
        <div className="gothic-loading-progress h-full w-1/3 bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.9)]" />
      </div>

      <p className="mt-3 text-center text-[10px] text-stone-500">
        影子正在整理新的房间……
      </p>
    </div>
  );
};

export const AppUpdateManager = ({ isInsideChatRoom }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState(false);
  const reloadTimerRef = useRef(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return undefined;
    }

    const handleControllerChange = () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }

      window.location.reload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && globalRegistration) {
        globalRegistration.update().catch(() => {});
      }
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange,
    );

    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        globalRegistration = registration;

        console.log('[SW] 注册成功：', registration.scope);

        if (registration.waiting) {
          setUpdateAvailable(true);
          notifyListeners('available');
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          if (!newWorker) {
            return;
          }

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state !== 'installed') {
              return;
            }

            if (navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
              notifyListeners('available');
            } else {
              notifyListeners('latest');
            }
          });
        });
      })
      .catch((error) => {
        console.warn('[SW] 注册失败：', error);
      });

    const checkUpdateSilently = () => {
      if (globalRegistration) {
        globalRegistration.update().catch(() => {});
      }
    };

    window.addEventListener('focus', checkUpdateSilently);
    window.addEventListener('online', checkUpdateSilently);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(
      checkUpdateSilently,
      60 * 60 * 1000,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      );

      window.removeEventListener('focus', checkUpdateSilently);
      window.removeEventListener('online', checkUpdateSilently);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      window.clearInterval(intervalId);

      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
    };
  }, []);

  const handleApplyUpdate = () => {
    if (isApplying) {
      return;
    }

    setIsApplying(true);
    setApplyError(false);
    notifyListeners('applying');

    const waitingWorker = globalRegistration?.waiting;

    if (waitingWorker) {
      waitingWorker.postMessage({
        type: 'SKIP_WAITING',
      });

      reloadTimerRef.current = window.setTimeout(() => {
        setIsApplying(false);
        setApplyError(true);
        notifyListeners('error');
      }, 12000);

      return;
    }

    if (globalRegistration) {
      globalRegistration.update().catch(() => {});
    }

    reloadTimerRef.current = window.setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  const handleRetryUpdate = () => {
    setApplyError(false);
    setIsApplying(false);
    handleApplyUpdate();
  };

  const handleDismiss = () => {
    if (!isApplying) {
      setIsDismissed(true);
    }
  };

  if (!updateAvailable || isDismissed || isInsideChatRoom) {
    return null;
  }

  return (
    <div className="gothic-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="gothic-window w-full max-w-[360px] overflow-hidden font-mono text-sm leading-relaxed text-stone-300">
        <div className="gothic-border-inner">
          <div className="gothic-corner gothic-corner-tl" />
          <div className="gothic-corner gothic-corner-tr" />
          <div className="gothic-corner gothic-corner-bl" />
          <div className="gothic-corner gothic-corner-br" />

          <div className="gothic-arch-header flex flex-col items-center">
            {isApplying ? (
              <BatLoader />
            ) : (
              <>
                <div className="gothic-dot mb-1 h-6 w-6" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-400">
                  sanctuary registry
                </span>
              </>
            )}
          </div>

          {isApplying ? (
            <div className="px-1 py-2">
              <p className="text-center font-serif text-[13px] leading-relaxed text-stone-200">
                新的布置正在穿过夜色。
              </p>

              <LoadingProgress />

              {applyError && (
                <div className="mt-5">
                  <p className="text-center text-[11px] text-red-300">
                    载入时间过长，新的布置可能没有成功接管。
                  </p>

                  <button
                    type="button"
                    onClick={handleRetryUpdate}
                    className="gothic-btn-update mt-3 flex w-full items-center justify-center gap-2 rounded-sm py-2.5 text-xs font-semibold tracking-wider transition-all"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    重试载入
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-4 px-1 py-2 text-xs text-stone-300">
                <p className="font-serif text-[13px] leading-relaxed text-stone-200">
                  shadow 努力的工作了一会，并奉上了新的更新。
                </p>

                <p className="border-l border-purple-900/60 pl-2 text-[11px] italic text-stone-400">
                  注意更新可能会存在 bug，[ 熔巧机 ] 采用独立沙盒设计，app
                  无法打开并不会影响您原本的存档。
                </p>

                <p className="text-[11px] text-stone-400">
                  如遇 bug，通过 Q 群反馈是修复最快的途径。
                  <br />
                  感谢您的谅解。
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleApplyUpdate}
                  disabled={isApplying}
                  className="gothic-btn-update flex w-full items-center justify-center gap-2 rounded-sm py-2.5 text-xs font-semibold tracking-wider transition-all disabled:cursor-wait disabled:opacity-60"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  立刻载入新布置
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isApplying}
                  className="gothic-btn-dismiss w-full rounded-sm py-2 text-[11px] tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  稍后进入
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
