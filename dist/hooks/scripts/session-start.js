import { getDb } from '../../src/db/database.js';
import { runRecovery } from '../../src/recovery/restore.js';
import { detectAndRegisterProject } from '../../src/projects/detector.js';
import { createSession, getRecentSessions } from '../../src/db/sessions.js';
import { getSessionConversations, getStashedConversations, createConversation } from '../../src/db/conversations.js';
import { getKnowledgeForProject } from '../../src/db/knowledge.js';
import { incrementProjectSessionCount } from '../../src/db/projects.js';
import { buildSessionStartContext } from '../../src/utils/context-builder.js';
import { getConfig } from '../../src/shared/config.js';
import { createLogger } from '../../src/shared/logger.js';
const log = createLogger('hook:session-start');
async function main() {
    // Read hook input from stdin
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
        // No input or invalid JSON — use defaults
    }
    const sessionId = input['session_id'] || undefined;
    const cwd = input['cwd'] || process.cwd();
    // Initialize database
    getDb();
    // Run recovery from any previous crash
    runRecovery();
    // Detect and register project
    const project = detectAndRegisterProject(cwd);
    incrementProjectSessionCount(project.id);
    const config = getConfig();
    // Create new session
    const session = createSession(project.id, sessionId);
    // Create first conversation
    createConversation(session.id, project.root_path);
    // Get recent sessions and their conversations
    const recentSessions = getRecentSessions(project.id, config.sessionHistoryDepth);
    const allConversations = recentSessions.flatMap(s => getSessionConversations(s.id));
    // Get stashed sidebars
    const stashedConversations = getStashedConversations(project.root_path);
    const stashedSidebars = stashedConversations.map(c => ({
        conversation: c,
        groupLabel: null,
    }));
    // Get knowledge for this project
    const knowledge = getKnowledgeForProject(project.root_path, 10);
    // Build context
    const context = buildSessionStartContext({
        project,
        recentSessions: recentSessions.filter(s => s.id !== session.id),
        conversations: allConversations,
        stashedSidebars,
        knowledge,
        maxTokens: config.maxContextTokens,
    });
    // Output context to stdout (injected into Claude's context)
    process.stdout.write(context);
    log.info('Session started', {
        sessionId: session.id,
        projectId: project.id,
        projectName: project.name,
    });
}
main().catch(err => {
    const log2 = createLogger('hook:session-start');
    log2.error('Session start hook failed', err);
    // Don't fail silently — but also don't block Claude
    process.exit(0);
});
//# sourceMappingURL=session-start.js.map