/**
 * Vendor invoice calculation orchestrator (Phase 4A2).
 *
 * Wraps the pure amount calculation core with the duplicate detector, account resolver, and
 * accounting preview builder, then merges all validation surfaces into a single result.
 *
 * `calculateVendorInvoice` is the async, DB-aware entry point used by the (future) service layer.
 * `calculateVendorInvoiceSync` is a fully synchronous, DB-free variant for pure unit tests and
 * offline previews — duplicate detection is always NONE and account resolution only honours
 * `configuration.accounts` / line-level overrides (no DefaultAccountMapping lookups).
 */
import { formatForPersistence } from '../../../shared/finance-decimal.js'
import { VendorInvoiceError } from '../vendor-invoice.errors.js'
import { normalizeSupplierInvoiceNumber } from '../vendor-invoice-number-normalization.js'
import { calculateVendorInvoiceAmounts } from './vendor-invoice-amounts.service.js'
import type { VendorInvoiceAmountsCalculationResult } from './vendor-invoice-amounts.service.js'
import { assessVendorInvoiceDuplicates, emptyVendorInvoiceDuplicateAssessment } from './vendor-invoice-duplicate-detector.service.js'
import { buildRequiredAccountComponents, finalizeAccountReadiness, resolveVendorInvoiceAccounts } from './vendor-invoice-account-resolver.service.js'
import { buildVendorInvoiceAccountingPreview } from './vendor-invoice-accounting-preview.service.js'
import { mergeVendorInvoiceValidation } from './vendor-invoice-validation.service.js'
import { VENDOR_INVOICE_CALCULATION_VERSION } from './vendor-invoice-calculation.types.js'
import type {
  VendorInvoiceAccountReadiness,
  VendorInvoiceAccountingPreview,
  VendorInvoiceCalculationContext,
  VendorInvoiceCalculationInput,
  VendorInvoiceCalculationResult,
  VendorInvoiceCalculationSnapshot,
  VendorInvoiceCalculationValidation,
  VendorInvoiceDuplicateAssessment,
} from './vendor-invoice-calculation.types.js'

function emptyAccountingPreview(vendorPayableAmount: string): VendorInvoiceAccountingPreview {
  return {
    isBalanced: true,
    lines: [],
    totalDebit: '0.0000',
    totalCredit: '0.0000',
    difference: '0.0000',
    vendorPayableCreditAmount: formatForPersistence(vendorPayableAmount),
    issues: [],
  }
}

function buildSnapshot(
  amounts: VendorInvoiceAmountsCalculationResult,
  input: VendorInvoiceCalculationInput,
  duplicateAssessment: VendorInvoiceDuplicateAssessment,
  accountReadiness: VendorInvoiceAccountReadiness,
  accountingPreview: VendorInvoiceAccountingPreview,
  validation: VendorInvoiceCalculationValidation,
): VendorInvoiceCalculationSnapshot {
  const vendorPayableEntry = accountReadiness.resolvedAccounts.find((e) => e.component === 'VENDOR_PAYABLE')
  const tdsPayableEntry = accountReadiness.resolvedAccounts.find((e) => e.component === 'TDS_PAYABLE')

  return {
    calculationVersion: VENDOR_INVOICE_CALCULATION_VERSION,
    derivedSupplyType: amounts.derivedSupplyType,
    supplyType: amounts.supplyType,
    taxTreatment: input.taxTreatment,
    isReverseCharge: amounts.isRcm,
    totals: amounts.totals,
    baseTotals: amounts.baseTotals,
    lineCount: amounts.lines.length,
    calculatedAt: '', // intentionally blank for deterministic snapshots (wall-clock excluded)
    duplicateRiskLevel: duplicateAssessment.riskLevel,
    isDuplicateBlocking: duplicateAssessment.isBlocking,
    isAccountReadinessReady: accountReadiness.isReady,
    isAccountingPreviewBalanced: accountingPreview.isBalanced,
    validationErrorCodes: validation.errors.map((e) => e.code),
    validationWarningCodes: validation.warnings.map((w) => w.code),
    vendorPayableAccountId: vendorPayableEntry?.accountId ?? null,
    tdsPayableAccountId: tdsPayableEntry?.accountId ?? null,
  }
}

function assembleResult(
  amounts: VendorInvoiceAmountsCalculationResult,
  duplicateAssessment: VendorInvoiceDuplicateAssessment,
  accountReadiness: VendorInvoiceAccountReadiness,
  accountingPreview: VendorInvoiceAccountingPreview,
  validation: VendorInvoiceCalculationValidation,
  input: VendorInvoiceCalculationInput,
): VendorInvoiceCalculationResult {
  return {
    calculationVersion: VENDOR_INVOICE_CALCULATION_VERSION,
    derivedSupplyType: amounts.derivedSupplyType,
    supplyType: amounts.supplyType,
    isReverseCharge: amounts.isRcm,
    totals: amounts.totals,
    baseTotals: amounts.baseTotals,
    lines: amounts.lines,
    duplicateAssessment,
    accountReadiness,
    accountingPreview,
    validation,
    snapshot: buildSnapshot(amounts, input, duplicateAssessment, accountReadiness, accountingPreview, validation),
  }
}

/**
 * Full async calculation — amounts, duplicate scan, account readiness, and accounting preview,
 * each individually toggleable via `context.include*` (all default to true whenever a real
 * `context.tenantId` is present; pass them explicitly as false for tenant-scoped dry runs).
 */
export async function calculateVendorInvoice(
  input: VendorInvoiceCalculationInput,
  context: VendorInvoiceCalculationContext,
): Promise<VendorInvoiceCalculationResult> {
  if (context.legalEntityId !== input.legalEntityId) {
    throw new VendorInvoiceError(
      400,
      'Calculation context legal entity does not match the input legal entity',
      'VENDOR_INVOICE_CONTEXT_LEGAL_ENTITY_MISMATCH',
    )
  }

  const hasTenant = Boolean(context.tenantId)
  const includeDuplicateDetection = context.includeDuplicateDetection ?? hasTenant
  const includeAccountReadiness = context.includeAccountReadiness ?? hasTenant
  const includeAccountingPreview = context.includeAccountingPreview ?? hasTenant

  const amounts = calculateVendorInvoiceAmounts(input)
  const normalizedSupplierInvoiceNumber = normalizeSupplierInvoiceNumber(input.supplierInvoiceNumber ?? '')

  const duplicateAssessment: VendorInvoiceDuplicateAssessment =
    includeDuplicateDetection && context.tenantId && input.vendorId
      ? await assessVendorInvoiceDuplicates({
          tenantId: context.tenantId,
          legalEntityId: context.legalEntityId,
          vendorId: input.vendorId,
          normalizedSupplierInvoiceNumber,
          supplierInvoiceDate: input.invoiceDate,
          invoiceGrandTotal: amounts.totals.invoiceGrandTotal,
          excludeVendorInvoiceId: context.vendorInvoiceId ?? null,
        })
      : emptyVendorInvoiceDuplicateAssessment(normalizedSupplierInvoiceNumber)

  // resolveVendorInvoiceAccounts internally skips all DB access when includeDbLookups is false,
  // resolving purely from configuration/line overrides — this covers the "readiness from
  // overrides only" fallback without a separate code path.
  const accountReadiness = await resolveVendorInvoiceAccounts({
    tenantId: context.tenantId,
    legalEntityId: context.legalEntityId,
    amountsResult: amounts,
    input: { configuration: input.configuration, tdsRecognitionMode: input.tdsRecognitionMode },
    includeDbLookups: includeAccountReadiness,
  })

  const accountingPreview = includeAccountingPreview
    ? buildVendorInvoiceAccountingPreview({
        amountsResult: amounts,
        accountReadiness,
        input: {
          vendorId: input.vendorId,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          tdsRecognitionMode: input.tdsRecognitionMode,
        },
      })
    : emptyAccountingPreview(amounts.totals.vendorPayableAmount)

  const validation = mergeVendorInvoiceValidation({
    amountErrors: amounts.issues.errors,
    amountWarnings: amounts.issues.warnings,
    duplicateAssessment,
    accountReadiness,
    accountingPreview,
  })

  return assembleResult(amounts, duplicateAssessment, accountReadiness, accountingPreview, validation, input)
}

/**
 * Pure/synchronous variant — no DB access at all. Duplicate detection is always NONE; account
 * resolution only honours `configuration.accounts` and per-line `debitAccountId` overrides.
 * Intended for unit tests and offline "what-if" previews.
 */
export function calculateVendorInvoiceSync(input: VendorInvoiceCalculationInput): VendorInvoiceCalculationResult {
  const amounts = calculateVendorInvoiceAmounts(input)
  const normalizedSupplierInvoiceNumber = normalizeSupplierInvoiceNumber(input.supplierInvoiceNumber ?? '')
  const duplicateAssessment = emptyVendorInvoiceDuplicateAssessment(normalizedSupplierInvoiceNumber)

  const resolvedAccounts = buildRequiredAccountComponents({
    amountsResult: amounts,
    configuration: input.configuration,
    tdsMode: input.tdsRecognitionMode,
  })
  const accountReadiness = finalizeAccountReadiness(resolvedAccounts)

  const accountingPreview = buildVendorInvoiceAccountingPreview({
    amountsResult: amounts,
    accountReadiness,
    input: {
      vendorId: input.vendorId,
      currencyCode: input.currencyCode,
      exchangeRate: input.exchangeRate,
      tdsRecognitionMode: input.tdsRecognitionMode,
    },
  })

  const validation = mergeVendorInvoiceValidation({
    amountErrors: amounts.issues.errors,
    amountWarnings: amounts.issues.warnings,
    duplicateAssessment,
    accountReadiness,
    accountingPreview,
  })

  return assembleResult(amounts, duplicateAssessment, accountReadiness, accountingPreview, validation, input)
}
