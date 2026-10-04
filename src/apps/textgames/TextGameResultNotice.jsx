// src/apps/textgames/TextGameResultNotice.jsx
//
// 文字游戏大厅——任何一局跟角色对弈的结果留在聊天记录里的痕迹，跟
// ChallengeCompletionNotice/戳一戳同一个视觉语言：居中一条小药丸，
// 纯公告，不可点击跳转。做成通用组件（不叫 TicTacToeResultNotice）
// 是因为以后这个大厅里其他跟角色对弈的游戏（猜成语Wordle等）结果消息
// 都想走同一个 type:'text_game_result'，不用每款游戏各自登记一个
// MessageRow case。

import React from 'react';

const RESULT_TEXT = {
  win: '赢了这一局',
  loss: '这一局被TA拿下了',
  draw: '打成了平局',
};

const TextGameResultNotice = ({ message }) => {
  const gameTitle = message?.metadata?.gameTitle || '一局游戏';
  const result = message?.metadata?.result;
  const resultText = message?.metadata?.noticeText || RESULT_TEXT[result] || '结束了这一局';

  return (
    <div className="my-2 flex justify-center">
      <div
        className="rounded-full px-3 py-1 text-center text-[11px]"
        style={{
          background: 'var(--control-soft-bg)',
          color: 'var(--text-main)',
          opacity: 0.75,
        }}
      >
        <span>
          跟TA玩了「{gameTitle}」，{resultText}
        </span>
      </div>
    </div>
  );
};

export default TextGameResultNotice;