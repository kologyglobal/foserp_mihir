import type { Request } from 'express'
import type { TreasuryTransfer } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { resolveTreasuryTransferAllowedActions } from './treasury-transfer-allowed-actions.js'
import * as repo from './treasury-transfer.repository.js'
import type { ListTreasuryTransfersQuery } from './treasury-transfer.schemas.js'
import type { TreasuryTransferCalculationResult } from './treasury-transfer.types.js'

async function loadApprovalSummary(transfer: TreasuryTransfer) {
  if (!transfer.approvalRequestId) return null
  return prisma.financeApprovalRequest.findFirst({
    where: { id: transfer.approvalRequestId, tenantId: transfer.tenantId },
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

export async function serializeTreasuryTransfer(
  req: Request,
  transfer: TreasuryTransfer,
  calculation?: TreasuryTransferCalculationResult,
) {
  const approvalRequest = await loadApprovalSummary(transfer)

  const [sourceVoucher, destinationVoucher, ledgerEntryCount] = await Promise.all([
    transfer.sourceVoucherId
      ? prisma.accountingVoucher.findFirst({
          where: { id: transfer.sourceVoucherId, tenantId: transfer.tenantId },
          select: { id: true, voucherNumber: true },
        })
      : Promise.resolve(null),
    transfer.destinationVoucherId && transfer.destinationVoucherId !== transfer.sourceVoucherId
      ? prisma.accountingVoucher.findFirst({
          where: { id: transfer.destinationVoucherId, tenantId: transfer.tenantId },
          select: { id: true, voucherNumber: true },
        })
      : Promise.resolve(null),
    transfer.sourceVoucherId
      ? prisma.generalLedgerEntry.count({
          where: {
            tenantId: transfer.tenantId,
            voucherId: transfer.destinationVoucherId
              ? { in: [transfer.sourceVoucherId, transfer.destinationVoucherId] }
              : transfer.sourceVoucherId,
          },
        })
      : Promise.resolve(0),
  ])

  return {
    ...transfer,
    exchangeRate: transfer.exchangeRate.toString(),
    transferAmount: formatForPersistence(transfer.transferAmount),
    baseTransferAmount: formatForPersistence(transfer.baseTransferAmount),
    transferDate: transfer.transferDate.toISOString().slice(0, 10),
    sourcePostingDate: transfer.sourcePostingDate.toISOString().slice(0, 10),
    expectedReceiptDate: transfer.expectedReceiptDate ? transfer.expectedReceiptDate.toISOString().slice(0, 10) : null,
    destinationPostingDate: transfer.destinationPostingDate ? transfer.destinationPostingDate.toISOString().slice(0, 10) : null,
    reversalDate: transfer.reversalDate ? transfer.reversalDate.toISOString().slice(0, 10) : null,
    approvalRequest,
    sourceVoucherNumber: sourceVoucher?.voucherNumber ?? null,
    destinationVoucherNumber: destinationVoucher?.voucherNumber ?? sourceVoucher?.voucherNumber ?? null,
    ledgerEntryCount,
    validation: calculation
      ? {
          isValid: calculation.validation.isValid,
          errors: calculation.validation.errors,
          warnings: calculation.validation.warnings,
          modeRecommendation: calculation.modeRecommendation,
          balanceCheck: calculation.balanceCheck,
        }
      : null,
    accountingPreview: calculation?.accountingPreview ?? transfer.accountingPreviewSnapshot ?? null,
    allowedActions: resolveTreasuryTransferAllowedActions(req, transfer.status, transfer.approvalRequired, transfer.postingMode),
  }
}

export async function getTreasuryTransfer(req: Request, tenantId: string, id: string) {
  return serializeTreasuryTransfer(req, await repo.findTreasuryTransferByIdOrThrow(tenantId, id))
}

export async function listTreasuryTransfers(req: Request, tenantId: string, query: ListTreasuryTransfersQuery) {
  const result = await repo.listTreasuryTransfers(tenantId, query)
  return { ...result, items: await Promise.all(result.items.map((t) => serializeTreasuryTransfer(req, t))) }
}
