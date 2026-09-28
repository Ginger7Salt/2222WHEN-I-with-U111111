// src/apps/messages/interactions/IntimacyQaInteraction.jsx
//
// 亲密问答卡：轻触翻开卡片抽到一道题，角色先在后面自动回答
// （generateInteractionReaction 里按 INTIMACY_QA 分支走"认真作答"的
// 提示词），用户看完角色的回答，再手动打字回应，走现有的普通聊天流程。

import React, { useState } from 'react';
import { resolveInteractionMessage } from './interactionService';

export const IntimacyQaInteraction = ({ message, onResolved }) => {
  const [isRevealing, setIsRevealing] = useState(false);
  const [displayQuestion, setDisplayQuestion] = useState(
    message.metadata?.result?.question || null
  );

  const status = message.metadata?.status || 'pending';
  const question = message.metadata?.result?.question || displayQuestion;
  const isPending = status === 'pending';

  const handleDraw = async () => {
    if (!isPending || isRevealing) return;

    setIsRevealing(true);

    const metadata = await resolveInteractionMessage({
      messageId: message.id,
    });

    const nextQuestion = metadata?.result?.question;

    if (!nextQuestion) {
      setIsRevealing(false);
      return;
    }

    setDisplayQuestion(nextQuestion);

    window.setTimeout(() => {
      setIsRevealing(false);
      onResolved?.();
    }, 620);
  };

  return (
    <article
      className={`chat-interaction chat-interaction--intimacy-qa ${
        isPending ? 'chat-interaction--pending' : 'chat-interaction--resolved'
      }`}
    >
      <div className="interaction-heading">
        <span className="interaction-kicker">TABLE OBJECT</span>
        <span className="interaction-title">问答卡</span>
      </div>

      <button
        type="button"
        className="interaction-qa-stage"
        onClick={handleDraw}
        disabled={!isPending || isRevealing}
        aria-label={isPending ? '抽一张问答卡' : `问题：${question}`}
      >
        {isPending ? (
          <span className="interaction-qa-card-back">
            <span className="interaction-qa-mark">?</span>
            <span className="interaction-lottery-hint">轻触抽一张</span>
          </span>
        ) : (
          <span
            className={`interaction-qa-card-front ${
              isRevealing ? 'interaction-qa-card-front--in' : ''
            }`}
          >
            {question}
          </span>
        )}
      </button>

      <div className="interaction-footer">
        {isPending ? (
          <span>抽到的问题，认真回答才好玩。</span>
        ) : (
          <span>对方先答，你再接着说说看。</span>
        )}
      </div>
    </article>
  );
};

export default IntimacyQaInteraction;