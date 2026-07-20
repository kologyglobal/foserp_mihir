import type { CrmQuotationDocument } from '@prisma/client'
import { InvalidStateError } from '../../../utils/errors.js'
import type { QuotationApprovalEntryDto } from './quotation.types.js'

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

export function assertDocumentApprovable(doc: CrmQuotationDocument): void {
  if (doc.status !== 'pending_approval' && doc.status !== 'draft') {
    throw new InvalidStateError(`Cannot approve document in status ${doc.status}`)
  }
}

export function assertDocumentRejectable(doc: CrmQuotationDocument): void {
  if (doc.status !== 'pending_approval' && doc.status !== 'draft') {
    throw new InvalidStateError(`Cannot reject document in status ${doc.status}`)
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
