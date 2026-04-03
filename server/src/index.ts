import express from 'express';
import cors from 'cors';
import path from 'path';
import { initializeDatabase } from './db';
import entriesRouter from './routes/entries';
import daySummariesRouter from './routes/daySummaries';
import reviewRouter from './routes/review';
import statsRouter from './routes/stats';
import tagsRouter from './routes/tags';
import settingsRouter from './routes/settings';
import openRouter from './routes/open';
import healthRouter from './routes/health';
import scribeRouter from './routes/scribe';
import sourcesRouter from './routes/sources';
import periodGoalsRouter from './routes/periodGoals';

const app = express();
const PORT = process.env.PORT || 3009;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/entries', entriesRouter);
app.use('/api/day-summaries', daySummariesRouter);
app.use('/api/review', reviewRouter);
app.use('/api/stats', statsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/open', openRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/health', healthRouter);
app.use('/api/scribe/books', scribeRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/period-goals', periodGoalsRouter);

// Serve static frontend in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

initializeDatabase();

app.listen(PORT, () => {
  console.log(`Granary server running on port ${PORT}`);
});
