import type { Session } from '../shared/types.js';
export declare function createSession(projectId: string, claudeSessionId?: string): Session;
export declare function getSession(id: string): Session | null;
export declare function getSessionByClaudeId(claudeSessionId: string): Session | null;
/**
 * Link a new Claude session ID to an existing ClauDEX session.
 *
 * When Claude resumes a session, the resumed session gets a different
 * session_id (known SDK bug). This function updates the primary
 * claude_session_id and archives the old one in prior_claude_session_ids
 * so we can still find the ClauDEX session by any of its Claude IDs.
 */
export declare function linkClaudeSessionId(claudexSessionId: string, newClaudeSessionId: string): void;
export declare function endSession(id: string, summary?: string, keyActions?: string[], filesModified?: string[]): void;
export declare function updateSessionSummary(id: string, summary: string, keyActions?: string[], filesModified?: string[]): void;
export declare function incrementSessionObservationCount(id: string): void;
export declare function getRecentSessions(projectId: string, limit?: number): Session[];
