/**
 * Simple token estimation — approximately 0.75 tokens per word for English.
 * No external tokenizer dependency needed.
 */
export declare function estimateTokens(text: string): number;
export declare function truncateToTokens(text: string, maxTokens: number): string;
export declare function fitWithinBudget(items: Array<{
    text: string;
    priority: number;
}>, totalBudget: number): string[];
