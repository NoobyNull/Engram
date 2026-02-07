#!/usr/bin/env node
/**
 * ClauDEX — Universal hook adapter for the Claude Code plugin system.
 *
 * Bridges between shell-command hooks (stdin JSON → stdout JSON) and
 * the in-process hook logic modules.
 *
 * Usage:
 *   node hook-runner.js <EventName>
 *
 * Reads hook input JSON from stdin, calls the appropriate logic function,
 * writes hook output JSON to stdout.
 *
 * NOTE: Shell-command hooks run in separate processes, so features that
 * depend on shared in-memory state (ObservationBuffer, curation agent,
 * conflict detection) are not available in plugin mode. For the full
 * feature set, use the SDK integration (initClaudex).
 */
export {};
