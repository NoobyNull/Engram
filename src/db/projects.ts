import { getDb, generateId } from './database.js';
import type { Project } from '../shared/types.js';
import { createLogger } from '../shared/logger.js';

const log = createLogger('db:projects');

export function createProject(rootPath: string, name: string, stack: string[] = []): Project {
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

export function getProjectByPath(rootPath: string): Project | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE root_path = ?').get(rootPath) as Record<string, unknown> | undefined;
  if (!row) return null;
  return deserializeProject(row);
}

export function getProjectById(id: string): Project | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return deserializeProject(row);
}

export function updateProjectLastSeen(id: string): void {
  const db = getDb();
  db.prepare('UPDATE projects SET last_seen = ? WHERE id = ?').run(Date.now(), id);
}

export function incrementProjectSessionCount(id: string): void {
  const db = getDb();
  db.prepare('UPDATE projects SET session_count = session_count + 1 WHERE id = ?').run(id);
}

export function incrementProjectObservationCount(id: string): void {
  const db = getDb();
  db.prepare('UPDATE projects SET observation_count = observation_count + 1 WHERE id = ?').run(id);
}

export function updateProjectStack(id: string, stack: string[]): void {
  const db = getDb();
  db.prepare('UPDATE projects SET detected_stack = ? WHERE id = ?').run(JSON.stringify(stack), id);
}

export function getOrCreateProject(rootPath: string, name: string, stack: string[] = []): Project {
  const existing = getProjectByPath(rootPath);
  if (existing) {
    updateProjectLastSeen(existing.id);
    return existing;
  }
  return createProject(rootPath, name, stack);
}

export function listProjects(): Project[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects ORDER BY last_seen DESC').all() as Record<string, unknown>[];
  return rows.map(deserializeProject);
}

function deserializeProject(row: Record<string, unknown>): Project {
  return {
    id: row['id'] as string,
    root_path: row['root_path'] as string,
    name: (row['name'] as string) || '',
    detected_stack: JSON.parse((row['detected_stack'] as string) || '[]'),
    first_seen: row['first_seen'] as number,
    last_seen: row['last_seen'] as number,
    session_count: row['session_count'] as number,
    observation_count: row['observation_count'] as number,
  };
}
