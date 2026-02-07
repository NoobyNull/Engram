/**
 * Enqueues a text for embedding generation.
 * The item is inserted into the embedding_queue table with status 'pending'.
 */
export declare function enqueueEmbedding(sourceType: string, sourceId: string, textContent: string): void;
/**
 * Processes pending items in the embedding queue.
 * Fetches a batch of pending items, generates embeddings, and stores them.
 * Returns the number of successfully processed items.
 */
export declare function processQueue(batchSize?: number): Promise<number>;
/**
 * Returns the count of pending items in the embedding queue.
 */
export declare function getPendingCount(): number;
/**
 * Returns the count of errored items in the embedding queue.
 */
export declare function getErrorCount(): number;
