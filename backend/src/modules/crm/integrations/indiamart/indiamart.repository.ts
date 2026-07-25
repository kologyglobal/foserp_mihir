import type {
  IndiaMartAssignmentMode,
  IndiaMartConnection,
  IndiaMartDuplicateBehaviour,
  IndiaMartEnquiry,
  IndiaMartEnquiryProcessingStatus,
  IndiaMartImportStatus,
  IndiaMartMatchStatus,
  IndiaMartProductMapping,
  IndiaMartSyncRun,
  IndiaMartSyncRunStatus,
  IndiaMartSyncTriggerType,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../../../config/database.js'

export async function findConnectionByTenant(tenantId: string) {
  return prisma.indiaMartConnection.findUnique({ where: { tenantId } })
}

export async function upsertConnection(
  tenantId: string,
  userId: string,
  data: {
    companyId?: string | null
    accountName?: string | null
    registeredMobileMasked?: string | null
    registeredEmailMasked?: string | null
    apiBaseUrl?: string
    leadFetchEndpoint?: string
    authenticationType?: IndiaMartConnection['authenticationType']
    encryptedCredentials?: string
    configurationJson?: Prisma.InputJsonValue
    status?: IndiaMartConnection['status']
    syncEnabled?: boolean
    autoCreateLead?: boolean
    defaultLeadSourceId?: string | null
    defaultLeadOwnerId?: string | null
    defaultTerritoryId?: string | null
    defaultPriority?: string | null
    defaultIndustryId?: string | null
    duplicateBehaviour?: IndiaMartDuplicateBehaviour
    assignmentMode?: IndiaMartAssignmentMode
    syncIntervalMinutes?: number
    initialLookbackDays?: number
    maxRecordsPerRun?: number
    nextScheduledSyncAt?: Date | null
    lastSuccessfulSyncAt?: Date | null
    lastAttemptedSyncAt?: Date | null
    lastCursor?: string | null
    lastExternalTimestamp?: Date | null
  },
) {
  const existing = await findConnectionByTenant(tenantId)
  if (!existing) {
    return prisma.indiaMartConnection.create({
      data: {
        tenantId,
        encryptedCredentials: data.encryptedCredentials ?? '',
        apiBaseUrl: data.apiBaseUrl ?? 'https://mapi.indiamart.com',
        leadFetchEndpoint: data.leadFetchEndpoint ?? '/wservce/crm/crmListing/v2/',
        authenticationType: data.authenticationType ?? 'QUERY_PARAMETER',
        companyId: data.companyId ?? null,
        accountName: data.accountName ?? null,
        registeredMobileMasked: data.registeredMobileMasked ?? null,
        registeredEmailMasked: data.registeredEmailMasked ?? null,
        configurationJson: data.configurationJson ?? undefined,
        status: data.status ?? 'NOT_CONFIGURED',
        syncEnabled: data.syncEnabled ?? false,
        autoCreateLead: data.autoCreateLead ?? true,
        defaultLeadSourceId: data.defaultLeadSourceId ?? null,
        defaultLeadOwnerId: data.defaultLeadOwnerId ?? null,
        defaultTerritoryId: data.defaultTerritoryId ?? null,
        defaultPriority: data.defaultPriority ?? 'high',
        defaultIndustryId: data.defaultIndustryId ?? null,
        duplicateBehaviour: data.duplicateBehaviour ?? 'CREATE_ACTIVITY_ON_EXISTING_LEAD',
        assignmentMode: data.assignmentMode ?? 'DEFAULT_OWNER',
        syncIntervalMinutes: data.syncIntervalMinutes ?? 15,
        initialLookbackDays: data.initialLookbackDays ?? 7,
        maxRecordsPerRun: data.maxRecordsPerRun ?? 500,
        nextScheduledSyncAt: data.nextScheduledSyncAt ?? null,
        createdById: userId,
        updatedById: userId,
      },
    })
  }
  return prisma.indiaMartConnection.update({
    where: { id: existing.id },
    data: {
      ...data,
      updatedById: userId,
    },
  })
}

export async function updateConnectionSyncMeta(
  connectionId: string,
  data: Partial<Pick<
    IndiaMartConnection,
    | 'status'
    | 'lastSuccessfulSyncAt'
    | 'lastAttemptedSyncAt'
    | 'nextScheduledSyncAt'
    | 'lastCursor'
    | 'lastExternalTimestamp'
    | 'syncLockUntil'
    | 'syncLockToken'
  >>,
) {
  return prisma.indiaMartConnection.update({ where: { id: connectionId }, data })
}

/** Acquire sync lock — returns true if this caller owns the lock. */
export async function tryAcquireSyncLock(
  connectionId: string,
  token: string,
  lockMinutes = 10,
): Promise<boolean> {
  const now = new Date()
  const until = new Date(now.getTime() + lockMinutes * 60_000)
  const result = await prisma.indiaMartConnection.updateMany({
    where: {
      id: connectionId,
      OR: [{ syncLockUntil: null }, { syncLockUntil: { lt: now } }],
    },
    data: { syncLockUntil: until, syncLockToken: token },
  })
  return result.count === 1
}

export async function releaseSyncLock(connectionId: string, token: string) {
  await prisma.indiaMartConnection.updateMany({
    where: { id: connectionId, syncLockToken: token },
    data: { syncLockUntil: null, syncLockToken: null },
  })
}

export async function listDueConnections(now = new Date()) {
  return prisma.indiaMartConnection.findMany({
    where: {
      syncEnabled: true,
      status: { in: ['CONNECTED'] },
      OR: [{ nextScheduledSyncAt: null }, { nextScheduledSyncAt: { lte: now } }],
    },
    take: 50,
  })
}

export async function createSyncRun(input: {
  tenantId: string
  connectionId: string
  triggerType: IndiaMartSyncTriggerType
  triggeredById?: string | null
  requestedFrom?: Date | null
  requestedTo?: Date | null
  cursorBefore?: string | null
}) {
  return prisma.indiaMartSyncRun.create({
    data: {
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      triggerType: input.triggerType,
      status: 'RUNNING',
      triggeredById: input.triggeredById ?? null,
      requestedFrom: input.requestedFrom ?? null,
      requestedTo: input.requestedTo ?? null,
      cursorBefore: input.cursorBefore ?? null,
      startedAt: new Date(),
    },
  })
}

export async function completeSyncRun(
  id: string,
  data: Partial<IndiaMartSyncRun> & { status: IndiaMartSyncRunStatus },
) {
  return prisma.indiaMartSyncRun.update({ where: { id }, data })
}

export async function listSyncRuns(
  tenantId: string,
  query: { page: number; limit: number },
) {
  const skip = (query.page - 1) * query.limit
  const where = { tenantId }
  const [items, total] = await Promise.all([
    prisma.indiaMartSyncRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.indiaMartSyncRun.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export type EnquiryListQuery = {
  page: number
  limit: number
  search?: string
  processingStatus?: IndiaMartEnquiryProcessingStatus
  importStatus?: IndiaMartImportStatus
  matchStatus?: IndiaMartMatchStatus
  assignedUserId?: string
  product?: string
  city?: string
  dateFrom?: Date
  dateTo?: Date
  createdLeadOnly?: boolean
}

export async function listEnquiries(tenantId: string, query: EnquiryListQuery) {
  const skip = (query.page - 1) * query.limit
  const where: Prisma.IndiaMartEnquiryWhereInput = {
    tenantId,
    ...(query.processingStatus ? { processingStatus: query.processingStatus } : {}),
    ...(query.importStatus ? { importStatus: query.importStatus } : {}),
    ...(query.matchStatus ? { matchStatus: query.matchStatus } : {}),
    ...(query.assignedUserId ? { assignedUserId: query.assignedUserId } : {}),
    ...(query.product ? { productName: { contains: query.product } } : {}),
    ...(query.city ? { buyerCity: { contains: query.city } } : {}),
    ...(query.createdLeadOnly ? { createdLeadId: { not: null } } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          enquiryDate: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { buyerName: { contains: query.search } },
            { buyerCompanyName: { contains: query.search } },
            { buyerMobile: { contains: query.search } },
            { buyerEmail: { contains: query.search } },
            { productName: { contains: query.search } },
            { requirementText: { contains: query.search } },
            { externalEnquiryId: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.indiaMartEnquiry.findMany({
      where,
      orderBy: [{ enquiryDate: 'desc' }, { fetchedAt: 'desc' }],
      skip,
      take: query.limit,
    }),
    prisma.indiaMartEnquiry.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function findEnquiryById(tenantId: string, id: string) {
  return prisma.indiaMartEnquiry.findFirst({ where: { id, tenantId } })
}

export async function findEnquiryByExternalId(tenantId: string, externalEnquiryId: string) {
  return prisma.indiaMartEnquiry.findUnique({
    where: { tenantId_externalEnquiryId: { tenantId, externalEnquiryId } },
  })
}

export async function insertEnquiry(data: Prisma.IndiaMartEnquiryCreateInput) {
  return prisma.indiaMartEnquiry.create({ data })
}

export async function updateEnquiry(
  tenantId: string,
  id: string,
  data: Prisma.IndiaMartEnquiryUpdateInput,
) {
  return prisma.indiaMartEnquiry.update({ where: { id }, data: { ...data } }).then(async (row) => {
    if (row.tenantId !== tenantId) throw new Error('Tenant mismatch')
    return row
  })
}

export async function findLeadByExternalSource(
  tenantId: string,
  externalSource: string,
  externalSourceId: string,
) {
  return prisma.crmLead.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      externalSource,
      externalSourceId,
    },
  })
}

export async function findLeadByMobile(tenantId: string, normalizedMobile: string) {
  const digits = normalizedMobile.replace(/\D/g, '')
  const last10 = digits.slice(-10)
  return prisma.crmLead.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      OR: [
        { mobile: normalizedMobile },
        { mobile: last10 },
        { mobile: { endsWith: last10 } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findLeadByEmail(tenantId: string, email: string) {
  return prisma.crmLead.findFirst({
    where: { tenantId, deletedAt: null, email: { equals: email } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function findCompanyByNormalizedName(tenantId: string, name: string) {
  return prisma.crmCompany.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      name: { contains: name.slice(0, 40) },
    },
  })
}

export async function findContactByMobileOrEmail(
  tenantId: string,
  mobile: string | null,
  email: string | null,
) {
  if (!mobile && !email) return null
  return prisma.crmContact.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      OR: [
        ...(mobile
          ? [{ mobile: mobile }, { mobile: mobile.slice(-10) }]
          : []),
        ...(email ? [{ email: { equals: email } }] : []),
      ],
    },
  })
}

export async function listProductMappings(tenantId: string) {
  return prisma.indiaMartProductMapping.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function upsertProductMapping(
  tenantId: string,
  userId: string,
  input: {
    id?: string
    externalProductName: string
    normalizedProductName: string
    externalProductKey?: string | null
    itemId?: string | null
    itemCategoryId?: string | null
    mappingStatus: IndiaMartProductMapping['mappingStatus']
    confidenceScore?: number | null
  },
) {
  if (input.id) {
    return prisma.indiaMartProductMapping.update({
      where: { id: input.id },
      data: {
        externalProductName: input.externalProductName,
        normalizedProductName: input.normalizedProductName,
        externalProductKey: input.externalProductKey ?? null,
        itemId: input.itemId ?? null,
        itemCategoryId: input.itemCategoryId ?? null,
        mappingStatus: input.mappingStatus,
        confidenceScore: input.confidenceScore ?? null,
        updatedById: userId,
      },
    })
  }
  return prisma.indiaMartProductMapping.upsert({
    where: {
      tenantId_normalizedProductName: {
        tenantId,
        normalizedProductName: input.normalizedProductName,
      },
    },
    create: {
      tenantId,
      externalProductName: input.externalProductName,
      normalizedProductName: input.normalizedProductName,
      externalProductKey: input.externalProductKey ?? null,
      itemId: input.itemId ?? null,
      itemCategoryId: input.itemCategoryId ?? null,
      mappingStatus: input.mappingStatus,
      confidenceScore: input.confidenceScore ?? null,
      createdById: userId,
      updatedById: userId,
    },
    update: {
      externalProductName: input.externalProductName,
      itemId: input.itemId ?? null,
      itemCategoryId: input.itemCategoryId ?? null,
      mappingStatus: input.mappingStatus,
      confidenceScore: input.confidenceScore ?? null,
      updatedById: userId,
    },
  })
}

export async function getDashboardMetrics(tenantId: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const since14 = new Date()
  since14.setDate(since14.getDate() - 13)
  since14.setHours(0, 0, 0, 0)

  const [
    newToday,
    leadsToday,
    pendingReview,
    possibleDuplicates,
    failedImports,
    overdue,
    unreadAlerts,
    recentEnquiries,
  ] = await Promise.all([
    prisma.indiaMartEnquiry.count({ where: { tenantId, fetchedAt: { gte: start } } }),
    prisma.indiaMartEnquiry.count({
      where: { tenantId, importedAt: { gte: start }, createdLeadId: { not: null } },
    }),
    prisma.indiaMartEnquiry.count({
      where: {
        tenantId,
        importStatus: 'NOT_IMPORTED',
        processingStatus: { in: ['READY', 'NORMALIZED', 'NEW'] },
      },
    }),
    prisma.indiaMartEnquiry.count({
      where: { tenantId, matchStatus: { in: ['POSSIBLE_DUPLICATE', 'EXACT_DUPLICATE'] } },
    }),
    prisma.indiaMartEnquiry.count({
      where: { tenantId, importStatus: 'IMPORT_FAILED' },
    }),
    prisma.indiaMartEnquiry.count({
      where: { tenantId, slaStatus: 'OVERDUE' },
    }),
    prisma.indiaMartAlert.count({ where: { tenantId, isRead: false } }),
    prisma.indiaMartEnquiry.findMany({
      where: { tenantId, fetchedAt: { gte: since14 } },
      select: {
        fetchedAt: true,
        buyerCity: true,
        buyerState: true,
        productName: true,
        assignedUserId: true,
        createdLeadId: true,
        importStatus: true,
        receivedAt: true,
        firstContactedAt: true,
        importedAt: true,
      },
      take: 2000,
    }),
  ])

  const byDayMap = new Map<string, { date: string; enquiries: number; leads: number }>()
  for (let i = 0; i < 14; i++) {
    const d = new Date(since14)
    d.setDate(since14.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    byDayMap.set(key, { date: key, enquiries: 0, leads: 0 })
  }
  const byProduct = new Map<string, number>()
  const byCity = new Map<string, number>()
  const byOwner = new Map<string, number>()
  let responseSumMs = 0
  let responseCount = 0

  for (const row of recentEnquiries) {
    const day = row.fetchedAt.toISOString().slice(0, 10)
    const bucket = byDayMap.get(day)
    if (bucket) {
      bucket.enquiries += 1
      if (row.createdLeadId) bucket.leads += 1
    }
    const product = (row.productName || 'Unspecified').slice(0, 40)
    byProduct.set(product, (byProduct.get(product) ?? 0) + 1)
    const city = row.buyerCity || row.buyerState || 'Unknown'
    byCity.set(city, (byCity.get(city) ?? 0) + 1)
    if (row.assignedUserId) {
      byOwner.set(row.assignedUserId, (byOwner.get(row.assignedUserId) ?? 0) + 1)
    }
    if (row.receivedAt && row.firstContactedAt) {
      responseSumMs += row.firstContactedAt.getTime() - row.receivedAt.getTime()
      responseCount += 1
    }
  }

  const totalWithLead = recentEnquiries.filter((r) => r.createdLeadId).length
  const conversionToLead =
    recentEnquiries.length > 0 ? Math.round((totalWithLead / recentEnquiries.length) * 100) : 0

  return {
    newEnquiriesToday: newToday,
    leadsCreatedToday: leadsToday,
    pendingReview,
    possibleDuplicates,
    failedImports,
    overdueEnquiries: overdue,
    unreadAlerts,
    averageFirstResponseMinutes:
      responseCount > 0 ? Math.round(responseSumMs / responseCount / 60_000) : null,
    conversionToLeadPercent: conversionToLead,
    enquiriesByDay: [...byDayMap.values()],
    enquiriesByProduct: [...byProduct.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    enquiriesByCity: [...byCity.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    enquiriesByOwner: [...byOwner.entries()]
      .map(([ownerId, count]) => ({ ownerId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    funnel: {
      enquiries: recentEnquiries.length,
      imported: totalWithLead,
      pendingReview,
      overdue,
    },
  }
}
