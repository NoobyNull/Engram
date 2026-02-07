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
import { createLogger } from '../shared/logger.js';
const log = createLogger('claude-sdk:client');
// ---------------------------------------------------------------------------
// Dynamic import helper — the SDK may not be installed.
// ---------------------------------------------------------------------------
let sdkModule = null;
let sdkLoadAttempted = false;
async function loadSdk() {
    if (sdkLoadAttempted)
        return sdkModule;
    sdkLoadAttempted = true;
    try {
        // Dynamic import — the module path is in a variable to avoid TS2307 when the package isn't installed
        const moduleName = '@anthropic-ai/claude-code';
        sdkModule = await import(/* webpackIgnore: true */ moduleName);
        log.info('Claude Code SDK loaded successfully');
    }
    catch {
        log.warn('Claude Code SDK not available — SDK-dependent features will be disabled');
        sdkModule = null;
    }
    return sdkModule;
}
// ---------------------------------------------------------------------------
// ClaudeClient class
// ---------------------------------------------------------------------------
export class ClaudeClient {
    /**
     * List known Claude CLI sessions.
     *
     * Returns an empty array when the SDK is unavailable.
     */
    async listSessions() {
        try {
            const sdk = await loadSdk();
            if (!sdk || typeof sdk !== 'object')
                return [];
            const mod = sdk;
            if (typeof mod['listSessions'] === 'function') {
                const sessions = await mod['listSessions']();
                return (sessions ?? []).map((s) => {
                    const entry = s;
                    return {
                        id: String(entry['id'] ?? ''),
                        name: String(entry['name'] ?? ''),
                    };
                });
            }
            log.debug('SDK does not expose listSessions — returning empty list');
            return [];
        }
        catch (err) {
            log.error('Failed to list sessions', { error: String(err) });
            return [];
        }
    }
    /**
     * Retrieve information about a specific session, notably whether it is
     * still resumable.
     *
     * Returns `null` when the SDK is unavailable or the session cannot be found.
     */
    async getSessionInfo(sessionId) {
        try {
            const sdk = await loadSdk();
            if (!sdk || typeof sdk !== 'object')
                return null;
            const mod = sdk;
            if (typeof mod['getSessionInfo'] === 'function') {
                const info = await mod['getSessionInfo'](sessionId);
                if (!info || typeof info !== 'object')
                    return null;
                const record = info;
                return {
                    id: String(record['id'] ?? sessionId),
                    resumable: Boolean(record['resumable'] ?? false),
                };
            }
            log.debug('SDK does not expose getSessionInfo — returning null');
            return null;
        }
        catch (err) {
            log.error('Failed to get session info', { sessionId, error: String(err) });
            return null;
        }
    }
}
// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------
export const claudeClient = new ClaudeClient();
//# sourceMappingURL=client.js.map