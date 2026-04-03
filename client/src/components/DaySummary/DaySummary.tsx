import { useState, useEffect, useRef, useCallback } from 'react';
import { addDays, format, getISOWeek, getISOWeekYear } from 'date-fns';
import { SummaryItem } from '../../types';
import { daySummaryService, summaryItemService, periodGoalService } from '../../services/api';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import styles from './DaySummary.module.css';

interface Props {
  dateCst: string;
}

type TemplateField = 'goals' | 'progress';
type GoalTab = 'daily' | 'weekly' | 'monthly';

const SECTIONS: { key: TemplateField; label: string; placeholder: string }[] = [
  { key: 'goals', label: 'Goals', placeholder: 'What do you plan to work on today?' },
  { key: 'progress', label: 'Progress', placeholder: 'What did you actually accomplish?' },
];

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
  daily: 'What do you plan to work on today?',
  weekly: 'Goals for this week...',
  monthly: 'Goals for this month...',
};

export default function DaySummary({ dateCst }: Props) {
  const [goals, setGoals] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<TemplateField | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemTag, setNewItemTag] = useState('');
  const [showTemplate, setShowTemplate] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  // Goal tabs state
  const [goalTab, setGoalTab] = useState<GoalTab>('daily');
  const [weeklyGoals, setWeeklyGoals] = useState<string | null>(null);
  const [monthlyGoals, setMonthlyGoals] = useState<string | null>(null);

  const templateTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const itemTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const periodTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fieldState: Record<TemplateField, string | null> = { goals, progress };
  const fieldStateRef = useRef<Record<TemplateField, string | null>>({ goals: null, progress: null });
  fieldStateRef.current = { goals, progress };
  const weeklyGoalsRef = useRef<string | null>(null);
  weeklyGoalsRef.current = weeklyGoals;
  const monthlyGoalsRef = useRef<string | null>(null);
  monthlyGoalsRef.current = monthlyGoals;
  const fieldSetters: Record<TemplateField, (v: string | null) => void> = {
    goals: setGoals,
    progress: setProgress,
  };

  const weekKey = getWeekKey(dateCst);
  const monthKey = getMonthKey(dateCst);

  // --- Template section handlers ---

  const saveTemplateField = useCallback((field: TemplateField, value: string | null) => {
    daySummaryService.save(dateCst, { [field]: value }).catch(() => {});
  }, [dateCst]);

  const savePeriodGoals = useCallback((periodKey: string, periodType: 'weekly' | 'monthly', value: string | null) => {
    periodGoalService.save(periodKey, { goals: value, period_type: periodType }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoaded(false);
    setEditingSection(null);
    setEditingItemId(null);
    setShowAddItem(false);
    setShowTemplate(false);
    setExpandedItems(new Set());

    const wk = getWeekKey(dateCst);
    const mk = getMonthKey(dateCst);

    Promise.all([
      daySummaryService.get(dateCst),
      periodGoalService.get(wk),
      periodGoalService.get(mk),
    ]).then(([data, weekData, monthData]) => {
      setGoals(data.goals);
      setProgress(data.progress);
      setItems(data.items || []);
      setWeeklyGoals(weekData.goals);
      setMonthlyGoals(monthData.goals);

      const hasAny = data.goals || data.progress || (data.items && data.items.length > 0) || weekData.goals || monthData.goals;
      setShowTemplate(!!hasAny);
      setLoaded(true);
    }).catch(() => {
      setGoals(null);
      setProgress(null);
      setItems([]);
      setWeeklyGoals(null);
      setMonthlyGoals(null);
      setShowTemplate(false);
      setLoaded(true);
    });

    return () => {
      // Flush pending debounce saves before switching dates or unmounting
      const fields: TemplateField[] = ['goals', 'progress'];
      for (const field of fields) {
        if (templateTimers.current[field]) {
          clearTimeout(templateTimers.current[field]);
          delete templateTimers.current[field];
          const value = fieldStateRef.current[field];
          saveTemplateField(field, value);
        }
      }
      // Flush period goal timers
      for (const key of ['weekly', 'monthly'] as const) {
        if (periodTimers.current[key]) {
          clearTimeout(periodTimers.current[key]);
          delete periodTimers.current[key];
          if (key === 'weekly') {
            savePeriodGoals(wk, 'weekly', weeklyGoalsRef.current);
          } else {
            savePeriodGoals(mk, 'monthly', monthlyGoalsRef.current);
          }
        }
      }
    };
  }, [dateCst, saveTemplateField, savePeriodGoals]);

  const handleTemplateChange = (field: TemplateField, value: string) => {
    const finalValue = value || null;
    fieldSetters[field](finalValue);
    fieldStateRef.current[field] = finalValue;
    if (templateTimers.current[field]) clearTimeout(templateTimers.current[field]);
    templateTimers.current[field] = setTimeout(() => saveTemplateField(field, finalValue), 1500);
  };

  const startEditingSection = (key: TemplateField) => {
    setEditingSection(key);
  };

  const handleSectionBlur = (key: TemplateField) => {
    const currentValue = fieldStateRef.current[key];
    if (templateTimers.current[key]) {
      clearTimeout(templateTimers.current[key]);
      delete templateTimers.current[key];
    }
    if (!currentValue?.trim()) {
      fieldSetters[key](null);
      saveTemplateField(key, null);
    } else {
      saveTemplateField(key, currentValue);
    }
    setEditingSection(null);
  };

  // --- Goals checkbox helpers ---

  const normalizeGoalsText = (text: string): string => {
    return text.split('\n').map(line => {
      if (!line.trim()) return line;
      if (/^- \[[ x]\] /.test(line)) return line;
      return `- [ ] ${line.replace(/^[-*]\s*/, '')}`;
    }).join('\n');
  };

  // Get/set goals for the active tab
  const getActiveGoals = (): string | null => {
    if (goalTab === 'daily') return goals;
    if (goalTab === 'weekly') return weeklyGoals;
    return monthlyGoals;
  };

  const setActiveGoals = (value: string | null) => {
    if (goalTab === 'daily') {
      setGoals(value);
      fieldStateRef.current.goals = value;
    } else if (goalTab === 'weekly') {
      setWeeklyGoals(value);
      weeklyGoalsRef.current = value;
    } else {
      setMonthlyGoals(value);
      monthlyGoalsRef.current = value;
    }
  };

  const saveActiveGoals = (value: string | null) => {
    if (goalTab === 'daily') {
      saveTemplateField('goals', value);
    } else if (goalTab === 'weekly') {
      savePeriodGoals(weekKey, 'weekly', value);
    } else {
      savePeriodGoals(monthKey, 'monthly', value);
    }
  };

  const handleGoalsChange = (value: string) => {
    const finalValue = value || null;
    setActiveGoals(finalValue);
    if (goalTab === 'daily') {
      if (templateTimers.current.goals) clearTimeout(templateTimers.current.goals);
      templateTimers.current.goals = setTimeout(() => saveTemplateField('goals', finalValue), 1500);
    } else {
      const timerKey = goalTab;
      if (periodTimers.current[timerKey]) clearTimeout(periodTimers.current[timerKey]);
      periodTimers.current[timerKey] = setTimeout(() => {
        if (goalTab === 'weekly') savePeriodGoals(weekKey, 'weekly', finalValue);
        else savePeriodGoals(monthKey, 'monthly', finalValue);
      }, 1500);
    }
  };

  const handleGoalsBlur = () => {
    const currentValue = getActiveGoals();
    // Clear the relevant timer
    if (goalTab === 'daily') {
      if (templateTimers.current.goals) {
        clearTimeout(templateTimers.current.goals);
        delete templateTimers.current.goals;
      }
    } else {
      if (periodTimers.current[goalTab]) {
        clearTimeout(periodTimers.current[goalTab]);
        delete periodTimers.current[goalTab];
      }
    }

    if (!currentValue?.trim()) {
      setActiveGoals(null);
      saveActiveGoals(null);
    } else {
      const normalized = normalizeGoalsText(currentValue);
      setActiveGoals(normalized);
      saveActiveGoals(normalized);
    }
    setEditingSection(null);
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

  const handleGoalPush = async (lineIndex: number) => {
    const value = goals || '';
    const lines = value.split('\n');
    const line = lines[lineIndex];
    if (!line?.trim()) return;

    const text = line.replace(/^- \[[ x]\] /, '');
    const nextDateCst = format(addDays(new Date(dateCst + 'T12:00:00'), 1), 'yyyy-MM-dd');

    try {
      const nextDay = await daySummaryService.get(nextDateCst);
      const nextGoals = nextDay.goals
        ? nextDay.goals + '\n' + `- [ ] ${text}`
        : `- [ ] ${text}`;
      await daySummaryService.save(nextDateCst, { goals: nextGoals });
    } catch {
      await daySummaryService.save(nextDateCst, { goals: `- [ ] ${text}` });
    }

    lines.splice(lineIndex, 1);
    const updated = lines.join('\n') || null;
    setGoals(updated);
    fieldStateRef.current.goals = updated;
    saveTemplateField('goals', updated);
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

  const handleDragStart = (id: string) => {
    dragItemRef.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

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

  // If no template content and no items, show the "Add summary" button
  if (!showTemplate) {
    return (
      <div className={styles.container}>
        <button className={styles.addSummaryBtn} onClick={() => setShowTemplate(true)}>
          + Add summary
        </button>
      </div>
    );
  }

  const renderGoalsContent = () => {
    const activeGoals = getActiveGoals();
    const isEditing = editingSection === 'goals';
    const placeholder = GOAL_TAB_PLACEHOLDERS[goalTab];

    if (isEditing) {
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
                <span className={styles.goalText} onClick={() => startEditingSection('goals')}>
                  <MarkdownLatex content={text} />
                </span>
                {goalTab === 'daily' && (
                  <button
                    className={styles.goalPushBtn}
                    onClick={() => handleGoalPush(i)}
                    title="Push to next day"
                  >
                    &#x21B7;
                  </button>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div
        className={styles.notePlaceholder}
        onClick={() => startEditingSection('goals')}
      >
        {placeholder}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Goals & Progress post-it notes */}
      <div className={styles.noteGrid}>
        {/* Goals note with tabs */}
        <div className={styles.note}>
          <div className={styles.noteLabel}>
            <span>Goals</span>
            <div className={styles.goalTabs}>
              {(['daily', 'weekly', 'monthly'] as GoalTab[]).map(tab => (
                <button
                  key={tab}
                  className={`${styles.goalTab} ${goalTab === tab ? styles.goalTabActive : ''}`}
                  onClick={() => { setGoalTab(tab); setEditingSection(null); }}
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

        {/* Progress note */}
        {SECTIONS.filter(s => s.key === 'progress').map(({ key, label, placeholder }) => {
          const value = fieldState[key];
          const isEditing = editingSection === key;

          return (
            <div key={key} className={styles.note}>
              <div className={styles.noteLabel}>{label}</div>
              <div className={styles.noteRuled}>
                {isEditing ? (
                  <textarea
                    className={styles.noteTextarea}
                    value={value || ''}
                    onChange={e => handleTemplateChange(key, e.target.value)}
                    onBlur={() => handleSectionBlur(key)}
                    placeholder={placeholder}
                    autoFocus
                  />
                ) : value ? (
                  <div
                    className={styles.noteContent}
                    onClick={() => startEditingSection(key)}
                  >
                    <MarkdownLatex content={value} />
                  </div>
                ) : (
                  <div
                    className={styles.notePlaceholder}
                    onClick={() => startEditingSection(key)}
                  >
                    {placeholder}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
