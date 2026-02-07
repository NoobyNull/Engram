import { getDb } from '../../db/database.js';
import { detectProjectRoot } from '../../projects/detector.js';
import { getProjectByPath } from '../../db/projects.js';
import { getActiveSession } from '../../db/sessions.js';
import { getActiveConversation } from '../../db/conversations.js';
import { journaledInsertObservation } from '../../recovery/journal.js';
import { createLogger } from '../../shared/logger.js';
import type { HookInput } from '../../shared/types.js';

const log = createLogger('hook:pre-compact');

export async function handlePreCompact(input: HookInput): Promise<void> {
  const cwd = input.cwd || process.cwd();

  // Initialize database
  getDb();

  const projectRoot = detectProjectRoot(cwd);
  const project = getProjectByPath(projectRoot);
  if (!project) return;

  const session = getActiveSession(project.id);
  if (!session) return;

  const conversation = getActiveConversation(session.id);

  try {
    journaledInsertObservation({
      session_id: session.id,
      conversation_id: conversation?.id,
      tool_name: 'CompactionSnapshot',
      tool_input_summary: `Context compaction at ${new Date().toISOString()}`,
      tool_output_summary: `Session ${session.id}, conversation ${conversation?.id || 'none'}, ${session.observation_count} observations so far`,
      project_path: project.root_path,
      tags: ['compaction', 'snapshot'],
    });

    log.info('Compaction snapshot saved', { sessionId: session.id });
  } catch (err) {
    log.error('Failed to save compaction snapshot', err);
  }
}
