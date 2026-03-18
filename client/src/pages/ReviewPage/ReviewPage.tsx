import { useState, useEffect, useRef } from 'react';
import { DueCard, ReviewRating } from '../../types';
import { reviewService } from '../../services/api';
import ReviewCardDisplay from '../../components/ReviewCardDisplay/ReviewCardDisplay';
import styles from './ReviewPage.module.css';

export default function ReviewPage() {
  const [cards, setCards] = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionDone, setSessionDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [ratings, setRatings] = useState<ReviewRating[]>([]);
  const startTime = useRef(Date.now());

  useEffect(() => {
    reviewService.getDue()
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRate = async (rating: ReviewRating) => {
    const card = cards[currentIndex];
    const durationMs = Date.now() - startTime.current;
    await reviewService.rate(card.id, rating, durationMs);

    setRatings(prev => [...prev, rating]);
    setReviewed(prev => prev + 1);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(prev => prev + 1);
      startTime.current = Date.now();
    } else {
      setSessionDone(true);
    }
  };

  if (loading) return <div className={styles.center}>Loading...</div>;

  if (cards.length === 0) {
    return (
      <div className={styles.center}>
        <div className={styles.empty}>
          <h2>No cards due</h2>
          <p>All caught up! Check back later.</p>
        </div>
      </div>
    );
  }

  if (sessionDone) {
    const goodCount = ratings.filter(r => r === 'good' || r === 'easy').length;
    const accuracy = Math.round((goodCount / ratings.length) * 100);

    return (
      <div className={styles.center}>
        <div className={styles.summary}>
          <h2>Session Complete</h2>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{reviewed}</span>
              <span className={styles.statLabel}>Cards Reviewed</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{accuracy}%</span>
              <span className={styles.statLabel}>Accuracy</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.progress}>
        Card {currentIndex + 1} of {cards.length}
      </div>
      <ReviewCardDisplay card={cards[currentIndex]} onRate={handleRate} />
    </div>
  );
}
