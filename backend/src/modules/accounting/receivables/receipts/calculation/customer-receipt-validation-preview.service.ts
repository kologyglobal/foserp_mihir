import { prisma } from '../../../../../config/database.js'
import { isMultiCurrencyEnabled } from '../../../posting/posting-currency.service.js'
import { toDecimal } from '../../../shared/finance-decimal.js'
import {
  findCustomerParty,
  requireActiveCustomerParty,
} from '../../customer-party/customer-party.service.js'
import {
  CustomerPartyNotFoundError,
  InactiveCustomerPartyError,
} from '../../customer-party/customer-party.errors.js'
import type {
  CustomerReceiptCalculationInput,
  CustomerReceiptValidationPreview,
  ReceiptValidationContext,
  ReceiptValidationIssue,
} from '../calculation/customer-receipt-calculation.types.js'
import { calculateCustomerReceipt } from '../calculation/customer-receipt-calculation.service.js'
import {
  RECEIPT_ERROR_CODES,
  RECEIPT_WARNING_CODES,
  receiptError,
  receiptWarning,
} from '../calculation/customer-receipt-calculation.errors.js'
import { buildCustomerReceiptPostingPreview } from '../calculation/receipt-posting-preview.service.js'
import { validateReceiptPaymentMethod } from '../validation/receipt-payment-method.validator.js'
import { checkReceiptAccountReadiness } from '../validation/receipt-account-readiness.service.js'
import { resolveReceiptDateReadiness } from '../validation/receipt-date-readiness.service.js'
import { validateReceiptAllocationReadiness } from '../validation/receipt-allocation-readiness.service.js'

function emptyAccountReadiness(): CustomerReceiptValidationPreview['accountReadiness'] {
  const empty = {
    mappingKey: '',
    required: false,
    configured: false,
    accountId: null,
    accountCode: null,
    accountName: null,
    valid: true,
    issues: [] as ReceiptValidationIssue[],
  }
  return {
    bankCash: { ...empty, mappingKey: 'BANK_CASH' },
    customerReceivable: { ...empty, mappingKey: 'CUSTOMER_RECEIVABLE' },
    customerTds: { ...empty, mappingKey: 'TDS_RECEIVABLE' },
    bankCharges: [],
    otherDeductions: [],
  }
}

/**
 * Side-effect-free receipt validation preview.
 * Reads customer, accounts, settings, periods, invoices — writes nothing.
 */
export async function validateReceiptInput(
  input: CustomerReceiptCalculationInput,
  context: ReceiptValidationContext,
): Promise<CustomerReceiptValidationPreview> {
  const errors: ReceiptValidationIssue[] = []
  const warnings: ReceiptValidationIssue[] = []
  const tenantId = context.tenantId || input.tenantId

  // Customer readiness
  let customerReadiness: CustomerReceiptValidationPreview['customerReadiness'] = {
    found: false,
    active: false,
  }
  let customerName: string | null = context.customerNameSnapshot ?? null

  try {
    const party = await requireActiveCustomerParty(tenantId, input.customerId)
    customerReadiness = {
      found: true,
      active: true,
      customerId: party.id,
      customerName: party.name,
    }
    customerName = party.name
    if (!party.gstin) {
      warnings.push(
        receiptWarning(RECEIPT_WARNING_CODES.CUSTOMER_GSTIN_MISSING, 'Customer GSTIN is not set', 'customerId'),
      )
    }
    if (!party.pan) {
      warnings.push(
        receiptWarning(RECEIPT_WARNING_CODES.CUSTOMER_PAN_MISSING, 'Customer PAN is not set', 'customerId'),
      )
    }
  } catch (e) {
    if (e instanceof CustomerPartyNotFoundError) {
      errors.push(
        receiptError(RECEIPT_ERROR_CODES.RECEIPT_CUSTOMER_NOT_FOUND, e.message, 'customerId'),
      )
    } else if (e instanceof InactiveCustomerPartyError) {
      errors.push(
        receiptError(RECEIPT_ERROR_CODES.RECEIPT_CUSTOMER_INACTIVE, e.message, 'customerId'),
      )
      const party = await findCustomerParty(tenantId, input.customerId)
      customerReadiness = {
        found: party != null,
        active: false,
        customerId: party?.id,
        customerName: party?.name,
      }
      customerName = party?.name ?? null
    } else {
      throw e
    }
  }

  // Multi-currency feature
  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId, legalEntityId: input.legalEntityId },
  })
  const baseCurrencyCode = settings?.baseCurrency ?? 'INR'
  const multiCurrencyEnabled = await isMultiCurrencyEnabled(tenantId, input.legalEntityId)

  // Pure calculation (with feature flag)
  const calculation = calculateCustomerReceipt(input, {
    baseCurrencyCode,
    multiCurrencyEnabled,
    maxTdsPercentage: context.maxTdsPercentage,
    allowCustomTdsRates: context.allowCustomTdsRates,
    customerNameSnapshot: customerName,
  })
  errors.push(...calculation.errors)
  warnings.push(...calculation.warnings)

  // Payment method
  const paymentMethodReadiness = validateReceiptPaymentMethod(input)
  for (const issue of paymentMethodReadiness.issues) {
    if (issue.severity === 'ERROR') errors.push(issue)
    else warnings.push(issue)
  }

  // Accounts
  const accountReadiness = await checkReceiptAccountReadiness(
    tenantId,
    input.legalEntityId,
    input,
    calculation,
  )
  for (const item of [
    accountReadiness.bankCash,
    accountReadiness.customerReceivable,
    accountReadiness.customerTds,
    ...accountReadiness.bankCharges,
    ...accountReadiness.otherDeductions,
  ]) {
    for (const issue of item.issues) {
      if (issue.severity === 'ERROR') errors.push(issue)
      else warnings.push(issue)
    }
  }

  // Dates / period
  const period = await resolveReceiptDateReadiness(tenantId, input.legalEntityId, {
    receiptDate: input.receiptDate,
    postingDate: input.postingDate,
    valueDate: input.valueDate,
    instrumentDate: input.instrumentDate,
  })
  for (const issue of period.issues) {
    if (issue.severity === 'ERROR') errors.push(issue)
    else warnings.push(issue)
  }

  // Allocation readiness (DB)
  const allocation = await validateReceiptAllocationReadiness(
    tenantId,
    input.legalEntityId,
    input,
    calculation,
  )
  for (const issue of allocation.issues) {
    if (issue.severity === 'ERROR') errors.push(issue)
    else warnings.push(issue)
  }

  // Rebuild posting preview with resolved accounts
  const postingBuilt = buildCustomerReceiptPostingPreview({
    bankCashAmount: toDecimal(calculation.bankCashAmount),
    customerTdsAmount: toDecimal(calculation.customerTdsAmount),
    bankChargeAmount: toDecimal(calculation.bankChargeAmount),
    otherDeductionAmount: toDecimal(calculation.otherDeductionAmount),
    grossReceiptAmount: toDecimal(calculation.grossReceiptAmount),
    exchangeRate: toDecimal(calculation.exchangeRate),
    customerId: input.customerId,
    customerNameSnapshot: customerName,
    accounts: accountReadiness.resolved,
    bankChargeRows: calculation.bankChargeSummary,
    otherDeductionRows: calculation.otherDeductionSummary,
    tdsSummary: calculation.tdsSummary
      ? {
          ...calculation.tdsSummary,
          accountId: accountReadiness.resolved.customerTdsAccountId,
        }
      : null,
  })
  for (const issue of postingBuilt.errors) {
    // Avoid duplicating unbalanced errors already present from pure calc when accounts missing
    if (!errors.some((e) => e.code === issue.code && e.message === issue.message)) {
      errors.push(issue)
    }
  }

  const enrichedCalculation = {
    ...calculation,
    allocationPreview: allocation.allocationPreview.length
      ? allocation.allocationPreview
      : calculation.allocationPreview,
    postingPreview: postingBuilt.preview,
    // Recompute valid after enrichment — use aggregated errors
    valid: errors.length === 0,
    errors,
    warnings,
  }

  return {
    valid: errors.length === 0,
    calculation: enrichedCalculation,
    errors,
    warnings,
    customerReadiness,
    accountReadiness: {
      bankCash: accountReadiness.bankCash,
      customerReceivable: accountReadiness.customerReceivable,
      customerTds: accountReadiness.customerTds,
      bankCharges: accountReadiness.bankCharges,
      otherDeductions: accountReadiness.otherDeductions,
    },
    paymentMethodReadiness: {
      paymentMethod: paymentMethodReadiness.paymentMethod,
      valid: paymentMethodReadiness.valid,
      missingFields: paymentMethodReadiness.missingFields,
    },
    currencyReadiness: {
      currencyCode: calculation.currencyCode,
      baseCurrencyCode,
      exchangeRate: calculation.exchangeRate,
      multiCurrencyEnabled,
    },
    periodReadiness: {
      financialYearResolved: period.financialYearResolved,
      accountingPeriodResolved: period.accountingPeriodResolved,
      periodStatus: period.periodStatus,
      financialYearId: period.financialYearId,
      periodId: period.periodId,
    },
    allocationReadiness: {
      proposedAllocationCount: allocation.proposedAllocationCount,
      validAllocationCount: allocation.validAllocationCount,
      invalidAllocationCount: allocation.invalidAllocationCount,
      totalProposedAllocation: allocation.totalProposedAllocation,
      unallocatedAmount: allocation.unallocatedAmount,
    },
    postingPreview: postingBuilt.preview,
  }
}

/** Exported for tests — confirms empty readiness shape exists. */
export const __testOnly = { emptyAccountReadiness }
