import { replayPendingEntries, cleanupJournal } from '../db/recovery.js';
import { createLogger } from '../shared/logger.js';

const log = createLogger('recovery:restore');

/**
 * Runs the full recovery sequence on startup:
 * 1. Replays any pending (uncommitted) journal entries left from a previous crash.
 * 2. Cleans up old committed journal entries to keep the table compact.
 *
 * Returns counts of replayed and cleaned entries for observability.
 */
export function runRecovery(): { replayed: number; cleaned: number } {
  log.info('Starting recovery check');

  let replayed = 0;
  try {
    replayed = replayPendingEntries();
    if (replayed > 0) {
      log.info('Replayed pending journal entries', { replayed });
    } else {
      log.info('No pending journal entries to replay');
    }
  } catch (err) {
    log.error('Error during journal replay', { error: err });
  }

  let cleaned = 0;
  try {
    cleaned = cleanupJournal();
    if (cleaned > 0) {
      log.info('Cleaned up old journal entries', { cleaned });
    }
  } catch (err) {
    log.error('Error during journal cleanup', { error: err });
  }

  log.info('Recovery complete', { replayed, cleaned });
  return { replayed, cleaned };
}
