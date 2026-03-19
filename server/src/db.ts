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
        CHECK (entry_type IN ('insight', 'definition', 'theorem', 'proof_sketch', 'example', 'counterexample', 'exercise', 'question', 'note', 'reference')),
      source TEXT,
      links TEXT NOT NULL DEFAULT '[]',
      is_reviewable INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS day_summaries (
      date_cst TEXT PRIMARY KEY,
      goals TEXT,
      progress TEXT,
      open_questions TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS summary_items (
      id TEXT PRIMARY KEY,
      date_cst TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      tag TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_summary_items_date_cst ON summary_items(date_cst);
    CREATE INDEX IF NOT EXISTS idx_summary_items_date_position ON summary_items(date_cst, position);
  `);

  // Migration: day_summaries — migrate from old single-content schema to structured template
  try {
    const hasGoals = db.prepare("SELECT goals FROM day_summaries LIMIT 0").columns();
    // If goals column exists, schema is already migrated — do nothing
    void hasGoals;
  } catch (_) {
    // goals column doesn't exist — old schema with 'content' column
    try {
      db.exec("ALTER TABLE day_summaries ADD COLUMN goals TEXT");
      db.exec("ALTER TABLE day_summaries ADD COLUMN progress TEXT");
      db.exec("ALTER TABLE day_summaries ADD COLUMN open_questions TEXT");
      // Migrate existing content into goals
      db.exec("UPDATE day_summaries SET goals = content");
    } catch (_) { /* columns may already exist */ }
  }

  // Migration: remove old 'content' column from day_summaries (it was NOT NULL,
  // which breaks INSERTs that only specify goals/progress/open_questions)
  try {
    db.prepare("SELECT content FROM day_summaries LIMIT 0").columns();
    // content column still exists — recreate table without it
    db.exec(`
      CREATE TABLE day_summaries_new (
        date_cst TEXT PRIMARY KEY,
        goals TEXT,
        progress TEXT,
        open_questions TEXT,
        updated_at TEXT NOT NULL
      );
      INSERT INTO day_summaries_new (date_cst, goals, progress, open_questions, updated_at)
        SELECT date_cst, goals, progress, open_questions, updated_at FROM day_summaries;
      DROP TABLE day_summaries;
      ALTER TABLE day_summaries_new RENAME TO day_summaries;
    `);
  } catch (_) { /* content column doesn't exist — already clean */ }

  // Migration: add status and priority columns to entries (for existing databases)
  try { db.exec("ALTER TABLE entries ADD COLUMN status TEXT DEFAULT NULL"); } catch (_) { /* column already exists */ }
  try { db.exec("ALTER TABLE entries ADD COLUMN priority TEXT DEFAULT NULL"); } catch (_) { /* column already exists */ }

  // Create indices on status/priority after the columns are guaranteed to exist
  db.exec("CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_entries_priority ON entries(priority)");

  // Migration: add 'reference' to entry_type CHECK constraint
  // SQLite doesn't support ALTER CHECK, so recreate the table if the constraint is outdated
  try {
    // Test if 'reference' is allowed by attempting a dummy insert + rollback
    const testStmt = db.prepare("INSERT INTO entries (id, content, tags, entry_type, links, created_at, updated_at) VALUES ('__test_ref__', '', '[]', 'reference', '[]', '', '')");
    try {
      testStmt.run();
      // If it succeeded, delete the test row — constraint already allows 'reference'
      db.prepare("DELETE FROM entries WHERE id = '__test_ref__'").run();
    } catch (_) {
      // CHECK constraint rejected 'reference' — need to recreate table
      // Temporarily disable foreign keys so DROP TABLE doesn't fail
      db.pragma('foreign_keys = OFF');
      db.exec(`
        CREATE TABLE entries_new (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          tags TEXT NOT NULL DEFAULT '[]',
          entry_type TEXT NOT NULL DEFAULT 'note'
            CHECK (entry_type IN ('insight', 'definition', 'theorem', 'proof_sketch', 'example', 'counterexample', 'exercise', 'question', 'note', 'reference')),
          source TEXT,
          links TEXT NOT NULL DEFAULT '[]',
          is_reviewable INTEGER NOT NULL DEFAULT 0,
          status TEXT DEFAULT NULL,
          priority TEXT DEFAULT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO entries_new SELECT id, content, tags, entry_type, source, links, is_reviewable, status, priority, created_at, updated_at FROM entries;
        DROP TABLE entries;
        ALTER TABLE entries_new RENAME TO entries;

        CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at);
        CREATE INDEX IF NOT EXISTS idx_entries_entry_type ON entries(entry_type);
        CREATE INDEX IF NOT EXISTS idx_entries_is_reviewable ON entries(is_reviewable);
        CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
        CREATE INDEX IF NOT EXISTS idx_entries_priority ON entries(priority);
      `);
      db.pragma('foreign_keys = ON');
    }
  } catch (_) { /* table might not exist yet or other issue — safe to ignore */ }

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
