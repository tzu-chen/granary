import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db: DatabaseType = new Database(path.join(DATA_DIR, 'forge.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      entry_type TEXT NOT NULL DEFAULT 'note'
        CHECK (entry_type IN ('insight', 'definition', 'theorem', 'proof_sketch', 'example', 'counterexample', 'exercise', 'question', 'note')),
      source TEXT,
      links TEXT NOT NULL DEFAULT '[]',
      is_reviewable INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS day_summaries (
      date_cst TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_cards (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'prompt_response'
        CHECK (card_type IN ('prompt_response', 'cloze', 'state_theorem', 'proof_idea')),
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      stability REAL NOT NULL DEFAULT 0,
      difficulty REAL NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      last_review TEXT,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'new'
        CHECK (state IN ('new', 'learning', 'review', 'relearning')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS review_log (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
      stability_before REAL NOT NULL,
      stability_after REAL NOT NULL,
      difficulty_before REAL NOT NULL,
      difficulty_after REAL NOT NULL,
      elapsed_days REAL NOT NULL,
      review_duration_ms INTEGER,
      reviewed_at TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES review_cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS resolutions (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      resolution_entry_id TEXT NOT NULL,
      resolved_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
      FOREIGN KEY (resolution_entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_entries_entry_type ON entries(entry_type);
    CREATE INDEX IF NOT EXISTS idx_entries_is_reviewable ON entries(is_reviewable);
    CREATE INDEX IF NOT EXISTS idx_resolutions_entry_id ON resolutions(entry_id);
    CREATE INDEX IF NOT EXISTS idx_resolutions_resolution_entry_id ON resolutions(resolution_entry_id);
    CREATE INDEX IF NOT EXISTS idx_review_cards_entry_id ON review_cards(entry_id);
    CREATE INDEX IF NOT EXISTS idx_review_cards_due_date ON review_cards(due_date);
    CREATE INDEX IF NOT EXISTS idx_review_cards_state ON review_cards(state);
    CREATE INDEX IF NOT EXISTS idx_review_log_card_id ON review_log(card_id);
    CREATE INDEX IF NOT EXISTS idx_review_log_reviewed_at ON review_log(reviewed_at);
  `);

  // Migration: add status and priority columns to entries (for existing databases)
  try { db.exec("ALTER TABLE entries ADD COLUMN status TEXT DEFAULT NULL"); } catch (_) { /* column already exists */ }
  try { db.exec("ALTER TABLE entries ADD COLUMN priority TEXT DEFAULT NULL"); } catch (_) { /* column already exists */ }

  // Create indices on status/priority after the columns are guaranteed to exist
  db.exec("CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_entries_priority ON entries(priority)");

  // Insert default FSRS-5 parameters if not present
  const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get('fsrs_parameters');
  if (!existing) {
    const defaultParams = [
      0.4072, 1.1829, 3.1262, 15.4722, 7.2102,
      0.5316, 1.0651, 0.0589, 1.5330, 0.1544,
      1.0339, 1.9395, 0.1100, 0.2900, 2.2273,
      0.2328, 2.9898, 0.5100, 0.6468
    ];
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      'fsrs_parameters',
      JSON.stringify(defaultParams)
    );
  }
}

export default db;
