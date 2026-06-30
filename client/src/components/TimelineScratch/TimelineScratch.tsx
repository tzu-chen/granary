import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './TimelineScratch.module.css';

interface Props {
  text: string;
  dateCst: string;
}

// Read-only auto-scrolling strip showing a day's scratch text on the timeline.
// Reuses the marquee technique from DayScratch: measure the text against the
// container and, when it overflows, scroll a duplicated copy for a seamless loop.
// Clicking opens that day in the Log, where the scratch can actually be edited.
export default function TimelineScratch({ text, dateCst }: Props) {
  const [overflowing, setOverflowing] = useState(false);
  const [duration, setDuration] = useState(20);
  const bodyRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const measure = () => {
      const body = bodyRef.current;
      const meas = measureRef.current;
      if (!body || !meas) return;
      const contentWidth = meas.scrollWidth;
      const over = contentWidth > body.clientWidth + 4;
      setOverflowing(over);
      if (over) setDuration(Math.max(8, contentWidth / 45));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text]);

  return (
    <Link to={`/?date=${dateCst}`} className={styles.strip} title="Open this day in the log">
      <span className={styles.icon} aria-hidden="true">✎</span>
      <div className={styles.body} ref={bodyRef}>
        {overflowing ? (
          <div className={styles.marquee} style={{ animationDuration: `${duration}s` }}>
            <span className={styles.marqueeContent}>{text}</span>
            <span className={styles.marqueeContent} aria-hidden="true">{text}</span>
          </div>
        ) : (
          <span className={styles.text}>{text}</span>
        )}
        <span className={styles.measure} ref={measureRef} aria-hidden="true">{text}</span>
      </div>
    </Link>
  );
}
