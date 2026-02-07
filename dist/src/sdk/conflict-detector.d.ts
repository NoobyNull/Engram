import type { Observation, ConflictInfo } from '../shared/types.js';
/**
 * Check an incoming observation against existing memories for duplicates
 * or near-matches that warrant user clarification.
 *
 * Returns null if no conflict, or a ConflictInfo describing the match.
 */
export declare function detectConflict(observation: Observation): Promise<ConflictInfo | null>;
/**
 * Build the clarification prompt that gets injected into Claude's context.
 * Claude will use this to ask the user via AskUserQuestion.
 */
export declare function buildConflictPrompt(conflict: ConflictInfo, observation: Observation): string;
