import { getDb, generateId } from './database.js';
import type { KnowledgeEdge, KnowledgeRelationship, KnowledgeGraphNode, KnowledgeChain, Knowledge } from '../shared/types.js';
import { getKnowledge } from './knowledge.js';
import { createLogger } from '../shared/logger.js';
import { getConfig } from '../shared/config.js';

const log = createLogger('db:knowledge-graph');

// ---------------------------------------------------------------------------
// Edge CRUD
// ---------------------------------------------------------------------------

export interface CreateEdgeInput {
  from_id: string;
  to_id: string;
  relationship: KnowledgeRelationship;
  strength?: number;
}

export function createEdge(input: CreateEdgeInput): KnowledgeEdge {
  const db = getDb();
  const id = generateId('edge');
  const now = Date.now();

  db.prepare(`
    INSERT INTO knowledge_edges (id, from_id, to_id, relationship, strength, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.from_id, input.to_id, input.relationship, input.strength ?? 1.0, now);

  log.info('Created edge', { id, from: input.from_id, to: input.to_id, rel: input.relationship });
  return {
    id,
    from_id: input.from_id,
    to_id: input.to_id,
    relationship: input.relationship,
    strength: input.strength ?? 1.0,
    created_at: now,
  };
}

export function getEdge(id: string): KnowledgeEdge | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM knowledge_edges WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return deserializeEdge(row);
}

export function getEdgesFrom(knowledgeId: string): KnowledgeEdge[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM knowledge_edges WHERE from_id = ? ORDER BY strength DESC').all(knowledgeId) as Record<string, unknown>[];
  return rows.map(deserializeEdge);
}

export function getEdgesTo(knowledgeId: string): KnowledgeEdge[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM knowledge_edges WHERE to_id = ? ORDER BY strength DESC').all(knowledgeId) as Record<string, unknown>[];
  return rows.map(deserializeEdge);
}

export function getEdgesForNode(knowledgeId: string): KnowledgeEdge[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM knowledge_edges WHERE from_id = ? OR to_id = ? ORDER BY strength DESC'
  ).all(knowledgeId, knowledgeId) as Record<string, unknown>[];
  return rows.map(deserializeEdge);
}

export function deleteEdge(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM knowledge_edges WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteEdgesForNode(knowledgeId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM knowledge_edges WHERE from_id = ? OR to_id = ?').run(knowledgeId, knowledgeId);
  return result.changes;
}

// ---------------------------------------------------------------------------
// Graph traversal — depth-limited BFS
// ---------------------------------------------------------------------------

/**
 * Traverse the knowledge graph starting from `startId`, up to `maxDepth` layers.
 * Returns a KnowledgeChain with all discovered nodes and their connections.
 */
export function traverseGraph(startId: string, maxDepth?: number): KnowledgeChain | null {
  const config = getConfig();
  const depth = maxDepth ?? config.knowledgeGraph?.maxDepth ?? 5;

  const root = getKnowledge(startId);
  if (!root) return null;

  const visited = new Set<string>();
  const nodes: KnowledgeGraphNode[] = [];
  let hitMax = false;

  // BFS queue: [knowledgeId, currentDepth]
  const queue: Array<[string, number]> = [[startId, 0]];
  visited.add(startId);

  while (queue.length > 0) {
    const [nodeId, currentDepth] = queue.shift()!;

    const knowledge = nodeId === startId ? root : getKnowledge(nodeId);
    if (!knowledge) continue;

    const edges = getEdgesForNode(nodeId);

    nodes.push({ knowledge, edges, depth: currentDepth });

    if (currentDepth >= depth) {
      hitMax = true;
      continue; // Don't expand further
    }

    // Enqueue connected nodes not yet visited
    for (const edge of edges) {
      const neighborId = edge.from_id === nodeId ? edge.to_id : edge.from_id;
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push([neighborId, currentDepth + 1]);
      }
    }
  }

  return { root, nodes, maxDepthReached: hitMax };
}

/**
 * Find all knowledge items directly connected to the given node (depth 1).
 */
export function findConnected(knowledgeId: string): Knowledge[] {
  const edges = getEdgesForNode(knowledgeId);
  const connectedIds = new Set<string>();
  for (const edge of edges) {
    if (edge.from_id !== knowledgeId) connectedIds.add(edge.from_id);
    if (edge.to_id !== knowledgeId) connectedIds.add(edge.to_id);
  }

  const results: Knowledge[] = [];
  for (const id of connectedIds) {
    const kn = getKnowledge(id);
    if (kn) results.push(kn);
  }
  return results;
}

/**
 * Get the full reasoning chain from a discovery back to its source knowledge items.
 * Follows 'derives_from' edges backwards.
 */
export function getDerivationChain(discoveryId: string, maxDepth?: number): Knowledge[] {
  const config = getConfig();
  const limit = maxDepth ?? config.knowledgeGraph?.maxDepth ?? 5;

  const chain: Knowledge[] = [];
  const visited = new Set<string>();
  const queue: string[] = [discoveryId];
  visited.add(discoveryId);

  let depth = 0;
  while (queue.length > 0 && depth < limit) {
    const nextQueue: string[] = [];
    for (const nodeId of queue) {
      const edges = getEdgesFrom(nodeId).filter(e => e.relationship === 'derives_from');
      for (const edge of edges) {
        if (!visited.has(edge.to_id)) {
          visited.add(edge.to_id);
          const kn = getKnowledge(edge.to_id);
          if (kn) {
            chain.push(kn);
            nextQueue.push(edge.to_id);
          }
        }
      }
    }
    queue.length = 0;
    queue.push(...nextQueue);
    depth++;
  }

  return chain;
}

/**
 * Count edges in the graph, optionally for a specific node.
 */
export function countEdges(knowledgeId?: string): number {
  const db = getDb();
  if (knowledgeId) {
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM knowledge_edges WHERE from_id = ? OR to_id = ?'
    ).get(knowledgeId, knowledgeId) as { count: number };
    return row.count;
  }
  const row = db.prepare('SELECT COUNT(*) as count FROM knowledge_edges').get() as { count: number };
  return row.count;
}

function deserializeEdge(row: Record<string, unknown>): KnowledgeEdge {
  return {
    id: row['id'] as string,
    from_id: row['from_id'] as string,
    to_id: row['to_id'] as string,
    relationship: row['relationship'] as KnowledgeRelationship,
    strength: row['strength'] as number,
    created_at: row['created_at'] as number,
  };
}
