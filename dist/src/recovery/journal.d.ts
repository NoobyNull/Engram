import { type CreateObservationInput } from '../db/observations.js';
import { type CreateKnowledgeInput } from '../db/knowledge.js';
import type { Observation, Knowledge } from '../shared/types.js';
/**
 * Wraps a database operation with write-ahead journal entries for crash resilience.
 *
 * 1. Writes a pending entry to recovery_journal with the full payload.
 * 2. Executes the provided database operation.
 * 3. Marks the journal entry as committed on success.
 * 4. Marks the journal entry as failed on error (and re-throws).
 */
export declare function withJournal<T>(operation: string, tableName: string, recordId: string, payload: unknown, fn: () => T): T;
/**
 * Creates an observation wrapped with a journal entry for crash resilience.
 */
export declare function journaledInsertObservation(input: CreateObservationInput): Observation;
/**
 * Creates a knowledge entry wrapped with a journal entry for crash resilience.
 */
export declare function journaledInsertKnowledge(input: CreateKnowledgeInput): Knowledge;
