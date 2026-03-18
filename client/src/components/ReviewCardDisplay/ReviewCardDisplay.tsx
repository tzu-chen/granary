import { useState } from 'react';
import { DueCard, ReviewRating } from '../../types';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import styles from './ReviewCardDisplay.module.css';

interface Props {
  card: DueCard;
  onRate: (rating: ReviewRating) => void;
}

const RATINGS: { value: ReviewRating; label: string; color: string }[] = [
  { value: 'again', label: 'Again', color: 'var(--color-danger)' },
  { value: 'hard', label: 'Hard', color: 'var(--color-warning)' },
  { value: 'good', label: 'Good', color: 'var(--color-success)' },
  { value: 'easy', label: 'Easy', color: 'var(--color-info)' },
];

export default function ReviewCardDisplay({ card, onRate }: Props) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={styles.card}>
      <div className={styles.front}>
        <div className={styles.label}>Front</div>
        <MarkdownLatex content={card.front} />
      </div>

      {!revealed ? (
        <button className={styles.revealBtn} onClick={() => setRevealed(true)}>
          Show Answer
        </button>
      ) : (
        <>
          <div className={styles.back}>
            <div className={styles.label}>Back</div>
            <MarkdownLatex content={card.back} />
          </div>
          <div className={styles.ratings}>
            {RATINGS.map(r => (
              <button
                key={r.value}
                className={styles.ratingBtn}
                style={{ borderColor: r.color, color: r.color }}
                onClick={() => onRate(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
