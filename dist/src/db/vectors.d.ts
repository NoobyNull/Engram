export declare function hashText(text: string): string;
export declare function storeEmbedding(sourceType: 'observation' | 'knowledge' | 'session', sourceId: string, text: string, embedding: number[]): boolean;
export interface VectorSearchResult {
    embedding_id: string;
    source_type: string;
    source_id: string;
    distance: number;
}
export declare function searchByVector(queryEmbedding: number[], limit?: number): VectorSearchResult[];
export declare function deleteEmbedding(sourceType: string, sourceId: string): boolean;
export declare function countEmbeddings(): number;
