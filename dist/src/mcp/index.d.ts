import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export declare const toolDefinitions: Tool[];
export declare function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown>;
