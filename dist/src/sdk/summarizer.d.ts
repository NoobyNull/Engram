/**
 * Summarize a session using query()-based approach when available,
 * falling back to extractive summarization.
 */
export declare function sdkSummarizeSession(sessionId: string): Promise<string>;
/**
 * Summarize a conversation using query()-based approach when available.
 */
export declare function sdkSummarizeConversation(conversationId: string): Promise<string>;
/**
 * Extract knowledge items from a set of observations using query().
 */
export declare function sdkExtractKnowledge(sessionId: string): Promise<Array<{
    type: string;
    content: string;
    tags: string[];
}>>;
