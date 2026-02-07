import type { Conversation, TopicShiftAction } from '../shared/types.js';
export interface TopicShiftResult {
    /** What action was taken. */
    action: TopicShiftAction;
    /** The now-active conversation. */
    conversation: Conversation;
    /** If action is 'ask', the suggestion text to inject into Claude's context. */
    suggestion: string | null;
    /** The raw score (for debugging). */
    score: number;
}
/**
 * Evaluate a potential topic shift and take the appropriate action
 * based on the adaptive three-tier system:
 *
 * - **ignore** (score < askThreshold): Same topic. Do nothing.
 * - **ask**    (askThreshold ≤ score < trustThreshold): Inject a suggestion.
 * - **trust**  (score ≥ trustThreshold): Auto-stash and start new conversation.
 */
export declare function handleTopicShift(sessionId: string, projectPath: string, projectId: string, newActivity: string): Promise<TopicShiftResult>;
/**
 * Get the active conversation for a session, creating one if none exists.
 */
export declare function ensureConversation(sessionId: string, projectPath: string, topic?: string): Conversation;
