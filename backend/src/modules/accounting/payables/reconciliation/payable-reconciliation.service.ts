import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { formatForPersistence, subtract, sumDecimals, toDecimal } from '../../shared/finance-decimal.js'
import { compareDateOnly, getTodayInTimezone, parseDateOnly } from '../reporting/payable-ageing.service.js'
import {
  aggregateAsOfByAccount,
  aggregateCurrentSubledgerByAccount,
  aggregateGlByAccount,
  reconstructOpenItemsAsOf,
} from './payable-reconciliation-balances.service.js'
import { resolveControlAccounts } from './payable-reconciliation-control-accounts.service.js'
import { runIntegrityChecks } from './payable-reconciliation-integrity.service.js'
import { computeVendorLevelReconciliation } from './payable-reconciliation-vendor.service.js'
import { PayableReconciliationDateInFutureError, PayableReconciliationRunNotFoundError } from './payable-reconciliation.errors.js'
import type {
  AccountBalanceRow,
  CreateReconciliationRunInput,
  ReconciledOpenItemAsOf,
  ReconciliationActor,
  ReconciliationExceptionDraft,
  ReconciliationRunDto,
  VendorBalanceRow,
} from './payable-reconciliation.types.js'

const HISTORICAL_LIMITATIONS = [
  'HISTORICAL_RECONSTRUCTION_EXCLUDES_DATED_ADJUSTMENTS_AND_WRITE_OFFS: adjustedAmount/writtenOffAmount are not ' +
    'tracked by date in this phase, so historical subledger balances use originalAmount minus allocations that ' +
    'existed as of asOfDate only.',
  'HISTORICAL_RECONSTRUCTION_USES_DOCUMENT_REVERSAL_DATE: an open item is excluded once its source document\'s ' +
    'reversalDate falls on or before asOfDate.',
]

/**
 * Computes and persists a full AP-to-GL reconciliation run: resolves control accounts, aggregates
 * GL vs. subledger balances (current or historical), runs data-quality checks, and optionally adds
 * vendor-level (party) reconciliation. Never mutates GL / open-item / voucher / posting-event rows —
 * only ever writes to the reconciliation run/account-result/exception tables it owns.
 */
export async function createReconciliationRun(
  tenantId: string,
  actor: ReconciliationActor,
  input: CreateReconciliationRunInput,
): Promise<ReconciliationRunDto> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  const tenant = await prisma.tenant.findFirstOrThrow({ where: { id: tenantId }, select: { timezone: true } })
  const timezone = tenant.timezone || 'Asia/Kolkata'
  const today = getTodayInTimezone(timezone)
  const asOfDateStr = input.asOfDate ?? today
  if (compareDateOnly(asOfDateStr, today) > 0) {
    throw new PayableReconciliationDateInFutureError(asOfDateStr, today)
  }
  const asOfDate = parseDateOnly(asOfDateStr)
  const isHistorical = compareDateOnly(asOfDateStr, today) < 0
  const sourceMode = isHistorical ? 'HISTORICAL_RECONSTRUCTION' : 'CURRENT_BALANCE'
  const includeVendorLevel = input.includeVendorLevel ?? true

  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId: input.legalEntityId } })
  const baseCurrency = settings?.baseCurrency ?? 'INR'
  const tolerance = toDecimal(
    input.toleranceOverride ?? settings?.apReconciliationTolerance ?? settings?.roundingTolerance ?? '0.0100',
  )
  const stuckMinutes = settings?.apPostingEventStuckMinutes ?? 30

  const startedAt = new Date()

  try {
    const { accounts: controlAccounts, exceptions: configExceptions } = await resolveControlAccounts(
      tenantId,
      input.legalEntityId,
    )
    const controlAccountIds = controlAccounts.map((a) => a.accountId)

    let asOfItems: ReconciledOpenItemAsOf[] = []
    const [glMap, subledgerMap] = await Promise.all([
      aggregateGlByAccount(tenantId, input.legalEntityId, controlAccountIds, asOfDate),
      isHistorical
        ? reconstructOpenItemsAsOf(tenantId, input.legalEntityId, controlAccountIds, asOfDate).then((items) => {
            asOfItems = items
            return aggregateAsOfByAccount(items)
          })
        : aggregateCurrentSubledgerByAccount(tenantId, input.legalEntityId, controlAccountIds),
    ])

    const accountRows: AccountBalanceRow[] = controlAccounts.map((acct) => {
      const glBalance = glMap.get(acct.accountId) ?? toDecimal(0)
      const subledgerEntry = subledgerMap.get(acct.accountId)
      const subledgerBalance = subledgerEntry?.balance ?? toDecimal(0)
      const variance = subtract(glBalance, subledgerBalance)
      const matched = variance.abs().lte(tolerance)
      return {
        accountId: acct.accountId,
        accountCode: acct.accountCode,
        accountName: acct.accountName,
        glBalance: formatForPersistence(glBalance),
        subledgerBalance: formatForPersistence(subledgerBalance),
        variance: formatForPersistence(variance),
        matched,
        openItemCount: subledgerEntry?.count ?? 0,
      }
    })

    const balanceExceptions: ReconciliationExceptionDraft[] = accountRows
      .filter((row) => !row.matched)
      .map((row) => ({
        severity: 'ERROR',
        category: 'GENERAL_LEDGER_BALANCE',
        code: 'CONTROL_ACCOUNT_GL_SUBLEDGER_VARIANCE',
        message: `Control account ${row.accountName ?? row.accountId} GL balance does not match subledger net beyond tolerance`,
        accountId: row.accountId,
        details: { glBalance: row.glBalance, subledgerBalance: row.subledgerBalance, variance: row.variance, tolerance: formatForPersistence(tolerance) },
      }))

    const integrityExceptions = await runIntegrityChecks(tenantId, input.legalEntityId, controlAccountIds, asOfDate, stuckMinutes)

    let vendorRows: VendorBalanceRow[] = []
    let vendorExceptions: ReconciliationExceptionDraft[] = []
    let vendorMismatchCount = 0
    if (includeVendorLevel) {
      const vendorResult = await computeVendorLevelReconciliation(
        tenantId,
        input.legalEntityId,
        controlAccountIds,
        tolerance,
        isHistorical,
        asOfDate,
        asOfItems,
      )
      vendorRows = vendorResult.vendors
      vendorExceptions = vendorResult.exceptions
      vendorMismatchCount = vendorResult.mismatchCount
    }

    const allExceptions = [...configExceptions, ...balanceExceptions, ...integrityExceptions, ...vendorExceptions]

    const glTotal = sumDecimals(accountRows.map((r) => r.glBalance))
    const subledgerTotal = sumDecimals(accountRows.map((r) => r.subledgerBalance))
    const variance = subtract(glTotal, subledgerTotal)

    const matchedAccountCount = accountRows.filter((r) => r.matched).length
    const mismatchedAccountCount = accountRows.length - matchedAccountCount

    const infoCount = allExceptions.filter((e) => e.severity === 'INFO').length
    const warningCount = allExceptions.filter((e) => e.severity === 'WARNING').length
    const errorCount = allExceptions.filter((e) => e.severity === 'ERROR').length
    const blockerCount = allExceptions.filter((e) => e.severity === 'BLOCKER').length

    let status: 'MATCHED' | 'MATCHED_WITH_WARNINGS' | 'MISMATCHED' = 'MATCHED'
    if (mismatchedAccountCount > 0 || errorCount > 0 || blockerCount > 0) {
      status = 'MISMATCHED'
    } else if (warningCount > 0 || infoCount > 0) {
      status = 'MATCHED_WITH_WARNINGS'
    }

    const limitations = isHistorical ? HISTORICAL_LIMITATIONS : []
    const completedAt = new Date()

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.payableReconciliationRun.create({
        data: {
          tenantId,
          legalEntityId: input.legalEntityId,
          asOfDate,
          sourceMode,
          runStatus: 'COMPLETED',
          status,
          baseCurrency,
          tolerance,
          includeVendorLevel,
          controlAccountCount: accountRows.length,
          matchedAccountCount,
          mismatchedAccountCount,
          glTotal: formatForPersistence(glTotal),
          subledgerTotal: formatForPersistence(subledgerTotal),
          variance: formatForPersistence(variance),
          exceptionCount: allExceptions.length,
          infoCount,
          warningCount,
          errorCount,
          blockerCount,
          vendorCount: vendorRows.length,
          vendorMismatchCount,
          limitations,
          startedAt,
          completedAt,
          createdBy: actor.userId,
        },
      })

      if (accountRows.length > 0) {
        await tx.payableReconciliationAccountResult.createMany({
          data: accountRows.map((row) => ({
            tenantId,
            legalEntityId: input.legalEntityId,
            runId: created.id,
            accountId: row.accountId,
            accountCode: row.accountCode,
            accountName: row.accountName,
            glBalance: row.glBalance,
            subledgerBalance: row.subledgerBalance,
            variance: row.variance,
            matched: row.matched,
            openItemCount: row.openItemCount,
          })),
        })
      }

      if (allExceptions.length > 0) {
        await tx.payableReconciliationException.createMany({
          data: allExceptions.map((exc) => ({
            tenantId,
            legalEntityId: input.legalEntityId,
            runId: created.id,
            severity: exc.severity,
            category: exc.category,
            code: exc.code,
            message: exc.message,
            accountId: exc.accountId ?? null,
            vendorId: exc.vendorId ?? null,
            openItemId: exc.openItemId ?? null,
            voucherId: exc.voucherId ?? null,
            documentType: exc.documentType ?? null,
            documentId: exc.documentId ?? null,
            details: (exc.details ?? undefined) as Prisma.InputJsonValue | undefined,
          })),
        })
      }

      return created
    })

    return {
      id: run.id,
      tenantId: run.tenantId,
      legalEntityId: run.legalEntityId,
      asOfDate: asOfDateStr,
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
      limitations,
      errorMessage: null,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      createdBy: run.createdBy,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      isStale: false,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while computing AP reconciliation'
    await prisma.payableReconciliationRun.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        asOfDate,
        sourceMode,
        runStatus: 'FAILED',
        status: 'FAILED',
        baseCurrency,
        tolerance,
        includeVendorLevel,
        errorMessage: errorMessage.slice(0, 1000),
        startedAt,
        completedAt: new Date(),
        createdBy: actor.userId,
      },
    })
    throw err
  }
}

/**
 * Reconciliation run is "stale" once AP subledger activity occurred after it completed —
 * a new/changed open item (posting, settlement, dispute toggle, reversal) or a new
 * allocation/reversal batch invalidates the balances captured at completedAt.
 */
export async function isReconciliationRunStale(
  tenantId: string,
  legalEntityId: string,
  completedAt: Date | null,
): Promise<boolean> {
  if (!completedAt) return false
  const [newerOpenItem, newerAllocation, newerReversal] = await Promise.all([
    prisma.payableOpenItem.findFirst({
      where: { tenantId, legalEntityId, updatedAt: { gt: completedAt } },
      select: { id: true },
    }),
    prisma.payableAllocationBatch.findFirst({
      where: { tenantId, legalEntityId, createdAt: { gt: completedAt } },
      select: { id: true },
    }),
    prisma.payableAllocationReversalBatch.findFirst({
      where: { tenantId, legalEntityId, createdAt: { gt: completedAt } },
      select: { id: true },
    }),
  ])
  return Boolean(newerOpenItem || newerAllocation || newerReversal)
}

export async function getReconciliationRunOrThrow(tenantId: string, legalEntityId: string, runId: string) {
  const run = await prisma.payableReconciliationRun.findFirst({
    where: { id: runId, tenantId, legalEntityId },
  })
  if (!run) throw new PayableReconciliationRunNotFoundError()
  return run
}
