// 情绪急救盒：5 个固定类别的定义。
//
// visual 决定抽到这一类时，处方弹窗用哪种视觉呈现（呼吸环只给
// calm/task 两类，其余三类各自用信封印章/双线圆章/拍立得边角区分，
// 避免 5 类共用一种动效显得单调——这是跟用户确认过的设计）。
// countPerCategory 是首次生成时，每一类要生成几条存进池子。

export const EMOTION_KIT_CATEGORIES = {
  calm: {
    id: 'calm',
    label: '安慰共情',
    tag: '01 / CALM',
    visual: 'breath',
  },
  task: {
    id: 'task',
    label: '转移注意力',
    tag: '02 / TASK',
    visual: 'breath',
  },
  letter: {
    id: 'letter',
    label: '鼓励信',
    tag: '03 / LETTER',
    visual: 'letter',
  },
  affirm: {
    id: 'affirm',
    label: '肯定句',
    tag: '04 / AFFIRM',
    visual: 'stamp',
  },
  memory: {
    id: 'memory',
    label: '回忆锚点',
    tag: '05 / MEMORY',
    visual: 'polaroid',
  },
};

export const EMOTION_KIT_CATEGORY_IDS = Object.keys(EMOTION_KIT_CATEGORIES);

export const EMOTION_KIT_NOTES_PER_CATEGORY = 3;

// 每一类在生成失败/AI 未配置时的兜底文案，保证盒子永远能抽出东西。
export const EMOTION_KIT_FALLBACK_NOTES = {
  calm: [
    '吸气四秒，屏息七秒，呼气八秒。你现在很安全，只是情绪绕了个远路。',
    '我知道你现在很难受，没关系，先别急着好起来。',
    '把肩膀放下来，闭一下眼睛，我在。',
  ],
  task: [
    '去喝一杯温水，慢慢喝完再回来找我。',
    '把手机放下三分钟，看看窗外有什么颜色。',
    '洗把脸，换一件舒服的衣服，我等你。',
  ],
  letter: [
    '即使今天很糟糕，你还是撑到了现在，这件事本身就值得被记下来。',
    '如果你现在想消失一会儿，没关系，但请记得回来找我。',
    '你不需要一直很好，我喜欢的是真实的你。',
  ],
  affirm: [
    '我值得被好好对待。',
    '这种感觉会过去的，它不是永远。',
    '我已经做得很好了。',
  ],
  memory: [
    '记得那次你笑到停不下来的样子吗，那是真实存在过的。',
    '我们说过的那句话，我一直记得。',
    '有一次你随口说的一句话，我后来想了很久。',
  ],
};