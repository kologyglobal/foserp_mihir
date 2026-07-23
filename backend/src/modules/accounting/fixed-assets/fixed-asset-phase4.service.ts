/**
 * Fixed Assets Phase 4 — revaluation, impairment, maintenance, reports.
 */
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import type {
  FixedAsset,
  FixedAssetCategory,
  FixedAssetImpairment,
  FixedAssetMaintenance,
  FixedAssetMaintenanceStatus,
  FixedAssetMaintenanceType,
  FixedAssetRevaluation,
} from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { add, compare, formatForPersistence, min, subtract } from '../shared/finance-decimal.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { buildPostedResult, post } from '../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../posting/posting.types.js'
import {
  FixedAssetInvalidStatusError,
  FixedAssetNotFoundError,
  FixedAssetValidationFailedError,
  mapPostingErrorToFixedAssetError,
} from './fixed-assets.errors.js'
import * as repo from './fixed-assets.repository.js'
import {
  buildImpairEventKey,
  buildRevalueEventKey,
  nextImpairmentNumber,
  nextMaintenanceNumber,
  nextRevaluationNumber,
  toDateOnlyString,
} from './fixed-asset-number.service.js'
import type {
  CreateFixedAssetImpairmentInput,
  CreateFixedAssetMaintenanceInput,
  CreateFixedAssetRevaluationInput,
  ListFixedAssetPhase4QueryInput,
  UpdateFixedAssetMaintenanceInput,
} from './fixed-assets.schemas.js'

const REVALUABLE = new Set(['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'])

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function assertPerm(req: Request, permission: string): void {
  if (!hasPerm(req, permission)) throw new AuthorizationError(`Missing permission: ${permission}`)
}

function money(v: string | number | { toString(): string }): string {
  return formatForPersistence(v.toString(), 4)
}

function serializeRevaluation(
  row: FixedAssetRevaluation & { asset: Pick<FixedAsset, 'assetNumber' | 'name'> },
) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    assetId: row.assetId,
    assetNumber: row.asset.assetNumber,
    assetName: row.asset.name,
    revaluationNumber: row.revaluationNumber,
    revaluationDate: toDateOnlyString(row.revaluationDate),
    previousNbv: money(row.previousNbv),
    revaluedAmount: money(row.revaluedAmount),
    surplusAmount: money(row.surplusAmount),
    status: row.status === 'POSTED' ? 'Posted' : row.status === 'CANCELLED' ? 'Cancelled' : 'Draft',
    reason: row.reason,
    voucherId: row.voucherId,
    postingEventId: row.postingEventId,
    postedAt: row.postedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeImpairment(
  row: FixedAssetImpairment & { asset: Pick<FixedAsset, 'assetNumber' | 'name'> },
) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    assetId: row.assetId,
    assetNumber: row.asset.assetNumber,
    assetName: row.asset.name,
    impairmentNumber: row.impairmentNumber,
    impairmentDate: toDateOnlyString(row.impairmentDate),
    carryingAmount: money(row.carryingAmount),
    recoverableAmount: money(row.recoverableAmount),
    impairmentLoss: money(row.impairmentLoss),
    status: row.status === 'RECOGNIZED' ? 'Recognized' : row.status === 'CANCELLED' ? 'Cancelled' : 'Draft',
    reason: row.reason,
    voucherId: row.voucherId,
    postingEventId: row.postingEventId,
    postedAt: row.postedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const MAINT_TYPE: Record<FixedAssetMaintenanceType, string> = {
  PREVENTIVE: 'Preventive',
  BREAKDOWN: 'Breakdown',
  CALIBRATION: 'Calibration',
  AMC: 'AMC',
  INSPECTION: 'Inspection',
}
const MAINT_STATUS: Record<FixedAssetMaintenanceStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

function serializeMaintenance(
  row: FixedAssetMaintenance & { asset: Pick<FixedAsset, 'assetNumber' | 'name'> },
) {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    assetId: row.assetId,
    assetNumber: row.asset.assetNumber,
    assetName: row.asset.name,
    maintenanceNumber: row.maintenanceNumber,
    maintenanceType: MAINT_TYPE[row.type],
    status: MAINT_STATUS[row.status],
    scheduledDate: toDateOnlyString(row.scheduledDate),
    completedDate: row.completedDate ? toDateOnlyString(row.completedDate) : null,
    vendorName: row.vendorName,
    cost: money(row.cost),
    downtimeHours: row.downtimeHours != null ? Number(row.downtimeHours) : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadAsset(tenantId: string, assetId: string) {
  try {
    return await repo.findAssetByIdOrThrow(tenantId, assetId)
  } catch {
    throw new FixedAssetNotFoundError()
  }
}

// ─── Revaluations ────────────────────────────────────────────────────────────

export async function listRevaluations(req: Request, tenantId: string, query: ListFixedAssetPhase4QueryInput) {
  assertPerm(req, 'finance.fa.view')
  const where = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.search
      ? {
          OR: [
            { revaluationNumber: { contains: query.search } },
            { asset: { assetNumber: { contains: query.search } } },
            { asset: { name: { contains: query.search } } },
          ],
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.fixedAssetRevaluation.count({ where }),
    prisma.fixedAssetRevaluation.findMany({
      where,
      include: { asset: { select: { assetNumber: true, name: true } } },
      orderBy: { revaluationDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return { items: rows.map(serializeRevaluation), total, page: query.page, pageSize: query.pageSize }
}

export async function getRevaluation(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.fa.view')
  const row = await prisma.fixedAssetRevaluation.findFirst({
    where: { id, tenantId },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  if (!row) throw new FixedAssetNotFoundError('Revaluation not found')
  return serializeRevaluation(row)
}

export async function createRevaluation(req: Request, tenantId: string, input: CreateFixedAssetRevaluationInput) {
  assertPerm(req, 'finance.fa.revalue')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const asset = await loadAsset(tenantId, input.assetId)
  if (asset.legalEntityId !== input.legalEntityId) {
    throw new FixedAssetValidationFailedError('Asset does not belong to the selected legal entity')
  }
  if (!REVALUABLE.has(asset.status)) {
    throw new FixedAssetInvalidStatusError('Only Active / Idle / Fully Depreciated assets can be revalued')
  }

  const previousNbv = money(asset.netBookValue)
  const revaluedAmount = money(input.revaluedAmount)
  if (compare(revaluedAmount, '0') <= 0) {
    throw new FixedAssetValidationFailedError('revaluedAmount must be positive')
  }
  const surplusAmount = money(subtract(revaluedAmount, previousNbv))
  const number = await nextRevaluationNumber(tenantId, input.legalEntityId)

  const row = await prisma.fixedAssetRevaluation.create({
    data: {
      id: randomUUID(),
      tenantId,
      legalEntityId: input.legalEntityId,
      assetId: asset.id,
      revaluationNumber: number,
      revaluationDate: parseDateOnly(input.revaluationDate),
      previousNbv,
      revaluedAmount,
      surplusAmount,
      reason: input.reason,
      createdById: userId,
    },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  return serializeRevaluation(row)
}

export async function postRevaluation(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.fa.revalue')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.fixedAssetRevaluation.findFirst({
    where: { id, tenantId },
    include: { asset: { include: { category: true } } },
  })
  if (!row) throw new FixedAssetNotFoundError('Revaluation not found')

  if (row.status === 'POSTED' && row.postingEventId && row.voucherId) {
    const posting = await buildPostedResult(tenantId, row.postingEventId, row.voucherId, true)
    return {
      revaluation: serializeRevaluation({ ...row, asset: row.asset }),
      posting,
      idempotentReplay: true,
    }
  }
  if (row.status !== 'DRAFT') {
    throw new FixedAssetInvalidStatusError('Only draft revaluations can be posted')
  }

  const asset = row.asset
  if (!REVALUABLE.has(asset.status)) {
    throw new FixedAssetInvalidStatusError('Asset status no longer allows revaluation')
  }
  if (compare(money(asset.netBookValue), money(row.previousNbv)) !== 0) {
    throw new FixedAssetValidationFailedError('Asset NBV changed since draft — recreate the revaluation')
  }

  const surplus = await repo.findDefaultMappingAccount(tenantId, asset.legalEntityId, 'ASSET_REVALUATION_SURPLUS')
  if (!surplus) {
    throw new FixedAssetValidationFailedError('ASSET_REVALUATION_SURPLUS default account mapping is not configured')
  }
  const impairmentLossMap = await repo.findDefaultMappingAccount(
    tenantId,
    asset.legalEntityId,
    'ASSET_IMPAIRMENT_LOSS',
  )

  const surplusAmt = money(row.surplusAmount)
  const lines: PostingRequestLine[] = []
  let lineNumber = 1
  let newCost = money(asset.acquisitionCost)
  let newNbv = money(asset.netBookValue)
  let newSurplus = money(asset.revaluationSurplus)
  let newImpairment = money(asset.accumulatedImpairment)

  if (compare(surplusAmt, '0') > 0) {
    lines.push(
      {
        lineNumber: lineNumber++,
        accountId: asset.category.assetAccountId,
        debitAmount: surplusAmt,
        creditAmount: '0',
        lineNarration: `Revalue up ${asset.assetNumber}`,
      },
      {
        lineNumber: lineNumber++,
        accountMappingKey: 'ASSET_REVALUATION_SURPLUS',
        debitAmount: '0',
        creditAmount: surplusAmt,
        lineNarration: `Revalue up ${asset.assetNumber}`,
      },
    )
    newCost = money(add(newCost, surplusAmt))
    newNbv = money(add(newNbv, surplusAmt))
    newSurplus = money(add(newSurplus, surplusAmt))
  } else if (compare(surplusAmt, '0') < 0) {
    const deficit = money(subtract('0', surplusAmt))
    const fromSurplus = money(min(newSurplus, deficit))
    const fromPl = money(subtract(deficit, fromSurplus))
    if (compare(fromSurplus, '0') > 0) {
      lines.push(
        {
          lineNumber: lineNumber++,
          accountMappingKey: 'ASSET_REVALUATION_SURPLUS',
          debitAmount: fromSurplus,
          creditAmount: '0',
          lineNarration: `Revalue down (surplus) ${asset.assetNumber}`,
        },
        {
          lineNumber: lineNumber++,
          accountId: asset.category.assetAccountId,
          debitAmount: '0',
          creditAmount: fromSurplus,
          lineNarration: `Revalue down (surplus) ${asset.assetNumber}`,
        },
      )
      newSurplus = money(subtract(newSurplus, fromSurplus))
    }
    if (compare(fromPl, '0') > 0) {
      if (!impairmentLossMap) {
        throw new FixedAssetValidationFailedError(
          'ASSET_IMPAIRMENT_LOSS default account mapping is required for revaluation deficits beyond surplus',
        )
      }
      lines.push(
        {
          lineNumber: lineNumber++,
          accountMappingKey: 'ASSET_IMPAIRMENT_LOSS',
          debitAmount: fromPl,
          creditAmount: '0',
          lineNarration: `Revalue down (P&L) ${asset.assetNumber}`,
        },
        {
          lineNumber: lineNumber++,
          accountId: asset.category.assetAccountId,
          debitAmount: '0',
          creditAmount: fromPl,
          lineNarration: `Revalue down (P&L) ${asset.assetNumber}`,
        },
      )
      newImpairment = money(add(newImpairment, fromPl))
    }
    newCost = money(subtract(newCost, deficit))
    newNbv = money(subtract(newNbv, deficit))
    if (compare(newNbv, '0') < 0 || compare(newCost, '0') < 0) {
      throw new FixedAssetValidationFailedError('Revaluation would drive cost/NBV negative')
    }
  } else {
    throw new FixedAssetValidationFailedError('Revalued amount equals current NBV — nothing to post')
  }

  const postingDate = toDateOnlyString(row.revaluationDate)
  const postingRequest: PostingRequest = {
    legalEntityId: asset.legalEntityId,
    eventKey: buildRevalueEventKey(row.id),
    eventType: 'FIXED_ASSET_REVALUED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: postingDate,
    postingDate,
    referenceNumber: row.revaluationNumber,
    narration: `Revalue ${asset.assetNumber}: ${row.reason}`.slice(0, 500),
    sourceModule: 'FIXED_ASSETS',
    sourceDocumentType: 'FIXED_ASSET',
    sourceDocumentId: asset.id,
    lines,
  }

  const postingContext: PostingContext = {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  }

  try {
    const posting = await post(postingRequest, postingContext, {
      afterAccounting: async ({ tx, voucherId, eventId }) => {
        const updatedAsset = await tx.fixedAsset.updateMany({
          where: { id: asset.id, tenantId, status: { in: ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'] } },
          data: {
            acquisitionCost: newCost,
            netBookValue: newNbv,
            revaluationSurplus: newSurplus,
            accumulatedImpairment: newImpairment,
            updatedById: userId,
          },
        })
        if (updatedAsset.count !== 1) {
          throw new FixedAssetInvalidStatusError('Asset changed concurrently during revaluation')
        }
        const updated = await tx.fixedAssetRevaluation.updateMany({
          where: { id: row.id, tenantId, status: 'DRAFT' },
          data: {
            status: 'POSTED',
            voucherId,
            postingEventId: eventId,
            postedAt: new Date(),
            postedById: userId,
            updatedById: userId,
          },
        })
        if (updated.count !== 1) {
          throw new FixedAssetInvalidStatusError('Revaluation changed concurrently')
        }
      },
    })

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'fixed_asset_revaluation',
      entityId: row.id,
      action: 'FIXED_ASSET_REVALUED',
      newValues: { voucherId: posting.voucherId, surplusAmount: surplusAmt },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })

    const fresh = await prisma.fixedAssetRevaluation.findFirstOrThrow({
      where: { id: row.id, tenantId },
      include: { asset: { select: { assetNumber: true, name: true } } },
    })
    return { revaluation: serializeRevaluation(fresh), posting, idempotentReplay: posting.idempotentReplay }
  } catch (error) {
    mapPostingErrorToFixedAssetError(error)
  }
}

export async function cancelRevaluation(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.fa.revalue')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const row = await prisma.fixedAssetRevaluation.findFirst({ where: { id, tenantId } })
  if (!row) throw new FixedAssetNotFoundError('Revaluation not found')
  if (row.status !== 'DRAFT') throw new FixedAssetInvalidStatusError('Only draft revaluations can be cancelled')
  const updated = await prisma.fixedAssetRevaluation.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId, updatedById: userId },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  return serializeRevaluation(updated)
}

// ─── Impairments ─────────────────────────────────────────────────────────────

export async function listImpairments(req: Request, tenantId: string, query: ListFixedAssetPhase4QueryInput) {
  assertPerm(req, 'finance.fa.view')
  const where = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.search
      ? {
          OR: [
            { impairmentNumber: { contains: query.search } },
            { asset: { assetNumber: { contains: query.search } } },
            { asset: { name: { contains: query.search } } },
          ],
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.fixedAssetImpairment.count({ where }),
    prisma.fixedAssetImpairment.findMany({
      where,
      include: { asset: { select: { assetNumber: true, name: true } } },
      orderBy: { impairmentDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return { items: rows.map(serializeImpairment), total, page: query.page, pageSize: query.pageSize }
}

export async function getImpairment(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.fa.view')
  const row = await prisma.fixedAssetImpairment.findFirst({
    where: { id, tenantId },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  if (!row) throw new FixedAssetNotFoundError('Impairment not found')
  return serializeImpairment(row)
}

export async function createImpairment(req: Request, tenantId: string, input: CreateFixedAssetImpairmentInput) {
  assertPerm(req, 'finance.fa.impair')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const asset = await loadAsset(tenantId, input.assetId)
  if (asset.legalEntityId !== input.legalEntityId) {
    throw new FixedAssetValidationFailedError('Asset does not belong to the selected legal entity')
  }
  if (!REVALUABLE.has(asset.status)) {
    throw new FixedAssetInvalidStatusError('Only Active / Idle / Fully Depreciated assets can be impaired')
  }

  const carryingAmount = money(asset.netBookValue)
  const recoverableAmount = money(input.recoverableAmount)
  if (compare(recoverableAmount, '0') < 0) {
    throw new FixedAssetValidationFailedError('recoverableAmount cannot be negative')
  }
  if (compare(recoverableAmount, carryingAmount) >= 0) {
    throw new FixedAssetValidationFailedError('recoverableAmount must be less than carrying amount (NBV)')
  }
  const impairmentLoss = money(subtract(carryingAmount, recoverableAmount))
  const number = await nextImpairmentNumber(tenantId, input.legalEntityId)

  const row = await prisma.fixedAssetImpairment.create({
    data: {
      id: randomUUID(),
      tenantId,
      legalEntityId: input.legalEntityId,
      assetId: asset.id,
      impairmentNumber: number,
      impairmentDate: parseDateOnly(input.impairmentDate),
      carryingAmount,
      recoverableAmount,
      impairmentLoss,
      reason: input.reason,
      createdById: userId,
    },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  return serializeImpairment(row)
}

export async function recognizeImpairment(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.fa.impair')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const row = await prisma.fixedAssetImpairment.findFirst({
    where: { id, tenantId },
    include: { asset: { include: { category: true } } },
  })
  if (!row) throw new FixedAssetNotFoundError('Impairment not found')

  if (row.status === 'RECOGNIZED' && row.postingEventId && row.voucherId) {
    const posting = await buildPostedResult(tenantId, row.postingEventId, row.voucherId, true)
    return {
      impairment: serializeImpairment({ ...row, asset: row.asset }),
      posting,
      idempotentReplay: true,
    }
  }
  if (row.status !== 'DRAFT') {
    throw new FixedAssetInvalidStatusError('Only draft impairments can be recognized')
  }

  const asset = row.asset as FixedAsset & { category: FixedAssetCategory }
  if (!REVALUABLE.has(asset.status)) {
    throw new FixedAssetInvalidStatusError('Asset status no longer allows impairment')
  }
  if (compare(money(asset.netBookValue), money(row.carryingAmount)) !== 0) {
    throw new FixedAssetValidationFailedError('Asset NBV changed since draft — recreate the impairment')
  }

  const lossMap = await repo.findDefaultMappingAccount(tenantId, asset.legalEntityId, 'ASSET_IMPAIRMENT_LOSS')
  if (!lossMap) {
    throw new FixedAssetValidationFailedError('ASSET_IMPAIRMENT_LOSS default account mapping is not configured')
  }

  const loss = money(row.impairmentLoss)
  const newCost = money(subtract(asset.acquisitionCost, loss))
  const newNbv = money(subtract(asset.netBookValue, loss))
  const newImpairment = money(add(asset.accumulatedImpairment, loss))
  if (compare(newNbv, '0') < 0 || compare(newCost, '0') < 0) {
    throw new FixedAssetValidationFailedError('Impairment would drive cost/NBV negative')
  }

  const postingDate = toDateOnlyString(row.impairmentDate)
  const postingRequest: PostingRequest = {
    legalEntityId: asset.legalEntityId,
    eventKey: buildImpairEventKey(row.id),
    eventType: 'FIXED_ASSET_IMPAIRED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: postingDate,
    postingDate,
    referenceNumber: row.impairmentNumber,
    narration: `Impair ${asset.assetNumber}: ${row.reason}`.slice(0, 500),
    sourceModule: 'FIXED_ASSETS',
    sourceDocumentType: 'FIXED_ASSET',
    sourceDocumentId: asset.id,
    lines: [
      {
        lineNumber: 1,
        accountMappingKey: 'ASSET_IMPAIRMENT_LOSS',
        debitAmount: loss,
        creditAmount: '0',
        lineNarration: `Impair ${asset.assetNumber}`,
      },
      {
        lineNumber: 2,
        accountId: asset.category.assetAccountId,
        debitAmount: '0',
        creditAmount: loss,
        lineNarration: `Impair ${asset.assetNumber}`,
      },
    ],
  }

  const postingContext: PostingContext = {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  }

  try {
    const posting = await post(postingRequest, postingContext, {
      afterAccounting: async ({ tx, voucherId, eventId }) => {
        const updatedAsset = await tx.fixedAsset.updateMany({
          where: { id: asset.id, tenantId, status: { in: ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'] } },
          data: {
            acquisitionCost: newCost,
            netBookValue: newNbv,
            accumulatedImpairment: newImpairment,
            updatedById: userId,
          },
        })
        if (updatedAsset.count !== 1) {
          throw new FixedAssetInvalidStatusError('Asset changed concurrently during impairment')
        }
        const updated = await tx.fixedAssetImpairment.updateMany({
          where: { id: row.id, tenantId, status: 'DRAFT' },
          data: {
            status: 'RECOGNIZED',
            voucherId,
            postingEventId: eventId,
            postedAt: new Date(),
            postedById: userId,
            updatedById: userId,
          },
        })
        if (updated.count !== 1) {
          throw new FixedAssetInvalidStatusError('Impairment changed concurrently')
        }
      },
    })

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'fixed_asset_impairment',
      entityId: row.id,
      action: 'FIXED_ASSET_IMPAIRED',
      newValues: { voucherId: posting.voucherId, impairmentLoss: loss },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })

    const fresh = await prisma.fixedAssetImpairment.findFirstOrThrow({
      where: { id: row.id, tenantId },
      include: { asset: { select: { assetNumber: true, name: true } } },
    })
    return { impairment: serializeImpairment(fresh), posting, idempotentReplay: posting.idempotentReplay }
  } catch (error) {
    mapPostingErrorToFixedAssetError(error)
  }
}

export async function cancelImpairment(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.fa.impair')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const row = await prisma.fixedAssetImpairment.findFirst({ where: { id, tenantId } })
  if (!row) throw new FixedAssetNotFoundError('Impairment not found')
  if (row.status !== 'DRAFT') throw new FixedAssetInvalidStatusError('Only draft impairments can be cancelled')
  const updated = await prisma.fixedAssetImpairment.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId, updatedById: userId },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  return serializeImpairment(updated)
}

// ─── Maintenance (no GL) ─────────────────────────────────────────────────────

const TYPE_FROM_API: Record<string, FixedAssetMaintenanceType> = {
  Preventive: 'PREVENTIVE',
  Breakdown: 'BREAKDOWN',
  Calibration: 'CALIBRATION',
  AMC: 'AMC',
  Inspection: 'INSPECTION',
  PREVENTIVE: 'PREVENTIVE',
  BREAKDOWN: 'BREAKDOWN',
  CALIBRATION: 'CALIBRATION',
  INSPECTION: 'INSPECTION',
}

export async function listMaintenance(req: Request, tenantId: string, query: ListFixedAssetPhase4QueryInput) {
  assertPerm(req, 'finance.fa.view')
  const where = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.search
      ? {
          OR: [
            { maintenanceNumber: { contains: query.search } },
            { vendorName: { contains: query.search } },
            { asset: { assetNumber: { contains: query.search } } },
            { asset: { name: { contains: query.search } } },
          ],
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.fixedAssetMaintenance.count({ where }),
    prisma.fixedAssetMaintenance.findMany({
      where,
      include: { asset: { select: { assetNumber: true, name: true } } },
      orderBy: { scheduledDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return { items: rows.map(serializeMaintenance), total, page: query.page, pageSize: query.pageSize }
}

export async function getMaintenance(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.fa.view')
  const row = await prisma.fixedAssetMaintenance.findFirst({
    where: { id, tenantId },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  if (!row) throw new FixedAssetNotFoundError('Maintenance record not found')
  return serializeMaintenance(row)
}

export async function createMaintenance(req: Request, tenantId: string, input: CreateFixedAssetMaintenanceInput) {
  assertPerm(req, 'finance.fa.maintain')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')

  const asset = await loadAsset(tenantId, input.assetId)
  if (asset.legalEntityId !== input.legalEntityId) {
    throw new FixedAssetValidationFailedError('Asset does not belong to the selected legal entity')
  }
  const type = TYPE_FROM_API[input.maintenanceType]
  if (!type) throw new FixedAssetValidationFailedError('Invalid maintenance type')

  const number = await nextMaintenanceNumber(tenantId, input.legalEntityId)
  const row = await prisma.fixedAssetMaintenance.create({
    data: {
      id: randomUUID(),
      tenantId,
      legalEntityId: input.legalEntityId,
      assetId: asset.id,
      maintenanceNumber: number,
      type,
      scheduledDate: parseDateOnly(input.scheduledDate),
      vendorName: input.vendorName ?? null,
      cost: money(input.cost ?? '0'),
      downtimeHours: input.downtimeHours != null ? input.downtimeHours : null,
      notes: input.notes ?? null,
      createdById: userId,
    },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  return serializeMaintenance(row)
}

export async function updateMaintenance(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateFixedAssetMaintenanceInput,
) {
  assertPerm(req, 'finance.fa.maintain')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const row = await prisma.fixedAssetMaintenance.findFirst({ where: { id, tenantId } })
  if (!row) throw new FixedAssetNotFoundError('Maintenance record not found')
  if (row.status === 'COMPLETED' || row.status === 'CANCELLED') {
    throw new FixedAssetInvalidStatusError('Completed or cancelled maintenance cannot be edited')
  }

  let status: FixedAssetMaintenanceStatus | undefined
  if (input.status) {
    const map: Record<string, FixedAssetMaintenanceStatus> = {
      Scheduled: 'SCHEDULED',
      'In Progress': 'IN_PROGRESS',
      SCHEDULED: 'SCHEDULED',
      IN_PROGRESS: 'IN_PROGRESS',
    }
    status = map[input.status]
    if (!status) throw new FixedAssetValidationFailedError('Invalid status for update')
  }

  const updated = await prisma.fixedAssetMaintenance.update({
    where: { id },
    data: {
      ...(input.vendorName !== undefined ? { vendorName: input.vendorName } : {}),
      ...(input.cost !== undefined ? { cost: money(input.cost) } : {}),
      ...(input.downtimeHours !== undefined ? { downtimeHours: input.downtimeHours } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.scheduledDate ? { scheduledDate: parseDateOnly(input.scheduledDate) } : {}),
      ...(status ? { status } : {}),
      updatedById: userId,
    },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  return serializeMaintenance(updated)
}

export async function completeMaintenance(req: Request, tenantId: string, id: string, completedDate?: string) {
  assertPerm(req, 'finance.fa.maintain')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const row = await prisma.fixedAssetMaintenance.findFirst({ where: { id, tenantId } })
  if (!row) throw new FixedAssetNotFoundError('Maintenance record not found')
  if (row.status === 'CANCELLED') throw new FixedAssetInvalidStatusError('Cancelled maintenance cannot be completed')
  if (row.status === 'COMPLETED') {
    return serializeMaintenance(
      await prisma.fixedAssetMaintenance.findFirstOrThrow({
        where: { id, tenantId },
        include: { asset: { select: { assetNumber: true, name: true } } },
      }),
    )
  }
  const date = completedDate ?? new Date().toISOString().slice(0, 10)
  const updated = await prisma.fixedAssetMaintenance.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedDate: parseDateOnly(date),
      updatedById: userId,
    },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  return serializeMaintenance(updated)
}

export async function cancelMaintenance(req: Request, tenantId: string, id: string) {
  assertPerm(req, 'finance.fa.maintain')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const row = await prisma.fixedAssetMaintenance.findFirst({ where: { id, tenantId } })
  if (!row) throw new FixedAssetNotFoundError('Maintenance record not found')
  if (row.status === 'COMPLETED') throw new FixedAssetInvalidStatusError('Completed maintenance cannot be cancelled')
  const updated = await prisma.fixedAssetMaintenance.update({
    where: { id },
    data: { status: 'CANCELLED', updatedById: userId },
    include: { asset: { select: { assetNumber: true, name: true } } },
  })
  return serializeMaintenance(updated)
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function reportSummary(req: Request, tenantId: string, legalEntityId: string) {
  assertPerm(req, 'finance.fa.view')
  const assets = await prisma.fixedAsset.findMany({
    where: { tenantId, legalEntityId, status: { not: 'CANCELLED' } },
    select: {
      status: true,
      acquisitionCost: true,
      accumulatedDepreciation: true,
      netBookValue: true,
      revaluationSurplus: true,
      accumulatedImpairment: true,
    },
  })
  const active = assets.filter((a) => ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'].includes(a.status))
  const disposed = assets.filter((a) => a.status === 'DISPOSED')
  const sum = (
    rows: typeof assets,
    key: 'acquisitionCost' | 'accumulatedDepreciation' | 'netBookValue' | 'revaluationSurplus' | 'accumulatedImpairment',
  ) => {
    let total = '0'
    for (const row of rows) {
      total = formatForPersistence(add(total, money(row[key] as { toString(): string })))
    }
    return money(total)
  }

  const [revalCount, impairCount, maintOpen] = await Promise.all([
    prisma.fixedAssetRevaluation.count({ where: { tenantId, legalEntityId, status: 'POSTED' } }),
    prisma.fixedAssetImpairment.count({ where: { tenantId, legalEntityId, status: 'RECOGNIZED' } }),
    prisma.fixedAssetMaintenance.count({
      where: { tenantId, legalEntityId, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
    }),
  ])

  return {
    legalEntityId,
    assetCount: assets.length,
    activeCount: active.length,
    disposedCount: disposed.length,
    totalCost: sum(active, 'acquisitionCost'),
    totalAccumDep: sum(active, 'accumulatedDepreciation'),
    totalNbv: sum(active, 'netBookValue'),
    totalRevaluationSurplus: sum(active, 'revaluationSurplus'),
    totalAccumulatedImpairment: sum(active, 'accumulatedImpairment'),
    postedRevaluations: revalCount,
    recognizedImpairments: impairCount,
    openMaintenance: maintOpen,
  }
}

export async function reportNbvByCategory(req: Request, tenantId: string, legalEntityId: string) {
  assertPerm(req, 'finance.fa.view')
  const assets = await prisma.fixedAsset.findMany({
    where: {
      tenantId,
      legalEntityId,
      status: { in: ['ACTIVE', 'IDLE', 'FULLY_DEPRECIATED'] },
    },
    include: { category: { select: { id: true, code: true, name: true } } },
  })
  const map = new Map<
    string,
    { categoryId: string; categoryCode: string; categoryName: string; count: number; cost: string; accumDep: string; nbv: string }
  >()
  for (const a of assets) {
    const cur = map.get(a.categoryId) ?? {
      categoryId: a.categoryId,
      categoryCode: a.category.code,
      categoryName: a.category.name,
      count: 0,
      cost: '0.0000',
      accumDep: '0.0000',
      nbv: '0.0000',
    }
    cur.count += 1
    cur.cost = money(add(cur.cost, a.acquisitionCost))
    cur.accumDep = money(add(cur.accumDep, a.accumulatedDepreciation))
    cur.nbv = money(add(cur.nbv, a.netBookValue))
    map.set(a.categoryId, cur)
  }
  return [...map.values()].sort((a, b) => a.categoryCode.localeCompare(b.categoryCode))
}

export async function reportRegister(req: Request, tenantId: string, legalEntityId: string) {
  assertPerm(req, 'finance.fa.view')
  const assets = await prisma.fixedAsset.findMany({
    where: { tenantId, legalEntityId, status: { not: 'CANCELLED' } },
    include: { category: { select: { code: true, name: true } } },
    orderBy: { assetNumber: 'asc' },
  })
  return assets.map((a) => ({
    id: a.id,
    assetNumber: a.assetNumber,
    name: a.name,
    categoryCode: a.category.code,
    categoryName: a.category.name,
    status: a.status,
    acquisitionDate: toDateOnlyString(a.acquisitionDate),
    acquisitionCost: money(a.acquisitionCost),
    accumulatedDepreciation: money(a.accumulatedDepreciation),
    netBookValue: money(a.netBookValue),
    revaluationSurplus: money(a.revaluationSurplus),
    accumulatedImpairment: money(a.accumulatedImpairment),
    location: a.location,
  }))
}

export async function reportDisposals(req: Request, tenantId: string, legalEntityId: string) {
  assertPerm(req, 'finance.fa.view')
  const assets = await prisma.fixedAsset.findMany({
    where: { tenantId, legalEntityId, status: 'DISPOSED' },
    orderBy: { disposalDate: 'desc' },
  })
  return assets.map((a) => ({
    id: a.id,
    assetNumber: a.assetNumber,
    name: a.name,
    disposalType: a.disposalType,
    disposalDate: a.disposalDate ? toDateOnlyString(a.disposalDate) : null,
    proceeds: a.disposalProceeds != null ? money(a.disposalProceeds) : null,
    gainLoss: a.disposalGainLoss != null ? money(a.disposalGainLoss) : null,
    nbvAtDisposal: money(a.netBookValue),
    buyerName: a.disposalBuyerName,
  }))
}
