import { prisma } from '../../../config/prisma.js'
import {
  DEFAULT_SEARCH_TOP_K,
  MAX_SEARCH_TOP_K,
  MAX_SEMANTIC_SCAN_CHUNKS,
} from '../knowledge.constants.js'
import { cosineSimilarity } from './text-pipeline.js'
import { embedTexts } from './embed.js'

export type SearchHit = {
  documentId: string
  documentTitle: string
  documentStatus: string
  chunkId: string
  chunkIndex: number
  headingPath: string | null
  snippet: string
  score: number
  scoreKind: 'keyword' | 'semantic' | 'hybrid'
}

export type SearchResult = {
  query: string
  mode: 'keyword' | 'semantic' | 'hybrid'
  modelId: string | null
  embedProvider: string | null
  hits: SearchHit[]
  totalScanned: number
}

function clampTopK(n?: number): number {
  if (!n || !Number.isFinite(n)) return DEFAULT_SEARCH_TOP_K
  return Math.min(Math.max(1, Math.floor(n)), MAX_SEARCH_TOP_K)
}

function snippet(text: string, max = 280): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

function keywordScore(content: string, terms: string[]): number {
  if (terms.length === 0) return 0
  const lower = content.toLowerCase()
  let hits = 0
  let score = 0
  for (const t of terms) {
    if (lower.includes(t)) {
      hits += 1
      // count occurrences (cap)
      let idx = 0
      let count = 0
      while ((idx = lower.indexOf(t, idx)) !== -1 && count < 20) {
        count += 1
        idx += t.length
      }
      score += count
    }
  }
  if (hits === 0) return 0
  // Coverage * density
  return (hits / terms.length) * Math.log1p(score)
}

export async function keywordSearch(opts: {
  tenantId: string
  query: string
  topK?: number
  categoryId?: string
  documentId?: string
}): Promise<SearchResult> {
  const topK = clampTopK(opts.topK)
  const terms = tokenize(opts.query)
  const q = opts.query.trim()

  const docs = await prisma.knowledgeDocument.findMany({
    where: {
      tenantId: opts.tenantId,
      deletedAt: null,
      status: 'READY',
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts.documentId ? { id: opts.documentId } : {}),
    },
    select: { id: true, title: true, status: true },
    take: 500,
  })
  const docMap = new Map(docs.map((d) => [d.id, d]))
  const docIds = docs.map((d) => d.id)
  if (docIds.length === 0) {
    return { query: q, mode: 'keyword', modelId: null, embedProvider: null, hits: [], totalScanned: 0 }
  }

  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      tenantId: opts.tenantId,
      documentId: { in: docIds },
      OR: [
        { contentMd: { contains: q } },
        ...terms.slice(0, 8).map((t) => ({ contentMd: { contains: t } })),
      ],
    },
    take: MAX_SEMANTIC_SCAN_CHUNKS,
    select: {
      id: true,
      documentId: true,
      chunkIndex: true,
      headingPath: true,
      contentMd: true,
    },
  })

  const scored = chunks
    .map((c) => {
      const doc = docMap.get(c.documentId)
      if (!doc) return null
      const score = keywordScore(c.contentMd, terms.length ? terms : [q.toLowerCase()])
      if (score <= 0) return null
      return {
        documentId: c.documentId,
        documentTitle: doc.title,
        documentStatus: doc.status,
        chunkId: c.id,
        chunkIndex: c.chunkIndex,
        headingPath: c.headingPath,
        snippet: snippet(c.contentMd),
        score,
        scoreKind: 'keyword' as const,
      }
    })
    .filter(Boolean) as SearchHit[]

  scored.sort((a, b) => b.score - a.score)
  return {
    query: q,
    mode: 'keyword',
    modelId: null,
    embedProvider: null,
    hits: scored.slice(0, topK),
    totalScanned: chunks.length,
  }
}

export async function semanticSearch(opts: {
  tenantId: string
  query: string
  topK?: number
  categoryId?: string
  documentId?: string
}): Promise<SearchResult> {
  const topK = clampTopK(opts.topK)
  const q = opts.query.trim()
  const embed = await embedTexts([q])
  const queryVec = embed.vectors[0]
  if (!queryVec) {
    return {
      query: q,
      mode: 'semantic',
      modelId: embed.modelId,
      embedProvider: embed.provider,
      hits: [],
      totalScanned: 0,
    }
  }

  const docs = await prisma.knowledgeDocument.findMany({
    where: {
      tenantId: opts.tenantId,
      deletedAt: null,
      status: 'READY',
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts.documentId ? { id: opts.documentId } : {}),
    },
    select: { id: true, title: true, status: true },
    take: 500,
  })
  const docMap = new Map(docs.map((d) => [d.id, d]))
  const docIds = docs.map((d) => d.id)
  if (docIds.length === 0) {
    return {
      query: q,
      mode: 'semantic',
      modelId: embed.modelId,
      embedProvider: embed.provider,
      hits: [],
      totalScanned: 0,
    }
  }

  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      tenantId: opts.tenantId,
      documentId: { in: docIds },
    },
    take: MAX_SEMANTIC_SCAN_CHUNKS,
    select: {
      id: true,
      documentId: true,
      chunkIndex: true,
      headingPath: true,
      contentMd: true,
      embeddings: {
        where: { modelId: embed.modelId },
        take: 1,
        select: { vectorJson: true, modelId: true },
      },
    },
  })

  // If no embeddings match exact model, fall back to any embedding for chunk
  const scored: SearchHit[] = []
  for (const c of chunks) {
    let vectorJson: unknown = c.embeddings[0]?.vectorJson
    if (vectorJson == null) {
      const any = await prisma.knowledgeEmbedding.findFirst({
        where: { tenantId: opts.tenantId, chunkId: c.id },
        select: { vectorJson: true, modelId: true },
      })
      vectorJson = any?.vectorJson ?? null
    }
    if (!vectorJson || !Array.isArray(vectorJson)) continue
    const vec = vectorJson as number[]
    // Skip dimension mismatch (local vs openai)
    if (vec.length !== queryVec.length) continue
    const doc = docMap.get(c.documentId)
    if (!doc) continue
    const score = cosineSimilarity(queryVec, vec)
    if (score <= 0) continue
    scored.push({
      documentId: c.documentId,
      documentTitle: doc.title,
      documentStatus: doc.status,
      chunkId: c.id,
      chunkIndex: c.chunkIndex,
      headingPath: c.headingPath,
      snippet: snippet(c.contentMd),
      score,
      scoreKind: 'semantic',
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return {
    query: q,
    mode: 'semantic',
    modelId: embed.modelId,
    embedProvider: embed.provider,
    hits: scored.slice(0, topK),
    totalScanned: chunks.length,
  }
}

/** Reciprocal rank fusion of keyword + semantic. */
export async function hybridSearch(opts: {
  tenantId: string
  query: string
  topK?: number
  categoryId?: string
  documentId?: string
}): Promise<SearchResult> {
  const topK = clampTopK(opts.topK)
  const [kw, sem] = await Promise.all([
    keywordSearch({ ...opts, topK: Math.min(topK * 3, MAX_SEARCH_TOP_K) }),
    semanticSearch({ ...opts, topK: Math.min(topK * 3, MAX_SEARCH_TOP_K) }),
  ])

  const k = 60
  const fused = new Map<
    string,
    SearchHit & { rrf: number }
  >()

  kw.hits.forEach((hit, rank) => {
    const key = hit.chunkId
    const prev = fused.get(key)
    const rrf = 1 / (k + rank + 1)
    if (prev) {
      prev.rrf += rrf
      prev.score = prev.rrf
      prev.scoreKind = 'hybrid'
    } else {
      fused.set(key, { ...hit, scoreKind: 'hybrid', rrf, score: rrf })
    }
  })

  sem.hits.forEach((hit, rank) => {
    const key = hit.chunkId
    const prev = fused.get(key)
    const rrf = 1 / (k + rank + 1)
    if (prev) {
      prev.rrf += rrf
      prev.score = prev.rrf
      prev.scoreKind = 'hybrid'
    } else {
      fused.set(key, { ...hit, scoreKind: 'hybrid', rrf, score: rrf })
    }
  })

  const hits = [...fused.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, topK)
    .map(({ rrf: _r, ...hit }) => hit)

  return {
    query: opts.query.trim(),
    mode: 'hybrid',
    modelId: sem.modelId,
    embedProvider: sem.embedProvider,
    hits,
    totalScanned: Math.max(kw.totalScanned, sem.totalScanned),
  }
}
