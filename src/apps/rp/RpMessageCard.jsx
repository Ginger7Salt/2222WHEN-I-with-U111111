// src/apps/rp/RpMessageCard.jsx
//
// 长RP子应用切片C：单条消息的小说式卡片渲染，样式照搬
// rp-novel-style-preview.html 那份已经跟用户确认过的参考（头像居中 + 可选
// 场景图 + 毛玻璃卡片 + 衬线正文）。
//
// 正文格式约定（跟SillyTavern"长得像、用法像"这条一致，不是真的富文本）：
// 按换行分段，每段里 *星号包起来的部分* 转成斜体动作描写，其余是台词/
// 叙述原文直出——这是这个切片先做的最简单版本。allowHtml 开关目前只是
// 存在会话设置里的字段，还没有接到"把AI输出当HTML渲染"这一步（需要引入
// rehype-raw + rehype-sanitize 两个新依赖，风险没实测过，留到确认要做
// 再单独加），这里先统一按纯文本+星号斜体处理，不做HTML解析。
//
// 签名/头衔（character.rpTitle/rpSignature/rpBadgeImage、
// session.userTitle/userSignature/userBadgeImage）目前还没有任何编辑入口
// （角色卡编辑器和会话设置面板都还没做这块UI），所以这里读到空值时直接
// 不渲染那一条签名胶囊，不留占位空壳。

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Pencil, Quote, Check, X } from 'lucide-react';

const renderParagraphs = (text) => {
  const paragraphs = String(text || '').split(/\n+/).filter((p) => p.trim());

  return paragraphs.map((para, i) => {
    const segments = para.split(/(\*[^*]+\*)/g).filter((s) => s !== '');
    return (
      <p key={i}>
        {segments.map((seg, j) => {
          if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2) {
            return <em key={j}>{seg.slice(1, -1)}</em>;
          }
          return <React.Fragment key={j}>{seg}</React.Fragment>;
        })}
      </p>
    );
  });
};

const RpMessageCard = ({
  message,
  character,
  session,
  customFontFamily,
  canReroll,
  onSwitchVersion,
  onReroll,
  onEditAndTruncate,
  onQuote,
  hasFollowingMessages,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const isCharacter = message.senderType === 'character';

  const avatar = isCharacter ? character?.avatar : session?.userAvatar;
  const name = isCharacter ? (character?.name || 'TA') : (session?.userName || '你');
  const signatureText = isCharacter ? character?.rpSignature : session?.userSignature;
  const signatureBadge = isCharacter ? character?.rpBadgeImage : session?.userBadgeImage;

  // 外观设置：字体走 useRpCustomFont 解析出来的 customFontFamily（没设置/没
  // 加载成功时为 null，退回原来的衬线字体），字号/颜色直接读会话上的
  // fontSize/charTextColor/userTextColor（角色和user各自一套颜色）。
  const resolvedFontFamily = customFontFamily || 'Georgia, "Noto Serif SC", "Songti SC", serif';
  const resolvedFontSize = session?.fontSize ? `${session.fontSize}px` : '14.5px';
  const resolvedTextColor = (isCharacter ? session?.charTextColor : session?.userTextColor) || 'var(--text-main)';

  const hasVersions = Array.isArray(message.versions) && message.versions.length > 1;
  const hasScene = Boolean(message.sceneImage);

  const startEdit = () => {
    setDraft(message.content);
    setIsEditing(true);
  };

  const confirmEdit = () => {
    if (draft.trim() === message.content.trim()) {
      setIsEditing(false);
      return;
    }
    onEditAndTruncate(draft);
    setIsEditing(false);
  };

  return (
    <div className={`rp-message flex flex-col items-center ${isCharacter ? 'character' : 'user'}`}>
      {hasScene ? (
        <div
          className="relative mb-[-44px] h-42 w-full overflow-hidden rounded-2xl"
          style={{ height: '168px' }}
        >
          <img src={message.sceneImage} alt="" className="h-full w-full object-cover" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.45) 100%)' }}
          />
        </div>
      ) : null}

      <div className="relative z-[2] flex flex-col items-center gap-1.5">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="h-[72px] w-[72px] rounded-full object-cover shadow-lg"
            style={{ border: '3px solid var(--card-bg)' }}
          />
        ) : (
          <div
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-lg font-bold shadow-lg"
            style={{ backgroundColor: 'var(--control-soft-bg)', border: '3px solid var(--card-bg)' }}
          >
            {name?.[0] || '?'}
          </div>
        )}

        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-sm"
          style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-sub)' }}
        >
          {name}
        </span>

        {signatureText ? (
          <div
            className="flex max-w-[260px] items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2.5 text-[10px]"
            style={{ backgroundColor: 'var(--control-soft-bg)', color: 'var(--text-muted)' }}
          >
            {signatureBadge ? (
              <img src={signatureBadge} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
            ) : null}
            <span className="truncate whitespace-nowrap">{signatureText}</span>
          </div>
        ) : null}
      </div>

      <div
        className="mt-3.5 w-full rounded-[20px] border px-5 py-4.5 shadow-md"
        style={{
          borderColor: 'var(--card-border)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          background: isCharacter
            ? 'linear-gradient(160deg, color-mix(in srgb, var(--bg-blob-1) 38%, var(--card-bg)) 0%, color-mix(in srgb, var(--card-bg) 88%, transparent) 100%)'
            : 'linear-gradient(160deg, color-mix(in srgb, var(--accent-color) 20%, var(--card-bg)) 0%, color-mix(in srgb, var(--card-bg) 88%, transparent) 100%)',
          fontFamily: resolvedFontFamily,
          fontSize: resolvedFontSize,
          lineHeight: 1.9,
          color: resolvedTextColor,
        }}
      >
        {isEditing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            autoFocus
            className="w-full resize-none bg-transparent text-[14.5px] leading-relaxed outline-none"
            style={{ fontFamily: 'inherit' }}
          />
        ) : (
          renderParagraphs(message.content)
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-3.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {isEditing ? (
          <>
            <button type="button" onClick={confirmEdit} className="flex items-center gap-1 opacity-70 hover:opacity-100">
              <Check className="h-3 w-3" /> {hasFollowingMessages ? '保存并截断之后楼层' : '保存'}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="flex items-center gap-1 opacity-70 hover:opacity-100">
              <X className="h-3 w-3" /> 取消
            </button>
          </>
        ) : (
          <>
            {hasVersions ? (
              <div
                className="flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{ backgroundColor: 'var(--control-soft-bg)' }}
              >
                <button
                  type="button"
                  onClick={() => onSwitchVersion(-1)}
                  disabled={message.currentVersionIndex === 0}
                  className="disabled:opacity-30"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span>{message.currentVersionIndex + 1} / {message.versions.length}</span>
                <button
                  type="button"
                  onClick={() => onSwitchVersion(1)}
                  disabled={message.currentVersionIndex === message.versions.length - 1}
                  className="disabled:opacity-30"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : null}

            {canReroll ? (
              <button type="button" onClick={onReroll} className="flex items-center gap-1 opacity-70 hover:opacity-100">
                <RotateCcw className="h-3 w-3" /> 重新生成
              </button>
            ) : null}

            <button type="button" onClick={startEdit} className="flex items-center gap-1 opacity-70 hover:opacity-100">
              <Pencil className="h-3 w-3" /> 编辑
            </button>

            {onQuote ? (
              <button type="button" onClick={() => onQuote(message.content)} className="flex items-center gap-1 opacity-70 hover:opacity-100">
                <Quote className="h-3 w-3" /> 引用
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default RpMessageCard;