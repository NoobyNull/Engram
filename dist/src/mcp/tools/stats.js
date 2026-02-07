import fs from 'node:fs';
import { getDb } from '../../db/database.js';
import { getDbPath } from '../../shared/config.js';
import { countEmbeddings } from '../../db/vectors.js';
import { getPendingCount } from '../../embeddings/queue.js';
export async function handleStats(args) {
    const db = getDb();
    const project = args['project'];
    const whereProject = project ? ' WHERE project_path = ?' : '';
    const whereProjectId = project ? ' WHERE project_id = ?' : '';
    const params = project ? [project] : [];
    const observations = db.prepare(`SELECT COUNT(*) as c FROM observations${whereProject}`).get(...params).c;
    const knowledge = db.prepare(`SELECT COUNT(*) as c FROM knowledge${project ? ' WHERE project_path = ?' : ''}`).get(...params).c;
    const sessions = db.prepare(`SELECT COUNT(*) as c FROM sessions${whereProjectId}`).get(...params).c;
    const conversations = db.prepare(`SELECT COUNT(*) as c FROM conversations${whereProject}`).get(...params).c;
    const stashed = db.prepare(`SELECT COUNT(*) as c FROM conversations WHERE status = 'stashed'${project ? ' AND project_path = ?' : ''}`).get(...params).c;
    const projects = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
    const embeddings = countEmbeddings();
    const pendingEmbeddings = getPendingCount();
    // Storage size
    let storageBytes = 0;
    try {
        const dbPath = getDbPath();
        const stat = fs.statSync(dbPath);
        storageBytes = stat.size;
        // Also count WAL file
        try {
            const walStat = fs.statSync(dbPath + '-wal');
            storageBytes += walStat.size;
        }
        catch { /* WAL may not exist */ }
    }
    catch { /* DB may not exist yet */ }
    // Top tags
    const tagRows = db.prepare(`
    SELECT value as tag, COUNT(*) as count
    FROM observations, json_each(observations.tags)
    GROUP BY value ORDER BY count DESC LIMIT 10
  `).all();
    return {
        observations,
        knowledge,
        sessions,
        conversations,
        stashed,
        projects,
        embeddings,
        pendingEmbeddings,
        storageBytes,
        topTags: tagRows,
    };
}
//# sourceMappingURL=stats.js.map