/**
 * Simple token estimation — approximately 0.75 tokens per word for English.
 * No external tokenizer dependency needed.
 */

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(w => w.length > 0);
  // Rough approximation: ~0.75 tokens per word for English
  // Code tends to be slightly higher due to punctuation
  return Math.ceil(words.length * 0.75);
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const estimatedWordsNeeded = Math.floor(maxTokens / 0.75);

  if (words.length <= estimatedWordsNeeded) return text;

  return words.slice(0, estimatedWordsNeeded).join(' ') + '...';
}

export function fitWithinBudget(
  items: Array<{ text: string; priority: number }>,
  totalBudget: number,
): string[] {
  // Sort by priority (higher first)
  const sorted = [...items].sort((a, b) => b.priority - a.priority);

  const result: string[] = [];
  let usedTokens = 0;

  for (const item of sorted) {
    const tokens = estimateTokens(item.text);
    if (usedTokens + tokens <= totalBudget) {
      result.push(item.text);
      usedTokens += tokens;
    } else {
      // Try to fit a truncated version
      const remaining = totalBudget - usedTokens;
      if (remaining > 20) {
        result.push(truncateToTokens(item.text, remaining));
        break;
      }
      break;
    }
  }

  return result;
}
