import { getDb } from '../../src/db/database.js';
import { detectProjectRoot } from '../../src/projects/detector.js';
import { getActiveSession } from '../../src/db/sessions.js';
import { getProjectByPath } from '../../src/db/projects.js';
import { handleTopicShift } from '../../src/conversations/grouper.js';
import { createLogger } from '../../src/shared/logger.js';
const log = createLogger('hook:user-prompt');
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
    const prompt = input['prompt'] || '';
    const cwd = input['cwd'] || process.cwd();
    if (!prompt)
        return;
    // Initialize database
    getDb();
    const projectRoot = detectProjectRoot(cwd);
    const project = getProjectByPath(projectRoot);
    if (!project)
        return;
    const session = getActiveSession(project.id);
    if (!session)
        return;
    // Run topic shift detection with three-tier scoring
    try {
        const result = await handleTopicShift(session.id, project.root_path, project.id, prompt);
        switch (result.action) {
            case 'ignore':
                // Same topic — nothing to output
                break;
            case 'ask':
                // Inject suggestion into Claude's context via stdout
                if (result.suggestion) {
                    process.stdout.write(result.suggestion);
                }
                log.info('Topic shift suggestion shown', {
                    sessionId: session.id,
                    score: result.score.toFixed(3),
                    currentTopic: result.conversation.topic,
                });
                break;
            case 'trust':
                // Auto-stashed — log it
                log.info('Topic auto-stashed', {
                    sessionId: session.id,
                    score: result.score.toFixed(3),
                    newTopic: result.conversation.topic,
                });
                break;
        }
    }
    catch (err) {
        log.warn('Topic shift detection failed', err);
    }
}
main().catch(err => {
    const log2 = createLogger('hook:user-prompt');
    log2.error('User prompt hook failed', err);
    process.exit(0);
});
//# sourceMappingURL=user-prompt.js.map