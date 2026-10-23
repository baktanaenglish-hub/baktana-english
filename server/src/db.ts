import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

/** Ordered schema migrations; the index + 1 is stored in PRAGMA user_version. */
const migrations: string[] = [
  `CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE progress (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE xp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    xp INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX xp_events_created_at ON xp_events(created_at);`,
  // #2 – spaced-repetition state (docs/spec/v2.md §6.5).
  `CREATE TABLE srs_state (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    box INTEGER NOT NULL,
    due TEXT NOT NULL,
    seen INTEGER NOT NULL,
    wrong INTEGER NOT NULL,
    last INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_key)
  );`,
  // #3 – anonymous analytics events (docs/spec/v2.md §6.5, §8).
  `CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anon_id TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    lesson_id TEXT,
    item_key TEXT,
    ex_type TEXT,
    correct INTEGER,
    first_try INTEGER,
    duration_ms INTEGER,
    props TEXT NOT NULL DEFAULT '{}',
    client_ts INTEGER NOT NULL,
    local_date TEXT NOT NULL,
    local_hour INTEGER NOT NULL,
    app_version TEXT,
    platform TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX events_created_at ON events(created_at);
  CREATE INDEX events_anon ON events(anon_id);`,
  // #4 – AI video-call usage per learner and local day (shared/call.ts CALL_LIMITS.callsPerDay/turnsPerDay).
  `CREATE TABLE call_usage (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    calls INTEGER NOT NULL DEFAULT 0,
    turns INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );`,
  // #5 – groups, group challenges and period leaderboards (shared/groups.ts). `lesson` marks XP from a
  // finished lesson (for the lessons challenge); XP that arrived with a progress sync keeps 0.
  `CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (group_id, user_id)
  );
  CREATE INDEX group_members_user ON group_members(user_id);
  ALTER TABLE xp_events ADD COLUMN lesson INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX xp_events_user_created ON xp_events(user_id, created_at);`,
  // #6 – the learner's pet as their groups see it (shared/pet-design.ts PetBadge, JSON), or NULL.
  `ALTER TABLE users ADD COLUMN pet TEXT;`,
  // #7 – head-to-head duels between two friends (shared/duels.ts). `opponent_id` and `starts_at` stay NULL
  // until a friend accepts the invite.
  `CREATE TABLE duels (
    id TEXT PRIMARY KEY,
    invite_code TEXT NOT NULL UNIQUE,
    challenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    starts_at INTEGER
  );
  CREATE INDEX duels_challenger ON duels(challenger_id);
  CREATE INDEX duels_opponent ON duels(opponent_id);`,
];

export function migrate(db: Db): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = row.user_version; v < migrations.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(migrations[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

/** Opens (creating if needed) the SQLite database and applies migrations. */
export function openDb(path = process.env.DATABASE_PATH || './data/baktana.db'): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}
