import type { Session, Conversation, Knowledge, Project } from '../shared/types.js';
export interface ContextInput {
    project: Project;
    recentSessions: Session[];
    conversations: Conversation[];
    stashedSidebars: Array<{
        conversation: Conversation;
        groupLabel: string | null;
    }>;
    knowledge: Knowledge[];
    maxTokens: number;
}
export declare function buildSessionStartContext(input: ContextInput): string;
