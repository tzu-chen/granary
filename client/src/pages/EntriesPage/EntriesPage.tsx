import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { statsService, openService } from '../../services/api';
import ReviewTab from './ReviewTab';
import OpenTab from './OpenTab';
import SearchTab from './SearchTab';
import styles from './EntriesPage.module.css';

type Tab = 'review' | 'open' | 'search';

export default function EntriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) || 'review';

  const [dueCount, setDueCount] = useState(0);
  const [openCount, setOpenCount] = useState(0);

  const refreshCounts = useCallback(async () => {
    try {
      const [overview, openStats] = await Promise.all([
        statsService.overview(),
        openService.stats(),
      ]);
      setDueCount(overview.due_today);
      setOpenCount(openStats.total);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const setTab = (tab: Tab) => {
    setSearchParams({ tab });
  };

  return (
    <div className={styles.page}>
      {/* Summary Bar */}
      <div className={styles.summaryBar}>
        <button
          className={`${styles.summaryItem} ${activeTab === 'review' ? styles.summaryActive : ''}`}
          onClick={() => setTab('review')}
        >
          <span className={styles.summaryCount}>{dueCount}</span>
          <span className={styles.summaryLabel}>cards due</span>
        </button>
        <button
          className={`${styles.summaryItem} ${activeTab === 'open' ? styles.summaryActive : ''}`}
          onClick={() => setTab('open')}
        >
          <span className={styles.summaryCount}>{openCount}</span>
          <span className={styles.summaryLabel}>open items</span>
        </button>
      </div>

      {/* Tab Bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'review' ? styles.tabActive : ''}`}
          onClick={() => setTab('review')}
        >
          Review
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'open' ? styles.tabActive : ''}`}
          onClick={() => setTab('open')}
        >
          Open
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'search' ? styles.tabActive : ''}`}
          onClick={() => setTab('search')}
        >
          Search
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'review' && <ReviewTab onCountsChange={refreshCounts} />}
        {activeTab === 'open' && <OpenTab onCountsChange={refreshCounts} />}
        {activeTab === 'search' && <SearchTab />}
      </div>
    </div>
  );
}
