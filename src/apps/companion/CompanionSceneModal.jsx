import React from 'react';
import { X } from 'lucide-react';

import { COMPANION_SCENES } from './companionShopData';

/*
 * 场景选择：四选一，点哪个立刻生效并关闭（不用再点一次"确定"）。
 * 结构照抄 CompanionShopModal.jsx 的底部弹层样式，保持视觉一致。
 */
const CompanionSceneModal = ({ currentSceneId, onSelect, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
    <div
      className="absolute inset-0"
      style={{ background: 'var(--modal-overlay)' }}
      onClick={onClose}
    />

    <div
      className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-t-[2rem] p-5 sm:rounded-[2rem]"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-base font-medium">换个场景</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ background: 'var(--control-soft-bg)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {COMPANION_SCENES.map((scene) => {
          const isActive = scene.id === currentSceneId;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onSelect(scene.id)}
              className="cp-scene-bg relative flex h-28 flex-col items-center justify-end overflow-hidden rounded-[1.5rem] p-2 transition-transform active:scale-95"
              style={{
                backgroundImage: `url(${scene.url})`,
                border: `2px solid ${isActive ? 'var(--accent-color)' : 'var(--card-border)'}`,
              }}
            >
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: isActive ? 'var(--accent-color)' : 'rgba(0,0,0,0.35)',
                  color: isActive ? 'var(--accent-foreground)' : '#ffffff',
                }}
              >
                {isActive ? '使用中' : scene.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        选好之后会一直用这个场景做背景，随时可以回来换。
      </p>
    </div>
  </div>
);

export default CompanionSceneModal;