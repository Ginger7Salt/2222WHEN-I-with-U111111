import React, { useEffect, useState } from 'react';
import {
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import GlassCard from '../GlassCard';
import {
  getVisionApiConfig,
  saveVisionApiConfig,
} from '../../services/visionService';

const DEFAULT_CONFIG = {
  baseUrl: '',
  apiKey: '',
  model: '',
};

const VisionApiSettings = () => {
  const [visionConfig, setVisionConfig] = useState(DEFAULT_CONFIG);
  const [models, setModels] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [visionStatus, setVisionStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      const existing = await getVisionApiConfig();

      if (existing) {
        setVisionConfig({
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
    await saveVisionApiConfig(nextConfig);
    setSaveStatus('saved');

    window.setTimeout(() => {
      setSaveStatus('idle');
    }, 1500);
  };

  const updateField = (field) => (event) => {
    const nextConfig = {
      ...visionConfig,
      [field]: event.target.value,
    };

    setVisionConfig(nextConfig);

    if (field === 'baseUrl' || field === 'apiKey') {
      setConnectionStatus('idle');
      setVisionStatus('idle');
      setModels([]);
      setErrorMessage('');
    }
  };

  const handleBlur = () => {
    if (!isLoaded) return;
    void persistConfig(visionConfig);
  };

  const normalizeBaseUrl = () => {
    let url = visionConfig.baseUrl.trim().replace(/\/+$/, '');

    if (!url) return '';

    // 如果用户填写了完整的 /chat/completions，自动还原到 API 根地址
    url = url.replace(/\/chat\/completions\/?$/, '');
    url = url.replace(/\/models\/?$/, '');

    return url;
  };

  const getModels = async () => {
    if (!visionConfig.baseUrl || !visionConfig.apiKey) {
      throw new Error('请先填写 Vision API Base URL 和 API Key');
    }

    const baseUrl = normalizeBaseUrl();

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${visionConfig.apiKey.trim()}`,
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

      const selectedModel = list.includes(visionConfig.model)
        ? visionConfig.model
        : list[0];

      const nextConfig = {
        ...visionConfig,
        model: selectedModel,
      };

      setVisionConfig(nextConfig);
      await persistConfig(nextConfig);
    } catch (error) {
      console.error('Vision API connection failed:', error);
      setConnectionStatus('error');
      setErrorMessage(error.message || '无法连接 Vision API');
    }
  };

  const handleModelChange = async (event) => {
    const nextConfig = {
      ...visionConfig,
      model: event.target.value,
    };

    setVisionConfig(nextConfig);
    await persistConfig(nextConfig);
  };

  const handleVisionTest = async () => {
    if (!visionConfig.baseUrl || !visionConfig.apiKey || !visionConfig.model) {
      setVisionStatus('error');
      setErrorMessage('请先填写 API，并选择一个视觉模型');
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
          Authorization: `Bearer ${visionConfig.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: visionConfig.model,
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
          `视觉调用失败：HTTP ${response.status}${errorText ? ` - ${errorText}` : ''}`,
        );
      }

      setVisionStatus('success');
    } catch (error) {
      console.error('Vision model test failed:', error);
      setVisionStatus('error');
      setErrorMessage(error.message || '视觉模型调用失败');
    }
  };

  const isConfigured = Boolean(
    visionConfig.baseUrl && visionConfig.apiKey,
  );

  return (
    <GlassCard className="space-y-4 text-left">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Eye className="h-4 w-4" />
        <span>视觉识别 (Vision API Configuration)</span>
      </div>

      <p className="text-[11px] opacity-50">
        视觉 API 独立于主聊天 API。可以获取模型列表，并使用一张极小的测试图片验证模型是否真正支持视觉输入。
      </p>

      <div className="space-y-3.5 text-xs">
        <div>
          <label className="mb-1 block opacity-60">
            Vision API Base URL
          </label>

          <input
            type="text"
            placeholder="例如：https://api.openai.com/v1"
            value={visionConfig.baseUrl}
            onChange={updateField('baseUrl')}
            onBlur={handleBlur}
            className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
          />
        </div>

        <div>
          <label className="mb-1 block opacity-60">
            Vision API Key
          </label>

          <input
            type="password"
            placeholder="sk-..."
            value={visionConfig.apiKey}
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
              !visionConfig.baseUrl ||
              !visionConfig.apiKey
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
              视觉模型
            </label>

            <div className="relative">
              <select
                value={visionConfig.model}
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
              视觉模型
            </label>

            <input
              type="text"
              placeholder="点击上方按钮获取模型，或手动输入模型名称"
              value={visionConfig.model}
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
              !visionConfig.baseUrl ||
              !visionConfig.apiKey ||
              !visionConfig.model
            }
            className="rounded-xl bg-black/10 px-4 py-2.5 font-semibold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/10"
          >
            {visionStatus === 'testing'
              ? '正在测试视觉调用'
              : '测试视觉模型'}
          </button>

          {visionStatus === 'success' && (
            <span className="flex items-center gap-1 font-semibold text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              视觉调用正常
            </span>
          )}

          {visionStatus === 'error' && (
            <span className="flex items-center gap-1 font-semibold text-rose-500">
              <XCircle className="h-4 w-4" />
              视觉调用失败
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
              ? '已配置视觉 API'
              : '未配置时，发送的图片不会被识别'}
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

export default VisionApiSettings;
