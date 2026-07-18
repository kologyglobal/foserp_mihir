import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { compare } from '../../shared/finance-decimal.js'
import { previewNextNumber } from '../../finance-number-series/finance-number-series.repository.js'
import { calculateSalesInvoice } from '../calculation/sales-invoice-calculation.service.js'
import { validateSalesInvoiceDraft } from '../calculation/sales-invoice-validation-preview.service.js'
import { requireActiveCustomerParty } from '../customer-party/customer-party.service.js'
import { loadSalesOrderSource } from '../source/sales-order-source.service.js'
import * as repo from './sales-invoice.repository.js'
import {
  SalesInvoiceDraftCalculationFailedError,
  SalesInvoiceNotFoundError,
  SalesInvoiceValidationFailedError,
} from './sales-invoice.errors.js'
import type { CancelSalesInvoiceInput, CreateSalesInvoiceInput, UpdateSalesInvoiceInput } from './sales-invoice.schemas.js'
import {
  buildCalculationInputFromRequest,
  buildCalculationInputFromStoredInvoice,
  parseCalculationContext,
} from './sales-invoice-validation.service.js'
import { serializeSalesInvoiceDetail } from './sales-invoice-read.service.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

async function writeAudit(
  req: Request,
  tenantId: string,
  invoiceId: string,
  action: string,
  oldValues?: unknown,
  newValues?: unknown,
): Promise<void> {
  const audit = auditMeta(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'sales_invoice',
    entityId: invoiceId,
    action,
    oldValues,
    newValues,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}

async function assertBranch(tenantId: string, legalEntityId: string, branchId?: string | null): Promise<void> {
  const branchCheck = await validateBranchOwnership(tenantId, legalEntityId, branchId)
  if (!branchCheck.valid) {
    throw new SalesInvoiceValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }
}

function throwOnCalcFailure(calc: ReturnType<typeof calculateSalesInvoice>): void {
  if (!calc.valid) {
    throw new SalesInvoiceDraftCalculationFailedError(
      calc.errors[0]?.message ?? 'Invoice calculation failed',
      calc.errors.map((e) => ({ field: e.field ?? 'lines', message: e.message })),
    )
  }
}

export async function createSalesInvoiceDraft(req: Request, tenantId: string, input: CreateSalesInvoiceInput) {
  const legalEntity = await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  await assertBranch(tenantId, input.legalEntityId, input.branchId)
  const party = await requireActiveCustomerParty(tenantId, input.customerId)

  let sourceSnapshot = null
  let metaWarnings: Array<{ code: string; message: string }> = []
  if (input.sourceType === 'SALES_ORDER' && input.sourceDocumentId) {
    const source = await loadSalesOrderSource(tenantId, input.sourceDocumentId, input.customerId)
    sourceSnapshot = source.snapshot
    metaWarnings = source.warnings
  }

  const calcInput = buildCalculationInputFromRequest(input, legalEntity.stateCode)
  const calc = calculateSalesInvoice(calcInput)
  throwOnCalcFailure(calc)

  const userId = req.context?.userId
  const invoice = await repo.createSalesInvoiceDraft(tenantId, input, calc, party, userId, {
    sourceDocumentSnapshot: sourceSnapshot,
  })

  await writeAudit(req, tenantId, invoice.id, 'SALES_INVOICE_DRAFT_CREATED', undefined, {
    draftReference: invoice.draftReference,
    status: invoice.status,
  })

  const detail = await serializeSalesInvoiceDetail(req, invoice)
  return { ...detail, metaWarnings: metaWarnings.length > 0 ? metaWarnings : undefined }
}

export async function updateSalesInvoiceDraft(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateSalesInvoiceInput,
) {
  const existing = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, id)

  const legalEntity = await getLegalEntityOrThrow(tenantId, existing.legalEntityId)
  await assertBranch(tenantId, existing.legalEntityId, input.branchId)
  const party = await requireActiveCustomerParty(tenantId, input.customerId)

  if (input.sourceType === 'SALES_ORDER' && input.sourceDocumentId) {
    await loadSalesOrderSource(tenantId, input.sourceDocumentId, input.customerId)
  }

  const calcInput = buildCalculationInputFromRequest(
    { ...input, legalEntityId: existing.legalEntityId },
    legalEntity.stateCode,
  )
  const calc = calculateSalesInvoice(calcInput)
  throwOnCalcFailure(calc)

  const reopenFromReady = existing.status === 'READY_TO_POST'
  const beforeStatus = existing.status
  const userId = req.context?.userId
  const invoice = await repo.replaceEditableInvoiceLines(tenantId, id, input, calc, party, userId, {
    reopenFromReady,
  })

  await writeAudit(req, tenantId, id, 'SALES_INVOICE_DRAFT_UPDATED', { status: beforeStatus }, {
    status: invoice.status,
    draftReference: invoice.draftReference,
  })
  if (reopenFromReady) {
    await writeAudit(req, tenantId, id, 'SALES_INVOICE_READY_REOPENED_BY_EDIT', { status: 'READY_TO_POST' }, {
      status: 'DRAFT',
    })
  }

  return serializeSalesInvoiceDetail(req, invoice)
}

export async function validateSalesInvoiceRecord(req: Request, tenantId: string, id: string) {
  const invoice = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, id)
  const legalEntity = await getLegalEntityOrThrow(tenantId, invoice.legalEntityId)
  const calcInput = buildCalculationInputFromStoredInvoice(invoice, legalEntity.stateCode)
  if (!calcInput) throw new SalesInvoiceValidationFailedError('Invoice calculation context is missing')

  const preview = await validateSalesInvoiceDraft(calcInput, { tenantId })
  await writeAudit(req, tenantId, id, 'SALES_INVOICE_VALIDATED', undefined, {
    valid: preview.valid,
    errorCount: preview.errors.length,
    warningCount: preview.warnings.length,
  })
  return preview
}

function amountsDrift(invoice: Awaited<ReturnType<typeof repo.findSalesInvoiceWithLinesOrThrow>>, calc: ReturnType<typeof calculateSalesInvoice>): boolean {
  return (
    compare(invoice.totalAmount, calc.totalAmount) !== 0 ||
    compare(invoice.taxableAmount, calc.taxableAmount) !== 0 ||
    compare(invoice.totalTaxAmount, calc.totalTaxAmount) !== 0
  )
}

export async function markSalesInvoiceReady(req: Request, tenantId: string, id: string) {
  const existing = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') {
    throw new SalesInvoiceValidationFailedError('Only draft invoices can be marked ready to post')
  }

  const legalEntity = await getLegalEntityOrThrow(tenantId, existing.legalEntityId)
  const calcInput = buildCalculationInputFromStoredInvoice(existing, legalEntity.stateCode)
  if (!calcInput) throw new SalesInvoiceValidationFailedError('Invoice calculation context is missing')

  const preview = await validateSalesInvoiceDraft(calcInput, { tenantId })
  if (!preview.valid) {
    throw new SalesInvoiceValidationFailedError(
      preview.errors[0]?.message ?? 'Invoice validation failed',
      preview.errors.map((e) => ({ field: e.field ?? 'invoice', message: e.message })),
    )
  }

  try {
    await previewNextNumber(tenantId, existing.legalEntityId, 'SALES_INVOICE')
  } catch {
    throw new SalesInvoiceValidationFailedError('Sales invoice number series is not configured', [
      { field: 'invoiceNumber', message: 'Configure SALES_INVOICE number series before marking ready' },
    ])
  }

  const calc = preview.calculation
  let invoice = existing
  const context = parseCalculationContext(existing.calculationContext)
  if (context && amountsDrift(existing, calc)) {
    invoice = await repo.persistRecalculatedAmounts(tenantId, id, calc, context, req.context?.userId)
  }

  invoice = await repo.markSalesInvoiceReady(tenantId, id, req.context?.userId)
  await writeAudit(req, tenantId, id, 'SALES_INVOICE_READY', { status: 'DRAFT' }, { status: 'READY_TO_POST' })

  return serializeSalesInvoiceDetail(req, invoice)
}

export async function cancelSalesInvoiceDraft(
  req: Request,
  tenantId: string,
  id: string,
  input: CancelSalesInvoiceInput,
) {
  const before = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, id)
  const invoice = await repo.cancelSalesInvoiceDraft(tenantId, id, input.cancellationReason, req.context?.userId)
  await writeAudit(req, tenantId, id, 'SALES_INVOICE_DRAFT_CANCELLED', { status: before.status }, {
    status: invoice.status,
    cancellationReason: input.cancellationReason,
  })
  return serializeSalesInvoiceDetail(req, invoice)
}

export { SalesInvoiceNotFoundError }
