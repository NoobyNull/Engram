/**
 * Detects the tech stack of a project by scanning for indicator files
 * and reading dependency manifests at the given project root.
 *
 * Returns a deduplicated, sorted array of technology names.
 */
export declare function detectStack(projectRoot: string): string[];
