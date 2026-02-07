import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../shared/logger.js';
import { getOrCreateProject } from '../db/projects.js';
import { detectStack } from './stack-detector.js';
const log = createLogger('project-detector');
/**
 * Files and directories whose presence indicates a project root.
 * Directories should end with `/`.
 */
const PROJECT_MARKERS = [
    '.git/',
    'package.json',
    'Cargo.toml',
    'pyproject.toml',
    'go.mod',
    'pom.xml',
    'build.gradle',
    '.claude/',
];
/** Cache: absolute path -> detected project root. */
const rootCache = new Map();
/**
 * Walks up the directory tree from `cwd` looking for any of the known
 * project marker files/directories.  Returns the first directory that
 * contains at least one marker, or `cwd` itself if none is found.
 *
 * Results are cached so repeated calls with the same (or child) path
 * are essentially free.
 */
export function detectProjectRoot(cwd) {
    const resolved = path.resolve(cwd);
    const cached = rootCache.get(resolved);
    if (cached !== undefined) {
        return cached;
    }
    let current = resolved;
    while (true) {
        if (hasProjectMarker(current)) {
            rootCache.set(resolved, current);
            log.debug('Detected project root', { cwd: resolved, root: current });
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            // Reached filesystem root without finding a marker — fall back to cwd.
            rootCache.set(resolved, resolved);
            log.debug('No project marker found, falling back to cwd', { cwd: resolved });
            return resolved;
        }
        current = parent;
    }
}
/**
 * Detects the project root for the given working directory, auto-detects
 * the tech stack, and ensures a corresponding Project record exists in the
 * database (creating one if necessary).
 *
 * Returns the Project record.
 */
export function detectAndRegisterProject(cwd) {
    const root = detectProjectRoot(cwd);
    const name = path.basename(root);
    const stack = detectStack(root);
    log.info('Registering project', { root, name, stack });
    return getOrCreateProject(root, name, stack);
}
/**
 * Checks whether `dir` contains any of the known project markers.
 */
function hasProjectMarker(dir) {
    for (const marker of PROJECT_MARKERS) {
        try {
            const fullPath = path.join(dir, marker.replace(/\/$/, ''));
            const stat = fs.statSync(fullPath);
            // If the marker string ends with `/` it must be a directory.
            if (marker.endsWith('/') && !stat.isDirectory()) {
                continue;
            }
            return true;
        }
        catch {
            // File/dir doesn't exist — try next marker.
        }
    }
    return false;
}
//# sourceMappingURL=detector.js.map