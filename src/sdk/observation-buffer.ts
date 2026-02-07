import { createLogger } from '../shared/logger.js';
import type { Observation, StagedObservation, ConflictInfo } from '../shared/types.js';

const log = createLogger('sdk:buffer');

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
export class ObservationBuffer {
  private staged: StagedObservation[] = [];
  private nextId = 1;
  private options: ObservationBufferOptions;

  constructor(options: Partial<ObservationBufferOptions> = {}) {
    this.options = {
      checkpointInterval: options.checkpointInterval ?? 20,
    };
  }

  /** Push an observation into the staging buffer. */
  add(entry: { observation: Observation; source: 'auto' | 'manual' }): StagedObservation {
    const staged: StagedObservation = {
      bufferId: this.nextId++,
      observation: entry.observation,
      source: entry.source,
      stagedAt: Date.now(),
      status: 'pending',
    };
    this.staged.push(staged);

    log.debug('Observation staged', { bufferId: staged.bufferId, tool: entry.observation.tool_name });

    // Auto-checkpoint to recovery journal at intervals
    if (this.staged.length % this.options.checkpointInterval === 0) {
      this.checkpoint();
    }

    return staged;
  }

  /** Flag a staged observation as needing clarification due to a conflict. */
  flagConflict(bufferId: number, conflict: ConflictInfo): void {
    const item = this.staged.find(s => s.bufferId === bufferId);
    if (item) {
      item.status = 'needs_clarification';
      item.conflict = conflict;
      log.info('Observation flagged for conflict resolution', {
        bufferId,
        existingId: conflict.existingMemory.id,
        similarity: conflict.similarity,
      });
    }
  }

  /** Resolve a conflict on a staged observation. */
  resolveConflict(bufferId: number, resolution: ConflictInfo['resolution']): void {
    const item = this.staged.find(s => s.bufferId === bufferId);
    if (item && item.conflict) {
      item.conflict.resolved = true;
      item.conflict.resolution = resolution;
      item.status = resolution === 'skip' ? 'discarded' : 'persisted';
      log.info('Conflict resolved', { bufferId, resolution });
    }
  }

  /** Find a staged observation by its observation ID. */
  findByObservationId(observationId: string): StagedObservation | undefined {
    return this.staged.find(s => s.observation.id === observationId);
  }

  /** Get all staged observations (for web UI staging view). */
  getStaged(): StagedObservation[] {
    return this.staged.filter(s => s.status === 'pending');
  }

  /** Get observations needing clarification. */
  getPendingConflicts(): StagedObservation[] {
    return this.staged.filter(s => s.status === 'needs_clarification' && s.conflict && !s.conflict.resolved);
  }

  /** Get all observations regardless of status. */
  getAll(): StagedObservation[] {
    return [...this.staged];
  }

  /** Get count of pending staged observations. */
  get size(): number {
    return this.staged.filter(s => s.status === 'pending').length;
  }

  /** Get count of unresolved conflicts. */
  get conflictCount(): number {
    return this.staged.filter(s => s.status === 'needs_clarification' && s.conflict && !s.conflict.resolved).length;
  }

  /** Mark specific observations as persisted (approved). */
  persist(bufferIds: number[]): void {
    const idSet = new Set(bufferIds);
    for (const s of this.staged) {
      if (idSet.has(s.bufferId)) {
        s.status = 'persisted';
      }
    }
    log.info('Observations persisted', { count: bufferIds.length });
  }

  /** Mark specific observations as discarded (rejected). */
  discard(bufferIds: number[]): void {
    const idSet = new Set(bufferIds);
    for (const s of this.staged) {
      if (idSet.has(s.bufferId)) {
        s.status = 'discarded';
      }
    }
    log.info('Observations discarded', { count: bufferIds.length });
  }

  /** Persist all pending observations (fallback when curation is disabled). */
  flush(): void {
    const pending = this.staged.filter(s => s.status === 'pending');
    for (const s of pending) {
      s.status = 'persisted';
    }
    log.info('Buffer flushed', { count: pending.length });
  }

  /** Write a checkpoint of pending observations to the recovery journal. */
  private checkpoint(): void {
    const pending = this.staged.filter(s => s.status === 'pending');
    log.debug('Buffer checkpoint', { pending: pending.length, total: this.staged.length });
    // The actual observations are already persisted to DB via journaledInsertObservation.
    // The buffer tracks staging status (pending/persisted/discarded) for curation.
    // Recovery is handled by the existing recovery journal system.
  }
}
