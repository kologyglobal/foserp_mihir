import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { resolveTreasuryAdjustmentAllowedActions } from './treasury-adjustment-allowed-actions.js'
import * as repo from './treasury-adjustment.repository.js'
import type { ListTreasuryAdjustmentsQuery } from './treasury-adjustment.schemas.js'
import type { TreasuryAdjustmentCalculationResult, TreasuryAdjustmentWithLines } from './treasury-adjustment.types.js'

async function loadApprovalSummary(adjustment: TreasuryAdjustmentWithLines) {
  if (!adjustment.approvalRequestId) return null
  return prisma.financeApprovalRequest.findFirst({
    where: { id: adjustment.approvalRequestId, tenantId: adjustment.tenantId },
    select: {
      id: true,
      status: true,
      currentLevel: true,
      totalLevels: true,
      requestedBy: true,
      requestedAt: true,
      completedAt: true,
      completedBy: true,
      documentStatusSnapshot: true,
    },
  })
}

async function hasActiveReconciliationMatch(adjustment: TreasuryAdjustmentWithLines): Promise<boolean> {
  if (!adjustment.reconciliationMatchId) return false
  const match = await prisma.bankReconciliationMatch.findFirst({
    where: { id: adjustment.reconciliationMatchId, tenantId: adjustment.tenantId },
    select: { matchStatus: true },
  })
  return match?.matchStatus === 'ACTIVE'
}

export async function serializeTreasuryAdjustment(req: Request, adjustment: TreasuryAdjustmentWithLines, calculation?: TreasuryAdjustmentCalculationResult) {
  const [approvalRequest, activeMatch, voucher, ledgerEntryCount] = await Promise.all([
    loadApprovalSummary(adjustment),
    hasActiveReconciliationMatch(adjustment),
    adjustment.voucherId
      ? prisma.accountingVoucher.findFirst({ where: { id: adjustment.voucherId, tenantId: adjustment.tenantId }, select: { id: true, voucherNumber: true } })
      : Promise.resolve(null),
    adjustment.voucherId
      ? prisma.generalLedgerEntry.count({ where: { tenantId: adjustment.tenantId, voucherId: adjustment.voucherId } })
      : Promise.resolve(0),
  ])

  return {
    ...adjustment,
    exchangeRate: adjustment.exchangeRate.toString(),
    bankAmount: formatForPersistence(adjustment.bankAmount),
    baseBankAmount: formatForPersistence(adjustment.baseBankAmount),
    adjustmentDate: adjustment.adjustmentDate.toISOString().slice(0, 10),
    reversalDate: adjustment.reversalDate ? adjustment.reversalDate.toISOString().slice(0, 10) : null,
    lines: adjustment.lines.map((line) => ({
      ...line,
      amount: formatForPersistence(line.amount),
      gstRate: line.gstRate ? formatForPersistence(line.gstRate, 2) : null,
      tdsRate: line.tdsRate ? formatForPersistence(line.tdsRate, 2) : null,
    })),
    approvalRequest,
    voucherNumber: voucher?.voucherNumber ?? null,
    ledgerEntryCount,
    hasActiveReconciliationMatch: activeMatch,
    validation: calculation ? { isValid: calculation.validation.isValid, errors: calculation.validation.errors, warnings: calculation.validation.warnings } : null,
    accountingPreview: calculation?.accountingPreview ?? adjustment.accountingPreviewSnapshot ?? null,
    allowedActions: resolveTreasuryAdjustmentAllowedActions(req, adjustment.status, adjustment.approvalRequired, activeMatch),
  }
}

export async function getTreasuryAdjustment(req: Request, tenantId: string, id: string) {
  return serializeTreasuryAdjustment(req, await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id))
}

export async function listTreasuryAdjustments(req: Request, tenantId: string, query: ListTreasuryAdjustmentsQuery) {
  const result = await repo.listTreasuryAdjustments(tenantId, query)
  return { ...result, items: await Promise.all(result.items.map((a) => serializeTreasuryAdjustment(req, a))) }
}
