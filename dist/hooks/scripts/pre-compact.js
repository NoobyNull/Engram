import { getDb } from '../../src/db/database.js';
import { detectProjectRoot } from '../../src/projects/detector.js';
import { getProjectByPath } from '../../src/db/projects.js';
import { getActiveSession } from '../../src/db/sessions.js';
import { getActiveConversation } from '../../src/db/conversations.js';
import { journaledInsertObservation } from '../../src/recovery/journal.js';
import { createLogger } from '../../src/shared/logger.js';
const log = createLogger('hook:pre-compact');
async function main() {
    let input = {};
    try {
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        if (raw) {
            input = JSON.parse(raw);
        }
    }
    catch {
        return;
    }
    const cwd = input['cwd'] || process.cwd();
    // Initialize database
    getDb();
    const projectRoot = detectProjectRoot(cwd);
    const project = getProjectByPath(projectRoot);
    if (!project)
        return;
    const session = getActiveSession(project.id);
    if (!session)
        return;
    const conversation = getActiveConversation(session.id);
    // Save a compaction snapshot — this preserves key context before
    // Claude compresses the conversation window
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
    }
    catch (err) {
        log.error('Failed to save compaction snapshot', err);
    }
}
main().catch(err => {
    const log2 = createLogger('hook:pre-compact');
    log2.error('Pre-compact hook failed', err);
    process.exit(0);
});
//# sourceMappingURL=pre-compact.js.map