import { deleteObservation, deleteObservationsByQuery } from '../../db/observations.js';
import { deleteKnowledge } from '../../db/knowledge.js';
import { deleteEmbedding } from '../../db/vectors.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('mcp:forget');

export async function handleForget(args: Record<string, unknown>): Promise<unknown> {
  const ids = args['ids'] as string[] | undefined;
  const query = args['query'] as string | undefined;
  const beforeDate = args['before_date'] as string | undefined;

  let deleted = 0;

  // Delete by specific IDs
  if (ids && ids.length > 0) {
    for (const id of ids) {
      let success = false;
      if (id.startsWith('obs_') || id.startsWith('sch_')) {
        success = deleteObservation(id);
        if (success) deleteEmbedding('observation', id);
      } else if (id.startsWith('kn_')) {
        success = deleteKnowledge(id);
        if (success) deleteEmbedding('knowledge', id);
      }
      // Could also handle session/conversation deletion
      if (success) deleted++;
    }
  }

  // Delete by search query
  if (query) {
    const beforeTimestamp = beforeDate ? new Date(beforeDate).getTime() : undefined;
    deleted += deleteObservationsByQuery(query, beforeTimestamp);
  }

  log.info('Forget operation', { deleted, ids: ids?.length, query });

  return {
    message: deleted > 0
      ? `Deleted ${deleted} memory item(s).`
      : 'No matching memories found to delete.',
    deleted,
  };
}
