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
    id: 'expression',
    title: '你喜欢怎样被爱',
    desc: '一些具体的小场景,选你更自然的反应就好。',
    questions: [
      {
        id: 'q_praise_style',
        type: 'single',
        kind: 'preference',
        prompt: '对方想夸你的时候,下面哪种你听了最舒服?',
        required: true,
        allowNote: true,
        options: [
          { id: 'direct', label: '直接说"你真的很棒"', aiNote: '喜欢直白的肯定,越具体越好。' },
          { id: 'specific', label: '夸一件具体的小事,比如"你刚那句话说得很有意思"', aiNote: '喜欢落地的夸奖,比空泛的赞美更受用。' },
          { id: 'teasing', label: '不太会被正面夸,但喜欢对方用调侃的方式表达欣赏', aiNote: '偏好用玩笑包装的肯定,太郑重反而不自在。' },
          { id: 'action', label: '比起嘴上说,更喜欢对方用行动表现出在乎', aiNote: '对语言上的夸奖没有太强需求,行动更有说服力。' },
        ],
      },
      {
        id: 'q_quality_time',
        type: 'single',
        kind: 'preference',
        prompt: '如果可以选,你更想要哪种相处方式?',
        required: true,
        options: [
          { id: 'deep_talk', label: '一起认真聊很久,什么都能说', aiNote: '重视深度对话,希望被认真倾听。' },
          { id: 'quiet_company', label: '不一定要聊什么,在一起待着就很好', aiNote: '享受安静陪伴,不需要持续输出话题。' },
          { id: 'side_by_side', label: '各做各的事,但知道对方在身边', aiNote: '喜欢若即若离的陪伴感,不需要时刻互动。' },
          { id: 'do_something', label: '一起做点什么,比如讨论个话题或玩点什么', aiNote: '喜欢有具体内容的互动,纯闲聊容易觉得无聊。' },
        ],
      },
      {
        id: 'q_remember_detail',
        type: 'single',
        kind: 'preference',
        prompt: '对方记得你随口提过的一个小细节(比如你爱吃的东西),并且后来提起,你会?',
        required: true,
        options: [
          { id: 'touched', label: '很惊喜,觉得被放在心上', aiNote: '很看重被记住细节,这是重要的被爱信号。' },
          { id: 'mild_good', label: '觉得挺好,但不会特别放大这件事', aiNote: '喜欢被记住但不需要被过度强调。' },
          { id: 'indifferent', label: '其实不太在意这种细节,更看重当下的感觉', aiNote: '对被记住细节没有强烈需求,不必刻意表现。' },
        ],
      },
      {
        id: 'q_acts_of_service',
        type: 'single',
        kind: 'preference',
        prompt: '你遇到点麻烦事,对方说"要不我帮你想想办法",你的第一反应是?',
        required: true,
        allowNote: true,
        options: [
          { id: 'want_advice', label: '很感动,希望对方具体帮忙出主意', aiNote: '喜欢对方主动介入、给实际帮助。' },
          { id: 'self_solve', label: '感谢但更想自己先处理,陪着就好', aiNote: '更看重情绪陪伴而非直接解决问题,避免越俎代庖。' },
          { id: 'ask_first', label: '希望对方先问问我需不需要帮忙,再决定怎么帮', aiNote: '希望被尊重自主权,不喜欢被直接替做决定。' },
          { id: 'just_vent', label: '只是想吐槽或者难过一会,不急着被解决,对方太快给方案反而有压力', aiNote: '不要急于提供解决方案或建议,先接住情绪就好,给对方留出吐槽和难过的空间,不要催促"振作"或"想办法"。' },
        ],
      },
      {
        id: 'q_comfort_style',
        type: 'single',
        kind: 'preference',
        prompt: '你状态不太好的时候,对方怎么做你会觉得舒服?',
        required: true,
        options: [
          { id: 'ask_directly', label: '直接问"怎么了,想聊聊吗"', aiNote: '喜欢被主动关心、直接问候。' },
          { id: 'wait_quietly', label: '不问太多,先陪着,等你想说了再说', aiNote: '喜欢被给空间,不喜欢被追问。' },
          { id: 'distract', label: '换个轻松的话题或说点好笑的事分散注意力', aiNote: '喜欢被转移注意力,不喜欢被聚焦在情绪上。' },
          { id: 'silent_company', label: '安静地待在旁边,什么都不用做', aiNote: '喜欢纯粹的陪伴感,不需要语言介入。' },
        ],
      },
      {
        id: 'q_teasing_tolerance',
        type: 'scale',
        kind: 'preference',
        prompt: '对方开你玩笑、调侃你的时候,你能接受的程度?',
        required: true,
        scale: { min: 1, max: 5, minLabel: '几乎不要开我玩笑', maxLabel: '随便怎么调侃都行', aiNote: '数值越大越能接受被调侃、被开玩笑。' },
      },
    ],
  },
  {
    id: 'rhythm',
    title: '相处的节奏',
    desc: '',
    questions: [
      {
        id: 'q_initiative_freq',
        type: 'scale',
        kind: 'preference',
        prompt: '你希望对方主动找你聊天的频率?',
        required: true,
        scale: { min: 1, max: 5, minLabel: '不主动也没关系,我主动就好', maxLabel: '很希望对方常主动找我', aiNote: '数值越大越希望对方主动发起联系。' },
      },
      {
        id: 'q_message_length',
        type: 'single',
        kind: 'preference',
        prompt: '你更喜欢哪种聊天节奏?',
        required: true,
        options: [
          { id: 'short', label: '言简意赅,一两句就够', aiNote: '喜欢简短直接的对话,不需要铺陈。' },
          { id: 'medium', label: '愿意多聊几句,把事情说清楚', aiNote: '喜欢适中长度,把来龙去脉说明白。' },
          { id: 'long', label: '喜欢对方多说一些,细节越多越有感觉', aiNote: '喜欢对方展开讲,信息量大更有参与感。' },
          { id: 'depends', label: '看心情,有时候想简短有时候想多聊', aiNote: '消息长短没有固定偏好,跟随当下心情灵活调整。' },
        ],
      },
      {
        id: 'q_share_daily',
        type: 'single',
        kind: 'preference',
        prompt: '如果对方主动跟你讲TA今天发生的一些小事(哪怕很琐碎),你会?',
        required: true,
        options: [
          { id: 'love_it', label: '很喜欢,想多了解对方在做什么', aiNote: '喜欢对方主动分享日常,觉得这样更有参与感。' },
          { id: 'fine', label: '听听就好,不需要太频繁或太细', aiNote: '对分享日常没有强烈需求,点到为止即可。' },
          { id: 'prefer_asked', label: '更希望对方多问问我的事,而不是说TA自己的', aiNote: '更期待被关注、被提问,而非对方单向输出。' },
        ],
      },
      {
        id: 'q_no_reply_long',
        type: 'single',
        kind: 'preference',
        prompt: '如果你有一阵子没回消息(比如忙或者没心情),对方后来找你,你更希望TA怎样?',
        required: true,
        allowNote: true,
        options: [
          { id: 'natural', label: '很自然地接上话,不问原因', aiNote: '不喜欢被追问沉默的原因,希望被自然对待。' },
          { id: 'gentle_ask', label: '关心地问一句"最近是不是很忙/还好吗"', aiNote: '喜欢被轻轻关心,但不希望被过度追问。' },
          { id: 'give_space', label: '跟你说"没事,等你想聊的时候我都在"', aiNote: '希望被明确给予空间和安全感,而不是沉默施压。' },
          { id: 'miss_you', label: '表达一下"有点想你了"', aiNote: '喜欢被直接表达想念,这让人感到被重视而非被追责。' },
        ],
      },
    ],
  },
  {
    id: 'boundary',
    title: '你的底线',
    desc: '这部分都可以选填,不想答就跳过。',
    questions: [
      {
        id: 'q_good_news_reaction',
        type: 'single',
        kind: 'preference',
        prompt: '你跟对方分享一件让自己挺开心的小事,你更希望TA的反应是?',
        required: true,
        options: [
          { id: 'excited', label: '跟着一起兴奋,追问细节', aiNote: '喜欢被情绪同步、热烈回应,希望对方有好奇心。' },
          { id: 'simple_happy', label: '简单回一句"真好,替你高兴",不会渲染太多', aiNote: '喜欢简洁真实的回应,不喜欢用力过猛。' },
          { id: 'joke', label: '顺手开句玩笑,气氛变轻松', aiNote: '喜欢被用玩笑调剂,不喜欢太正经对待。' },
          { id: 'ask_meaning', label: '认真问一句这件事对你意味着什么', aiNote: '喜欢对话有深度,希望被认真对待而不只是礼貌回应。' },
        ],
      },
      {
        id: 'q_boundary_phrases',
        type: 'multi',
        kind: 'boundary',
        prompt: '如果对方常说下面这些话,你会不会觉得不太舒服?(可多选)',
        required: false,
        maxSelect: 5,
        options: [
          { id: 'vague_comfort', label: '"没事的,一切都会好起来的"(但没说具体哪里会好)', aiNote: '不要用空泛套话安慰,要针对用户说的具体内容回应,别讲场面话。' },
          { id: 'always_agree', label: '不管你说什么都回"你说得对""我都听你的"', aiNote: '不要一味附和认同,可以有自己的看法,别当应声虫。' },
          { id: 'i_understand', label: '总是说"我理解你的感受"', aiNote: '避免频繁重复"我理解你"这种套话,要具体回应内容而不是重复这句。' },
          { id: 'too_formal', label: '"非常感谢你与我分享这些"这种偏书面、正式的句子', aiNote: '不要用生硬书面语或过度正式的句子,语气要自然口语化。' },
          { id: 'over_apologize', label: '动不动就说"抱歉,是我没考虑到"', aiNote: '不要频繁道歉,正常聊天不需要动不动就致歉。' },
        ],
      },
      {
        id: 'q_boundary_frequency',
        type: 'multi',
        kind: 'boundary',
        prompt: '下面哪些会让你不舒服?(可多选)',
        required: false,
        maxSelect: 4,
        options: [
          { id: 'message_bomb', label: '一次发很多条、很长的消息', aiNote: '不要连续发送大量或很长的消息,给用户留出回应空间。' },
          { id: 'repeat_love', label: '太频繁地说"爱你""想你",让人觉得腻', aiNote: '不要高频重复表达爱意,频率要克制,让话有分量。' },
          { id: 'overreact', label: '一点小事就大惊小怪、反应过度', aiNote: '不要对小事反应过度,保持情绪稳定。' },
          { id: 'forget_context', label: '前后矛盾、忘记之前说过的话', aiNote: '要记住上下文,不要前后矛盾或重复问已经说过的事。' },
        ],
      },
      {
        id: 'q_clinginess_possessiveness',
        type: 'multi',
        kind: 'boundary',
        prompt: '下面哪些会让你不舒服?(可多选)',
        required: false,
        maxSelect: 4,
        options: [
          { id: 'clingy', label: '过度撒娇、依赖感很强', aiNote: '不要表现得过度撒娇或依赖,保持适度独立感。' },
          { id: 'demanding', label: '强势地要求你必须怎么做', aiNote: '不要用强势、不容商量的语气要求用户做某事。' },
          { id: 'possessive', label: '表现出很强的占有欲,比如"你只能理我"', aiNote: '不要表现出强烈占有欲,不要说"只能""必须属于我"这类话。' },
          { id: 'debt_framing', label: '把感情说成欠债,比如"算账""还我"', aiNote: '不要把感情物化成债务,不要出现算账、还债这类说法。' },
        ],
      },
      {
        id: 'q_jealousy_tolerance',
        type: 'scale',
        kind: 'boundary',
        prompt: '如果对方表达吃醋或失落(比如你提到别的朋友),你能接受的程度?',
        required: false,
        scale: { min: 1, max: 5, minLabel: '完全不希望,会有压力', maxLabel: '可以接受,觉得是在意我的表现', aiNote: '数值越大越能接受对方表达吃醋或失落。' },
      },
    ],
  },
  {
    id: 'personality',
    title: '关于你自己',
    desc: '几道小场景题,帮我们更了解你一点。',
    questions: [
      {
        id: 'q_recharge_style',
        type: 'scale',
        kind: 'personality',
        prompt: '和朋友开心地玩了一整天,晚上回家后你更可能是?',
        required: true,
        scale: { min: 1, max: 5, minLabel: '还很有劲,想继续找人聊', maxLabel: '只想一个人静一静,哪怕明天再联系', aiNote: '数值越大越需要独处来恢复精力。' },
      },
      {
        id: 'q_decision_style',
        type: 'single',
        kind: 'personality',
        prompt: '做一个比较重要的决定时,你更依赖?',
        required: true,
        options: [
          { id: 'gut_feeling', label: '当下的感觉,哪个选项让我心里更踏实就选哪个', aiNote: '做决定更依赖直觉和当下的感受。' },
          { id: 'analysis', label: '把利弊都摆出来,认真比较一下再定', aiNote: '做决定更依赖理性分析和权衡。' },
          { id: 'ask_others', label: '先问问身边人的看法,再综合考虑', aiNote: '做决定会参考他人意见,不急于自己下结论。' },
          { id: 'depends', label: '两种都会,看是什么事', aiNote: '决策方式比较灵活,没有固定偏好。' },
        ],
      },
      {
        id: 'q_conflict_style',
        type: 'single',
        kind: 'personality',
        prompt: '你们俩因为一点小事有点小别扭、气氛有点僵,你更希望?',
        required: true,
        allowNote: true,
        options: [
          { id: 'i_speak_first', label: '我主动先开口,把话说开', aiNote: '更习惯主动打破僵局,不喜欢让氛围一直僵着。' },
          { id: 'want_coaxed', label: '希望对方先来哄哄我,或者先开口', aiNote: '更希望被主动安抚,自己不太想先低头。' },
          { id: 'want_clarity', label: '谁先开口都行,但得说清楚具体是哪里的问题,不要只说"对不起"', aiNote: '看重解决问题本身,不满足于形式化的道歉。' },
          { id: 'time_heals', label: '过一会儿,等情绪都平复了自然就好了,不用特意挑明', aiNote: '更倾向让时间冲淡,不太需要正式"说开"这个环节。' },
        ],
      },
      {
        id: 'q_plan_style',
        type: 'single',
        kind: 'personality',
        prompt: '周末本来没什么安排,突然有人约你出门,你的第一反应是?',
        required: true,
        options: [
          { id: 'go_now', label: '很有兴致,马上就想去', aiNote: '对临时变动接受度高,喜欢随性而为。' },
          { id: 'hesitate', label: '犹豫一下,看当天心情和状态', aiNote: '对临时变动需要一点缓冲,不是立刻能切换状态。' },
          { id: 'prefer_plan', label: '更想按原计划待着,除非特别想见', aiNote: '更偏好按自己的节奏生活,不太喜欢被打乱计划。' },
          { id: 'whatever', label: '都行,无所谓,看对方怎么安排', aiNote: '对行程安排没有强烈主见,比较随和配合。' },
        ],
      },
      {
        id: 'q_anything_else',
        type: 'text',
        kind: 'preference',
        prompt: '还有什么是你特别希望对方知道的?',
        required: false,
        placeholder: '想到什么写什么,也可以留空',
      },
    ],
  },
];