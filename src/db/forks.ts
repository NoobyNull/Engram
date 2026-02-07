import { getDb, generateId } from './database.js';
import type { SessionFork } from '../shared/types.js';

/**
 * CRUD operations for the session_forks table.
 */

export function createFork(
  sessionId: string,
  label?: string,
  snapshot?: Record<string, unknown>,
): SessionFork {
  const db = getDb();
  const id = generateId('fork');
  const now = Date.now();

  db.prepare(`
    INSERT INTO session_forks (id, session_id, label, snapshot, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, sessionId, label || null, JSON.stringify(snapshot || {}), now);

  return {
    id,
    session_id: sessionId,
    label: label || null,
    snapshot: snapshot || {},
    created_at: now,
  };
}

export function getFork(id: string): SessionFork | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM session_forks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return parseRow(row);
}

export function listForks(sessionId?: string): SessionFork[] {
  const db = getDb();
  let rows: Array<Record<string, unknown>>;
  if (sessionId) {
    rows = db.prepare('SELECT * FROM session_forks WHERE session_id = ? ORDER BY created_at DESC').all(sessionId) as Array<Record<string, unknown>>;
  } else {
    rows = db.prepare('SELECT * FROM session_forks ORDER BY created_at DESC LIMIT 50').all() as Array<Record<string, unknown>>;
  }
  return rows.map(parseRow);
}

export function deleteFork(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM session_forks WHERE id = ?').run(id);
  return result.changes > 0;
}

function parseRow(row: Record<string, unknown>): SessionFork {
  return {
    id: row['id'] as string,
    session_id: row['session_id'] as string,
    label: row['label'] as string | null,
    snapshot: JSON.parse((row['snapshot'] as string) || '{}'),
    created_at: row['created_at'] as number,
  };
}
