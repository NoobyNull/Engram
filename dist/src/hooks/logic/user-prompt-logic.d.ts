import type { HookInput } from '../../shared/types.js';
export interface UserPromptResult {
    suggestion: string | null;
    action: 'ignore' | 'ask' | 'trust';
}
export declare function handleUserPrompt(input: HookInput): Promise<UserPromptResult>;
