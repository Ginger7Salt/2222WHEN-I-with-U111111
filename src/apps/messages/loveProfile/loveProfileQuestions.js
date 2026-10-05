// src/apps/messages/loveProfile/loveProfileQuestions.js
//
// 「情感偏好问卷」的题目内容——只放数据，不放任何逻辑。
// 格式定义见 loveProfileSchema.js 文件顶部的注释；换题/加题只改这个文件。
//
// 下面是 3 道【占位示例题】，用来保证界面在题目还没替换之前也能跑通、
// 各题型都能被测试到。正式题目由另一个 AI 起草后，整个文件替换即可。
//
// 改题注意：
//   - 题目 id、选项 id 一旦上线就不要再改（答案以它们为键存库）。
//     想换措辞只改 prompt/label；想彻底换一道题就用新 id。
//   - 改动较大（增删题、改变含义）时，把下面的 LOVE_PROFILE_QUESTIONNAIRE_VERSION
//     加 1，界面会提醒已填过的用户"题目已更新，建议重新填写"。
//   - 不要在题目或选项里使用 emoji。

export const LOVE_PROFILE_QUESTIONNAIRE_VERSION = 1;

export const LOVE_PROFILE_SECTIONS = [
  {
    id: 'sample_section',
    title: '示例分页',
    desc: '这是占位示例，正式题目替换后这里会变成真实内容。',
    questions: [
      {
        id: 'sample_single',
        type: 'single',
        kind: 'preference',
        prompt: '示例单选题：你加班到很晚才回消息，第二天对方更自然的反应是？',
        required: true,
        allowNote: true,
        options: [
          { id: 'a', label: '像平常一样聊天，不特意提起', aiNote: '不喜欢被追问，偏好自然的日常延续' },
          { id: 'b', label: '轻轻问一句昨晚是不是很累', aiNote: '喜欢被关心，但不要太用力' },
        ],
      },
      {
        id: 'sample_scale',
        type: 'scale',
        kind: 'personality',
        prompt: '示例量表题：你希望对方主动联系你的频率？',
        required: true,
        scale: { min: 1, max: 5, minLabel: '很少就好', maxLabel: '越多越好' },
      },
      {
        id: 'sample_boundary_multi',
        type: 'multi',
        kind: 'boundary',
        prompt: '示例多选题：下面哪些说话方式会让你不舒服？（可多选）',
        required: false,
        maxSelect: 3,
        options: [
          { id: 'a', label: '命令的口吻', aiNote: '不要用"你必须""快去"这类祈使句' },
          { id: 'b', label: '把感情说成欠债', aiNote: '不要出现算账、利息、还我这类说法' },
        ],
      },
    ],
  },
];