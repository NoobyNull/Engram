import { getDb, generateId } from './database.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('db:knowledge');
export function createKnowledge(input) {
    const db = getDb();
    const now = Date.now();
    const id = generateId('kn');
    db.prepare(`
    INSERT INTO knowledge (id, type, content, source_observation_ids, source_knowledge_ids, conversation_id, project_path, tags, confidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.type, input.content, JSON.stringify(input.source_observation_ids || []), JSON.stringify(input.source_knowledge_ids || []), input.conversation_id || null, input.project_path || null, JSON.stringify(input.tags || []), input.confidence ?? 1.0, now, now);
    log.info('Created knowledge', { id, type: input.type });
    return {
        id, type: input.type, content: input.content,
        source_observation_ids: input.source_observation_ids || [],
        source_knowledge_ids: input.source_knowledge_ids || [],
        conversation_id: input.conversation_id || null,
        project_path: input.project_path || null,
        tags: input.tags || [],
        confidence: input.confidence ?? 1.0,
        created_at: now, updated_at: now,
    };
}
export function getKnowledge(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM knowledge WHERE id = ?').get(id);
    if (!row)
        return null;
    return deserializeKnowledge(row);
}
export function getKnowledgeByType(type, projectPath, limit = 50) {
    const db = getDb();
    let sql = 'SELECT * FROM knowledge WHERE type = ?';
    const params = [type];
    if (projectPath) {
        sql += ' AND project_path = ?';
        params.push(projectPath);
    }
    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);
    const rows = db.prepare(sql).all(...params);
    return rows.map(deserializeKnowledge);
}
export function getKnowledgeForProject(projectPath, limit = 50) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM knowledge WHERE project_path = ? ORDER BY confidence DESC, updated_at DESC LIMIT ?').all(projectPath, limit);
    return rows.map(deserializeKnowledge);
}
export function updateKnowledge(id, updates) {
    const db = getDb();
    const parts = ['updated_at = ?'];
    const params = [Date.now()];
    if (updates.content !== undefined) {
        parts.push('content = ?');
        params.push(updates.content);
    }
    if (updates.tags !== undefined) {
        parts.push('tags = ?');
        params.push(JSON.stringify(updates.tags));
    }
    if (updates.confidence !== undefined) {
        parts.push('confidence = ?');
        params.push(updates.confidence);
    }
    params.push(id);
    db.prepare(`UPDATE knowledge SET ${parts.join(', ')} WHERE id = ?`).run(...params);
}
export function deleteKnowledge(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM knowledge WHERE id = ?').run(id);
    return result.changes > 0;
}
export function countKnowledge(projectPath) {
    const db = getDb();
    if (projectPath) {
        const row = db.prepare('SELECT COUNT(*) as count FROM knowledge WHERE project_path = ?').get(projectPath);
        return row.count;
    }
    const row = db.prepare('SELECT COUNT(*) as count FROM knowledge').get();
    return row.count;
}
export function listKnowledge(projectPath, type, limit = 50) {
    const db = getDb();
    const conditions = [];
    const params = [];
    if (projectPath) {
        conditions.push('project_path = ?');
        params.push(projectPath);
    }
    if (type) {
        conditions.push('type = ?');
        params.push(type);
    }
    let sql = 'SELECT * FROM knowledge';
    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);
    const rows = db.prepare(sql).all(...params);
    return rows.map(deserializeKnowledge);
}
function deserializeKnowledge(row) {
    return {
        id: row['id'],
        type: row['type'],
        content: row['content'],
        source_observation_ids: JSON.parse(row['source_observation_ids'] || '[]'),
        source_knowledge_ids: JSON.parse(row['source_knowledge_ids'] || '[]'),
        conversation_id: row['conversation_id'],
        project_path: row['project_path'],
        tags: JSON.parse(row['tags'] || '[]'),
        confidence: row['confidence'],
        created_at: row['created_at'],
        updated_at: row['updated_at'],
    };
}
//# sourceMappingURL=knowledge.js.map