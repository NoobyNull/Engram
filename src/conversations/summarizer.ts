import Anthropic from '@anthropic-ai/sdk';
import { getObservationsByConversation } from '../db/observations.js';
import { updateConversationSummary } from '../db/conversations.js';
import { createLogger } from '../shared/logger.js';

const log = createLogger('conversations:summarizer');

/** Regex to extract file paths from text. */
const FILE_PATH_RE = /(?:\/[\w.\-]+)+(?:\.[\w]+)?|(?:[A-Z]:\\[\w.\-\\]+)/g;

/**
 * Generate a summary for a conversation based on its observations.
 *
 * Tries Claude Haiku first; falls back to a simple extractive summary
 * built from the first/last observations, file paths, and key terms.
 *
 * The result is persisted to the database and returned.
 */
export async function summarizeConversation(
  conversationId: string,
): Promise<string> {
  const observations = getObservationsByConversation(conversationId);

  if (observations.length === 0) {
    const empty = 'No observations recorded for this conversation.';
    updateConversationSummary(conversationId, empty);
    return empty;
  }

  // Attempt SDK query()-based summarization first.
  try {
    const { sdkSummarizeConversation } = await import('../sdk/summarizer.js');
    const summary = await sdkSummarizeConversation(conversationId);
    if (summary) return summary;
  } catch {
    // SDK summarizer not available, fall through
  }

  // Attempt direct LLM summarization.
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (apiKey) {
    try {
      const summary = await llmSummarize(apiKey, observations);
      updateConversationSummary(conversationId, summary);
      return summary;
    } catch (err) {
      log.warn('LLM summarization failed, using extractive fallback', {
        error: String(err),
      });
    }
  } else {
    log.debug('No ANTHROPIC_API_KEY, using extractive summary');
  }

  // Fallback: extractive summary.
  const summary = extractiveSummary(observations);
  updateConversationSummary(conversationId, summary);
  return summary;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ObservationLike {
  tool_name: string;
  tool_input_summary: string | null;
  tool_output_summary: string | null;
  files_involved: string[];
  tags: string[];
}

async function llmSummarize(
  apiKey: string,
  observations: ObservationLike[],
): Promise<string> {
  const client = new Anthropic({ apiKey });

  // Build a concise digest of the observations (cap size to stay cheap).
  const lines: string[] = [];
  for (const obs of observations.slice(0, 40)) {
    const parts: string[] = [obs.tool_name];
    if (obs.tool_input_summary) parts.push(obs.tool_input_summary);
    if (obs.tool_output_summary) parts.push(obs.tool_output_summary.slice(0, 200));
    lines.push(`- ${parts.join(': ')}`);
  }
  const digest = lines.join('\n').slice(0, 3000);

  const response = await client.messages.create({
    model: 'claude-haiku-4-20250414',
    max_tokens: 256,
    system:
      'Summarize the following developer conversation observations into 2-4 concise sentences. Focus on what was done, which files were touched, and the outcome. Do not include preamble.',
    messages: [{ role: 'user', content: digest }],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '';
  return text.trim() || extractiveSummary(observations);
}

function extractiveSummary(observations: ObservationLike[]): string {
  const parts: string[] = [];

  // Collect all unique file paths.
  const allFiles = new Set<string>();
  for (const obs of observations) {
    for (const f of obs.files_involved) {
      allFiles.add(f);
    }
    // Also try to extract paths from summaries.
    const combined = [obs.tool_input_summary, obs.tool_output_summary]
      .filter(Boolean)
      .join(' ');
    const matches = combined.match(FILE_PATH_RE);
    if (matches) {
      for (const m of matches) allFiles.add(m);
    }
  }

  // Collect unique tags.
  const allTags = new Set<string>();
  for (const obs of observations) {
    for (const t of obs.tags) allTags.add(t);
  }

  // Collect tool names used.
  const tools = new Set<string>();
  for (const obs of observations) tools.add(obs.tool_name);

  // First observation context.
  const first = observations[0]!;
  if (first.tool_input_summary) {
    parts.push(`Started with: ${first.tool_input_summary.slice(0, 120)}`);
  }

  // Last observation context.
  if (observations.length > 1) {
    const last = observations[observations.length - 1]!;
    if (last.tool_input_summary) {
      parts.push(`Ended with: ${last.tool_input_summary.slice(0, 120)}`);
    }
  }

  // Files summary.
  if (allFiles.size > 0) {
    const fileList = [...allFiles].slice(0, 8).join(', ');
    const suffix = allFiles.size > 8 ? ` (+${allFiles.size - 8} more)` : '';
    parts.push(`Files: ${fileList}${suffix}`);
  }

  // Tags summary.
  if (allTags.size > 0) {
    parts.push(`Tags: ${[...allTags].slice(0, 10).join(', ')}`);
  }

  // Tools summary.
  parts.push(`Tools used: ${[...tools].join(', ')}`);

  // Observation count.
  parts.push(`${observations.length} observation(s) total.`);

  return parts.join('. ');
}
