/**
 * Local embedding provider using fastembed (ONNX-based, no external API needed).
 *
 * Uses BAAI/bge-small-en-v1.5 by default (384 dimensions, ~33MB model).
 * The ONNX model is downloaded and cached on first use.
 *
 * NOTE: This file is named anthropic.ts for historical reasons (was originally
 * an Anthropic API provider). The export names are kept as-is to avoid
 * updating every import site. A future cleanup can rename to fastembed.ts.
 */

import { createLogger } from '../shared/logger.js';
import type { EmbeddingProvider } from './provider.js';

const log = createLogger('embeddings:fastembed');

// Dynamic import — fastembed may not be installed or may fail to load ONNX runtime
let FastEmbedModule: typeof import('fastembed') | null = null;
let fastEmbedLoadAttempted = false;

async function loadFastEmbed(): Promise<typeof import('fastembed') | null> {
  if (fastEmbedLoadAttempted) return FastEmbedModule;
  fastEmbedLoadAttempted = true;
  try {
    FastEmbedModule = await import('fastembed');
    log.info('fastembed module loaded successfully');
  } catch (err) {
    log.warn('fastembed not available — local embeddings disabled', { error: String(err) });
    FastEmbedModule = null;
  }
  return FastEmbedModule;
}

/**
 * Local embedding provider using fastembed with BGE-small-en-v1.5.
 *
 * The model (~33MB) is downloaded on first use and cached locally.
 * No API key or network access is needed after the initial download.
 */
export class AnthropicEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 384;
  private _available: boolean | null = null;
  private model: Awaited<ReturnType<typeof import('fastembed')['FlagEmbedding']['init']>> | null = null;
  private initPromise: Promise<void> | null = null;

  get available(): boolean {
    // Optimistic: assume available until proven otherwise.
    // Actual availability is confirmed on first embed() call.
    if (this._available === null) return true;
    return this._available;
  }

  private async ensureModel(): Promise<boolean> {
    if (this.model) return true;

    if (this.initPromise) {
      await this.initPromise;
      return this.model !== null;
    }

    this.initPromise = (async () => {
      try {
        const mod = await loadFastEmbed();
        if (!mod) {
          this._available = false;
          return;
        }

        const { EmbeddingModel, FlagEmbedding } = mod;
        this.model = await FlagEmbedding.init({
          model: EmbeddingModel.BGESmallENV15,
        });
        this._available = true;
        log.info('fastembed model initialized (BGE-small-en-v1.5, 384d)');
      } catch (err) {
        log.error('Failed to initialize fastembed model', { error: String(err) });
        this._available = false;
        this.model = null;
      }
    })();

    await this.initPromise;
    return this.model !== null;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const ready = await this.ensureModel();
    if (!ready || !this.model) {
      throw new Error('fastembed provider is not available');
    }

    const results: number[][] = [];

    try {
      // fastembed returns an async iterable of batches
      const embeddings = this.model.embed(texts);
      for await (const batch of embeddings) {
        for (const embedding of batch) {
          results.push(Array.from(embedding));
        }
      }
    } catch (err) {
      log.error('fastembed embed() failed', { error: String(err), textCount: texts.length });
      throw err;
    }

    // Sanity check: ensure we got the right number of embeddings
    if (results.length !== texts.length) {
      log.warn('Embedding count mismatch', { expected: texts.length, got: results.length });
      // Pad with zero vectors if needed
      while (results.length < texts.length) {
        results.push(new Array(this.dimensions).fill(0));
      }
    }

    return results;
  }
}

/** Singleton instance of the local fastembed provider. */
export const anthropicEmbeddings = new AnthropicEmbeddingProvider();
