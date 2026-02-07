import { z } from 'zod';
/** Tool definition compatible with the Claude Code SDK tool() shape. */
export interface SdkToolDef {
    name: string;
    description: string;
    schema: z.ZodType;
    handler: (args: Record<string, unknown>) => Promise<unknown>;
}
/** All ClauDEX MCP tools as SDK-native definitions. */
export declare function getClaudexTools(): SdkToolDef[];
/**
 * Create the in-process MCP server configuration for the Claude Code SDK.
 * Returns a record suitable for the `mcpServers` option.
 */
export declare function createClaudexMcpServer(): Record<string, unknown>;
