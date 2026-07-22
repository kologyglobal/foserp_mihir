import type { FixedAssetStatus } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import {
  add,
  compare,
  divide,
  formatForPersistence,
  isPositive,
  min,
  subtract,
  sumDecimals,
} from '../shared/finance-decimal.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../shared/finance.helpers.js'
import { buildPostedResult, post } from '../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine } from '../posting/posting.types.js'
import {
  FixedAssetDepreciationRunAlreadyPostedError,
  FixedAssetDepreciationRunConflictError,
  mapPostingErrorToFixedAssetError,
} from './fixed-assets.errors.js'
import * as repo from './fixed-assets.repository.js'
import {
  buildDepreciationEventKey,
  nextDepreciationRunNumber,
  parsePeriodKey,
  toDateOnlyString,
} from './fixed-asset-number.service.js'
import { serializeDepreciationRun } from './fixed-asset-serialize.js'
import type { CreateDepreciationRunInput, DepreciationPreviewInput } from './fixed-assets.schemas.js'
import type { FixedAssetDepreciationLineDto, FixedAssetDepreciationPreviewDto } from './fixed-assets.types.js'

interface ComputedDepreciationLine extends FixedAssetDepreciationLineDto {
  newStatus: FixedAssetStatus
}

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function assertDepreciatePermission(req: Request): void {
  if (!hasPerm(req, 'finance.fa.depreciate')) {
    throw new AuthorizationError('Missing permission: finance.fa.depreciate')
  }
}

function computeMonthlyDepreciation(acquisitionCost: string, residualValue: string, usefulLifeYears: number): string {
  const depreciable = subtract(acquisitionCost, residualValue)
  if (!isPositive(depreciable)) return '0.0000'
  const months = usefulLifeYears * 12
  return formatForPersistence(divide(depreciable, months), 4)
}

async function computeDepreciationLines(
  tenantId: string,
  legalEntityId: string,
  periodKey: string,
): Promise<{ periodFrom: Date; periodTo: Date; lines: ComputedDepreciationLine[] }> {
  const { periodFrom, periodTo } = parsePeriodKey(periodKey)
  const assets = await repo.listActiveAssetsForDepreciation(tenantId, legalEntityId, periodTo)
  const lines: ComputedDepreciationLine[] = []
  let lineNumber = 0

  for (const asset of assets) {
    const openingNbv = formatForPersistence(asset.netBookValue, 4)
    const residualValue = formatForPersistence(asset.residualValue, 4)
    const remaining = subtract(openingNbv, residualValue)
    if (!isPositive(remaining)) continue

    const monthly = computeMonthlyDepreciation(
      asset.acquisitionCost.toString(),
      asset.residualValue.toString(),
      asset.usefulLifeYears,
    )
    const depreciationAmount = min(monthly, remaining)
    if (!isPositive(depreciationAmount)) continue

    lineNumber += 1
    const closingNbv = formatForPersistence(subtract(openingNbv, depreciationAmount), 4)
    const accumulatedDepreciation = formatForPersistence(
      add(asset.accumulatedDepreciation, depreciationAmount),
      4,
    )
    const newStatus: FixedAssetStatus =
      compare(closingNbv, residualValue) <= 0 ? 'FULLY_DEPRECIATED' : 'ACTIVE'

    lines.push({
      lineNumber,
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      assetName: asset.name,
      categoryName: asset.category.name,
      openingNbv,
      depreciationAmount: formatForPersistence(depreciationAmount, 4),
      closingNbv,
      accumulatedDepreciation,
      depExpenseAccountId: asset.category.depExpenseAccountId,
      accumDepAccountId: asset.category.accumDepAccountId,
      newStatus,
    })
  }

  return { periodFrom, periodTo, lines }
}

export async function computeDepreciationPreview(
  tenantId: string,
  input: DepreciationPreviewInput,
): Promise<FixedAssetDepreciationPreviewDto> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const { periodFrom, periodTo, lines } = await computeDepreciationLines(
    tenantId,
    input.legalEntityId,
    input.periodKey,
  )

  const totalDepreciation = formatForPersistence(
    sumDecimals(lines.map((l) => l.depreciationAmount)),
    4,
  )

  return {
    legalEntityId: input.legalEntityId,
    periodKey: input.periodKey,
    periodFrom: toDateOnlyString(periodFrom),
    periodTo: toDateOnlyString(periodTo),
    totalDepreciation,
    assetCount: lines.length,
    lines: lines.map(({ newStatus: _ignored, ...line }) => line),
  }
}

function consolidatePostingLines(lines: ComputedDepreciationLine[]): PostingRequestLine[] {
  const buckets = new Map<string, { depExpenseAccountId: string; accumDepAccountId: string; amount: string }>()

  for (const line of lines) {
    const key = `${line.depExpenseAccountId}:${line.accumDepAccountId}`
    const existing = buckets.get(key)
    if (existing) {
      existing.amount = formatForPersistence(add(existing.amount, line.depreciationAmount), 4)
    } else {
      buckets.set(key, {
        depExpenseAccountId: line.depExpenseAccountId,
        accumDepAccountId: line.accumDepAccountId,
        amount: line.depreciationAmount,
      })
    }
  }

  const postingLines: PostingRequestLine[] = []
  let lineNumber = 0
  for (const bucket of buckets.values()) {
    lineNumber += 1
    postingLines.push({
      lineNumber,
      accountId: bucket.depExpenseAccountId,
      debitAmount: bucket.amount,
      creditAmount: '0',
      lineNarration: 'Fixed asset depreciation expense',
    })
    lineNumber += 1
    postingLines.push({
      lineNumber,
      accountId: bucket.accumDepAccountId,
      debitAmount: '0',
      creditAmount: bucket.amount,
      lineNarration: 'Fixed asset accumulated depreciation',
    })
  }

  return postingLines
}

function buildDepreciationPostingRequest(args: {
  runId: string
  legalEntityId: string
  runNumber: string
  periodKey: string
  postingDate: string
  periodTo: string
  lines: ComputedDepreciationLine[]
}): PostingRequest {
  return {
    legalEntityId: args.legalEntityId,
    eventKey: buildDepreciationEventKey(args.runId),
    eventType: 'FIXED_ASSET_DEPRECIATED',
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: args.periodTo,
    postingDate: args.postingDate,
    referenceNumber: args.runNumber,
    narration: `Fixed asset depreciation — ${args.periodKey}`,
    sourceModule: 'FIXED_ASSETS',
    sourceDocumentType: 'FIXED_ASSET_DEPRECIATION_RUN',
    sourceDocumentId: args.runId,
    lines: consolidatePostingLines(args.lines),
  }
}

export async function previewDepreciation(req: Request, tenantId: string, input: DepreciationPreviewInput) {
  assertDepreciatePermission(req)
  return computeDepreciationPreview(tenantId, input)
}

export async function createAndPostDepreciationRun(req: Request, tenantId: string, input: CreateDepreciationRunInput) {
  assertDepreciatePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  const existing = await repo.findDepreciationRunByPeriod(tenantId, input.legalEntityId, input.periodKey)
  if (existing?.status === 'POSTED') {
    if (existing.postingEventId && existing.voucherId) {
      const posting = await buildPostedResult(tenantId, existing.postingEventId, existing.voucherId, true)
      return {
        run: serializeDepreciationRun(existing, existing.lines),
        posting,
        idempotentReplay: true,
      }
    }
    throw new FixedAssetDepreciationRunAlreadyPostedError()
  }
  if (existing && existing.status !== 'DRAFT') {
    throw new FixedAssetDepreciationRunConflictError()
  }

  const { periodFrom, periodTo, lines: computedLines } = await computeDepreciationLines(
    tenantId,
    input.legalEntityId,
    input.periodKey,
  )
  const totalDepreciation = formatForPersistence(
    sumDecimals(computedLines.map((l) => l.depreciationAmount)),
    4,
  )
  const postingDate = input.postingDate ?? toDateOnlyString(periodTo)
  const runDate = new Date().toISOString().slice(0, 10)

  let run = existing
  if (!run) {
    const runNumber = await nextDepreciationRunNumber(tenantId, input.legalEntityId, input.periodKey)
    run = await repo.createDepreciationRunWithLines({
      tenantId,
      legalEntityId: input.legalEntityId,
      runNumber,
      periodKey: input.periodKey,
      periodFrom,
      periodTo,
      runDate: parseDateOnly(runDate),
      postingDate: parseDateOnly(postingDate),
      totalDepreciation,
      assetCount: computedLines.length,
      userId,
      lines: computedLines.map(({ newStatus: _ignored, ...line }) => line),
    })
  }

  if (!isPositive(totalDepreciation)) {
    await prisma.fixedAssetDepreciationRun.update({
      where: { id: run.id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedById: userId,
        updatedById: userId,
      },
    })
    const refreshed = await repo.findDepreciationRunByIdOrThrow(tenantId, run.id)
    return { run: serializeDepreciationRun(refreshed, refreshed.lines), posting: null, idempotentReplay: false }
  }

  const postingRequest = buildDepreciationPostingRequest({
    runId: run.id,
    legalEntityId: input.legalEntityId,
    runNumber: run.runNumber,
    periodKey: input.periodKey,
    postingDate,
    periodTo: toDateOnlyString(periodTo),
    lines: computedLines,
  })

  const postingContext: PostingContext = {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  }

  const assetUpdates = computedLines.map((line) => ({
    assetId: line.assetId,
    accumulatedDepreciation: line.accumulatedDepreciation,
    netBookValue: line.closingNbv,
    status: line.newStatus,
  }))

  try {
    const posting = await post(postingRequest, postingContext, {
      afterAccounting: async ({ tx, context, eventId, voucherId }) => {
        await repo.finalizeDepreciationRun(
          {
            tenantId: context.tenantId,
            runId: run!.id,
            voucherId,
            postingEventId: eventId,
            userId: context.userId ?? userId,
            assetUpdates,
          },
          tx,
        )
      },
    })

    if (!posting.idempotentReplay) {
      await createAuditLog({
        tenantId,
        userId,
        module: 'finance',
        entity: 'fixed_asset_depreciation_run',
        entityId: run.id,
        action: 'FIXED_ASSET_DEPRECIATION_POSTED',
        newValues: { voucherNumber: posting.voucherNumber, periodKey: input.periodKey },
        ipAddress: audit.ipAddress ?? null,
        userAgent: audit.userAgent ?? null,
      })
    }

    const refreshed = await repo.findDepreciationRunByIdOrThrow(tenantId, run.id)
    return {
      run: serializeDepreciationRun(refreshed, refreshed.lines),
      posting,
      idempotentReplay: posting.idempotentReplay,
    }
  } catch (error) {
    mapPostingErrorToFixedAssetError(error)
  }
}

export async function listDepreciationRuns(_req: Request, tenantId: string, query: Parameters<typeof repo.listDepreciationRuns>[1]) {
  const result = await repo.listDepreciationRuns(tenantId, query)
  return {
    ...result,
    items: result.items.map((run) => serializeDepreciationRun(run)),
  }
}

export async function getDepreciationRun(_req: Request, tenantId: string, id: string) {
  const run = await repo.findDepreciationRunByIdOrThrow(tenantId, id)
  return serializeDepreciationRun(run, run.lines)
}

export async function getCurrentMonthDepreciationDue(tenantId: string, legalEntityId: string): Promise<string> {
  const now = new Date()
  const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  try {
    const preview = await computeDepreciationPreview(tenantId, { legalEntityId, periodKey })
    return preview.totalDepreciation
  } catch {
    return '0.0000'
  }
}
