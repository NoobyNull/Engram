import type { Project } from '../shared/types.js';
/**
 * Walks up the directory tree from `cwd` looking for any of the known
 * project marker files/directories.  Returns the first directory that
 * contains at least one marker, or `cwd` itself if none is found.
 *
 * Results are cached so repeated calls with the same (or child) path
 * are essentially free.
 */
export declare function detectProjectRoot(cwd: string): string;
/**
 * Detects the project root for the given working directory, auto-detects
 * the tech stack, and ensures a corresponding Project record exists in the
 * database (creating one if necessary).
 *
 * Returns the Project record.
 */
export declare function detectAndRegisterProject(cwd: string): Project;
