import type { Conversation, StashGroup } from '../shared/types.js';
/**
 * Retrieve all stashed conversations along with their associated stash groups.
 */
export declare function getStashedSidebars(projectPath?: string): Array<{
    conversation: Conversation;
    group: StashGroup | null;
}>;
/**
 * Assign a conversation to a stash group based on its topic.
 *
 * For now this creates a simple stash group using the conversation topic
 * as the label. In the future this could use vector clustering to group
 * semantically related conversations together.
 *
 * @returns The stash group ID, or null if no topic is available.
 */
export declare function assignToStashGroup(conversationId: string, projectPath: string): Promise<string | null>;
