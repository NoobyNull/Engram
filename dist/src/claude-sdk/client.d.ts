/**
 * Claude Agent SDK wrapper.
 *
 * Provides a thin facade over `@anthropic-ai/claude-code` for programmatic
 * CLI interactions (list sessions, resumability checks).  Every method
 * gracefully degrades to a safe default when the SDK is not installed or the
 * underlying call fails, so the rest of the codebase can depend on this
 * module unconditionally.
 *
 * NOTE: Session renaming is NOT supported by the Claude Code SDK as of 2025.
 * There is an open feature request with 50+ upvotes. If/when Anthropic adds
 * a rename API, we can add renameSession() back here.
 */
export interface SessionListEntry {
    id: string;
    name: string;
}
export interface SessionInfo {
    id: string;
    resumable: boolean;
}
export declare class ClaudeClient {
    /**
     * List known Claude CLI sessions.
     *
     * Returns an empty array when the SDK is unavailable.
     */
    listSessions(): Promise<SessionListEntry[]>;
    /**
     * Retrieve information about a specific session, notably whether it is
     * still resumable.
     *
     * Returns `null` when the SDK is unavailable or the session cannot be found.
     */
    getSessionInfo(sessionId: string): Promise<SessionInfo | null>;
}
export declare const claudeClient: ClaudeClient;
