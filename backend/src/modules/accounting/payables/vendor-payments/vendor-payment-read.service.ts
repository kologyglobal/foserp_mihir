import type { Request } from 'express'
import type { VendorPayment, VendorPaymentAdjustmentLine } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import type { ListVendorPaymentsQuery } from './vendor-payment.schemas.js'
import type { VendorPaymentWithLines } from './vendor-payment.types.js'
import type { VendorPaymentCalculationResult } from './calculation/vendor-payment-calculation.types.js'
import * as repo from './vendor-payment.repository.js'
import { resolveVendorPaymentAllowedActions } from './vendor-payment-allowed-actions.js'

const HEADER_MONEY_FIELDS: Array<keyof VendorPayment> = [
  'paymentAmount', 'settlementAdjustmentAmount', 'paymentExpenseAmount', 'roundOffAmount',
  'vendorSettlementAmount', 'cashOutflowAmount',
  'basePaymentAmount', 'baseSettlementAdjustmentAmount', 'basePaymentExpenseAmount', 'baseRoundOffAmount',
  'baseVendorSettlementAmount', 'baseCashOutflowAmount',
  'tdsBaseAmount', 'tdsAmount', 'baseTdsBaseAmount', 'baseTdsAmount',
]

const LINE_MONEY_FIELDS: Array<keyof VendorPaymentAdjustmentLine> = [
  'amount', 'baseAmount', 'calculationBaseAmount',
]

function formatMoney(source: Record<string, unknown>, fields: string[]): Record<string, string | null> {
  return Object.fromEntries(
    fields.map((key) => [key, source[key] == null ? null : formatForPersistence(source[key] as never)]),
  )
}

async function loadApprovalSummary(payment: VendorPaymentWithLines) {
  if (!payment.approvalRequestId) return null
  return prisma.financeApprovalRequest.findFirst({
    where: { id: payment.approvalRequestId, tenantId: payment.tenantId },
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

export async function serializeVendorPayment(
  req: Request,
  payment: VendorPaymentWithLines,
  calculation?: VendorPaymentCalculationResult,
) {
  const approvalRequest = await loadApprovalSummary(payment)

  const [payableOpenItem, voucher, ledgerEntryCount] = await Promise.all([
    payment.status === 'POSTED'
      ? prisma.payableOpenItem.findFirst({
          where: { tenantId: payment.tenantId, sourceVendorPaymentId: payment.id },
          select: {
            id: true,
            side: true,
            documentType: true,
            status: true,
            originalAmount: true,
            allocatedAmount: true,
            outstandingAmount: true,
            isOnHold: true,
            isDisputed: true,
          },
        })
      : Promise.resolve(null),
    payment.accountingVoucherId
      ? prisma.accountingVoucher.findFirst({
          where: { id: payment.accountingVoucherId, tenantId: payment.tenantId },
          select: { id: true, voucherNumber: true },
        })
      : Promise.resolve(null),
    payment.accountingVoucherId
      ? prisma.generalLedgerEntry.count({
          where: { tenantId: payment.tenantId, voucherId: payment.accountingVoucherId },
        })
      : Promise.resolve(0),
  ])

  return {
    ...payment,
    ...formatMoney(payment, HEADER_MONEY_FIELDS),
    exchangeRate: payment.exchangeRate.toString(),
    documentDate: payment.documentDate.toISOString().slice(0, 10),
    paymentDate: payment.paymentDate.toISOString().slice(0, 10),
    proposedPostingDate: payment.proposedPostingDate ? payment.proposedPostingDate.toISOString().slice(0, 10) : null,
    valueDate: payment.valueDate ? payment.valueDate.toISOString().slice(0, 10) : null,
    dueReferenceDate: payment.dueReferenceDate ? payment.dueReferenceDate.toISOString().slice(0, 10) : null,
    chequeDate: payment.chequeDate ? payment.chequeDate.toISOString().slice(0, 10) : null,
    adjustmentLines: payment.adjustmentLines.map((line) => ({
      ...line,
      ...formatMoney(line, LINE_MONEY_FIELDS),
      rate: line.rate == null ? null : line.rate.toString(),
    })),
    approvalRequest,
    accountingVoucherNumber: voucher?.voucherNumber ?? null,
    ledgerEntryCount: payment.status === 'POSTED' ? ledgerEntryCount : 0,
    payableOpenItemId: payableOpenItem?.id ?? null,
    payableOpenItemSide: payableOpenItem?.side ?? null,
    payableOpenItemDocumentType: payableOpenItem?.documentType ?? null,
    payableOpenItemStatus: payableOpenItem?.status ?? null,
    payableOriginalAmount: payableOpenItem ? formatForPersistence(payableOpenItem.originalAmount) : null,
    payableAllocatedAmount: payableOpenItem ? formatForPersistence(payableOpenItem.allocatedAmount) : null,
    payableOutstandingAmount: payableOpenItem ? formatForPersistence(payableOpenItem.outstandingAmount) : null,
    allocationState: payableOpenItem
      ? Number(payableOpenItem.outstandingAmount) <= 0 && Number(payableOpenItem.allocatedAmount) > 0
        ? 'FULLY_ALLOCATED'
        : Number(payableOpenItem.allocatedAmount) > 0
          ? 'PARTIALLY_ALLOCATED'
          : 'UNALLOCATED'
      : null,
    validation: calculation
      ? {
          isValid: calculation.validation.isValid,
          errors: calculation.validation.errors,
          warnings: calculation.validation.warnings,
          paymentPosition: calculation.paymentPosition,
          accountReadiness: calculation.accountReadiness,
          openItemPreview: calculation.openItemPreview,
        }
      : null,
    allowedActions: resolveVendorPaymentAllowedActions(
      req,
      payment.status,
      payment.approvalRequired,
      payableOpenItem
        ? {
            status: payableOpenItem.status,
            outstandingAmount: payableOpenItem.outstandingAmount.toString(),
            isOnHold: payableOpenItem.isOnHold,
            isDisputed: payableOpenItem.isDisputed,
          }
        : null,
    ),
  }
}

export async function getVendorPayment(req: Request, tenantId: string, id: string) {
  return serializeVendorPayment(req, await repo.findVendorPaymentWithLinesOrThrow(tenantId, id))
}

export async function listVendorPayments(req: Request, tenantId: string, query: ListVendorPaymentsQuery) {
  const result = await repo.listVendorPayments(tenantId, query)
  return { ...result, items: await Promise.all(result.items.map((payment) => serializeVendorPayment(req, payment))) }
}
