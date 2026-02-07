import type { SessionFork } from '../shared/types.js';
/**
 * Create a checkpoint (session fork) — a snapshot of the current session state.
 * Used for recovery, branching, and destructive-operation safety.
 *
 * @param claudeSessionId — the Claude CLI session ID to resolve to a ClauDEX session.
 * @param label — optional human-readable label for this checkpoint.
 */
export declare function createCheckpoint(claudeSessionId: string, label?: string): Promise<SessionFork | null>;
/**
 * List all checkpoints, optionally filtered by session.
 */
export declare function listCheckpoints(sessionId?: string): SessionFork[];
/**
 * Get a specific checkpoint by ID.
 */
export declare function getCheckpoint(id: string): SessionFork | null;
