import type { Request } from 'express'
import type { TreasuryCheque } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { resolveTreasuryChequeAllowedActions } from './treasury-cheque-allowed-actions.js'
import * as repo from './treasury-cheque.repository.js'
import type { ListTreasuryChequesQuery } from './treasury-cheque.schemas.js'
import type { TreasuryChequeCalculationResult } from './treasury-cheque.types.js'

async function loadApprovalSummary(cheque: TreasuryCheque) {
  if (!cheque.approvalRequestId) return null
  return prisma.financeApprovalRequest.findFirst({
    where: { id: cheque.approvalRequestId, tenantId: cheque.tenantId },
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

export async function serializeTreasuryCheque(req: Request, cheque: TreasuryCheque, calculation?: TreasuryChequeCalculationResult) {
  const approvalRequest = await loadApprovalSummary(cheque)

  const [voucher, ledgerEntryCount] = await Promise.all([
    cheque.voucherId
      ? prisma.accountingVoucher.findFirst({ where: { id: cheque.voucherId, tenantId: cheque.tenantId }, select: { id: true, voucherNumber: true } })
      : Promise.resolve(null),
    cheque.voucherId
      ? prisma.generalLedgerEntry.count({ where: { tenantId: cheque.tenantId, voucherId: cheque.voucherId } })
      : Promise.resolve(0),
  ])

  return {
    ...cheque,
    exchangeRate: cheque.exchangeRate.toString(),
    amount: formatForPersistence(cheque.amount),
    baseAmount: formatForPersistence(cheque.baseAmount),
    chequeDate: cheque.chequeDate.toISOString().slice(0, 10),
    pdcMaturityDate: cheque.pdcMaturityDate ? cheque.pdcMaturityDate.toISOString().slice(0, 10) : null,
    depositDate: cheque.depositDate ? cheque.depositDate.toISOString().slice(0, 10) : null,
    clearanceDate: cheque.clearanceDate ? cheque.clearanceDate.toISOString().slice(0, 10) : null,
    bounceDate: cheque.bounceDate ? cheque.bounceDate.toISOString().slice(0, 10) : null,
    reversalDate: cheque.reversalDate ? cheque.reversalDate.toISOString().slice(0, 10) : null,
    approvalRequest,
    voucherNumber: voucher?.voucherNumber ?? null,
    ledgerEntryCount,
    validation: calculation
      ? { isValid: calculation.validation.isValid, errors: calculation.validation.errors, warnings: calculation.validation.warnings }
      : null,
    accountingPreview: calculation?.accountingPreview ?? cheque.accountingPreviewSnapshot ?? null,
    isTrackOnly: calculation?.isTrackOnly,
    allowedActions: resolveTreasuryChequeAllowedActions(
      req,
      cheque.status,
      cheque.direction,
      cheque.approvalRequired,
      cheque.accountingMode,
      cheque.customerReceiptId,
      cheque.vendorPaymentId,
    ),
  }
}

export async function getTreasuryCheque(req: Request, tenantId: string, id: string) {
  return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, id))
}

export async function listTreasuryCheques(req: Request, tenantId: string, query: ListTreasuryChequesQuery) {
  const result = await repo.listTreasuryCheques(tenantId, query)
  return { ...result, items: await Promise.all(result.items.map((c) => serializeTreasuryCheque(req, c))) }
}
