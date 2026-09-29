// src/apps/rp/rpPresetService.js
//
// 长RP子应用切片B：rpPresets 表的增删查改 + 导出导入。
//
// 预设结构（跟用户确认过，自成体系，不对齐真实SillyTavern导出文件）：
//   prompts: [{ identifier, name, content, role, enabled, isMarker }]
//     - identifier 是这一条在数组里的唯一标识，promptOrder 用它来排序
//     - isMarker=true 表示这是个占位符（比如"世界书注入点"、"聊天历史
//       注入点"），没有自己的 content，组装时由调用方把真实内容替换进去
//   promptOrder: [identifier, identifier, ...]  —— 跟 prompts 数组分开存，
//     方便以后做拖拽排序时只改这一个数组，不用整体重排 prompts
//   regexScripts: [{ id, name, enabled, findRegex, flags, replaceString,
//                     affects, applyToDisplay, applyToPrompt }]
//     - affects: 'ai_output' | 'user_input' | 'both'
//
// allowHtml 不放在预设里——跟用户确认过，HTML内联CSS渲染开关统一放在
// rpSessions（会话设置）上控制，预设本身不带这个开关。

import db from '../../db';

const DEFAULT_MARKER_PROMPTS = () => ([
  { identifier: 'char-bio', name: '角色人设', content: '{{char}} 的人设：\n{{charBio}}', role: 'system', enabled: true, isMarker: false },
  { identifier: 'user-persona', name: 'User人设', content: '{{user}} 的人设：\n{{userPersona}}', role: 'system', enabled: true, isMarker: false },
  { identifier: 'world-book', name: '世界书注入点', content: '', role: 'system', enabled: true, isMarker: true },
  { identifier: 'jailbreak', name: '自定义引导文本', content: '', role: 'system', enabled: false, isMarker: false },
  { identifier: 'history', name: '聊天历史注入点', content: '', role: 'system', enabled: true, isMarker: true },
]);

/**
 * 按更新时间倒序，取所有预设列表。
 */
export const getAllRpPresets = async () => {
  try {
    return await db.rpPresets.orderBy('updatedAt').reverse().toArray();
  } catch (err) {
    console.error('[rpPresetService] 获取预设列表失败:', err);
    return [];
  }
};

export const getRpPresetById = async (presetId) => {
  if (presetId === null || presetId === undefined) return null;
  try {
    return await db.rpPresets.get(Number(presetId));
  } catch (err) {
    console.error('[rpPresetService] 获取预设详情失败:', err);
    return null;
  }
};

/**
 * 新建一个预设。不传 prompts 的话，用一份"角色人设/User人设/世界书
 * 占位/自定义引导(默认关)/历史占位"的合理默认骨架起步，而不是空数组
 * ——空数组会让新用户对着一片空白不知道从哪下手。
 */
export const createRpPreset = async ({ name, prompts, regexScripts } = {}) => {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) return null;

  const finalPrompts = Array.isArray(prompts) && prompts.length > 0
    ? prompts
    : DEFAULT_MARKER_PROMPTS();

  try {
    const now = Date.now();
    return await db.rpPresets.add({
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
      prompts: finalPrompts,
      promptOrder: finalPrompts.map((p) => p.identifier),
      regexScripts: Array.isArray(regexScripts) ? regexScripts : [],
    });
  } catch (err) {
    console.error('[rpPresetService] 创建预设失败:', err);
    return null;
  }
};

/**
 * 整体覆盖式更新（prompts/promptOrder/regexScripts/name 任意子集）。
 * 编辑器每次保存都传完整的 prompts/regexScripts 数组，不做增量patch
 * ——预设条目数量不大，整体覆盖比对着identifier做diff简单可靠。
 */
export const updateRpPreset = async (presetId, patch) => {
  if (presetId === null || presetId === undefined) return;
  try {
    await db.rpPresets.update(Number(presetId), {
      ...patch,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.error('[rpPresetService] 更新预设失败:', err);
  }
};

/**
 * 删除一个预设。正在使用这个预设的会话不会被连带处理——它们的
 * presetId 会变成"指向一个不存在的预设"，组装函数遇到这种情况会
 * 静默退回不注入任何prompts块（只剩历史），不会报错崩溃。这是一个
 * 刻意的简化，暂时没有"删除前检查谁在用"的引用检查。
 */
export const deleteRpPreset = async (presetId) => {
  if (presetId === null || presetId === undefined) return;
  try {
    await db.rpPresets.delete(Number(presetId));
  } catch (err) {
    console.error('[rpPresetService] 删除预设失败:', err);
  }
};

/**
 * 导出成可以直接保存成 .json 文件的字符串。不带 id/createdAt/updatedAt
 * ——导入到另一份数据（或分享给未来的自己）时，这些字段应该是全新的。
 */
export const exportRpPresetToJson = (preset) => {
  const exportable = {
    name: preset.name,
    prompts: preset.prompts,
    promptOrder: preset.promptOrder,
    regexScripts: preset.regexScripts,
    formatVersion: 1,
  };
  return JSON.stringify(exportable, null, 2);
};

/**
 * 从导出的 JSON 字符串导入成一个新预设。只做最基础的形状校验
 * （name是字符串、prompts是数组），不做逐字段的深度校验——这是给
 * 用户自己这边导出导入用的自成体系格式，不是要去兼容任意外部输入。
 */
export const importRpPresetFromJson = async (jsonString) => {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    console.error('[rpPresetService] 导入失败，JSON解析出错:', err);
    return null;
  }

  if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.prompts)) {
    console.error('[rpPresetService] 导入失败，文件格式不对');
    return null;
  }

  return createRpPreset({
    name: `${parsed.name}（导入）`,
    prompts: parsed.prompts,
    regexScripts: Array.isArray(parsed.regexScripts) ? parsed.regexScripts : [],
  });
};

export default {
  getAllRpPresets,
  getRpPresetById,
  createRpPreset,
  updateRpPreset,
  deleteRpPreset,
  exportRpPresetToJson,
  importRpPresetFromJson,
};