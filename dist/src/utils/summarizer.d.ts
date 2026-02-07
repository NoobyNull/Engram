import type { Observation } from '../shared/types.js';
/**
 * Extractive summarization utilities.
 * Uses heuristics to extract key information without LLM calls.
 */
export declare function summarizeToolInput(toolName: string, input: unknown): string;
export declare function summarizeToolOutput(toolName: string, output: string): string;
export declare function extractFilePaths(text: string): string[];
export declare function extractKeyPhrases(text: string): string[];
export declare function summarizeObservations(observations: Observation[]): string;
export declare function truncateIntelligent(text: string, maxLen: number): string;
