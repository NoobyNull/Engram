import type { Knowledge, KnowledgeEdge } from '../shared/types.js';
/**
 * When new knowledge is saved, search for related existing knowledge that
 * could combine to form a discovery. If the SDK query() function is available,
 * uses a Haiku subagent to reason about combinations. Otherwise, creates
 * structural edges based on search similarity.
 */
export declare function onKnowledgeCreated(knowledge: Knowledge): Promise<KnowledgeEdge[]>;
