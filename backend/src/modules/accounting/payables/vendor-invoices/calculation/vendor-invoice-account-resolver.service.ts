/**
 * Vendor invoice account resolver (Phase 4A2).
 *
 * Resolves the GL account for every posting slot ("component") a vendor invoice will need,
 * in priority order: explicit `configuration.accounts` / line `debitAccountId` override →
 * tenant `DefaultAccountMapping` → unresolved.
 *
 * `buildRequiredAccountComponents` is pure/sync (override-only) — reused directly by the
 * sync calculation helper for tests/pure previews. `resolveVendorInvoiceAccounts` wraps it
 * and layers on DB-backed default-mapping lookups + account validation.
 */
import type { Account, DefaultAccountMappingKey, TdsRecognitionMode } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { add, divide, isPositive, isZero, multiply, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import { formatDecimal4 } from './vendor-invoice-decimal.js'
import { calcError, VENDOR_INVOICE_CALC_CODES } from './vendor-invoice-calculation.errors.js'
import type { VendorInvoiceAmountsCalculationResult } from './vendor-invoice-amounts.service.js'
import type {
  VendorInvoiceAccountComponent,
  VendorInvoiceAccountReadiness,
  VendorInvoiceAccountSource,
  VendorInvoiceCalculationConfiguration,
  VendorInvoiceCalculationTotals,
  VendorInvoiceResolvedAccount,
} from './vendor-invoice-calculation.types.js'

const ZERO = toDecimal(0)

/** No default-mapping key exists for these components (CESS input credit / RCM payables) — override-only. */
const DEFAULT_MAPPING_BY_COMPONENT: Partial<Record<VendorInvoiceAccountComponent, DefaultAccountMappingKey>> = {
  LINE_DEBIT: 'PURCHASE',
  INPUT_CGST: 'GST_INPUT_CGST',
  INPUT_SGST: 'GST_INPUT_SGST',
  INPUT_IGST: 'GST_INPUT_IGST',
  VENDOR_PAYABLE: 'VENDOR_PAYABLE',
  TDS_PAYABLE: 'TDS_PAYABLE',
  FREIGHT: 'FREIGHT_INWARD',
  /** No dedicated mapping key — fall back to PURCHASE for other purchase charges. */
  OTHER_CHARGE: 'PURCHASE',
  ROUND_OFF: 'ROUNDING',
}

export interface RecoverableInputTaxByComponent {
  cgst: string
  sgst: string
  igst: string
  cess: string
}

/**
 * The calculation core tracks recoverable/non-recoverable tax as a single aggregate (per line and
 * at header level) rather than split per CGST/SGST/IGST/CESS. For the accounting preview we need a
 * per-component recoverable figure, so we allocate the header non-recoverable aggregate across the
 * four tax components proportionally to their gross share — remainder goes to the largest component
 * so the four figures always sum exactly to (gross − non-recoverable).
 */
export function computeRecoverableInputTaxByComponent(totals: VendorInvoiceCalculationTotals): RecoverableInputTaxByComponent {
  const cgst = toDecimal(totals.inputCgstAmount)
  const sgst = toDecimal(totals.inputSgstAmount)
  const igst = toDecimal(totals.inputIgstAmount)
  const cess = toDecimal(totals.inputCessAmount)
  const nonRecoverable = toDecimal(totals.nonRecoverableTaxAmount)
  const gross = add(add(cgst, sgst), add(igst, cess))

  if (isZero(gross)) {
    return { cgst: '0.0000', sgst: '0.0000', igst: '0.0000', cess: '0.0000' }
  }

  const recoverableTotal = subtract(gross, nonRecoverable)
  if (!isPositive(recoverableTotal)) {
    return { cgst: '0.0000', sgst: '0.0000', igst: '0.0000', cess: '0.0000' }
  }
  if (recoverableTotal.gte(gross)) {
    return { cgst: formatDecimal4(cgst), sgst: formatDecimal4(sgst), igst: formatDecimal4(igst), cess: formatDecimal4(cess) }
  }

  const factor = divide(recoverableTotal, gross)
  const allocation = [
    { key: 'cgst' as const, gross: cgst, share: toDecimal(formatDecimal4(multiply(cgst, factor))) },
    { key: 'sgst' as const, gross: sgst, share: toDecimal(formatDecimal4(multiply(sgst, factor))) },
    { key: 'igst' as const, gross: igst, share: toDecimal(formatDecimal4(multiply(igst, factor))) },
    { key: 'cess' as const, gross: cess, share: toDecimal(formatDecimal4(multiply(cess, factor))) },
  ]

  const allocated = allocation.reduce((sum, a) => add(sum, a.share), ZERO)
  const remainder = subtract(recoverableTotal, allocated)
  if (!isZero(remainder)) {
    const largest = allocation.reduce((max, a) => (a.gross.gt(max.gross) ? a : max), allocation[0]!)
    largest.share = add(largest.share, remainder)
  }

  const result: Record<'cgst' | 'sgst' | 'igst' | 'cess', string> = { cgst: '0.0000', sgst: '0.0000', igst: '0.0000', cess: '0.0000' }
  for (const a of allocation) result[a.key] = formatDecimal4(a.share)
  return result as RecoverableInputTaxByComponent
}

function componentRef(
  component: VendorInvoiceAccountComponent,
  lineNumber: number | null,
  isRequired: boolean,
  source: VendorInvoiceAccountSource,
  accountId: string | null,
  accountCode: string | null,
  accountName: string | null,
): VendorInvoiceResolvedAccount {
  return {
    component,
    lineNumber,
    isRequired,
    source,
    accountId,
    accountCode,
    accountName,
    isValid: accountId != null || !isRequired,
    issueCode: null,
    issueMessage: null,
  }
}

export interface BuildRequiredAccountComponentsParams {
  amountsResult: VendorInvoiceAmountsCalculationResult
  configuration: VendorInvoiceCalculationConfiguration | undefined
  tdsMode: TdsRecognitionMode | undefined
}

/**
 * Override-only, synchronous resolution — every required GL slot for this invoice, using only
 * `configuration.accounts` (header) and per-line `debitAccountId` (already resolved onto
 * `amountsResult.lines[].debitAccountId`). Anything not covered by an override comes back
 * UNRESOLVED; `resolveVendorInvoiceAccounts` upgrades those via DefaultAccountMapping lookups.
 */
export function buildRequiredAccountComponents(params: BuildRequiredAccountComponentsParams): VendorInvoiceResolvedAccount[] {
  const { amountsResult, configuration, tdsMode } = params
  const overrides = configuration?.accounts ?? {}
  const totals = amountsResult.totals
  const results: VendorInvoiceResolvedAccount[] = []

  const headerDebitOverride = overrides.purchaseOrDebit ?? null
  for (const line of amountsResult.lines) {
    const debitNeeded = add(toDecimal(line.taxableAmount), toDecimal(line.nonRecoverableTaxAmount))
    if (isZero(debitNeeded)) continue

    if (line.debitAccountId) {
      results.push(componentRef('LINE_DEBIT', line.lineNumber, true, 'LINE_OVERRIDE', line.debitAccountId, null, null))
    } else if (headerDebitOverride) {
      results.push(
        componentRef('LINE_DEBIT', line.lineNumber, true, 'EXPLICIT', headerDebitOverride.id, headerDebitOverride.code, headerDebitOverride.name),
      )
    } else {
      results.push(componentRef('LINE_DEBIT', line.lineNumber, true, 'UNRESOLVED', null, null, null))
    }
  }

  const recoverable = computeRecoverableInputTaxByComponent(totals)
  const inputTaxComponents: Array<{ component: VendorInvoiceAccountComponent; amount: string; override: typeof overrides.inputCgst }> = [
    { component: 'INPUT_CGST', amount: recoverable.cgst, override: overrides.inputCgst ?? null },
    { component: 'INPUT_SGST', amount: recoverable.sgst, override: overrides.inputSgst ?? null },
    { component: 'INPUT_IGST', amount: recoverable.igst, override: overrides.inputIgst ?? null },
    { component: 'INPUT_CESS', amount: recoverable.cess, override: overrides.inputCess ?? null },
  ]
  for (const { component, amount, override } of inputTaxComponents) {
    if (isZero(amount)) continue
    if (override) {
      results.push(componentRef(component, null, true, 'EXPLICIT', override.id, override.code, override.name))
    } else {
      results.push(componentRef(component, null, true, 'UNRESOLVED', null, null, null))
    }
  }

  const vendorPayableOverride = overrides.vendorPayable ?? null
  results.push(
    vendorPayableOverride
      ? componentRef('VENDOR_PAYABLE', null, true, 'EXPLICIT', vendorPayableOverride.id, vendorPayableOverride.code, vendorPayableOverride.name)
      : componentRef('VENDOR_PAYABLE', null, true, 'UNRESOLVED', null, null, null),
  )

  const tdsRequired = tdsMode === 'AT_INVOICE' && isPositive(totals.tdsAmount)
  if (tdsRequired) {
    const tdsOverride = overrides.tdsPayable ?? null
    results.push(
      tdsOverride
        ? componentRef('TDS_PAYABLE', null, true, 'EXPLICIT', tdsOverride.id, tdsOverride.code, tdsOverride.name)
        : componentRef('TDS_PAYABLE', null, true, 'UNRESOLVED', null, null, null),
    )
  }

  if (!isZero(totals.freightAmount)) {
    const freightOverride = overrides.freight ?? null
    results.push(
      freightOverride
        ? componentRef('FREIGHT', null, true, 'EXPLICIT', freightOverride.id, freightOverride.code, freightOverride.name)
        : componentRef('FREIGHT', null, true, 'UNRESOLVED', null, null, null),
    )
  }

  if (!isZero(totals.otherChargeAmount)) {
    const otherChargeOverride = overrides.otherCharge ?? null
    results.push(
      otherChargeOverride
        ? componentRef('OTHER_CHARGE', null, true, 'EXPLICIT', otherChargeOverride.id, otherChargeOverride.code, otherChargeOverride.name)
        : componentRef('OTHER_CHARGE', null, true, 'UNRESOLVED', null, null, null),
    )
  }

  if (!isZero(totals.roundOffAmount)) {
    const roundOffOverride = overrides.roundOff ?? null
    results.push(
      roundOffOverride
        ? componentRef('ROUND_OFF', null, true, 'EXPLICIT', roundOffOverride.id, roundOffOverride.code, roundOffOverride.name)
        : componentRef('ROUND_OFF', null, true, 'UNRESOLVED', null, null, null),
    )
  }

  if (amountsResult.isRcm) {
    const rcm = amountsResult.rcmTaxTotals
    const rcmComponents: Array<{ component: VendorInvoiceAccountComponent; amount: string; override: typeof overrides.rcmCgstPayable }> = [
      { component: 'RCM_CGST_PAYABLE', amount: rcm.cgstAmount, override: overrides.rcmCgstPayable ?? null },
      { component: 'RCM_SGST_PAYABLE', amount: rcm.sgstAmount, override: overrides.rcmSgstPayable ?? null },
      { component: 'RCM_IGST_PAYABLE', amount: rcm.igstAmount, override: overrides.rcmIgstPayable ?? null },
    ]
    for (const { component, amount, override } of rcmComponents) {
      if (isZero(amount)) continue
      results.push(
        override
          ? componentRef(component, null, true, 'EXPLICIT', override.id, override.code, override.name)
          : componentRef(component, null, true, 'UNRESOLVED', null, null, null),
      )
    }
  }

  return results
}

function issueForUnresolved(entry: VendorInvoiceResolvedAccount): { code: string; message: string } {
  if (entry.component === 'LINE_DEBIT') {
    return {
      code: VENDOR_INVOICE_CALC_CODES.ACCOUNT_NOT_CONFIGURED,
      message: `No debit/expense account resolved for line ${entry.lineNumber ?? '?'}`,
    }
  }
  return {
    code: VENDOR_INVOICE_CALC_CODES.ACCOUNT_NOT_CONFIGURED,
    message: `No account configured for ${entry.component}`,
  }
}

async function validateResolvedAccounts(
  tenantId: string,
  legalEntityId: string,
  entries: VendorInvoiceResolvedAccount[],
): Promise<void> {
  const idsToValidate = [...new Set(entries.filter((e) => e.accountId != null).map((e) => e.accountId as string))]
  const accountsById = new Map<string, Account>()
  if (idsToValidate.length > 0) {
    const rows = await prisma.account.findMany({ where: { id: { in: idsToValidate }, tenantId, legalEntityId } })
    for (const row of rows) accountsById.set(row.id, row)
  }

  for (const entry of entries) {
    if (!entry.accountId) {
      if (entry.isRequired) {
        const issue = issueForUnresolved(entry)
        entry.isValid = false
        entry.issueCode = issue.code
        entry.issueMessage = issue.message
      } else {
        entry.isValid = true
      }
      continue
    }

    const account = accountsById.get(entry.accountId)
    if (!account) {
      entry.isValid = false
      entry.issueCode = VENDOR_INVOICE_CALC_CODES.ACCOUNT_NOT_FOUND
      entry.issueMessage = `Account ${entry.accountId} not found in this legal entity`
      continue
    }

    entry.accountCode = account.accountCode
    entry.accountName = account.accountName

    if (account.isGroup) {
      entry.isValid = false
      entry.issueCode = VENDOR_INVOICE_CALC_CODES.ACCOUNT_IS_GROUP
      entry.issueMessage = `Account ${account.accountCode} is a group account and cannot be posted to`
      continue
    }
    if (!account.isActive) {
      entry.isValid = false
      entry.issueCode = VENDOR_INVOICE_CALC_CODES.ACCOUNT_INACTIVE
      entry.issueMessage = `Account ${account.accountCode} is inactive`
      continue
    }

    entry.isValid = true
    entry.issueCode = null
    entry.issueMessage = null
  }
}

export interface ResolveVendorInvoiceAccountsParams {
  tenantId: string
  legalEntityId: string
  amountsResult: VendorInvoiceAmountsCalculationResult
  input: { configuration?: VendorInvoiceCalculationConfiguration; tdsRecognitionMode?: TdsRecognitionMode }
  tdsMode?: TdsRecognitionMode
  includeDbLookups: boolean
}

export async function resolveVendorInvoiceAccounts(params: ResolveVendorInvoiceAccountsParams): Promise<VendorInvoiceAccountReadiness> {
  const tdsMode = params.tdsMode ?? params.input.tdsRecognitionMode
  const resolved = buildRequiredAccountComponents({
    amountsResult: params.amountsResult,
    configuration: params.input.configuration,
    tdsMode,
  })

  if (params.includeDbLookups) {
    const unresolvedWithMapping = resolved.filter((e) => e.source === 'UNRESOLVED' && DEFAULT_MAPPING_BY_COMPONENT[e.component])
    const mappingKeys = [...new Set(unresolvedWithMapping.map((e) => DEFAULT_MAPPING_BY_COMPONENT[e.component] as DefaultAccountMappingKey))]

    if (mappingKeys.length > 0) {
      const mappings = await prisma.defaultAccountMapping.findMany({
        where: { tenantId: params.tenantId, legalEntityId: params.legalEntityId, mappingKey: { in: mappingKeys } },
        include: { account: true },
      })
      const mappingByKey = new Map(mappings.map((m) => [m.mappingKey, m.account]))

      for (const entry of unresolvedWithMapping) {
        const mappingKey = DEFAULT_MAPPING_BY_COMPONENT[entry.component]!
        const account = mappingByKey.get(mappingKey)
        if (account) {
          entry.source = 'DEFAULT_MAPPING'
          entry.accountId = account.id
          entry.accountCode = account.accountCode
          entry.accountName = account.accountName
        }
      }
    }

    await validateResolvedAccounts(params.tenantId, params.legalEntityId, resolved)
    return finalizeAccountReadiness(resolved)
  }

  return finalizeAccountReadiness(resolved)
}

/**
 * Marks any still-unresolved required component as invalid (with an issue) and derives overall
 * readiness. Pure/sync — shared by the DB-free override-only path and the sync test helper.
 */
export function finalizeAccountReadiness(resolved: VendorInvoiceResolvedAccount[]): VendorInvoiceAccountReadiness {
  for (const entry of resolved) {
    if (!entry.accountId && entry.isRequired) {
      const issue = issueForUnresolved(entry)
      entry.isValid = false
      entry.issueCode = issue.code
      entry.issueMessage = issue.message
    }
  }

  const issues = resolved
    .filter((e) => e.isRequired && !e.isValid)
    .map((e) => calcError(e.issueCode ?? VENDOR_INVOICE_CALC_CODES.ACCOUNT_NOT_CONFIGURED, e.issueMessage ?? `Account not resolved for ${e.component}`, e.component))

  return {
    isReady: resolved.every((e) => !e.isRequired || e.isValid),
    resolvedAccounts: resolved,
    issues,
  }
}
