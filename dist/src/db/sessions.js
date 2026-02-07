import { getDb, generateId } from './database.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('db:sessions');
export function createSession(projectId, claudeSessionId) {
    const db = getDb();
    const now = Date.now();
    const id = generateId('ses');
    db.prepare(`
    INSERT INTO sessions (id, claude_session_id, project_id, summary, key_actions, files_modified, started_at, ended_at, is_resumable, observation_count)
    VALUES (?, ?, ?, NULL, '[]', '[]', ?, NULL, 1, 0)
  `).run(id, claudeSessionId || null, projectId, now);
    log.info('Created session', { id, projectId, claudeSessionId });
    return {
        id, claude_session_id: claudeSessionId || null, project_id: projectId,
        summary: null, key_actions: [], files_modified: [],
        started_at: now, ended_at: null, is_resumable: true, observation_count: 0,
    };
}
export function getSession(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!row)
        return null;
    return deserializeSession(row);
}
export function getSessionByClaudeId(claudeSessionId) {
    const db = getDb();
    // Check both the primary claude_session_id and the prior_claude_session_ids list
    // (resumed sessions get new IDs — known SDK bug)
    const row = db.prepare(`
    SELECT * FROM sessions
    WHERE claude_session_id = ?
       OR (',' || prior_claude_session_ids || ',') LIKE ('%,' || ? || ',%')
    ORDER BY started_at DESC LIMIT 1
  `).get(claudeSessionId, claudeSessionId);
    if (!row)
        return null;
    return deserializeSession(row);
}
/**
 * Link a new Claude session ID to an existing ClauDEX session.
 *
 * When Claude resumes a session, the resumed session gets a different
 * session_id (known SDK bug). This function updates the primary
 * claude_session_id and archives the old one in prior_claude_session_ids
 * so we can still find the ClauDEX session by any of its Claude IDs.
 */
export function linkClaudeSessionId(claudexSessionId, newClaudeSessionId) {
    const db = getDb();
    const session = getSession(claudexSessionId);
    if (!session) {
        log.warn('Cannot link Claude session ID — ClauDEX session not found', { claudexSessionId });
        return;
    }
    // Archive the old ID if present
    const priorRow = db.prepare('SELECT prior_claude_session_ids FROM sessions WHERE id = ?').get(claudexSessionId);
    const priorIds = priorRow?.prior_claude_session_ids ? priorRow.prior_claude_session_ids.split(',') : [];
    if (session.claude_session_id && !priorIds.includes(session.claude_session_id)) {
        priorIds.push(session.claude_session_id);
    }
    db.prepare(`
    UPDATE sessions SET claude_session_id = ?, prior_claude_session_ids = ? WHERE id = ?
  `).run(newClaudeSessionId, priorIds.join(',') || null, claudexSessionId);
    log.info('Linked new Claude session ID', { claudexSessionId, newClaudeSessionId, priorIds });
}
export function endSession(id, summary, keyActions, filesModified) {
    const db = getDb();
    const now = Date.now();
    db.prepare(`
    UPDATE sessions SET ended_at = ?, summary = COALESCE(?, summary),
    key_actions = COALESCE(?, key_actions), files_modified = COALESCE(?, files_modified)
    WHERE id = ?
  `).run(now, summary || null, keyActions ? JSON.stringify(keyActions) : null, filesModified ? JSON.stringify(filesModified) : null, id);
    log.info('Ended session', { id });
}
export function updateSessionSummary(id, summary, keyActions, filesModified) {
    const db = getDb();
    const parts = ['summary = ?'];
    const params = [summary];
    if (keyActions) {
        parts.push('key_actions = ?');
        params.push(JSON.stringify(keyActions));
    }
    if (filesModified) {
        parts.push('files_modified = ?');
        params.push(JSON.stringify(filesModified));
    }
    params.push(id);
    db.prepare(`UPDATE sessions SET ${parts.join(', ')} WHERE id = ?`).run(...params);
}
export function incrementSessionObservationCount(id) {
    const db = getDb();
    db.prepare('UPDATE sessions SET observation_count = observation_count + 1 WHERE id = ?').run(id);
}
export function getRecentSessions(projectId, limit = 10) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?').all(projectId, limit);
    return rows.map(deserializeSession);
}
function deserializeSession(row) {
    return {
        id: row['id'],
        claude_session_id: row['claude_session_id'],
        project_id: row['project_id'],
        summary: row['summary'],
        key_actions: JSON.parse(row['key_actions'] || '[]'),
        files_modified: JSON.parse(row['files_modified'] || '[]'),
        started_at: row['started_at'],
        ended_at: row['ended_at'],
        is_resumable: !!row['is_resumable'],
        observation_count: row['observation_count'],
    };
}
//# sourceMappingURL=sessions.js.map