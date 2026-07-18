import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import * as repo from './sales-invoice.repository.js'
import { resolveSalesInvoiceAllowedActions } from './sales-invoice-allowed-actions.js'
import type { ListSalesInvoicesQuery, SalesInvoiceDto, SalesInvoiceListItemDto } from './sales-invoice.types.js'

async function getLastValidationSummary(tenantId: string, invoiceId: string) {
  const audit = await prisma.auditLog.findFirst({
    where: { tenantId, entity: 'sales_invoice', entityId: invoiceId, action: 'SALES_INVOICE_VALIDATED' },
    orderBy: { createdAt: 'desc' },
  })
  if (!audit?.newValues || typeof audit.newValues !== 'object') return null
  const values = audit.newValues as { valid?: boolean; errorCount?: number; warningCount?: number }
  return {
    valid: values.valid ?? false,
    errors: values.errorCount
      ? [{ code: 'VALIDATION_ERRORS', message: `${values.errorCount} validation error(s)`, severity: 'error' as const }]
      : [],
    warnings: values.warningCount
      ? [{ code: 'VALIDATION_WARNINGS', message: `${values.warningCount} validation warning(s)`, severity: 'warning' as const }]
      : [],
  }
}

export async function serializeSalesInvoiceDetail(
  req: Request,
  invoice: import('./sales-invoice.types.js').SalesInvoiceWithLines,
  options?: { includeValidationSummary?: boolean },
): Promise<SalesInvoiceDto> {
  const base = repo.mapInvoiceRecord(invoice, invoice.lines)
  const allowedActions = resolveSalesInvoiceAllowedActions(req, invoice.status)
  const validationSummary =
    options?.includeValidationSummary === false
      ? undefined
      : await getLastValidationSummary(invoice.tenantId, invoice.id)

  let receivableOpenItemId: string | null = null
  let outstandingAmount = base.outstandingAmount
  let amountPaid = base.amountPaid
  if (invoice.status === 'POSTED') {
    const openItem = await prisma.receivableOpenItem.findFirst({
      where: { tenantId: invoice.tenantId, salesInvoiceId: invoice.id, side: 'DEBIT' },
      select: { id: true, openAmount: true, allocatedAmount: true },
    })
    if (openItem) {
      receivableOpenItemId = openItem.id
      outstandingAmount = formatForPersistence(openItem.openAmount)
      amountPaid = formatForPersistence(openItem.allocatedAmount)
    }
  }

  return {
    ...base,
    outstandingAmount,
    amountPaid,
    receivableOpenItemId,
    allowedActions,
    validationSummary,
  }
}

export async function serializeSalesInvoiceListItem(
  req: Request,
  invoice: import('./sales-invoice.types.js').SalesInvoiceWithLines,
): Promise<SalesInvoiceListItemDto> {
  const { lines: _lines, validationSummary: _vs, ...rest } = await serializeSalesInvoiceDetail(req, invoice, {
    includeValidationSummary: false,
  })
  return rest
}

export async function listSalesInvoices(req: Request, tenantId: string, query: ListSalesInvoicesQuery) {
  const result = await repo.listSalesInvoiceRecords(tenantId, query)
  const items = await Promise.all(result.items.map((item) => serializeSalesInvoiceListItem(req, item)))
  return { ...result, items }
}

export async function getSalesInvoice(req: Request, tenantId: string, id: string): Promise<SalesInvoiceDto> {
  const invoice = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, id)
  return serializeSalesInvoiceDetail(req, invoice)
}
