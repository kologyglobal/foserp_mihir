import { createHash, randomUUID } from 'node:crypto'
import type { Request } from 'express'
import type { KnowledgeDocumentKind, KnowledgeDocumentStatus } from '@prisma/client'
import { env } from '../../config/env.js'
import {
  hasKnowledgeGenerativeLlm,
  resolveKnowledgeChatLlmConfig,
} from './llm-config.js'
import {
  getAttachmentExtension,
  readKnowledgeDocumentFile,
  saveKnowledgeDocumentFile,
} from '../../services/fileStorage.service.js'
import { auditFromRequest, createAuditLog } from '../../services/audit.service.js'
import {
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js'
import type { PaginationInput } from '../../utils/pagination.js'
import { buildPaginationMeta, getPagination } from '../../utils/pagination.js'
import {
  KNOWLEDGE_ALLOWED_EXTENSIONS,
  KNOWLEDGE_ALLOWED_MIME,
  KNOWLEDGE_FEATURES,
  KNOWLEDGE_WAVE,
  type KnowledgeDocumentStatusName,
} from './knowledge.constants.js'
import * as repo from './knowledge.repository.js'
import { assertStatusTransition } from './knowledge.status.js'
import type {
  CreateKnowledgeDocumentJson,
  KnowledgeSearchInput,
  TransitionKnowledgeDocumentInput,
  UpdateKnowledgeDocumentInput,
} from './knowledge.validation.js'
import { runDocumentIndexPipeline } from './indexing/pipeline.js'
import { hybridSearch, keywordSearch, semanticSearch } from './indexing/search.js'
import { isIndexingEnabled } from './indexing/embed.js'

function mapDocument(row: repo.KnowledgeDocumentRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    kind: row.kind,
    mimeType: row.mimeType,
    originalFilename: row.originalFilename,
    storageKey: row.storageKey,
    fileSize: row.fileSize,
    sourceUrl: row.sourceUrl,
    language: row.language,
    categoryId: row.categoryId,
    sourceId: row.sourceId,
    currentVersionId: row.currentVersionId,
    ownerUserId: row.ownerUserId,
    indexingError: row.indexingError,
    indexedAt: row.indexedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    hasFile: Boolean(row.storageKey),
  }
}

function hashContent(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function maxUploadBytes(): number {
  return env.KB_MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024
}

function assertFileAllowed(originalFilename: string, mimeType: string, sizeBytes: number): void {
  if (sizeBytes <= 0) {
    throw new ValidationError('File is empty', [
      { field: 'file', message: 'Uploaded file has no content' },
    ])
  }
  if (sizeBytes > maxUploadBytes()) {
    throw new ValidationError('File too large', [
      {
        field: 'file',
        message: `Maximum size is ${Math.floor(maxUploadBytes() / (1024 * 1024))} MB`,
      },
    ])
  }
  const ext = getAttachmentExtension(originalFilename).toLowerCase()
  if (ext && !KNOWLEDGE_ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError('Unsupported file type', [
      { field: 'file', message: `Extension ${ext} is not allowed` },
    ])
  }
  const mime = mimeType.toLowerCase()
  if (!KNOWLEDGE_ALLOWED_MIME.has(mime) && mime !== 'application/octet-stream') {
    // Allow when extension is known even if browser sends odd MIME.
    if (!ext || !KNOWLEDGE_ALLOWED_EXTENSIONS.has(ext)) {
      throw new ValidationError('Unsupported MIME type', [
        { field: 'mimeType', message: `${mimeType} is not allowed` },
      ])
    }
  }
}

function inferKindFromMime(
  mimeType: string | null | undefined,
  hasMarkdown: boolean,
  hasUrl: boolean,
): KnowledgeDocumentKind {
  if (hasMarkdown) {
    if (mimeType?.includes('html')) return 'HTML'
    if (mimeType?.includes('markdown') || mimeType?.includes('md')) return 'MARKDOWN'
    return 'TEXT'
  }
  if (hasUrl) return 'URL'
  return 'UPLOAD'
}

async function assertCategoryAndSource(
  tenantId: string,
  categoryId?: string | null,
  sourceId?: string | null,
): Promise<void> {
  if (categoryId) {
    const ok = await repo.categoryExists(tenantId, categoryId)
    if (!ok) {
      throw new ValidationError('Invalid category', [
        { field: 'categoryId', message: 'Category not found in this tenant' },
      ])
    }
  }
  if (sourceId) {
    const ok = await repo.sourceExists(tenantId, sourceId)
    if (!ok) {
      throw new ValidationError('Invalid source', [
        { field: 'sourceId', message: 'Source not found in this tenant' },
      ])
    }
  }
}

async function logActivity(
  req: Request,
  tenantId: string,
  action: string,
  documentId: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const audit = auditFromRequest(req)
  await repo.writeActivity({
    tenantId,
    userId: audit.userId,
    action,
    entityType: 'KnowledgeDocument',
    entityId: documentId,
    message,
    metaJson: meta as never,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'knowledge',
    entity: 'KnowledgeDocument',
    entityId: documentId,
    action,
    newValues: meta,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}

export async function getWaveStatus(tenantId: string) {
  const [documents, categories, tags, sessions, embeddings] = await Promise.all([
    repo.countDocuments(tenantId),
    repo.countCategories(tenantId),
    repo.countTags(tenantId),
    repo.countSessions(tenantId),
    repo.countEmbeddings(tenantId),
  ])

  return {
    wave: KNOWLEDGE_WAVE,
    module: 'knowledge',
    message:
      'Knowledge Base Wave 5: Copilot with ERP screen context + knowledge RAG. Insights/admin deferred.',
    features: { ...KNOWLEDGE_FEATURES },
    indexingEnabled: isIndexingEnabled(),
    embeddingMode: env.OPENAI_API_KEY ? 'openai-compatible' : 'local-hash',
    chatMode: hasKnowledgeGenerativeLlm() ? 'generative' : 'local-extractive',
    copilotMode: hasKnowledgeGenerativeLlm() ? 'generative' : 'local-extractive',
    llmProvider: resolveKnowledgeChatLlmConfig()?.provider ?? null,
    counts: { documents, categories, tags, sessions, embeddings },
  }
}

export async function listDocuments(
  tenantId: string,
  query: PaginationInput & {
    status?: string
    categoryId?: string
    kind?: string
    search?: string
  },
) {
  const { skip, take, page, limit } = getPagination(query)
  const { items, total } = await repo.listDocuments(tenantId, {
    skip,
    take,
    status: query.status,
    categoryId: query.categoryId,
    kind: query.kind,
    search: query.search,
  })
  return { items: items.map(mapDocument), meta: buildPaginationMeta(total, page, limit) }
}

export async function getDocument(tenantId: string, id: string) {
  const row = await repo.findDocumentById(tenantId, id)
  if (!row) throw new NotFoundError('Knowledge document not found')
  const versions = await repo.listVersions(tenantId, id)
  return {
    ...mapDocument(row),
    versions: versions.map((v) => ({
      id: v.id,
      versionNo: v.versionNo,
      contentHash: v.contentHash,
      changeSummary: v.changeSummary,
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
    })),
  }
}

type CreateFileInput = {
  originalFilename: string
  mimeType: string
  buffer: Buffer
}

export async function createDocumentFromJson(
  req: Request,
  tenantId: string,
  userId: string,
  input: CreateKnowledgeDocumentJson,
) {
  await assertCategoryAndSource(tenantId, input.categoryId, input.sourceId)

  let file: CreateFileInput | null = null
  if (input.file) {
    let buffer: Buffer
    try {
      buffer = Buffer.from(input.file.contentBase64, 'base64')
    } catch {
      throw new ValidationError('Invalid file content', [
        { field: 'file.contentBase64', message: 'Could not decode base64 content' },
      ])
    }
    assertFileAllowed(input.file.originalFilename, input.file.mimeType, buffer.length)
    file = {
      originalFilename: input.file.originalFilename,
      mimeType: input.file.mimeType,
      buffer,
    }
  }

  return createDocumentCore(req, tenantId, userId, {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    sourceId: input.sourceId,
    language: input.language,
    kindHint: input.kind ?? null,
    sourceUrl: input.sourceUrl,
    markdownContent: input.markdownContent,
    publish: input.publish === true,
    file,
  })
}

export async function createDocumentFromMultipart(
  req: Request,
  tenantId: string,
  userId: string,
  meta: {
    title?: string
    description?: string
    categoryId?: string
    sourceId?: string
    language?: string
    publish?: boolean
  },
  uploaded: Express.Multer.File | undefined,
) {
  if (!uploaded) {
    throw new ValidationError('File is required for multipart upload', [
      { field: 'file', message: 'Attach a file field named "file"' },
    ])
  }
  const title =
    meta.title?.trim() ||
    uploaded.originalname?.trim() ||
    'Untitled document'
  await assertCategoryAndSource(tenantId, meta.categoryId, meta.sourceId)
  assertFileAllowed(uploaded.originalname, uploaded.mimetype, uploaded.size)

  return createDocumentCore(req, tenantId, userId, {
    title,
    description: meta.description ?? null,
    categoryId: meta.categoryId ?? null,
    sourceId: meta.sourceId ?? null,
    language: meta.language ?? null,
    kindHint: 'UPLOAD',
    sourceUrl: null,
    markdownContent: null,
    publish: meta.publish === true,
    file: {
      originalFilename: uploaded.originalname,
      mimeType: uploaded.mimetype,
      buffer: uploaded.buffer,
    },
  })
}

async function createDocumentCore(
  req: Request,
  tenantId: string,
  userId: string,
  input: {
    title: string
    description?: string | null
    categoryId?: string | null
    sourceId?: string | null
    language?: string | null
    kindHint: KnowledgeDocumentKind | null
    sourceUrl?: string | null
    markdownContent?: string | null
    publish: boolean
    file: CreateFileInput | null
  },
) {
  const hasMd = Boolean(input.markdownContent?.trim())
  const hasUrl = Boolean(input.sourceUrl?.trim())
  const kind: KnowledgeDocumentKind =
    input.kindHint ??
    inferKindFromMime(input.file?.mimeType, hasMd, hasUrl)

  // Text/Markdown with content can publish immediately when requested.
  // Binary uploads stay DRAFT until Wave 3 extraction (publish ignored unless content markdown).
  let status: KnowledgeDocumentStatus = 'DRAFT'
  let publishedAt: Date | null = null
  if (input.publish && hasMd) {
    status = 'READY'
    publishedAt = new Date()
  } else if (hasUrl && !input.file && !hasMd) {
    status = 'DRAFT'
  }

  const documentId = randomUUID()
  let storageKey: string | null = null
  let originalFilename: string | null = null
  let mimeType: string | null = null
  let fileSize = 0

  if (input.file) {
    originalFilename = input.file.originalFilename
    mimeType = input.file.mimeType
    fileSize = input.file.buffer.length
    const ext = getAttachmentExtension(input.file.originalFilename)
    storageKey = await saveKnowledgeDocumentFile(tenantId, documentId, input.file.buffer, ext)
  }

  const row = await repo.createDocument({
    id: documentId,
    tenantId,
    title: input.title.trim(),
    description: input.description ?? null,
    categoryId: input.categoryId ?? null,
    sourceId: input.sourceId ?? null,
    kind,
    status,
    mimeType,
    originalFilename,
    storageKey,
    fileSize,
    sourceUrl: input.sourceUrl ?? null,
    language: input.language ?? null,
    ownerUserId: userId,
    createdBy: userId,
    publishedAt,
  })

  if (hasMd) {
    const version = await repo.createVersion({
      tenantId,
      documentId: row.id,
      versionNo: 1,
      markdownContent: input.markdownContent!.trim(),
      contentHash: hashContent(input.markdownContent!.trim()),
      changeSummary: 'Initial content',
      createdBy: userId,
    })
    await repo.updateDocument(tenantId, row.id, {
      currentVersionId: version.id,
    })
  }

  const final = (await repo.findDocumentById(tenantId, row.id)) ?? row

  await logActivity(req, tenantId, 'DOCUMENT_CREATE', row.id, 'Knowledge document created', {
    kind: final.kind,
    status: final.status,
    fileSize: final.fileSize,
  })

  // Auto-index when indexing is on and content is available (file / markdown / URL)
  const shouldAutoIndex =
    isIndexingEnabled() &&
    (Boolean(input.file) || hasMd || hasUrl || input.publish)

  if (shouldAutoIndex) {
    const indexResult = await runDocumentIndexPipeline({
      tenantId,
      documentId: final.id,
      userId,
    })
    await logActivity(req, tenantId, 'DOCUMENT_INDEX', final.id, 'Auto-index after create', {
      status: indexResult.status,
      chunkCount: indexResult.chunkCount,
      embedProvider: indexResult.embedProvider,
      error: indexResult.error,
    })
    const after = await repo.findDocumentById(tenantId, final.id)
    return {
      ...(after ? mapDocument(after) : mapDocument(final)),
      index: indexResult,
    }
  }

  return mapDocument(final)
}

export async function updateDocument(
  req: Request,
  tenantId: string,
  userId: string,
  id: string,
  input: UpdateKnowledgeDocumentInput,
) {
  const existing = await repo.findDocumentById(tenantId, id)
  if (!existing) throw new NotFoundError('Knowledge document not found')
  if (existing.status === 'ARCHIVED') {
    throw new InvalidStateError('Archived documents cannot be edited; restore to DRAFT first')
  }

  await assertCategoryAndSource(tenantId, input.categoryId, input.sourceId)

  let currentVersionId = existing.currentVersionId
  const md = input.markdownContent
  if (md !== undefined && md !== null) {
    const nextNo = (await repo.getLatestVersionNo(tenantId, id)) + 1
    const version = await repo.createVersion({
      tenantId,
      documentId: id,
      versionNo: nextNo,
      markdownContent: md,
      contentHash: hashContent(md),
      changeSummary: input.changeSummary ?? `Version ${nextNo}`,
      createdBy: userId,
    })
    currentVersionId = version.id
  }

  const data: Parameters<typeof repo.updateDocument>[2] = {
    updatedBy: userId,
  }
  if (input.title !== undefined) data.title = input.title.trim()
  if (input.description !== undefined) data.description = input.description
  if (input.categoryId !== undefined) data.categoryId = input.categoryId
  if (input.sourceId !== undefined) data.sourceId = input.sourceId
  if (input.language !== undefined) data.language = input.language
  if (input.sourceUrl !== undefined) data.sourceUrl = input.sourceUrl
  if (currentVersionId && currentVersionId !== existing.currentVersionId) {
    data.currentVersionId = currentVersionId
  }

  const updated = await repo.updateDocument(tenantId, id, data)
  if (!updated) throw new NotFoundError('Knowledge document not found')

  await logActivity(req, tenantId, 'DOCUMENT_UPDATE', id, 'Knowledge document updated', {
    status: updated.status,
    newVersion: Boolean(md),
  })

  return mapDocument(updated)
}

export async function transitionDocument(
  req: Request,
  tenantId: string,
  userId: string,
  id: string,
  input: TransitionKnowledgeDocumentInput,
) {
  const existing = await repo.findDocumentById(tenantId, id)
  if (!existing) throw new NotFoundError('Knowledge document not found')

  const from = existing.status as KnowledgeDocumentStatusName
  const to = input.status
  assertStatusTransition(from, to)

  if (to === 'READY') {
    const versions = await repo.listVersions(tenantId, id)
    if (versions.length === 0 && !existing.storageKey && !existing.sourceUrl) {
      throw new InvalidStateError(
        'Cannot mark READY without content (markdown version, file, or source URL)',
      )
    }
  }

  const updated = await repo.updateDocument(tenantId, id, {
    status: to,
    updatedBy: userId,
    publishedAt: to === 'READY' ? existing.publishedAt ?? new Date() : existing.publishedAt,
    indexingError: to === 'FAILED' ? input.reason ?? existing.indexingError : null,
  })
  if (!updated) throw new NotFoundError('Knowledge document not found')

  await logActivity(req, tenantId, 'DOCUMENT_STATUS', id, `Status ${from} → ${to}`, {
    from,
    to,
    reason: input.reason ?? null,
  })

  return mapDocument(updated)
}

export async function deleteDocument(req: Request, tenantId: string, userId: string, id: string) {
  const existing = await repo.findDocumentById(tenantId, id)
  if (!existing) throw new NotFoundError('Knowledge document not found')
  await repo.softDeleteDocument(tenantId, id, userId)
  await logActivity(req, tenantId, 'DOCUMENT_DELETE', id, 'Knowledge document soft-deleted')
  return { id, deleted: true }
}

export async function listDocumentVersions(tenantId: string, id: string) {
  const existing = await repo.findDocumentById(tenantId, id)
  if (!existing) throw new NotFoundError('Knowledge document not found')
  const versions = await repo.listVersions(tenantId, id)
  return versions.map((v) => ({
    id: v.id,
    versionNo: v.versionNo,
    contentHash: v.contentHash,
    changeSummary: v.changeSummary,
    createdBy: v.createdBy,
    createdAt: v.createdAt.toISOString(),
  }))
}

export async function downloadDocumentFile(tenantId: string, id: string) {
  const existing = await repo.findDocumentById(tenantId, id)
  if (!existing) throw new NotFoundError('Knowledge document not found')
  if (!existing.storageKey) {
    throw new NotFoundError('No file stored for this document')
  }
  const buffer = await readKnowledgeDocumentFile(existing.storageKey)
  return {
    filename: existing.originalFilename ?? `${existing.id}.bin`,
    mimeType: existing.mimeType ?? 'application/octet-stream',
    buffer,
  }
}

/**
 * Wave 3: extract → chunk → embed → READY/FAILED.
 */
export async function reindexDocument(req: Request, tenantId: string, userId: string, id: string) {
  const existing = await repo.findDocumentById(tenantId, id)
  if (!existing) throw new NotFoundError('Knowledge document not found')

  const from = existing.status as KnowledgeDocumentStatusName
  if (from === 'ARCHIVED') {
    throw new InvalidStateError('Cannot reindex an archived document')
  }

  if (from !== 'PROCESSING') {
    assertStatusTransition(from, 'PROCESSING')
  }

  const result = await runDocumentIndexPipeline({
    tenantId,
    documentId: id,
    userId,
  })

  await logActivity(req, tenantId, 'DOCUMENT_REINDEX', id, 'Document index pipeline completed', {
    from,
    status: result.status,
    chunkCount: result.chunkCount,
    embeddingCount: result.embeddingCount,
    extractor: result.extractor,
    embedProvider: result.embedProvider,
    modelId: result.modelId,
    error: result.error,
  })

  const updated = await repo.findDocumentById(tenantId, id)
  if (!updated) throw new NotFoundError('Knowledge document not found')

  return {
    ...mapDocument(updated),
    index: result,
  }
}

export async function searchDocuments(
  tenantId: string,
  mode: 'keyword' | 'semantic' | 'hybrid',
  input: KnowledgeSearchInput,
) {
  const q = input.q.trim()
  if (!q) {
    throw new ValidationError('Query is required', [{ field: 'q', message: 'Enter a search query' }])
  }
  const base = {
    tenantId,
    query: q,
    topK: input.topK,
    categoryId: input.categoryId ?? undefined,
    documentId: input.documentId ?? undefined,
  }
  if (mode === 'keyword') return keywordSearch(base)
  if (mode === 'semantic') return semanticSearch(base)
  return hybridSearch(base)
}

export async function listCategories(tenantId: string, query: PaginationInput) {
  const { skip, take, page, limit } = getPagination(query)
  const { items, total } = await repo.listCategories(tenantId, { skip, take })
  return { items, meta: buildPaginationMeta(total, page, limit) }
}

export async function listTags(tenantId: string, query: PaginationInput) {
  const { skip, take, page, limit } = getPagination(query)
  const { items, total } = await repo.listTags(tenantId, { skip, take })
  return { items, meta: buildPaginationMeta(total, page, limit) }
}

export async function listSources(tenantId: string, query: PaginationInput) {
  const { skip, take, page, limit } = getPagination(query)
  const { items, total } = await repo.listSources(tenantId, { skip, take })
  return { items, meta: buildPaginationMeta(total, page, limit) }
}

export async function listSessions(tenantId: string, userId: string, query: PaginationInput) {
  const { skip, take, page, limit } = getPagination(query)
  const { items, total } = await repo.listSessions(tenantId, userId, { skip, take })
  return { items, meta: buildPaginationMeta(total, page, limit) }
}

export async function listActivity(
  tenantId: string,
  query: PaginationInput & { action?: string },
) {
  const { skip, take, page, limit } = getPagination(query)
  const { items, total } = await repo.listActivity(tenantId, {
    skip,
    take,
    action: query.action,
  })
  return { items, meta: buildPaginationMeta(total, page, limit) }
}

export async function getInsightsSummary(tenantId: string) {
  const status = await getWaveStatus(tenantId)
  return {
    wave: status.wave,
    recentDocuments: [],
    popularDocuments: [],
    faqs: [],
    trendingTopics: [],
    missingDocumentation: [],
    lowRatedAnswers: [],
    usage: {
      sessions: status.counts.sessions,
      documents: status.counts.documents,
      embeddings: status.counts.embeddings,
    },
    knowledgeGrowth: [],
    departmentInsights: [],
    note: 'Insights aggregates ship in a later wave. Counts include indexed embeddings from Wave 3.',
  }
}

export async function getAnalyticsOverview(tenantId: string) {
  const status = await getWaveStatus(tenantId)
  return {
    wave: status.wave,
    counts: status.counts,
    series: [],
    note: 'Analytics series are not computed yet.',
  }
}
