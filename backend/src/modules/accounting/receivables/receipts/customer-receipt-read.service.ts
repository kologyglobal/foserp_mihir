import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import * as repo from './customer-receipt.repository.js'
import { resolveCustomerReceiptAllowedActions } from './customer-receipt-allowed-actions.js'
import type {
  CustomerReceiptDto,
  CustomerReceiptListItemDto,
  CustomerReceiptWithDeductions,
  ListCustomerReceiptsQuery,
} from './customer-receipt.types.js'

async function getLastValidationSummary(tenantId: string, receiptId: string) {
  const audit = await prisma.auditLog.findFirst({
    where: { tenantId, entity: 'customer_receipt', entityId: receiptId, action: 'CUSTOMER_RECEIPT_VALIDATED' },
    orderBy: { createdAt: 'desc' },
  })
  if (!audit?.newValues || typeof audit.newValues !== 'object') return null
  const values = audit.newValues as { valid?: boolean; errorCount?: number; warningCount?: number }
  return {
    valid: values.valid ?? false,
    errors: values.errorCount
      ? [{ code: 'VALIDATION_ERRORS', severity: 'ERROR' as const, message: `${values.errorCount} validation error(s)` }]
      : [],
    warnings: values.warningCount
      ? [{ code: 'VALIDATION_WARNINGS', severity: 'WARNING' as const, message: `${values.warningCount} validation warning(s)` }]
      : [],
  }
}

async function getPostingSummary(
  tenantId: string,
  receipt: CustomerReceiptWithDeductions,
): Promise<Pick<CustomerReceiptDto, 'creditOpenItem' | 'ledgerEntryCount'>> {
  if (receipt.status !== 'POSTED' || !receipt.accountingVoucherId) {
    return { creditOpenItem: undefined, ledgerEntryCount: undefined }
  }
  const [openItem, ledgerEntryCount] = await Promise.all([
    prisma.receivableOpenItem.findFirst({
      where: { tenantId, customerReceiptId: receipt.id },
      select: { id: true, status: true, openAmount: true, originalAmount: true },
    }),
    prisma.generalLedgerEntry.count({ where: { tenantId, voucherId: receipt.accountingVoucherId } }),
  ])
  return {
    creditOpenItem: openItem
      ? {
          id: openItem.id,
          status: openItem.status,
          outstandingAmount: formatForPersistence(openItem.openAmount),
          originalAmount: formatForPersistence(openItem.originalAmount),
        }
      : null,
    ledgerEntryCount,
  }
}

export async function serializeCustomerReceiptDetail(
  req: Request,
  receipt: CustomerReceiptWithDeductions,
  options?: { includeValidationSummary?: boolean },
): Promise<CustomerReceiptDto> {
  const base = repo.mapCustomerReceiptToDto(receipt, receipt.deductionLines)
  const postingSummary = await getPostingSummary(receipt.tenantId, receipt)
  const postedAllocations =
    receipt.status === 'POSTED'
      ? await prisma.customerReceiptAllocation.count({
          where: { tenantId: receipt.tenantId, receiptId: receipt.id, status: 'POSTED' },
        })
      : 0
  const allowedActions = resolveCustomerReceiptAllowedActions(req, receipt.status, {
    creditOutstanding:
      postingSummary.creditOpenItem?.outstandingAmount ?? formatForPersistence(receipt.unallocatedAmount),
    hasPostedAllocations: postedAllocations > 0,
  })
  const validationSummary =
    options?.includeValidationSummary === false
      ? undefined
      : await getLastValidationSummary(receipt.tenantId, receipt.id)

  return {
    ...base,
    allowedActions,
    validationSummary,
    ...postingSummary,
  }
}

export async function serializeCustomerReceiptListItem(
  req: Request,
  receipt: CustomerReceiptWithDeductions,
): Promise<CustomerReceiptListItemDto> {
  const { bankCharges: _bankCharges, otherDeductions: _otherDeductions, validationSummary: _vs, ...rest } =
    await serializeCustomerReceiptDetail(req, receipt, { includeValidationSummary: false })
  return rest
}

export async function listCustomerReceipts(req: Request, tenantId: string, query: ListCustomerReceiptsQuery) {
  const result = await repo.listCustomerReceiptRecords(tenantId, query)
  const items = await Promise.all(result.items.map((item) => serializeCustomerReceiptListItem(req, item)))
  return { ...result, items }
}

export async function getCustomerReceipt(req: Request, tenantId: string, id: string): Promise<CustomerReceiptDto> {
  const receipt = await repo.findCustomerReceiptWithDeductionsOrThrow(tenantId, id)
  return serializeCustomerReceiptDetail(req, receipt)
}
