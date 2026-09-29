// src/apps/rp/rpPromptAssembler.js
//
// 长RP子应用切片B：预设的"组装"和"正则脚本"两套纯函数逻辑。
// 这个文件不碰数据库，也不发AI请求——切片C的消息管道会调用这里的
// assembleRpSystemPrompt/applyRegexScripts，现在先把逻辑写对、可单独
// 测试。

/**
 * 宏替换：{{char}} {{user}} {{time}} 以及两个组装时才知道的大段内容
 * 占位 {{charBio}} {{userPersona}}。不认识的 {{xxx}} 原样保留，不清空
 * ——用户自己在预设里写错宏名字的时候，能一眼看出"这个没被替换"，
 * 而不是发现一段内容莫名其妙消失了。
 */
export const applyMacros = (text, { character, session } = {}) => {
  if (!text) return '';

  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const replacements = {
    '{{char}}': character?.name || 'TA',
    '{{user}}': session?.userName || '你',
    '{{time}}': timeStr,
    '{{charBio}}': [character?.bio, character?.extraNotes].filter(Boolean).join('\n') || '（未填写）',
    '{{userPersona}}': session?.userPersona || '（未填写）',
  };

  let result = text;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value);
  }
  return result;
};

/**
 * 正则脚本执行。target 决定这条脚本认不认这次调用的文本
 * （'ai_output' | 'user_input' | 'both'），phase 决定看 applyToDisplay
 * 还是 applyToPrompt 这个开关。按数组顺序依次执行，前一条的替换结果
 * 会喂给下一条——这个顺序依赖是故意的，用户可以靠排列顺序做"先隐藏
 * 星号再做别的处理"这种组合。
 *
 * phase: 'display'（只影响这条消息在RP界面里怎么显示）
 *      | 'prompt'（处理后的文本才会被写入历史，喂给下一轮AI）
 */
export const applyRegexScripts = (text, scripts = [], { source, phase }) => {
  if (!text || !Array.isArray(scripts) || scripts.length === 0) return text;

  let result = text;

  for (const script of scripts) {
    if (!script.enabled) continue;
    if (script.affects !== 'both' && script.affects !== source) continue;

    const phaseFlag = phase === 'display' ? script.applyToDisplay : script.applyToPrompt;
    if (!phaseFlag) continue;

    try {
      const regex = new RegExp(script.findRegex, script.flags || 'g');
      result = result.replace(regex, script.replaceString || '');
    } catch (err) {
      // 用户写的正则语法有误——跳过这一条，不要因为一条脚本写错就让
      // 整条消息渲染/整轮AI调用失败。
      console.warn('[rpPromptAssembler] 正则脚本执行失败，已跳过:', script.name, err);
    }
  }

  return result;
};

/**
 * 把 rpMessages 记录数组转成喂给 chat completions 的 {role, content} 历史
 * 数组。只取最近 contextWindowSize 条（0 或未传代表不限制），每条先过一遍
 * 对应方向的正则脚本（phase:'prompt'，character消息的 source 是
 * 'ai_output'，user消息是'user_input'）——这一步是"写入历史给下一轮AI看"
 * 的处理，跟界面上怎么显示（phase:'display'）是分开算的两件事，允许用户
 * 用正则脚本让AI看到的和自己看到的不是同一份文本。
 *
 * 纯函数，不碰数据库——调用方（rpAiService）负责先把消息从 db 里取出来。
 */
export const buildRpHistoryContext = (messages = [], regexScripts = [], contextWindowSize = 0) => {
  const windowed = contextWindowSize > 0 && messages.length > contextWindowSize
    ? messages.slice(-contextWindowSize)
    : messages;

  return windowed
    .map((m) => {
      const source = m.senderType === 'user' ? 'user_input' : 'ai_output';
      const content = applyRegexScripts(m.content, regexScripts, { source, phase: 'prompt' }).trim();
      if (!content) return null;
      return {
        role: m.senderType === 'user' ? 'user' : 'assistant',
        content,
      };
    })
    .filter(Boolean);
};

/**
 * 组装最终的system prompt。
 *
 * - worldBookText / historyText 是调用方（切片C的消息管道）传进来的
 *   两段"占位符要替换成什么"，这个函数自己不知道世界书怎么扫描、
 *   历史怎么截取，只负责把它们塞进预设里标了 isMarker 的对应位置。
 * - 找不到预设（session.presetId 指向一个已删除的预设）时，退回成
 *   只有历史、没有任何自定义prompts块的最简拼装——见 rpPresetService
 *   删除函数注释里说的"静默退回"。
 */
export const assembleRpSystemPrompt = ({ preset, character, session, worldBookText = '', historyText = '' }) => {
  if (!preset || !Array.isArray(preset.prompts)) {
    return historyText;
  }

  const promptsById = Object.fromEntries(preset.prompts.map((p) => [p.identifier, p]));
  const order = Array.isArray(preset.promptOrder) && preset.promptOrder.length > 0
    ? preset.promptOrder
    : preset.prompts.map((p) => p.identifier);

  const blocks = [];

  for (const identifier of order) {
    const prompt = promptsById[identifier];
    if (!prompt || !prompt.enabled) continue;

    if (prompt.isMarker) {
      // 目前只认识这两种占位符；不认识的marker直接跳过，不报错。
      if (identifier === 'world-book' || prompt.name === '世界书注入点') {
        if (worldBookText) blocks.push(worldBookText);
      } else if (identifier === 'history' || prompt.name === '聊天历史注入点') {
        if (historyText) blocks.push(historyText);
      }
      continue;
    }

    const content = applyMacros(prompt.content, { character, session });
    if (content.trim()) blocks.push(content);
  }

  return blocks.join('\n\n');
};

export default {
  applyMacros,
  applyRegexScripts,
  buildRpHistoryContext,
  assembleRpSystemPrompt,
};