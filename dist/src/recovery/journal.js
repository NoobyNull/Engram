import { writeJournalEntry, commitJournalEntry, failJournalEntry } from '../db/recovery.js';
import { createObservation } from '../db/observations.js';
import { createKnowledge } from '../db/knowledge.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('recovery:journal');
/**
 * Wraps a database operation with write-ahead journal entries for crash resilience.
 *
 * 1. Writes a pending entry to recovery_journal with the full payload.
 * 2. Executes the provided database operation.
 * 3. Marks the journal entry as committed on success.
 * 4. Marks the journal entry as failed on error (and re-throws).
 */
export function withJournal(operation, tableName, recordId, payload, fn) {
    const journalId = writeJournalEntry(operation, tableName, recordId, payload);
    log.debug('Journal entry written', { journalId, operation, tableName, recordId });
    try {
        const result = fn();
        commitJournalEntry(journalId);
        log.debug('Journal entry committed', { journalId });
        return result;
    }
    catch (err) {
        failJournalEntry(journalId);
        log.error('Journal entry failed', { journalId, operation, error: err });
        throw err;
    }
}
/**
 * Creates an observation wrapped with a journal entry for crash resilience.
 */
export function journaledInsertObservation(input) {
    return withJournal('insert_observation', 'observations', '', // record id assigned inside createObservation; replay uses payload
    input, () => {
        const obs = createObservation(input);
        log.info('Journaled observation created', { id: obs.id });
        return obs;
    });
}
/**
 * Creates a knowledge entry wrapped with a journal entry for crash resilience.
 */
export function journaledInsertKnowledge(input) {
    return withJournal('insert_knowledge', 'knowledge', '', // record id assigned inside createKnowledge; replay uses payload
    input, () => {
        const kn = createKnowledge(input);
        log.info('Journaled knowledge created', { id: kn.id });
        return kn;
    });
}
//# sourceMappingURL=journal.js.map