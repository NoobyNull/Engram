import { getDb, generateId } from './database.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('db:conversations');
export function createConversation(sessionId, projectPath, topic) {
    const db = getDb();
    const now = Date.now();
    const id = generateId('conv');
    db.prepare(`
    INSERT INTO conversations (id, session_id, topic, summary, status, stash_group_id, project_path, started_at, ended_at, resumed_at, stashed_at, observation_count)
    VALUES (?, ?, ?, NULL, 'active', NULL, ?, ?, NULL, NULL, NULL, 0)
  `).run(id, sessionId, topic || null, projectPath, now);
    log.info('Created conversation', { id, sessionId, topic });
    return {
        id, session_id: sessionId, topic: topic || null, summary: null,
        status: 'active', stash_group_id: null, project_path: projectPath,
        started_at: now, ended_at: null, resumed_at: null, stashed_at: null,
        observation_count: 0,
    };
}
export function getConversation(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!row)
        return null;
    return deserializeConversation(row);
}
export function getActiveConversation(sessionId) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM conversations WHERE session_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1").get(sessionId);
    if (!row)
        return null;
    return deserializeConversation(row);
}
export function updateConversationTopic(id, topic) {
    const db = getDb();
    db.prepare('UPDATE conversations SET topic = ? WHERE id = ?').run(topic, id);
}
export function updateConversationSummary(id, summary) {
    const db = getDb();
    db.prepare('UPDATE conversations SET summary = ? WHERE id = ?').run(summary, id);
}
export function stashConversation(id, stashGroupId) {
    const db = getDb();
    const now = Date.now();
    db.prepare(`
    UPDATE conversations SET status = 'stashed', stashed_at = ?, ended_at = ?, stash_group_id = COALESCE(?, stash_group_id) WHERE id = ?
  `).run(now, now, stashGroupId || null, id);
    log.info('Stashed conversation', { id, stashGroupId });
}
export function completeConversation(id, summary) {
    const db = getDb();
    const now = Date.now();
    db.prepare(`
    UPDATE conversations SET status = 'completed', ended_at = ?, summary = COALESCE(?, summary) WHERE id = ?
  `).run(now, summary || null, id);
}
export function resumeConversation(id) {
    const db = getDb();
    const now = Date.now();
    db.prepare("UPDATE conversations SET status = 'active', resumed_at = ? WHERE id = ?").run(now, id);
    log.info('Resumed conversation', { id });
}
export function incrementConversationObservationCount(id) {
    const db = getDb();
    db.prepare('UPDATE conversations SET observation_count = observation_count + 1 WHERE id = ?').run(id);
}
export function getStashedConversations(projectPath) {
    const db = getDb();
    let sql = "SELECT * FROM conversations WHERE status = 'stashed'";
    const params = [];
    if (projectPath) {
        sql += ' AND project_path = ?';
        params.push(projectPath);
    }
    sql += ' ORDER BY stashed_at DESC';
    const rows = db.prepare(sql).all(...params);
    return rows.map(deserializeConversation);
}
export function getSessionConversations(sessionId) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM conversations WHERE session_id = ? ORDER BY started_at ASC').all(sessionId);
    return rows.map(deserializeConversation);
}
// Stash groups
export function createStashGroup(label, projectPath) {
    const db = getDb();
    const now = Date.now();
    const id = generateId('sg');
    db.prepare(`
    INSERT INTO stash_groups (id, label, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
  `).run(id, label, projectPath || null, now, now);
    return { id, label, project_path: projectPath || null, created_at: now, updated_at: now };
}
export function getStashGroups(projectPath) {
    const db = getDb();
    let sql = 'SELECT * FROM stash_groups';
    const params = [];
    if (projectPath) {
        sql += ' WHERE project_path = ?';
        params.push(projectPath);
    }
    sql += ' ORDER BY updated_at DESC';
    const rows = db.prepare(sql).all(...params);
    return rows.map(row => ({
        id: row['id'],
        label: row['label'],
        project_path: row['project_path'],
        created_at: row['created_at'],
        updated_at: row['updated_at'],
    }));
}
function deserializeConversation(row) {
    return {
        id: row['id'],
        session_id: row['session_id'],
        topic: row['topic'],
        summary: row['summary'],
        status: row['status'],
        stash_group_id: row['stash_group_id'],
        project_path: row['project_path'],
        started_at: row['started_at'],
        ended_at: row['ended_at'],
        resumed_at: row['resumed_at'],
        stashed_at: row['stashed_at'],
        observation_count: row['observation_count'],
    };
}
//# sourceMappingURL=conversations.js.map