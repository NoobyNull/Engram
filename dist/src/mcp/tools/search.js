import { hybridSearch } from '../../db/search.js';
export async function handleSearch(args) {
    const options = {
        query: args['query'],
        type: args['type'] || 'all',
        project: args['project'],
        tags: args['tags'],
        from_date: args['from_date'],
        to_date: args['to_date'],
        limit: args['limit'] || 20,
    };
    const results = await hybridSearch(options.query, options);
    if (results.length === 0) {
        return { message: 'No memories found matching your query.', results: [] };
    }
    return {
        count: results.length,
        results: results.map(r => ({
            id: r.id,
            type: r.type,
            snippet: r.snippet,
            score: Math.round(r.score * 1000) / 1000,
            timestamp: new Date(r.timestamp).toISOString(),
            project: r.project_path,
            tags: r.tags,
        })),
    };
}
//# sourceMappingURL=search.js.map