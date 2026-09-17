// src/apps/snapshots/SnapshotSettingsModal.jsx
//
// 【整体替换说明】相对旧版的改动：
// 1. 删除"全局 User 人设" tab（globalPersona/globalAvatar 相关 UI 与逻辑全部移除）。
// 2. 新增 currentChatId prop：NPC 管理与关系矩阵均改为按当前 chat 隔离。
// 3. NPC 管理改用 snapshotNpcService（getNpcsByChatId/addNpc/deleteNpc）。
// 4. 关系矩阵：
//    - 可选对象范围收窄为"该 chat 的官配角色 + 该 chat 的 NPC 列表"
//      （不再是全局所有角色），因为角色/NPC 现在都是按世界线隔离的。
//    - 删除"禁止配置亲密情侣关系"的警告文案，允许任意关系词，
//      包括暧昧/CP（角色↔NPC、NPC↔NPC 均可配置）。
//    - 改用 snapshotRelationService（getRelationsByChatId/addRelation/deleteRelation）。
//
import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2 } from 'lucide-react';
import db from '../../db';
import { getNpcsByChatId, addNpc, deleteNpc } from './services/snapshotNpcService';
import { getRelationsByChatId, addRelation, deleteRelation } from './services/snapshotRelationService';

const PRESET_RELATIONS = [
  '互嘲的室友',
  '咖啡馆死党',
  '社团搭档',
  '青梅竹马',
  '职场竞争对手',
  '同好交流伙伴',
  '书友',
  '暗恋对象',
  '暧昧拉扯',
  'CP感十足的欢喜冤家'
];

// 组合 "type:id" 字符串，供 <select> 使用
const toEntityKey = (type, id) => `${type}:${id}`;
const parseEntityKey = (key) => {
  const [type, idStr] = String(key || '').split(':');
  return { type, id: Number(idStr) };
};

export const SnapshotSettingsModal = ({ isOpen, onClose, currentChatId }) => {
  const [activeTab, setActiveTab] = useState('relations');

  const [officialChar, setOfficialChar] = useState(null);
  const [npcs, setNpcs] = useState([]);
  const [relations, setRelations] = useState([]);

  const [entityAKey, setEntityAKey] = useState('');
  const [entityBKey, setEntityBKey] = useState('');
  const [relationText, setRelationText] = useState(PRESET_RELATIONS[0]);

  const [newNpcName, setNewNpcName] = useState('');
  const [newNpcTag, setNewNpcTag] = useState('');

  useEffect(() => {
    if (!isOpen || !currentChatId) return;
    loadData();
  }, [isOpen, currentChatId]);

  const loadData = async () => {
    try {
      const numericChatId = Number(currentChatId);
      const chat = await db.chats.get(numericChatId);

      let char = null;
      if (chat?.characterId) {
        char = await db.characters.get(Number(chat.characterId));
      }
      setOfficialChar(char);

      const npcList = await getNpcsByChatId(numericChatId);
      setNpcs(npcList);

      const relList = await getRelationsByChatId(numericChatId);
      setRelations(relList);
    } catch (err) {
      console.error('Failed to load snapshot settings:', err);
    }
  };

  // 该 chat 世界线内可供选择的关系对象：官配角色 + 该 chat 的 NPC 列表
  const entityOptions = useMemo(() => {
    const list = [];
    if (officialChar) {
      list.push({ type: 'character', id: officialChar.id, name: officialChar.name, tag: '官配角色' });
    }
    npcs.forEach((n) => {
      list.push({ type: 'npc', id: n.id, name: n.name, tag: n.roleTag || 'NPC' });
    });
    return list;
  }, [officialChar, npcs]);

  const resolveEntityName = (type, id) => {
    if (type === 'character' && officialChar && Number(officialChar.id) === Number(id)) {
      return officialChar.name;
    }
    const npc = npcs.find((n) => Number(n.id) === Number(id));
    return npc?.name || '未知对象';
  };

  const handleAddRelation = async () => {
    if (!entityAKey || !entityBKey || entityAKey === entityBKey) return;
    const a = parseEntityKey(entityAKey);
    const b = parseEntityKey(entityBKey);
    if (!relationText.trim()) return;

    try {
      await addRelation(Number(currentChatId), a, b, relationText.trim());
      setEntityAKey('');
      setEntityBKey('');
      loadData();
    } catch (err) {
      console.error('Failed to add relation:', err);
    }
  };

  const handleDeleteRelation = async (id) => {
    try {
      await deleteRelation(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete relation:', err);
    }
  };

  const handleAddNpc = async () => {
    if (!newNpcName.trim() || !currentChatId) return;
    try {
      await addNpc(Number(currentChatId), { name: newNpcName.trim(), roleTag: newNpcTag.trim() || '路人NPC' });
      setNewNpcName('');
      setNewNpcTag('');
      loadData();
    } catch (err) {
      console.error('Failed to add npc:', err);
    }
  };

  const handleDeleteNpc = async (npcId) => {
    try {
      await deleteNpc(npcId);
      loadData();
    } catch (err) {
      console.error('Failed to delete npc:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md rounded-[2rem] p-5 space-y-4 border shadow-2xl flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          color: 'var(--text-main)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--card-border)' }}>
          <h3 className="font-bold text-sm">当前世界线的社交设置</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full opacity-60 hover:opacity-100"
            style={{ color: 'var(--text-main)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 导航（已去掉"全局 User 人设"） */}
        <div className="flex rounded-xl p-1 gap-1" style={{ backgroundColor: 'var(--control-soft-bg)' }}>
          <button
            onClick={() => setActiveTab('relations')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'relations' ? 'shadow-sm font-bold' : 'opacity-60'
            }`}
            style={{
              backgroundColor: activeTab === 'relations' ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            关系矩阵
          </button>
          <button
            onClick={() => setActiveTab('npcs')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'npcs' ? 'shadow-sm font-bold' : 'opacity-60'
            }`}
            style={{
              backgroundColor: activeTab === 'npcs' ? 'var(--card-bg)' : 'transparent',
              color: 'var(--text-main)'
            }}
          >
            NPC 管理
          </button>
        </div>

        {/* Tab 内容区 */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeTab === 'relations' && (
            <div className="space-y-4 pt-1">
              <p className="text-[11px] opacity-60 leading-relaxed">
                这里配置的是当前世界线内、官配角色与 NPC 之间的社交/情感关系。
                与 User 的官配关系已默认绑定，无需在此配置；此处可以自由设置任意关系，
                包括暧昧、CP 等情感色彩的关系。
              </p>

              {entityOptions.length < 2 ? (
                <p className="text-[11px] opacity-40 italic">
                  至少需要有官配角色或 2 个以上 NPC，才能配置关系。请先在"NPC 管理"里添加 NPC。
                </p>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold block">新建关系</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={entityAKey}
                      onChange={(e) => setEntityAKey(e.target.value)}
                      className="text-xs p-2 rounded-xl border outline-none"
                      style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                    >
                      <option value="">选择对象 A</option>
                      {entityOptions.map((opt) => (
                        <option key={toEntityKey(opt.type, opt.id)} value={toEntityKey(opt.type, opt.id)}>
                          {opt.name} ({opt.tag})
                        </option>
                      ))}
                    </select>

                    <select
                      value={entityBKey}
                      onChange={(e) => setEntityBKey(e.target.value)}
                      className="text-xs p-2 rounded-xl border outline-none"
                      style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                    >
                      <option value="">选择对象 B</option>
                      {entityOptions.map((opt) => (
                        <option key={toEntityKey(opt.type, opt.id)} value={toEntityKey(opt.type, opt.id)}>
                          {opt.name} ({opt.tag})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="输入或选择关系描述..."
                      value={relationText}
                      onChange={(e) => setRelationText(e.target.value)}
                      className="flex-1 text-xs p-2 rounded-xl border outline-none"
                      style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                    />
                    <button
                      onClick={handleAddRelation}
                      className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
                      style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                    >
                      添加
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {PRESET_RELATIONS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRelationText(preset)}
                        className="px-2 py-0.5 rounded-full text-[10px] border opacity-70 hover:opacity-100"
                        style={{ borderColor: 'var(--card-border)' }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 已有关系列表 */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold">已配置的关系</h4>
                {relations.length === 0 ? (
                  <p className="text-[11px] opacity-40 italic">当前世界线暂未配置关系</p>
                ) : (
                  <div className="space-y-1.5">
                    {relations.map((rel) => {
                      const nameA = resolveEntityName(rel.sourceType, rel.sourceId);
                      const nameB = resolveEntityName(rel.targetType, rel.targetId);
                      return (
                        <div
                          key={rel.id}
                          className="flex items-center justify-between p-2 rounded-xl border text-xs"
                          style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                        >
                          <span>{nameA} & {nameB}：<strong className="underline">{rel.relation}</strong></span>
                          <button
                            onClick={() => handleDeleteRelation(rel.id)}
                            className="p-1 opacity-50 hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'npcs' && (
            <div className="space-y-4 pt-1">
              <p className="text-[11px] opacity-60">
                这里添加的 NPC 只属于当前世界线（消息框），不会出现在其他世界线里。
                可以添加常驻的小 NPC（如街角咖啡师、流动摄影师），也可在无预设时由 AI 自由发挥出场。
              </p>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="NPC 名称 (如：咖啡师阿杰)"
                  value={newNpcName}
                  onChange={(e) => setNewNpcName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border outline-none"
                  style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="身份标签 (如：路人摄影师)"
                    value={newNpcTag}
                    onChange={(e) => setNewNpcTag(e.target.value)}
                    className="flex-1 text-xs p-2.5 rounded-xl border outline-none"
                    style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                  />
                  <button
                    onClick={handleAddNpc}
                    className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
                    style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-foreground)' }}
                  >
                    添加 NPC
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold">NPC 列表</h4>
                {npcs.length === 0 ? (
                  <p className="text-[11px] opacity-40 italic">暂无自定义 NPC</p>
                ) : (
                  <div className="space-y-1.5">
                    {npcs.map((npc) => (
                      <div
                        key={npc.id}
                        className="flex items-center justify-between p-2 rounded-xl border text-xs"
                        style={{ backgroundColor: 'var(--control-soft-bg)', borderColor: 'var(--card-border)' }}
                      >
                        <div>
                          <span className="font-bold">{npc.name}</span>
                          <span className="ml-2 text-[10px] opacity-60">({npc.roleTag})</span>
                        </div>
                        <button
                          onClick={() => handleDeleteNpc(npc.id)}
                          className="p-1 opacity-50 hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SnapshotSettingsModal;