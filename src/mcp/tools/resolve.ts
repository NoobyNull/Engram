import { getObservation, deleteObservation } from '../../db/observations.js';
import { getKnowledge, updateKnowledge } from '../../db/knowledge.js';
import { handleSave } from './save.js';
import { deleteEmbedding } from '../../db/vectors.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('mcp:resolve');

export type ResolutionAction = 'merge' | 'keep_both' | 'replace' | 'skip';

export async function handleResolve(args: Record<string, unknown>): Promise<unknown> {
  const conflictId = args['conflict_id'] as string;
  const existingId = args['existing_id'] as string | undefined;
  const action = args['action'] as ResolutionAction;

  if (!conflictId || !action) {
    return { error: 'Both conflict_id and action are required.' };
  }

  const validActions: ResolutionAction[] = ['merge', 'keep_both', 'replace', 'skip'];
  if (!validActions.includes(action)) {
    return { error: `Invalid action "${action}". Must be one of: ${validActions.join(', ')}` };
  }

  log.info('Resolving memory conflict', { conflictId, existingId, action });

  switch (action) {
    case 'keep_both':
      // Nothing to do — both are already saved
      return {
        message: 'Both memories kept as separate items.',
        action: 'keep_both',
        new_id: conflictId,
        existing_id: existingId,
      };

    case 'skip':
      // Delete the new observation — user doesn't want it
      if (conflictId.startsWith('obs_')) {
        deleteObservation(conflictId);
        deleteEmbedding('observation', conflictId);
      }
      return {
        message: 'New observation discarded.',
        action: 'skip',
        deleted_id: conflictId,
      };

    case 'merge': {
      // Merge the new observation into the existing memory
      const newObs = conflictId.startsWith('obs_') ? getObservation(conflictId) : null;
      if (!newObs) {
        return { error: `Could not find observation ${conflictId}` };
      }

      if (existingId?.startsWith('kn_')) {
        // Merge into existing knowledge — append new info
        const existing = getKnowledge(existingId);
        if (existing) {
          const newContent = [newObs.tool_input_summary, newObs.tool_output_summary]
            .filter(Boolean)
            .join(' — ');
          const merged = `${existing.content}\n[Updated] ${newContent}`;
          const mergedTags = [...new Set([...existing.tags, ...newObs.tags])];
          updateKnowledge(existingId, {
            content: merged,
            tags: mergedTags,
          });
          // Remove the duplicate observation
          deleteObservation(conflictId);
          deleteEmbedding('observation', conflictId);
          return {
            message: `Merged into existing knowledge: ${existingId}`,
            action: 'merge',
            merged_into: existingId,
            deleted_id: conflictId,
          };
        }
      }

      if (existingId?.startsWith('obs_')) {
        // Merge two observations — keep the existing, enrich its tags, delete new
        const existingObs = getObservation(existingId);
        if (existingObs) {
          // Can't easily merge observation content (it's in the DB), so just
          // delete the duplicate and keep the original
          deleteObservation(conflictId);
          deleteEmbedding('observation', conflictId);
          return {
            message: `Duplicate removed. Keeping existing observation: ${existingId}`,
            action: 'merge',
            merged_into: existingId,
            deleted_id: conflictId,
          };
        }
      }

      // Fallback — just save as knowledge extracted from the observation
      const content = [newObs.tool_input_summary, newObs.tool_output_summary]
        .filter(Boolean)
        .join(' — ');
      const result = await handleSave({
        content,
        type: 'fact',
        tags: newObs.tags,
        project: newObs.project_path,
      });
      deleteObservation(conflictId);
      deleteEmbedding('observation', conflictId);
      return {
        message: 'Merged into new knowledge item.',
        action: 'merge',
        new_knowledge: result,
        deleted_id: conflictId,
      };
    }

    case 'replace': {
      // Replace the old memory with the new observation's content
      const newObs = conflictId.startsWith('obs_') ? getObservation(conflictId) : null;
      if (!newObs) {
        return { error: `Could not find observation ${conflictId}` };
      }

      if (existingId?.startsWith('kn_')) {
        const existing = getKnowledge(existingId);
        if (existing) {
          const newContent = [newObs.tool_input_summary, newObs.tool_output_summary]
            .filter(Boolean)
            .join(' — ');
          updateKnowledge(existingId, {
            content: newContent,
            tags: [...new Set([...existing.tags, ...newObs.tags])],
          });
          deleteObservation(conflictId);
          deleteEmbedding('observation', conflictId);
          return {
            message: `Replaced existing knowledge ${existingId} with new information.`,
            action: 'replace',
            updated_id: existingId,
            deleted_id: conflictId,
          };
        }
      }

      if (existingId?.startsWith('obs_')) {
        // Delete the old observation, keep the new one
        deleteObservation(existingId);
        deleteEmbedding('observation', existingId);
        return {
          message: `Replaced old observation. Keeping: ${conflictId}`,
          action: 'replace',
          kept_id: conflictId,
          deleted_id: existingId,
        };
      }

      return {
        message: 'New observation kept (no existing memory to replace).',
        action: 'replace',
        kept_id: conflictId,
      };
    }
  }
}
