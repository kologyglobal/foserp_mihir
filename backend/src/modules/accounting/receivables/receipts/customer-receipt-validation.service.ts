import type { CustomerReceiptCalculationInput } from './calculation/customer-receipt-calculation.types.js'
import type { CreateCustomerReceiptInput, UpdateCustomerReceiptInput } from './customer-receipt.schemas.js'
import type { CustomerReceiptCalculationContext, CustomerReceiptWithDeductions } from './customer-receipt.types.js'

/** Build the pure calculation input from a create/update request body. */
export function buildCalculationInputFromRequest(
  input: (CreateCustomerReceiptInput | UpdateCustomerReceiptInput) & { legalEntityId?: string },
  tenantId: string,
): CustomerReceiptCalculationInput {
  return {
    tenantId,
    legalEntityId: input.legalEntityId ?? '',
    branchId: input.branchId ?? null,
    customerId: input.customerId,
    receiptDate: input.receiptDate,
    postingDate: input.postingDate,
    valueDate: input.valueDate ?? null,
    paymentMethod: input.paymentMethod,
    currencyCode: input.currencyCode,
    exchangeRate: input.exchangeRate,
    bankCashAmount: input.bankCashAmount,
    customerTds: input.customerTds ?? null,
    bankCharges: input.bankCharges ?? null,
    otherDeductions: input.otherDeductions ?? null,
    bankCashAccountId: input.bankCashAccountId,
    customerReceivableAccountId: input.customerReceivableAccountId ?? null,
    instrumentNumber: input.instrumentNumber ?? null,
    instrumentDate: input.instrumentDate ?? null,
    bankReference: input.bankReference ?? null,
    transactionReference: input.transactionReference ?? null,
    narration: input.narration ?? null,
    proposedAllocations: null,
  }
}

/** Commercial + TDS fields persisted as JSON on the header for recalculation without trusting client totals. */
export function buildCalculationContextFromRequest(
  input: CreateCustomerReceiptInput | UpdateCustomerReceiptInput,
): CustomerReceiptCalculationContext {
  return {
    sourceType: input.sourceType,
    sourceDocumentId: input.sourceDocumentId ?? null,
    sourceDocumentNumber: input.sourceDocumentNumber ?? null,
    paymentMethod: input.paymentMethod,
    currencyCode: input.currencyCode,
    exchangeRate: input.exchangeRate,
    bankCashAmount: input.bankCashAmount,
    bankCashAccountId: input.bankCashAccountId,
    customerReceivableAccountId: input.customerReceivableAccountId ?? null,
    customerTds: input.customerTds ?? null,
    bankCharges: input.bankCharges ?? null,
    otherDeductions: input.otherDeductions ?? null,
    instrumentNumber: input.instrumentNumber ?? null,
    instrumentDate: input.instrumentDate ?? null,
    bankReference: input.bankReference ?? null,
    transactionReference: input.transactionReference ?? null,
    narration: input.narration ?? null,
    notes: input.notes ?? null,
    valueDate: input.valueDate ?? null,
  }
}

export function parseCalculationContext(value: unknown): CustomerReceiptCalculationContext | null {
  if (!value || typeof value !== 'object') return null
  return value as CustomerReceiptCalculationContext
}

function toDateOnlyString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

/** Rebuild the pure calculation input from a persisted receipt header + its stored calculationContext. */
export function buildCalculationInputFromStoredReceipt(
  receipt: CustomerReceiptWithDeductions,
  tenantId: string,
): CustomerReceiptCalculationInput | null {
  const context = parseCalculationContext(receipt.calculationContext)
  if (!context) return null
  return {
    tenantId,
    legalEntityId: receipt.legalEntityId,
    branchId: receipt.branchId,
    customerId: receipt.customerId,
    receiptDate: toDateOnlyString(receipt.receiptDate)!,
    postingDate: toDateOnlyString(receipt.postingDate) ?? toDateOnlyString(receipt.receiptDate)!,
    valueDate: context.valueDate ?? toDateOnlyString(receipt.valueDate),
    paymentMethod: context.paymentMethod,
    currencyCode: context.currencyCode,
    exchangeRate: context.exchangeRate,
    bankCashAmount: context.bankCashAmount,
    customerTds: context.customerTds ?? null,
    bankCharges: context.bankCharges ?? null,
    otherDeductions: context.otherDeductions ?? null,
    bankCashAccountId: context.bankCashAccountId ?? null,
    customerReceivableAccountId: context.customerReceivableAccountId ?? null,
    instrumentNumber: context.instrumentNumber ?? null,
    instrumentDate: context.instrumentDate ?? null,
    bankReference: context.bankReference ?? null,
    transactionReference: context.transactionReference ?? null,
    narration: context.narration ?? null,
    proposedAllocations: null,
  }
}
