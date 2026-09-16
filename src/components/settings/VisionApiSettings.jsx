import React, { useEffect, useState } from 'react';
import { Eye, CheckCircle2 } from 'lucide-react';
import GlassCard from '../GlassCard';
import { getVisionApiConfig, saveVisionApiConfig } from '../../services/visionService';

const VisionApiSettings = () => {
  const [visionConfig, setVisionConfig] = useState({
    baseUrl: '',
    apiKey: '',
    model: '',
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saved

  useEffect(() => {
    (async () => {
      const existing = await getVisionApiConfig();

      if (existing) {
        setVisionConfig({
          baseUrl: existing.baseUrl || '',
          apiKey: existing.apiKey || '',
          model: existing.model || '',
        });
      }

      setIsLoaded(true);
    })();
  }, []);

  // 简单的失焦即保存，视觉配置不需要像主 API 那样做连通性测试，
  // 因为它只在用户真正发图片时才会被调用，配置错了也不影响正常聊天。
  const persistConfig = async (nextConfig) => {
    await saveVisionApiConfig(nextConfig);
    setSaveStatus('saved');
    window.setTimeout(() => setSaveStatus('idle'), 1500);
  };

  const updateField = (field) => (event) => {
    const nextConfig = {
      ...visionConfig,
      [field]: event.target.value,
    };

    setVisionConfig(nextConfig);
  };

  const handleBlur = () => {
    if (!isLoaded) return;
    void persistConfig(visionConfig);
  };

  const isConfigured = Boolean(visionConfig.baseUrl && visionConfig.apiKey);

  return (
    <GlassCard className="space-y-4 text-left">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Eye className="h-4 w-4" />
        <span>视觉识别 (Vision API Configuration)</span>
      </div>

      <p className="text-[11px] opacity-50">
        独立于上方的主聊天 API。仅当角色需要“看到”你发送的真实图片时才会调用这里配置的接口，需支持视觉能力的模型（如 gpt-4o、gpt-4o-mini 等）。
      </p>

      <div className="space-y-3.5 text-xs">
        <div>
          <label className="mb-1 block opacity-60">Vision API Base URL</label>
          <input
            type="text"
            placeholder="e.g. https://api.openai.com/v1"
            value={visionConfig.baseUrl}
            onChange={updateField('baseUrl')}
            onBlur={handleBlur}
            className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
          />
        </div>

        <div>
          <label className="mb-1 block opacity-60">Vision API Key</label>
          <input
            type="password"
            placeholder="sk-..."
            value={visionConfig.apiKey}
            onChange={updateField('apiKey')}
            onBlur={handleBlur}
            className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
          />
        </div>

        <div>
          <label className="mb-1 block opacity-60">Model</label>
          <input
            type="text"
            placeholder="gpt-4o-mini"
            value={visionConfig.model}
            onChange={updateField('model')}
            onBlur={handleBlur}
            className="w-full rounded-xl bg-black/5 p-3 outline-none focus:bg-black/10 dark:bg-white/10"
          />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-black/5 pt-3 dark:border-white/5">
          <span className="opacity-50">
            {isConfigured ? '已配置，用户发图后会自动识别' : '未配置时，发送的图片不会被识别'}
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