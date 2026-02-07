/**
 * Session management helpers — resume and resumability checks.
 *
 * All functions are safe to call even when the Claude Code SDK is not
 * installed; they degrade gracefully and log relevant warnings.
 *
 * NOTE on session renaming: The Claude Code SDK does not currently support
 * programmatic session renaming. Session names are determined by the first
 * user prompt and cannot be changed after creation. ClauDEX tracks topic
 * labels internally in its own database instead.
 *
 * NOTE on session ID stability: When a session is resumed via the SDK, the
 * resumed session receives a *different* session_id from the original (known
 * bug). ClauDEX handles this by storing all known Claude session IDs for a
 * given ClauDEX session (see linkClaudeSessionId in sessions.ts) and checking
 * resumability against the most recent one.
 */
import type { Conversation } from '../shared/types.js';
/**
 * Check whether a previously-stored Claude session ID is still valid and
 * resumable via the CLI.
 *
 * Returns `false` when the SDK is not available or the session cannot be
 * verified.
 */
export declare function checkResumability(claudeSessionId: string): Promise<boolean>;
/**
 * Build a CLI command string that will resume a given Claude session.
 *
 * Example output: `claude --resume abc-123`
 */
export declare function buildResumeCommand(claudeSessionId: string): string;
/**
 * Build a context-injection string from a `Conversation` record.
 *
 * This is useful when native `--resume` is unavailable (e.g. session has
 * expired) and the caller wants to seed a new session with relevant context
 * about the prior conversation.
 */
export declare function buildResumeContext(conversation: Conversation): string;
