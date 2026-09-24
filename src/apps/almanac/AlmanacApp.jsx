import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowLeft,
  RefreshCw,
  Settings,
} from 'lucide-react';

import db from '../../db';

import AlmanacChatSelector from './components/AlmanacChatSelector';
import AlmanacObservation from './components/AlmanacObservation';
import AlmanacMilestones from './components/AlmanacMilestones';
import AlmanacReminderManager from './components/AlmanacReminderManager';
import AlmanacRoutineProfile from './components/AlmanacRoutineProfile';
import AlmanacSettingsPanel from './components/AlmanacSettingsPanel';
import AlmanacInitialization from './components/AlmanacInitialization';

import {
  clearAlmanacRecords,
  filterAlmanacRecordsByConfig,
  getAlmanacConfig,
  getAlmanacRecords,
  getAlmanacStats,
  saveAlmanacConfig,
} from './services/almanacService';

import { getRhythmObservation } from './services/almanacRhythmService';

import './almanac.css';

// 顶部这一排是可以左右滑动的"标签卡片"，点一下就在下方展开对应内容，
// 一次只展开一个——纯展示层的状态，不涉及任何数据读取或业务逻辑。
const ALMANAC_TABS = [
  { key: 'record', index: '01', title: '记录', hint: '这里留下过' },
  { key: 'profile', index: '02', title: 'TA 眼中的你', hint: '作息与相处方式' },
  { key: 'milestones', index: '03', title: '这一路走来', hint: '陪伴与重要日期' },
  { key: 'reminders', index: '04', title: '轻提醒', hint: '自然地提一句' },
];

export const AlmanacApp = ({ onBackHub }) => {
  const [chats, setChats] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState('');
  const [config, setConfig] = useState(null);
  const [records, setRecords] = useState([]);
  const [showInitialization, setShowInitialization] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rhythmObservation, setRhythmObservation] = useState(null);
  const [activeTab, setActiveTab] = useState('record');

  const selectedChat = useMemo(
    () => chats.find((chat) => String(chat.id) === String(selectedChatId)),
    [chats, selectedChatId]
  );

  
  // selectedChatId 来自 <select> 下拉框，始终是字符串；
  // 但数据库里所有 almanac 表存的 chatId 都是数字（跟 db.chats 的 id 一致）。
  // 这里统一转换成数字，所有查询数据库的地方都用这个，避免类型不匹配导致查不到任何记录。
  const numericChatId = selectedChat?.id ?? null;

  const selectedCharacter = useMemo(
    () =>
      characters.find(
        (character) => String(character.id) === String(selectedChat?.characterId)
      ),
    [characters, selectedChat]
  );

  const loadChats = useCallback(async () => {
    try {
      const [chatList, characterList] = await Promise.all([
        db.chats.orderBy('updatedAt').reverse().toArray(),
        db.characters.toArray(),
      ]);

      const safeChats = Array.isArray(chatList) ? chatList : [];

      setChats(safeChats);
      setCharacters(Array.isArray(characterList) ? characterList : []);

      if (!selectedChatId && safeChats[0]?.id) {
        setSelectedChatId(String(safeChats[0].id));
      }
    } catch (error) {
      console.error('[Almanac] 读取聊天窗口失败：', error);
      setChats([]);
      setCharacters([]);
    }
  }, [selectedChatId]);

  const loadAlmanac = useCallback(async () => {
    if (!selectedChatId) {
      setConfig(null);
      setRecords([]);
      setShowInitialization(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
            const nextConfig = await getAlmanacConfig(numericChatId);

      setConfig(nextConfig);

      if (!nextConfig?.initializationCompleted) {
        setRecords([]);
        setShowInitialization(true);
        return;
      }

      setShowInitialization(false);

            const allRecords = await getAlmanacRecords(numericChatId);
      const filteredRecords = filterAlmanacRecordsByConfig(allRecords, nextConfig);

      setRecords(Array.isArray(filteredRecords) ? filteredRecords : []);
    } catch (error) {
      console.error('[Almanac] 读取相遇记录失败：', error);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
    }, [selectedChatId, numericChatId]);

  const refreshAlmanac = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    try {
      await loadChats();
      await loadAlmanac();
    } catch (error) {
      console.error('[Almanac] 刷新失败：', error);
    } finally {
      window.setTimeout(() => {
        setIsRefreshing(false);
      }, 420);
    }
  };

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    void loadAlmanac();
  }, [loadAlmanac]);

  useEffect(() => {
    let active = true;

    if (!selectedChatId) {
      setRhythmObservation(null);
      return undefined;
    }

    getRhythmObservation({ chatId: numericChatId, records })
      .then((result) => {
        if (active) setRhythmObservation(result);
      })
      .catch((error) => {
        console.error('[Almanac] 获取节律观察失败：', error);
        if (active) setRhythmObservation(null);
      });

    return () => {
      active = false;
    };
  }, [selectedChatId, numericChatId, records]);

  const stats = useMemo(() => getAlmanacStats(records), [records]);

  const handleInitializationComplete = async ({
    dataMode,
    firstMeetingDate = null,
  }) => {
      if (!numericChatId || !dataMode) return;
    const now = new Date().toISOString();

       const savedConfig = await saveAlmanacConfig(numericChatId, {
      initializationCompleted: true,
      dataMode,
      observationStartedAt: dataMode === 'all_history' ? null : now,
      observationResetAt: dataMode === 'all_history' ? null : now,
      preserveImportantDates: dataMode === 'preserve_dates_only',
    });

    if (dataMode === 'preserve_dates_only' && firstMeetingDate) {
      const { createAlmanacImportantDate } = await import(
        './services/almanacImportantDateService'
      );

            await createAlmanacImportantDate({
        chatId: numericChatId,
        title: '第一次相遇',
        date: firstMeetingDate,
        isRecurringYearly: false,
      });
    }

    setConfig(savedConfig);
    setShowInitialization(false);

        const allRecords = await getAlmanacRecords(numericChatId);
    const filteredRecords = filterAlmanacRecordsByConfig(allRecords, savedConfig);

    setRecords(Array.isArray(filteredRecords) ? filteredRecords : []);
  };

    const handleRestartAlmanac = async () => {
    if (!numericChatId) return;

    const confirmed = window.confirm(
      '确定从今天重新开始 Almanac 吗？\n\n旧记录会保留，但不会继续参与统计。'
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

        const savedConfig = await saveAlmanacConfig(numericChatId, {
      initializationCompleted: true,
      dataMode: 'fresh_start',
      observationStartedAt: now,
      observationResetAt: now,
      preserveImportantDates: false,
    });

    setConfig(savedConfig);

    const allRecords = await getAlmanacRecords(numericChatId);
    const filteredRecords = filterAlmanacRecordsByConfig(allRecords, savedConfig);

    setRecords(Array.isArray(filteredRecords) ? filteredRecords : []);
    setShowInitialization(false);
  };

    const handleClearAlmanacRecords = async () => {
    if (!numericChatId) return;

    const confirmed = window.confirm(
      '确定清空当前聊天的 Almanac 相处记录吗？\n\n聊天消息、长期记忆、角色资料和重要日期不会受到影响。'
    );

    if (!confirmed) return;

       await clearAlmanacRecords(numericChatId);

    setRecords([]);
    setRhythmObservation(null);
  };

    const handleSaveConfig = async (nextConfig, options = {}) => {
    if (!numericChatId || !nextConfig) return null;

    const saved = await saveAlmanacConfig(numericChatId, nextConfig);

    setConfig(saved);

    if (options.close !== false) {
      setShowSettings(false);
    }

    return saved;
  };

  return (
    <main className="almanac-app">
      <div className="almanac-grain" aria-hidden="true" />

      <div className="almanac-content">
        <div className="almanac-corner almanac-corner-top" aria-hidden="true" />
        <div className="almanac-corner almanac-corner-bottom" aria-hidden="true" />

        <header className="almanac-utility-bar">
          <button
            type="button"
            className="almanac-back-button"
            onClick={onBackHub}
            aria-label="返回主页"
            title="返回主页"
          >
            <ArrowLeft size={15} strokeWidth={1.5} />
          </button>

          <span className="almanac-room-code">ALMANAC / ROOM 01</span>

          <div className="almanac-header-actions">
            <button
              type="button"
              className="almanac-utility-button"
              onClick={() => void refreshAlmanac()}
              aria-label="刷新"
              title="刷新"
              disabled={isRefreshing}
            >
              <RefreshCw
                size={13}
                strokeWidth={1.5}
                className={isRefreshing ? 'almanac-refreshing' : ''}
              />
              <span>刷新</span>
            </button>

            <button
              type="button"
              className="almanac-utility-button"
              onClick={() => setShowSettings((value) => !value)}
              aria-label="观察设置"
              title="观察设置"
            >
              <Settings size={13} strokeWidth={1.5} />
              <span>设置</span>
            </button>
          </div>
        </header>

        <section className="almanac-masthead">
          <p className="almanac-masthead-kicker">A PRIVATE RECORD OF RETURNING</p>
          <h1>岁时纪</h1>
          <p className="almanac-masthead-subtitle">WHEN I WITH U · OBSERVATION ARCHIVE</p>
          <div className="almanac-masthead-rule" />
        </section>

        <section className="almanac-room-selector">
          <p className="almanac-eyebrow">OBSERVE ONE ROOM</p>

          <div className="almanac-room-row">
            <div className="almanac-room-info">
              <h2>{selectedChat?.title || '选择相遇空间'}</h2>
              <p>
                与 {selectedCharacter?.name || '这位角色'} 的独立相处记录
              </p>
            </div>

            <AlmanacChatSelector
              chats={chats}
              characters={characters}
              selectedChatId={selectedChatId}
              onChange={setSelectedChatId}
            />
          </div>
        </section>

        {!selectedChatId ? (
          <section className="almanac-empty almanac-reveal">
            还没有可以观察的聊天窗口。
          </section>
        ) : isLoading ? (
          <section className="almanac-empty almanac-loading">
            <span className="almanac-loading-dot" />
            正在显影相遇痕迹
          </section>
        ) : showInitialization ? (
          <AlmanacInitialization onComplete={handleInitializationComplete} />
        ) : (
          <>
            <section className="almanac-intro">
              <p>
                这里不安排生活，也不替你定义生活。
                这里只留下那些曾经回来过的时间。
              </p>
            </section>

            <div
              className="almanac-tab-strip"
              role="tablist"
              aria-label="选择要查看的内容"
            >
              {ALMANAC_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={
                    activeTab === tab.key
                      ? 'almanac-tab-card is-active'
                      : 'almanac-tab-card'
                  }
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span className="almanac-tab-index" aria-hidden="true">
                    {tab.index}
                  </span>
                  <strong className="almanac-tab-title">{tab.title}</strong>
                  <span className="almanac-tab-hint">{tab.hint}</span>
                </button>
              ))}
            </div>

            {activeTab === 'record' && (
              <section className="almanac-record-section almanac-reveal">
                <div className="almanac-record-heading">
                  <div>
                    <p className="almanac-eyebrow">A QUIET RECORD</p>
                    <h2>这里留下过</h2>
                  </div>

                  <span className="almanac-record-index">
                    INDEX {String(records.length).padStart(5, '0')}
                  </span>
                </div>

                <AlmanacObservation
                  stats={stats}
                  rhythmObservation={rhythmObservation}
                  isLoading={false}
                />
              </section>
            )}

                        {activeTab === 'profile' && (
              <section className="almanac-profile-section almanac-reveal">
                <AlmanacRoutineProfile
                  chatId={numericChatId}
                  characterName={selectedCharacter?.name}
                  records={records}
                  onConfigSaved={setConfig}
                />
              </section>
            )}

            {activeTab === 'milestones' && (
              <section className="almanac-milestone-section almanac-reveal">
                                <AlmanacMilestones chatId={numericChatId} />
              </section>
            )}

            {activeTab === 'reminders' && (
              <section className="almanac-reminder-section almanac-reveal">
                               <AlmanacReminderManager chatId={numericChatId} />
              </section>
            )}

            {showSettings && (
              <section className="almanac-settings-section almanac-reveal">
                <AlmanacSettingsPanel
                  config={config}
                  onSave={handleSaveConfig}
                  onRestart={handleRestartAlmanac}
                  onClearRecords={handleClearAlmanacRecords}
                  onOpenImportantDates={() => {
                    setShowSettings(false);
                    setActiveTab('milestones');

                    window.setTimeout(() => {
                      document
                        .querySelector('.almanac-milestone-section')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 30);
                  }}
                  onOpenReminders={() => {
                    setShowSettings(false);
                    setActiveTab('reminders');

                    window.setTimeout(() => {
                      document
                        .querySelector('.almanac-reminder-section')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 30);
                  }}
                />
              </section>
            )}

            <p className="almanac-footer-note">
              PRIVATE ARCHIVE / ONE ROOM, ONE TRACE
              <br />
              NOTHING HERE IS A SCHEDULE.
            </p>
          </>
        )}
      </div>
    </main>
  );
};

export default AlmanacApp;