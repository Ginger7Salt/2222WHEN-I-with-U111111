import React, { useState } from 'react';
import { X } from 'lucide-react';

import { proposeOfflineSessionByUser } from './offlineSessionService';
import { evaluateUserProposedOfflineSession } from './offlineSessionJudgeService';

const OfflineInviteComposer = ({ chatId, characterId, onClose, onCreated }) => {
  const [sceneLabel, setSceneLabel] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');
  const [scheduledForLocal, setScheduledForLocal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!sceneLabel.trim() || !scheduledForLocal) return;

    setIsSubmitting(true);

    try {
      const scheduledFor = new Date(scheduledForLocal).toISOString();

      const sessionId = await proposeOfflineSessionByUser({
        chatId,
        characterId,
        sceneLabel: sceneLabel.trim(),
        sceneDescription: sceneDescription.trim(),
        scheduledFor,
      });

      onCreated?.();
      onClose?.();

      void evaluateUserProposedOfflineSession(sessionId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl p-4 text-xs"
        style={{ background: 'var(--card-bg-gradient)', color: 'var(--text-main)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">邀请线下见面</span>
          <button type="button" onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={sceneLabel}
            onChange={(event) => setSceneLabel(event.target.value)}
            placeholder="见面场景（如：傍晚的河边散步）"
            className="w-full rounded-xl p-2 outline-none"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
          />

          <textarea
            value={sceneDescription}
            onChange={(event) => setSceneDescription(event.target.value)}
            placeholder="场景细节（可选）"
            rows={2}
            className="w-full resize-none rounded-xl p-2 outline-none"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
          />

          <input
            type="datetime-local"
            value={scheduledForLocal}
            onChange={(event) => setScheduledForLocal(event.target.value)}
            className="w-full rounded-xl p-2 outline-none"
            style={{ background: 'var(--control-soft-bg)', color: 'var(--text-main)' }}
          />

          <button
            type="button"
            disabled={isSubmitting || !sceneLabel.trim() || !scheduledForLocal}
            onClick={handleSubmit}
            className="w-full rounded-full py-2 font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
          >
            发出邀约
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfflineInviteComposer;