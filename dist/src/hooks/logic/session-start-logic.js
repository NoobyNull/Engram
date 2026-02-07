import { getDb } from '../../db/database.js';
import { runRecovery } from '../../recovery/restore.js';
import { detectAndRegisterProject } from '../../projects/detector.js';
import { createSession, getRecentSessions } from '../../db/sessions.js';
import { getSessionConversations, getStashedConversations, createConversation } from '../../db/conversations.js';
import { getKnowledgeForProject } from '../../db/knowledge.js';
import { incrementProjectSessionCount } from '../../db/projects.js';
import { buildSessionStartContext } from '../../utils/context-builder.js';
import { getConfig } from '../../shared/config.js';
import { createLogger } from '../../shared/logger.js';
const log = createLogger('hook:session-start');
export async function handleSessionStart(input) {
    const sessionId = input.session_id || undefined;
    const cwd = input.cwd || process.cwd();
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
    log.info('Session started', {
        sessionId: session.id,
        projectId: project.id,
        projectName: project.name,
    });
    return { context, session, project };
}
//# sourceMappingURL=session-start-logic.js.map