import type { Knowledge, KnowledgeType } from '../shared/types.js';
export interface CreateKnowledgeInput {
    type: KnowledgeType;
    content: string;
    source_observation_ids?: string[];
    source_knowledge_ids?: string[];
    conversation_id?: string;
    project_path?: string;
    tags?: string[];
    confidence?: number;
}
export declare function createKnowledge(input: CreateKnowledgeInput): Knowledge;
export declare function getKnowledge(id: string): Knowledge | null;
export declare function getKnowledgeByType(type: KnowledgeType, projectPath?: string, limit?: number): Knowledge[];
export declare function getKnowledgeForProject(projectPath: string, limit?: number): Knowledge[];
export declare function updateKnowledge(id: string, updates: Partial<Pick<Knowledge, 'content' | 'tags' | 'confidence'>>): void;
export declare function deleteKnowledge(id: string): boolean;
export declare function countKnowledge(projectPath?: string): number;
export declare function listKnowledge(projectPath?: string, type?: KnowledgeType, limit?: number): Knowledge[];
