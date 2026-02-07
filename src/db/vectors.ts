import { getDb, isVectorsAvailable, generateId } from './database.js';
import { createLogger } from '../shared/logger.js';
import crypto from 'node:crypto';

const log = createLogger('db:vectors');

export function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

export function storeEmbedding(
  sourceType: 'observation' | 'knowledge' | 'session',
  sourceId: string,
  text: string,
  embedding: number[],
): boolean {
  if (!isVectorsAvailable()) return false;

  const db = getDb();
  const id = generateId('emb');
  const textHash = hashText(text);
  const now = Date.now();

  try {
    // Check if we already have an embedding for this source
    const existing = db.prepare(
      'SELECT id, text_hash FROM embeddings WHERE source_type = ? AND source_id = ?'
    ).get(sourceType, sourceId) as { id: string; text_hash: string } | undefined;

    if (existing) {
      if (existing.text_hash === textHash) {
        // Same text, no need to re-embed
        return true;
      }
      // Different text, delete old embedding
      db.prepare('DELETE FROM embeddings WHERE id = ?').run(existing.id);
      db.prepare('DELETE FROM vec_embeddings WHERE id = ?').run(existing.id);
    }

    // Store embedding metadata
    db.prepare(`
      INSERT INTO embeddings (id, source_type, source_id, text_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, sourceType, sourceId, textHash, now);

    // Store vector in sqlite-vec
    const embeddingBuffer = new Float32Array(embedding).buffer;
    db.prepare('INSERT INTO vec_embeddings (id, embedding) VALUES (?, ?)').run(
      id, Buffer.from(embeddingBuffer)
    );

    log.debug('Stored embedding', { id, sourceType, sourceId });
    return true;
  } catch (err) {
    log.error('Failed to store embedding', { error: err });
    return false;
  }
}

export interface VectorSearchResult {
  embedding_id: string;
  source_type: string;
  source_id: string;
  distance: number;
}

export function searchByVector(queryEmbedding: number[], limit: number = 20): VectorSearchResult[] {
  if (!isVectorsAvailable()) return [];

  const db = getDb();
  try {
    const embeddingBuffer = new Float32Array(queryEmbedding).buffer;
    const rows = db.prepare(`
      SELECT v.id, v.distance, e.source_type, e.source_id
      FROM vec_embeddings v
      JOIN embeddings e ON v.id = e.id
      WHERE v.embedding MATCH ?
      ORDER BY v.distance ASC
      LIMIT ?
    `).all(Buffer.from(embeddingBuffer), limit) as Array<{
      id: string;
      distance: number;
      source_type: string;
      source_id: string;
    }>;

    return rows.map(row => ({
      embedding_id: row.id,
      source_type: row.source_type,
      source_id: row.source_id,
      distance: row.distance,
    }));
  } catch (err) {
    log.error('Vector search failed', { error: err });
    return [];
  }
}

export function deleteEmbedding(sourceType: string, sourceId: string): boolean {
  if (!isVectorsAvailable()) return false;

  const db = getDb();
  try {
    const existing = db.prepare(
      'SELECT id FROM embeddings WHERE source_type = ? AND source_id = ?'
    ).get(sourceType, sourceId) as { id: string } | undefined;

    if (!existing) return false;

    db.prepare('DELETE FROM vec_embeddings WHERE id = ?').run(existing.id);
    db.prepare('DELETE FROM embeddings WHERE id = ?').run(existing.id);
    return true;
  } catch (err) {
    log.error('Failed to delete embedding', { error: err });
    return false;
  }
}

export function countEmbeddings(): number {
  const db = getDb();
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM embeddings').get() as { count: number };
    return row.count;
  } catch {
    return 0;
  }
}
