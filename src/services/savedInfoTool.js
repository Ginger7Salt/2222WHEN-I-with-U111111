// src/services/savedInfoTool.js
//
// 给角色用的内置工具：查阅用户预先保存的常用信息。
// 它不是 MCP 工具，只在本地读 db.userSavedInfo，不走 MCP 审批。
// 只会和 MCP 工具一起交给模型（见 aiToolOrchestrator.js），
// 所以没有配置 MCP 的用户，请求格式完全不变。

import { listSavedInfo } from './userSavedInfoService';

export const SAVED_INFO_TOOL_NAME = 'lookup_user_saved_info';

// 同一次角色回复里，最多允许查阅几次，防止模型反复调用。
export const MAX_SAVED_INFO_LOOKUPS_PER_RESPONSE = 4;

// 工具描述里最多列出多少个条目标题（只列标题，不带内容，省 token）。
const MAX_TITLES_IN_DESCRIPTION = 30;

export const SAVED_INFO_PROMPT_RULE = `
【用户常用信息】
你可以使用工具 ${SAVED_INFO_TOOL_NAME} 查阅用户预先保存的常用信息，例如收货地址、联系方式、口味偏好。
当你需要调用外接工具、且需要这类信息时，先用它查阅，不要向用户重复询问已经保存过的内容；只有查不到时，才自然地询问用户。
除非确有需要，不要主动向用户复述这些信息。
`;

/**
 * 生成工具定义。没有任何已保存条目时返回 null（此时不添加工具，也不加提示词）。
 */
export const buildSavedInfoToolDefinition = async () => {
  try {
    const items = await listSavedInfo();

    if (items.length === 0) {
      return null;
    }

    const titles = items
      .slice(0, MAX_TITLES_IN_DESCRIPTION)
      .map((item) => item.title)
      .join('、');

    return {
      type: 'function',
      function: {
        name: SAVED_INFO_TOOL_NAME,
        description: [
          '查阅用户预先保存的常用信息（收货地址、联系方式、偏好等）。',
          `当前已保存的条目：${titles}。`,
          '需要这些信息去调用其他外接工具时，先用本工具查阅，不要向用户重复询问。',
        ].join('\n'),
        parameters: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description:
                '条目标题或关键词，例如"家"、"公司"、"电话"。留空则返回全部条目。',
            },
          },
        },
      },
    };
  } catch (error) {
    // 读取失败不能阻断正常对话。
    console.warn('[SavedInfo] 无法生成常用信息工具：', error);
    return null;
  }
};

const parseKeyword = (rawArguments) => {
  if (rawArguments === undefined || rawArguments === null) {
    return '';
  }

  let parsed = rawArguments;

  if (typeof rawArguments === 'string') {
    const text = rawArguments.trim();

    if (!text) {
      return '';
    }

    try {
      parsed = JSON.parse(text);
    } catch {
      return '';
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return '';
  }

  return String(parsed.keyword ?? '').trim().toLowerCase();
};

/**
 * 执行一次查阅，返回给模型的工具结果文本（JSON 字符串）。
 */
export const runSavedInfoLookup = async (rawArguments) => {
  try {
    const keyword = parseKeyword(rawArguments);
    const items = await listSavedInfo();

    const matched = keyword
      ? items.filter(
          (item) =>
            item.title.toLowerCase().includes(keyword) ||
            item.content.toLowerCase().includes(keyword),
        )
      : items;

    // 只记录关键词和命中数量，不把具体内容打到控制台。
    console.log(
      '[SavedInfo] 角色查阅了常用信息，关键词：',
      keyword || '(全部)',
      '命中条数：',
      matched.length,
    );

    if (matched.length === 0) {
      return JSON.stringify({
        found: 0,
        message: '没有匹配的已保存信息。',
        availableTitles: items.map((item) => item.title),
      });
    }

    return JSON.stringify({
      found: matched.length,
      entries: matched.map((item) => ({
        title: item.title,
        content: item.content,
      })),
    });
  } catch (error) {
    return JSON.stringify({
      isError: true,
      error: 'SAVED_INFO_LOOKUP_FAILED',
      message: `查阅常用信息失败：${error?.message || '未知错误'}`,
    });
  }
};

export default {
  SAVED_INFO_TOOL_NAME,
  SAVED_INFO_PROMPT_RULE,
  MAX_SAVED_INFO_LOOKUPS_PER_RESPONSE,
  buildSavedInfoToolDefinition,
  runSavedInfoLookup,
};