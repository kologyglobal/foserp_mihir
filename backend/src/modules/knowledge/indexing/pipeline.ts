import { prisma } from '../../../config/prisma.js'
import { readKnowledgeDocumentFile } from '../../../services/fileStorage.service.js'
import { DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE } from '../knowledge.constants.js'
import * as repo from '../knowledge.repository.js'
import { contentHash, extractToMarkdown, chunkMarkdown } from './text-pipeline.js'
import { embedTexts, isIndexingEnabled, isOcrEnabled } from './embed.js'

export type IndexPipelineResult = {
  documentId: string
  status: 'READY' | 'FAILED'
  versionId: string | null
  versionNo: number | null
  chunkCount: number
  embeddingCount: number
  extractor: string | null
  embedProvider: string | null
  modelId: string | null
  warnings: string[]
  error: string | null
}

function chunkSize(): number {
  const n = Number(process.env.KB_CHUNK_SIZE)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CHUNK_SIZE
}

function chunkOverlap(): number {
  const n = Number(process.env.KB_CHUNK_OVERLAP)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CHUNK_OVERLAP
}

/**
 * Full Wave 3 pipeline: extract → version → chunk → embed → READY/FAILED.
 */
export async function runDocumentIndexPipeline(opts: {
  tenantId: string
  documentId: string
  userId: string | null
}): Promise<IndexPipelineResult> {
  const { tenantId, documentId, userId } = opts

  if (!isIndexingEnabled()) {
    return {
      documentId,
      status: 'FAILED',
      versionId: null,
      versionNo: null,
      chunkCount: 0,
      embeddingCount: 0,
      extractor: null,
      embedProvider: null,
      modelId: null,
      warnings: [],
      error: 'Indexing is disabled (KB_INDEXING_ENABLED=false)',
    }
  }

  const doc = await repo.findDocumentById(tenantId, documentId)
  if (!doc) {
    return {
      documentId,
      status: 'FAILED',
      versionId: null,
      versionNo: null,
      chunkCount: 0,
      embeddingCount: 0,
      extractor: null,
      embedProvider: null,
      modelId: null,
      warnings: [],
      error: 'Document not found',
    }
  }

  await repo.updateDocument(tenantId, documentId, {
    status: 'PROCESSING',
    indexingError: null,
    updatedBy: userId,
  })

  try {
    let buffer: Buffer | null = null
    if (doc.storageKey) {
      buffer = await readKnowledgeDocumentFile(doc.storageKey)
    }

    const latestVersion = await prisma.knowledgeVersion.findFirst({
      where: { tenantId, documentId },
      orderBy: { versionNo: 'desc' },
      select: { id: true, versionNo: true, markdownContent: true, contentHash: true },
    })

    const extracted = await extractToMarkdown({
      buffer,
      mimeType: doc.mimeType,
      originalFilename: doc.originalFilename,
      sourceUrl: doc.sourceUrl,
      existingMarkdown: latestVersion?.markdownContent ?? null,
      ocrEnabled: isOcrEnabled(),
    })

    const md = extracted.markdown.trim()
    if (!md) {
      throw new Error('Extracted markdown is empty')
    }

    const hash = contentHash(md)
    let versionId = latestVersion?.id ?? null
    let versionNo = latestVersion?.versionNo ?? null

    if (!latestVersion || latestVersion.contentHash !== hash || !latestVersion.markdownContent) {
      versionNo = (latestVersion?.versionNo ?? 0) + 1
      const version = await repo.createVersion({
        tenantId,
        documentId,
        versionNo,
        markdownContent: md,
        contentHash: hash,
        changeSummary: `Indexed extract (${extracted.extractor})`,
        createdBy: userId,
      })
      versionId = version.id
      await repo.updateDocument(tenantId, documentId, {
        currentVersionId: versionId,
        updatedBy: userId,
      })
    }

    // Replace chunks + embeddings for this document
    await prisma.knowledgeChunk.deleteMany({ where: { tenantId, documentId } })

    const textChunks = chunkMarkdown(md, {
      chunkSize: chunkSize(),
      overlap: chunkOverlap(),
    })
    if (textChunks.length === 0) {
      throw new Error('Chunker produced zero chunks')
    }

    const createdChunks = await prisma.$transaction(
      textChunks.map((c) =>
        prisma.knowledgeChunk.create({
          data: {
            tenantId,
            documentId,
            versionId,
            chunkIndex: c.chunkIndex,
            headingPath: c.headingPath,
            contentMd: c.contentMd,
            tokenCount: c.tokenCount,
            charStart: c.charStart,
            charEnd: c.charEnd,
            metadataJson: { extractor: extracted.extractor },
          },
        }),
      ),
    )

    const embed = await embedTexts(createdChunks.map((c) => c.contentMd))
    if (embed.vectors.length !== createdChunks.length) {
      throw new Error('Embedding count mismatch')
    }

    await prisma.$transaction(
      createdChunks.map((chunk, i) =>
        prisma.knowledgeEmbedding.create({
          data: {
            tenantId,
            chunkId: chunk.id,
            modelId: embed.modelId,
            dimensions: embed.dimensions,
            vectorJson: embed.vectors[i]!,
            contentHash: contentHash(chunk.contentMd),
          },
        }),
      ),
    )

    await repo.updateDocument(tenantId, documentId, {
      status: 'READY',
      indexedAt: new Date(),
      publishedAt: doc.publishedAt ?? new Date(),
      indexingError: null,
      updatedBy: userId,
    })

    return {
      documentId,
      status: 'READY',
      versionId,
      versionNo,
      chunkCount: createdChunks.length,
      embeddingCount: createdChunks.length,
      extractor: extracted.extractor,
      embedProvider: embed.provider,
      modelId: embed.modelId,
      warnings: extracted.warnings,
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await repo.updateDocument(tenantId, documentId, {
      status: 'FAILED',
      indexingError: message.slice(0, 2000),
      updatedBy: userId,
    })
    return {
      documentId,
      status: 'FAILED',
      versionId: null,
      versionNo: null,
      chunkCount: 0,
      embeddingCount: 0,
      extractor: null,
      embedProvider: null,
      modelId: null,
      warnings: [],
      error: message,
    }
  }
}
