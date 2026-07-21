import type { Request } from 'express'
import type { VendorAdjustment, VendorAdjustmentLine } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import type { ListVendorAdjustmentsQuery } from './vendor-adjustment.schemas.js'
import type { VendorAdjustmentWithLines } from './vendor-adjustment.types.js'
import type { VendorAdjustmentCalculationResult } from './calculation/vendor-adjustment-calculation.types.js'
import * as repo from './vendor-adjustment.repository.js'
import { resolveVendorAdjustmentAllowedActions } from './vendor-adjustment-allowed-actions.js'

const HEADER_MONEY_FIELDS: Array<keyof VendorAdjustment> = [
  'grossAmount', 'discountAmount', 'taxableAmount',
  'inputCgstAmount', 'inputSgstAmount', 'inputIgstAmount', 'inputCessAmount',
  'otherRecoverableTaxAmount', 'nonRecoverableTaxAmount',
  'freightAmount', 'otherChargeAmount', 'roundOffAmount', 'adjustmentGrandTotal',
  'tdsBaseAmount', 'tdsAmount', 'vendorPayableAmount',
  'baseGrossAmount', 'baseDiscountAmount', 'baseTaxableAmount',
  'baseInputCgstAmount', 'baseInputSgstAmount', 'baseInputIgstAmount', 'baseInputCessAmount',
  'baseOtherRecoverableTaxAmount', 'baseNonRecoverableTaxAmount',
  'baseFreightAmount', 'baseOtherChargeAmount', 'baseRoundOffAmount', 'baseAdjustmentGrandTotal',
  'baseTdsBaseAmount', 'baseTdsAmount', 'baseVendorPayableAmount',
]

const LINE_MONEY_FIELDS: Array<keyof VendorAdjustmentLine> = [
  'unitPrice', 'grossAmount', 'discountAmount', 'taxableAmount',
  'cgstAmount', 'sgstAmount', 'igstAmount', 'cessAmount',
  'otherRecoverableTaxAmount', 'nonRecoverableTaxAmount', 'lineTotal',
  'baseGrossAmount', 'baseDiscountAmount', 'baseTaxableAmount',
  'baseCgstAmount', 'baseSgstAmount', 'baseIgstAmount', 'baseCessAmount',
  'baseOtherRecoverableTaxAmount', 'baseNonRecoverableTaxAmount', 'baseLineTotal',
]

const LINE_RATE_FIELDS: Array<keyof VendorAdjustmentLine> = ['discountPercent', 'cgstRate', 'sgstRate', 'igstRate', 'cessRate']

function formatMoney(source: Record<string, unknown>, fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((key) => [key, formatForPersistence(source[key] as never)]))
}

function formatRates(source: Record<string, unknown>, fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((key) => [key, String(source[key])]))
}

async function loadApprovalSummary(invoice: VendorAdjustmentWithLines) {
  if (!invoice.approvalRequestId) return null
  return prisma.financeApprovalRequest.findFirst({
    where: { id: invoice.approvalRequestId, tenantId: invoice.tenantId },
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

export async function serializeVendorAdjustment(
  req: Request,
  invoice: VendorAdjustmentWithLines,
  calculation?: VendorAdjustmentCalculationResult,
) {
  const approvalRequest = await loadApprovalSummary(invoice)

  const [payableOpenItem, voucher, ledgerEntryCount] = await Promise.all([
    invoice.status === 'POSTED'
      ? prisma.payableOpenItem.findFirst({
          where: { tenantId: invoice.tenantId, sourceVendorAdjustmentId: invoice.id },
          select: {
            id: true,
            status: true,
            originalAmount: true,
            allocatedAmount: true,
            outstandingAmount: true,
          },
        })
      : Promise.resolve(null),
    invoice.accountingVoucherId
      ? prisma.accountingVoucher.findFirst({
          where: { id: invoice.accountingVoucherId, tenantId: invoice.tenantId },
          select: { id: true, voucherNumber: true },
        })
      : Promise.resolve(null),
    invoice.accountingVoucherId
      ? prisma.generalLedgerEntry.count({
          where: { tenantId: invoice.tenantId, voucherId: invoice.accountingVoucherId },
        })
      : Promise.resolve(0),
  ])

  return {
    ...invoice,
    ...formatMoney(invoice, HEADER_MONEY_FIELDS),
    exchangeRate: invoice.exchangeRate.toString(),
    tdsRate: invoice.tdsRate.toString(),
    supplierReferenceDate: invoice.supplierReferenceDate.toISOString().slice(0, 10),
    documentDate: invoice.documentDate.toISOString().slice(0, 10),
    postingDate: invoice.postingDate ? invoice.postingDate.toISOString().slice(0, 10) : null,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
    lines: invoice.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      ...formatMoney(line, LINE_MONEY_FIELDS),
      ...formatRates(line, LINE_RATE_FIELDS),
    })),
    sourceLinks: invoice.sourceLinks ?? [],
    approvalRequest,
    accountingVoucherNumber: voucher?.voucherNumber ?? null,
    ledgerEntryCount: invoice.status === 'POSTED' ? ledgerEntryCount : 0,
    payableOpenItemId: payableOpenItem?.id ?? null,
    payableOpenItemStatus: payableOpenItem?.status ?? null,
    payableOriginalAmount: payableOpenItem
      ? formatForPersistence(payableOpenItem.originalAmount)
      : null,
    payableAllocatedAmount: payableOpenItem
      ? formatForPersistence(payableOpenItem.allocatedAmount)
      : null,
    payableOutstandingAmount: payableOpenItem
      ? formatForPersistence(payableOpenItem.outstandingAmount)
      : null,
    // Phase 4B4 — settlement state derived from CREDIT open item; VendorAdjustment.status stays POSTED.
    payableSettlementState: payableOpenItem
      ? Number(payableOpenItem.outstandingAmount) <= 0 && Number(payableOpenItem.allocatedAmount) > 0
        ? 'PAID'
        : Number(payableOpenItem.allocatedAmount) > 0
          ? 'PARTIALLY_PAID'
          : 'UNPAID'
      : null,
    validation: calculation
      ? {
          isValid: calculation.validation.isValid,
          errors: calculation.validation.errors,
          warnings: calculation.validation.warnings,
          duplicateAssessment: calculation.duplicateAssessment,
          accountReadiness: calculation.accountReadiness,
        }
      : null,
    allowedActions: resolveVendorAdjustmentAllowedActions(
      req,
      invoice.status,
      invoice.approvalRequired,
      invoice.adjustmentType,
      payableOpenItem
        ? {
            status: payableOpenItem.status,
            outstandingAmount: formatForPersistence(payableOpenItem.outstandingAmount),
          }
        : null,
    ),
  }
}

export async function getVendorAdjustment(req: Request, tenantId: string, id: string) {
  return serializeVendorAdjustment(req, await repo.findVendorAdjustmentWithLinesOrThrow(tenantId, id))
}

export async function listVendorAdjustments(req: Request, tenantId: string, query: ListVendorAdjustmentsQuery) {
  const result = await repo.listVendorAdjustments(tenantId, query)
  return { ...result, items: await Promise.all(result.items.map((invoice) => serializeVendorAdjustment(req, invoice))) }
}
