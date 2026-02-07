import { getDb } from '../../src/db/database.js';
import { detectProjectRoot } from '../../src/projects/detector.js';
import { getProjectByPath } from '../../src/db/projects.js';
import { getActiveSession, endSession } from '../../src/db/sessions.js';
import { getSessionConversations, completeConversation, stashConversation } from '../../src/db/conversations.js';
import { getObservationsBySession } from '../../src/db/observations.js';
import { summarizeConversation } from '../../src/conversations/summarizer.js';
import { processQueue } from '../../src/embeddings/queue.js';
import { summarizeObservations } from '../../src/utils/summarizer.js';
import { createLogger } from '../../src/shared/logger.js';
const log = createLogger('hook:session-end');
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
        // No input
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
    // Get all observations for this session
    const observations = getObservationsBySession(session.id);
    // Generate session summary
    const summary = summarizeObservations(observations);
    // Extract key actions and files
    const keyActions = [];
    const filesModified = new Set();
    for (const obs of observations) {
        if (obs.tool_name === 'Edit' || obs.tool_name === 'Write') {
            for (const f of obs.files_involved) {
                filesModified.add(f);
            }
            if (obs.tool_input_summary) {
                keyActions.push(obs.tool_input_summary);
            }
        }
    }
    // Summarize conversations
    const conversations = getSessionConversations(session.id);
    for (const conv of conversations) {
        try {
            if (conv.status === 'active') {
                // Generate summary before completing/stashing
                await summarizeConversation(conv.id);
                // Stash active conversations so they can be resumed in future sessions
                if (conv.observation_count > 0) {
                    stashConversation(conv.id);
                }
                else {
                    completeConversation(conv.id);
                }
            }
        }
        catch (err) {
            log.warn('Failed to summarize conversation', { id: conv.id, error: err });
        }
    }
    // End session
    endSession(session.id, summary, keyActions.slice(0, 20), [...filesModified]);
    // Process embedding queue (batch flush)
    try {
        const processed = await processQueue();
        if (processed > 0) {
            log.info('Processed embedding queue', { processed });
        }
    }
    catch (err) {
        log.warn('Embedding queue processing failed', err);
    }
    log.info('Session ended', {
        sessionId: session.id,
        observations: observations.length,
        conversations: conversations.length,
        filesModified: filesModified.size,
    });
}
main().catch(err => {
    const log2 = createLogger('hook:session-end');
    log2.error('Session end hook failed', err);
    process.exit(0);
});
//# sourceMappingURL=session-end.js.map