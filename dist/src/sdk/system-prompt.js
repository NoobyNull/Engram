import { getRecentSessions } from '../db/sessions.js';
import { getSessionConversations, getStashedConversations } from '../db/conversations.js';
import { getKnowledgeForProject } from '../db/knowledge.js';
import { buildSessionStartContext } from '../utils/context-builder.js';
import { getConfig } from '../shared/config.js';
/**
 * Build the system prompt context that gets injected via the SDK `systemPrompt` option.
 * Replaces the old stdout-based context injection from the SessionStart hook.
 */
export function buildSystemPromptContext(project) {
    const config = getConfig();
    const recentSessions = getRecentSessions(project.id, config.sessionHistoryDepth);
    const allConversations = recentSessions.flatMap(s => getSessionConversations(s.id));
    const stashedConversations = getStashedConversations(project.root_path);
    const stashedSidebars = stashedConversations.map(c => ({
        conversation: c,
        groupLabel: null,
    }));
    const knowledge = getKnowledgeForProject(project.root_path, 10);
    return buildSessionStartContext({
        project,
        recentSessions,
        conversations: allConversations,
        stashedSidebars,
        knowledge,
        maxTokens: config.maxContextTokens,
    });
}
//# sourceMappingURL=system-prompt.js.map