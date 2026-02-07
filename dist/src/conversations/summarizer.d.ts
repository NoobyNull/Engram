/**
 * Generate a summary for a conversation based on its observations.
 *
 * Tries Claude Haiku first; falls back to a simple extractive summary
 * built from the first/last observations, file paths, and key terms.
 *
 * The result is persisted to the database and returned.
 */
export declare function summarizeConversation(conversationId: string): Promise<string>;
