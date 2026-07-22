import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { formatDateOnly } from '../reporting/payable-ageing.service.js'
import { createReconciliationRun } from './payable-reconciliation.service.js'
import {
  PayableCloseGatePeriodNotFoundError,
  PayableCloseGateReconciliationRunNotFoundError,
} from './payable-reconciliation.errors.js'
import type { CloseGateCheckDraft, CloseGateRunDto, CreateCloseGateRunInput, ReconciliationActor } from './payable-reconciliation.types.js'

type ExceptionRow = { severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER'; category: string }

function statusFromSeverities(rows: ExceptionRow[]): 'PASSED' | 'WARNING' | 'BLOCKED' {
  if (rows.some((r) => r.severity === 'BLOCKER' || r.severity === 'ERROR')) return 'BLOCKED'
  if (rows.some((r) => r.severity === 'WARNING' || r.severity === 'INFO')) return 'WARNING'
  return 'PASSED'
}

/**
 * Orchestrates the AP close-gate readiness assessment for one accounting period: optionally
 * runs (or reuses) an AP reconciliation as of the period end date, evaluates a fixed suite of
 * checks derived from that run plus period-scoped document/posting-event queries, and persists
 * the outcome. This NEVER updates AccountingPeriod.status — closing a period remains a
 * deliberate, separate Finance action.
 */
export async function createCloseGateRun(
  tenantId: string,
  actor: ReconciliationActor,
  input: CreateCloseGateRunInput,
): Promise<CloseGateRunDto> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  const period = await prisma.accountingPeriod.findFirst({
    where: { id: input.periodId, tenantId, legalEntityId: input.legalEntityId },
  })
  if (!period) throw new PayableCloseGatePeriodNotFoundError()

  const asOfDate = period.endDate
  const asOfDateStr = formatDateOnly(asOfDate)
  const includeVendorLevel = input.includeVendorLevel ?? true
  const startedAt = new Date()

  try {
    let reconciliationRun: { id: string; runStatus: string; status: string | null; blockerCount: number } | null = null
    const runFresh = input.runFreshReconciliation ?? true

    if (runFresh) {
      const created = await createReconciliationRun(tenantId, actor, {
        legalEntityId: input.legalEntityId,
        asOfDate: asOfDateStr,
        includeVendorLevel,
      })
      reconciliationRun = { id: created.id, runStatus: created.runStatus, status: created.status, blockerCount: created.blockerCount }
    } else if (input.reconciliationRunId) {
      const existing = await prisma.payableReconciliationRun.findFirst({
        where: { id: input.reconciliationRunId, tenantId, legalEntityId: input.legalEntityId },
      })
      if (!existing) throw new PayableCloseGateReconciliationRunNotFoundError()
      reconciliationRun = {
        id: existing.id,
        runStatus: existing.runStatus,
        status: existing.status,
        blockerCount: existing.blockerCount,
      }
    }

    const checks: CloseGateCheckDraft[] = []

    if (!reconciliationRun) {
      checks.push({
        checkCode: 'RECONCILIATION_RUN_REQUIRED',
        checkName: 'AP reconciliation run available',
        status: 'BLOCKED',
        message: 'No AP reconciliation run was supplied or generated for this close-gate assessment',
      })
    } else {
      checks.push(buildReconciliationStatusCheck(reconciliationRun))

      const exceptions = await prisma.payableReconciliationException.findMany({
        where: { runId: reconciliationRun.id, tenantId },
        select: { severity: true, category: true },
      })

      checks.push(buildCategoryCheck(
        'CONTROL_ACCOUNTS_VALID',
        'Control accounts correctly configured',
        exceptions.filter((e) => e.category === 'CONTROL_ACCOUNT_CONFIGURATION'),
      ))
      checks.push(buildCategoryCheck(
        'OPEN_ITEM_BALANCES_VALID',
        'Open item balances internally consistent',
        exceptions.filter((e) => e.category === 'OPEN_ITEM' || e.category === 'SUBLEDGER_BALANCE'),
      ))
      checks.push(buildCategoryCheck(
        'ALLOCATION_INTEGRITY',
        'Allocation and allocation-reversal integrity',
        exceptions.filter((e) => e.category === 'ALLOCATION' || e.category === 'ALLOCATION_REVERSAL'),
      ))
      checks.push(buildCategoryCheck(
        'REVERSAL_INTEGRITY',
        'Document reversal links intact',
        exceptions.filter((e) => e.category === 'DOCUMENT_REVERSAL'),
      ))
      checks.push(buildCategoryCheck(
        'GL_POSTING_INTEGRITY',
        'GL postings on control accounts recognised',
        exceptions.filter((e) => e.category === 'GENERAL_LEDGER_ENTRY' || e.category === 'GENERAL_LEDGER_BALANCE'),
      ))
      checks.push(buildCategoryCheck(
        'SOURCE_DOCUMENT_INTEGRITY',
        'Source documents and vouchers linked correctly',
        exceptions.filter((e) => e.category === 'SOURCE_DOCUMENT' || e.category === 'ACCOUNTING_VOUCHER'),
      ))
      checks.push(buildCategoryCheck(
        'POSTING_EVENTS_HEALTHY',
        'No failed or stuck posting events',
        exceptions.filter((e) => e.category === 'POSTING_EVENT'),
      ))
      if (includeVendorLevel) {
        checks.push(buildCategoryCheck(
          'VENDOR_PARTY_RECONCILED',
          'Vendor-level GL matches subledger',
          exceptions.filter((e) => e.category === 'VENDOR_PARTY'),
        ))
      }
    }

    checks.push(await buildReadyToPostCheck(tenantId, input.legalEntityId, asOfDate))
    checks.push(await buildAttentionNeededCheck(tenantId, input.legalEntityId))

    const checksPassed = checks.filter((c) => c.status === 'PASSED').length
    const checksWarning = checks.filter((c) => c.status === 'WARNING').length
    const checksBlocked = checks.filter((c) => c.status === 'BLOCKED').length
    const checksFailed = checks.filter((c) => c.status === 'FAILED').length

    let status: 'PASS' | 'PASS_WITH_WARNINGS' | 'BLOCKED' | 'FAILED' = 'PASS'
    if (checksFailed > 0) status = 'FAILED'
    else if (checksBlocked > 0) status = 'BLOCKED'
    else if (checksWarning > 0) status = 'PASS_WITH_WARNINGS'

    const completedAt = new Date()

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.payableCloseGateRun.create({
        data: {
          tenantId,
          legalEntityId: input.legalEntityId,
          periodId: input.periodId,
          asOfDate,
          status,
          reconciliationRunId: reconciliationRun?.id ?? null,
          checksTotal: checks.length,
          checksPassed,
          checksWarning,
          checksBlocked,
          checksFailed,
          summary: { periodName: period.name, periodStatus: period.status },
          startedAt,
          completedAt,
          createdBy: actor.userId,
        },
      })

      if (checks.length > 0) {
        await tx.payableCloseGateCheck.createMany({
          data: checks.map((c) => ({
            tenantId,
            legalEntityId: input.legalEntityId,
            runId: created.id,
            checkCode: c.checkCode,
            checkName: c.checkName,
            status: c.status,
            message: c.message,
            details: (c.details ?? undefined) as Prisma.InputJsonValue | undefined,
          })),
        })
      }

      return created
    })

    return {
      id: run.id,
      tenantId: run.tenantId,
      legalEntityId: run.legalEntityId,
      periodId: run.periodId,
      asOfDate: formatDateOnly(run.asOfDate),
      status: run.status,
      reconciliationRunId: run.reconciliationRunId,
      checksTotal: run.checksTotal,
      checksPassed: run.checksPassed,
      checksWarning: run.checksWarning,
      checksBlocked: run.checksBlocked,
      checksFailed: run.checksFailed,
      summary: (run.summary as Record<string, unknown> | null) ?? null,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      createdBy: run.createdBy,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error while computing AP close gate'
    await prisma.payableCloseGateRun.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        periodId: input.periodId,
        asOfDate,
        status: 'FAILED',
        checksTotal: 1,
        checksFailed: 1,
        summary: { error: errorMessage.slice(0, 500) },
        startedAt,
        completedAt: new Date(),
        createdBy: actor.userId,
        checks: {
          create: [
            {
              tenantId,
              legalEntityId: input.legalEntityId,
              checkCode: 'CLOSE_GATE_COMPUTATION_ERROR',
              checkName: 'Close gate computation completed without error',
              status: 'FAILED',
              message: errorMessage.slice(0, 1000),
            },
          ],
        },
      },
    })
    throw err
  }
}

function buildReconciliationStatusCheck(run: { runStatus: string; status: string | null; blockerCount: number }): CloseGateCheckDraft {
  if (run.runStatus !== 'COMPLETED') {
    return {
      checkCode: 'RECONCILIATION_COMPLETED',
      checkName: 'AP reconciliation run completed',
      status: 'FAILED',
      message: `Reconciliation run did not complete (runStatus=${run.runStatus})`,
    }
  }
  if (run.status === 'MATCHED') {
    return {
      checkCode: 'RECONCILIATION_COMPLETED',
      checkName: 'AP reconciliation run completed and matched',
      status: 'PASSED',
      message: 'Reconciliation run completed with all control accounts matched',
    }
  }
  if (run.status === 'MATCHED_WITH_WARNINGS') {
    return {
      checkCode: 'RECONCILIATION_COMPLETED',
      checkName: 'AP reconciliation run completed and matched',
      status: 'WARNING',
      message: 'Reconciliation run completed and matched, but raised warnings',
    }
  }
  return {
    checkCode: 'RECONCILIATION_COMPLETED',
    checkName: 'AP reconciliation run completed and matched',
    status: 'BLOCKED',
    message: `Reconciliation run status is ${run.status ?? 'UNKNOWN'} — control accounts are not fully matched`,
    details: { blockerCount: run.blockerCount },
  }
}

function buildCategoryCheck(checkCode: string, checkName: string, rows: ExceptionRow[]): CloseGateCheckDraft {
  const status = statusFromSeverities(rows)
  const message =
    status === 'PASSED'
      ? `${checkName}: no issues found`
      : `${checkName}: ${rows.length} reconciliation exception(s) found (${status === 'BLOCKED' ? 'blocking' : 'warning'})`
  return { checkCode, checkName, status, message, details: { exceptionCount: rows.length } }
}

async function buildReadyToPostCheck(tenantId: string, legalEntityId: string, periodEnd: Date): Promise<CloseGateCheckDraft> {
  const [invoices, payments, adjustments] = await Promise.all([
    prisma.vendorInvoice.count({ where: { tenantId, legalEntityId, status: 'READY_TO_POST', postingDate: { lte: periodEnd } } }),
    prisma.vendorPayment.count({ where: { tenantId, legalEntityId, status: 'READY_TO_POST', proposedPostingDate: { lte: periodEnd } } }),
    prisma.vendorAdjustment.count({ where: { tenantId, legalEntityId, status: 'READY_TO_POST', postingDate: { lte: periodEnd } } }),
  ])
  const total = invoices + payments + adjustments
  if (total === 0) {
    return {
      checkCode: 'READY_TO_POST_DOCS_IN_PERIOD',
      checkName: 'No unposted documents dated within this period',
      status: 'PASSED',
      message: 'No READY_TO_POST vendor documents are dated on or before the period end',
    }
  }
  return {
    checkCode: 'READY_TO_POST_DOCS_IN_PERIOD',
    checkName: 'No unposted documents dated within this period',
    status: 'BLOCKED',
    message: `${total} READY_TO_POST vendor document(s) are dated on or before the period end and have not been posted`,
    details: { vendorInvoices: invoices, vendorPayments: payments, vendorAdjustments: adjustments },
  }
}

async function buildAttentionNeededCheck(tenantId: string, legalEntityId: string): Promise<CloseGateCheckDraft> {
  const [drafts, pendingApproval, onHoldOrDisputed, unallocatedAdvances] = await Promise.all([
    Promise.all([
      prisma.vendorInvoice.count({ where: { tenantId, legalEntityId, status: 'DRAFT' } }),
      prisma.vendorPayment.count({ where: { tenantId, legalEntityId, status: 'DRAFT' } }),
      prisma.vendorAdjustment.count({ where: { tenantId, legalEntityId, status: 'DRAFT' } }),
    ]).then((counts) => counts.reduce((a, b) => a + b, 0)),
    Promise.all([
      prisma.vendorInvoice.count({ where: { tenantId, legalEntityId, status: 'PENDING_APPROVAL' } }),
      prisma.vendorPayment.count({ where: { tenantId, legalEntityId, status: 'PENDING_APPROVAL' } }),
      prisma.vendorAdjustment.count({ where: { tenantId, legalEntityId, status: 'PENDING_APPROVAL' } }),
    ]).then((counts) => counts.reduce((a, b) => a + b, 0)),
    prisma.payableOpenItem.count({ where: { tenantId, legalEntityId, OR: [{ isOnHold: true }, { isDisputed: true }] } }),
    prisma.payableOpenItem.count({
      where: { tenantId, legalEntityId, documentType: 'VENDOR_ADVANCE', outstandingAmount: { gt: 0 } },
    }),
  ])

  const total = drafts + pendingApproval + onHoldOrDisputed + unallocatedAdvances
  const details = { drafts, pendingApproval, onHoldOrDisputed, unallocatedAdvances }
  if (total === 0) {
    return {
      checkCode: 'OPEN_ITEMS_ATTENTION_NEEDED',
      checkName: 'No drafts, pending approvals, holds, disputes, or unallocated advances',
      status: 'PASSED',
      message: 'No AP documents or open items require attention before closing this period',
      details,
    }
  }
  return {
    checkCode: 'OPEN_ITEMS_ATTENTION_NEEDED',
    checkName: 'No drafts, pending approvals, holds, disputes, or unallocated advances',
    status: 'WARNING',
    message: 'Some AP documents or open items may need attention before closing this period (non-blocking)',
    details,
  }
}
