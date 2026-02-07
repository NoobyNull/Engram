import { getDb } from './database.js';
import type { RecoveryJournalEntry } from '../shared/types.js';
import { createLogger } from '../shared/logger.js';

const log = createLogger('db:recovery');

export function writeJournalEntry(operation: string, tableName: string, recordId: string, payload: unknown): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO recovery_journal (operation, table_name, record_id, payload, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(operation, tableName, recordId, JSON.stringify(payload), Date.now());
  return result.lastInsertRowid as number;
}

export function commitJournalEntry(id: number): void {
  const db = getDb();
  db.prepare("UPDATE recovery_journal SET status = 'committed', committed_at = ? WHERE id = ?").run(Date.now(), id);
}

export function failJournalEntry(id: number): void {
  const db = getDb();
  db.prepare("UPDATE recovery_journal SET status = 'failed' WHERE id = ?").run(id);
}

export function getPendingJournalEntries(): RecoveryJournalEntry[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM recovery_journal WHERE status = 'pending' ORDER BY id ASC"
  ).all() as Record<string, unknown>[];
  return rows.map(row => ({
    id: row['id'] as number,
    operation: row['operation'] as string,
    table_name: row['table_name'] as string,
    record_id: row['record_id'] as string,
    payload: row['payload'] as string,
    status: row['status'] as RecoveryJournalEntry['status'],
    created_at: row['created_at'] as number,
    committed_at: row['committed_at'] as number | null,
  }));
}

export function cleanupJournal(keepCount: number = 1000, maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const db = getDb();
  const cutoff = Date.now() - maxAgeMs;

  // Delete old committed entries, keeping at most keepCount recent ones
  const result = db.prepare(`
    DELETE FROM recovery_journal
    WHERE status = 'committed'
    AND (committed_at < ? OR id NOT IN (
      SELECT id FROM recovery_journal WHERE status = 'committed' ORDER BY id DESC LIMIT ?
    ))
  `).run(cutoff, keepCount);

  if (result.changes > 0) {
    log.info('Cleaned up journal entries', { deleted: result.changes });
  }
  return result.changes;
}

export function replayPendingEntries(): number {
  const pending = getPendingJournalEntries();
  if (pending.length === 0) return 0;

  log.info('Replaying pending journal entries', { count: pending.length });
  const db = getDb();
  let replayed = 0;

  for (const entry of pending) {
    try {
      const payload = JSON.parse(entry.payload);

      // Check if the record already exists (idempotent replay)
      const existing = db.prepare(
        `SELECT id FROM ${entry.table_name} WHERE id = ?`
      ).get(entry.record_id) as { id: string } | undefined;

      if (existing) {
        // Already committed — just mark the journal entry
        commitJournalEntry(entry.id);
        replayed++;
        continue;
      }

      // Replay the insert
      if (entry.operation === 'insert_observation') {
        const p = payload;
        db.prepare(`
          INSERT INTO observations (id, session_id, conversation_id, tool_name, tool_input_summary, tool_output_summary, project_path, files_involved, tags, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(p.id, p.session_id, p.conversation_id, p.tool_name, p.tool_input_summary, p.tool_output_summary, p.project_path, p.files_involved, p.tags, p.timestamp);
      } else if (entry.operation === 'insert_knowledge') {
        const p = payload;
        db.prepare(`
          INSERT INTO knowledge (id, type, content, source_observation_ids, conversation_id, project_path, tags, confidence, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(p.id, p.type, p.content, p.source_observation_ids, p.conversation_id, p.project_path, p.tags, p.confidence, p.created_at, p.updated_at);
      } else if (entry.operation === 'stash_conversation') {
        db.prepare("UPDATE conversations SET status = 'stashed', stashed_at = ?, ended_at = ? WHERE id = ?")
          .run(payload.stashed_at, payload.ended_at, entry.record_id);
      } else if (entry.operation === 'update_session') {
        db.prepare('UPDATE sessions SET summary = ?, key_actions = ?, files_modified = ?, ended_at = ? WHERE id = ?')
          .run(payload.summary, payload.key_actions, payload.files_modified, payload.ended_at, entry.record_id);
      }

      commitJournalEntry(entry.id);
      replayed++;
      log.info('Replayed journal entry', { id: entry.id, operation: entry.operation });
    } catch (err) {
      log.error('Failed to replay journal entry', { id: entry.id, error: err });
      failJournalEntry(entry.id);
    }
  }

  return replayed;
}
