import type { DefaultAccountMappingKey, FixedAssetStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import {
  FixedAssetCategoryNotFoundError,
  FixedAssetDepreciationRunNotFoundError,
  FixedAssetNotFoundError,
  FixedAssetStaleVersionError,
} from './fixed-assets.errors.js'
import type {
  CreateFixedAssetCategoryInput,
  CreateFixedAssetInput,
  ListDepreciationRunsQueryInput,
  ListFixedAssetCategoriesQueryInput,
  ListFixedAssetTransfersQueryInput,
  ListFixedAssetsQueryInput,
  UpdateFixedAssetCategoryInput,
  UpdateFixedAssetInput,
} from './fixed-assets.schemas.js'

const categoryInclude = {
  assetAccount: { select: { id: true, accountCode: true, isActive: true, isGroup: true } },
  accumDepAccount: { select: { id: true, accountCode: true, isActive: true, isGroup: true } },
  depExpenseAccount: { select: { id: true, accountCode: true, isActive: true, isGroup: true } },
} as const

const assetInclude = {
  category: { select: { id: true, name: true, code: true, residualPercent: true, usefulLifeYears: true, depreciationMethod: true, assetAccountId: true, accumDepAccountId: true, depExpenseAccountId: true } },
} as const

export async function findCategoryById(tenantId: string, id: string) {
  return prisma.fixedAssetCategory.findFirst({
    where: { id, tenantId },
    include: categoryInclude,
  })
}

export async function findCategoryByIdOrThrow(tenantId: string, id: string) {
  const category = await findCategoryById(tenantId, id)
  if (!category) throw new FixedAssetCategoryNotFoundError()
  return category
}

export async function listCategories(tenantId: string, query: ListFixedAssetCategoriesQueryInput) {
  const where: Prisma.FixedAssetCategoryWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.isActive != null ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search } },
            { name: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.fixedAssetCategory.findMany({
      where,
      orderBy: [{ code: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.fixedAssetCategory.count({ where }),
  ])

  return { items, total, page: query.page, pageSize: query.pageSize }
}

export async function createCategory(tenantId: string, userId: string, input: CreateFixedAssetCategoryInput) {
  return prisma.fixedAssetCategory.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      usefulLifeYears: input.usefulLifeYears,
      residualPercent: input.residualPercent,
      assetAccountId: input.assetAccountId,
      accumDepAccountId: input.accumDepAccountId,
      depExpenseAccountId: input.depExpenseAccountId,
      createdById: userId,
    },
  })
}

export async function updateCategory(tenantId: string, id: string, userId: string, input: UpdateFixedAssetCategoryInput) {
  await findCategoryByIdOrThrow(tenantId, id)
  return prisma.fixedAssetCategory.update({
    where: { id },
    data: {
      ...input,
      updatedById: userId,
    },
  })
}

export async function countAssetsInCategory(tenantId: string, categoryId: string): Promise<number> {
  return prisma.fixedAsset.count({
    where: { tenantId, categoryId, status: { notIn: ['CANCELLED', 'DISPOSED'] } },
  })
}

export async function findAssetById(tenantId: string, id: string) {
  return prisma.fixedAsset.findFirst({
    where: { id, tenantId },
    include: assetInclude,
  })
}

export async function findAssetByIdOrThrow(tenantId: string, id: string) {
  const asset = await findAssetById(tenantId, id)
  if (!asset) throw new FixedAssetNotFoundError()
  return asset
}

export async function listAssets(tenantId: string, query: ListFixedAssetsQueryInput) {
  const where: Prisma.FixedAssetWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { assetNumber: { contains: query.search } },
            { name: { contains: query.search } },
            { draftReference: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.fixedAsset.findMany({
      where,
      include: assetInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.fixedAsset.count({ where }),
  ])

  return { items, total, page: query.page, pageSize: query.pageSize }
}

export async function createAsset(
  tenantId: string,
  userId: string,
  assetNumber: string,
  input: CreateFixedAssetInput & { usefulLifeYears: number },
) {
  return prisma.fixedAsset.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      categoryId: input.categoryId,
      assetNumber,
      draftReference: input.draftReference ?? null,
      name: input.name.trim(),
      status: input.status,
      acquisitionDate: parseDateOnly(input.acquisitionDate),
      acquisitionCost: input.acquisitionCost,
      residualValue: '0',
      usefulLifeYears: input.usefulLifeYears,
      accumulatedDepreciation: '0',
      netBookValue: input.acquisitionCost,
      location: input.location ?? null,
      plant: input.plant ?? null,
      department: input.department ?? null,
      custodian: input.custodian ?? null,
      serialNumber: input.serialNumber ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      vendorName: input.vendorName ?? null,
      notes: input.notes ?? null,
      currencyCode: input.currencyCode,
      createdById: userId,
    },
    include: assetInclude,
  })
}

export async function updateAsset(
  tenantId: string,
  id: string,
  userId: string,
  input: UpdateFixedAssetInput,
) {
  const existing = await findAssetByIdOrThrow(tenantId, id)
  if (input.expectedUpdatedAt && existing.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    throw new FixedAssetStaleVersionError()
  }

  const { expectedUpdatedAt: _ignored, acquisitionDate, ...rest } = input
  return prisma.fixedAsset.update({
    where: { id },
    data: {
      ...rest,
      ...(acquisitionDate ? { acquisitionDate: parseDateOnly(acquisitionDate) } : {}),
      ...(input.acquisitionCost ? { netBookValue: input.acquisitionCost } : {}),
      updatedById: userId,
    },
    include: assetInclude,
  })
}

export async function finalizeAssetCapitalization(
  args: {
    tenantId: string
    assetId: string
    fromStatuses: FixedAssetStatus[]
    capitalizationDate: Date
    residualValue: string
    netBookValue: string
    voucherId: string
    postingEventId: string
    userId: string
    expectedUpdatedAt?: string
  },
  tx: Prisma.TransactionClient,
) {
  const existing = await tx.fixedAsset.findFirst({ where: { id: args.assetId, tenantId: args.tenantId } })
  if (!existing) throw new FixedAssetNotFoundError()
  if (args.expectedUpdatedAt && existing.updatedAt.toISOString() !== args.expectedUpdatedAt) {
    throw new FixedAssetStaleVersionError()
  }

  const result = await tx.fixedAsset.updateMany({
    where: {
      id: args.assetId,
      tenantId: args.tenantId,
      status: { in: args.fromStatuses },
    },
    data: {
      status: 'ACTIVE',
      capitalizationDate: args.capitalizationDate,
      residualValue: args.residualValue,
      netBookValue: args.netBookValue,
      accumulatedDepreciation: '0',
      capitalizationVoucherId: args.voucherId,
      capitalizationPostingEventId: args.postingEventId,
      capitalizedAt: new Date(),
      capitalizedById: args.userId,
      updatedById: args.userId,
    },
  })

  if (result.count !== 1) throw new FixedAssetStaleVersionError()
}

export async function finalizeAssetDisposal(
  args: {
    tenantId: string
    assetId: string
    fromStatuses: FixedAssetStatus[]
    disposalType: 'SALE' | 'SCRAP' | 'WRITE_OFF'
    disposalDate: Date
    disposalProceeds: string
    disposalGainLoss: string
    disposalProceedsAccountId: string | null
    disposalBuyerName: string | null
    disposalReason: string
    voucherId: string
    postingEventId: string
    userId: string
    expectedUpdatedAt?: string
    /** Phase FA2 — soft pointer to the current disposal document, set when posted via the document workflow. */
    disposalDocumentId?: string | null
  },
  tx: Prisma.TransactionClient,
) {
  const existing = await tx.fixedAsset.findFirst({ where: { id: args.assetId, tenantId: args.tenantId } })
  if (!existing) throw new FixedAssetNotFoundError()
  if (args.expectedUpdatedAt && existing.updatedAt.toISOString() !== args.expectedUpdatedAt) {
    throw new FixedAssetStaleVersionError()
  }

  const result = await tx.fixedAsset.updateMany({
    where: {
      id: args.assetId,
      tenantId: args.tenantId,
      status: { in: args.fromStatuses },
    },
    data: {
      status: 'DISPOSED',
      disposalType: args.disposalType,
      disposalDate: args.disposalDate,
      disposalProceeds: args.disposalProceeds,
      disposalGainLoss: args.disposalGainLoss,
      disposalProceedsAccountId: args.disposalProceedsAccountId,
      disposalBuyerName: args.disposalBuyerName,
      disposalReason: args.disposalReason,
      disposalVoucherId: args.voucherId,
      disposalPostingEventId: args.postingEventId,
      disposedAt: new Date(),
      disposedById: args.userId,
      accumulatedDepreciation: '0',
      netBookValue: '0',
      updatedById: args.userId,
      ...(args.disposalDocumentId !== undefined ? { disposalDocumentId: args.disposalDocumentId } : {}),
    },
  })

  if (result.count !== 1) throw new FixedAssetStaleVersionError()
}

/** Phase FA2 — restores an asset from its snapshot when the disposal document is reversed. */
export async function restoreAssetFromDisposalReversal(
  args: {
    tenantId: string
    assetId: string
    disposalDocumentId: string
    restoreStatus: FixedAssetStatus
    acquisitionCost: string
    accumulatedDepreciation: string
    netBookValue: string
    userId: string
  },
  tx: Prisma.TransactionClient,
) {
  const result = await tx.fixedAsset.updateMany({
    where: {
      id: args.assetId,
      tenantId: args.tenantId,
      status: 'DISPOSED',
      disposalDocumentId: args.disposalDocumentId,
    },
    data: {
      status: args.restoreStatus,
      acquisitionCost: args.acquisitionCost,
      accumulatedDepreciation: args.accumulatedDepreciation,
      netBookValue: args.netBookValue,
      disposalType: null,
      disposalDate: null,
      disposalProceeds: null,
      disposalGainLoss: null,
      disposalProceedsAccountId: null,
      disposalBuyerName: null,
      disposalReason: null,
      disposalVoucherId: null,
      disposalPostingEventId: null,
      disposedAt: null,
      disposedById: null,
      disposalDocumentId: null,
      updatedById: args.userId,
    },
  })
  return result
}

export async function findDepreciationRunById(tenantId: string, id: string) {
  return prisma.fixedAssetDepreciationRun.findFirst({
    where: { id, tenantId },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

export async function findDepreciationRunByIdOrThrow(tenantId: string, id: string) {
  const run = await findDepreciationRunById(tenantId, id)
  if (!run) throw new FixedAssetDepreciationRunNotFoundError()
  return run
}

export async function findDepreciationRunByPeriod(tenantId: string, legalEntityId: string, periodKey: string) {
  return prisma.fixedAssetDepreciationRun.findFirst({
    where: { tenantId, legalEntityId, periodKey },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

export async function listDepreciationRuns(tenantId: string, query: ListDepreciationRunsQueryInput) {
  const where: Prisma.FixedAssetDepreciationRunWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.fixedAssetDepreciationRun.findMany({
      where,
      orderBy: [{ periodKey: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.fixedAssetDepreciationRun.count({ where }),
  ])

  return { items, total, page: query.page, pageSize: query.pageSize }
}

export async function createDepreciationRunWithLines(
  args: {
    tenantId: string
    legalEntityId: string
    runNumber: string
    periodKey: string
    periodFrom: Date
    periodTo: Date
    runDate: Date
    postingDate: Date | null
    totalDepreciation: string
    assetCount: number
    userId: string
    lines: Array<{
      assetId: string
      lineNumber: number
      assetNumber: string
      assetName: string
      categoryName: string
      openingNbv: string
      depreciationAmount: string
      closingNbv: string
      accumulatedDepreciation: string
      depExpenseAccountId: string
      accumDepAccountId: string
    }>
  },
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma
  return client.fixedAssetDepreciationRun.create({
    data: {
      tenantId: args.tenantId,
      legalEntityId: args.legalEntityId,
      runNumber: args.runNumber,
      periodKey: args.periodKey,
      periodFrom: args.periodFrom,
      periodTo: args.periodTo,
      runDate: args.runDate,
      postingDate: args.postingDate,
      status: 'DRAFT',
      totalDepreciation: args.totalDepreciation,
      assetCount: args.assetCount,
      createdById: args.userId,
      lines: {
        create: args.lines.map((line) => ({
          tenantId: args.tenantId,
          ...line,
        })),
      },
    },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

export async function finalizeDepreciationRun(
  args: {
    tenantId: string
    runId: string
    voucherId: string | null
    postingEventId: string | null
    userId: string
    assetUpdates: Array<{
      assetId: string
      accumulatedDepreciation: string
      netBookValue: string
      status: FixedAssetStatus
    }>
  },
  tx: Prisma.TransactionClient,
) {
  await tx.fixedAssetDepreciationRun.update({
    where: { id: args.runId },
    data: {
      status: 'POSTED',
      voucherId: args.voucherId,
      postingEventId: args.postingEventId,
      postedAt: new Date(),
      postedById: args.userId,
      updatedById: args.userId,
    },
  })

  for (const update of args.assetUpdates) {
    await tx.fixedAsset.update({
      where: { id: update.assetId },
      data: {
        accumulatedDepreciation: update.accumulatedDepreciation,
        netBookValue: update.netBookValue,
        status: update.status,
        updatedById: args.userId,
      },
    })
  }
}

export async function listActiveAssetsForDepreciation(
  tenantId: string,
  legalEntityId: string,
  periodTo: Date,
) {
  return prisma.fixedAsset.findMany({
    where: {
      tenantId,
      legalEntityId,
      status: 'ACTIVE',
      capitalizationDate: { lte: periodTo },
    },
    include: {
      category: {
        select: {
          name: true,
          accumDepAccountId: true,
          depExpenseAccountId: true,
          residualPercent: true,
        },
      },
    },
    orderBy: [{ assetNumber: 'asc' }],
  })
}

export async function aggregateOverviewMetrics(tenantId: string, legalEntityId: string) {
  const valuedStatuses = ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'] as const

  const [statusGroups, categoryGroups, pendingCapitalization, totals] = await Promise.all([
    prisma.fixedAsset.groupBy({
      by: ['status'],
      where: { tenantId, legalEntityId, status: { not: 'CANCELLED' } },
      _count: { _all: true },
    }),
    prisma.fixedAsset.groupBy({
      by: ['categoryId'],
      where: { tenantId, legalEntityId, status: { in: [...valuedStatuses] } },
      _count: { _all: true },
      _sum: { netBookValue: true },
    }),
    prisma.fixedAsset.count({
      where: { tenantId, legalEntityId, status: { in: ['DRAFT', 'PENDING_CAPITALIZATION'] } },
    }),
    prisma.fixedAsset.aggregate({
      where: { tenantId, legalEntityId, status: { in: [...valuedStatuses] } },
      _sum: {
        acquisitionCost: true,
        netBookValue: true,
        accumulatedDepreciation: true,
      },
    }),
  ])

  const categoryIds = categoryGroups.map((g) => g.categoryId)
  const categories = categoryIds.length
    ? await prisma.fixedAssetCategory.findMany({
        where: { tenantId, id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : []
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]))

  return {
    statusGroups,
    categoryGroups,
    pendingCapitalization,
    totals,
    categoryNameById,
  }
}

export async function findAccountInLegalEntity(tenantId: string, legalEntityId: string, accountId: string) {
  return prisma.account.findFirst({
    where: { id: accountId, tenantId, legalEntityId },
  })
}

export async function findDefaultMappingAccount(
  tenantId: string,
  legalEntityId: string,
  mappingKey: DefaultAccountMappingKey,
) {
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId, mappingKey },
    include: { account: true },
  })
  return mapping?.account ?? null
}

const transferInclude = {
  asset: { select: { assetNumber: true, name: true } },
} as const

export async function listTransfers(tenantId: string, query: ListFixedAssetTransfersQueryInput) {
  const where: Prisma.FixedAssetTransferWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.assetId ? { assetId: query.assetId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.fixedAssetTransfer.findMany({
      where,
      include: transferInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.fixedAssetTransfer.count({ where }),
  ])
  return { items, total, page: query.page, pageSize: query.pageSize }
}

export async function findTransferById(tenantId: string, id: string) {
  return prisma.fixedAssetTransfer.findFirst({
    where: { id, tenantId },
    include: transferInclude,
  })
}

export async function findTransferByIdOrThrow(tenantId: string, id: string) {
  const row = await findTransferById(tenantId, id)
  if (!row) throw new FixedAssetNotFoundError('Fixed asset transfer not found')
  return row
}

export async function createTransfer(data: {
  tenantId: string
  legalEntityId: string
  assetId: string
  transferNumber: string
  transferDate: Date
  fromLocation: string | null
  fromPlant: string | null
  fromDepartment: string | null
  fromCustodian: string | null
  toLocation: string | null
  toPlant: string | null
  toDepartment: string | null
  toCustodian: string | null
  reason: string
  createdById: string
}) {
  return prisma.fixedAssetTransfer.create({
    data: {
      ...data,
      status: 'DRAFT',
    },
    include: transferInclude,
  })
}

export async function completeTransfer(args: {
  tenantId: string
  transferId: string
  userId: string
  expectedUpdatedAt?: string
  assetExpectedUpdatedAt?: string
}) {
  return prisma.$transaction(async (tx) => {
    const transfer = await tx.fixedAssetTransfer.findFirst({
      where: { id: args.transferId, tenantId: args.tenantId },
      include: transferInclude,
    })
    if (!transfer) throw new FixedAssetNotFoundError('Fixed asset transfer not found')
    if (args.expectedUpdatedAt && transfer.updatedAt.toISOString() !== args.expectedUpdatedAt) {
      throw new FixedAssetStaleVersionError()
    }

    const asset = await tx.fixedAsset.findFirst({
      where: { id: transfer.assetId, tenantId: args.tenantId },
    })
    if (!asset) throw new FixedAssetNotFoundError()
    if (args.assetExpectedUpdatedAt && asset.updatedAt.toISOString() !== args.assetExpectedUpdatedAt) {
      throw new FixedAssetStaleVersionError('Fixed asset was changed by another user')
    }

    await tx.fixedAsset.update({
      where: { id: asset.id },
      data: {
        location: transfer.toLocation ?? asset.location,
        plant: transfer.toPlant ?? asset.plant,
        department: transfer.toDepartment ?? asset.department,
        custodian: transfer.toCustodian ?? asset.custodian,
        updatedById: args.userId,
      },
    })

    return tx.fixedAssetTransfer.update({
      where: { id: transfer.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedById: args.userId,
        updatedById: args.userId,
      },
      include: transferInclude,
    })
  })
}

export async function createPartialDisposalDocument(
  args: {
    id: string
    tenantId: string
    legalEntityId: string
    assetId: string
    disposalNumber: string
    disposalType: 'SALE' | 'SCRAP' | 'WRITE_OFF'
    disposalDate: Date
    disposedCost: string
    disposedAccumDep: string
    disposedNbv: string
    proceeds: string
    gainLoss: string
    proceedsAccountId: string | null
    buyerName: string | null
    reason: string
    voucherId: string
    postingEventId: string
    userId: string
    remainingCost: string
    remainingAccum: string
    remainingResidual: string
    remainingNbv: string
    remainingStatus: FixedAssetStatus
    expectedUpdatedAt?: string
  },
  tx: Prisma.TransactionClient,
) {
  const existing = await tx.fixedAsset.findFirst({ where: { id: args.assetId, tenantId: args.tenantId } })
  if (!existing) throw new FixedAssetNotFoundError()
  if (args.expectedUpdatedAt && existing.updatedAt.toISOString() !== args.expectedUpdatedAt) {
    throw new FixedAssetStaleVersionError()
  }

  const disposal = await tx.fixedAssetDisposal.create({
    data: {
      id: args.id,
      tenantId: args.tenantId,
      legalEntityId: args.legalEntityId,
      assetId: args.assetId,
      disposalNumber: args.disposalNumber,
      draftReference: `FADSP-PARTIAL-${args.disposalNumber}`,
      disposalType: args.disposalType,
      disposalDate: args.disposalDate,
      postingDate: args.disposalDate,
      isPartial: true,
      status: 'POSTED',
      preDisposalAssetStatus: existing.status,
      acquisitionCostSnapshot: existing.acquisitionCost,
      accumulatedDepreciationSnapshot: existing.accumulatedDepreciation,
      netBookValueSnapshot: existing.netBookValue,
      disposedCost: args.disposedCost,
      disposedAccumDep: args.disposedAccumDep,
      disposedNbv: args.disposedNbv,
      proceeds: args.proceeds,
      totalProceeds: args.proceeds,
      gainLoss: args.gainLoss,
      proceedsAccountId: args.proceedsAccountId,
      buyerName: args.buyerName,
      reason: args.reason,
      voucherId: args.voucherId,
      postingEventId: args.postingEventId,
      postedAt: new Date(),
      postedById: args.userId,
      createdById: args.userId,
      uniquenessKey: `PARTIAL:${args.assetId}:${args.id}`,
    },
  })

  const updated = await tx.fixedAsset.updateMany({
    where: {
      id: args.assetId,
      tenantId: args.tenantId,
      status: { in: ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'] },
    },
    data: {
      acquisitionCost: args.remainingCost,
      accumulatedDepreciation: args.remainingAccum,
      residualValue: args.remainingResidual,
      netBookValue: args.remainingNbv,
      status: args.remainingStatus,
      disposalDocumentId: disposal.id,
      updatedById: args.userId,
    },
  })
  if (updated.count !== 1) throw new FixedAssetStaleVersionError()

  return disposal
}
