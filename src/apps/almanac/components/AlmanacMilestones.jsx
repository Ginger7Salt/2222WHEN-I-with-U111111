import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import AlmanacMilestoneManager from './AlmanacMilestoneManager';
import AlmanacCompanionshipCard from './AlmanacCompanionshipCard';

import {
  getAlmanacImportantDates,
  createAlmanacImportantDate,
  updateAlmanacImportantDate,
  deleteAlmanacImportantDate,
  getDaysRemaining,
} from '../services/almanacImportantDateService';

export const AlmanacMilestones = ({ chatId }) => {
  const [importantDates, setImportantDates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openCreateSignal, setOpenCreateSignal] = useState(0);

  const loadImportantDates = useCallback(async () => {
    if (!chatId) {
      setImportantDates([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const items = await getAlmanacImportantDates(chatId);
      setImportantDates(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error('[Almanac] 读取重要日期失败：', error);
      setImportantDates([]);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    void loadImportantDates();
  }, [loadImportantDates]);

  const handleCreate = async (payload) => {
    if (!chatId || !payload) return;

    const createdId = await createAlmanacImportantDate({
      chatId,
      ...payload,
    });

    if (!createdId) return;

    await loadImportantDates();
  };

  const handleUpdate = async (id, patch) => {
    if (!id || !patch) return;

    const updated = await updateAlmanacImportantDate(id, patch);

    if (!updated) return;

    await loadImportantDates();
  };

  const handleDelete = async (id) => {
    if (!id) return;

    await deleteAlmanacImportantDate(id);
    await loadImportantDates();
  };

  const handleOpenCreate = () => {
    setOpenCreateSignal((value) => value + 1);

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    window.setTimeout(() => {
      document
        .querySelector('[data-almanac-milestone-manager]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  return (
    <>
      <section className="almanac-panel almanac-milestones-overview">
        <header className="almanac-milestone-heading">
          <div className="almanac-milestone-heading-copy">
            <p className="almanac-eyebrow">TOGETHER SO FAR</p>

            <h2 className="almanac-section-title">这一路走来</h2>

            <p className="almanac-milestone-description">
              一些关于相处的痕迹，也可以留下一个正在靠近的日子。
            </p>
          </div>

          <button
            type="button"
            className="almanac-secondary-button almanac-add-date-button"
            onClick={handleOpenCreate}
          >
            <span>添加日期</span>
            <span className="almanac-button-arrow" aria-hidden="true">↗</span>
          </button>
        </header>

        <AlmanacCompanionshipCard chatId={chatId} />

        {!isLoading && importantDates.length > 0 && (
          <div className="almanac-personal-milestone-list">
            <div className="almanac-subsection-heading">
              <p className="almanac-subsection-kicker">YOUR DATES</p>
              <span className="almanac-subsection-rule" />
            </div>

            {importantDates.map((item) => {
              const daysRemaining = getDaysRemaining(item);

              return (
                <article
                  className="almanac-personal-milestone"
                  key={item.id}
                >
                  <span
                    className="almanac-personal-milestone-dot"
                    aria-hidden="true"
                  />

                  <div className="almanac-personal-milestone-content">
                    <strong>{item.title}</strong>

                    <p>
                      {item.date}

                      {item.isRecurringYearly && (
                        <span className="almanac-milestone-tag">
                          每年重复
                        </span>
                      )}
                    </p>

                    {Number.isInteger(daysRemaining) && (
                      <small
                        className={
                          daysRemaining === 0
                            ? 'almanac-personal-countdown is-today'
                            : daysRemaining < 0
                              ? 'almanac-personal-countdown is-past'
                              : 'almanac-personal-countdown'
                        }
                      >
                        {daysRemaining === 0
                          ? '就是今天'
                          : daysRemaining > 0
                            ? `还有 ${daysRemaining} 天`
                            : `已过去 ${Math.abs(daysRemaining)} 天`}
                      </small>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <AlmanacMilestoneManager
        milestones={importantDates}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        openCreateSignal={openCreateSignal}
      />
    </>
  );
};

export default AlmanacMilestones;

