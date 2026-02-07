import { hybridSearch } from '../../db/search.js';
import type { SearchOptions } from '../../shared/types.js';

export async function handleSearch(args: Record<string, unknown>): Promise<unknown> {
  const options: SearchOptions = {
    query: args['query'] as string,
    type: (args['type'] as SearchOptions['type']) || 'all',
    project: args['project'] as string | undefined,
    tags: args['tags'] as string[] | undefined,
    from_date: args['from_date'] as string | undefined,
    to_date: args['to_date'] as string | undefined,
    limit: (args['limit'] as number) || 20,
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
