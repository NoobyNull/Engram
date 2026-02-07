import { createKnowledge } from '../../db/knowledge.js';
import { enqueueEmbedding } from '../../embeddings/queue.js';
import type { KnowledgeType } from '../../shared/types.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('mcp:save');

export async function handleSave(args: Record<string, unknown>): Promise<unknown> {
  const content = args['content'] as string;
  const type = args['type'] as KnowledgeType;
  const tags = (args['tags'] as string[]) || [];
  const project = args['project'] as string | undefined;
  const sourceKnowledgeIds = (args['source_knowledge_ids'] as string[]) || [];

  const knowledge = createKnowledge({
    type,
    content,
    tags,
    project_path: project,
    source_knowledge_ids: sourceKnowledgeIds,
  });

  // Queue for embedding
  enqueueEmbedding('knowledge', knowledge.id, content);

  // Fire-and-forget: trigger discovery engine to create graph edges
  import('../../sdk/discovery-engine.js')
    .then(({ onKnowledgeCreated }) => onKnowledgeCreated(knowledge))
    .then(edges => {
      if (edges.length > 0) {
        log.info('Discovery engine created edges', { knowledgeId: knowledge.id, edgeCount: edges.length });
      }
    })
    .catch(err => log.debug('Discovery engine skipped', { error: String(err) }));

  return {
    message: `Knowledge saved successfully.`,
    id: knowledge.id,
    type: knowledge.type,
  };
}
