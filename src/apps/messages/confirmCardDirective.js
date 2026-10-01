// src/apps/messages/confirmCardDirective.js
//
// 通用"确认/选择/填写卡"——AI 主动在回复里插一张可交互小卡片，让用户
// 点一下确认、挑一个选项，或者填几个字段再提交，而不是只能用文字回复
// （比如用户说"给我一个预算表格"，AI 可以直接发一张能填写的卡片）。
//
// 写法沿用 companionOfferService.js / scheduledMessageService.js 那套
// "提示词里说明用法 + 回复时正则取出标签 + 按规则生成卡片消息" 的隐藏
// 指令模式，不额外起一套新机制，也不限定只有 work 模式能用——这是一个
// 通用消息类型，任何聊天窗都能用。
//
// 三种模式，单行指令，字段用 | 分隔（跟 SCHEDULE_MESSAGE 一样）：
//
// 确认型（是/否）：
//   [CONFIRM_CARD: confirm | 标题文字 | 确认按钮文字(可选) | 取消按钮文字(可选)]
//
// 选择型（多选一，2-5 个选项，用逗号分隔）：
//   [CONFIRM_CARD: select | 标题文字 | 选项1,选项2,选项3]
//
// 填写型（1-4 个字段，字段之间用分号分隔，字段名和占位提示之间用冒号分隔）：
//   [CONFIRM_CARD: form | 标题文字 | 字段名1:占位提示1;字段名2:占位提示2]
//
// 卡片渲染后，用户点击/选择/提交的结果会被 ChatRoom.jsx 的
// handleRespondToConfirmCard 转成一条新的用户消息自动发出并触发 AI 回复，
// 同时把"已回应"的状态和摘要写回这条卡片消息自己的 metadata（不是另起
// 一张表），所以卡片用过一次之后再打开聊天窗依然是只读的已回应样子。

const CONFIRM_CARD_TAG_PATTERN = /\s*\[CONFIRM_CARD:\s*([^\]]+)\]\s*/i;

const MODES = {
  CONFIRM: 'confirm',
  SELECT: 'select',
  FORM: 'form',
};

export const CONFIRM_CARD_PROMPT_NOTE = `
【可选行为：确认/选择/填写卡】
如果你想让用户不只是打字回复，而是点一下按钮确认、从几个选项里选一个，
或者填几个字段再提交给你（比如用户说"给我一个预算表格"，你可以直接发
一张能填写的卡片，而不是用文字列一遍），可以在回复正文的最后单独一行
加上下面三种指令之一（用户不会看到这行原始文字，系统会把它转换成一张
可交互卡片）：

确认型（是/否）：
[CONFIRM_CARD: confirm | 标题文字 | 确认按钮文字(可选，默认"好的") | 取消按钮文字(可选，默认"先不用")]

选择型（从几个选项里选一个，2-5 个选项，用逗号分隔）：
[CONFIRM_CARD: select | 标题文字 | 选项1,选项2,选项3]

填写型（1-4 个字段，用户填完点提交；字段之间用分号分隔，字段名和占位提示之间用冒号分隔）：
[CONFIRM_CARD: form | 标题文字 | 字段名1:占位提示1;字段名2:占位提示2]

严格规则：
1. 一次回复最多使用一次该指令。
2. 不确定要不要用的时候就不要用，大多数情况下直接文字回复就够了。
3. select 最多提供 5 个选项，form 最多 4 个字段，都不要超。
4. 字段名要简短（几个字以内），占位提示用来告诉用户该填什么，不是默认值。
5. 不得在可见正文中解释或提及该指令。
6. 用户点击/选择/提交之后，你会收到一条总结了他选择/填写了什么的用户消息，正常接着往下聊就行，不用再问一遍。`;

const parseOptions = (raw) => (
  String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5)
);

const parseFields = (raw) => (
  String(raw || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [namePart, ...placeholderParts] = item.split(':');
      const name = (namePart || '').trim().slice(0, 12);
      const placeholder = placeholderParts.join(':').trim().slice(0, 40);
      return name ? { name, placeholder } : null;
    })
    .filter(Boolean)
    .slice(0, 4)
);

/*
 * 从角色回复里取出 [CONFIRM_CARD: ...] 标签（一律从正文去掉）；
 * 格式不对、标题为空、选项/字段数量不够等情况一律静默忽略，不报错、
 * 不生成卡片，只把标签从正文清掉，避免原始指令文字漏到用户眼前。
 */
export const applyConfirmCardDirective = async ({ content }) => {
  const original = String(content || '');
  const match = CONFIRM_CARD_TAG_PATTERN.exec(original);
  const strippedContent = original.replace(CONFIRM_CARD_TAG_PATTERN, '').trim();

  if (!match) {
    return { content: strippedContent, cardMessage: null };
  }

  const rawParts = match[1].split('|').map((part) => part.trim());
  const [modeRaw, titleRaw, ...rest] = rawParts;
  const mode = String(modeRaw || '').toLowerCase();
  const title = (titleRaw || '').slice(0, 60);

  if (!title || !Object.values(MODES).includes(mode)) {
    return { content: strippedContent, cardMessage: null };
  }

  if (mode === MODES.CONFIRM) {
    const confirmLabel = (rest[0] || '好的').slice(0, 10);
    const cancelLabel = (rest[1] || '先不用').slice(0, 10);

    return {
      content: strippedContent,
      cardMessage: {
        type: 'confirm_card',
        content: title,
        metadata: { mode, title, confirmLabel, cancelLabel },
      },
    };
  }

  if (mode === MODES.SELECT) {
    const options = parseOptions(rest[0]);

    if (options.length < 2) {
      return { content: strippedContent, cardMessage: null };
    }

    return {
      content: strippedContent,
      cardMessage: {
        type: 'confirm_card',
        content: title,
        metadata: { mode, title, options },
      },
    };
  }

  // mode === 'form'
  const fields = parseFields(rest[0]);

  if (fields.length === 0) {
    return { content: strippedContent, cardMessage: null };
  }

  return {
    content: strippedContent,
    cardMessage: {
      type: 'confirm_card',
      content: title,
      metadata: { mode, title, fields },
    },
  };
};

export default {
  CONFIRM_CARD_PROMPT_NOTE,
  applyConfirmCardDirective,
};