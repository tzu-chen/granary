import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db: DatabaseType = new Database(path.join(DATA_DIR, 'granary.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      entry_type TEXT NOT NULL DEFAULT 'note'
        CHECK (entry_type IN ('note', 'question')),
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

    CREATE TABLE IF NOT EXISTS period_goals (
      period_key TEXT PRIMARY KEY,
      period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
      goals TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT,
      state TEXT NOT NULL DEFAULT 'planned'
        CHECK (state IN ('planned','in_progress','done','abandoned','blocked')),
      state_reason TEXT,
      created_on TEXT NOT NULL,
      completed_on TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_on ON tasks(created_on);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed_on ON tasks(completed_on);
    CREATE INDEX IF NOT EXISTS idx_tasks_state_position ON tasks(state, position);
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

  // Migration: collapse entry_type to {note, question}; old types become tags.
  // Detect outdated schemas by attempting to insert a legacy type — if accepted,
  // the CHECK constraint is the old one and we need to migrate.
  try {
    let needsCollapse = false;
    try {
      db.prepare(
        "INSERT INTO entries (id, content, tags, entry_type, links, created_at, updated_at) VALUES ('__test_collapse__', '', '[]', 'theorem', '[]', '', '')"
      ).run();
      db.prepare("DELETE FROM entries WHERE id = '__test_collapse__'").run();
      needsCollapse = true;
    } catch (_) {
      // 'theorem' rejected — schema is already on the new constraint
    }

    if (needsCollapse) {
      db.pragma('foreign_keys = OFF');
      const collapse = db.transaction(() => {
        const oldEntries = db.prepare(
          "SELECT id, entry_type, tags FROM entries WHERE entry_type NOT IN ('note', 'question')"
        ).all() as { id: string; entry_type: string; tags: string }[];
        const updateEntry = db.prepare("UPDATE entries SET tags = ?, entry_type = 'note' WHERE id = ?");
        for (const e of oldEntries) {
          let parsed: string[] = [];
          try { parsed = JSON.parse(e.tags); } catch { parsed = []; }
          if (!parsed.includes(e.entry_type)) parsed.unshift(e.entry_type);
          updateEntry.run(JSON.stringify(parsed), e.id);
        }
        db.exec(`
          CREATE TABLE entries_new (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            entry_type TEXT NOT NULL DEFAULT 'note'
              CHECK (entry_type IN ('note', 'question')),
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
      });
      collapse();
      db.pragma('foreign_keys = ON');
    }
  } catch (_) { /* table might not exist yet or other issue — safe to ignore */ }

  // One-time migration: import day_summaries.goals into the tasks table.
  // To rollback during dev: DELETE FROM tasks; DELETE FROM settings WHERE key LIKE 'tasks_migration_%';
  const migratedV1 = db.prepare('SELECT value FROM settings WHERE key = ?').get('tasks_migration_v1');
  if (!migratedV1) {
    runTasksMigrationV1();
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('tasks_migration_v1', 'done');
  }

  // v2 supersedes v1: daily goals were ephemeral, so unchecked items from older days
  // are no longer imported as `planned`. Only the most-recent day's [ ] items survive
  // as planned; [x]/[-] items always import as done/abandoned (record of finished work).
  // v2 wipes v1's output and reruns once.
  const migratedV2 = db.prepare('SELECT value FROM settings WHERE key = ?').get('tasks_migration_v2');
  if (!migratedV2) {
    runTasksMigrationV2();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('tasks_migration_v2', 'done');
  }

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

interface DaySummaryRow {
  date_cst: string;
  goals: string | null;
  updated_at: string | null;
}

interface ParsedTaskLine {
  title: string;
  state: 'planned' | 'done' | 'abandoned';
}

function parseGoalLine(line: string): ParsedTaskLine | null {
  // Strip leading whitespace
  let text = line.replace(/^\s+/, '');
  if (!text) return null;

  // Strip leading list bullet
  text = text.replace(/^(?:[-*+]\s+|\d+\.\s+)/, '');

  // Detect checkbox state (after bullet stripping or at the beginning)
  let state: ParsedTaskLine['state'] = 'planned';
  const checkboxMatch = text.match(/^\[([ xX\-~])\]\s*/);
  if (checkboxMatch) {
    const mark = checkboxMatch[1];
    if (mark === 'x' || mark === 'X') state = 'done';
    else if (mark === '-' || mark === '~') state = 'abandoned';
    text = text.slice(checkboxMatch[0].length);
  }

  text = text.trim();
  if (!text) return null;
  return { title: text, state };
}

function runTasksMigrationV1(): void {
  const rows = db.prepare(
    "SELECT date_cst, goals, updated_at FROM day_summaries WHERE goals IS NOT NULL AND goals != ''"
  ).all() as DaySummaryRow[];

  const insert = db.prepare(
    `INSERT INTO tasks (id, title, notes, state, state_reason, created_on, completed_on, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
  );

  let totalTasks = 0;
  let totalDays = 0;

  const migrate = db.transaction(() => {
    for (const row of rows) {
      if (!row.date_cst) continue;
      const lines = (row.goals ?? '').split('\n');
      let position = 0;
      let dayHadAny = false;
      for (const line of lines) {
        const parsed = parseGoalLine(line);
        if (!parsed) continue;
        // Truncate title to 200 chars; overflow goes into notes
        const title = parsed.title.length > 200 ? parsed.title.slice(0, 200) : parsed.title;
        const notes = parsed.title.length > 200 ? parsed.title : null;
        const isTerminal = parsed.state === 'done' || parsed.state === 'abandoned';
        const completedOn = isTerminal ? row.date_cst : null;
        const ts = row.updated_at || new Date().toISOString();
        insert.run(
          crypto.randomUUID(),
          title,
          notes,
          parsed.state,
          row.date_cst,
          completedOn,
          position,
          ts,
          ts
        );
        position++;
        totalTasks++;
        dayHadAny = true;
      }
      if (dayHadAny) totalDays++;
    }
  });

  migrate();
  console.log(`[tasks_migration_v1] migrated ${totalTasks} tasks across ${totalDays} days`);
}

function runTasksMigrationV2(): void {
  // Drop everything v1 imported. Daily goals were ephemeral, so we re-import
  // with rules that don't flood today's view with stale `planned` items.
  const wipe = db.prepare('DELETE FROM tasks').run();

  const recentRow = db.prepare(
    "SELECT MAX(date_cst) as date FROM day_summaries WHERE goals IS NOT NULL AND goals != ''"
  ).get() as { date: string | null };
  const mostRecentDate = recentRow.date;

  const rows = db.prepare(
    "SELECT date_cst, goals, updated_at FROM day_summaries WHERE goals IS NOT NULL AND goals != '' ORDER BY date_cst ASC"
  ).all() as DaySummaryRow[];

  const insert = db.prepare(
    `INSERT INTO tasks (id, title, notes, state, state_reason, created_on, completed_on, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  let droppedStale = 0;

  const migrate = db.transaction(() => {
    for (const row of rows) {
      if (!row.date_cst) continue;
      const isMostRecent = row.date_cst === mostRecentDate;
      const lines = (row.goals ?? '').split('\n');
      let position = 0;
      for (const line of lines) {
        const parsed = parseGoalLine(line);
        if (!parsed) continue;

        // Skip unchecked goals from any day older than the most recent — those are
        // historical daily intent, not persistent backlog.
        if (parsed.state === 'planned' && !isMostRecent) {
          droppedStale++;
          continue;
        }

        const title = parsed.title.length > 200 ? parsed.title.slice(0, 200) : parsed.title;
        const notes = parsed.title.length > 200 ? parsed.title : null;
        const isTerminal = parsed.state === 'done' || parsed.state === 'abandoned';
        const completedOn = isTerminal ? row.date_cst : null;
        const ts = row.updated_at || new Date().toISOString();
        insert.run(
          crypto.randomUUID(),
          title,
          notes,
          parsed.state,
          row.date_cst,
          completedOn,
          position,
          ts,
          ts
        );
        position++;
        imported++;
      }
    }
  });

  migrate();
  console.log(`[tasks_migration_v2] wiped ${wipe.changes} prior rows; imported ${imported}; dropped ${droppedStale} ephemeral planned items`);
}

export default db;
