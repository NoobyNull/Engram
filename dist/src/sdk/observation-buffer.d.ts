import type { Observation, StagedObservation, ConflictInfo } from '../shared/types.js';
export interface ObservationBufferOptions {
    /** Auto-checkpoint to recovery journal every N observations. */
    checkpointInterval: number;
}
/**
 * In-memory staging buffer for observations.
 *
 * Observations are collected during a session and can be:
 * - Reviewed via the web UI staging view
 * - Flagged for conflict resolution when near-duplicates are detected
 * - Curated by the curation agent at session end
 * - Flushed (persisted as-is) when curation is disabled
 */
export declare class ObservationBuffer {
    private staged;
    private nextId;
    private options;
    constructor(options?: Partial<ObservationBufferOptions>);
    /** Push an observation into the staging buffer. */
    add(entry: {
        observation: Observation;
        source: 'auto' | 'manual';
    }): StagedObservation;
    /** Flag a staged observation as needing clarification due to a conflict. */
    flagConflict(bufferId: number, conflict: ConflictInfo): void;
    /** Resolve a conflict on a staged observation. */
    resolveConflict(bufferId: number, resolution: ConflictInfo['resolution']): void;
    /** Find a staged observation by its observation ID. */
    findByObservationId(observationId: string): StagedObservation | undefined;
    /** Get all staged observations (for web UI staging view). */
    getStaged(): StagedObservation[];
    /** Get observations needing clarification. */
    getPendingConflicts(): StagedObservation[];
    /** Get all observations regardless of status. */
    getAll(): StagedObservation[];
    /** Get count of pending staged observations. */
    get size(): number;
    /** Get count of unresolved conflicts. */
    get conflictCount(): number;
    /** Mark specific observations as persisted (approved). */
    persist(bufferIds: number[]): void;
    /** Mark specific observations as discarded (rejected). */
    discard(bufferIds: number[]): void;
    /** Persist all pending observations (fallback when curation is disabled). */
    flush(): void;
    /** Write a checkpoint of pending observations to the recovery journal. */
    private checkpoint;
}
