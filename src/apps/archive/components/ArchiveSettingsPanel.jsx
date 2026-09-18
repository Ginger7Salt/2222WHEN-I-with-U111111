import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import {
  getArchiveSettings,
  saveArchiveSettings
} from '../archiveService';
import '../archive.css';

const ArchiveSettingsPanel = ({ onClose }) => {
  const [settings, setSettings] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const current = await getArchiveSettings();

      if (!cancelled) {
        setSettings(current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (nextSettings) => {
    setSettings(nextSettings);
    setIsSaving(true);

    try {
      await saveArchiveSettings(nextSettings);
    } catch (error) {
      console.error('[Archive] 保存自动归档设置失败：', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = () => {
    if (!settings) {
      return;
    }

    void persist({
      ...settings,
      autoArchiveEnabled: !settings.autoArchiveEnabled
    });
  };

  const handleDaysChange = (event) => {
    if (!settings) {
      return;
    }

    const raw = Number(event.target.value);
    const days = Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : 14;

    void persist({
      ...settings,
      autoArchiveDaysThreshold: days
    });
  };

  return (
    <div className="archive-settings-overlay" onClick={onClose}>
      <div
        className="archive-settings-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="archive-settings-header">
          <span className="archive-settings-title">自动归档设置</span>

          <button
            type="button"
            className="archive-settings-close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!settings && (
          <p className="archive-settings-save-note">正在读取设置。</p>
        )}

        {settings && (
          <>
            <div className="archive-settings-row">
              <div>
                <div className="archive-settings-row-label">
                  自动归档
                </div>
                <div className="archive-settings-row-hint">
                  超过下面天数的旧消息会定期自动收进档案柜
                </div>
              </div>

              <button
                type="button"
                className={[
                  'archive-settings-toggle',
                  settings.autoArchiveEnabled ? 'is-on' : ''
                ].join(' ')}
                onClick={handleToggle}
                aria-label="切换自动归档"
              >
                <span className="archive-settings-toggle-knob" />
              </button>
            </div>

            <div className="archive-settings-row">
              <div>
                <div className="archive-settings-row-label">
                  归档阈值（天）
                </div>
                <div className="archive-settings-row-hint">
                  早于这个天数的消息才会被自动归档
                </div>
              </div>

              <input
                type="number"
                min={1}
                className="archive-settings-days-input"
                value={settings.autoArchiveDaysThreshold}
                disabled={!settings.autoArchiveEnabled}
                onChange={handleDaysChange}
              />
            </div>

            <p className="archive-settings-save-note">
              {isSaving ? '正在保存…' : '设置会自动保存，每小时检查一次'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ArchiveSettingsPanel;