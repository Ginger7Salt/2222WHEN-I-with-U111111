// 把录音转成 wav 再上传给 MiniMax。
//
// 背景：MediaRecorder 在不同浏览器里能直接产出的容器不一样——
// Chrome/Android 基本只给 webm（matroska），Safari 给 mp4——
// 但 MiniMax 的语音识别接口不认 webm/matroska 这个容器（实测报
// "unsupported audio format matroska,webm"），认的是
// wav/aiff/flac/alac/mp3/aac/opus/ogg。而且这份支持列表在不同
// 浏览器上又不是每种都能直接录出来，所以没法简单换个 mimeType
// 就解决——统一转成 wav 是最不挑浏览器的做法：wav 本身没有编码，
// 只是一份 PCM 数据外面套一层固定格式的文件头，自己写几十行就能
// 生成，不需要引入额外的编解码库。
//
// 做法：用浏览器自带的 Web Audio API 把原始录音（不管是 webm 还是
// mp4）解码成 PCM 原始采样数据，再按 wav 文件格式自己拼一份文件头
// 写出去。降到单声道，是因为 MiniMax 文档建议的一个"体积友好"配置，
// 语音识别本身也不需要立体声。

const encodeWavFromAudioBuffer = (audioBuffer) => {
  const numChannels = 1; // 识别用，降到单声道，体积更小、MiniMax 文档也推荐这样。
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;

  // 多声道先按帧平均，降成一路单声道采样。
  const channelData = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c += 1) {
    channelData.push(audioBuffer.getChannelData(c));
  }

  const mono = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i += 1) {
    let sum = 0;
    for (let c = 0; c < channelData.length; c += 1) {
      sum += channelData[c][i];
    }
    mono[i] = sum / channelData.length;
  }

  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAsciiString = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  // wav 文件头（RIFF/WAVE 格式），字段顺序和字节数都是固定规范，
  // 照抄这份结构就行，不需要理解每一位的具体用途。
  writeAsciiString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(8, 'WAVE');
  writeAsciiString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // 1 = 不压缩的 PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAsciiString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i += 1) {
    const sample = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

export const convertBlobToWavBlob = async (blob) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error('当前浏览器不支持音频解码，无法转换录音格式。');
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContextClass();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return encodeWavFromAudioBuffer(audioBuffer);
  } finally {
    // 只用来解码这一次，用完关掉，不占着系统的音频资源。
    audioContext.close().catch(() => {});
  }
};
