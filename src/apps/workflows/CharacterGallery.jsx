import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil, ChevronLeft } from 'lucide-react';
import db from '../../db';
import {
  listCharactersForGallery,
  updateCharacterProfile
} from './characterProfileService';
import { ImageUploader } from '../../components/ImageUploader';

/**
 * CharacterGallery —— "选人"页
 *
 * 设计意图（对照你给的两张参考图）：
 * - 不是网格卡片，而是"一张接一张的照片"：每个角色占满整屏宽度，
 *   横向 scroll-snap 一张一张划过去，像翻胶卷/相册。
 * - 图片就是背景本身，没有额外的白底卡片框把它"包"起来。
 * - 角色的一句话签名（handle）像参考图1里贴在照片边缘的竖排文字。
 * - 没有底部 tab bar；翻页靠手势，位置提示只用几个很小的圆点。
 * - 默认纯白/黑（这里只用主题里已有的 CSS 变量，不写死颜色，
 *   所以会自动跟着 theme.css 的黑白切换走）。
 *
 * 用法：<CharacterGallery onOpenCharacter={(id) => ...} onBack={...} />
 */

const EditSheet = ({ character, onClose, onSaved }) => {
  const [handle, setHandle] = useState(character.handle || '');
  const [avatar, setAvatar] = useState(character.avatar || null);
  const [banner, setBanner] = useState(character.banner || null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCharacterProfile(character.id, { handle, avatar, banner });
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
          <h3 className="font-serif text-lg font-semibold">编辑这张照片</h3>
          <button type="button" onClick={onClose} className="text-sm opacity-50">
            关闭
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wider opacity-50">封面图（主页背景）</p>
            <ImageUploader
              label="上传封面图"
              compressOptions={{ maxWidth: 1080, maxHeight: 1440, quality: 0.75, outputType: 'base64' }}
              onCompressedImage={setBanner}
            />
            {banner && (
              <div className="mt-2 h-32 w-full overflow-hidden rounded-xl">
                <img src={banner} alt="" className="h-full w-full object-cover" />
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wider opacity-50">头像</p>
            <ImageUploader
              label="上传头像"
              compressOptions={{ maxWidth: 400, maxHeight: 400, quality: 0.8, outputType: 'base64' }}
              onCompressedImage={setAvatar}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider opacity-50">
              一句话签名
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="写点只属于这张照片的话"
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

const Frame = ({ character, index, onOpen, onEdit }) => {
  const hasBanner = Boolean(character.banner || character.avatar);
  const image = character.banner || character.avatar;

  return (
    <div
      className="relative h-[100dvh] w-full shrink-0 snap-center overflow-hidden"
      style={{ backgroundColor: 'var(--control-soft-bg)' }}
    >
      {hasBanner ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-serif text-sm italic opacity-40">还没有上传照片</span>
        </div>
      )}

      {/* 底部渐暗，保证文字可读；用黑色透明度叠加，黑白主题下都成立 */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/5"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))'
        }}
      />

      {/* 编辑入口 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(character);
        }}
        aria-label="编辑"
        className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+16px)] flex h-9 w-9 items-center justify-center rounded-full backdrop-blur"
        style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
      >
        <Pencil className="h-4 w-4 text-white" />
      </button>

      {/* 左侧竖排签名条，呼应参考图里"贴"在照片边上的文字 */}
      {character.handle && (
        <div
          className="absolute left-4 top-1/2 max-h-[60%] origin-left -translate-y-1/2 whitespace-nowrap font-serif text-[13px] italic tracking-wide text-white/90"
          style={{ writingMode: 'vertical-rl' }}
        >
          {character.handle}
        </div>
      )}

      {/* 底部姓名 + 点进主页的提示，整块可点 */}
      <button
        type="button"
        onClick={() => onOpen(character)}
        className="absolute inset-x-0 bottom-0 flex flex-col items-start px-5 pb-10 text-left"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="mt-1 font-serif text-2xl font-semibold text-white">
          {character.name || '未命名角色'}
        </span>
      </button>
    </div>
  );
};

export const CharacterGallery = ({ onOpenCharacter, onBack }) => {
  const [characters, setCharacters] = useState([]);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  const reload = useCallback(async () => {
    const data = await listCharactersForGallery();
    setCharacters(data);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    const next = Math.round(el.scrollLeft / width);
    setActiveIndex(next);
  }, []);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [touch-action:pan-x] [-webkit-overflow-scrolling:touch] [scrollbar-width:none]"
      >
        {characters.map((character, index) => (
          <Frame
            key={character.id}
            character={character}
            index={index}
            onOpen={onOpenCharacter}
            onEdit={setEditingCharacter}
          />
        ))}

        {characters.length === 0 && (
          <div className="flex h-full w-full shrink-0 snap-center flex-col items-center justify-center gap-2">
            <p className="font-serif text-sm italic opacity-50">这里还没有任何角色</p>
          </div>
        )}
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+16px)] flex h-9 w-9 items-center justify-center rounded-full backdrop-blur"
          style={{ backgroundColor: 'rgba(255,255,255,0.16)' }}
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}

      {/* 位置指示：几个小圆点，不是导航栏 */}
      {characters.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-1.5">
          {characters.map((c, i) => (
            <span
              key={c.id}
              className="h-1.5 w-1.5 rounded-full transition-opacity"
              style={{
                backgroundColor: 'white',
                opacity: i === activeIndex ? 0.9 : 0.35
              }}
            />
          ))}
        </div>
      )}

      {editingCharacter && (
        <EditSheet
          character={editingCharacter}
          onClose={() => setEditingCharacter(null)}
          onSaved={() => {
            setEditingCharacter(null);
            void reload();
          }}
        />
      )}
    </div>
  );
};

export default CharacterGallery;