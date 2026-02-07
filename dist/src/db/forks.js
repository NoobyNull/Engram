import { getDb, generateId } from './database.js';
/**
 * CRUD operations for the session_forks table.
 */
export function createFork(sessionId, label, snapshot) {
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
export function getFork(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM session_forks WHERE id = ?').get(id);
    if (!row)
        return null;
    return parseRow(row);
}
export function listForks(sessionId) {
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
export function deleteFork(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM session_forks WHERE id = ?').run(id);
    return result.changes > 0;
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
//# sourceMappingURL=forks.js.map