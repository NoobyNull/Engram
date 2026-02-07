import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { getDb, closeDb } from '../db/database.js';
import { toolDefinitions, handleToolCall } from './index.js';
import { createLogger } from '../shared/logger.js';
const log = createLogger('mcp:server');
async function main() {
    log.info('Starting ClauDEX MCP server');
    // Initialize database
    getDb();
    const server = new Server({ name: 'claudex', version: '1.0.0' }, { capabilities: { tools: {} } });
    // List tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: toolDefinitions };
    });
    // Call tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        log.info('Tool call', { name });
        try {
            const result = await handleToolCall(name, args || {});
            return {
                content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
            };
        }
        catch (err) {
            log.error('Tool call failed', { name, error: err });
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: [{ type: 'text', text: `Error: ${message}` }],
                isError: true,
            };
        }
    });
    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log.info('ClauDEX MCP server running on stdio');
    // Start web UI server if enabled
    try {
        const { getConfig } = await import('../shared/config.js');
        const config = getConfig();
        if (config.webUI.enabled) {
            const { startWebServer } = await import('../web/server.js');
            startWebServer(config.webUI.port);
        }
    }
    catch (err) {
        log.warn('Failed to start web UI', err);
    }
    // Cleanup on exit
    process.on('SIGINT', () => {
        closeDb();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        closeDb();
        process.exit(0);
    });
}
main().catch((err) => {
    log.error('Fatal error', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map