// src/apps/greeting/popupBookFreeAiService.js
//
// 立体书"自由发挥"模式的生成：让角色亲手写整本书的 three.js 代码。
// 和积木库模式的区别：不挑模型积木，而是返回一段会在隔离沙箱里运行的代码（沙箱见
// popupBookFreeSandbox.js）。书名 / 封面款式 / 署名 / 点缀色仍然照旧返回，书架上的封面还是
// 同一个封面组件。
//
// 来自模型的内容都当不可信数据：
//   - 代码本身只在沙箱里运行（真正的安全边界是沙箱，不是这里）；这里再做纵深防御：
//     长度上限、去 Emoji、去围栏和 <script> 标签、挡掉联网 / 存储 / eval / 操作父页面一类的写法；
//   - 生成后会在隐藏沙箱里试跑一遍：报错就把错误原因喂回给角色，让它改完整重写，
//     最多尝试 FREE_BOOK_LIMITS.attempts 次；
//   - 沙箱文件（含一整份 three 的源码）动态 import，只有自由模式才会加载。

import { generateResponse } from '../../services/aiService';
import {
  BOOK_COVER_MOTIFS,
  BOOK_LIMITS,
  DEFAULT_BOOK_PALETTE,
  FREE_BOOK_LIMITS,
  getBookKind,
} from './popupBookConstants';
import {
  buildMomentText,
  cleanText,
  getCharacterContext,
  getEnabledWorldBooksText,
  grabTag,
  normalizeAccent,
  pickEnum,
} from './popupBookAiService';

const EMOJI_RE = /[\p{Extended_Pictographic}️‍]/gu;

/* ------------------------------ 代码整理 / 检查 ------------------------------ */

// 沙箱已经挡住了这些事，这里再挡一层：发现就让角色改，而不是带着它们去运行。
const FORBIDDEN = [
  [/\bfetch\s*\(/, 'fetch（沙箱里没有网络）'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest（沙箱里没有网络）'],
  [/\bWebSocket\b/, 'WebSocket（沙箱里没有网络）'],
  [/\bEventSource\b/, 'EventSource（沙箱里没有网络）'],
  [/\bnavigator\s*\.\s*sendBeacon\b/, 'sendBeacon（沙箱里没有网络）'],
  [/\bimportScripts\b|\bnew\s+Worker\b|\bSharedWorker\b/, 'Worker（不可用）'],
  [/\bimport\s*\(|^\s*import\s[^\n]*from\s/m, 'import（不要用模块，THREE 已经是全局变量）'],
  [/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/, 'eval / new Function（不可用）'],
  [/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b|\bdocument\s*\.\s*cookie\b/, '本地存储（不可用）'],
  [
    /\bwindow\s*\.\s*(?:top|parent|opener)\b|\b(?:parent|top|opener)\s*\.\s*(?:postMessage|location|document)\b/,
    'window.top / window.parent / opener（不能操作外面的页面）',
  ],
  [
    /\bwindow\s*\.\s*open\b|\b(?:window|document|self)\s*\.\s*location\b|\blocation\s*\.\s*(?:href|assign|replace)\b/,
    '打开窗口或跳转页面（不可用）',
  ],
  [/\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/, '死循环 while(true) / for(;;)（动画请用 requestAnimationFrame）'],
];

export const checkFreeCode = (code) => {
  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(code)) return `代码里出现了不允许的写法：${label}。`;
  }
  if (!/\bTHREE\b/.test(code)) return '代码里没有用到 THREE（它是全局变量，需要用它来画 3D）。';
  if (!/requestAnimationFrame/.test(code)) return '代码里没有用 requestAnimationFrame 做动画循环。';
  return '';
};

// 取出 <code> 里的代码：去掉 markdown 围栏和 <script> 标签、Emoji，限长。
// 返回 { code, problem }；problem 非空表示这份代码不能用，原因可以直接喂回给角色。
export const extractFreeCode = (raw) => {
  let code = grabTag(raw, 'code');
  if (!code) {
    // 模型有时忘了 <code> 标签，直接给围栏代码。
    const fenced = String(raw || '').match(/```(?:js|javascript)?\s*([\s\S]*?)```/i);
    code = fenced ? fenced[1].trim() : '';
  }
  code = code
    .replace(/^```(?:js|javascript)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/<\/?script\b[^>]*>/gi, '')
    .replace(EMOJI_RE, '')
    .trim();

  if (!code) return { code: '', problem: '没有找到 <code> 里的代码。' };
  if (code.length < FREE_BOOK_LIMITS.codeMin) return { code: '', problem: '代码太短，不像一个完整的场景。' };
  if (code.length > FREE_BOOK_LIMITS.codeMax) {
    return { code: '', problem: `代码太长（超过 ${FREE_BOOK_LIMITS.codeMax} 个字符），请精简后重写。` };
  }

  const problem = checkFreeCode(code);
  return { code: problem ? '' : code, problem };
};

// 解析模型回复。返回 { content, problem }：content 为 null 时 problem 是原因。
export const parseFreeBookReply = (raw) => {
  const text = String(raw || '');
  const title = cleanText(grabTag(text, 'title'), BOOK_LIMITS.title);
  const sign = cleanText(grabTag(text, 'sign'), BOOK_LIMITS.sign);
  if (!title || !sign) return { content: null, problem: '缺少 <title> 或 <sign>。' };

  const { code, problem } = extractFreeCode(text);
  if (!code) return { content: null, problem };

  return {
    content: {
      cover: { title, motif: pickEnum(grabTag(text, 'motif'), BOOK_COVER_MOTIFS, 'mist') },
      palette: { ...DEFAULT_BOOK_PALETTE, accent: normalizeAccent(grabTag(text, 'accent')) },
      sign,
      spreads: [],
      freeCode: code,
    },
    problem: '',
  };
};

/* ------------------------------ 构造提示词 ------------------------------ */

export const buildFreeBookSystemPrompt = async ({ character, kind, userNote = '', context = '', moment = null }) => {
  const kindInfo = getBookKind(kind);
  const worldBooksText = await getEnabledWorldBooksText();
  const note = cleanText(userNote, BOOK_LIMITS.userNote);
  const momentText = buildMomentText(moment);
  const contextText = context
    ? `
【你们最近的聊天（只作背景，不要照搬原话，也不要提"聊天记录"）】
${context}
`
    : '';

  return `你现在正扮演「${character?.name || '未命名角色'}」。

${getCharacterContext(character)}

${worldBooksText}

【任务】
你要亲手为用户做一本"立体书"，而且这一次没有现成的积木：整个画面由你写的 three.js 代码决定。
可以是一本翻开后有东西立起来的纸雕书、一个小盒子里的夜景、一个能用手指拨动的小场景……不必拘泥于书的样子，但要有手作、纸张、光影的质感，让人觉得是你亲手做的、只给TA的东西。
类型：${kindInfo.label}。${kindInfo.hint}。
${note ? `用户留了一句话：「${note}」。` : momentText ? '由你自己决定做什么。' : '用户没有留话，由你自己决定做什么。'}
${momentText}${contextText}
【代码运行的环境（已经准备好）】
- 页面里已经有一个铺满整个屏幕的 <canvas id="c">，请用 document.getElementById('c') 取它，并用 new THREE.WebGLRenderer({ canvas, antialias: true }) 来画。
- 全局变量 THREE 就是 three.js r170。没有 OrbitControls、GLTFLoader、字体加载器等任何扩展，也不要 import 任何东西。
- 全局变量 BOOK = { title, sign, kind }，是你这本书的书名、署名和类型。
- 没有网络，不能加载任何外部图片、字体、模型、文件。贴图请用 2D canvas 画出来（new THREE.CanvasTexture(canvasEl)）；文字用 canvas 贴图，或者用 position:fixed 的 DOM 元素叠在上面都可以。中文字体写 "Noto Serif SC", serif。
- 代码直接写在顶层，不要写 <script> 标签，不要用 markdown 围栏。
- 不能使用：fetch / XMLHttpRequest / WebSocket / Worker / eval / new Function / localStorage / indexedDB / window.open / location 跳转 / window.parent / window.top。写了会被直接打回。

【一定要做到】
- 用 requestAnimationFrame 做动画循环；根据 window.innerWidth / innerHeight 设置画布大小并处理 resize；renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))。
- 这在手机上运行：不要后处理，不要实时阴影，几何体尽量简单，场景里物体少于 300 个，不要在动画循环里 new 几何体或材质，不要写死循环（while(true)、for(;;)）。
- 至少有一种手指能做的互动（拖动旋转视角、点一下触发、按住等），用 pointer 事件写，并设置 canvas 的 touch-action 为 none。
- 画面里要有写给用户的文字：至少两段，每段不超过 60 字，用你自己的口吻，具体、克制，像一个真实的人会写的话。不要客服式安慰，不要鸡汤。
- 画面右上角 64x64 像素的范围要留空（那里有关闭按钮），底部留出 24 像素。
- 不得使用 Emoji。
- 代码总长度不超过 ${FREE_BOOK_LIMITS.codeMax} 个字符。宁可简单、稳、好看，也不要复杂但跑不起来。

【封面】
书架上的封面颜色会自动跟随用户的主题，所以你只能选款式、写标题：
- motif 可选：mist（雾面）、ink（墨，深色）、blank（留白，一个细圆环）、line（细线）
- 标题不超过 ${BOOK_LIMITS.title} 个字，要像一本书的名字，不要写成一整句话。
- accent 是一个低饱和的点缀色（#rrggbb），比如 #7b7494 这种带一点灰的颜色。
- 署名写你自己的名字。

【输出格式（严格遵守，不要输出格式以外的任何文字）】
<book>
<title>书名</title>
<motif>mist</motif>
<accent>#7b7494</accent>
<sign>署名</sign>
<code>
（这里直接是 JavaScript 代码）
</code>
</book>`;
};

/* ------------------------------- 对外入口 ------------------------------- */

// 生成一本自由发挥的立体书。失败会抛出 Error，message 可以直接展示给用户。
// 流程：生成 -> 解析检查 -> 隐藏沙箱试跑；任何一步有问题，就把原因告诉角色让它重写，最多 attempts 次。
export const generateFreeBookContent = async ({ character, kind, userNote = '', context = '', moment = null }) => {
  const systemPrompt = await buildFreeBookSystemPrompt({ character, kind, userNote, context, moment });
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请现在就做这本立体书，严格按指定格式输出。' },
  ];

  let lastProblem = '';

  for (let attempt = 0; attempt < FREE_BOOK_LIMITS.attempts; attempt += 1) {
    const raw = await generateResponse(messages);
    const { content, problem } = parseFreeBookReply(raw);

    let failure = problem;

    if (content) {
      try {
        const { dryRunFreeBook } = await import('./popupBookFreeSandbox');
        const result = await dryRunFreeBook({
          code: content.freeCode,
          book: { cover: content.cover, sign: content.sign, kindLabel: getBookKind(kind).label },
        });
        if (result.ok) return content;
        failure = `代码运行时报错：${result.error}`;
      } catch (error) {
        // 试跑环境本身出问题（比如沙箱文件没加载出来）不拿来拒绝一本书。
        console.warn('自由模式试跑没能进行，直接采用生成结果：', error);
        return content;
      }
    }

    lastProblem = failure || '这份回复不能用。';
    if (attempt < FREE_BOOK_LIMITS.attempts - 1) {
      messages.push({ role: 'assistant', content: String(raw || '').slice(0, 20000) });
      messages.push({
        role: 'user',
        content: `上一次的结果不能用：${lastProblem}\n请修正后，按同样的格式完整地重新输出整本书（不要只给修改的部分）。`,
      });
    }
  }

  console.warn('自由模式最后一次失败原因：', lastProblem);
  throw new Error('这次自由发挥的书没有做成，可以再试一次。');
};