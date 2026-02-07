import { getDb } from '../db/database.js';
import { generateId } from '../db/database.js';
import { createLogger } from '../shared/logger.js';
import { getSessionByClaudeId } from '../db/sessions.js';
import { getObservationsBySession } from '../db/observations.js';
import { getSessionConversations } from '../db/conversations.js';
const log = createLogger('sdk:checkpoint');
/**
 * Create a checkpoint (session fork) — a snapshot of the current session state.
 * Used for recovery, branching, and destructive-operation safety.
 *
 * @param claudeSessionId — the Claude CLI session ID to resolve to a ClauDEX session.
 * @param label — optional human-readable label for this checkpoint.
 */
export async function createCheckpoint(claudeSessionId, label) {
    const db = getDb();
    const session = getSessionByClaudeId(claudeSessionId);
    if (!session) {
        log.warn('No session found for checkpoint', { claudeSessionId });
        return null;
    }
    const sessionId = session.id;
    const observations = getObservationsBySession(sessionId);
    const conversations = getSessionConversations(sessionId);
    const snapshot = {
        observation_count: observations.length,
        conversation_ids: conversations.map(c => c.id),
        last_observation_id: observations.length > 0 ? observations[observations.length - 1].id : null,
    };
    const id = generateId('fork');
    const now = Date.now();
    db.prepare(`
    INSERT INTO session_forks (id, session_id, label, snapshot, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, sessionId, label || null, JSON.stringify(snapshot), now);
    log.info('Checkpoint created', { id, sessionId, label });
    return {
        id,
        session_id: sessionId,
        label: label || null,
        snapshot,
        created_at: now,
    };
}
/**
 * List all checkpoints, optionally filtered by session.
 */
export function listCheckpoints(sessionId) {
    const db = getDb();
    let rows;
    if (sessionId) {
        rows = db.prepare('SELECT * FROM session_forks WHERE session_id = ? ORDER BY created_at DESC').all(sessionId);
    }
    else {
        rows = db.prepare('SELECT * FROM session_forks ORDER BY created_at DESC LIMIT 50').all();
    }
    return rows.map(parseRow);
}
/**
 * Get a specific checkpoint by ID.
 */
export function getCheckpoint(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM session_forks WHERE id = ?').get(id);
    if (!row)
        return null;
    return parseRow(row);
}
function parseRow(row) {
    return {
        id: row['id'],
        session_id: row['session_id'],
        label: row['label'],
        snapshot: JSON.parse(row['snapshot'] || '{}'),
        created_at: row['created_at'],
    };
}
//# sourceMappingURL=checkpoint.js.map