import { getDb, generateId } from './database.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('db:projects');
export function createProject(rootPath, name, stack = []) {
    const db = getDb();
    const now = Date.now();
    const id = generateId('proj');
    db.prepare(`
    INSERT INTO projects (id, root_path, name, detected_stack, first_seen, last_seen, session_count, observation_count)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0)
  `).run(id, rootPath, name, JSON.stringify(stack), now, now);
    log.info('Created project', { id, rootPath, name });
    return {
        id, root_path: rootPath, name, detected_stack: stack,
        first_seen: now, last_seen: now, session_count: 0, observation_count: 0,
    };
}
export function getProjectByPath(rootPath) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM projects WHERE root_path = ?').get(rootPath);
    if (!row)
        return null;
    return deserializeProject(row);
}
export function getProjectById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!row)
        return null;
    return deserializeProject(row);
}
export function updateProjectLastSeen(id) {
    const db = getDb();
    db.prepare('UPDATE projects SET last_seen = ? WHERE id = ?').run(Date.now(), id);
}
export function incrementProjectSessionCount(id) {
    const db = getDb();
    db.prepare('UPDATE projects SET session_count = session_count + 1 WHERE id = ?').run(id);
}
export function incrementProjectObservationCount(id) {
    const db = getDb();
    db.prepare('UPDATE projects SET observation_count = observation_count + 1 WHERE id = ?').run(id);
}
export function updateProjectStack(id, stack) {
    const db = getDb();
    db.prepare('UPDATE projects SET detected_stack = ? WHERE id = ?').run(JSON.stringify(stack), id);
}
export function getOrCreateProject(rootPath, name, stack = []) {
    const existing = getProjectByPath(rootPath);
    if (existing) {
        updateProjectLastSeen(existing.id);
        return existing;
    }
    return createProject(rootPath, name, stack);
}
export function listProjects() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM projects ORDER BY last_seen DESC').all();
    return rows.map(deserializeProject);
}
function deserializeProject(row) {
    return {
        id: row['id'],
        root_path: row['root_path'],
        name: row['name'] || '',
        detected_stack: JSON.parse(row['detected_stack'] || '[]'),
        first_seen: row['first_seen'],
        last_seen: row['last_seen'],
        session_count: row['session_count'],
        observation_count: row['observation_count'],
    };
}
//# sourceMappingURL=projects.js.map