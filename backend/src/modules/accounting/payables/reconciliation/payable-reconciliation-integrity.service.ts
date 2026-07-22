import { prisma } from '../../../../config/database.js'
import { compare } from '../../shared/finance-decimal.js'
import type { ReconciliationExceptionDraft } from './payable-reconciliation.types.js'

const CREDIT_DOCUMENT_TYPES = new Set(['VENDOR_INVOICE', 'VENDOR_CREDIT_ADJUSTMENT'])
const DEBIT_DOCUMENT_TYPES = new Set(['VENDOR_PAYMENT', 'VENDOR_ADVANCE', 'VENDOR_DEBIT_NOTE'])
const ORPHAN_GL_ALLOWED_SOURCE_TYPES = new Set([
  'VENDOR_INVOICE',
  'VENDOR_PAYMENT',
  'VENDOR_ADJUSTMENT',
  'VENDOR_DEBIT_NOTE',
  'VENDOR_CREDIT_ADJUSTMENT',
  'REVERSAL',
])

/**
 * Runs the AP data-quality / control checks that back the reconciliation run's exception list.
 * Every query is read-only and take-limited; this function never mutates GL, open-item, voucher,
 * or posting-event rows — only returns draft exceptions for the caller to persist.
 */
export async function runIntegrityChecks(
  tenantId: string,
  legalEntityId: string,
  controlAccountIds: string[],
  // Reserved for future date-scoped integrity checks — every check below is a data-quality
  // check against current-state rows (not date-bounded), so it is intentionally unused today.
  _asOfDate: Date,
  postingEventStuckMinutes: number,
): Promise<ReconciliationExceptionDraft[]> {
  const exceptions: ReconciliationExceptionDraft[] = []

  await Promise.all([
    checkPostedDocumentsWithoutOpenItem(tenantId, legalEntityId, exceptions),
    checkOpenItemsWithoutVoucherOrSource(tenantId, legalEntityId, exceptions),
    checkOpenItemBalanceEquation(tenantId, legalEntityId, exceptions),
    checkNegativeAmounts(tenantId, legalEntityId, exceptions),
    checkStatusMismatches(tenantId, legalEntityId, exceptions),
    checkSideDocumentTypeRules(tenantId, legalEntityId, exceptions),
    checkOpenItemVsVoucherGl(tenantId, legalEntityId, exceptions),
    checkOrphanControlAccountGl(tenantId, legalEntityId, controlAccountIds, exceptions),
    checkAllocationIntegrity(tenantId, legalEntityId, exceptions),
    checkMissingReversalLinks(tenantId, legalEntityId, exceptions),
    checkStuckPostingEvents(tenantId, legalEntityId, postingEventStuckMinutes, exceptions),
  ])

  return exceptions
}

async function checkPostedDocumentsWithoutOpenItem(
  tenantId: string,
  legalEntityId: string,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const [invoices, payments, adjustments] = await Promise.all([
    prisma.vendorInvoice.findMany({
      where: { tenantId, legalEntityId, status: 'POSTED', payableOpenItem: { is: null } },
      select: { id: true, vendorInvoiceNumber: true },
      take: 200,
    }),
    prisma.vendorPayment.findMany({
      where: { tenantId, legalEntityId, status: 'POSTED', payableOpenItemId: null },
      select: { id: true, vendorPaymentNumber: true },
      take: 200,
    }),
    prisma.vendorAdjustment.findMany({
      where: { tenantId, legalEntityId, status: 'POSTED', payableOpenItemId: null },
      select: { id: true, vendorAdjustmentNumber: true },
      take: 200,
    }),
  ])
  for (const inv of invoices) {
    exceptions.push({
      severity: 'BLOCKER',
      category: 'SOURCE_DOCUMENT',
      code: 'POSTED_INVOICE_WITHOUT_OPEN_ITEM',
      message: `Posted vendor invoice ${inv.vendorInvoiceNumber ?? inv.id} has no payable open item`,
      documentType: 'VENDOR_INVOICE',
      documentId: inv.id,
    })
  }
  for (const pay of payments) {
    exceptions.push({
      severity: 'BLOCKER',
      category: 'SOURCE_DOCUMENT',
      code: 'POSTED_PAYMENT_WITHOUT_OPEN_ITEM',
      message: `Posted vendor payment ${pay.vendorPaymentNumber ?? pay.id} has no payable open item`,
      documentType: 'VENDOR_PAYMENT',
      documentId: pay.id,
    })
  }
  for (const adj of adjustments) {
    exceptions.push({
      severity: 'BLOCKER',
      category: 'SOURCE_DOCUMENT',
      code: 'POSTED_ADJUSTMENT_WITHOUT_OPEN_ITEM',
      message: `Posted vendor adjustment ${adj.vendorAdjustmentNumber ?? adj.id} has no payable open item`,
      documentType: 'VENDOR_ADJUSTMENT',
      documentId: adj.id,
    })
  }
}

async function checkOpenItemsWithoutVoucherOrSource(
  tenantId: string,
  legalEntityId: string,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const [withoutVoucher, withoutSource] = await Promise.all([
    prisma.payableOpenItem.findMany({
      where: { tenantId, legalEntityId, accountingVoucherId: null, status: { notIn: ['CANCELLED'] } },
      select: { id: true, documentNumber: true, vendorPayableAccountId: true, vendorId: true },
      take: 200,
    }),
    prisma.payableOpenItem.findMany({
      where: {
        tenantId,
        legalEntityId,
        sourceVendorInvoiceId: null,
        sourceVendorPaymentId: null,
        sourceVendorAdjustmentId: null,
      },
      select: { id: true, documentNumber: true, vendorPayableAccountId: true, vendorId: true },
      take: 200,
    }),
  ])
  for (const item of withoutVoucher) {
    exceptions.push({
      severity: 'BLOCKER',
      category: 'OPEN_ITEM',
      code: 'OPEN_ITEM_WITHOUT_VOUCHER',
      message: `Open item ${item.documentNumber ?? item.id} has no accounting voucher`,
      openItemId: item.id,
      accountId: item.vendorPayableAccountId,
      vendorId: item.vendorId,
    })
  }
  for (const item of withoutSource) {
    exceptions.push({
      severity: 'ERROR',
      category: 'OPEN_ITEM',
      code: 'OPEN_ITEM_WITHOUT_SOURCE_DOCUMENT',
      message: `Open item ${item.documentNumber ?? item.id} is not linked to any vendor invoice, payment, or adjustment`,
      openItemId: item.id,
      accountId: item.vendorPayableAccountId,
      vendorId: item.vendorId,
    })
  }
}

async function checkOpenItemBalanceEquation(
  tenantId: string,
  legalEntityId: string,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const items = await prisma.payableOpenItem.findMany({
    where: { tenantId, legalEntityId },
    select: {
      id: true,
      documentNumber: true,
      vendorPayableAccountId: true,
      vendorId: true,
      baseOriginalAmount: true,
      baseAllocatedAmount: true,
      baseAdjustedAmount: true,
      baseWrittenOffAmount: true,
      baseOutstandingAmount: true,
    },
    take: 500,
  })
  for (const item of items) {
    const reconstructed = item.baseOriginalAmount
      .sub(item.baseAllocatedAmount)
      .sub(item.baseAdjustedAmount)
      .sub(item.baseWrittenOffAmount)
    if (compare(reconstructed, item.baseOutstandingAmount) !== 0) {
      exceptions.push({
        severity: 'BLOCKER',
        category: 'OPEN_ITEM',
        code: 'OPEN_ITEM_BALANCE_EQUATION_MISMATCH',
        message: `Open item ${item.documentNumber ?? item.id} outstanding does not equal original − allocated − adjusted − written-off`,
        openItemId: item.id,
        accountId: item.vendorPayableAccountId,
        vendorId: item.vendorId,
        details: {
          baseOriginalAmount: item.baseOriginalAmount.toFixed(4),
          baseAllocatedAmount: item.baseAllocatedAmount.toFixed(4),
          baseAdjustedAmount: item.baseAdjustedAmount.toFixed(4),
          baseWrittenOffAmount: item.baseWrittenOffAmount.toFixed(4),
          expectedOutstanding: reconstructed.toFixed(4),
          actualOutstanding: item.baseOutstandingAmount.toFixed(4),
        },
      })
    }
  }
}

async function checkNegativeAmounts(
  tenantId: string,
  legalEntityId: string,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const items = await prisma.payableOpenItem.findMany({
    where: {
      tenantId,
      legalEntityId,
      OR: [{ originalAmount: { lt: 0 } }, { outstandingAmount: { lt: 0 } }, { allocatedAmount: { lt: 0 } }],
    },
    select: { id: true, documentNumber: true, vendorPayableAccountId: true, vendorId: true },
    take: 200,
  })
  for (const item of items) {
    exceptions.push({
      severity: 'BLOCKER',
      category: 'DATA_INTEGRITY',
      code: 'OPEN_ITEM_NEGATIVE_AMOUNT',
      message: `Open item ${item.documentNumber ?? item.id} has a negative original, outstanding, or allocated amount`,
      openItemId: item.id,
      accountId: item.vendorPayableAccountId,
      vendorId: item.vendorId,
    })
  }
}

async function checkStatusMismatches(
  tenantId: string,
  legalEntityId: string,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const [zeroOutstandingOpen, positiveOutstandingSettled] = await Promise.all([
    prisma.payableOpenItem.findMany({
      where: {
        tenantId,
        legalEntityId,
        outstandingAmount: { lte: 0 },
        status: { in: ['OPEN', 'PARTIALLY_SETTLED', 'DISPUTED', 'ON_HOLD'] },
      },
      select: { id: true, documentNumber: true, status: true, vendorPayableAccountId: true, vendorId: true },
      take: 200,
    }),
    prisma.payableOpenItem.findMany({
      where: { tenantId, legalEntityId, outstandingAmount: { gt: 0 }, status: 'SETTLED' },
      select: { id: true, documentNumber: true, status: true, vendorPayableAccountId: true, vendorId: true },
      take: 200,
    }),
  ])
  for (const item of [...zeroOutstandingOpen, ...positiveOutstandingSettled]) {
    exceptions.push({
      severity: 'ERROR',
      category: 'WORKFLOW',
      code: 'OPEN_ITEM_STATUS_OUTSTANDING_MISMATCH',
      message: `Open item ${item.documentNumber ?? item.id} status (${item.status}) is inconsistent with its outstanding amount`,
      openItemId: item.id,
      accountId: item.vendorPayableAccountId,
      vendorId: item.vendorId,
    })
  }
}

async function checkSideDocumentTypeRules(
  tenantId: string,
  legalEntityId: string,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const items = await prisma.payableOpenItem.findMany({
    where: { tenantId, legalEntityId },
    select: { id: true, documentNumber: true, side: true, documentType: true, vendorPayableAccountId: true, vendorId: true },
    take: 500,
  })
  for (const item of items) {
    const allowed = item.side === 'CREDIT' ? CREDIT_DOCUMENT_TYPES : DEBIT_DOCUMENT_TYPES
    if (item.documentType === 'OPENING_BALANCE') continue
    if (!allowed.has(item.documentType)) {
      exceptions.push({
        severity: 'ERROR',
        category: 'DATA_INTEGRITY',
        code: 'OPEN_ITEM_SIDE_DOCUMENT_TYPE_MISMATCH',
        message: `Open item ${item.documentNumber ?? item.id} has side ${item.side} with an incompatible documentType ${item.documentType}`,
        openItemId: item.id,
        accountId: item.vendorPayableAccountId,
        vendorId: item.vendorId,
      })
    }
  }
}

async function checkOpenItemVsVoucherGl(
  tenantId: string,
  legalEntityId: string,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const items = await prisma.payableOpenItem.findMany({
    where: { tenantId, legalEntityId, accountingVoucherId: { not: null }, vendorPayableAccountId: { not: undefined } },
    select: {
      id: true,
      documentNumber: true,
      side: true,
      baseOriginalAmount: true,
      accountingVoucherId: true,
      vendorPayableAccountId: true,
      vendorId: true,
    },
    take: 200,
  })
  for (const item of items) {
    if (!item.accountingVoucherId) continue
    const agg = await prisma.generalLedgerEntry.aggregate({
      where: { tenantId, legalEntityId, voucherId: item.accountingVoucherId, accountId: item.vendorPayableAccountId },
      _sum: { baseDebitAmount: true, baseCreditAmount: true },
    })
    const glAmount = item.side === 'CREDIT' ? (agg._sum.baseCreditAmount ?? null) : (agg._sum.baseDebitAmount ?? null)
    if (glAmount === null || compare(glAmount, item.baseOriginalAmount) !== 0) {
      exceptions.push({
        severity: 'ERROR',
        category: 'ACCOUNTING_VOUCHER',
        code: 'OPEN_ITEM_ORIGINAL_VS_VOUCHER_GL_MISMATCH',
        message: `Open item ${item.documentNumber ?? item.id} original base amount does not match its voucher's GL posting on the control account`,
        openItemId: item.id,
        voucherId: item.accountingVoucherId,
        accountId: item.vendorPayableAccountId,
        vendorId: item.vendorId,
        details: { baseOriginalAmount: item.baseOriginalAmount.toFixed(4), glAmount: glAmount?.toFixed(4) ?? '0.0000' },
      })
    }
  }
}

async function checkOrphanControlAccountGl(
  tenantId: string,
  legalEntityId: string,
  controlAccountIds: string[],
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  if (controlAccountIds.length === 0) return
  const rows = await prisma.generalLedgerEntry.findMany({
    where: {
      tenantId,
      legalEntityId,
      accountId: { in: controlAccountIds },
      OR: [{ sourceDocumentType: { notIn: [...ORPHAN_GL_ALLOWED_SOURCE_TYPES] } }, { sourceDocumentType: null }],
    },
    select: { id: true, accountId: true, voucherId: true, sourceModule: true, sourceDocumentType: true },
    take: 200,
  })
  for (const row of rows) {
    exceptions.push({
      severity: 'WARNING',
      category: 'GENERAL_LEDGER_ENTRY',
      code: 'CONTROL_ACCOUNT_ORPHAN_GL_POSTING',
      message: `Vendor payable control account has a GL posting outside the recognised AP document types (${row.sourceModule ?? 'null'}/${row.sourceDocumentType ?? 'null'})`,
      accountId: row.accountId,
      voucherId: row.voucherId,
      documentType: row.sourceDocumentType,
    })
  }
}

async function checkAllocationIntegrity(
  tenantId: string,
  legalEntityId: string,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const lines = await prisma.payableAllocationLine.findMany({
    where: { tenantId, legalEntityId },
    select: {
      id: true,
      amount: true,
      reversedAmount: true,
      status: true,
      sourceDebitOpenItemId: true,
      targetCreditOpenItemId: true,
    },
    take: 300,
  })
  for (const line of lines) {
    if (compare(line.reversedAmount, line.amount) > 0) {
      exceptions.push({
        severity: 'BLOCKER',
        category: 'ALLOCATION',
        code: 'ALLOCATION_LINE_OVER_REVERSED',
        message: `Allocation line ${line.id} has reversedAmount greater than its allocated amount`,
        openItemId: line.targetCreditOpenItemId,
        details: { allocationLineId: line.id, amount: line.amount.toFixed(4), reversedAmount: line.reversedAmount.toFixed(4) },
      })
    } else if (line.status === 'ACTIVE' && compare(line.reversedAmount, 0) > 0) {
      exceptions.push({
        severity: 'WARNING',
        category: 'ALLOCATION_REVERSAL',
        code: 'ALLOCATION_LINE_STATUS_INCONSISTENT',
        message: `Allocation line ${line.id} has a reversed amount but status is still ACTIVE`,
        openItemId: line.targetCreditOpenItemId,
        details: { allocationLineId: line.id, reversedAmount: line.reversedAmount.toFixed(4) },
      })
    }
  }
}

async function checkMissingReversalLinks(
  tenantId: string,
  legalEntityId: string,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const [invoices, payments, adjustments] = await Promise.all([
    prisma.vendorInvoice.findMany({
      where: { tenantId, legalEntityId, status: 'REVERSED', reversalVoucherId: null },
      select: { id: true, vendorInvoiceNumber: true },
      take: 100,
    }),
    prisma.vendorPayment.findMany({
      where: { tenantId, legalEntityId, status: 'REVERSED', reversalVoucherId: null },
      select: { id: true, vendorPaymentNumber: true },
      take: 100,
    }),
    prisma.vendorAdjustment.findMany({
      where: { tenantId, legalEntityId, status: 'REVERSED', reversalVoucherId: null },
      select: { id: true, vendorAdjustmentNumber: true },
      take: 100,
    }),
  ])
  for (const inv of invoices) {
    exceptions.push({
      severity: 'ERROR',
      category: 'DOCUMENT_REVERSAL',
      code: 'REVERSED_DOCUMENT_MISSING_REVERSAL_VOUCHER',
      message: `Reversed vendor invoice ${inv.vendorInvoiceNumber ?? inv.id} has no reversal voucher link`,
      documentType: 'VENDOR_INVOICE',
      documentId: inv.id,
    })
  }
  for (const pay of payments) {
    exceptions.push({
      severity: 'ERROR',
      category: 'DOCUMENT_REVERSAL',
      code: 'REVERSED_DOCUMENT_MISSING_REVERSAL_VOUCHER',
      message: `Reversed vendor payment ${pay.vendorPaymentNumber ?? pay.id} has no reversal voucher link`,
      documentType: 'VENDOR_PAYMENT',
      documentId: pay.id,
    })
  }
  for (const adj of adjustments) {
    exceptions.push({
      severity: 'ERROR',
      category: 'DOCUMENT_REVERSAL',
      code: 'REVERSED_DOCUMENT_MISSING_REVERSAL_VOUCHER',
      message: `Reversed vendor adjustment ${adj.vendorAdjustmentNumber ?? adj.id} has no reversal voucher link`,
      documentType: 'VENDOR_ADJUSTMENT',
      documentId: adj.id,
    })
  }
}

async function checkStuckPostingEvents(
  tenantId: string,
  legalEntityId: string,
  stuckMinutes: number,
  exceptions: ReconciliationExceptionDraft[],
): Promise<void> {
  const stuckBefore = new Date(Date.now() - stuckMinutes * 60_000)
  // AP posting events share sourceModule ('ACCOUNTING') with every other finance module —
  // eventType is the reliable AP discriminator (VENDOR_INVOICE_*, VENDOR_PAYMENT_*, VENDOR_ADJUSTMENT_*).
  const [failed, stuckProcessing] = await Promise.all([
    prisma.postingEvent.findMany({
      where: { tenantId, legalEntityId, status: 'FAILED', eventType: { startsWith: 'VENDOR_' } },
      select: { id: true, eventType: true, sourceDocumentType: true, sourceDocumentId: true, errorCode: true, errorMessage: true },
      take: 100,
    }),
    prisma.postingEvent.findMany({
      where: {
        tenantId,
        legalEntityId,
        status: 'PROCESSING',
        eventType: { startsWith: 'VENDOR_' },
        updatedAt: { lte: stuckBefore },
      },
      select: { id: true, eventType: true, sourceDocumentType: true, sourceDocumentId: true },
      take: 100,
    }),
  ])
  for (const ev of failed) {
    exceptions.push({
      severity: 'ERROR',
      category: 'POSTING_EVENT',
      code: 'POSTING_EVENT_FAILED',
      message: `Posting event ${ev.id} (${ev.eventType}) is in FAILED status${ev.errorCode ? ` — ${ev.errorCode}` : ''}`,
      documentType: ev.sourceDocumentType,
      documentId: ev.sourceDocumentId,
      details: { postingEventId: ev.id, errorMessage: ev.errorMessage },
    })
  }
  for (const ev of stuckProcessing) {
    exceptions.push({
      severity: 'WARNING',
      category: 'POSTING_EVENT',
      code: 'POSTING_EVENT_STUCK_PROCESSING',
      message: `Posting event ${ev.id} (${ev.eventType}) has been PROCESSING for more than ${stuckMinutes} minutes`,
      documentType: ev.sourceDocumentType,
      documentId: ev.sourceDocumentId,
      details: { postingEventId: ev.id },
    })
  }
}
