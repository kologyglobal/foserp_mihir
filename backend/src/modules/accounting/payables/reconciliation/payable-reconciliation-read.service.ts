import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { reconstructOpenItemsAsOf } from './payable-reconciliation-balances.service.js'
import { computeVendorLevelReconciliation } from './payable-reconciliation-vendor.service.js'
import { isReconciliationRunStale } from './payable-reconciliation.service.js'
import {
  PayableReconciliationExceptionNotAcknowledgeableError,
  PayableReconciliationExceptionNotFoundError,
  PayableReconciliationRunNotFoundError,
} from './payable-reconciliation.errors.js'
import type {
  AcknowledgeExceptionInput,
  ListReconciliationExceptionsQuery,
  ListReconciliationRunsQuery,
  ReconciliationAccountResultDto,
  ReconciliationExceptionDto,
  ReconciliationRunDto,
  VendorBalanceRow,
} from './payable-reconciliation.types.js'

function toRunDto(
  run: Prisma.PayableReconciliationRunGetPayload<Record<string, never>>,
  isStale: boolean,
): ReconciliationRunDto {
  return {
    id: run.id,
    tenantId: run.tenantId,
    legalEntityId: run.legalEntityId,
    asOfDate: run.asOfDate.toISOString().slice(0, 10),
    sourceMode: run.sourceMode,
    runStatus: run.runStatus,
    status: run.status,
    baseCurrency: run.baseCurrency,
    tolerance: formatForPersistence(run.tolerance),
    includeVendorLevel: run.includeVendorLevel,
    controlAccountCount: run.controlAccountCount,
    matchedAccountCount: run.matchedAccountCount,
    mismatchedAccountCount: run.mismatchedAccountCount,
    glTotal: formatForPersistence(run.glTotal),
    subledgerTotal: formatForPersistence(run.subledgerTotal),
    variance: formatForPersistence(run.variance),
    exceptionCount: run.exceptionCount,
    infoCount: run.infoCount,
    warningCount: run.warningCount,
    errorCount: run.errorCount,
    blockerCount: run.blockerCount,
    vendorCount: run.vendorCount,
    vendorMismatchCount: run.vendorMismatchCount,
    limitations: Array.isArray(run.limitations) ? (run.limitations as string[]) : [],
    errorMessage: run.errorMessage,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    createdBy: run.createdBy,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    isStale,
  }
}

function toAccountResultDto(
  row: Prisma.PayableReconciliationAccountResultGetPayload<Record<string, never>>,
): ReconciliationAccountResultDto {
  return {
    id: row.id,
    runId: row.runId,
    accountId: row.accountId,
    accountCode: row.accountCode,
    accountName: row.accountName,
    glBalance: formatForPersistence(row.glBalance),
    subledgerBalance: formatForPersistence(row.subledgerBalance),
    variance: formatForPersistence(row.variance),
    matched: row.matched,
    openItemCount: row.openItemCount,
  }
}

function toExceptionDto(
  row: Prisma.PayableReconciliationExceptionGetPayload<Record<string, never>>,
): ReconciliationExceptionDto {
  return {
    id: row.id,
    runId: row.runId,
    severity: row.severity,
    category: row.category,
    code: row.code,
    message: row.message,
    accountId: row.accountId,
    vendorId: row.vendorId,
    openItemId: row.openItemId,
    voucherId: row.voucherId,
    documentType: row.documentType,
    documentId: row.documentId,
    details: (row.details as Record<string, unknown> | null) ?? null,
    isAcknowledged: row.isAcknowledged,
    acknowledgedBy: row.acknowledgedBy,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    acknowledgementNote: row.acknowledgementNote,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listReconciliationRuns(
  tenantId: string,
  query: ListReconciliationRunsQuery,
): Promise<{ items: ReconciliationRunDto[]; total: number; page: number; pageSize: number }> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const [total, rows] = await Promise.all([
    prisma.payableReconciliationRun.count({ where: { tenantId, legalEntityId: query.legalEntityId } }),
    prisma.payableReconciliationRun.findMany({
      where: { tenantId, legalEntityId: query.legalEntityId },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  const items = rows.map((run) => toRunDto(run, false))
  return { items, total, page, pageSize }
}

export async function getReconciliationRunDetail(
  tenantId: string,
  runId: string,
): Promise<ReconciliationRunDto> {
  const run = await prisma.payableReconciliationRun.findFirst({ where: { id: runId, tenantId } })
  if (!run) throw new PayableReconciliationRunNotFoundError()
  const isStale = await isReconciliationRunStale(tenantId, run.legalEntityId, run.completedAt)
  return toRunDto(run, isStale)
}

export async function listReconciliationAccountResults(
  tenantId: string,
  runId: string,
  page = 1,
  pageSize = 50,
): Promise<{ items: ReconciliationAccountResultDto[]; total: number; page: number; pageSize: number }> {
  await getReconciliationRunOrThrowLocal(tenantId, runId)
  const [total, rows] = await Promise.all([
    prisma.payableReconciliationAccountResult.count({ where: { runId, tenantId } }),
    prisma.payableReconciliationAccountResult.findMany({
      where: { runId, tenantId },
      orderBy: { accountCode: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { items: rows.map(toAccountResultDto), total, page, pageSize }
}

export async function listReconciliationExceptions(
  tenantId: string,
  runId: string,
  query: ListReconciliationExceptionsQuery,
): Promise<{ items: ReconciliationExceptionDto[]; total: number; page: number; pageSize: number }> {
  await getReconciliationRunOrThrowLocal(tenantId, runId)
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 50
  const where: Prisma.PayableReconciliationExceptionWhereInput = {
    runId,
    tenantId,
    ...(query.severity ? { severity: query.severity } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.isAcknowledged !== undefined ? { isAcknowledged: query.isAcknowledged } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.payableReconciliationException.count({ where }),
    prisma.payableReconciliationException.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { items: rows.map(toExceptionDto), total, page, pageSize }
}

/**
 * Vendor-level rows are not persisted per-run (only run-level vendorCount/vendorMismatchCount
 * are); this recomputes them live from the run's own control accounts / tolerance / asOfDate /
 * sourceMode, mirroring exactly what the run itself would have shown at creation time.
 */
export async function listReconciliationRunVendors(
  tenantId: string,
  runId: string,
  page = 1,
  pageSize = 50,
): Promise<{ items: VendorBalanceRow[]; total: number; page: number; pageSize: number }> {
  const run = await getReconciliationRunOrThrowLocal(tenantId, runId)
  if (!run.includeVendorLevel) {
    return { items: [], total: 0, page, pageSize }
  }

  const accountResults = await prisma.payableReconciliationAccountResult.findMany({
    where: { runId, tenantId },
    select: { accountId: true },
  })
  const controlAccountIds = accountResults.map((a) => a.accountId)
  const isHistorical = run.sourceMode === 'HISTORICAL_RECONSTRUCTION'
  const asOfItems = isHistorical
    ? await reconstructOpenItemsAsOf(tenantId, run.legalEntityId, controlAccountIds, run.asOfDate)
    : []

  const { vendors } = await computeVendorLevelReconciliation(
    tenantId,
    run.legalEntityId,
    controlAccountIds,
    run.tolerance,
    isHistorical,
    run.asOfDate,
    asOfItems,
  )

  const total = vendors.length
  const items = vendors.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
  return { items, total, page, pageSize }
}

export async function getReconciliationExceptionDetail(
  tenantId: string,
  exceptionId: string,
): Promise<ReconciliationExceptionDto> {
  const row = await prisma.payableReconciliationException.findFirst({ where: { id: exceptionId, tenantId } })
  if (!row) throw new PayableReconciliationExceptionNotFoundError()
  return toExceptionDto(row)
}

export async function acknowledgeReconciliationException(
  tenantId: string,
  exceptionId: string,
  userId: string | null,
  input: AcknowledgeExceptionInput,
): Promise<ReconciliationExceptionDto> {
  const row = await prisma.payableReconciliationException.findFirst({ where: { id: exceptionId, tenantId } })
  if (!row) throw new PayableReconciliationExceptionNotFoundError()
  if (row.severity !== 'INFO' && row.severity !== 'WARNING') {
    throw new PayableReconciliationExceptionNotAcknowledgeableError()
  }
  const updated = await prisma.payableReconciliationException.update({
    where: { id: row.id },
    data: {
      isAcknowledged: true,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
      acknowledgementNote: input.note ?? null,
    },
  })
  return toExceptionDto(updated)
}

async function getReconciliationRunOrThrowLocal(tenantId: string, runId: string) {
  const run = await prisma.payableReconciliationRun.findFirst({ where: { id: runId, tenantId } })
  if (!run) throw new PayableReconciliationRunNotFoundError()
  return run
}
