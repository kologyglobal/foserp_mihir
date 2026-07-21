import type { CrmQuotation, CrmQuotationDocument } from '@prisma/client'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import type { QuotationApprovalEntryDto } from './quotation.types.js'
import type { UpdateQuotationDocumentInput, UpdateQuotationInput } from './quotation.validation.js'

/**
 * Quotation document lifecycle (enforced):
 * draft → pending_approval → approved → sent → (customerApproval) → converted
 *
 * customerApproval is independent of document status and is set only via
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
  priceLines: Array<{ lineTotal?: number }>,
  freightAmount: number,
  installationAmount: number,
  customCharges: number,
): number {
  const linesTotal = priceLines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0)
  return linesTotal + freightAmount + installationAmount + customCharges
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
