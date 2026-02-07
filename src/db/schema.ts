import type Database from 'better-sqlite3';
import { createLogger } from '../shared/logger.js';

const log = createLogger('schema');

const SCHEMA_VERSION = 4;

const SCHEMA_SQL = `
-- Project detection
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL UNIQUE,
  name TEXT,
  detected_stack TEXT DEFAULT '[]',
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  session_count INTEGER DEFAULT 0,
  observation_count INTEGER DEFAULT 0
);

-- Sessions
-- NOTE: prior_claude_session_ids stores a comma-separated list of previous
-- Claude CLI session IDs. This is needed because resumed sessions get new IDs
-- (known Claude SDK bug), so we track all IDs to match sessions across resumes.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  claude_session_id TEXT,
  prior_claude_session_ids TEXT,
  project_id TEXT REFERENCES projects(id),
  summary TEXT,
  key_actions TEXT DEFAULT '[]',
  files_modified TEXT DEFAULT '[]',
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  is_resumable INTEGER DEFAULT 1,
  observation_count INTEGER DEFAULT 0
);

-- Recovery journal
CREATE TABLE IF NOT EXISTS recovery_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','committed','failed')),
  created_at INTEGER NOT NULL,
  committed_at INTEGER
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  topic TEXT,
  summary TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','stashed','completed')),
  stash_group_id TEXT,
  project_path TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  resumed_at INTEGER,
  stashed_at INTEGER,
  observation_count INTEGER DEFAULT 0
);

-- Stash groups
CREATE TABLE IF NOT EXISTS stash_groups (
  id TEXT PRIMARY KEY,
  label TEXT,
  project_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Observations
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  conversation_id TEXT REFERENCES conversations(id),
  tool_name TEXT NOT NULL,
  tool_input_summary TEXT,
  tool_output_summary TEXT,
  project_path TEXT NOT NULL,
  files_involved TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  timestamp INTEGER NOT NULL
);

-- Knowledge
CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('fact','decision','preference','pattern','issue','context','discovery')),
  content TEXT NOT NULL,
  source_observation_ids TEXT DEFAULT '[]',
  source_knowledge_ids TEXT DEFAULT '[]',
  conversation_id TEXT REFERENCES conversations(id),
  project_path TEXT,
  tags TEXT DEFAULT '[]',
  confidence REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Knowledge graph edges
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK(relationship IN ('derives_from','leads_to','supports','contradicts','refines','supersedes')),
  strength REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL
);

-- Embeddings metadata
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK(source_type IN ('observation','knowledge','session')),
  source_id TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Embedding queue
CREATE TABLE IF NOT EXISTS embedding_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  text_content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','done','error')),
  error_message TEXT,
  created_at INTEGER NOT NULL,
  processed_at INTEGER
);

-- Adaptive topic-shift thresholds (per project)
CREATE TABLE IF NOT EXISTS adaptive_thresholds (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),
  ask_threshold REAL DEFAULT 0.4,
  trust_threshold REAL DEFAULT 0.85,
  auto_stash_count INTEGER DEFAULT 0,
  false_positive_count INTEGER DEFAULT 0,
  suggestion_shown_count INTEGER DEFAULT 0,
  suggestion_accepted_count INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- Session forks / checkpoints
CREATE TABLE IF NOT EXISTS session_forks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  label TEXT,
  snapshot TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`;

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_path);
CREATE INDEX IF NOT EXISTS idx_conversations_time ON conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_observations_conversation ON observations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(session_id);
CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project_path);
CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_observations_tool ON observations(tool_name);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge(project_path);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_from ON knowledge_edges(from_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_to ON knowledge_edges(to_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_rel ON knowledge_edges(relationship);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_time ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
CREATE INDEX IF NOT EXISTS idx_session_forks_session ON session_forks(session_id);
CREATE INDEX IF NOT EXISTS idx_session_forks_time ON session_forks(created_at DESC);
`;

const FTS_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
  tool_input_summary,
  tool_output_summary,
  tags,
  content=observations,
  content_rowid=rowid,
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  content,
  tags,
  content=knowledge,
  content_rowid=rowid,
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
  summary,
  key_actions,
  content=sessions,
  content_rowid=rowid,
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
  topic,
  summary,
  content=conversations,
  content_rowid=rowid,
  tokenize='porter unicode61'
);
`;

// FTS5 triggers to keep the index in sync
const FTS_TRIGGERS_SQL = `
-- Observations FTS triggers
CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
  INSERT INTO observations_fts(rowid, tool_input_summary, tool_output_summary, tags)
  VALUES (NEW.rowid, NEW.tool_input_summary, NEW.tool_output_summary, NEW.tags);
END;
CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, tool_input_summary, tool_output_summary, tags)
  VALUES ('delete', OLD.rowid, OLD.tool_input_summary, OLD.tool_output_summary, OLD.tags);
END;
CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, tool_input_summary, tool_output_summary, tags)
  VALUES ('delete', OLD.rowid, OLD.tool_input_summary, OLD.tool_output_summary, OLD.tags);
  INSERT INTO observations_fts(rowid, tool_input_summary, tool_output_summary, tags)
  VALUES (NEW.rowid, NEW.tool_input_summary, NEW.tool_output_summary, NEW.tags);
END;

-- Knowledge FTS triggers
CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge BEGIN
  INSERT INTO knowledge_fts(rowid, content, tags)
  VALUES (NEW.rowid, NEW.content, NEW.tags);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, content, tags)
  VALUES ('delete', OLD.rowid, OLD.content, OLD.tags);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, content, tags)
  VALUES ('delete', OLD.rowid, OLD.content, OLD.tags);
  INSERT INTO knowledge_fts(rowid, content, tags)
  VALUES (NEW.rowid, NEW.content, NEW.tags);
END;

-- Sessions FTS triggers
CREATE TRIGGER IF NOT EXISTS sessions_ai AFTER INSERT ON sessions BEGIN
  INSERT INTO sessions_fts(rowid, summary, key_actions)
  VALUES (NEW.rowid, NEW.summary, NEW.key_actions);
END;
CREATE TRIGGER IF NOT EXISTS sessions_ad AFTER DELETE ON sessions BEGIN
  INSERT INTO sessions_fts(sessions_fts, rowid, summary, key_actions)
  VALUES ('delete', OLD.rowid, OLD.summary, OLD.key_actions);
END;
CREATE TRIGGER IF NOT EXISTS sessions_au AFTER UPDATE ON sessions BEGIN
  INSERT INTO sessions_fts(sessions_fts, rowid, summary, key_actions)
  VALUES ('delete', OLD.rowid, OLD.summary, OLD.key_actions);
  INSERT INTO sessions_fts(rowid, summary, key_actions)
  VALUES (NEW.rowid, NEW.summary, NEW.key_actions);
END;

-- Conversations FTS triggers
CREATE TRIGGER IF NOT EXISTS conversations_ai AFTER INSERT ON conversations BEGIN
  INSERT INTO conversations_fts(rowid, topic, summary)
  VALUES (NEW.rowid, NEW.topic, NEW.summary);
END;
CREATE TRIGGER IF NOT EXISTS conversations_ad AFTER DELETE ON conversations BEGIN
  INSERT INTO conversations_fts(conversations_fts, rowid, topic, summary)
  VALUES ('delete', OLD.rowid, OLD.topic, OLD.summary);
END;
CREATE TRIGGER IF NOT EXISTS conversations_au AFTER UPDATE ON conversations BEGIN
  INSERT INTO conversations_fts(conversations_fts, rowid, topic, summary)
  VALUES ('delete', OLD.rowid, OLD.topic, OLD.summary);
  INSERT INTO conversations_fts(rowid, topic, summary)
  VALUES (NEW.rowid, NEW.topic, NEW.summary);
END;
`;

export function initializeSchema(db: Database.Database): void {
  log.info('Initializing database schema');

  // Check current version
  try {
    const row = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
    if (row && row.version >= SCHEMA_VERSION) {
      log.info('Schema is up to date', { version: row.version });
      return;
    }
  } catch {
    // Table doesn't exist yet, proceed with init
  }

  db.exec(SCHEMA_SQL);
  db.exec(INDEXES_SQL);
  db.exec(FTS_SQL);
  db.exec(FTS_TRIGGERS_SQL);

  // Run migrations for existing databases
  runMigrations(db);

  // Record schema version
  db.prepare('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)').run(
    SCHEMA_VERSION,
    Date.now()
  );

  log.info('Schema initialized', { version: SCHEMA_VERSION });
}

function runMigrations(db: Database.Database): void {
  // v1 → v2: Add prior_claude_session_ids to sessions
  // (Resumed Claude sessions get new IDs — we need to track the old ones too)
  try {
    const cols = db.prepare("PRAGMA table_info('sessions')").all() as Array<{ name: string }>;
    const hasColumn = cols.some(c => c.name === 'prior_claude_session_ids');
    if (!hasColumn) {
      db.exec('ALTER TABLE sessions ADD COLUMN prior_claude_session_ids TEXT');
      log.info('Migration v2: added prior_claude_session_ids to sessions');
    }
  } catch (err) {
    log.warn('Migration v2 check failed (may be fresh DB)', err);
  }

  // v2 → v3: Add session_forks table for checkpoints
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_forks'").all();
    if (tables.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS session_forks (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id),
          label TEXT,
          snapshot TEXT DEFAULT '{}',
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_session_forks_session ON session_forks(session_id);
        CREATE INDEX IF NOT EXISTS idx_session_forks_time ON session_forks(created_at DESC);
      `);
      log.info('Migration v3: added session_forks table');
    }
  } catch (err) {
    log.warn('Migration v3 check failed (may be fresh DB)', err);
  }

  // v3 → v4: Add knowledge graph (knowledge_edges table, source_knowledge_ids column, discovery type)
  try {
    const knCols = db.prepare("PRAGMA table_info('knowledge')").all() as Array<{ name: string }>;
    const hasSourceKnIds = knCols.some(c => c.name === 'source_knowledge_ids');
    if (!hasSourceKnIds) {
      db.exec("ALTER TABLE knowledge ADD COLUMN source_knowledge_ids TEXT DEFAULT '[]'");
      log.info('Migration v4: added source_knowledge_ids to knowledge');
    }
  } catch (err) {
    log.warn('Migration v4 column check failed (may be fresh DB)', err);
  }

  try {
    const edgeTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_edges'").all();
    if (edgeTables.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_edges (
          id TEXT PRIMARY KEY,
          from_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
          to_id TEXT NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
          relationship TEXT NOT NULL CHECK(relationship IN ('derives_from','leads_to','supports','contradicts','refines','supersedes')),
          strength REAL DEFAULT 1.0,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_knowledge_edges_from ON knowledge_edges(from_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_edges_to ON knowledge_edges(to_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_edges_rel ON knowledge_edges(relationship);
      `);
      log.info('Migration v4: added knowledge_edges table');
    }
  } catch (err) {
    log.warn('Migration v4 edges table check failed (may be fresh DB)', err);
  }
}

export function initializeVectorTable(db: Database.Database): boolean {
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        id TEXT PRIMARY KEY,
        embedding float[384]
      );
    `);
    log.info('Vector table initialized');
    return true;
  } catch (err) {
    log.warn('Could not create vector table (sqlite-vec may not be available)', err);
    return false;
  }
}
