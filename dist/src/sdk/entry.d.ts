import type { ClaudexSdkOptions } from '../shared/types.js';
/**
 * Single entry point for ClauDEX as a Claude Code SDK plugin.
 *
 * Initializes the database, starts the web UI, and returns the combined
 * SDK options: MCP tools, hooks, and system prompt context.
 */
export declare function initClaudex(cwd: string): Promise<ClaudexSdkOptions>;
