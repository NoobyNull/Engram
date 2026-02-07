import { createLogger } from '../shared/logger.js';
const log = createLogger('sdk:buffer');
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
    staged = [];
    nextId = 1;
    options;
    constructor(options = {}) {
        this.options = {
            checkpointInterval: options.checkpointInterval ?? 20,
        };
    }
    /** Push an observation into the staging buffer. */
    add(entry) {
        const staged = {
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
    flagConflict(bufferId, conflict) {
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
    resolveConflict(bufferId, resolution) {
        const item = this.staged.find(s => s.bufferId === bufferId);
        if (item && item.conflict) {
            item.conflict.resolved = true;
            item.conflict.resolution = resolution;
            item.status = resolution === 'skip' ? 'discarded' : 'persisted';
            log.info('Conflict resolved', { bufferId, resolution });
        }
    }
    /** Find a staged observation by its observation ID. */
    findByObservationId(observationId) {
        return this.staged.find(s => s.observation.id === observationId);
    }
    /** Get all staged observations (for web UI staging view). */
    getStaged() {
        return this.staged.filter(s => s.status === 'pending');
    }
    /** Get observations needing clarification. */
    getPendingConflicts() {
        return this.staged.filter(s => s.status === 'needs_clarification' && s.conflict && !s.conflict.resolved);
    }
    /** Get all observations regardless of status. */
    getAll() {
        return [...this.staged];
    }
    /** Get count of pending staged observations. */
    get size() {
        return this.staged.filter(s => s.status === 'pending').length;
    }
    /** Get count of unresolved conflicts. */
    get conflictCount() {
        return this.staged.filter(s => s.status === 'needs_clarification' && s.conflict && !s.conflict.resolved).length;
    }
    /** Mark specific observations as persisted (approved). */
    persist(bufferIds) {
        const idSet = new Set(bufferIds);
        for (const s of this.staged) {
            if (idSet.has(s.bufferId)) {
                s.status = 'persisted';
            }
        }
        log.info('Observations persisted', { count: bufferIds.length });
    }
    /** Mark specific observations as discarded (rejected). */
    discard(bufferIds) {
        const idSet = new Set(bufferIds);
        for (const s of this.staged) {
            if (idSet.has(s.bufferId)) {
                s.status = 'discarded';
            }
        }
        log.info('Observations discarded', { count: bufferIds.length });
    }
    /** Persist all pending observations (fallback when curation is disabled). */
    flush() {
        const pending = this.staged.filter(s => s.status === 'pending');
        for (const s of pending) {
            s.status = 'persisted';
        }
        log.info('Buffer flushed', { count: pending.length });
    }
    /** Write a checkpoint of pending observations to the recovery journal. */
    checkpoint() {
        const pending = this.staged.filter(s => s.status === 'pending');
        log.debug('Buffer checkpoint', { pending: pending.length, total: this.staged.length });
        // The actual observations are already persisted to DB via journaledInsertObservation.
        // The buffer tracks staging status (pending/persisted/discarded) for curation.
        // Recovery is handled by the existing recovery journal system.
    }
}
//# sourceMappingURL=observation-buffer.js.map