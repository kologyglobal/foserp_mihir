import type { CrmQuotation, CrmQuotationDocument } from '@prisma/client'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import type { QuotationApprovalEntryDto } from './quotation.types.js'
import type { UpdateQuotationDocumentInput, UpdateQuotationInput } from './quotation.validation.js'
import {
  adjustmentsFromDocumentFields,
  calcOrderDocumentTotals,
} from './orderAdjustmentsCalc.js'

/**
 * Quotation document lifecycle (enforced):
 * draft → pending_approval → approved → sent → (customerApproval) → converted
 *
 * Send / internal approval / customer approval are optional. Convert-to-SO may run
 * from draft onward once commercial content is valid (see quotation.convert.ts).
 *
 * customerApproval is independent of document status and is set only via
 * dedicated customer-approve / customer-reject routes when that optional path is used.
 * customer-approve / customer-reject after the document is sent.
 */

/** Header fields that must only change via dedicated lifecycle endpoints. */
const QUOTATION_WORKFLOW_ONLY_FIELDS = ['status', 'customerApproval'] as const

/** Document fields that must only change via dedicated lifecycle endpoints. */
const QUOTATION_DOCUMENT_WORKFLOW_ONLY_FIELDS = ['status'] as const

/**
 * Reject lifecycle fields on generic PATCH — mirror opportunity sanitize pattern.
 * Approval / send / customer decision / convert must use dedicated routes.
 */
export function sanitizeQuotationUpdateInput(
  quotation: CrmQuotation,
  input: UpdateQuotationInput,
): UpdateQuotationInput {
  if (quotation.deletedAt) {
    throw new InvalidStateError('Deleted quotation cannot be updated')
  }

  for (const key of QUOTATION_WORKFLOW_ONLY_FIELDS) {
    if (key in input && input[key as keyof UpdateQuotationInput] !== undefined) {
      throw new ValidationError(
        `Field "${key}" cannot be changed via update — use the dedicated workflow action`,
      )
    }
  }

  return input
}

export function sanitizeQuotationDocumentUpdateInput(
  doc: CrmQuotationDocument,
  input: UpdateQuotationDocumentInput,
): UpdateQuotationDocumentInput {
  assertDocumentEditable(doc)

  for (const key of QUOTATION_DOCUMENT_WORKFLOW_ONLY_FIELDS) {
    if (key in input && input[key as keyof UpdateQuotationDocumentInput] !== undefined) {
      throw new ValidationError(
        `Field "${key}" cannot be changed via update — use the dedicated workflow action`,
      )
    }
  }

  return input
}

export function assertDocumentEditable(doc: CrmQuotationDocument): void {
  if (doc.locked && doc.status !== 'draft' && doc.status !== 'rejected') {
    throw new InvalidStateError('Quotation document is locked')
  }
}

export function assertDocumentSubmittable(doc: CrmQuotationDocument): void {
  if (doc.locked && doc.status !== 'draft' && doc.status !== 'rejected') {
    throw new InvalidStateError('Quotation document is locked')
  }
  if (doc.status !== 'draft' && doc.status !== 'rejected') {
    throw new InvalidStateError(`Cannot submit document in status ${doc.status}`)
  }
}

/** Internal approval — only from pending_approval (submit first). */
export function assertDocumentApprovable(doc: CrmQuotationDocument): void {
  if (doc.status !== 'pending_approval') {
    throw new InvalidStateError(`Cannot approve document in status ${doc.status}`)
  }
}

export function assertDocumentRejectable(doc: CrmQuotationDocument): void {
  if (doc.status !== 'pending_approval') {
    throw new InvalidStateError(`Cannot reject document in status ${doc.status}`)
  }
}

/** Send to customer — only after internal approval. */
export function assertDocumentSendable(doc: CrmQuotationDocument): void {
  if (doc.status !== 'approved') {
    throw new InvalidStateError(
      `Send to customer is only allowed after internal approval — current status is ${doc.status}`,
    )
  }
}

/** Customer decision — only after the quotation has been sent. */
export function assertDocumentCustomerApprovable(
  doc: CrmQuotationDocument,
  quotation: { customerApproval: string; status: string },
): void {
  if (doc.status !== 'sent') {
    throw new InvalidStateError(
      `Customer approval is only allowed after send — current status is ${doc.status}`,
    )
  }
  if (quotation.customerApproval !== 'pending') {
    throw new InvalidStateError(
      `Customer approval already recorded as ${quotation.customerApproval}`,
    )
  }
}

/** Soft-delete is allowed only while the quotation header is still Draft. */
export function assertQuotationDeletable(quotation: { status: string }): void {
  if (quotation.status !== 'draft') {
    throw new InvalidStateError(
      `Only draft quotations can be deleted — current status is ${quotation.status}`,
    )
  }
}

export function appendApprovalHistory(
  doc: CrmQuotationDocument,
  action: QuotationApprovalEntryDto['action'],
  userId: string,
  userName: string,
  remarks?: string | null,
): QuotationApprovalEntryDto[] {
  const history = Array.isArray(doc.approvalHistory) ? (doc.approvalHistory as unknown as QuotationApprovalEntryDto[]) : []
  return [
    ...history,
    {
      id: crypto.randomUUID(),
      action,
      byId: userId,
      byName: userName,
      at: new Date().toISOString(),
      remarks: remarks ?? null,
    },
  ]
}

export function calcDocumentTotal(
  priceLines: Array<{ qty?: number; unitPrice?: number; discountPct?: number; taxPct?: number; lineTotal?: number }>,
  freightAmount: number,
  installationAmount: number,
  customCharges: number,
  opts?: {
    orderDiscountCalcType?: string
    orderDiscountValue?: number
    freightCalcType?: string
    freightValue?: number
    freightIsTaxable?: boolean
    freightTaxRate?: number
    installationCalcType?: string
    installationValue?: number
    installationIsTaxable?: boolean
    installationTaxRate?: number
    customChargesCalcType?: string
    customChargesValue?: number
    customChargesIsTaxable?: boolean
    customChargesTaxRate?: number
  },
): number {
  const lines = priceLines.map((l) => ({
    qty: Number(l.qty ?? 0),
    unitPrice: Number(l.unitPrice ?? 0),
    discountPct: Number(l.discountPct ?? 0),
    taxPct: Number(l.taxPct ?? 0),
  }))
  const hasLineBases = lines.some((l) => l.qty > 0 || l.unitPrice > 0)
  if (!hasLineBases) {
    const linesTotal = priceLines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0)
    return linesTotal + freightAmount + installationAmount + customCharges
  }
  const totals = calcOrderDocumentTotals(
    lines,
    adjustmentsFromDocumentFields({
      freightAmount,
      installationAmount,
      customCharges,
      ...opts,
      freightValue: opts?.freightValue ?? freightAmount,
      installationValue: opts?.installationValue ?? installationAmount,
      customChargesValue: opts?.customChargesValue ?? customCharges,
    }),
  )
  return totals.grandTotal
}

/** Compute persisted charge rows + grand total from lines and document adjustment fields. */
export function resolveDocumentCharges(
  priceLines: Array<{ qty?: number; unitPrice?: number; discountPct?: number; taxPct?: number }>,
  fields: {
    freightAmount?: number
    installationAmount?: number
    customCharges?: number
    orderDiscountCalcType?: string
    orderDiscountValue?: number
    freightCalcType?: string
    freightValue?: number
    freightIsTaxable?: boolean
    freightTaxRate?: number
    installationCalcType?: string
    installationValue?: number
    installationIsTaxable?: boolean
    installationTaxRate?: number
    customChargesCalcType?: string
    customChargesValue?: number
    customChargesIsTaxable?: boolean
    customChargesTaxRate?: number
  },
) {
  const lines = priceLines.map((l) => ({
    qty: Number(l.qty ?? 0),
    unitPrice: Number(l.unitPrice ?? 0),
    discountPct: Number(l.discountPct ?? 0),
    taxPct: Number(l.taxPct ?? 0),
  }))
  const bundle = adjustmentsFromDocumentFields({
    freightAmount: fields.freightAmount ?? 0,
    installationAmount: fields.installationAmount ?? 0,
    customCharges: fields.customCharges ?? 0,
    orderDiscountCalcType: fields.orderDiscountCalcType,
    orderDiscountValue: fields.orderDiscountValue,
    freightCalcType: fields.freightCalcType,
    freightValue: fields.freightValue ?? fields.freightAmount ?? 0,
    freightIsTaxable: fields.freightIsTaxable,
    freightTaxRate: fields.freightTaxRate,
    installationCalcType: fields.installationCalcType,
    installationValue: fields.installationValue ?? fields.installationAmount ?? 0,
    installationIsTaxable: fields.installationIsTaxable,
    installationTaxRate: fields.installationTaxRate,
    customChargesCalcType: fields.customChargesCalcType,
    customChargesValue: fields.customChargesValue ?? fields.customCharges ?? 0,
    customChargesIsTaxable: fields.customChargesIsTaxable,
    customChargesTaxRate: fields.customChargesTaxRate,
  })
  const totals = calcOrderDocumentTotals(lines, bundle)
  return {
    totals,
    persist: {
      freightAmount: totals.freight.calculatedAmount,
      installationAmount: totals.installation.calculatedAmount,
      customCharges: totals.otherCharges.calculatedAmount,
      totalAmount: totals.grandTotal,
      orderDiscountCalcType: totals.orderDiscount.calculationType,
      orderDiscountValue: totals.orderDiscount.value,
      orderDiscountAmount: totals.orderDiscount.calculatedAmount,
      freightCalcType: totals.freight.calculationType,
      freightValue: totals.freight.value,
      freightIsTaxable: totals.freight.isTaxable,
      freightTaxRate: totals.freight.taxRate,
      freightTaxAmount: totals.freight.taxAmount,
      installationCalcType: totals.installation.calculationType,
      installationValue: totals.installation.value,
      installationIsTaxable: totals.installation.isTaxable,
      installationTaxRate: totals.installation.taxRate,
      installationTaxAmount: totals.installation.taxAmount,
      customChargesCalcType: totals.otherCharges.calculationType,
      customChargesValue: totals.otherCharges.value,
      customChargesIsTaxable: totals.otherCharges.isTaxable,
      customChargesTaxRate: totals.otherCharges.taxRate,
      customChargesTaxAmount: totals.otherCharges.taxAmount,
    },
  }
}

export function syncLineTotals<T extends { qty: number; unitPrice: number; discountPct?: number; taxPct?: number; lineTotal?: number }>(
  lines: T[],
): T[] {
  return lines.map((line) => {
    const discountPct = line.discountPct ?? 0
    const taxPct = line.taxPct ?? 0
    const base = line.qty * line.unitPrice * (1 - discountPct / 100)
    const lineTotal = base * (1 + taxPct / 100)
    return { ...line, lineTotal }
  })
}
