import type { AdaptiveThresholds } from '../shared/types.js';
export declare function getThresholds(projectId: string): AdaptiveThresholds;
/** Record that the system auto-stashed a conversation. */
export declare function recordAutoStash(projectId: string): void;
/**
 * Record a false positive: the user resumed a conversation within minutes
 * of it being auto-stashed, meaning the auto-stash was wrong.
 */
export declare function recordFalsePositive(projectId: string): void;
/** Record that ClauDEX showed a topic-shift suggestion to the user. */
export declare function recordSuggestionShown(projectId: string): void;
/** Record that the user accepted a topic-shift suggestion (manually stashed). */
export declare function recordSuggestionAccepted(projectId: string): void;
