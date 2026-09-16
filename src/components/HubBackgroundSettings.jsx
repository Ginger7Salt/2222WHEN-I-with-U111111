import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { compressImageFile } from '../utils/imageHelper';

const BACKGROUND_COMPRESS_OPTIONS = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.78,
  outputType: 'base64',
};

export const HubBackgroundSettings = ({
  value = '',
  onChange,
}) => {
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSelectImage = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setErrorMessage('');
    setIsProcessing(true);

    try {
      const compressedImage = await compressImageFile(
        file,
        BACKGROUND_COMPRESS_OPTIONS,
      );

      onChange(compressedImage);
    } catch (error) {
      console.error(
        '主界面背景图处理失败:',
        error,
      );

      setErrorMessage(
        '图片处理失败，请选择其他图片重试。',
      );
    } finally {
      setIsProcessing(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setErrorMessage('');
    onChange('');
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">
          主界面背景
        </p>

        <p className="mt-1 text-[10px] leading-relaxed opacity-50">
          只显示在主界面，不会影响聊天、日记、旅行或其他应用。
        </p>
      </div>

      {value ? (
        <div className="relative overflow-hidden rounded-[1.5rem]">
          <img
            src={value}
            alt="主界面背景预览"
            className="h-44 w-full object-cover"
            style={{
              filter: 'saturate(0.9)',
            }}
          />

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.22))',
            }}
          />

          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
            <span className="rounded-full bg-black/45 px-3 py-1.5 text-[10px] text-white backdrop-blur-md">
              当前主界面背景
            </span>

            <button
              type="button"
              onClick={handleRemoveImage}
              className="flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-[10px] font-medium text-black shadow-sm backdrop-blur-md transition-transform active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>删除背景</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex min-h-32 flex-col items-center justify-center rounded-[1.5rem] px-5 py-6 text-center"
          style={{
            background:
              'linear-gradient(145deg, var(--control-soft-bg), transparent)',
            color: 'var(--text-muted)',
          }}
        >
          <ImageIcon className="mb-2 h-6 w-6 opacity-60" />

          <p className="text-xs">
            当前使用主题默认背景
          </p>

          <p className="mt-1 text-[10px] opacity-60">
            添加一张图片，让主界面成为属于你的空间
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleSelectImage}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-xs font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}

        <span>
          {isProcessing
            ? '正在处理图片…'
            : value
              ? '更换主界面背景'
              : '添加主界面背景'}
        </span>
      </button>

      {errorMessage && (
        <p className="text-[10px] text-rose-500">
          {errorMessage}
        </p>
      )}

      <p className="text-[10px] leading-relaxed opacity-40">
        图片会在本地压缩并保存，不会上传到服务器。
      </p>
    </div>
  );
};

export default HubBackgroundSettings;
