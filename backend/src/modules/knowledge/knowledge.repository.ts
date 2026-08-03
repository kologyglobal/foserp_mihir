import type {
  KnowledgeDocumentKind,
  KnowledgeDocumentStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { tenantActiveFilter } from '../../shared/index.js'

const documentListSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  kind: true,
  mimeType: true,
  originalFilename: true,
  storageKey: true,
  fileSize: true,
  sourceUrl: true,
  language: true,
  categoryId: true,
  sourceId: true,
  currentVersionId: true,
  ownerUserId: true,
  indexingError: true,
  indexedAt: true,
  publishedAt: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.KnowledgeDocumentSelect

export type KnowledgeDocumentRow = Prisma.KnowledgeDocumentGetPayload<{
  select: typeof documentListSelect
}>

export async function countDocuments(tenantId: string): Promise<number> {
  return prisma.knowledgeDocument.count({
    where: { ...tenantActiveFilter(tenantId) },
  })
}

export async function countCategories(tenantId: string): Promise<number> {
  return prisma.knowledgeCategory.count({
    where: { ...tenantActiveFilter(tenantId) },
  })
}

export async function countTags(tenantId: string): Promise<number> {
  return prisma.knowledgeTag.count({
    where: { ...tenantActiveFilter(tenantId) },
  })
}

export async function countSessions(tenantId: string): Promise<number> {
  return prisma.knowledgeChatSession.count({
    where: { ...tenantActiveFilter(tenantId) },
  })
}

export async function countEmbeddings(tenantId: string): Promise<number> {
  return prisma.knowledgeEmbedding.count({
    where: { tenantId },
  })
}

export async function listDocuments(
  tenantId: string,
  opts: {
    skip: number
    take: number
    status?: string
    categoryId?: string
    kind?: string
    search?: string
  },
) {
  const where: Prisma.KnowledgeDocumentWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(opts.status ? { status: opts.status as KnowledgeDocumentStatus } : {}),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.kind ? { kind: opts.kind as KnowledgeDocumentKind } : {}),
    ...(opts.search
      ? {
          OR: [
            { title: { contains: opts.search } },
            { description: { contains: opts.search } },
            { originalFilename: { contains: opts.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.knowledgeDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: opts.skip,
      take: opts.take,
      select: documentListSelect,
    }),
    prisma.knowledgeDocument.count({ where }),
  ])
  return { items, total }
}

export async function findDocumentById(tenantId: string, id: string) {
  return prisma.knowledgeDocument.findFirst({
    where: { id, ...tenantActiveFilter(tenantId) },
    select: documentListSelect,
  })
}

export async function createDocument(data: {
  tenantId: string
  id?: string
  title: string
  description?: string | null
  categoryId?: string | null
  sourceId?: string | null
  kind: KnowledgeDocumentKind
  status: KnowledgeDocumentStatus
  mimeType?: string | null
  originalFilename?: string | null
  storageKey?: string | null
  fileSize?: number
  sourceUrl?: string | null
  language?: string | null
  ownerUserId?: string | null
  createdBy?: string | null
  publishedAt?: Date | null
}) {
  return prisma.knowledgeDocument.create({
    data: {
      id: data.id,
      tenantId: data.tenantId,
      title: data.title,
      description: data.description ?? null,
      categoryId: data.categoryId ?? null,
      sourceId: data.sourceId ?? null,
      kind: data.kind,
      status: data.status,
      mimeType: data.mimeType ?? null,
      originalFilename: data.originalFilename ?? null,
      storageKey: data.storageKey ?? null,
      fileSize: data.fileSize ?? 0,
      sourceUrl: data.sourceUrl ?? null,
      language: data.language ?? null,
      ownerUserId: data.ownerUserId ?? null,
      createdBy: data.createdBy ?? null,
      updatedBy: data.createdBy ?? null,
      publishedAt: data.publishedAt ?? null,
    },
    select: documentListSelect,
  })
}

export async function updateDocument(
  tenantId: string,
  id: string,
  data: Prisma.KnowledgeDocumentUncheckedUpdateInput,
) {
  // Ensure tenant ownership: updateMany then re-read when needed.
  const result = await prisma.knowledgeDocument.updateMany({
    where: { id, ...tenantActiveFilter(tenantId) },
    data,
  })
  if (result.count === 0) return null
  return findDocumentById(tenantId, id)
}

/** Soft-delete (caller must ensure tenant ownership). */
export async function softDeleteDocument(tenantId: string, id: string, userId: string | null) {
  await prisma.knowledgeDocument.updateMany({
    where: { id, ...tenantActiveFilter(tenantId) },
    data: { deletedAt: new Date(), updatedBy: userId },
  })
}

export async function createVersion(data: {
  tenantId: string
  documentId: string
  versionNo: number
  markdownContent?: string | null
  contentHash?: string | null
  changeSummary?: string | null
  createdBy?: string | null
}) {
  return prisma.knowledgeVersion.create({
    data: {
      tenantId: data.tenantId,
      documentId: data.documentId,
      versionNo: data.versionNo,
      markdownContent: data.markdownContent ?? null,
      contentHash: data.contentHash ?? null,
      changeSummary: data.changeSummary ?? null,
      createdBy: data.createdBy ?? null,
    },
  })
}

export async function listVersions(tenantId: string, documentId: string) {
  return prisma.knowledgeVersion.findMany({
    where: { tenantId, documentId },
    orderBy: { versionNo: 'desc' },
    select: {
      id: true,
      versionNo: true,
      contentHash: true,
      changeSummary: true,
      createdBy: true,
      createdAt: true,
    },
  })
}

export async function getLatestVersionNo(tenantId: string, documentId: string): Promise<number> {
  const last = await prisma.knowledgeVersion.findFirst({
    where: { tenantId, documentId },
    orderBy: { versionNo: 'desc' },
    select: { versionNo: true },
  })
  return last?.versionNo ?? 0
}

export async function categoryExists(tenantId: string, categoryId: string): Promise<boolean> {
  const row = await prisma.knowledgeCategory.findFirst({
    where: { id: categoryId, ...tenantActiveFilter(tenantId) },
    select: { id: true },
  })
  return Boolean(row)
}

export async function sourceExists(tenantId: string, sourceId: string): Promise<boolean> {
  const row = await prisma.knowledgeSource.findFirst({
    where: { id: sourceId, ...tenantActiveFilter(tenantId) },
    select: { id: true },
  })
  return Boolean(row)
}

export async function writeActivity(data: {
  tenantId: string
  userId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  message?: string | null
  metaJson?: Prisma.InputJsonValue
  ipAddress?: string | null
  userAgent?: string | null
}) {
  return prisma.knowledgeActivityLog.create({
    data: {
      tenantId: data.tenantId,
      userId: data.userId ?? null,
      action: data.action,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      message: data.message ?? null,
      metaJson: data.metaJson ?? undefined,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
    },
  })
}

export async function listCategories(tenantId: string, opts: { skip: number; take: number }) {
  const where = tenantActiveFilter(tenantId)
  const [items, total] = await Promise.all([
    prisma.knowledgeCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip: opts.skip,
      take: opts.take,
    }),
    prisma.knowledgeCategory.count({ where }),
  ])
  return { items, total }
}

export async function listTags(tenantId: string, opts: { skip: number; take: number }) {
  const where = tenantActiveFilter(tenantId)
  const [items, total] = await Promise.all([
    prisma.knowledgeTag.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: opts.skip,
      take: opts.take,
    }),
    prisma.knowledgeTag.count({ where }),
  ])
  return { items, total }
}

export async function listSources(tenantId: string, opts: { skip: number; take: number }) {
  const where = tenantActiveFilter(tenantId)
  const [items, total] = await Promise.all([
    prisma.knowledgeSource.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: opts.skip,
      take: opts.take,
    }),
    prisma.knowledgeSource.count({ where }),
  ])
  return { items, total }
}

export async function listSessions(
  tenantId: string,
  userId: string,
  opts: { skip: number; take: number },
) {
  const where = { ...tenantActiveFilter(tenantId), userId }
  const [items, total] = await Promise.all([
    prisma.knowledgeChatSession.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip: opts.skip,
      take: opts.take,
      select: {
        id: true,
        title: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.knowledgeChatSession.count({ where }),
  ])
  return { items, total }
}

export async function listActivity(tenantId: string, opts: { skip: number; take: number; action?: string }) {
  const where = {
    tenantId,
    ...(opts.action ? { action: opts.action } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.knowledgeActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: opts.skip,
      take: opts.take,
    }),
    prisma.knowledgeActivityLog.count({ where }),
  ])
  return { items, total }
}
