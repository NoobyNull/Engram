import type { RecoveryJournalEntry } from '../shared/types.js';
export declare function writeJournalEntry(operation: string, tableName: string, recordId: string, payload: unknown): number;
export declare function commitJournalEntry(id: number): void;
export declare function failJournalEntry(id: number): void;
export declare function getPendingJournalEntries(): RecoveryJournalEntry[];
export declare function cleanupJournal(keepCount?: number, maxAgeMs?: number): number;
export declare function replayPendingEntries(): number;
