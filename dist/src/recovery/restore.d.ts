/**
 * Runs the full recovery sequence on startup:
 * 1. Replays any pending (uncommitted) journal entries left from a previous crash.
 * 2. Cleans up old committed journal entries to keep the table compact.
 *
 * Returns counts of replayed and cleaned entries for observability.
 */
export declare function runRecovery(): {
    replayed: number;
    cleaned: number;
};
