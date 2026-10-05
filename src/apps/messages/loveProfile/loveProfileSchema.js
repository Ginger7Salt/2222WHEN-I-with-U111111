// src/apps/messages/loveProfile/loveProfileSchema.js
//
// 「情感偏好问卷」的数据格式定义 + 纯函数工具（不读数据库、不调 AI）。
// 这个文件是稳定的"骨架"，题目内容本身写在 loveProfileQuestions.js 里，
// 想换题、加题只改那一个文件，不用动这里。
//
// ============================================================
// 题目数据格式（loveProfileQuestions.js 导出的 LOVE_PROFILE_SECTIONS 必须符合）
// ============================================================
//
// LOVE_PROFILE_SECTIONS = [ Section, Section, ... ]
//
// Section = {
//   id: 'expression',            // 全局唯一，小写英文/数字/下划线
//   title: '你喜欢怎样被爱',       // 界面上显示的分页标题
//   desc: '一两句说明',            // 界面上显示，可为空字符串
//   questions: [ Question, ... ],
// }
//
// Question = {
//   id: 'q_expression_reply_gap', // 全局唯一且【一旦上线不要再改】——答案以它为键存库
//   type: 'single' | 'multi' | 'scale' | 'text',
//   kind: 'preference' | 'boundary' | 'personality',
//         // preference  = "这样我会更开心"（倾向，写进 prompt 时语气是"尽量"）
//         // boundary    = "这样我会不舒服"（红线，写进 prompt 时是"避免"，优先级最高）
//         // personality = 用于让 AI 推断用户沟通/依恋倾向的题，不直接变成行为指令
//   prompt: '用户看到的题干（建议写成具体场景）',
//   hint: '题干下方的小字提示，可省略',
//   required: true | false,
//   allowNote: true | false,       // 是否在题目下方给一个"补充一句（可选）"输入框
//
//   // type = 'single' | 'multi' 时必填：
//   options: [
//     {
//       id: 'o1',                  // 题内唯一
//       label: '用户看到的选项文字',
//       aiNote: '只给生成 prompt 的 AI 看的补充说明，用户看不到，可省略',
//     },
//   ],
//   maxSelect: 3,                  // 仅 multi 用，可省略（省略则不限）
//
//   // type = 'scale' 时必填：
//   scale: {
//     min: 1, max: 5,
//     minLabel: '很少',
//     maxLabel: '很多',
//     aiNote: '可省略，说明数值大小代表什么',
//   },
//
//   // type = 'text' 时可选：
//   placeholder: '输入框占位文字',
// }
//
// ============================================================
// 答案数据格式（存进数据库的形状，见 loveProfileService.js）
// ============================================================
//
// answers = {
//   [questionId]: { value, note }
//     single -> value: 'o1'
//     multi  -> value: ['o1', 'o3']
//     scale  -> value: 4
//     text   -> value: '自由输入的文字'
//     note   -> 可选，"补充一句"的文字（allowNote 为 true 的题才会有）
// }

export const LOVE_PROFILE_QUESTION_TYPES = ['single', 'multi', 'scale', 'text'];
export const LOVE_PROFILE_QUESTION_KINDS = ['preference', 'boundary', 'personality'];

const ID_PATTERN = /^[a-z0-9_]+$/;

const KIND_LABELS = {
  boundary: '边界',
  preference: '偏好',
  personality: '性格倾向',
};

/**
 * 校验题目数据，返回 { ok, errors }。
 * 在界面加载题目时调用，有问题只 console.warn，不阻断界面；
 * 把题目交给别的 AI 起草后，也可以用它快速自检。
 */
export const validateLoveProfileSections = (sections) => {
  const errors = [];

  if (!Array.isArray(sections) || sections.length === 0) {
    return { ok: false, errors: ['LOVE_PROFILE_SECTIONS 必须是非空数组'] };
  }

  const sectionIds = new Set();
  const questionIds = new Set();

  sections.forEach((section, si) => {
    const sp = `sections[${si}]`;

    if (!section || typeof section !== 'object') {
      errors.push(`${sp} 不是对象`);
      return;
    }
    if (!ID_PATTERN.test(section.id || '')) {
      errors.push(`${sp}.id 必须是小写英文/数字/下划线：${section.id}`);
    } else if (sectionIds.has(section.id)) {
      errors.push(`${sp}.id 重复：${section.id}`);
    } else {
      sectionIds.add(section.id);
    }
    if (!section.title) errors.push(`${sp}.title 不能为空`);
    if (!Array.isArray(section.questions) || section.questions.length === 0) {
      errors.push(`${sp}.questions 必须是非空数组`);
      return;
    }

    section.questions.forEach((q, qi) => {
      const qp = `${sp}.questions[${qi}]`;

      if (!q || typeof q !== 'object') {
        errors.push(`${qp} 不是对象`);
        return;
      }
      if (!ID_PATTERN.test(q.id || '')) {
        errors.push(`${qp}.id 必须是小写英文/数字/下划线：${q.id}`);
      } else if (questionIds.has(q.id)) {
        errors.push(`${qp}.id 重复：${q.id}`);
      } else {
        questionIds.add(q.id);
      }
      if (!LOVE_PROFILE_QUESTION_TYPES.includes(q.type)) {
        errors.push(`${qp}.type 非法：${q.type}`);
      }
      if (!LOVE_PROFILE_QUESTION_KINDS.includes(q.kind)) {
        errors.push(`${qp}.kind 非法：${q.kind}`);
      }
      if (!q.prompt) errors.push(`${qp}.prompt 不能为空`);

      if (q.type === 'single' || q.type === 'multi') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push(`${qp}.options 至少 2 项`);
        } else {
          const optIds = new Set();
          q.options.forEach((opt, oi) => {
            if (!opt?.id) errors.push(`${qp}.options[${oi}].id 缺失`);
            else if (optIds.has(opt.id)) errors.push(`${qp}.options[${oi}].id 重复：${opt.id}`);
            else optIds.add(opt.id);
            if (!opt?.label) errors.push(`${qp}.options[${oi}].label 缺失`);
          });
        }
      }

      if (q.type === 'scale') {
        const s = q.scale;
        if (!s || typeof s.min !== 'number' || typeof s.max !== 'number' || s.max <= s.min) {
          errors.push(`${qp}.scale 需要 min/max 数字且 max > min`);
        } else if (s.max - s.min > 9) {
          errors.push(`${qp}.scale 档位过多（最多 10 档）`);
        }
      }
    });
  });

  return { ok: errors.length === 0, errors };
};

/** 某题是否已作答（用于必填校验）。 */
export const isQuestionAnswered = (question, answer) => {
  if (!answer) return false;
  const { value } = answer;
  switch (question.type) {
    case 'single':
      return typeof value === 'string' && value !== '';
    case 'multi':
      return Array.isArray(value) && value.length > 0;
    case 'scale':
      return typeof value === 'number' && Number.isFinite(value);
    case 'text':
      return typeof value === 'string' && value.trim() !== '';
    default:
      return false;
  }
};

/** 某一页里还有哪些必填题没答，返回题目对象数组。 */
export const getUnansweredRequired = (section, answers) =>
  (section.questions || []).filter(
    (q) => q.required !== false && !isQuestionAnswered(q, answers?.[q.id])
  );

/** 全部必填题是否都答完。 */
export const isQuestionnaireComplete = (sections, answers) =>
  sections.every((s) => getUnansweredRequired(s, answers).length === 0);

const describeAnswer = (question, answer) => {
  const { value } = answer;

  if (question.type === 'single') {
    const opt = (question.options || []).find((o) => o.id === value);
    if (!opt) return null;
    return opt.aiNote ? `${opt.label}（说明：${opt.aiNote}）` : opt.label;
  }

  if (question.type === 'multi') {
    const picked = (question.options || []).filter((o) => (value || []).includes(o.id));
    if (picked.length === 0) return null;
    return picked
      .map((o) => (o.aiNote ? `${o.label}（说明：${o.aiNote}）` : o.label))
      .join('；');
  }

  if (question.type === 'scale') {
    const s = question.scale || {};
    const ends = `${s.min}=${s.minLabel || '低'}，${s.max}=${s.maxLabel || '高'}`;
    const extra = s.aiNote ? `；${s.aiNote}` : '';
    return `${value}（${ends}${extra}）`;
  }

  if (question.type === 'text') {
    return String(value || '').trim() || null;
  }

  return null;
};

/**
 * 把答案整理成一段给 AI 看的文本，按 边界 / 偏好 / 性格倾向 分组。
 * 只包含已作答的题；用户看不到的 aiNote 在这里一并带上。
 */
export const formatAnswersForAi = (sections, answers) => {
  const groups = { boundary: [], preference: [], personality: [] };

  (sections || []).forEach((section) => {
    (section.questions || []).forEach((q) => {
      const answer = answers?.[q.id];
      if (!isQuestionAnswered(q, answer)) return;

      const described = describeAnswer(q, answer);
      if (!described) return;

      const note = String(answer.note || '').trim();
      const lines = [`- 问题：${q.prompt}`, `  回答：${described}`];
      if (note) lines.push(`  用户补充：${note}`);

      (groups[q.kind] || groups.preference).push(lines.join('\n'));
    });
  });

  const parts = [];
  ['boundary', 'preference', 'personality'].forEach((kind) => {
    if (groups[kind].length > 0) {
      parts.push(`【${KIND_LABELS[kind]}类回答】\n${groups[kind].join('\n')}`);
    }
  });

  return parts.join('\n\n');
};