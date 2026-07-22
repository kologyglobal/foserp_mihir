/**
 * Vendor invoice calculation orchestrator (Phase 4A2).
 *
 * Wraps the pure amount calculation core with the duplicate detector, account resolver, and
 * accounting preview builder, then merges all validation surfaces into a single result.
 *
 * `calculateVendorAdjustment` is the async, DB-aware entry point used by the (future) service layer.
 * `calculateVendorAdjustmentSync` is a fully synchronous, DB-free variant for pure unit tests and
 * offline previews — duplicate detection is always NONE and account resolution only honours
 * `configuration.accounts` / line-level overrides (no DefaultAccountMapping lookups).
 */
import { formatForPersistence } from '../../../shared/finance-decimal.js'
import { VendorAdjustmentError } from '../vendor-adjustment.errors.js'
import { normalizeSupplierReferenceNumber } from '../vendor-adjustment-number-normalization.js'
import { calculateVendorAdjustmentAmounts } from './vendor-adjustment-amounts.service.js'
import type { VendorAdjustmentAmountsCalculationResult } from './vendor-adjustment-amounts.service.js'
import { assessVendorAdjustmentDuplicates, emptyVendorAdjustmentDuplicateAssessment } from './vendor-adjustment-duplicate-detector.service.js'
import { buildRequiredAccountComponents, finalizeAccountReadiness, resolveVendorAdjustmentAccounts } from './vendor-adjustment-account-resolver.service.js'
import { buildVendorAdjustmentAccountingPreview } from './vendor-adjustment-accounting-preview.service.js'
import { mergeVendorAdjustmentValidation } from './vendor-adjustment-validation.service.js'
import { VENDOR_ADJUSTMENT_CALCULATION_VERSION } from './vendor-adjustment-calculation.types.js'
import type {
  VendorAdjustmentAccountReadiness,
  VendorAdjustmentAccountingPreview,
  VendorAdjustmentCalculationContext,
  VendorAdjustmentCalculationInput,
  VendorAdjustmentCalculationResult,
  VendorAdjustmentCalculationSnapshot,
  VendorAdjustmentCalculationValidation,
  VendorAdjustmentDuplicateAssessment,
} from './vendor-adjustment-calculation.types.js'

function emptyAccountingPreview(vendorPayableAmount: string): VendorAdjustmentAccountingPreview {
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
  amounts: VendorAdjustmentAmountsCalculationResult,
  input: VendorAdjustmentCalculationInput,
  duplicateAssessment: VendorAdjustmentDuplicateAssessment,
  accountReadiness: VendorAdjustmentAccountReadiness,
  accountingPreview: VendorAdjustmentAccountingPreview,
  validation: VendorAdjustmentCalculationValidation,
): VendorAdjustmentCalculationSnapshot {
  const vendorPayableEntry = accountReadiness.resolvedAccounts.find((e) => e.component === 'VENDOR_PAYABLE')
  const tdsPayableEntry = accountReadiness.resolvedAccounts.find((e) => e.component === 'TDS_PAYABLE')

  return {
    calculationVersion: VENDOR_ADJUSTMENT_CALCULATION_VERSION,
    derivedSupplyType: amounts.derivedSupplyType,
    supplyType: amounts.supplyType,
    purchaseTaxTreatment: input.purchaseTaxTreatment,
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
  amounts: VendorAdjustmentAmountsCalculationResult,
  duplicateAssessment: VendorAdjustmentDuplicateAssessment,
  accountReadiness: VendorAdjustmentAccountReadiness,
  accountingPreview: VendorAdjustmentAccountingPreview,
  validation: VendorAdjustmentCalculationValidation,
  input: VendorAdjustmentCalculationInput,
): VendorAdjustmentCalculationResult {
  return {
    calculationVersion: VENDOR_ADJUSTMENT_CALCULATION_VERSION,
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
export async function calculateVendorAdjustment(
  input: VendorAdjustmentCalculationInput,
  context: VendorAdjustmentCalculationContext,
): Promise<VendorAdjustmentCalculationResult> {
  if (context.legalEntityId !== input.legalEntityId) {
    throw new VendorAdjustmentError(
      400,
      'Calculation context legal entity does not match the input legal entity',
      'VENDOR_ADJUSTMENT_CONTEXT_LEGAL_ENTITY_MISMATCH',
    )
  }

  const hasTenant = Boolean(context.tenantId)
  const includeDuplicateDetection = context.includeDuplicateDetection ?? hasTenant
  const includeAccountReadiness = context.includeAccountReadiness ?? hasTenant
  const includeAccountingPreview = context.includeAccountingPreview ?? hasTenant

  const amounts = calculateVendorAdjustmentAmounts(input)
  const normalizedSupplierReferenceNumber = normalizeSupplierReferenceNumber(input.supplierReferenceNumber ?? '')

  const duplicateAssessment: VendorAdjustmentDuplicateAssessment =
    includeDuplicateDetection && context.tenantId && input.vendorId
      ? await assessVendorAdjustmentDuplicates({
          tenantId: context.tenantId,
          legalEntityId: context.legalEntityId,
          vendorId: input.vendorId,
          normalizedSupplierReferenceNumber,
          supplierReferenceDate: input.documentDate,
          adjustmentGrandTotal: amounts.totals.adjustmentGrandTotal,
          excludeVendorAdjustmentId: context.vendorAdjustmentId ?? null,
        })
      : emptyVendorAdjustmentDuplicateAssessment(normalizedSupplierReferenceNumber)

  // resolveVendorAdjustmentAccounts internally skips all DB access when includeDbLookups is false,
  // resolving purely from configuration/line overrides — this covers the "readiness from
  // overrides only" fallback without a separate code path.
  const accountReadiness = await resolveVendorAdjustmentAccounts({
    tenantId: context.tenantId,
    legalEntityId: context.legalEntityId,
    amountsResult: amounts,
    input: { configuration: input.configuration, tdsTreatment: input.tdsTreatment },
    includeDbLookups: includeAccountReadiness,
  })

  const accountingPreview = includeAccountingPreview
    ? buildVendorAdjustmentAccountingPreview({
        amountsResult: amounts,
        accountReadiness,
        input: {
          vendorId: input.vendorId,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          adjustmentType: input.adjustmentType,
          tdsTreatment: input.tdsTreatment,
        },
      })
    : emptyAccountingPreview(amounts.totals.vendorPayableAmount)

  const validation = mergeVendorAdjustmentValidation({
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
 * resolution only honours `configuration.accounts` and per-line `offsetAccountId` overrides.
 * Intended for unit tests and offline "what-if" previews.
 */
export function calculateVendorAdjustmentSync(input: VendorAdjustmentCalculationInput): VendorAdjustmentCalculationResult {
  const amounts = calculateVendorAdjustmentAmounts(input)
  const normalizedSupplierReferenceNumber = normalizeSupplierReferenceNumber(input.supplierReferenceNumber ?? '')
  const duplicateAssessment = emptyVendorAdjustmentDuplicateAssessment(normalizedSupplierReferenceNumber)

  const resolvedAccounts = buildRequiredAccountComponents({
    amountsResult: amounts,
    configuration: input.configuration,
    tdsMode:
      input.tdsTreatment === 'ADD_TDS_LIABILITY' || input.tdsTreatment === 'REVERSE_TDS_LIABILITY'
        ? 'AT_INVOICE'
        : 'NOT_APPLICABLE',
  })
  const accountReadiness = finalizeAccountReadiness(resolvedAccounts)

  const accountingPreview = buildVendorAdjustmentAccountingPreview({
    amountsResult: amounts,
    accountReadiness,
    input: {
      vendorId: input.vendorId,
      currencyCode: input.currencyCode,
      exchangeRate: input.exchangeRate,
      adjustmentType: input.adjustmentType,
      tdsTreatment: input.tdsTreatment,
    },
  })

  const validation = mergeVendorAdjustmentValidation({
    amountErrors: amounts.issues.errors,
    amountWarnings: amounts.issues.warnings,
    duplicateAssessment,
    accountReadiness,
    accountingPreview,
  })

  return assembleResult(amounts, duplicateAssessment, accountReadiness, accountingPreview, validation, input)
}
