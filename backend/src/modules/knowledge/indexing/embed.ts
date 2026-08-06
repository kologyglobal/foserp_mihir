import { env } from '../../../config/env.js'
import { resolveKnowledgeEmbeddingLlmConfig } from '../llm-config.js'
import { logger } from '../../../config/logger.js'
import {
  KNOWLEDGE_LOCAL_EMBEDDING_DIM,
  KNOWLEDGE_LOCAL_EMBEDDING_MODEL,
} from '../knowledge.constants.js'
import { localHashEmbed, localEmbeddingModelId } from './text-pipeline.js'

export type EmbeddingResult = {
  modelId: string
  dimensions: number
  vectors: number[][]
  provider: 'openai-compatible' | 'local-hash'
}

function openaiConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const cfg = resolveKnowledgeEmbeddingLlmConfig()
  if (!cfg) return null
  return { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model }
}

async function embedOpenAiCompatible(
  texts: string[],
  cfg: { apiKey: string; baseUrl: string; model: string },
): Promise<number[][]> {
  const vectors: number[][] = []
  const size = 32
  for (let i = 0; i < texts.length; i += size) {
    const batch = texts.slice(i, i + size)
    const res = await fetch(`${cfg.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        input: batch,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Embedding API ${res.status}: ${body.slice(0, 300)}`)
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding: number[]; index: number }>
    }
    const ordered = [...(json.data ?? [])].sort((a, b) => a.index - b.index)
    if (ordered.length !== batch.length) {
      throw new Error('Embedding API returned unexpected batch size')
    }
    for (const row of ordered) {
      vectors.push(row.embedding)
    }
  }
  return vectors
}

function localEmbedResult(texts: string[]): EmbeddingResult {
  const vectors = texts.map((t) => localHashEmbed(t, KNOWLEDGE_LOCAL_EMBEDDING_DIM))
  return {
    modelId: KNOWLEDGE_LOCAL_EMBEDDING_MODEL,
    dimensions: KNOWLEDGE_LOCAL_EMBEDDING_DIM,
    vectors,
    provider: 'local-hash',
  }
}

/**
 * Embed texts using OpenAI-compatible API when configured; otherwise local hash vectors.
 * On OpenAI failures (quota/429/network), falls back to local-hash so RAG search still works.
 */
export async function embedTexts(texts: string[]): Promise<EmbeddingResult> {
  if (texts.length === 0) {
    return {
      modelId: localEmbeddingModelId(),
      dimensions: KNOWLEDGE_LOCAL_EMBEDDING_DIM,
      vectors: [],
      provider: 'local-hash',
    }
  }

  const cfg = openaiConfig()
  if (cfg) {
    try {
      const vectors = await embedOpenAiCompatible(texts, cfg)
      return {
        modelId: cfg.model,
        dimensions: vectors[0]?.length ?? 0,
        vectors,
        provider: 'openai-compatible',
      }
    } catch (err) {
      logger.warn('OpenAI embeddings unavailable; using local-hash vectors', {
        message: err instanceof Error ? err.message.slice(0, 240) : String(err),
      })
      return localEmbedResult(texts)
    }
  }

  return localEmbedResult(texts)
}

export function isIndexingEnabled(): boolean {
  // Default ON when unset (Wave 3). Explicit false disables.
  return env.KB_INDEXING_ENABLED !== false
}

export function isOcrEnabled(): boolean {
  return env.KB_OCR_ENABLED === true
}

