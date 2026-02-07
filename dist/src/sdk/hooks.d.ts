import type { HookInput } from '../shared/types.js';
import type { ObservationBuffer } from './observation-buffer.js';
export interface ClaudexHookCallbacks {
    SessionStart: Array<{
        matcher: string;
        hooks: Array<{
            type: 'callback';
            callback: (input: HookInput) => Promise<{
                additionalContext?: string;
            }>;
        }>;
    }>;
    UserPromptSubmit: Array<{
        hooks: Array<{
            type: 'callback';
            callback: (input: HookInput) => Promise<{
                additionalContext?: string;
            }>;
        }>;
    }>;
    PostToolUse: Array<{
        matcher: string;
        hooks: Array<{
            type: 'callback';
            callback: (input: HookInput) => Promise<{
                async: boolean;
            }>;
        }>;
    }>;
    PreToolUse: Array<{
        matcher: string;
        hooks: Array<{
            type: 'callback';
            callback: (input: HookInput) => Promise<Record<string, unknown>>;
        }>;
    }>;
    PreCompact: Array<{
        hooks: Array<{
            type: 'callback';
            callback: (input: HookInput) => Promise<Record<string, unknown>>;
        }>;
    }>;
    SessionEnd: Array<{
        hooks: Array<{
            type: 'callback';
            callback: (input: HookInput) => Promise<Record<string, unknown>>;
        }>;
    }>;
}
/**
 * Create SDK hook callback mappings for all ClauDEX lifecycle events.
 * Returns an object suitable for the `hooks` SDK option.
 */
export declare function createClaudexHooks(buffer?: ObservationBuffer): ClaudexHookCallbacks;
