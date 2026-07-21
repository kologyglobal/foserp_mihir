/**
 * Vendor payment calculation orchestrator (Phase 4B2).
 *
 * Side-effect-free: no VendorPayment writes, no GL, no open items, no allocation.
 * `calculateVendorPayment` may read vendor position from DB when tenant context is present.
 * `calculateVendorPaymentSync` is fully DB-free for unit tests (uses configuration overrides).
 */
import { AppError } from '../../../../../utils/errors.js'
import { calculateVendorPaymentAdjustments } from './vendor-payment-adjustment-calculator.service.js'
import { buildVendorPaymentAccountReadiness } from './vendor-payment-account-resolver.service.js'
import {
  buildVendorPaymentAccountingPreview,
  buildVendorPaymentOpenItemPreview,
  emptyPreview,
} from './vendor-payment-accounting-preview.service.js'
import {
  assertVendorPaymentBaseCurrencyRate,
  convertVendorPaymentTotals,
  validateVendorPaymentExchangeRate,
} from './vendor-payment-currency-calculator.service.js'
import { VENDOR_PAYMENT_CALC_CODES } from './vendor-payment-calculation.errors.js'
import {
  VENDOR_PAYMENT_CALCULATION_VERSION,
  type VendorPaymentAccountReadiness,
  type VendorPaymentAccountingPreview,
  type VendorPaymentCalculationContext,
  type VendorPaymentCalculationInput,
  type VendorPaymentCalculationResult,
  type VendorPaymentCalculationSnapshot,
  type VendorPaymentOpenItemPreview,
  type VendorPaymentPositionResult,
  type VendorPaymentValidationIssue,
} from './vendor-payment-calculation.types.js'
import {
  assessVendorPaymentPosition,
  findVendorPayableOpenItemPosition,
  resolvePositionSnapshot,
} from './vendor-payment-position.service.js'
import { validateVendorPaymentTds } from './vendor-payment-tds-calculator.service.js'
import { mergeVendorPaymentValidation } from './vendor-payment-validation.service.js'
import { toDecimal } from '../../../shared/finance-decimal.js'

function emptyAccountReadiness(): VendorPaymentAccountReadiness {
  return { isReady: true, resolvedAccounts: [], missingComponents: [], invalidComponents: [], issues: [] }
}

function buildSnapshot(
  input: VendorPaymentCalculationInput,
  result: Omit<VendorPaymentCalculationResult, 'snapshot'>,
): VendorPaymentCalculationSnapshot {
  const payable = result.accountReadiness.resolvedAccounts.find((a) => a.component === 'VENDOR_PAYABLE')
  const payment = result.accountReadiness.resolvedAccounts.find((a) => a.component === 'PAYMENT_ACCOUNT')
  return {
    calculationVersion: VENDOR_PAYMENT_CALCULATION_VERSION,
    paymentPurpose: input.paymentPurpose,
    paymentMethod: input.paymentMethod,
    totals: result.totals,
    baseTotals: result.baseTotals,
    adjustmentCount: result.adjustments.length,
    isAccountReadinessReady: result.accountReadiness.isReady,
    isAccountingPreviewBalanced: result.accountingPreview.isBalanced && result.accountingPreview.isBaseBalanced,
    validationErrorCodes: result.validation.errors.map((e) => e.code),
    validationWarningCodes: result.validation.warnings.map((w) => w.code),
    vendorPayableAccountId: payable?.accountId ?? null,
    paymentAccountId: payment?.accountId ?? null,
    calculatedAt: '', // intentional — deterministic snapshots exclude wall-clock
  }
}

function assemble(
  input: VendorPaymentCalculationInput,
  parts: {
    adjustments: VendorPaymentCalculationResult['adjustments']
    totals: VendorPaymentCalculationResult['totals']
    baseTotals: VendorPaymentCalculationResult['baseTotals']
    paymentPosition: VendorPaymentPositionResult
    accountReadiness: VendorPaymentAccountReadiness
    accountingPreview: VendorPaymentAccountingPreview
    openItemPreview: VendorPaymentOpenItemPreview
    extraErrors: VendorPaymentValidationIssue[]
    extraWarnings: VendorPaymentValidationIssue[]
  },
): VendorPaymentCalculationResult {
  const validation = mergeVendorPaymentValidation({
    input,
    accountReadiness: parts.accountReadiness,
    accountingPreview: parts.accountingPreview,
    extraErrors: parts.extraErrors,
    extraWarnings: parts.extraWarnings,
  })

  const baseCurrencyCode = input.configuration?.baseCurrencyCode ?? 'INR'
  const withoutSnapshot = {
    calculationVersion: VENDOR_PAYMENT_CALCULATION_VERSION,
    currency: {
      transactionCurrencyCode: input.currencyCode,
      baseCurrencyCode,
      exchangeRate: input.exchangeRate,
    },
    paymentPosition: parts.paymentPosition,
    adjustments: parts.adjustments,
    totals: parts.totals,
    baseTotals: parts.baseTotals,
    accountReadiness: parts.accountReadiness,
    accountingPreview: parts.accountingPreview,
    openItemPreview: parts.openItemPreview,
    validation,
  }

  return {
    ...withoutSnapshot,
    snapshot: buildSnapshot(input, withoutSnapshot),
  }
}

function runCoreCalculation(
  input: VendorPaymentCalculationInput,
  positionSnapshot: ReturnType<typeof resolvePositionSnapshot>,
  options: { includeAccountReadiness: boolean; includeAccountingPreview: boolean },
): VendorPaymentCalculationResult {
  const extraErrors: VendorPaymentValidationIssue[] = []
  const extraWarnings: VendorPaymentValidationIssue[] = []

  const exchangeRate = validateVendorPaymentExchangeRate(input.exchangeRate, extraErrors)
  const baseCurrencyCode = input.configuration?.baseCurrencyCode ?? 'INR'
  assertVendorPaymentBaseCurrencyRate(input.currencyCode, baseCurrencyCode, exchangeRate, extraErrors)

  const tds = validateVendorPaymentTds(input.adjustments, input.configuration)
  extraErrors.push(...tds.errors)
  extraWarnings.push(...tds.warnings)

  const adjResult = calculateVendorPaymentAdjustments(
    input.paymentAmount,
    input.adjustments,
    input.exchangeRate,
    input.configuration,
  )
  extraErrors.push(...adjResult.errors)
  extraWarnings.push(...adjResult.warnings)

  const baseTotals = convertVendorPaymentTotals(adjResult.totals, input.exchangeRate)

  const positionAssessment = assessVendorPaymentPosition({
    position: positionSnapshot,
    vendorSettlementAmount: adjResult.totals.vendorSettlementAmount,
    paymentPurpose: input.paymentPurpose,
    configuration: input.configuration,
  })
  extraErrors.push(...positionAssessment.errors)
  extraWarnings.push(...positionAssessment.warnings)

  const accountReadiness = options.includeAccountReadiness
    ? buildVendorPaymentAccountReadiness({
        input,
        totals: adjResult.totals,
        adjustments: adjResult.adjustments,
      })
    : emptyAccountReadiness()

  const accountingPreview = options.includeAccountingPreview
    ? buildVendorPaymentAccountingPreview({
        input,
        totals: adjResult.totals,
        baseTotals,
        adjustments: adjResult.adjustments,
        accountReadiness,
      })
    : emptyPreview()

  // When preview unbalanced, mark readiness not ready
  if (!accountingPreview.isBalanced || !accountingPreview.isBaseBalanced) {
    accountReadiness.isReady = false
  }

  const payableEntry = accountReadiness.resolvedAccounts.find((a) => a.component === 'VENDOR_PAYABLE')
  const openItemPreview = buildVendorPaymentOpenItemPreview({
    paymentPurpose: input.paymentPurpose,
    totals: adjResult.totals,
    baseTotals,
    vendorPayableAccountId: payableEntry?.accountId ?? null,
  })

  return assemble(input, {
    adjustments: adjResult.adjustments,
    totals: adjResult.totals,
    baseTotals,
    paymentPosition: positionAssessment.result,
    accountReadiness,
    accountingPreview,
    openItemPreview,
    extraErrors,
    extraWarnings,
  })
}

/**
 * Fully synchronous, DB-free calculation — uses configuration.accounts and optional
 * vendorPositionOverride. Preferred for unit tests.
 */
export function calculateVendorPaymentSync(input: VendorPaymentCalculationInput): VendorPaymentCalculationResult {
  const position = resolvePositionSnapshot(input.configuration, input.exchangeRate)
  return runCoreCalculation(input, position, { includeAccountReadiness: true, includeAccountingPreview: true })
}

/**
 * Async calculation — may load vendor payable open-item position when tenantId is present.
 * Still performs no business-data writes.
 */
export async function calculateVendorPayment(
  input: VendorPaymentCalculationInput,
  context: VendorPaymentCalculationContext,
): Promise<VendorPaymentCalculationResult> {
  if (context.legalEntityId !== input.legalEntityId) {
    throw new AppError(
      400,
      'Calculation context legal entity does not match the input legal entity',
      VENDOR_PAYMENT_CALC_CODES.CONTEXT_LEGAL_ENTITY_MISMATCH,
    )
  }

  const hasTenant = Boolean(context.tenantId)
  const includeVendorPosition = context.includeVendorPosition ?? hasTenant
  const includeAccountReadiness = context.includeAccountReadiness ?? true
  const includeAccountingPreview = context.includeAccountingPreview ?? true

  let position = resolvePositionSnapshot(input.configuration, input.exchangeRate)

  if (includeVendorPosition && context.tenantId && !input.configuration?.vendorPositionOverride) {
    position = await findVendorPayableOpenItemPosition({
      tenantId: context.tenantId,
      legalEntityId: context.legalEntityId,
      vendorId: input.vendorId,
      currencyCode: input.currencyCode,
      exchangeRate: input.exchangeRate,
    })
  }

  return runCoreCalculation(input, position, { includeAccountReadiness, includeAccountingPreview })
}

export { VENDOR_PAYMENT_CALCULATION_VERSION, toDecimal }
