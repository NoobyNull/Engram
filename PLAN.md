# Claude Scholar - Implementation Plan

## Context

Claude-mem exploded to #1 on GitHub (1,739 stars in 24 hours) proving massive demand for persistent memory in Claude Code. But it has critical bugs: repo corruption, worker blocking, dependency hell (Bun + Python + Chroma), and 144 open issues. Claude Scholar will be a simpler, more reliable, and more powerful alternative built as a proper Claude Code plugin with MCP tools, using only Node.js and SQLite (with sqlite-vec for vector search).

## Architecture Overview

**Plugin + MCP hybrid**: Lifecycle hooks auto-capture observations. MCP server provides search/retrieval tools. SQLite with FTS5 for keyword search + sqlite-vec for semantic vector search (embeddings via Anthropic API / Claude Haiku). Full-featured web UI for browsing.

```
Claude Code CLI
    │
    ├── Hooks (async, non-blocking)
    │   ├── SessionStart → inject relevant past context (grouped by conversation)
    │   ├── UserPromptSubmit → topic shift detection → stash/resume
    │   ├── PostToolUse  → record observation + queue embedding (async)
    │   ├── PreCompact   → save context snapshot
    │   └── SessionEnd   → close conversation + generate summaries + batch embeddings
    │
    ├── Claude SDK Integration
    │   ├── Session rename: <topic> - <scholar-db-id>
    │   ├── Session resume via native claude --resume
    │   └── Resumability tracking
    │
    ├── MCP Server (stdio transport, single process)
    │   ├── memory_search   → hybrid FTS5 + vector search
    │   ├── memory_save     → explicit knowledge storage + embedding
    │   ├── memory_timeline → chronological context
    │   ├── memory_get      → fetch by ID
    │   ├── memory_forget   → privacy deletion
    │   ├── memory_stash    → list stashed sidebar conversations
    │   ├── memory_resume   → resume a stashed sidebar (native or summary)
    │   └── memory_stats    → usage analytics
    │
    ├── Conversation Grouping + Sidebar Stash
    │   ├── Haiku-powered topic shift detection
    │   ├── Heuristic shortcuts (same file = same topic)
    │   ├── Sidebar stash with vector-similarity clustering
    │   ├── Auto-resume when new topic matches existing stash
    │   └── Per-conversation summaries
    │
    ├── Embedding Pipeline (async, non-blocking)
    │   ├── Queue-based batch processing
    │   ├── Anthropic API (Haiku) for text → embedding
    │   └── sqlite-vec for storage & similarity search
    │
    ├── Project Detection
    │   ├── Root path detection from CWD (.git, package.json, etc.)
    │   └── Tech stack auto-detection
    │
    ├── Recovery System
    │   ├── SQLite WAL mode for crash resilience
    │   ├── Write-ahead recovery journal
    │   └── Startup replay of uncommitted operations
    │
    └── Web UI (built-in HTTP server, port 37820)
        ├── Dashboard with stats
        ├── Search with filters (keyword + semantic)
        ├── Session timeline with conversation grouping
        ├── Knowledge browser
        └── Stash manager (resume/dismiss sidebars)
```

---

## Directory Structure

```
/data/Claude_Scholar/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── .mcp.json                    # MCP server configuration
├── hooks/
│   ├── hooks.json               # Hook definitions
│   └── scripts/
│       ├── session-start.ts     # SessionStart hook
│       ├── user-prompt.ts       # UserPromptSubmit hook (topic shift detection)
│       ├── post-tool-use.ts     # PostToolUse hook (async)
│       ├── pre-compact.ts       # PreCompact hook
│       └── session-end.ts       # SessionEnd hook
├── src/
│   ├── mcp/
│   │   ├── server.ts            # MCP server entry point
│   │   ├── tools/
│   │   │   ├── search.ts        # memory_search tool
│   │   │   ├── save.ts          # memory_save tool
│   │   │   ├── timeline.ts      # memory_timeline tool
│   │   │   ├── get.ts           # memory_get tool
│   │   │   ├── forget.ts        # memory_forget tool
│   │   │   ├── stash.ts         # memory_stash tool (list sidebars)
│   │   │   ├── resume.ts        # memory_resume tool (resume sidebar)
│   │   │   └── stats.ts         # memory_stats tool
│   │   └── index.ts             # Tool registry
│   ├── db/
│   │   ├── database.ts          # SQLite connection & init (+ sqlite-vec, WAL mode)
│   │   ├── schema.ts            # Schema definitions & migrations
│   │   ├── recovery.ts          # Recovery journal & crash resilience
│   │   ├── projects.ts          # Project CRUD & detection
│   │   ├── observations.ts      # Observation CRUD
│   │   ├── knowledge.ts         # Knowledge CRUD
│   │   ├── sessions.ts          # Session CRUD (with claude_session_id tracking)
│   │   ├── conversations.ts     # Conversation CRUD (with stash support)
│   │   ├── search.ts            # Hybrid FTS5 + vector search
│   │   └── vectors.ts           # sqlite-vec operations
│   ├── web/
│   │   ├── server.ts            # HTTP server (built-in node:http)
│   │   ├── routes.ts            # API routes
│   │   └── public/              # Static frontend assets
│   │       ├── index.html       # SPA entry point
│   │       ├── app.js           # Frontend JS (vanilla + lit-html)
│   │       ├── style.css        # Styles
│   │       └── components/      # Web components
│   │           ├── search-view.js
│   │           ├── timeline-view.js
│   │           ├── dashboard-view.js
│   │           └── knowledge-view.js
│   ├── shared/
│   │   ├── types.ts             # Shared TypeScript interfaces
│   │   ├── config.ts            # Configuration management
│   │   └── logger.ts            # Logging utility
│   ├── claude-sdk/
│   │   ├── client.ts            # Claude Agent SDK wrapper
│   │   └── session-manager.ts   # Session rename, resume, resumability checks
│   ├── projects/
│   │   ├── detector.ts          # Project root detection (package.json, .git, etc.)
│   │   └── stack-detector.ts    # Tech stack auto-detection
│   ├── recovery/
│   │   ├── journal.ts           # Write-ahead journal for crash resilience
│   │   └── restore.ts           # Recovery/replay from journal on startup
│   ├── conversations/
│   │   ├── detector.ts          # Topic shift detection via Haiku
│   │   ├── grouper.ts           # Conversation grouping logic
│   │   ├── stash.ts             # Sidebar stash & vector clustering
│   │   └── summarizer.ts        # Per-conversation summary generation
│   ├── embeddings/
│   │   ├── provider.ts          # Embedding provider interface
│   │   ├── anthropic.ts         # Anthropic API (Haiku) embeddings
│   │   └── queue.ts             # Async embedding queue (batch processing)
│   └── utils/
│       ├── tokenizer.ts         # Simple token estimation
│       ├── summarizer.ts        # Text summarization helpers
│       └── context-builder.ts   # Context injection builder
├── package.json
├── tsconfig.json
├── PLAN.md                      # This file
├── LICENSE                      # MIT
└── CHANGELOG.md
```

---

## Step-by-Step Implementation

### Step 1: Project Scaffolding
**Files**: `package.json`, `tsconfig.json`, `.claude-plugin/plugin.json`, `.mcp.json`, `hooks/hooks.json`

Initialize the project with TypeScript, configure the plugin manifest, MCP server config, and hook definitions.

**package.json** key deps:
- `better-sqlite3` - SQLite binding with FTS5 support
- `sqlite-vec` - SQLite extension for vector similarity search
- `@anthropic-ai/sdk` - For embeddings (Haiku) and session summarization
- `@anthropic-ai/claude-code` - Claude Agent SDK for CLI interaction (session rename, resume)
- `@modelcontextprotocol/sdk` - MCP server SDK

**plugin.json**:
```json
{
  "name": "claude-scholar",
  "version": "1.0.0",
  "description": "Persistent memory for Claude Code - automatic capture, smart search, knowledge management",
  "author": { "name": "Claude Scholar" },
  "license": "MIT",
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./.mcp.json"
}
```

**.mcp.json**:
```json
{
  "mcpServers": {
    "scholar": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js"],
      "env": {
        "SCHOLAR_DATA_DIR": "~/.claude-scholar"
      }
    }
  }
}
```

**hooks.json**:
```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "startup|resume",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/scripts/session-start.js",
        "timeout": 5
      }]
    }],
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/scripts/user-prompt.js",
        "timeout": 3
      }]
    }],
    "PostToolUse": [{
      "matcher": "Read|Edit|Write|Bash|Grep|Glob|WebFetch|WebSearch",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/scripts/post-tool-use.js",
        "timeout": 3,
        "async": true
      }]
    }],
    "PreCompact": [{
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/scripts/pre-compact.js",
        "timeout": 5
      }]
    }],
    "SessionEnd": [{
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/hooks/scripts/session-end.js",
        "timeout": 30
      }]
    }]
  }
}
```

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "hooks/**/*"]
}
```

---

### Step 2: Shared Types & Configuration
**Files**: `src/shared/types.ts`, `src/shared/config.ts`, `src/shared/logger.ts`

Core TypeScript interfaces:

```typescript
interface Observation {
  id: string;
  session_id: string;
  conversation_id: string;     // Which topic group this belongs to
  tool_name: string;
  tool_input_summary: string;  // Compressed, not raw
  tool_output_summary: string; // Compressed, not raw
  project_path: string;
  files_involved: string[];    // Extracted file paths
  timestamp: number;
  tags: string[];
}

interface Conversation {
  id: string;
  session_id: string;
  topic: string;               // AI-generated topic label
  summary: string;             // Running summary of this conversation thread
  status: 'active' | 'stashed' | 'completed';
  stash_group_id: string;      // Vector-grouped cluster of similar stashed sidebars
  project_path: string;
  started_at: number;
  ended_at: number;
  resumed_at: number;          // Last time this sidebar was resumed
  observation_count: number;
}

interface Knowledge {
  id: string;
  type: 'fact' | 'decision' | 'preference' | 'pattern' | 'issue' | 'context';
  content: string;
  source_observation_ids: string[];
  conversation_id: string;     // Which conversation produced this knowledge
  project_path: string;
  tags: string[];
  confidence: number;          // 0-1, decays over time
  created_at: number;
  updated_at: number;
}

interface Session {
  id: string;
  claude_session_id: string;   // Actual Claude Code session ID (for native resume)
  project_id: string;          // Links to detected project
  summary: string;
  key_actions: string[];
  files_modified: string[];
  conversations: string[];     // Conversation IDs within this session
  started_at: number;
  ended_at: number;
  observation_count: number;
  is_resumable: boolean;       // Can this session be resumed via Claude's native --resume?
}

interface Project {
  id: string;
  root_path: string;           // Absolute path to project root (detected from CWD)
  name: string;                // Derived from directory name or package.json
  detected_stack: string[];    // Auto-detected tech stack
  first_seen: number;
  last_seen: number;
  session_count: number;
  observation_count: number;
}
```

**Config** stored at `~/.claude-scholar/settings.json`:
```json
{
  "dataDir": "~/.claude-scholar",
  "maxContextTokens": 2000,
  "sessionHistoryDepth": 10,
  "autoCapture": true,
  "webUI": { "enabled": true, "port": 37820 },
  "privacy": { "excludePatterns": [".env", "credentials", "secret"] },
  "embeddings": {
    "enabled": true,
    "provider": "anthropic",
    "model": "claude-haiku-4-5-20251001",
    "batchSize": 10,
    "dimensions": 1024
  },
  "search": {
    "ftsWeight": 0.4,
    "vectorWeight": 0.4,
    "recencyWeight": 0.1,
    "projectAffinityWeight": 0.1
  }
}
```

---

### Step 3: Database Layer
**Files**: `src/db/database.ts`, `src/db/schema.ts`, `src/db/recovery.ts`, `src/db/projects.ts`, `src/db/observations.ts`, `src/db/knowledge.ts`, `src/db/sessions.ts`, `src/db/conversations.ts`, `src/db/search.ts`, `src/db/vectors.ts`

**SQLite Schema**:
```sql
-- Enable WAL mode for crash resilience and concurrent reads
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

-- Project detection
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL UNIQUE,
  name TEXT,
  detected_stack TEXT,              -- JSON array
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  session_count INTEGER DEFAULT 0,
  observation_count INTEGER DEFAULT 0
);

-- Sessions with Claude session ID tracking
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  claude_session_id TEXT,           -- Actual Claude Code session ID for native --resume
  project_id TEXT REFERENCES projects(id),
  summary TEXT,
  key_actions TEXT,                 -- JSON array
  files_modified TEXT,              -- JSON array
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  is_resumable INTEGER DEFAULT 1,
  observation_count INTEGER DEFAULT 0
);

-- Recovery journal for crash resilience
CREATE TABLE recovery_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL,             -- Full JSON
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','committed','failed')),
  created_at INTEGER NOT NULL,
  committed_at INTEGER
);

-- Conversations with sidebar stash support
CREATE TABLE conversations (
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

-- Stash groups cluster similar sidebar conversations via vector similarity
CREATE TABLE stash_groups (
  id TEXT PRIMARY KEY,
  label TEXT,
  project_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  conversation_id TEXT REFERENCES conversations(id),
  tool_name TEXT NOT NULL,
  tool_input_summary TEXT,
  tool_output_summary TEXT,
  project_path TEXT NOT NULL,
  files_involved TEXT,       -- JSON array
  tags TEXT,                 -- JSON array
  timestamp INTEGER NOT NULL
);

CREATE TABLE knowledge (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('fact','decision','preference','pattern','issue','context')),
  content TEXT NOT NULL,
  source_observation_ids TEXT, -- JSON array
  conversation_id TEXT REFERENCES conversations(id),
  project_path TEXT,
  tags TEXT,                   -- JSON array
  confidence REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- FTS5 virtual tables
CREATE VIRTUAL TABLE observations_fts USING fts5(
  tool_input_summary, tool_output_summary, tags,
  content=observations, content_rowid=rowid,
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE knowledge_fts USING fts5(
  content, tags,
  content=knowledge, content_rowid=rowid,
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE sessions_fts USING fts5(
  summary, key_actions,
  content=sessions, content_rowid=rowid,
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE conversations_fts USING fts5(
  topic, summary,
  content=conversations, content_rowid=rowid,
  tokenize='porter unicode61'
);

-- Vector embeddings (sqlite-vec)
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK(source_type IN ('observation','knowledge','session','conversation')),
  source_id TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE vec_embeddings USING vec0(
  id TEXT PRIMARY KEY,
  embedding float[1024]
);

-- Embedding queue for async processing
CREATE TABLE embedding_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  text_content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','done','error')),
  error_message TEXT,
  created_at INTEGER NOT NULL,
  processed_at INTEGER
);

-- Indexes
CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_project ON conversations(project_path);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_time ON conversations(started_at DESC);
CREATE INDEX idx_observations_conversation ON observations(conversation_id);
CREATE INDEX idx_observations_session ON observations(session_id);
CREATE INDEX idx_observations_project ON observations(project_path);
CREATE INDEX idx_observations_timestamp ON observations(timestamp DESC);
CREATE INDEX idx_observations_tool ON observations(tool_name);
CREATE INDEX idx_knowledge_type ON knowledge(type);
CREATE INDEX idx_knowledge_project ON knowledge(project_path);
CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_claude_id ON sessions(claude_session_id);
CREATE INDEX idx_sessions_time ON sessions(started_at DESC);
CREATE INDEX idx_embeddings_source ON embeddings(source_type, source_id);
CREATE INDEX idx_embedding_queue_status ON embedding_queue(status);
CREATE INDEX idx_stash_groups_project ON stash_groups(project_path);
```

**Hybrid Search implementation**: Combines two search strategies with score fusion:

1. **FTS5 keyword search** - BM25 scoring, great for exact terms, file names, function names
2. **Vector similarity search** - Cosine similarity via sqlite-vec, great for semantic/conceptual queries

Score fusion: `final_score = (0.4 * fts5_score) + (0.4 * vector_score) + (0.1 * recency_bonus) + (0.1 * project_affinity)`
(Weights configurable in settings.json)

Results in 3-layer progressive disclosure:
- **Layer 1 (Index)**: ID + snippet + score + timestamp (~50 tokens per result)
- **Layer 2 (Context)**: Full content + surrounding conversation context
- **Layer 3 (Detail)**: Full observation chain with all metadata

**Graceful degradation**: No API key → vector search skipped → FTS5 only. Always works.

---

### Step 4: Project Detection
**Files**: `src/projects/detector.ts`, `src/projects/stack-detector.ts`

**Project root detection** (`src/projects/detector.ts`):
- Walk up from CWD looking for: `.git/`, `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `pom.xml`, `.claude/`
- Cache detected root per path
- Create/update `projects` record in DB

**Tech stack auto-detection** (`src/projects/stack-detector.ts`):
- Scan project root for indicator files:
  - `package.json` → read deps for frameworks (react, express, vue, etc.)
  - `tsconfig.json` → TypeScript
  - `Cargo.toml` → Rust
  - `requirements.txt` / `pyproject.toml` → Python
  - `Dockerfile` → Docker
  - `.github/workflows/` → GitHub Actions
- Store in `projects.detected_stack` as JSON array
- Update on first session per project per day (not every hook call)

---

### Step 5: Recovery System
**Files**: `src/recovery/journal.ts`, `src/recovery/restore.ts`

**Write-ahead journal** (`src/recovery/journal.ts`):
- Every write op → first write to `recovery_journal` as pending with full payload
- After actual DB write succeeds → mark journal entry 'committed'
- Process crash → pending entries remain for replay

**Recovery on startup** (`src/recovery/restore.ts`):
- At SessionStart, check for pending journal entries
- Replay uncommitted operations (idempotent via record IDs)
- Clean up old committed entries (keep last 1000 or 24 hours)
- Log recovery actions

**What gets recovered**: observations, conversation stash ops, session summaries, embedding queue items

---

### Step 6: Claude SDK Integration & Session Management
**Files**: `src/claude-sdk/client.ts`, `src/claude-sdk/session-manager.ts`

**Session naming convention**: `<topic> - <scholar-db-id>`
Examples:
- `Auth middleware setup - sch_a1b2c3`
- `CORS debugging - sch_d4e5f6`
- `Docker deployment config - sch_g7h8i9`

**Claude SDK client** (`src/claude-sdk/client.ts`):
- Wraps `@anthropic-ai/claude-code` SDK
- Methods: `renameSession()`, `listSessions()`, `getSessionInfo()`

**Session manager** (`src/claude-sdk/session-manager.ts`):
- **Auto-rename on topic detection**: Haiku identifies topic → rename session to `<topic> - <db_id>`
- **Rename on topic shift**: New conversation starts → rename to new topic
- **Track resumability**: Periodically check if session IDs are still valid in Claude CLI
- **Resume orchestration** via `memory_resume`:
  1. Check if target Claude session still available
  2. If yes → provide `claude --resume SESSION_ID` (full native context)
  3. If no → inject Scholar summary context (graceful fallback)

---

### Step 7: Conversation Grouping + Sidebar Stash System
**Files**: `src/conversations/detector.ts`, `src/conversations/grouper.ts`, `src/conversations/stash.ts`, `src/conversations/summarizer.ts`

**Topic Shift Detection** (`src/conversations/detector.ts`):
- Uses Claude Haiku to compare current prompt against active conversation:
  ```
  Current topic: "{topic}" | Recent context: "{summary}" | New activity: "{prompt}"
  → JSON: {"same_topic": true/false, "new_topic": "label if new"}
  ```
- Cost: ~100-200 input + ~20 output tokens per check
- Heuristic shortcuts (skip API): same file = same topic, same directory = likely same, >10min gap = likely new

**Grouper** (`src/conversations/grouper.ts`):
- On topic shift:
  1. **Stash** current conversation (status → 'stashed')
  2. Generate stash summary
  3. Create new conversation with topic label
  4. Rename Claude session via SDK

**Sidebar Stash System** (`src/conversations/stash.ts`):
- Stashed conversations persist across sessions
- **Vector grouping**: Compare stashed conversation embedding against existing stash groups. Similar → join group. Otherwise → new group.
- **Resume flow** (`memory_resume` tool):
  1. List stashed sidebars by similarity cluster
  2. User picks one → active conversation stashed, selected becomes active
  3. Inject context OR provide native `claude --resume` command
- **Auto-resume**: If new topic matches existing stash (vector similarity), suggest resuming instead of creating new

**Summarizer** (`src/conversations/summarizer.ts`):
- Running summary per conversation (updated every N observations)
- Stash summary: snapshot for future resume
- Final summary: generated at conversation completion

---

### Step 8: Embedding Pipeline
**Files**: `src/embeddings/provider.ts`, `src/embeddings/anthropic.ts`, `src/embeddings/queue.ts`

**Provider interface**:
```typescript
interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
}
```

**Anthropic provider** (`src/embeddings/anthropic.ts`):
- Uses `@anthropic-ai/sdk` with Claude Haiku
- Prompt: "Represent this coding activity for semantic retrieval: {text}"
- Falls back gracefully if API key missing or rate limited

**Embedding queue** (`src/embeddings/queue.ts`):
- Items added to `embedding_queue` on observation/knowledge creation
- Batch processor (configurable, default 10 items)
- Processes at: SessionEnd, idle MCP server time
- Rate limiting, exponential backoff retry (max 3 attempts)
- Status exposed via `memory_stats`

---

### Step 9: MCP Server
**Files**: `src/mcp/server.ts`, `src/mcp/tools/*.ts`, `src/mcp/index.ts`

Built with `@modelcontextprotocol/sdk`. Single-process, stdio transport.

| Tool | Parameters | Returns |
|------|-----------|---------|
| `memory_search` | `query, type?, project?, tags?, from_date?, to_date?, limit?` | Ranked results (Layer 1) |
| `memory_save` | `content, type, tags?, project?` | Saved knowledge ID |
| `memory_timeline` | `around?, session_id?, conversation_id?, project?, limit?` | Chronological observations |
| `memory_get` | `ids[], include_context?` | Full records (Layer 2/3) |
| `memory_forget` | `ids?, query?, before_date?` | Count deleted |
| `memory_stash` | `list?, group?` | Stashed sidebars by cluster |
| `memory_resume` | `conversation_id` | Context + Claude session ID |
| `memory_stats` | `project?` | Counts, storage, queue status |

---

### Step 10: Hook Implementations
**Files**: `hooks/scripts/*.ts`

**SessionStart** (timeout: 5s):
1. Read JSON from stdin (session_id, cwd, source)
2. Run recovery (replay pending journal entries)
3. Detect project (walk up from CWD)
4. Store Claude session ID for future native resume
5. Query last N sessions + conversations for this project
6. Query relevant knowledge items
7. List stashed sidebars
8. Build token-efficient context summary (~2000 tokens max)
9. Output to stdout

Context injection format:
```
[Scholar Memory] Project: my-app (/home/user/projects/my-app)
Stack: TypeScript, Express, PostgreSQL, Docker
Last session (2h ago) [resumable: claude --resume abc123]:
  ├─ Auth middleware setup: Implemented JWT auth, added middleware chain
  └─ CORS debugging: Fixed preflight OPTIONS, updated allowed origins
Key knowledge: Prefers Vitest over Jest, uses Drizzle ORM, deploys to Fly.io
Recent files: src/auth.ts, src/middleware/cors.ts, tests/auth.test.ts
Stashed sidebars (3):
  ├─ [auth] Token refresh flow (2h ago, session: def456)
  ├─ [deploy] Docker config questions (1d ago, session: ghi789)
  └─ [css] Responsive navbar issue (3d ago, session: jkl012)
→ Use mcp__scholar__memory_resume to pick up a stashed sidebar
→ Use mcp__scholar__memory_search to find specific memories
```

**UserPromptSubmit** (timeout: 3s):
1. Read prompt from stdin
2. Run topic shift detection (Haiku or heuristic)
3. If shift → stash current conversation, create new, rename Claude session
4. Store prompt as conversation context

**PostToolUse** (async, timeout: 3s):
1. Read tool_name, tool_input, tool_response from stdin
2. Compress to summaries (intelligent truncation)
3. Extract file paths, check privacy patterns
4. Insert observation (linked to active conversation) + FTS5
5. Add to embedding queue

**PreCompact** (timeout: 5s):
1. Save context snapshot before compaction
2. Store as "compaction_snapshot" observation

**SessionEnd** (timeout: 30s):
1. Generate session summary (Haiku or extractive)
2. Extract key actions, files, decisions
3. Update session record
4. Extract knowledge items from patterns
5. Stash active conversations (persist for future sessions)
6. Flush embedding queue (batch process)

---

### Step 11: Utility Modules
**Files**: `src/utils/tokenizer.ts`, `src/utils/summarizer.ts`, `src/utils/context-builder.ts`

**Tokenizer**: Word-based estimation (~0.75 tokens/word). No external dep.

**Summarizer**: Extractive (first/last sentences, key phrases, dedup, truncation).

**Context Builder**: Token-budgeted assembly:
- Session summaries: 35%
- Knowledge items: 35%
- Stashed sidebars: 15%
- Recent file list: 15%

---

### Step 12: Web UI Backend
**Files**: `src/web/server.ts`, `src/web/routes.ts`

Built-in `node:http`, port 37820.

**API Routes**:
- `GET /api/search?q=...&type=...&project=...`
- `GET /api/sessions?project=...&limit=...`
- `GET /api/sessions/:id`
- `GET /api/conversations?status=stashed&project=...`
- `GET /api/conversations/:id`
- `GET /api/knowledge?type=...&project=...`
- `GET /api/stash-groups?project=...`
- `GET /api/stats`
- `POST /api/conversations/:id/resume`
- `DELETE /api/memories/:id`
- `GET /api/export`
- `GET /` → Serve SPA

---

### Step 13: Web UI Frontend
**Files**: `src/web/public/*`

Vanilla JS with lit-html (zero build step). SPA with hash routing. Dark/light theme.

**Pages**:
1. **Dashboard** - Stats, recent activity chart, top projects, embedding queue status
2. **Search** - Search bar with filters, highlighted results, expandable details
3. **Timeline** - Sessions → Conversations → Observations (nested expandable)
4. **Knowledge** - Cards by type, tags, confidence indicators
5. **Stash** - Grouped stashed sidebars, resume buttons, Claude session links

---

## Implementation Order

1. **Project scaffolding** - package.json, tsconfig, plugin manifest, install deps
2. **Shared types & config** - TypeScript interfaces, config loader, logger
3. **Database layer** - SQLite init, WAL mode, full schema, CRUD, FTS5, sqlite-vec
4. **Project detection** - Root path detection, tech stack auto-detection
5. **Recovery system** - Write-ahead journal, startup recovery
6. **Claude SDK integration** - SDK wrapper, session rename (`<topic> - <db_id>`), resume management
7. **Conversation grouping + sidebar stash** - Topic shift detector, grouper, stash with vector clustering
8. **Embedding pipeline** - Provider interface, Anthropic embeddings, async queue
9. **MCP server** - Server entry point, all 8 tools
10. **Hook scripts** - All 5 hooks (SessionStart, UserPromptSubmit, PostToolUse, PreCompact, SessionEnd)
11. **Utilities** - Tokenizer, summarizer, context builder
12. **Web UI backend** - HTTP server, API routes
13. **Web UI frontend** - Dashboard, search, timeline, knowledge, stash views
14. **Testing & polish** - Manual testing with `claude --plugin-dir`, bug fixes

---

## Verification

1. **Plugin loads**: `claude --plugin-dir /data/Claude_Scholar` starts without errors
2. **Project detection**: Starting Claude in a project dir correctly detects root, name, and stack
3. **Hooks fire**: Start a session, use some tools, end session → observations recorded in DB
4. **Session ID tracking**: `sessions.claude_session_id` stores the actual Claude session ID
5. **Session naming**: Claude session renamed to `<topic> - <db_id>` on topic detection
6. **MCP tools work**: All 8 tools respond correctly
7. **FTS5 search**: Keyword queries return relevant results
8. **Vector search**: Semantic queries find related items without exact keyword matches
9. **Conversation grouping**: Topic shifts detected → previous conversation stashed
10. **Sidebar stash**: `memory_stash` lists stashed conversations grouped by vector similarity
11. **Sidebar resume**: `memory_resume` returns context + Claude session ID for native resume
12. **Recovery**: Kill process mid-write → restart → journal replays lost operations
13. **Embedding queue**: Items queue and process in batches
14. **Graceful degradation**: No API key → FTS5-only without errors
15. **Context injection**: New session shows project info, conversations, stashed sidebars
16. **Web UI**: Visit `http://localhost:37820`, browse all views
17. **Privacy**: Excluded patterns not captured
18. **Non-blocking**: PostToolUse async, never delays Claude
