import { getStashedConversations, getStashGroups, createStashGroup, } from '../db/conversations.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('conversations:stash');
/**
 * Retrieve all stashed conversations along with their associated stash groups.
 */
export function getStashedSidebars(projectPath) {
    const conversations = getStashedConversations(projectPath);
    const groups = getStashGroups(projectPath);
    // Index groups by ID for fast lookup.
    const groupMap = new Map();
    for (const g of groups) {
        groupMap.set(g.id, g);
    }
    return conversations.map((conversation) => ({
        conversation,
        group: conversation.stash_group_id
            ? groupMap.get(conversation.stash_group_id) ?? null
            : null,
    }));
}
/**
 * Assign a conversation to a stash group based on its topic.
 *
 * For now this creates a simple stash group using the conversation topic
 * as the label. In the future this could use vector clustering to group
 * semantically related conversations together.
 *
 * @returns The stash group ID, or null if no topic is available.
 */
export async function assignToStashGroup(conversationId, projectPath) {
    // We import getConversation lazily to avoid a circular dep at module level.
    const { getConversation, stashConversation: stashConv } = await import('../db/conversations.js');
    const conversation = getConversation(conversationId);
    if (!conversation) {
        log.warn('Cannot assign to stash group: conversation not found', {
            conversationId,
        });
        return null;
    }
    const label = conversation.topic ?? 'Untitled';
    const group = createStashGroup(label, projectPath);
    // Also update the conversation's stash_group_id if it is currently stashed.
    if (conversation.status === 'stashed') {
        stashConv(conversationId, group.id);
    }
    log.info('Assigned conversation to stash group', {
        conversationId,
        groupId: group.id,
        label,
    });
    return group.id;
}
//# sourceMappingURL=stash.js.map