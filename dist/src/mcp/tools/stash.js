import { getStashedConversations, getStashGroups } from '../../db/conversations.js';
export async function handleStash(args) {
    const project = args['project'];
    const groupId = args['group'];
    let conversations = getStashedConversations(project);
    const groups = getStashGroups(project);
    // Filter by group if specified
    if (groupId) {
        conversations = conversations.filter(c => c.stash_group_id === groupId);
    }
    // Group conversations by stash_group_id
    const groupMap = new Map(groups.map(g => [g.id, g]));
    const grouped = [];
    // Conversations with groups
    const byGroup = new Map();
    const ungrouped = [];
    for (const conv of conversations) {
        if (conv.stash_group_id) {
            const existing = byGroup.get(conv.stash_group_id) || [];
            existing.push(conv);
            byGroup.set(conv.stash_group_id, existing);
        }
        else {
            ungrouped.push(conv);
        }
    }
    for (const [gId, convs] of byGroup) {
        const group = groupMap.get(gId);
        grouped.push({
            group: group ? { id: group.id, label: group.label } : null,
            conversations: convs.map(c => ({
                id: c.id,
                topic: c.topic,
                summary: c.summary,
                stashed_at: c.stashed_at ? new Date(c.stashed_at).toISOString() : null,
                observation_count: c.observation_count,
                session_id: c.session_id,
            })),
        });
    }
    if (ungrouped.length > 0) {
        grouped.push({
            group: null,
            conversations: ungrouped.map(c => ({
                id: c.id,
                topic: c.topic,
                summary: c.summary,
                stashed_at: c.stashed_at ? new Date(c.stashed_at).toISOString() : null,
                observation_count: c.observation_count,
                session_id: c.session_id,
            })),
        });
    }
    return {
        total: conversations.length,
        groups: grouped,
        hint: conversations.length > 0
            ? 'Use memory_resume with a conversation_id to pick up where you left off.'
            : 'No stashed sidebars found.',
    };
}
//# sourceMappingURL=stash.js.map