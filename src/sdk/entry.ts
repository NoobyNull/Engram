import { getDb, closeDb } from '../db/database.js';
import { getConfig } from '../shared/config.js';
import { createLogger } from '../shared/logger.js';
import { createClaudexHooks } from './hooks.js';
import { getClaudexTools } from './mcp-server.js';
import { ObservationBuffer } from './observation-buffer.js';
import { buildSystemPromptContext } from './system-prompt.js';
import { detectAndRegisterProject } from '../projects/detector.js';
import { runRecovery } from '../recovery/restore.js';
import type { ClaudexSdkOptions } from '../shared/types.js';

const log = createLogger('sdk:entry');

/**
 * Single entry point for ClauDEX as a Claude Code SDK plugin.
 *
 * Initializes the database, starts the web UI, and returns the combined
 * SDK options: MCP tools, hooks, and system prompt context.
 */
export async function initClaudex(cwd: string): Promise<ClaudexSdkOptions> {
  log.info('Initializing ClauDEX', { cwd });

  // Initialize database
  getDb();

  // Run crash recovery
  runRecovery();

  // Detect project
  const project = detectAndRegisterProject(cwd);

  // Create observation buffer
  const config = getConfig();
  const buffer = new ObservationBuffer({
    checkpointInterval: config.buffer?.checkpointInterval ?? 20,
  });

  // Build system prompt context
  const systemPrompt = buildSystemPromptContext(project);

  // Get MCP tools
  const tools = getClaudexTools();

  // Create hooks with buffer
  const hooks = createClaudexHooks(buffer);

  // Start web UI if enabled
  if (config.webUI.enabled) {
    try {
      const { setStagingBuffer } = await import('../web/routes.js');
      setStagingBuffer(buffer);
      const { startWebServer } = await import('../web/server.js');
      startWebServer(config.webUI.port);
    } catch (err) {
      log.warn('Failed to start web UI', err);
    }
  }

  // Cleanup handler
  const cleanup = () => {
    buffer.flush();
    closeDb();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  log.info('ClauDEX initialized', {
    project: project.name,
    tools: tools.length,
    hooks: Object.keys(hooks).length,
  });

  return {
    mcpServers: {
      claudex: {
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.schema,
          handler: t.handler,
        })),
      },
    },
    hooks: hooks as unknown as Record<string, unknown>,
    systemPrompt,
  };
}
