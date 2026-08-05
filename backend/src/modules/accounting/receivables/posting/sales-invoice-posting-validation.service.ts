import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { compare } from '../../shared/finance-decimal.js'
import { calculateSalesInvoice } from '../calculation/sales-invoice-calculation.service.js'
import { validateSalesInvoiceDraft } from '../calculation/sales-invoice-validation-preview.service.js'
import { requireActiveCustomerParty } from '../customer-party/customer-party.service.js'
import { resolvePostingPeriod } from '../../posting/posting-period.service.js'
import { PostingError } from '../../posting/posting.errors.js'
import * as repo from '../sales-invoices/sales-invoice.repository.js'
import {
  buildCalculationInputFromStoredInvoice,
  parseCalculationContext,
  resolveCalculationContext,
} from '../sales-invoices/sales-invoice-validation.service.js'
import { SalesInvoiceNotFoundError, SalesInvoiceNotReadyError } from '../sales-invoices/sales-invoice.errors.js'
import {
  SalesInvoiceAlreadyPostedError,
  SalesInvoiceChangedAfterReadyError,
  SalesInvoicePostingAccountNotReadyError,
  SalesInvoicePostingPeriodClosedError,
  SalesInvoicePostingPeriodUnderReviewError,
  SalesInvoicePostingValidationFailedError,
} from './sales-invoice-posting.errors.js'
import type { SalesInvoicePostingValidationContext } from './sales-invoice-posting.types.js'
import type { SalesInvoiceWithLines } from '../sales-invoices/sales-invoice.types.js'
import { buildSalesInvoicePostingRequest } from './sales-invoice-accounting-builder.service.js'
import type { PostingRequest } from '../../posting/posting.types.js'
import { requiresLutCoverage } from '../../tax-compliance/export-sez-lut.util.js'
import { resolveLutForSalesInvoice } from '../../tax-compliance/gst-export-lut.service.js'
import { resolveCompanyGstinScope } from '../../tax-compliance/gst-registration-scope.util.js'
import { prisma } from '../../../../config/prisma.js'

function amountsDrift(invoice: SalesInvoiceWithLines, calc: ReturnType<typeof calculateSalesInvoice>): boolean {
  return (
    compare(invoice.totalAmount, calc.totalAmount) !== 0 ||
    compare(invoice.taxableAmount, calc.taxableAmount) !== 0 ||
    compare(invoice.totalTaxAmount, calc.totalTaxAmount) !== 0
  )
}

export interface ValidatedSalesInvoicePosting {
  invoice: SalesInvoiceWithLines
  postingRequest: PostingRequest
  context: SalesInvoicePostingValidationContext
  calculationContext: ReturnType<typeof parseCalculationContext>
}

export async function validateSalesInvoiceForPosting(
  tenantId: string,
  invoiceId: string,
): Promise<ValidatedSalesInvoicePosting> {
  let invoice: SalesInvoiceWithLines
  try {
    invoice = await repo.findSalesInvoiceWithLinesOrThrow(tenantId, invoiceId)
  } catch {
    throw new SalesInvoiceNotFoundError()
  }

  if (invoice.status === 'POSTED') {
    throw new SalesInvoiceAlreadyPostedError()
  }
  if (invoice.status !== 'READY_TO_POST') {
    throw new SalesInvoiceNotReadyError('Only invoices in READY_TO_POST status can be posted')
  }
  if (invoice.invoiceNumber || invoice.accountingVoucherId || invoice.postingEventId) {
    throw new SalesInvoiceAlreadyPostedError()
  }

  await requireActiveCustomerParty(tenantId, invoice.customerId)

  const legalEntity = await getLegalEntityOrThrow(tenantId, invoice.legalEntityId)

  // Phase 10 — LUT gate for export/SEZ without payment of IGST
  if (requiresLutCoverage(invoice.taxTreatment)) {
    let branchGstin: string | null = null
    if (invoice.branchId) {
      const br = await prisma.branch.findFirst({
        where: { id: invoice.branchId, tenantId, legalEntityId: invoice.legalEntityId },
        select: { gstin: true },
      })
      branchGstin = br?.gstin ?? null
    }
    const scope = resolveCompanyGstinScope({
      legalEntityId: legalEntity.id,
      legalEntityGstin: legalEntity.gstin,
      branchId: invoice.branchId,
      branchGstin,
    })
    const companyGstin = 'ok' in scope ? null : scope.gstin
    const { assessment } = await resolveLutForSalesInvoice({
      tenantId,
      legalEntityId: invoice.legalEntityId,
      taxTreatment: invoice.taxTreatment,
      invoiceDate: invoice.invoiceDate,
      companyGstin,
      lutId: (invoice as { lutId?: string | null }).lutId ?? null,
    })
    if (assessment.blockers.length) {
      throw new SalesInvoicePostingValidationFailedError(
        assessment.blockers[0] ?? 'Valid LUT required for zero-rated without payment',
        assessment.blockers.map((m) => ({ field: 'lutId', message: m })),
      )
    }
  }

  const calcInput = buildCalculationInputFromStoredInvoice(invoice, legalEntity.stateCode)
  if (!calcInput) {
    throw new SalesInvoicePostingValidationFailedError('Invoice calculation context is missing')
  }

  const preview = await validateSalesInvoiceDraft(calcInput, { tenantId })
  if (!preview.valid) {
    throw new SalesInvoicePostingValidationFailedError(
      preview.errors[0]?.message ?? 'Invoice validation failed',
      preview.errors.map((e) => ({ field: e.field ?? 'invoice', message: e.message })),
    )
  }

  const calc = preview.calculation
  // Trust document amounts when context was reconstructed (migrated CRM rows may
  // differ slightly from the AR pure calc engine; posting GL uses stored amounts).
  const hadStoredContext = Boolean(parseCalculationContext(invoice.calculationContext))
  if (hadStoredContext && amountsDrift(invoice, calc)) {
    throw new SalesInvoiceChangedAfterReadyError()
  }

  const postingDate = (invoice.postingDate ?? invoice.invoiceDate).toISOString().slice(0, 10)
  try {
    await resolvePostingPeriod(tenantId, invoice.legalEntityId, postingDate)
  } catch (error) {
    if (error instanceof PostingError) {
      if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
        throw new SalesInvoicePostingPeriodClosedError(error.message)
      }
      if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
        throw new SalesInvoicePostingPeriodUnderReviewError(error.message)
      }
    }
    throw error
  }

  const receivableReady = preview.accountReadiness.find(
    (a) => a.mappingKey === 'CUSTOMER_RECEIVABLE' && a.required,
  )
  if (!receivableReady?.valid || !receivableReady.accountId) {
    throw new SalesInvoicePostingAccountNotReadyError(
      'Customer receivable account is not configured or not postable',
      [{ field: 'receivableAccountId', message: 'Configure CUSTOMER_RECEIVABLE mapping' }],
    )
  }

  const invalidAccounts = preview.accountReadiness.filter((a) => a.required && !a.valid)
  if (invalidAccounts.length > 0) {
    throw new SalesInvoicePostingAccountNotReadyError(
      invalidAccounts[0]?.issues[0]?.message ?? 'Required accounts are not ready for posting',
      invalidAccounts.flatMap((a) =>
        a.issues.map((i) => ({ field: a.mappingKey, message: i.message })),
      ),
    )
  }

  const resolvedPeriod = await resolvePostingPeriod(tenantId, invoice.legalEntityId, postingDate)
  const calculationContext = resolveCalculationContext(invoice)

  const postingRequest = buildSalesInvoicePostingRequest({
    invoice,
    receivableAccountId: receivableReady.accountId,
    calculationContext,
  })

  return {
    invoice,
    postingRequest,
    context: {
      receivableAccountId: receivableReady.accountId,
      financialYearId: resolvedPeriod.financialYear.id,
    },
    calculationContext,
  }
}
