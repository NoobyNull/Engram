import type { KnowledgeEdge, KnowledgeRelationship, KnowledgeChain, Knowledge } from '../shared/types.js';
export interface CreateEdgeInput {
    from_id: string;
    to_id: string;
    relationship: KnowledgeRelationship;
    strength?: number;
}
export declare function createEdge(input: CreateEdgeInput): KnowledgeEdge;
export declare function getEdge(id: string): KnowledgeEdge | null;
export declare function getEdgesFrom(knowledgeId: string): KnowledgeEdge[];
export declare function getEdgesTo(knowledgeId: string): KnowledgeEdge[];
export declare function getEdgesForNode(knowledgeId: string): KnowledgeEdge[];
export declare function deleteEdge(id: string): boolean;
export declare function deleteEdgesForNode(knowledgeId: string): number;
/**
 * Traverse the knowledge graph starting from `startId`, up to `maxDepth` layers.
 * Returns a KnowledgeChain with all discovered nodes and their connections.
 */
export declare function traverseGraph(startId: string, maxDepth?: number): KnowledgeChain | null;
/**
 * Find all knowledge items directly connected to the given node (depth 1).
 */
export declare function findConnected(knowledgeId: string): Knowledge[];
/**
 * Get the full reasoning chain from a discovery back to its source knowledge items.
 * Follows 'derives_from' edges backwards.
 */
export declare function getDerivationChain(discoveryId: string, maxDepth?: number): Knowledge[];
/**
 * Count edges in the graph, optionally for a specific node.
 */
export declare function countEdges(knowledgeId?: string): number;
