import React, { useEffect, useState } from 'react';
import {
  Video,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import GlassCard from '../GlassCard';
import {
  getVideoApiConfig,
  saveVideoApiConfig,
} from '../../services/videoCallApiService';

const DEFAULT_CONFIG = {
  baseUrl: '',
  apiKey: '',
  model: '',
};

// 视频通话专用 API。结构和交互照着 VisionApiSettings.jsx 来（填完离开
// 输入框自动保存，不依赖设置页底部的总保存按钮），保持设置页里几块
// API 配置的手感一致。
const VideoApiSettings = () => {
  const [videoConfig, setVideoConfig] = useState(DEFAULT_CONFIG);
  const [models, setModels] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [visionStatus, setVisionStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      const existing = await getVideoApiConfig();

      if (existing) {
        setVideoConfig({
          baseUrl: existing.baseUrl || '',
          apiKey: existing.apiKey || '',
          model: existing.model || '',
        });
      }

      setIsLoaded(true);
    };

    void loadConfig();
  }, []);

  const persistConfig = async (nextConfig) => {
    await saveVideoApiConfig(nextConfig);
    setSaveStatus('saved');

    window.setTimeout(() => {
      setSaveStatus('idle');
    }, 1500);
  };

  const updateField = (field) => (event) => {
    const nextConfig = {
      ...videoConfig,
      [field]: event.target.value,
    };

    setVideoConfig(nextConfig);

    if (field === 'baseUrl' || field === 'apiKey') {
      setConnectionStatus('idle');
      setVisionStatus('idle');
      setModels([]);
      setErrorMessage('');
    }
  };

  const handleBlur = () => {
    if (!isLoaded) return;
    void persistConfig(videoConfig);
  };

  const normalizeBaseUrl = () => {
    let url = videoConfig.baseUrl.trim().replace(/\/+$/, '');

    if (!url) return '';

    // 如果用户填写了完整的 /chat/completions，自动还原到 API 根地址
    url = url.replace(/\/chat\/completions\/?$/, '');
    url = url.replace(/\/models\/?$/, '');

    return url;
  };

  const getModels = async () => {
    if (!videoConfig.baseUrl || !videoConfig.apiKey) {
      throw new Error('请先填写视频 API 的 Base URL 和 API Key');
    }

    const baseUrl = normalizeBaseUrl();

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${videoConfig.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`获取模型失败：HTTP ${response.status}`);
    }

    const responseData = await response.json();

    const list = Array.isArray(responseData.data)
      ? responseData.data
          .map((item) => {
            if (typeof item === 'string') return item;
            return item?.id;
          })
          .filter(Boolean)
      : [];

    if (list.length === 0) {
      throw new Error('接口连通，但没有返回任何模型');
    }

    return [...new Set(list)];
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setErrorMessage('');

    try {
      const list = await getModels();

      setModels(list);
      setConnectionStatus('success');

      const selectedModel = list.includes(videoConfig.model)
        ? videoConfig.model
        : list[0];

      const nextConfig = {
        ...videoConfig,
        model: selectedModel,
      };

      setVideoConfig(nextConfig);
      await persistConfig(nextConfig);
    } catch (error) {
      console.error('Video API connection failed:', error);
      setConnectionStatus('error');
      setErrorMessage(error.message || '无法连接视频 API');
    }
  };

  const handleModelChange = async (event) => {
    const nextConfig = {
      ...videoConfig,
      model: event.target.value,
    };

    setVideoConfig(nextConfig);
    await persistConfig(nextConfig);
  };

  const handleVisionTest = async () => {
    if (!videoConfig.baseUrl || !videoConfig.apiKey || !videoConfig.model) {
      setVisionStatus('error');
      setErrorMessage('请先填写 API，并选择一个支持图片输入的模型');
      return;
    }

    setVisionStatus('testing');
    setErrorMessage('');

    try {
      const baseUrl = normalizeBaseUrl();

      // 1x1 透明 PNG，仅用于测试模型是否接受图片输入
      const testImage =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/Sc0lGQAAAABJRU5ErkJggg==';

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${videoConfig.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: videoConfig.model,
          max_tokens: 8,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: '请简短回答：这是一张图片吗？',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: testImage,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `图片输入调用失败：HTTP ${response.status}${errorText ? ` - ${errorText}` : ''}`,
        );
      }

      setVisionStatus('success');
    } catch (error) {
      console.error('Video model test failed:', error);
      setVisionStatus('error');
      setErrorMessage(error.message || '视频模型调用失败');
    }
  };

  const isConfigured = Boolean(
    videoConfig.baseUrl && videoConfig.apiKey && videoConfig.model,
  );

  return (
    <GlassCard className="space-y-4 text-left">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Video className="h-4 w-4" />
        <span>视频通话 (Video Call API)</span>
      </div>

      <p className="text-[11px] leading-relaxed opacity-50">
        视频通话里替角色说话的模型，需要支持图片输入。它会同时看到你说话时的几张画面、你说的话和角色人设，一次回复出来。
        和上面的「视觉识别」不同：那个只负责把你发的图片转成文字描述。
        留空则视频通话使用主 API（要求主 API 的模型本身支持图片输入）。
      </p>

      <div className="space-y-3.5 text-xs">
        <div>
          <label className="mb-1 block opacity-60">
            Video API Base URL
          </label>

          <input
            type="text"
            placeholder="例如：https://api.openai.com/v1"
            value={videoConfig.baseUrl}
            onChange={updateField('baseUrl')}
            onBlur={handleBlur}
            className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
          />
        </div>

        <div>
          <label className="mb-1 block opacity-60">
            Video API Key
          </label>

          <input
            type="password"
            placeholder="sk-..."
            value={videoConfig.apiKey}
            onChange={updateField('apiKey')}
            onBlur={handleBlur}
            className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-black/5 pt-3 dark:border-white/5">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={
              connectionStatus === 'testing' ||
              !videoConfig.baseUrl ||
              !videoConfig.apiKey
            }
            className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 font-semibold text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {connectionStatus === 'testing' ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}

            <span>
              {connectionStatus === 'testing'
                ? '正在获取模型'
                : '测试连通性并获取模型'}
            </span>
          </button>

          {connectionStatus === 'success' && (
            <span className="flex items-center gap-1 font-semibold text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              API 连通正常
            </span>
          )}

          {connectionStatus === 'error' && (
            <span className="flex items-center gap-1 font-semibold text-rose-500">
              <XCircle className="h-4 w-4" />
              API 连接失败
            </span>
          )}
        </div>

        {models.length > 0 && (
          <div>
            <label className="mb-1 block opacity-60">
              视频通话模型
            </label>

            <div className="relative">
              <select
                value={videoConfig.model}
                onChange={handleModelChange}
                className="w-full appearance-none rounded-xl bg-black/5 p-3 pr-10 outline-none focus:bg-black/10 dark:bg-white/10"
              >
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
            </div>
          </div>
        )}

        {models.length === 0 && (
          <div>
            <label className="mb-1 block opacity-60">
              视频通话模型
            </label>

            <input
              type="text"
              placeholder="点击上方按钮获取模型，或手动输入模型名称"
              value={videoConfig.model}
              onChange={updateField('model')}
              onBlur={handleBlur}
              className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 dark:border-white/5">
          <button
            type="button"
            onClick={handleVisionTest}
            disabled={
              visionStatus === 'testing' ||
              !videoConfig.baseUrl ||
              !videoConfig.apiKey ||
              !videoConfig.model
            }
            className="rounded-xl bg-black/10 px-4 py-2.5 font-semibold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
          >
            {visionStatus === 'testing'
              ? '正在测试图片输入'
              : '测试图片输入'}
          </button>

          {visionStatus === 'success' && (
            <span className="flex items-center gap-1 font-semibold text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              图片输入正常
            </span>
          )}

          {visionStatus === 'error' && (
            <span className="flex items-center gap-1 font-semibold text-rose-500">
              <XCircle className="h-4 w-4" />
              图片输入失败
            </span>
          )}
        </div>

        {errorMessage && (
          <p className="break-words text-[11px] text-rose-500">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <span className="opacity-50">
            {isConfigured
              ? '已配置视频 API，视频通话将使用它'
              : '未配置时，视频通话使用主 API'}
          </span>

          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 font-semibold text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              已保存
            </span>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

export default VideoApiSettings;