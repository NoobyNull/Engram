import { getDb } from '../../src/db/database.js';
import { detectProjectRoot } from '../../src/projects/detector.js';
import { getProjectByPath, incrementProjectObservationCount } from '../../src/db/projects.js';
import { getActiveSession, incrementSessionObservationCount } from '../../src/db/sessions.js';
import { getActiveConversation, incrementConversationObservationCount } from '../../src/db/conversations.js';
import { journaledInsertObservation } from '../../src/recovery/journal.js';
import { enqueueEmbedding } from '../../src/embeddings/queue.js';
import { isPrivacyExcluded } from '../../src/shared/config.js';
import { summarizeToolInput, summarizeToolOutput, extractFilePaths } from '../../src/utils/summarizer.js';
import { createLogger } from '../../src/shared/logger.js';
const log = createLogger('hook:post-tool-use');
async function main() {
    let input = {};
    try {
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        if (raw) {
            input = JSON.parse(raw);
        }
    }
    catch {
        return;
    }
    const toolName = input['tool_name'] || '';
    const toolInput = input['tool_input'];
    const toolResponse = input['tool_response'] || '';
    const cwd = input['cwd'] || process.cwd();
    if (!toolName)
        return;
    // Initialize database
    getDb();
    const projectRoot = detectProjectRoot(cwd);
    const project = getProjectByPath(projectRoot);
    if (!project)
        return;
    const session = getActiveSession(project.id);
    if (!session)
        return;
    const conversation = getActiveConversation(session.id);
    // Summarize input and output
    const inputSummary = summarizeToolInput(toolName, toolInput);
    const outputSummary = summarizeToolOutput(toolName, toolResponse);
    // Extract file paths
    const inputStr = typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput || '');
    const allFiles = [
        ...extractFilePaths(inputStr),
        ...extractFilePaths(toolResponse),
    ];
    // Check privacy exclusion
    const filteredFiles = allFiles.filter(f => !isPrivacyExcluded(f));
    if (allFiles.length > 0 && filteredFiles.length === 0) {
        log.debug('All files excluded by privacy filter', { toolName });
        return;
    }
    // Check if the input/output itself contains excluded content
    if (isPrivacyExcluded(inputSummary) || isPrivacyExcluded(outputSummary)) {
        log.debug('Content excluded by privacy filter', { toolName });
        return;
    }
    // Auto-tag based on tool name
    const tags = [];
    if (toolName === 'Edit' || toolName === 'Write')
        tags.push('modification');
    if (toolName === 'Read')
        tags.push('read');
    if (toolName === 'Bash')
        tags.push('command');
    if (toolName === 'Grep' || toolName === 'Glob')
        tags.push('search');
    if (toolName === 'WebFetch' || toolName === 'WebSearch')
        tags.push('web');
    // Create observation with journaling
    try {
        const obs = journaledInsertObservation({
            session_id: session.id,
            conversation_id: conversation?.id,
            tool_name: toolName,
            tool_input_summary: inputSummary,
            tool_output_summary: outputSummary,
            project_path: project.root_path,
            files_involved: filteredFiles,
            tags,
        });
        // Update counts
        incrementSessionObservationCount(session.id);
        incrementProjectObservationCount(project.id);
        if (conversation) {
            incrementConversationObservationCount(conversation.id);
        }
        // Queue for embedding
        const embeddingText = [inputSummary, outputSummary].filter(Boolean).join(' | ');
        if (embeddingText.length > 10) {
            enqueueEmbedding('observation', obs.id, embeddingText);
        }
        log.debug('Observation recorded', { id: obs.id, tool: toolName });
    }
    catch (err) {
        log.error('Failed to record observation', err);
    }
}
main().catch(err => {
    const log2 = createLogger('hook:post-tool-use');
    log2.error('Post tool use hook failed', err);
    process.exit(0);
});
//# sourceMappingURL=post-tool-use.js.map