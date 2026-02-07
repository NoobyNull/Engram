import type { SessionFork } from '../shared/types.js';
/**
 * CRUD operations for the session_forks table.
 */
export declare function createFork(sessionId: string, label?: string, snapshot?: Record<string, unknown>): SessionFork;
export declare function getFork(id: string): SessionFork | null;
export declare function listForks(sessionId?: string): SessionFork[];
export declare function deleteFork(id: string): boolean;
