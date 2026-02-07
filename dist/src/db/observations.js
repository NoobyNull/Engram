import { getDb, generateId } from './database.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('db:observations');
export function createObservation(input) {
    const db = getDb();
    const now = Date.now();
    const id = generateId('obs');
    db.prepare(`
    INSERT INTO observations (id, session_id, conversation_id, tool_name, tool_input_summary, tool_output_summary, project_path, files_involved, tags, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.session_id, input.conversation_id || null, input.tool_name, input.tool_input_summary || null, input.tool_output_summary || null, input.project_path, JSON.stringify(input.files_involved || []), JSON.stringify(input.tags || []), now);
    log.debug('Created observation', { id, tool: input.tool_name });
    return {
        id, session_id: input.session_id,
        conversation_id: input.conversation_id || null,
        tool_name: input.tool_name,
        tool_input_summary: input.tool_input_summary || null,
        tool_output_summary: input.tool_output_summary || null,
        project_path: input.project_path,
        files_involved: input.files_involved || [],
        tags: input.tags || [],
        timestamp: now,
    };
}
export function getObservation(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM observations WHERE id = ?').get(id);
    if (!row)
        return null;
    return deserializeObservation(row);
}
export function getObservationsBySession(sessionId, limit) {
    const db = getDb();
    let sql = 'SELECT * FROM observations WHERE session_id = ? ORDER BY timestamp ASC';
    const params = [sessionId];
    if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
    }
    const rows = db.prepare(sql).all(...params);
    return rows.map(deserializeObservation);
}
export function getObservationsByConversation(conversationId, limit) {
    const db = getDb();
    let sql = 'SELECT * FROM observations WHERE conversation_id = ? ORDER BY timestamp ASC';
    const params = [conversationId];
    if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
    }
    const rows = db.prepare(sql).all(...params);
    return rows.map(deserializeObservation);
}
export function getRecentObservations(projectPath, limit = 20) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM observations WHERE project_path = ? ORDER BY timestamp DESC LIMIT ?').all(projectPath, limit);
    return rows.map(deserializeObservation);
}
export function getObservationsAround(timestamp, limit = 20, projectPath) {
    const db = getDb();
    if (projectPath) {
        const rows = db.prepare(`
      SELECT * FROM observations WHERE project_path = ?
      ORDER BY ABS(timestamp - ?) ASC LIMIT ?
    `).all(projectPath, timestamp, limit);
        return rows.map(deserializeObservation);
    }
    const rows = db.prepare(`
    SELECT * FROM observations ORDER BY ABS(timestamp - ?) ASC LIMIT ?
  `).all(timestamp, limit);
    return rows.map(deserializeObservation);
}
export function deleteObservation(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM observations WHERE id = ?').run(id);
    return result.changes > 0;
}
export function deleteObservationsByQuery(query, beforeDate) {
    const db = getDb();
    // Find matching observation IDs via FTS
    let sql = `
    SELECT o.id FROM observations o
    JOIN observations_fts f ON o.rowid = f.rowid
    WHERE observations_fts MATCH ?
  `;
    const params = [query];
    if (beforeDate) {
        sql += ' AND o.timestamp < ?';
        params.push(beforeDate);
    }
    const ids = db.prepare(sql).all(...params);
    if (ids.length === 0)
        return 0;
    const idList = ids.map(r => r.id);
    const placeholders = idList.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM observations WHERE id IN (${placeholders})`).run(...idList);
    return result.changes;
}
export function countObservations(projectPath) {
    const db = getDb();
    if (projectPath) {
        const row = db.prepare('SELECT COUNT(*) as count FROM observations WHERE project_path = ?').get(projectPath);
        return row.count;
    }
    const row = db.prepare('SELECT COUNT(*) as count FROM observations').get();
    return row.count;
}
function deserializeObservation(row) {
    return {
        id: row['id'],
        session_id: row['session_id'],
        conversation_id: row['conversation_id'],
        tool_name: row['tool_name'],
        tool_input_summary: row['tool_input_summary'],
        tool_output_summary: row['tool_output_summary'],
        project_path: row['project_path'],
        files_involved: JSON.parse(row['files_involved'] || '[]'),
        tags: JSON.parse(row['tags'] || '[]'),
        timestamp: row['timestamp'],
    };
}
//# sourceMappingURL=observations.js.map