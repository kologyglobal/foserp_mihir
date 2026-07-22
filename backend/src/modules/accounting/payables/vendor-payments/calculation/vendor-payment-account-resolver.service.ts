import type { DefaultAccountMappingKey } from '@prisma/client'
import { isPositive, isZero, toDecimal } from '../../../shared/finance-decimal.js'
import { calcError, VENDOR_PAYMENT_CALC_CODES } from './vendor-payment-calculation.errors.js'
import type {
  VendorPaymentAccountComponent,
  VendorPaymentAccountReadiness,
  VendorPaymentAccountRef,
  VendorPaymentAccountSource,
  VendorPaymentCalculatedAdjustment,
  VendorPaymentCalculationConfiguration,
  VendorPaymentCalculationInput,
  VendorPaymentCalculationTotals,
  VendorPaymentResolvedAccount,
  VendorPaymentValidationIssue,
} from './vendor-payment-calculation.types.js'

const COMPONENT_ISSUE: Partial<Record<VendorPaymentAccountComponent, string>> = {
  VENDOR_PAYABLE: VENDOR_PAYMENT_CALC_CODES.PAYABLE_ACCOUNT_MISSING,
  PAYMENT_ACCOUNT: VENDOR_PAYMENT_CALC_CODES.PAYMENT_ACCOUNT_MISSING,
  TDS_PAYABLE: VENDOR_PAYMENT_CALC_CODES.TDS_ACCOUNT_MISSING,
  DISCOUNT_RECEIVED: VENDOR_PAYMENT_CALC_CODES.DISCOUNT_ACCOUNT_MISSING,
  RETENTION_PAYABLE: VENDOR_PAYMENT_CALC_CODES.RETENTION_ACCOUNT_MISSING,
  WITHHOLDING_PAYABLE: VENDOR_PAYMENT_CALC_CODES.WITHHOLDING_ACCOUNT_MISSING,
  BANK_CHARGE: VENDOR_PAYMENT_CALC_CODES.BANK_CHARGE_ACCOUNT_MISSING,
  PROCESSING_CHARGE: VENDOR_PAYMENT_CALC_CODES.PROCESSING_ACCOUNT_MISSING,
  ROUND_OFF_DEBIT: VENDOR_PAYMENT_CALC_CODES.ROUND_OFF_ACCOUNT_MISSING,
  ROUND_OFF_CREDIT: VENDOR_PAYMENT_CALC_CODES.ROUND_OFF_ACCOUNT_MISSING,
  OTHER_ADJUSTMENT: VENDOR_PAYMENT_CALC_CODES.ACCOUNT_INVALID,
}

function ref(
  component: VendorPaymentAccountComponent,
  isRequired: boolean,
  source: VendorPaymentAccountSource,
  account: VendorPaymentAccountRef | null | undefined,
  lineNumber?: number | null,
  adjustmentLineId?: string | null,
): VendorPaymentResolvedAccount {
  const accountId = account?.id ?? null
  const issueCode = isRequired && !accountId ? (COMPONENT_ISSUE[component] ?? VENDOR_PAYMENT_CALC_CODES.ACCOUNT_INVALID) : null
  return {
    component,
    lineNumber: lineNumber ?? null,
    adjustmentLineId: adjustmentLineId ?? null,
    accountId,
    accountCode: account?.code ?? null,
    accountName: account?.name ?? null,
    source,
    isRequired,
    isValid: !isRequired || accountId != null,
    issueCode,
    issueMessage: issueCode ? `${component} account is required` : null,
  }
}

function pickOverride(
  configuration: VendorPaymentCalculationConfiguration | undefined,
  key: keyof NonNullable<VendorPaymentCalculationConfiguration['accounts']>,
): VendorPaymentAccountRef | null {
  return configuration?.accounts?.[key] ?? null
}

function componentForAdjustment(adj: VendorPaymentCalculatedAdjustment): VendorPaymentAccountComponent | null {
  if (adj.isInformationOnly) return null
  switch (adj.accountingRole) {
    case 'SETTLEMENT_CREDIT':
      switch (adj.adjustmentType) {
        case 'TDS':
          return 'TDS_PAYABLE'
        case 'DISCOUNT':
          return 'DISCOUNT_RECEIVED'
        case 'RETENTION':
          return 'RETENTION_PAYABLE'
        case 'WITHHOLDING':
          return 'WITHHOLDING_PAYABLE'
        default:
          return 'OTHER_ADJUSTMENT'
      }
    case 'PAYMENT_EXPENSE_DEBIT':
      switch (adj.adjustmentType) {
        case 'BANK_CHARGE':
          return 'BANK_CHARGE'
        case 'PROCESSING_CHARGE':
          return 'PROCESSING_CHARGE'
        default:
          return 'OTHER_ADJUSTMENT'
      }
    case 'ROUND_OFF_DEBIT':
      return 'ROUND_OFF_DEBIT'
    case 'ROUND_OFF_CREDIT':
      return 'ROUND_OFF_CREDIT'
    default:
      return null
  }
}

function overrideKeyForComponent(
  component: VendorPaymentAccountComponent,
): keyof NonNullable<VendorPaymentCalculationConfiguration['accounts']> | null {
  switch (component) {
    case 'VENDOR_PAYABLE':
      return 'vendorPayable'
    case 'PAYMENT_ACCOUNT':
      return 'paymentAccount'
    case 'TDS_PAYABLE':
      return 'tdsPayable'
    case 'DISCOUNT_RECEIVED':
      return 'discountReceived'
    case 'RETENTION_PAYABLE':
      return 'retentionPayable'
    case 'WITHHOLDING_PAYABLE':
      return 'withholdingPayable'
    case 'BANK_CHARGE':
      return 'bankCharge'
    case 'PROCESSING_CHARGE':
      return 'processingCharge'
    case 'ROUND_OFF_DEBIT':
      return 'roundOffDebit'
    case 'ROUND_OFF_CREDIT':
      return 'roundOffCredit'
    case 'OTHER_ADJUSTMENT':
      return 'otherAdjustment'
    default:
      return null
  }
}

/**
 * Sync/override-only account resolution for pure tests and preview.
 * Async DB mapping enrichment can be layered later without changing preview math.
 */
export function buildVendorPaymentAccountReadiness(params: {
  input: VendorPaymentCalculationInput
  totals: VendorPaymentCalculationTotals
  adjustments: VendorPaymentCalculatedAdjustment[]
}): VendorPaymentAccountReadiness {
  const { input, totals, adjustments } = params
  const configuration = input.configuration
  const resolved: VendorPaymentResolvedAccount[] = []
  const issues: VendorPaymentValidationIssue[] = []

  // Vendor payable — always required when settlement > 0
  const settlementRequired = isPositive(toDecimal(totals.vendorSettlementAmount))
  const explicitPayable =
    input.vendorPayableAccountId != null
      ? pickOverride(configuration, 'vendorPayable') ??
        ({ id: input.vendorPayableAccountId, code: 'EXPLICIT', name: 'Vendor Payable' } satisfies VendorPaymentAccountRef)
      : pickOverride(configuration, 'vendorPayable')
  resolved.push(
    ref(
      'VENDOR_PAYABLE',
      settlementRequired,
      explicitPayable ? (input.vendorPayableAccountId ? 'EXPLICIT' : 'DEFAULT') : 'UNRESOLVED',
      explicitPayable,
    ),
  )

  // Payment account — required when cash outflow > 0
  const cashRequired = isPositive(toDecimal(totals.cashOutflowAmount))
  const explicitPayment =
    input.paymentAccountId != null
      ? pickOverride(configuration, 'paymentAccount') ??
        ({ id: input.paymentAccountId, code: 'EXPLICIT', name: 'Payment Account' } satisfies VendorPaymentAccountRef)
      : pickOverride(configuration, 'paymentAccount')
  resolved.push(
    ref(
      'PAYMENT_ACCOUNT',
      cashRequired,
      explicitPayment ? (input.paymentAccountId ? 'EXPLICIT' : 'DEFAULT') : 'UNRESOLVED',
      explicitPayment,
    ),
  )

  const seenComponents = new Set<string>()

  for (const adj of adjustments) {
    if (!isPositive(toDecimal(adj.amount)) || adj.isInformationOnly) continue
    const component = componentForAdjustment(adj)
    if (!component) continue

    const key = `${component}:${adj.lineNumber}`
    if (seenComponents.has(key)) continue
    seenComponents.add(key)

    const overrideKey = overrideKeyForComponent(component)
    let account: VendorPaymentAccountRef | null = null
    let source: VendorPaymentAccountSource = 'UNRESOLVED'

    if (adj.accountId) {
      account = { id: adj.accountId, code: 'LINE', name: adj.description }
      source = 'EXPLICIT'
    } else if (overrideKey) {
      account = pickOverride(configuration, overrideKey)
      if (account) source = 'DEFAULT'
    }

    // Prefer shared round-off debit/credit from same ROUNDING override if only one provided
    if (!account && (component === 'ROUND_OFF_DEBIT' || component === 'ROUND_OFF_CREDIT')) {
      account = pickOverride(configuration, 'roundOffDebit') ?? pickOverride(configuration, 'roundOffCredit')
      if (account) source = 'DEFAULT'
    }

    resolved.push(ref(component, true, source, account, adj.lineNumber, adj.id))
  }

  // Aggregate-level components when amounts exist but no per-line (shouldn't normally happen)
  const ensureAggregate = (component: VendorPaymentAccountComponent, amount: string) => {
    if (isZero(toDecimal(amount))) return
    if (resolved.some((r) => r.component === component)) return
    const overrideKey = overrideKeyForComponent(component)
    const account = overrideKey ? pickOverride(configuration, overrideKey) : null
    resolved.push(ref(component, true, account ? 'DEFAULT' : 'UNRESOLVED', account))
  }

  ensureAggregate('TDS_PAYABLE', totals.tdsAmount)
  ensureAggregate('DISCOUNT_RECEIVED', totals.discountAmount)
  ensureAggregate('RETENTION_PAYABLE', totals.retentionAmount)
  ensureAggregate('WITHHOLDING_PAYABLE', totals.withholdingAmount)
  ensureAggregate('BANK_CHARGE', totals.bankChargeAmount)
  ensureAggregate('PROCESSING_CHARGE', totals.processingChargeAmount)
  ensureAggregate('ROUND_OFF_DEBIT', totals.roundOffDebitAmount)
  ensureAggregate('ROUND_OFF_CREDIT', totals.roundOffCreditAmount)

  const missingComponents: string[] = []
  const invalidComponents: string[] = []

  for (const entry of resolved) {
    if (entry.isRequired && !entry.accountId) {
      missingComponents.push(entry.component)
      entry.isValid = false
      entry.issueCode = entry.issueCode ?? COMPONENT_ISSUE[entry.component] ?? VENDOR_PAYMENT_CALC_CODES.ACCOUNT_INVALID
      issues.push(
        calcError(entry.issueCode, entry.issueMessage ?? `${entry.component} account missing`, entry.component, {
          lineNumber: entry.lineNumber,
          adjustmentLineId: entry.adjustmentLineId,
        }),
      )
    } else if (!entry.isValid) {
      invalidComponents.push(entry.component)
    }
  }

  // Stable ordering
  const order: VendorPaymentAccountComponent[] = [
    'VENDOR_PAYABLE',
    'PAYMENT_ACCOUNT',
    'TDS_PAYABLE',
    'DISCOUNT_RECEIVED',
    'RETENTION_PAYABLE',
    'WITHHOLDING_PAYABLE',
    'BANK_CHARGE',
    'PROCESSING_CHARGE',
    'OTHER_ADJUSTMENT',
    'ROUND_OFF_DEBIT',
    'ROUND_OFF_CREDIT',
  ]
  resolved.sort((a, b) => {
    const ai = order.indexOf(a.component)
    const bi = order.indexOf(b.component)
    if (ai !== bi) return ai - bi
    return (a.lineNumber ?? 0) - (b.lineNumber ?? 0)
  })

  return {
    isReady: missingComponents.length === 0 && invalidComponents.length === 0,
    resolvedAccounts: resolved,
    missingComponents: [...new Set(missingComponents)],
    invalidComponents: [...new Set(invalidComponents)],
    issues,
  }
}

/** Mapping keys used when async DefaultAccountMapping lookup is added. */
export const VENDOR_PAYMENT_MAPPING_KEYS: Partial<Record<VendorPaymentAccountComponent, DefaultAccountMappingKey>> = {
  VENDOR_PAYABLE: 'VENDOR_PAYABLE',
  TDS_PAYABLE: 'TDS_PAYABLE',
  BANK_CHARGE: 'BANK_CHARGES',
  ROUND_OFF_DEBIT: 'ROUNDING',
  ROUND_OFF_CREDIT: 'ROUNDING',
}
