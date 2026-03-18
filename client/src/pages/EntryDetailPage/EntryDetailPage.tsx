import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Entry, ReviewCard } from '../../types';
import { entryService, reviewService } from '../../services/api';
import MarkdownLatex from '../../components/MarkdownLatex/MarkdownLatex';
import { ENTRY_TYPES } from '../../types';
import styles from './EntryDetailPage.module.css';

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      entryService.get(id),
      reviewService.listCards({ entry_id: id }),
    ])
      .then(([e, c]) => {
        setEntry(e);
        setCards(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!entry) return <div className={styles.loading}>Entry not found</div>;

  const typeLabel = ENTRY_TYPES.find(t => t.value === entry.entry_type)?.label || entry.entry_type;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.badge}>{typeLabel}</span>
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
