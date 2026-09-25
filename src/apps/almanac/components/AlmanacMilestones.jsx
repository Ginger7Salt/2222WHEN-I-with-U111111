import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import AlmanacMilestoneManager from './AlmanacMilestoneManager';
import AlmanacMilestoneJourney from './AlmanacMilestoneJourney';

import {
  getAlmanacImportantDates,
  createAlmanacImportantDate,
  updateAlmanacImportantDate,
  deleteAlmanacImportantDate,
  getDaysRemaining,
} from '../services/almanacImportantDateService';

export const AlmanacMilestones = ({ chatId, onConfigSaved }) => {
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

  // 预览只显示"下一个即将到来的日期"，而不是把所有重要日期再列一遍——
  // 完整、可编辑的列表已经在下面的 AlmanacMilestoneManager 里了，
  // 这里重复展示全部会让页面长度直接翻倍。
  // 这是纯展示层的派生计算，不涉及新的 props/state，也不改变任何业务逻辑。
  const nextUpcoming = useMemo(() => {
    if (!importantDates.length) {
      return null;
    }

    const upcoming = importantDates
      .map((item) => ({
        item,
        daysRemaining: getDaysRemaining(item),
      }))
      .filter(
        ({ daysRemaining }) =>
          Number.isInteger(daysRemaining) && daysRemaining >= 0,
      );

    if (!upcoming.length) {
      return null;
    }

    return upcoming.sort(
      (a, b) => a.daysRemaining - b.daysRemaining,
    )[0];
  }, [importantDates]);

  return (
    <>
      <section className="almanac-panel almanac-milestones-overview">
        <header className="almanac-milestone-heading">
          <div className="almanac-milestone-heading-copy">
            <p className="almanac-eyebrow">TOGETHER SO FAR</p>

            <h2 className="almanac-section-title">这一路走来</h2>

            <p className="almanac-milestone-description">
              一个个节点会随着相处慢慢点亮，也可以留下一个正在靠近的日子。
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

        <AlmanacMilestoneJourney chatId={chatId} onConfigSaved={onConfigSaved} />

        {!isLoading && nextUpcoming && (
          <div className="almanac-personal-milestone-list">
            <div className="almanac-subsection-heading">
              <p className="almanac-subsection-kicker">NEXT UP</p>
              <span className="almanac-subsection-rule" />
            </div>

            <article className="almanac-personal-milestone">
              <span
                className="almanac-personal-milestone-dot"
                aria-hidden="true"
              />

              <div className="almanac-personal-milestone-content">
                <strong>{nextUpcoming.item.title}</strong>

                <p>
                  {nextUpcoming.item.date}

                  {nextUpcoming.item.isRecurringYearly && (
                    <span className="almanac-milestone-tag">
                      每年重复
                    </span>
                  )}
                </p>

                <small
                  className={
                    nextUpcoming.daysRemaining === 0
                      ? 'almanac-personal-countdown is-today'
                      : 'almanac-personal-countdown'
                  }
                >
                  {nextUpcoming.daysRemaining === 0
                    ? '就是今天'
                    : `还有 ${nextUpcoming.daysRemaining} 天`}
                </small>
              </div>
            </article>
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