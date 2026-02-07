import type { TopicShiftScore, Observation } from '../shared/types.js';
export interface DetectorContext {
    /** Recent observations from the active conversation. */
    recentObservations: Observation[];
    /** The current conversation topic label. */
    currentTopic: string | null;
    /** The new user prompt or activity text. */
    newActivity: string;
}
/**
 * Score a potential topic shift using multiple weighted signals.
 *
 * Returns a TopicShiftScore with a value from 0.0 (same topic) to 1.0
 * (definitely different). The caller decides what to do based on the
 * adaptive thresholds.
 */
export declare function scoreTopicShift(ctx: DetectorContext): TopicShiftScore;
