// src/apps/snapshots/services/snapshotAiService.js
import db from '../../../db';

// 严格零 Emoji 过滤器
export const removeEmoji = (text) =>
  String(text || '')
    .replace(/[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]/g, '')
    .trim();

// 统一双通道读取 API 配置 (优先读取 apiConfig 对象，回退到散落项)
export const getApiConfig = async () => {
  const settingObj = await db.settings.get('apiConfig');
  const apiConfig = settingObj?.value || {};

  let apiKey = String(apiConfig.apiKey || '').trim();
  let baseUrl = String(apiConfig.baseUrl || '').trim();
  let model = String(apiConfig.model || '').trim();

  // 若 apiConfig 为空，尝试回退到单项
  if (!apiKey) {
    const k = await db.settings.get('apiKey');
    apiKey = String(k?.value || '').trim();
  }
  if (!baseUrl) {
    const b = await db.settings.get('baseUrl');
    baseUrl = String(b?.value || '').trim();
  }
  if (!model) {
    const m = await db.settings.get('model');
    model = String(m?.value || '').trim();
  }

  baseUrl = baseUrl.replace(/\/+$/, '');
  if (!apiKey || !baseUrl) {
    throw new Error('未检测到有效的 API Key 与 Base URL，请在系统设置中配置。');
  }

  return {
    apiKey,
    baseUrl,
    model: model || 'gpt-4o-mini'
  };
};

const callAi = async (messages, temperature = 0.75, maxTokens = 400) => {
  const { apiKey, baseUrl, model } = await getApiConfig();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || errJson?.message || detail;
    } catch {}
    throw new Error(`AI 请求失败 (HTTP ${response.status}): ${detail}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  return removeEmoji(raw);
};

// ==========================================
// 1. 动态生成: Char 伴侣发布拍立得动态
// ==========================================
export const generateCharacterPost = async (characterId, chatId = null, topicHint = '') => {
  const char = await db.characters.get(Number(characterId));
  if (!char) throw new Error('找不到指定的陪伴角色');

  let memoryContext = '';
  if (chatId) {
    const recentMsgs = await db.messages
      .where('chatId')
      .equals(Number(chatId))
      .reverse()
      .limit(6)
      .toArray();

    if (recentMsgs.length > 0) {
      memoryContext = '【近期与用户的对话记忆片段】:\n' +
        recentMsgs.reverse().map(m => `${m.sender}: ${m.content}`).join('\n');
    }
  }

  const systemPrompt = `你正在扮演角色 [${char.name}]，在个人拍立得生活动态圈发布一条即时生活随笔。

【角色人设】
姓名: ${char.name}
简介: ${char.bio || '无'}
性格/习惯: ${char.extraNotes || '无'}

${memoryContext}

【绝对规则】
1. 输出必须是合法的纯 JSON 字符串，绝不要使用 Markdown 语法包装，包含以下三个字段：
   - "imagePrompt": 照片画面的微观细节描摹，包含光影、色调、具体物件，80字以内，文学质感；
   - "content": 配合相片的随笔文字，不超过100字，带有生活温度；
   - "location": 简短地点名称（例如：晨光窗台、旧书店街角、转角长椅）。
2. 绝对禁止使用任何 Emoji 字符。
3. 严格符合你的角色人设口吻。`;

  const userPrompt = topicHint
    ? `请围绕心境或灵感：“${topicHint}” 创作这条拍立得生活随笔。`
    : `请根据此刻的心境与生活状态，创作一条自然的拍立得生活动态。`;

  const result = await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]);

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        imagePrompt: removeEmoji(parsed.imagePrompt || ''),
        content: removeEmoji(parsed.content || ''),
        location: removeEmoji(parsed.location || '某处光影')
      };
    } catch {}
  }

  return {
    imagePrompt: `[微观镜头: ${char.name} 桌前散落的光影与字迹]`,
    content: result.slice(0, 100),
    location: '日常生活'
  };
};

// ==========================================
// 2. 动态生成: NPC 街坊生活碎片发帖 (生活交集碰撞)
// ==========================================
export const generateNpcPost = async (npc, charName = '', userName = '', topicHint = '') => {
  const systemPrompt = `你是一个常驻生活在小镇/街区里的 NPC 角色 [${npc.name}]，你的职业/身份是 [${npc.roleTag || '街区邻里'}]。
你正在社交生活圈发布一条属于你职业与日常特质的真实拍立得动态。

【同城生活的邻里常客】
- 常常出没的伙伴: ${charName || '熟悉的面孔'}
- 另一位常客: ${userName || 'User'}

【创作指导】
1. 内容必须强烈体现你的职业标签（例如花店店主提到了修剪残枝、咖啡师提到了刚烘焙的新批次豆子、摄影师拍下的逆光街景）。
2. 可以自然、不经意地带出一丝与同城伙伴的生活交集（例如：“方才看见 ${charName || '熟悉的身影'} 匆匆走过街口”，或者提及常客的小习惯），让整个街区生活圈产生真实的偶遇感。
3. 必须输出纯 JSON 字符串，不要带 Markdown 语法：
   - "imagePrompt": 照片画面的细节描摹，80字以内；
   - "content": 随感正文，不超过100字；
   - "location": 与你身份相符的地点（如：木槿花房、烘焙吧台、转角书店）。
4. 绝对禁止使用任何 Emoji。`;

  const userPrompt = topicHint
    ? `请围绕主题：“${topicHint}” 记录你的生活切片。`
    : `请以 [${npc.name}] 的身份记录当下的街区生活碎片。`;

  const result = await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]);

  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        imagePrompt: removeEmoji(parsed.imagePrompt || ''),
        content: removeEmoji(parsed.content || ''),
        location: removeEmoji(parsed.location || `${npc.name}的日常角落`)
      };
    } catch {}
  }

  return {
    imagePrompt: `[街区随拍: ${npc.name} 忙碌的工作台]`,
    content: result.slice(0, 100),
    location: `${npc.name}的小店`
  };
};

// ==========================================
// 3. 评论生成: Char 或 NPC 为动态写评论
// ==========================================
export const generateSnapshotComment = async (snapshot, commenter) => {
  let commenterDesc = '';
  let relationDesc = '同城社交好友或路过邻里';

  if (commenter.type === 'character') {
    const char = await db.characters.get(Number(commenter.id));
    commenterDesc = `角色姓名: ${char?.name}\n人设简介: ${char?.bio}\n性格特征: ${char?.extraNotes}`;

    // 检查关系矩阵
    if (snapshot.characterId && Number(snapshot.characterId) !== Number(commenter.id)) {
      const rel = await db.snapshotRelations
        .where('characterId')
        .equals(Number(snapshot.characterId))
        .toArray();
      const matched = rel.find(r => Number(r.targetCharacterId) === Number(commenter.id));
      if (matched?.relation) relationDesc = `你与动态作者的关系是: ${matched.relation}`;
    }
  } else {
    commenterDesc = `NPC 姓名: ${commenter.name}\n职业身份: ${commenter.roleTag || '街区邻里'}`;
  }

  const systemPrompt = `你正在以 [${commenter.name}] 的身份，为一条拍立得生活动态留言。

【动态作者】: ${snapshot.authorName || '某位朋友'}
【动态画面】: ${snapshot.imagePrompt || '无画面描摹'}
【动态正文】: ${snapshot.content || '无正文'}
【打卡地点】: ${snapshot.location || '某处'}

【你的身份】:
${commenterDesc}

【与作者的社交关系】:
${relationDesc}

【规则】
1. 语言简练，20-50字以内，像真实生活圈里的留言。
2. 符合你的人物设定或职业口吻，可以温和打趣、问候、探讨画面物件或随口附和。
3. 绝对禁止使用任何 Emoji。
4. 仅输出评论文本本身，不要附加额外引号或前缀。`;

  return await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请为这条生活动态写下一条自然真切的短评。' }
  ], 0.7, 150);
};

// ==========================================
// 4. 追评回复: Char 或 NPC 回复某条评论 (多轮接话)
// ==========================================
export const generateSnapshotReply = async (snapshot, responder, replyTargetComment, userReplyText = '') => {
  let responderDesc = '';
  if (responder.type === 'character') {
    const char = await db.characters.get(Number(responder.id));
    responderDesc = `角色姓名: ${char?.name}\n人设: ${char?.bio || ''} / ${char?.extraNotes || ''}`;
  } else {
    responderDesc = `NPC 姓名: ${responder.name}\n职业身份: ${responder.roleTag || '街区邻里'}`;
  }

  const systemPrompt = `你正在拍立得动态下方，以 [${responder.name}] 的身份回复来自 [${replyTargetComment.senderName}] 的评论。

【动态原帖背景】:
作者: ${snapshot.authorName}
正文/画面: ${snapshot.content || snapshot.imagePrompt}

【被回复的评论】:
${replyTargetComment.senderName}: "${replyTargetComment.content}"

${userReplyText ? `【对方的最新回复】:\n"${userReplyText}"` : ''}

【你的身份】:
${responderDesc}

【规则】
1. 像日常交谈一样自然接话，20-60字以内。
2. 保持你的性格或职业身份口吻一致。
3. 绝对禁止使用任何 Emoji。
4. 仅输出回复正文，不要附加额外修饰。`;

  return await callAi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请生成自然得体的接续回复。' }
  ], 0.75, 150);
};
