import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { sendPhotoMessage } from '../../../services/photoMessageService';


const PhotoCaptureButton = ({ chatId, characterId }) => {
  const fileInputRef = useRef(null);
  const [isSending, setIsSending] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !chatId) return;

    setIsSending(true);

    try {
      await sendPhotoMessage({ chatId, characterId, file });
    } catch (error) {
      console.warn('[PhotoCaptureButton] 发送图片失败：', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isSending}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs opacity-85 transition-opacity hover:opacity-100 disabled:opacity-40"
      >
        <Camera className="h-4 w-4" />
        <span>{isSending ? '发送中...' : '真实图片'}</span>
      </button>
    </>
  );
};

export default PhotoCaptureButton;