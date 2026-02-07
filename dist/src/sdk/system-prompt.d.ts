import type { Project } from '../shared/types.js';
/**
 * Build the system prompt context that gets injected via the SDK `systemPrompt` option.
 * Replaces the old stdout-based context injection from the SessionStart hook.
 */
export declare function buildSystemPromptContext(project: Project): string;
