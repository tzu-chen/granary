import { useState, useEffect, useRef, useCallback } from 'react';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { SummaryItem } from '../../types';
import { daySummaryService, summaryItemService, periodGoalService } from '../../services/api';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import TasksBlock from '../TasksBlock/TasksBlock';
import styles from './DaySummary.module.css';

interface Props {
  dateCst: string;
  todayCst: string;
}

type GoalTab = 'weekly' | 'monthly';

function getWeekKey(dateCst: string): string {
  const d = new Date(dateCst + 'T12:00:00');
  const year = getISOWeekYear(d);
  const week = getISOWeek(d);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getMonthKey(dateCst: string): string {
  return dateCst.slice(0, 7); // "YYYY-MM"
}

const GOAL_TAB_PLACEHOLDERS: Record<GoalTab, string> = {
  weekly: 'Goals for this week...',
  monthly: 'Goals for this month...',
};

const OPEN_QUESTIONS_PLACEHOLDER = 'Quick notes on unresolved questions for the day...';

export default function DaySummary({ dateCst, todayCst }: Props) {
  const [openQuestions, setOpenQuestions] = useState<string | null>(null);
  const [goalsArchive, setGoalsArchive] = useState<string | null>(null);
  const [progressArchive, setProgressArchive] = useState<string | null>(null);
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingOQ, setEditingOQ] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemTag, setNewItemTag] = useState('');
  const [showTemplate, setShowTemplate] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  // Goal tabs state — daily goals are migrated to tasks; only weekly/monthly remain.
  const [goalTab, setGoalTab] = useState<GoalTab>('weekly');
  const [weeklyGoals, setWeeklyGoals] = useState<string | null>(null);
  const [monthlyGoals, setMonthlyGoals] = useState<string | null>(null);
  const [editingGoals, setEditingGoals] = useState(false);

  const oqTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const periodTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const oqRef = useRef<string | null>(null);
  oqRef.current = openQuestions;
  const weeklyGoalsRef = useRef<string | null>(null);
  weeklyGoalsRef.current = weeklyGoals;
  const monthlyGoalsRef = useRef<string | null>(null);
  monthlyGoalsRef.current = monthlyGoals;

  const weekKey = getWeekKey(dateCst);
  const monthKey = getMonthKey(dateCst);

  const isPastDay = dateCst < todayCst;
  const hasArchive = isPastDay && (!!goalsArchive || !!progressArchive);

  const saveOQ = useCallback((value: string | null) => {
    daySummaryService.save(dateCst, { open_questions: value }).catch(() => {});
  }, [dateCst]);

  const savePeriodGoals = useCallback((periodKey: string, periodType: 'weekly' | 'monthly', value: string | null) => {
    periodGoalService.save(periodKey, { goals: value, period_type: periodType }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoaded(false);
    setEditingOQ(false);
    setEditingGoals(false);
    setEditingItemId(null);
    setShowAddItem(false);
    setShowTemplate(false);
    setArchiveExpanded(false);
    setExpandedItems(new Set());

    const wk = getWeekKey(dateCst);
    const mk = getMonthKey(dateCst);

    Promise.all([
      daySummaryService.get(dateCst),
      periodGoalService.get(wk),
      periodGoalService.get(mk),
    ]).then(([data, weekData, monthData]) => {
      setOpenQuestions(data.open_questions);
      setGoalsArchive(data.goals);
      setProgressArchive(data.progress);
      setItems(data.items || []);
      setWeeklyGoals(weekData.goals);
      setMonthlyGoals(monthData.goals);

      const hasAny = !!data.open_questions || (data.items && data.items.length > 0) || !!weekData.goals || !!monthData.goals;
      setShowTemplate(!!hasAny);
      setLoaded(true);
    }).catch(() => {
      setOpenQuestions(null);
      setGoalsArchive(null);
      setProgressArchive(null);
      setItems([]);
      setWeeklyGoals(null);
      setMonthlyGoals(null);
      setShowTemplate(false);
      setLoaded(true);
    });

    return () => {
      // Flush pending debounce saves before switching dates or unmounting
      if (oqTimer.current) {
        clearTimeout(oqTimer.current);
        oqTimer.current = null;
        saveOQ(oqRef.current);
      }
      for (const key of ['weekly', 'monthly'] as const) {
        if (periodTimers.current[key]) {
          clearTimeout(periodTimers.current[key]);
          delete periodTimers.current[key];
          if (key === 'weekly') savePeriodGoals(wk, 'weekly', weeklyGoalsRef.current);
          else savePeriodGoals(mk, 'monthly', monthlyGoalsRef.current);
        }
      }
    };
  }, [dateCst, saveOQ, savePeriodGoals]);

  // --- Open Questions handlers ---

  const handleOQChange = (value: string) => {
    const finalValue = value || null;
    setOpenQuestions(finalValue);
    oqRef.current = finalValue;
    if (oqTimer.current) clearTimeout(oqTimer.current);
    oqTimer.current = setTimeout(() => saveOQ(finalValue), 1500);
  };

  const handleOQBlur = () => {
    if (oqTimer.current) {
      clearTimeout(oqTimer.current);
      oqTimer.current = null;
    }
    const value = oqRef.current;
    if (!value?.trim()) {
      setOpenQuestions(null);
      oqRef.current = null;
      saveOQ(null);
    } else {
      saveOQ(value);
    }
    setEditingOQ(false);
  };

  // --- Period goals handlers ---

  const getActiveGoals = (): string | null => {
    return goalTab === 'weekly' ? weeklyGoals : monthlyGoals;
  };

  const setActiveGoals = (value: string | null) => {
    if (goalTab === 'weekly') {
      setWeeklyGoals(value);
      weeklyGoalsRef.current = value;
    } else {
      setMonthlyGoals(value);
      monthlyGoalsRef.current = value;
    }
  };

  const saveActiveGoals = (value: string | null) => {
    if (goalTab === 'weekly') savePeriodGoals(weekKey, 'weekly', value);
    else savePeriodGoals(monthKey, 'monthly', value);
  };

  const normalizeGoalsText = (text: string): string => {
    return text.split('\n').map(line => {
      if (!line.trim()) return line;
      if (/^- \[[ x]\] /.test(line)) return line;
      return `- [ ] ${line.replace(/^[-*]\s*/, '')}`;
    }).join('\n');
  };

  const handleGoalsChange = (value: string) => {
    const finalValue = value || null;
    setActiveGoals(finalValue);
    const timerKey = goalTab;
    if (periodTimers.current[timerKey]) clearTimeout(periodTimers.current[timerKey]);
    periodTimers.current[timerKey] = setTimeout(() => {
      if (goalTab === 'weekly') savePeriodGoals(weekKey, 'weekly', finalValue);
      else savePeriodGoals(monthKey, 'monthly', finalValue);
    }, 1500);
  };

  const handleGoalsBlur = () => {
    const currentValue = getActiveGoals();
    if (periodTimers.current[goalTab]) {
      clearTimeout(periodTimers.current[goalTab]);
      delete periodTimers.current[goalTab];
    }
    if (!currentValue?.trim()) {
      setActiveGoals(null);
      saveActiveGoals(null);
    } else {
      const normalized = normalizeGoalsText(currentValue);
      setActiveGoals(normalized);
      saveActiveGoals(normalized);
    }
    setEditingGoals(false);
  };

  const handleGoalToggle = (lineIndex: number) => {
    const value = getActiveGoals() || '';
    const lines = value.split('\n');
    const line = lines[lineIndex];
    if (/^- \[x\] /.test(line)) {
      lines[lineIndex] = line.replace('- [x] ', '- [ ] ');
    } else if (/^- \[ \] /.test(line)) {
      lines[lineIndex] = line.replace('- [ ] ', '- [x] ');
    }
    const updated = lines.join('\n');
    setActiveGoals(updated);
    saveActiveGoals(updated);
  };

  // --- Summary item handlers ---

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setEditingItemId(i => i === id ? null : i);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleItemFieldChange = (id: string, field: 'title' | 'content' | 'tag', value: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value || null } : item
    ));
    const timerKey = `${id}_${field}`;
    if (itemTimers.current[timerKey]) clearTimeout(itemTimers.current[timerKey]);
    itemTimers.current[timerKey] = setTimeout(() => {
      summaryItemService.update(dateCst, id, { [field]: value || null }).catch(() => {});
    }, 1500);
  };

  const addItem = async () => {
    if (!newItemTitle.trim()) return;
    try {
      const item = await summaryItemService.create(dateCst, {
        title: newItemTitle.trim(),
        content: newItemContent.trim() || undefined,
        tag: newItemTag.trim() || undefined,
      });
      setItems(prev => [...prev, item]);
      setNewItemTitle('');
      setNewItemContent('');
      setNewItemTag('');
      setShowAddItem(false);
      setExpandedItems(prev => new Set(prev).add(item.id));
    } catch { /* ignore */ }
  };

  const deleteItem = async (id: string) => {
    try {
      await summaryItemService.delete(dateCst, id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
  };

  // --- Drag and drop reorder ---

  const handleDragStart = (id: string) => { dragItemRef.current = id; };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDragLeave = () => setDragOverId(null);
  const handleDrop = async (targetId: string) => {
    setDragOverId(null);
    const dragId = dragItemRef.current;
    if (!dragId || dragId === targetId) return;
    const newItems = [...items];
    const dragIndex = newItems.findIndex(i => i.id === dragId);
    const targetIndex = newItems.findIndex(i => i.id === targetId);
    if (dragIndex === -1 || targetIndex === -1) return;
    const [moved] = newItems.splice(dragIndex, 1);
    newItems.splice(targetIndex, 0, moved);
    setItems(newItems);
    try {
      await summaryItemService.reorder(dateCst, newItems.map(i => i.id));
    } catch { /* ignore */ }
    dragItemRef.current = null;
  };

  if (!loaded) return null;

  // Empty-state branch: no template content, no items, no period goals.
  // TasksBlock still renders so today's tasks remain visible.
  if (!showTemplate) {
    return (
      <div className={styles.container}>
        <TasksBlock dateCst={dateCst} todayCst={todayCst} />
        {hasArchive && renderArchive()}
        <button className={styles.addSummaryBtn} onClick={() => setShowTemplate(true)}>
          + Add summary
        </button>
      </div>
    );
  }

  function renderArchive() {
    return (
      <div className={styles.archive}>
        <button
          type="button"
          className={styles.archiveHeader}
          onClick={() => setArchiveExpanded(e => !e)}
          aria-expanded={archiveExpanded}
        >
          <span className={styles.archiveChevron}>{archiveExpanded ? '▾' : '▸'}</span>
          <span>Pre-migration notes</span>
          <span className={styles.archiveBadge}>read-only</span>
        </button>
        {archiveExpanded && (
          <div className={styles.archiveBody}>
            {goalsArchive && (
              <div className={styles.archiveSection}>
                <div className={styles.archiveLabel}>Goals</div>
                <div className={styles.archiveContent}>
                  <MarkdownLatex content={goalsArchive} />
                </div>
              </div>
            )}
            {progressArchive && (
              <div className={styles.archiveSection}>
                <div className={styles.archiveLabel}>Progress</div>
                <div className={styles.archiveContent}>
                  <MarkdownLatex content={progressArchive} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const renderGoalsContent = () => {
    const activeGoals = getActiveGoals();
    const placeholder = GOAL_TAB_PLACEHOLDERS[goalTab];

    if (editingGoals) {
      return (
        <textarea
          className={styles.noteTextarea}
          value={activeGoals || ''}
          onChange={e => handleGoalsChange(e.target.value)}
          onBlur={handleGoalsBlur}
          placeholder={placeholder}
          autoFocus
        />
      );
    }

    if (activeGoals) {
      return (
        <div className={styles.goalsList}>
          {activeGoals.split('\n').map((line, i) => {
            if (!line.trim()) return <div key={i} style={{ height: '1.7em' }} />;
            const checked = /^- \[x\] /.test(line);
            const text = line.replace(/^- \[[ x]\] /, '');
            return (
              <div key={i} className={`${styles.goalItem} ${checked ? styles.goalChecked : ''}`}>
                <span
                  className={`${styles.goalCheckbox} ${checked ? styles.goalCheckboxChecked : ''}`}
                  onClick={() => handleGoalToggle(i)}
                  role="checkbox"
                  aria-checked={checked}
                >
                  {checked && <span className={styles.goalCheckmark}>&#10003;</span>}
                </span>
                <span className={styles.goalText} onClick={() => setEditingGoals(true)}>
                  <MarkdownLatex content={text} />
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className={styles.notePlaceholder} onClick={() => setEditingGoals(true)}>
        {placeholder}
      </div>
    );
  };

  const renderOpenQuestionsContent = () => {
    if (editingOQ) {
      return (
        <textarea
          className={styles.noteTextarea}
          value={openQuestions || ''}
          onChange={e => handleOQChange(e.target.value)}
          onBlur={handleOQBlur}
          placeholder={OPEN_QUESTIONS_PLACEHOLDER}
          autoFocus
        />
      );
    }
    if (openQuestions) {
      return (
        <div className={styles.noteContent} onClick={() => setEditingOQ(true)}>
          <MarkdownLatex content={openQuestions} />
        </div>
      );
    }
    return (
      <div className={styles.notePlaceholder} onClick={() => setEditingOQ(true)}>
        {OPEN_QUESTIONS_PLACEHOLDER}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.noteGrid}>
        <div className={styles.note}>
          <div className={styles.noteLabel}>
            <span>Goals</span>
            <div className={styles.goalTabs}>
              {(['weekly', 'monthly'] as GoalTab[]).map(tab => (
                <button
                  key={tab}
                  className={`${styles.goalTab} ${goalTab === tab ? styles.goalTabActive : ''}`}
                  onClick={() => { setGoalTab(tab); setEditingGoals(false); }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.noteRuled}>
            {renderGoalsContent()}
          </div>
        </div>

        <div className={styles.note}>
          <div className={styles.noteLabel}>Open Questions</div>
          <div className={styles.noteRuled}>
            {renderOpenQuestionsContent()}
          </div>
        </div>
      </div>

      {/* Tasks block — between the structured template and summary items */}
      <TasksBlock dateCst={dateCst} todayCst={todayCst} />

      {hasArchive && renderArchive()}

      {/* Summary items */}
      {items.length > 0 && (
        <div className={styles.items}>
          {items.map(item => {
            const isExpanded = expandedItems.has(item.id);
            const isEditing = editingItemId === item.id;

            return (
              <div
                key={item.id}
                className={`${styles.item} ${dragOverId === item.id ? styles.itemDragOver : ''}`}
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={e => handleDragOver(e, item.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(item.id)}
              >
                <div className={styles.itemHeader} onClick={() => toggleItem(item.id)}>
                  <span className={styles.dragHandle} title="Drag to reorder">&#8942;&#8942;</span>
                  {isEditing ? (
                    <input
                      className={styles.itemTitleInput}
                      value={item.title}
                      onChange={e => handleItemFieldChange(item.id, 'title', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onBlur={() => setEditingItemId(null)}
                    />
                  ) : (
                    <span className={styles.itemTitle}>{item.title}</span>
                  )}
                  {item.tag && <span className={styles.itemTag}>{item.tag}</span>}
                  <button
                    className={styles.itemDeleteBtn}
                    onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                    title="Delete item"
                  >
                    &times;
                  </button>
                </div>
                {isExpanded && (
                  <div className={styles.itemBody}>
                    {isEditing ? (
                      <>
                        <textarea
                          className={styles.itemTextarea}
                          value={item.content || ''}
                          onChange={e => handleItemFieldChange(item.id, 'content', e.target.value)}
                          placeholder="Content (Markdown + LaTeX)..."
                          rows={3}
                        />
                        <input
                          className={styles.itemTagInput}
                          value={item.tag || ''}
                          onChange={e => handleItemFieldChange(item.id, 'tag', e.target.value)}
                          placeholder="Tag (optional)"
                        />
                      </>
                    ) : (
                      <div
                        className={styles.itemContent}
                        onClick={() => setEditingItemId(item.id)}
                      >
                        {item.content ? (
                          <MarkdownLatex content={item.content} />
                        ) : (
                          <span className={styles.itemPlaceholder}>Click to add content...</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add item */}
      {showAddItem ? (
        <div className={styles.addItemForm}>
          <input
            className={styles.addItemTitle}
            value={newItemTitle}
            onChange={e => setNewItemTitle(e.target.value)}
            placeholder="Title (required)"
            autoFocus
          />
          <textarea
            className={styles.addItemContent}
            value={newItemContent}
            onChange={e => setNewItemContent(e.target.value)}
            placeholder="Content (optional, Markdown + LaTeX)"
            rows={2}
          />
          <input
            className={styles.addItemTag}
            value={newItemTag}
            onChange={e => setNewItemTag(e.target.value)}
            placeholder="Tag (optional)"
          />
          <div className={styles.addItemActions}>
            <button className={styles.cancelBtn} onClick={() => { setShowAddItem(false); setNewItemTitle(''); setNewItemContent(''); setNewItemTag(''); }}>
              Cancel
            </button>
            <button className={styles.submitBtn} onClick={addItem} disabled={!newItemTitle.trim()}>
              Add Item
            </button>
          </div>
        </div>
      ) : (
        <button className={styles.addItemBtn} onClick={() => setShowAddItem(true)}>
          + Add topic block
        </button>
      )}
    </div>
  );
}
