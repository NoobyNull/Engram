import type { Project, CurationResult } from '../shared/types.js';
import type { ObservationBuffer } from './observation-buffer.js';
/**
 * Run the curation subagent on buffered observations.
 *
 * Uses Haiku to:
 * - Deduplicate similar observations
 * - Drop noise (trivial reads, redundant searches)
 * - Tag observations with better categories
 * - Extract knowledge items
 * - Merge related observations
 *
 * Budget-capped to prevent cost surprises.
 */
export declare function curateObservations(buffer: ObservationBuffer, project: Project): Promise<CurationResult>;
