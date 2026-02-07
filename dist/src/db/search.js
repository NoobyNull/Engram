import { getDb, isVectorsAvailable } from './database.js';
import { getConfig } from '../shared/config.js';
import { searchByVector } from './vectors.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('db:search');
function searchFts(query, options) {
    const db = getDb();
    const results = [];
    const ftsQuery = sanitizeFtsQuery(query);
    if (!ftsQuery)
        return results;
    const limit = options.limit || 20;
    const typeFilter = options.type || 'all';
    // Search observations
    if (typeFilter === 'all' || typeFilter === 'observations') {
        try {
            let sql = `
        SELECT o.id, o.tool_input_summary, o.tool_output_summary, o.timestamp,
               o.project_path, o.tags, rank
        FROM observations_fts f
        JOIN observations o ON o.rowid = f.rowid
        WHERE observations_fts MATCH ?
      `;
            const params = [ftsQuery];
            if (options.project) {
                sql += ' AND o.project_path = ?';
                params.push(options.project);
            }
            if (options.from_date) {
                sql += ' AND o.timestamp >= ?';
                params.push(new Date(options.from_date).getTime());
            }
            if (options.to_date) {
                sql += ' AND o.timestamp <= ?';
                params.push(new Date(options.to_date).getTime());
            }
            sql += ' ORDER BY rank LIMIT ?';
            params.push(limit);
            const rows = db.prepare(sql).all(...params);
            for (const row of rows) {
                results.push({
                    id: row['id'],
                    type: 'observation',
                    snippet: truncate(row['tool_input_summary'] || row['tool_output_summary'] || '', 200),
                    rank: row['rank'],
                    timestamp: row['timestamp'],
                    project_path: row['project_path'],
                    tags: row['tags'] || '[]',
                });
            }
        }
        catch (err) {
            log.warn('FTS search on observations failed', err);
        }
    }
    // Search knowledge
    if (typeFilter === 'all' || typeFilter === 'knowledge') {
        try {
            let sql = `
        SELECT k.id, k.content, k.created_at, k.project_path, k.tags, rank
        FROM knowledge_fts f
        JOIN knowledge k ON k.rowid = f.rowid
        WHERE knowledge_fts MATCH ?
      `;
            const params = [ftsQuery];
            if (options.project) {
                sql += ' AND k.project_path = ?';
                params.push(options.project);
            }
            sql += ' ORDER BY rank LIMIT ?';
            params.push(limit);
            const rows = db.prepare(sql).all(...params);
            for (const row of rows) {
                results.push({
                    id: row['id'],
                    type: 'knowledge',
                    snippet: truncate(row['content'], 200),
                    rank: row['rank'],
                    timestamp: row['created_at'],
                    project_path: row['project_path'],
                    tags: row['tags'] || '[]',
                });
            }
        }
        catch (err) {
            log.warn('FTS search on knowledge failed', err);
        }
    }
    // Search sessions
    if (typeFilter === 'all' || typeFilter === 'sessions') {
        try {
            let sql = `
        SELECT s.id, s.summary, s.started_at, s.project_id, s.key_actions, rank
        FROM sessions_fts f
        JOIN sessions s ON s.rowid = f.rowid
        WHERE sessions_fts MATCH ?
      `;
            const params = [ftsQuery];
            sql += ' ORDER BY rank LIMIT ?';
            params.push(limit);
            const rows = db.prepare(sql).all(...params);
            for (const row of rows) {
                results.push({
                    id: row['id'],
                    type: 'session',
                    snippet: truncate(row['summary'] || '', 200),
                    rank: row['rank'],
                    timestamp: row['started_at'],
                    project_path: row['project_id'],
                    tags: '[]',
                });
            }
        }
        catch (err) {
            log.warn('FTS search on sessions failed', err);
        }
    }
    // Search conversations
    if (typeFilter === 'all' || typeFilter === 'conversations') {
        try {
            let sql = `
        SELECT c.id, c.topic, c.summary, c.started_at, c.project_path, rank
        FROM conversations_fts f
        JOIN conversations c ON c.rowid = f.rowid
        WHERE conversations_fts MATCH ?
      `;
            const params = [ftsQuery];
            if (options.project) {
                sql += ' AND c.project_path = ?';
                params.push(options.project);
            }
            sql += ' ORDER BY rank LIMIT ?';
            params.push(limit);
            const rows = db.prepare(sql).all(...params);
            for (const row of rows) {
                results.push({
                    id: row['id'],
                    type: 'conversation',
                    snippet: truncate(row['topic'] || row['summary'] || '', 200),
                    rank: row['rank'],
                    timestamp: row['started_at'],
                    project_path: row['project_path'],
                    tags: '[]',
                });
            }
        }
        catch (err) {
            log.warn('FTS search on conversations failed', err);
        }
    }
    return results;
}
export async function hybridSearch(query, options, queryEmbedding) {
    const config = getConfig();
    const weights = config.search;
    const limit = options.limit || 20;
    // FTS search
    const ftsResults = searchFts(query, options);
    // Normalize FTS scores (BM25 rank is negative, lower is better)
    const maxFtsRank = Math.max(...ftsResults.map(r => Math.abs(r.rank)), 1);
    const ftsScoreMap = new Map();
    for (const r of ftsResults) {
        ftsScoreMap.set(r.id, 1 - Math.abs(r.rank) / maxFtsRank);
    }
    // Vector search (if available and embedding provided)
    const vectorScoreMap = new Map();
    if (queryEmbedding && isVectorsAvailable()) {
        const vecResults = searchByVector(queryEmbedding, limit * 2);
        const maxDist = Math.max(...vecResults.map(r => r.distance), 1);
        for (const r of vecResults) {
            vectorScoreMap.set(r.source_id, 1 - r.distance / maxDist);
        }
    }
    // Merge all candidate IDs
    const allIds = new Set([...ftsScoreMap.keys(), ...vectorScoreMap.keys()]);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    // Build final results with score fusion
    const resultMap = new Map();
    for (const r of ftsResults) {
        resultMap.set(r.id, r);
    }
    const scored = [];
    for (const id of allIds) {
        const ftsScore = ftsScoreMap.get(id) || 0;
        const vecScore = vectorScoreMap.get(id) || 0;
        // Get metadata from FTS results or fetch minimal info
        const ftsResult = resultMap.get(id);
        const timestamp = ftsResult?.timestamp || now;
        const ageInDays = (now - timestamp) / dayMs;
        const recencyBonus = Math.exp(-ageInDays / 30); // Exponential decay, 30-day half-life
        const projectPath = ftsResult?.project_path || null;
        const projectAffinity = (options.project && projectPath === options.project) ? 1 : 0;
        const finalScore = weights.ftsWeight * ftsScore +
            weights.vectorWeight * vecScore +
            weights.recencyWeight * recencyBonus +
            weights.projectAffinityWeight * projectAffinity;
        // Filter by tags if specified
        if (options.tags && options.tags.length > 0 && ftsResult) {
            const itemTags = JSON.parse(ftsResult.tags || '[]');
            if (!options.tags.some(t => itemTags.includes(t)))
                continue;
        }
        scored.push({
            id,
            type: ftsResult?.type || 'observation',
            snippet: ftsResult?.snippet || '',
            score: finalScore,
            timestamp,
            project_path: projectPath,
            tags: ftsResult ? JSON.parse(ftsResult.tags || '[]') : [],
            metadata: {},
        });
    }
    // Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
}
function sanitizeFtsQuery(query) {
    // Remove special FTS5 characters that could cause parse errors
    // Allow basic words and double quotes for phrase matching
    return query
        .replace(/[*(){}[\]^~!@#$%&=+|\\<>;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function truncate(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    return text.substring(0, maxLen - 3) + '...';
}
//# sourceMappingURL=search.js.map