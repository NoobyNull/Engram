import type { SearchResult, SearchOptions } from '../shared/types.js';
export declare function hybridSearch(query: string, options: SearchOptions, queryEmbedding?: number[]): Promise<SearchResult[]>;
