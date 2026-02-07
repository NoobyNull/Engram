import { handleSearch } from './tools/search.js';
import { handleSave } from './tools/save.js';
import { handleTimeline } from './tools/timeline.js';
import { handleGet } from './tools/get.js';
import { handleForget } from './tools/forget.js';
import { handleStash } from './tools/stash.js';
import { handleResume } from './tools/resume.js';
import { handleStats } from './tools/stats.js';
import { handleResolve } from './tools/resolve.js';
export const toolDefinitions = [
    {
        name: 'memory_search',
        description: 'Search your persistent memory across observations, knowledge, sessions, and conversations. Uses hybrid FTS5 keyword + vector semantic search for best results.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query — can be keywords, file names, concepts, or natural language' },
                type: { type: 'string', enum: ['all', 'observations', 'knowledge', 'sessions', 'conversations'], description: 'Filter by type (default: all)' },
                project: { type: 'string', description: 'Filter by project path' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
                from_date: { type: 'string', description: 'Start date filter (ISO 8601)' },
                to_date: { type: 'string', description: 'End date filter (ISO 8601)' },
                limit: { type: 'number', description: 'Max results (default: 20)' },
            },
            required: ['query'],
        },
    },
    {
        name: 'memory_save',
        description: 'Explicitly save a piece of knowledge — a fact, decision, preference, pattern, issue, or context. This is stored permanently and searchable.',
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string', description: 'The knowledge to save' },
                type: { type: 'string', enum: ['fact', 'decision', 'preference', 'pattern', 'issue', 'context', 'discovery'], description: 'Knowledge type' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
                project: { type: 'string', description: 'Associated project path' },
                source_knowledge_ids: { type: 'array', items: { type: 'string' }, description: 'IDs of knowledge items this derives from (for discoveries)' },
            },
            required: ['content', 'type'],
        },
    },
    {
        name: 'memory_timeline',
        description: 'View chronological observations and activity, optionally filtered by session, conversation, project, or time range.',
        inputSchema: {
            type: 'object',
            properties: {
                around: { type: 'string', description: 'Center the timeline around this ISO 8601 date' },
                session_id: { type: 'string', description: 'Filter by session ID' },
                conversation_id: { type: 'string', description: 'Filter by conversation ID' },
                project: { type: 'string', description: 'Filter by project path' },
                limit: { type: 'number', description: 'Max results (default: 20)' },
            },
        },
    },
    {
        name: 'memory_get',
        description: 'Fetch full details for specific memory IDs (observations, knowledge, sessions, or conversations).',
        inputSchema: {
            type: 'object',
            properties: {
                ids: { type: 'array', items: { type: 'string' }, description: 'IDs to fetch' },
                include_context: { type: 'boolean', description: 'Include surrounding session context (default: false)' },
                include_graph: { type: 'boolean', description: 'Include knowledge graph edges and reasoning chains (default: false)' },
            },
            required: ['ids'],
        },
    },
    {
        name: 'memory_forget',
        description: 'Delete memories for privacy. Can delete by ID, search query, or date range.',
        inputSchema: {
            type: 'object',
            properties: {
                ids: { type: 'array', items: { type: 'string' }, description: 'Specific IDs to delete' },
                query: { type: 'string', description: 'Delete memories matching this search query' },
                before_date: { type: 'string', description: 'Delete memories before this ISO 8601 date' },
            },
        },
    },
    {
        name: 'memory_stash',
        description: 'List stashed sidebar conversations. These are paused conversation threads that can be resumed.',
        inputSchema: {
            type: 'object',
            properties: {
                list: { type: 'boolean', description: 'List all stashed sidebars (default: true)' },
                group: { type: 'string', description: 'Filter by stash group ID' },
                project: { type: 'string', description: 'Filter by project path' },
            },
        },
    },
    {
        name: 'memory_resume',
        description: 'Resume a stashed sidebar conversation. Returns context for injection and, if available, the Claude session ID for native resume.',
        inputSchema: {
            type: 'object',
            properties: {
                conversation_id: { type: 'string', description: 'The conversation ID to resume' },
            },
            required: ['conversation_id'],
        },
    },
    {
        name: 'memory_stats',
        description: 'Get usage analytics — observation count, knowledge count, session count, stash count, top tags, storage size.',
        inputSchema: {
            type: 'object',
            properties: {
                project: { type: 'string', description: 'Filter stats by project path' },
            },
        },
    },
    {
        name: 'memory_resolve',
        description: 'Resolve a memory conflict when a new observation is similar to an existing memory. Actions: merge (combine into one), keep_both (save separately), replace (update old with new), skip (discard the new one).',
        inputSchema: {
            type: 'object',
            properties: {
                conflict_id: { type: 'string', description: 'The observation ID of the conflicting new memory' },
                existing_id: { type: 'string', description: 'The ID of the existing memory it conflicts with' },
                action: { type: 'string', enum: ['merge', 'keep_both', 'replace', 'skip'], description: 'How to resolve: merge, keep_both, replace, or skip' },
            },
            required: ['conflict_id', 'action'],
        },
    },
];
const handlers = {
    memory_search: handleSearch,
    memory_save: handleSave,
    memory_timeline: handleTimeline,
    memory_get: handleGet,
    memory_forget: handleForget,
    memory_stash: handleStash,
    memory_resume: handleResume,
    memory_stats: handleStats,
    memory_resolve: handleResolve,
};
export async function handleToolCall(name, args) {
    const handler = handlers[name];
    if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
    }
    return handler(args);
}
//# sourceMappingURL=index.js.map