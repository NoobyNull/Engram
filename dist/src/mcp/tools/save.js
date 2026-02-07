import { createKnowledge } from '../../db/knowledge.js';
import { enqueueEmbedding } from '../../embeddings/queue.js';
import { createLogger } from '../../shared/logger.js';
const log = createLogger('mcp:save');
export async function handleSave(args) {
    const content = args['content'];
    const type = args['type'];
    const tags = args['tags'] || [];
    const project = args['project'];
    const sourceKnowledgeIds = args['source_knowledge_ids'] || [];
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
//# sourceMappingURL=save.js.map