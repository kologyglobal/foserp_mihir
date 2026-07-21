import type { RequestForQuotationStatus } from '@prisma/client'
import {
  RfqNotEditableError,
  RfqNotSendableError,
  RfqPrNotEligibleError,
  RfqVendorsRequiredError,
} from './rfq.errors.js'

export function parseDateInput(value?: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function assertRfqDraftEditable(status: RequestForQuotationStatus) {
  if (status !== 'DRAFT') throw new RfqNotEditableError()
}

export function assertRfqSendable(status: RequestForQuotationStatus, vendorCount: number) {
  if (status !== 'DRAFT') throw new RfqNotSendableError()
  if (vendorCount < 1) throw new RfqVendorsRequiredError()
}

export function assertPrEligibleForRfq(pr: {
  status: string
  rfqRequired: boolean
  deletedAt: Date | null
}) {
  if (pr.deletedAt) throw new RfqPrNotEligibleError('Purchase requisition is deleted')
  if (pr.status !== 'APPROVED') {
    throw new RfqPrNotEligibleError('Purchase requisition must be approved')
  }
  if (!pr.rfqRequired) {
    throw new RfqPrNotEligibleError(
      'This requisition uses Direct Purchase Planning Path — use Planning Sheet, not RFQ',
    )
  }
}
