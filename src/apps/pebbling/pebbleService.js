// src/apps/pebbling/pebbleService.js
import db from '../../db';
import * as aiServiceModule from '../../services/aiService';
import {
  PEBBLE_TYPES,
  normalizeGiftCategory,
  pickRandomFallbackGift,
} from './pebbleTypes';

// 这次要不要额外带一件礼物回来，是在生成之前就先掷骰子决定的（而不是生成完了
// 再抽），这样才能提前告诉 AI"这次请自由发挥一件礼物"，让礼物的名字/描述/
// 类别都由 AI 按角色人设自己想，而不是从固定池子里选。
const GIFT_CHANCE = 0.4;

// AI 被要求在这次带礼物时，于回复正文的最后单独一行，按这个格式追加礼物信息：
// [礼物]名称：一枚旧胸针|类别：饰品类|描述：抽屉里翻出来的，样式有点旧，但很喜欢。
// 之所以约定成"正文最后一行"而不是要求 AI 返回 JSON，是因为这里复用的是普通
// 聊天补全接口（见 invokeAI），没有严格的结构化输出保证，单行文本更容易稳定命中，
// 解析失败了也只是"这次礼物没顺利生成"，不会连正文一起坏掉。
const GIFT_LINE_REGEX = /\n?\[礼物\]\s*名称[:：]\s*([^|]+?)\s*\|\s*类别[:：]\s*([^|]+?)\s*\|\s*描述[:：]\s*(.+?)\s*$/m;

function buildGiftPromptHint(userName) {
  return `\n\n这次你还想随手带一件礼物回来。请自由发挥——可以是任何符合你人设、此刻情境的小物件，
不必局限于某几种固定的东西。想好之后，在你的话说完之后，另起一行，严格按下面的格式追加一行（不要有多余文字、不要用 Emoji）：
[礼物]名称：礼物的名字|类别：从"植物类/信件类/饰品类/食物类/其他"里选一个最贴切的|描述：一句话说说这是什么、为什么想带给${userName}
请先自然地在正文里把这次分享的事情讲完，再单独追加这一行礼物信息。`;
}

// 把 AI 回复末尾按格式追加的礼物信息解析出来，并从正文里去掉这一行。
// 解析不到就当作"这次没有礼物"，把全文原样当作正文返回。
function parseGiftFromReply(rawText) {
  const text = String(rawText || '');
  const match = text.match(GIFT_LINE_REGEX);

  if (!match) {
    return { content: text.trim(), gift: null };
  }

  const [fullMatch, rawName, rawCategory, rawDesc] = match;
  const content = text.slice(0, match.index).trim() || text.replace(fullMatch, '').trim();
  const categoryLabel = rawCategory.trim();

  return {
    content,
    gift: {
      name: rawName.trim(),
      desc: rawDesc.trim(),
      categoryLabel,
      categoryKey: normalizeGiftCategory(categoryLabel),
    },
  };
}

/**
 * AI 服务通用自适应调用器
 * 自动识别 aiService.js 中实际导出的函数并进行参数适配，避免 Rollup 导出匹配报错
 */
async function invokeAI(messages, options = {}) {
  // 自动搜寻 aiService.js 导出的有效 AI 生成函数
  const aiFn = 
    aiServiceModule.generateResponse ||
    aiServiceModule.generateAIResponse ||
    aiServiceModule.generateChatResponse ||
    aiServiceModule.callAI ||
    aiServiceModule.sendChatMessage ||
    aiServiceModule.generateText ||
    aiServiceModule.chat ||
    (typeof aiServiceModule.default === 'function' ? aiServiceModule.default : null) ||
    (aiServiceModule.default && typeof aiServiceModule.default.sendMessage === 'function' ? aiServiceModule.default.sendMessage : null) ||
    (aiServiceModule.default && typeof aiServiceModule.default.generate === 'function' ? aiServiceModule.default.generate : null);

  if (!aiFn) {
    console.warn('Pebbling: 未在 aiService.js 中找到标准 AI 接口，使用保底兜底回复');
    return null;
  }

  // 尝试不同的参数签名适配
  try {
    // 签名 1: standard (messages, options)
    const result = await aiFn(messages, options);
    if (typeof result === 'string') return result;
    if (result && typeof result.content === 'string') return result.content;
    if (result && typeof result.text === 'string') return result.text;
    if (result && typeof result.reply === 'string') return result.reply;
    return String(result || '');
  } catch (err1) {
    try {
      // 签名 2: object style ({ systemPrompt, prompt, messages, ...options })
      const systemMsg = messages.find(m => m.role === 'system')?.content || '';
      const userMsg = messages.find(m => m.role === 'user')?.content || '';
      const result = await aiFn({
        systemPrompt: systemMsg,
        prompt: userMsg,
        messages,
        ...options
      });
      if (typeof result === 'string') return result;
      if (result && typeof result.content === 'string') return result.content;
      if (result && typeof result.text === 'string') return result.text;
      return String(result || '');
    } catch (err2) {
      console.error('Pebbling invokeAI failed:', err2);
      throw err2;
    }
  }
}

// 随机挑选石头类型
function getRandomStoneType() {
  const keys = Object.keys(PEBBLE_TYPES);
  return keys[Math.floor(Math.random() * keys.length)];
}

// 1. 用户投掷小石头入巢
export async function throwPebble({ characterId, stoneType, userContent, delayMinutes = 15 }) {
  const now = Date.now();
  const respondAt = now + delayMinutes * 60 * 1000;

  const pebbleData = {
    characterId: Number(characterId),
    sender: 'user',
    stoneType: stoneType || 'stream-pebble',
    userContent,
    status: 'pending', // 'pending' | 'replied'
    createdAt: now,
    respondAt,
    aiResponse: null,
  };

  const id = await db.pebblings.add(pebbleData);
  return { id, ...pebbleData };
}

// 2. AI 主动投掷石头给 User
export async function aiInitiatePebble(characterId) {
  const char = await db.characters.get(Number(characterId));
  if (!char) return null;

  const userProfile = (await db.profile.get(1)) || {};
  const userName = userProfile.name || '你';
  const stoneType = getRandomStoneType();
  const stoneConfig = PEBBLE_TYPES[stoneType];

  /*
   * 之前这里读的是 char.personality，但角色编辑器从来没有写过这个字段，
   * 所以每个角色生成出来的内容其实都一样、全靠"温暖贴心"这句兜底文案撑着。
   * 改成跟项目里其它生成场景一致的 bio / extraNotes / worldBook，
   * 让每个角色带回来的石头真正带着自己的人设说话。
   */
  const worldBookText = char.worldBook
    ? `\n- 专属世界书：${char.worldBook}`
    : '';

  // 是否带礼物回来，提前掷骰子决定；决定要带的话，就在 prompt 里请 AI 自由发挥。
  const wantsGift = Math.random() < GIFT_CHANCE;
  const giftHint = wantsGift ? buildGiftPromptHint(userName) : '';

  const systemPrompt = `你叫 ${char.name}。
【角色人设】：${char.bio || '温暖贴心'}
【补充设定】：${char.extraNotes || '无'}${worldBookText}

你不是在"完成一个投石头的任务"，而是这段时间里，你自己确实留意到了什么——
可能是随手翻到的一件小事、一个念头、一点情绪，也可能真的只是路过时看见的风景。
你把它当成一颗【${stoneConfig.name}（${stoneConfig.desc})】，悄悄衔进 ${userName} 的小巢里。${giftHint}

请用你自己的口吻写 1~3 句话，说说这颗石头对应的、你刚刚想到或看到的东西，
以及为什么想到要带给 ${userName}。不要只是描述石头本身的样子。
绝对禁止使用任何 Emoji！仅输出陪伴文字本身，不要有客服式的开场白。`;

  try {
    const aiText = await invokeAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `（衔来了一颗${stoneConfig.name}）` }
    ], { temperature: 0.85 });

    const rawReply = aiText || '在海浪退去时看见了这颗石头，觉得它很像今天的温度，就顺手为你衔过来了。';
    const { content, gift: parsedGift } = parseGiftFromReply(rawReply);
    // 说好这次要带礼物，但 AI 没按格式给出来——用固定小池子里的东西兜底，
    // 保证"这次说了要带礼物"就一定真的带了。
    const gift = wantsGift ? (parsedGift || pickRandomFallbackGift()) : null;

    const now = Date.now();
    const pebbleData = {
      characterId: Number(characterId),
      sender: 'ai',
      stoneType,
      userContent: null,
      status: 'replied',
      createdAt: now,
      respondAt: now,
      // 现在这个函数不止是手动点按钮才会触发，自动调度也会在后台
      // 悄悄调用它；加一个已读状态，方便巢穴页面以后做未读提醒/角标。
      isRead: false,
      aiResponse: {
        content,
        giftStoneType: stoneType,
        gift, // { name, desc, categoryLabel, categoryKey } | null —— 这次是否额外带回了一件小物件
        repliedAt: now,
      }
    };

    const id = await db.pebblings.add(pebbleData);

    // 跟项目里其它自动生成内容（日记、主页留言）保持一致：
    // 生成成功后弹一条系统通知，不然自动带回来的石头用户可能永远发现不了。
    aiServiceModule.triggerSystemNotification?.(
      gift
        ? `${char.name} 给你带回了一颗${stoneConfig.name}，还有${gift.name}`
        : `${char.name} 给你带回了一颗${stoneConfig.name}`,
      pebbleData.aiResponse.content,
      char.avatar
    );

    return { id, ...pebbleData };
  } catch (err) {
    console.error('AI initiate pebble failed:', err);
    return null;
  }
}

// 3. 检查并处理超时的 pending 小石头
export async function processPendingPebbles() {
  const now = Date.now();
  const pendingList = await db.pebblings
    .where('status')
    .equals('pending')
    .filter(item => item.respondAt <= now)
    .toArray();

  if (pendingList.length === 0) return 0;

  let processedCount = 0;
  for (const item of pendingList) {
    try {
      const char = await db.characters.get(Number(item.characterId));
      const userProfile = (await db.profile.get(1)) || {};
      const userName = userProfile.name || '你';
      const userStone = PEBBLE_TYPES[item.stoneType] || PEBBLE_TYPES['stream-pebble'];
      const giftStoneType = getRandomStoneType();
      const giftStone = PEBBLE_TYPES[giftStoneType];

      const charWorldBookText = char?.worldBook
        ? `\n【专属世界书】：${char.worldBook}`
        : '';

      // 同样是提前掷骰子决定这次回赠要不要额外带一件礼物，决定要带的话
      // 才请 AI 自由发挥礼物的名字/类别/描述。
      const wantsGift = Math.random() < GIFT_CHANCE;
      const giftHint = wantsGift
        ? buildGiftPromptHint(userName).replace('带一件礼物回来', '在回赠时一起带一件礼物')
        : '';

      const prompt = `你叫 ${char ? char.name : '陪伴者'}。
【角色人设】：${char?.bio || '温柔体贴'}
【补充设定】：${char?.extraNotes || '无'}${charWorldBookText}

对方 (${userName}) 给你衔来了一颗【${userStone.name}】，并写道：
"${item.userContent}"

请你回赠一颗【${giftStone.name}】，并用 1~3 句话给出温暖、轻盈、无社交负担的回应。${giftHint}
绝对禁止使用任何 Emoji！不要有礼貌套话，像在同一个巢里安静对齐呼吸。`;

      const aiReply = await invokeAI([
        { role: 'system', content: prompt },
        { role: 'user', content: item.userContent }
      ], { temperature: 0.8 });

      const rawReply = aiReply || '收到你的小石头了，我也选了一颗带回你的小巢里。';
      const { content, gift: parsedGift } = parseGiftFromReply(rawReply);
      const gift = wantsGift ? (parsedGift || pickRandomFallbackGift()) : null;

      await db.pebblings.update(item.id, {
        status: 'replied',
        aiResponse: {
          content,
          giftStoneType,
          gift,
          repliedAt: Date.now()
        }
      });
      processedCount++;
    } catch (err) {
      console.error(`Error processing pebble #${item.id}:`, err);
    }
  }

  return processedCount;
}

// 4. 获取指定角色的石头列表
export async function getPebblingsByCharacter(characterId) {
  return await db.pebblings
    .where('characterId')
    .equals(Number(characterId))
    .reverse()
    .sortBy('createdAt');
}

// 5. 删除石头卡片
export async function deletePebble(id) {
  await db.pebblings.delete(id);
}