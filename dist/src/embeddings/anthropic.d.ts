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
import type { EmbeddingProvider } from './provider.js';
/**
 * Local embedding provider using fastembed with BGE-small-en-v1.5.
 *
 * The model (~33MB) is downloaded on first use and cached locally.
 * No API key or network access is needed after the initial download.
 */
export declare class AnthropicEmbeddingProvider implements EmbeddingProvider {
    readonly dimensions = 384;
    private _available;
    private model;
    private initPromise;
    get available(): boolean;
    private ensureModel;
    embed(texts: string[]): Promise<number[][]>;
}
/** Singleton instance of the local fastembed provider. */
export declare const anthropicEmbeddings: AnthropicEmbeddingProvider;
