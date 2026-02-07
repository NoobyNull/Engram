import type { Observation } from '../shared/types.js';

/**
 * Extractive summarization utilities.
 * Uses heuristics to extract key information without LLM calls.
 */

export function summarizeToolInput(toolName: string, input: unknown): string {
  if (!input) return '';

  const str = typeof input === 'string' ? input : JSON.stringify(input);

  // Extract key info based on tool type
  switch (toolName) {
    case 'Read':
      return extractReadSummary(input);
    case 'Edit':
      return extractEditSummary(input);
    case 'Write':
      return extractWriteSummary(input);
    case 'Bash':
      return extractBashSummary(input);
    case 'Grep':
    case 'Glob':
      return extractSearchSummary(toolName, input);
    case 'WebFetch':
    case 'WebSearch':
      return extractWebSummary(input);
    default:
      return truncateIntelligent(str, 300);
  }
}

export function summarizeToolOutput(toolName: string, output: string): string {
  if (!output) return '';

  // For file reads, keep first and last few lines
  if (toolName === 'Read') {
    return summarizeFileContent(output);
  }

  // For bash output, keep error messages and key results
  if (toolName === 'Bash') {
    return summarizeBashOutput(output);
  }

  // For search results, keep file paths
  if (toolName === 'Grep' || toolName === 'Glob') {
    return summarizeSearchOutput(output);
  }

  return truncateIntelligent(output, 500);
}

export function extractFilePaths(text: string): string[] {
  if (!text) return [];

  const pathPatterns = [
    /(?:^|\s|["'])([/~][\w./-]+\.\w+)/g,          // Absolute paths
    /(?:^|\s|["'])((?:src|lib|test|hooks|dist)\/[\w./-]+)/g,  // Relative project paths
    /"file_path"\s*:\s*"([^"]+)"/g,                 // JSON file_path fields
    /"path"\s*:\s*"([^"]+)"/g,                       // JSON path fields
  ];

  const paths = new Set<string>();
  for (const pattern of pathPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const p = match[1];
      if (p && !p.includes('node_modules') && !p.includes('.git/')) {
        paths.add(p);
      }
    }
  }
  return [...paths];
}

export function extractKeyPhrases(text: string): string[] {
  if (!text) return [];

  const phrases: string[] = [];

  // Function/method names: word followed by parentheses
  const funcPattern = /\b(\w{2,})\s*\(/g;
  let match;
  while ((match = funcPattern.exec(text)) !== null) {
    const name = match[1];
    if (name && !isCommonWord(name)) {
      phrases.push(name);
    }
  }

  // Error messages
  const errorPattern = /(?:error|Error|ERROR)[:\s]+(.{10,80})/g;
  while ((match = errorPattern.exec(text)) !== null) {
    phrases.push(match[1].trim());
  }

  return [...new Set(phrases)].slice(0, 10);
}

export function summarizeObservations(observations: Observation[]): string {
  if (observations.length === 0) return 'No observations';

  const toolCounts = new Map<string, number>();
  const allFiles = new Set<string>();

  for (const obs of observations) {
    toolCounts.set(obs.tool_name, (toolCounts.get(obs.tool_name) || 0) + 1);
    for (const f of obs.files_involved) {
      allFiles.add(f);
    }
  }

  const parts: string[] = [];

  // Tool usage summary
  const toolSummary = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tool, count]) => `${tool}(${count})`)
    .join(', ');
  parts.push(`Tools: ${toolSummary}`);

  // Files involved
  if (allFiles.size > 0) {
    const fileList = [...allFiles].slice(0, 8).join(', ');
    parts.push(`Files: ${fileList}${allFiles.size > 8 ? ` (+${allFiles.size - 8} more)` : ''}`);
  }

  // Key content from first and last observations
  const first = observations[0];
  if (first.tool_input_summary) {
    parts.push(`Started: ${truncateIntelligent(first.tool_input_summary, 100)}`);
  }

  if (observations.length > 1) {
    const last = observations[observations.length - 1];
    if (last.tool_input_summary) {
      parts.push(`Ended: ${truncateIntelligent(last.tool_input_summary, 100)}`);
    }
  }

  return parts.join('\n');
}

// --- Private helpers ---

function extractReadSummary(input: unknown): string {
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    return `Read ${obj['file_path'] || 'file'}`;
  }
  return truncateIntelligent(String(input), 200);
}

function extractEditSummary(input: unknown): string {
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    const file = obj['file_path'] || 'file';
    const old = truncateIntelligent(String(obj['old_string'] || ''), 60);
    const new_ = truncateIntelligent(String(obj['new_string'] || ''), 60);
    return `Edit ${file}: "${old}" → "${new_}"`;
  }
  return truncateIntelligent(String(input), 200);
}

function extractWriteSummary(input: unknown): string {
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    return `Write ${obj['file_path'] || 'file'}`;
  }
  return truncateIntelligent(String(input), 200);
}

function extractBashSummary(input: unknown): string {
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    return `$ ${truncateIntelligent(String(obj['command'] || ''), 200)}`;
  }
  return truncateIntelligent(String(input), 200);
}

function extractSearchSummary(toolName: string, input: unknown): string {
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    return `${toolName}: ${obj['pattern'] || obj['query'] || ''} in ${obj['path'] || '.'}`;
  }
  return truncateIntelligent(String(input), 200);
}

function extractWebSummary(input: unknown): string {
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    return `Web: ${obj['url'] || obj['query'] || ''}`;
  }
  return truncateIntelligent(String(input), 200);
}

function summarizeFileContent(output: string): string {
  const lines = output.split('\n');
  if (lines.length <= 10) return output;

  const head = lines.slice(0, 5).join('\n');
  const tail = lines.slice(-3).join('\n');
  return `${head}\n... (${lines.length} total lines) ...\n${tail}`;
}

function summarizeBashOutput(output: string): string {
  // Prioritize error lines
  const lines = output.split('\n');
  const errorLines = lines.filter(l =>
    /error|Error|ERROR|failed|FAILED|fatal|FATAL|warning|Warning/i.test(l)
  );

  if (errorLines.length > 0) {
    return errorLines.slice(0, 5).join('\n');
  }

  return truncateIntelligent(output, 500);
}

function summarizeSearchOutput(output: string): string {
  const lines = output.split('\n').filter(l => l.trim());
  if (lines.length <= 10) return output;
  return lines.slice(0, 10).join('\n') + `\n... (${lines.length} total matches)`;
}

export function truncateIntelligent(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text;

  // Try to break at a natural boundary
  const truncated = text.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastSpace, lastNewline, maxLen - 50);

  return text.substring(0, breakPoint) + '...';
}

function isCommonWord(word: string): boolean {
  const common = new Set([
    'if', 'else', 'for', 'while', 'return', 'const', 'let', 'var',
    'function', 'class', 'new', 'this', 'that', 'true', 'false',
    'null', 'undefined', 'import', 'export', 'from', 'require',
    'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof',
  ]);
  return common.has(word.toLowerCase());
}
