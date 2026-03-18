import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { EntryWithResolution, ReviewCard } from '../../types';
import { entryService, reviewService } from '../../services/api';
import MarkdownLatex from '../../components/MarkdownLatex/MarkdownLatex';
import PriorityBadge from '../../components/PriorityBadge/PriorityBadge';
import ResolveForm from '../../components/ResolveForm/ResolveForm';
import { ENTRY_TYPES } from '../../types';
import styles from './EntryDetailPage.module.css';

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<EntryWithResolution | null>(null);
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolveForm, setShowResolveForm] = useState(false);

  const loadEntry = useCallback(async () => {
    if (!id) return;
    try {
      const [e, c] = await Promise.all([
        entryService.getWithResolution(id),
        reviewService.listCards({ entry_id: id }),
      ]);
      setEntry(e);
      setCards(c);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  const handleResolve = async (data: { content: string; tags?: string[]; entry_type?: string; source?: string }) => {
    if (!id) return;
    try {
      await entryService.resolve(id, data);
      setShowResolveForm(false);
      loadEntry();
    } catch (err) {
      console.error('Failed to resolve:', err);
    }
  };

  const handleReopen = async () => {
    if (!id) return;
    try {
      await entryService.reopen(id);
      loadEntry();
    } catch (err) {
      console.error('Failed to reopen:', err);
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!entry) return <div className={styles.loading}>Entry not found</div>;

  const typeLabel = ENTRY_TYPES.find(t => t.value === entry.entry_type)?.label || entry.entry_type;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.badge}>{typeLabel}</span>
        {entry.status === 'open' && entry.priority && (
          <PriorityBadge priority={entry.priority} />
        )}
        {entry.status === 'resolved' && (
          <span className={styles.resolvedBadge}>Resolved</span>
        )}
        <span className={styles.date}>{new Date(entry.created_at).toLocaleString()}</span>
        <Link to={`/entries/${entry.id}/edit`} className={styles.editLink}>Edit</Link>
      </div>

      <div className={styles.content}>
        <MarkdownLatex content={entry.content} />
      </div>

      {(entry.tags.length > 0 || entry.source) && (
        <div className={styles.meta}>
          {entry.tags.map(tag => (
            <span key={tag} className={styles.tag}>{tag}</span>
          ))}
          {entry.source && <span className={styles.source}>{entry.source}</span>}
        </div>
      )}

      {/* Status actions */}
      {entry.status === 'open' && (
        <div className={styles.statusActions}>
          <button className={styles.resolveBtn} onClick={() => setShowResolveForm(!showResolveForm)}>
            {showResolveForm ? 'Cancel' : 'Resolve'}
          </button>
        </div>
      )}

      {entry.status === 'resolved' && (
        <div className={styles.statusActions}>
          <button className={styles.reopenBtn} onClick={handleReopen}>Reopen</button>
        </div>
      )}

      {showResolveForm && (
        <ResolveForm
          entry={entry}
          onSubmit={handleResolve}
          onCancel={() => setShowResolveForm(false)}
        />
      )}

      {/* Resolution display */}
      {entry.resolution && (
        <div className={styles.resolutionSection}>
          <div className={styles.resolutionLabel}>Resolution</div>
          <div className={styles.resolutionContent}>
            <MarkdownLatex content={entry.resolution.resolution_content} />
          </div>
          <div className={styles.resolutionMeta}>
            Resolved {new Date(entry.resolution.resolved_at).toLocaleDateString()}
            {' · '}
            <Link to={`/entries/${entry.resolution.resolution_entry_id}`}>View resolution entry</Link>
          </div>
        </div>
      )}

      {/* Resolution-of link */}
      {entry.resolution_of && (
        <div className={styles.resolutionOfNote}>
          This entry resolves: <Link to={`/entries/${entry.resolution_of.resolved_entry_id}`}>View original entry</Link>
        </div>
      )}

      {cards.length > 0 && (
        <div className={styles.cardsSection}>
          <h3>Review Cards ({cards.length})</h3>
          {cards.map(card => (
            <div key={card.id} className={styles.cardItem}>
              <div className={styles.cardHeader}>
                <span className={styles.cardType}>{card.card_type}</span>
                <span className={styles.cardState}>{card.state}</span>
                <span className={styles.cardDue}>Due: {card.due_date}</span>
                <span className={styles.cardReps}>{card.reps} reviews, {card.lapses} lapses</span>
              </div>
              <div className={styles.cardFront}>
                <strong>Front:</strong>
                <MarkdownLatex content={card.front} />
              </div>
              <div className={styles.cardBack}>
                <strong>Back:</strong>
                <MarkdownLatex content={card.back} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.backLink}>
        <Link to="/">&larr; Back to Log</Link>
      </div>
    </div>
  );
}
