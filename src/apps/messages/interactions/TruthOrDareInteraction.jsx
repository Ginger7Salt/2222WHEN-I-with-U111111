// src/apps/messages/interactions/TruthOrDareInteraction.jsx
//
// 真心话大冒险：跟上面几个"先 pending 再轻触揭晓"的不一样——题目在
// interactionService.js 的 createTruthOrDareMessage 里已经当场抽好，
// 消息一插入就是"resolved"状态，这里只负责把"谁向谁发起了什么题目"
// 显示出来，不需要再有一个额外的揭晓动作。
//
// asker 是这一局的出题人（'character' 或 'user'）：
// - asker === 'character'：角色向用户发起，用户看着题目自己手动打字回应；
// - asker === 'user'：用户向角色发起，角色的正式回答会作为后一条消息
//   自动出现（generateTruthOrDareAnswer），这张卡本身只展示题目。

import React from 'react';

export const TruthOrDareInteraction = ({ message, character }) => {
  const { asker, result } = message.metadata || {};
  const mode = result?.mode;
  const prompt = result?.prompt;
  const modeLabel = mode === 'dare' ? '大冒险' : '真心话';
  const characterName = character?.name || '对方';

  const askerLabel = asker === 'user'
    ? `你向${characterName}发起`
    : `${characterName}向你发起`;

  const responderHint = asker === 'user'
    ? `等${characterName}认真回应这一题。`
    : '轮到你了，认真回应这一题吧。';

  return (
    <article className="chat-interaction chat-interaction--truth-or-dare chat-interaction--resolved">
      <div className="interaction-heading">
        <span className="interaction-kicker">TABLE GAME</span>
        <span className="interaction-title">真心话大冒险</span>
      </div>

      <div className="interaction-tod-body">
        <div className="interaction-tod-tags">
          <span
            className={`interaction-tod-mode-tag interaction-tod-mode-tag--${mode || 'truth'}`}
          >
            {modeLabel}
          </span>
          <span className="interaction-tod-asker-tag">{askerLabel}</span>
        </div>
        <p className="interaction-tod-prompt">{prompt}</p>
      </div>

      <div className="interaction-footer">
        <span>{responderHint}</span>
      </div>
    </article>
  );
};

export default TruthOrDareInteraction;