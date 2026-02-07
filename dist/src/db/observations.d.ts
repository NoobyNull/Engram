import type { Observation } from '../shared/types.js';
export interface CreateObservationInput {
    session_id: string;
    conversation_id?: string;
    tool_name: string;
    tool_input_summary?: string;
    tool_output_summary?: string;
    project_path: string;
    files_involved?: string[];
    tags?: string[];
}
export declare function createObservation(input: CreateObservationInput): Observation;
export declare function getObservation(id: string): Observation | null;
export declare function getObservationsBySession(sessionId: string, limit?: number): Observation[];
export declare function getObservationsByConversation(conversationId: string, limit?: number): Observation[];
export declare function getRecentObservations(projectPath: string, limit?: number): Observation[];
export declare function getObservationsAround(timestamp: number, limit?: number, projectPath?: string): Observation[];
export declare function deleteObservation(id: string): boolean;
export declare function deleteObservationsByQuery(query: string, beforeDate?: number): number;
export declare function countObservations(projectPath?: string): number;
