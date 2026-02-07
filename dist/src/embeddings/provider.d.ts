/**
 * Embedding provider interface for ClauDEX.
 * All embedding backends must implement this contract.
 */
export interface EmbeddingProvider {
    embed(texts: string[]): Promise<number[][]>;
    readonly dimensions: number;
    readonly available: boolean;
}
