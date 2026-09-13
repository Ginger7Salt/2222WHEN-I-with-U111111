import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Plus, Pencil, Check, Trash2, X } from 'lucide-react';
import {
  getCharacterProfile,
  updateCharacterProfile,
  listTimelineEntries,
  addTimelineEntry,
  updateTimelineEntry,
  deleteTimelineEntry
} from './characterProfileService';
import { ImageUploader } from '../../components/ImageUploader';

/**
 * CharacterProfilePage —— 角色的个人主页
 *
 * 结构（对照参考图2 的拼贴/剪贴簿感觉）：
 *   1. 横幅 banner（可点击替换），头像叠在横幅下方（类似朋友圈/IG 个人页）
 *   2. 姓名 + 一句话签名，点铅笔进入编辑态，直接改文字
 *   3. 时间轴：一张 Polaroid 照片 + 一段用户自己写的文字，按日期从新到旧
 *      排列，每张轻微旋转，制造"贴上去"的手感
 *
 * 没有底部导航栏：返回靠左上角箭头，新增时间轴用一个悬浮圆按钮
 *（和这个项目里 WorkflowApp 的"新建工作流"按钮是同一种语言，风格统一）。
 */

const TimelineEntrySheet = ({ characterId, entry, onClose, onSaved }) => {
  const isEdit = Boolean(entry);
  const [date, setDate] = useState(entry?.date || new Date().toISOString().slice(0, 10));
  const [photo, setPhoto] = useState(entry?.photo || null);
  const [caption, setCaption] = useState(entry?.caption || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isEdit) {
        await updateTimelineEntry(entry.id, { date, photo, caption });
      } else {
        await addTimelineEntry(characterId, { date, photo, caption });
      }
      onSaved();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="w-full max-w-[420px] rounded-t-3xl border-t p-5 pb-8"
        style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold">
            {isEdit ? '编辑这条记录' : '新的一条时间轴'}
          </h3>
          <button type="button" onClick={onClose} className="opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wider opacity-50">照片</p>
            <ImageUploader
              label="上传一张照片"
              compressOptions={{ maxWidth: 900, maxHeight: 900, quality: 0.75, outputType: 'base64' }}
              onCompressedImage={setPhoto}
            />
            {photo && (
              <div className="mt-2 h-32 w-32 overflow-hidden rounded-xl">
                <img src={photo} alt="" className="h-full w-full object-cover" />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--card-border)' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">写点什么</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="这一天发生了什么"
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--card-border)' }}
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-2xl py-3 text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-main)' }}
          >
            {isSaving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TimelineCard = ({ entry, rotate, onEdit, onDelete }) => (
  <div className="relative px-1" style={{ transform: `rotate(${rotate}deg)` }}>
    <div
      className="mx-auto w-[78%] border p-2 pb-4 shadow-sm"
      style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--card-border)' }}
    >
      {entry.photo ? (
        <img src={entry.photo} alt="" className="aspect-square w-full object-cover" />
      ) : (
        <div
          className="flex aspect-square w-full items-center justify-center"
          style={{ backgroundColor: 'var(--control-soft-bg)' }}
        >
          <span className="text-xs opacity-40">没有照片</span>
        </div>
      )}
      <p className="mt-2 px-1 font-serif text-[13px] italic leading-snug opacity-80">
        {entry.caption || '（还没写字）'}
      </p>
    </div>

    <div className="mx-auto mt-1 flex w-[78%] items-center justify-between text-[10px] opacity-40">
      <span className="font-mono">{entry.date}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onEdit(entry)} aria-label="编辑">
          <Pencil className="h-3 w-3" />
        </button>
        <button type="button" onClick={() => onDelete(entry)} aria-label="删除">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  </div>
);

export const CharacterProfilePage = ({ characterId, onBack }) => {
  const [character, setCharacter] = useState(null);
  const [entries, setEntries] = useState([]);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [handleDraft, setHandleDraft] = useState('');
  const [formTarget, setFormTarget] = useState(null); // 'new' | entry | null
  const bannerInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const reload = useCallback(async () => {
    const [profile, timeline] = await Promise.all([
      getCharacterProfile(characterId),
      listTimelineEntries(characterId)
    ]);
    setCharacter(profile);
    setEntries(timeline);
    setNameDraft(profile?.name || '');
    setHandleDraft(profile?.handle || '');
  }, [characterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleReplaceImage = async (field, base64) => {
    await updateCharacterProfile(characterId, { [field]: base64 });
    await reload();
  };

  const handleSaveHeader = async () => {
    await updateCharacterProfile(characterId, { name: nameDraft, handle: handleDraft });
    setIsEditingHeader(false);
    await reload();
  };

  const handleDeleteEntry = async (entry) => {
    await deleteTimelineEntry(entry.id);
    await reload();
  };

  if (!character) return null;

  return (
    <div className="min-h-[100dvh] w-full pb-28" style={{ backgroundColor: 'var(--bg-main)' }}>
      {/* 横幅 */}
      <div
        className="relative h-52 w-full overflow-hidden"
        style={{ backgroundColor: 'var(--control-soft-bg)' }}
      >
        {character.banner && (
          <img src={character.banner} alt="" className="h-full w-full object-cover" />
        )}

        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+16px)] flex h-9 w-9 items-center justify-center rounded-full backdrop-blur"
          style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>

        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const { compressImageFile } = await import('../../utils/imageHelper');
            const data = await compressImageFile(file, {
              maxWidth: 1080,
              maxHeight: 720,
              quality: 0.75,
              outputType: 'base64'
            });
            await handleReplaceImage('banner', data);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+16px)] flex h-9 w-9 items-center justify-center rounded-full backdrop-blur"
          style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
          aria-label="更换横幅"
        >
          <Pencil className="h-4 w-4 text-white" />
        </button>
      </div>

      {/* 头像 + 姓名区，叠在横幅下面一点 */}
      <div className="relative px-5">
        <div className="relative -mt-10 h-20 w-20">
          {character.avatar ? (
            <img
              src={character.avatar}
              alt=""
              className="h-20 w-20 rounded-full border-4 object-cover"
              style={{ borderColor: 'var(--bg-main)' }}
            />
          ) : (
            <div
              className="h-20 w-20 rounded-full border-4"
              style={{ borderColor: 'var(--bg-main)', backgroundColor: 'var(--control-soft-bg)' }}
            />
          )}

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const { compressImageFile } = await import('../../utils/imageHelper');
              const data = await compressImageFile(file, {
                maxWidth: 400,
                maxHeight: 400,
                quality: 0.8,
                outputType: 'base64'
              });
              await handleReplaceImage('avatar', data);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            aria-label="更换头像"
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border"
            style={{ backgroundColor: 'var(--text-main)', borderColor: 'var(--bg-main)' }}
          >
            <Pencil className="h-3 w-3" style={{ color: 'var(--bg-main)' }} />
          </button>
        </div>

        <div className="mt-3">
          {isEditingHeader ? (
            <div className="space-y-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="角色名字"
                className="w-full rounded-xl border bg-transparent px-3 py-2 font-serif text-lg outline-none"
                style={{ borderColor: 'var(--card-border)' }}
              />
              <input
                type="text"
                value={handleDraft}
                onChange={(e) => setHandleDraft(e.target.value)}
                placeholder="一句话签名"
                className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: 'var(--card-border)' }}
              />
              <button
                type="button"
                onClick={handleSaveHeader}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-main)' }}
              >
                <Check className="h-3.5 w-3.5" />
                保存
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setIsEditingHeader(true)} className="text-left">
              <h1 className="font-serif text-xl font-semibold">{character.name || '未命名角色'}</h1>
              <p className="mt-0.5 text-[13px] italic opacity-60">
                {character.handle || '点这里写一句话签名'}
              </p>
            </button>
          )}
        </div>
      </div>

      {/* 时间轴 */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between px-5">
          <h2 className="font-serif text-sm font-semibold italic opacity-80">时间轴</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider opacity-40">
            {entries.length} 条
          </span>
        </div>

        {entries.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm opacity-45">
            还没有记录，点右下角的 + 添加第一条
          </p>
        ) : (
          <div className="space-y-6">
            {entries.map((entry, index) => (
              <TimelineCard
                key={entry.id}
                entry={entry}
                rotate={index % 2 === 0 ? -2 : 2}
                onEdit={(e) => setFormTarget(e)}
                onDelete={handleDeleteEntry}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setFormTarget('new')}
        className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full shadow-lg"
        style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-main)' }}
        aria-label="添加时间轴记录"
      >
        <Plus className="h-5 w-5" />
      </button>

      {formTarget && (
        <TimelineEntrySheet
          characterId={characterId}
          entry={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            void reload();
          }}
        />
      )}
    </div>
  );
};

export default CharacterProfilePage;