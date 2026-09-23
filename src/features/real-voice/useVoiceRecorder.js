import { useCallback, useRef, useState } from 'react';

// 通话里"点一下开始、点一下停止"的录音：只在停止那一刻把整段
// 音频交出去，配合非流式识别——不做边录边传。
// 依次尝试几种浏览器普遍支持的编码，MiniMax 的语音识别接口本身
// 支持 wav/aiff/flac/alac/mp3/aac/opus/ogg 这些容器，这里挑
// MediaRecorder 实际能产出的几种，尽量避免用不被接受的格式。
const PREFERRED_MIME_TYPES = [
  'audio/ogg;codecs=opus',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

const pickSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';

  return PREFERRED_MIME_TYPES.find(
    (type) => MediaRecorder.isTypeSupported(type),
  ) || '';
};

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const stopStreamTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前环境不支持录音。');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mimeType = pickSupportedMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }, []);

  // 停止录音，返回这一段完整的音频 Blob，交给上层去识别。
  const stop = useCallback(() => (
    new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder) {
        reject(new Error('还没有开始录音。'));
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        chunksRef.current = [];
        mediaRecorderRef.current = null;
        stopStreamTracks();
        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    })
  ), []);

  // 中途放弃（比如通话被缩小/挂断），不产出任何 Blob，只负责把
  // 麦克风关掉、状态复位，不触发识别请求。
  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }

    chunksRef.current = [];
    mediaRecorderRef.current = null;
    stopStreamTracks();
    setIsRecording(false);
  }, []);

  return { isRecording, start, stop, cancel };
};
