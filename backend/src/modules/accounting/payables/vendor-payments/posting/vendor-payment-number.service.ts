import type { PostingEvent } from '@prisma/client'
import { reserveSourceDocumentNumber } from '../../../posting/posting-number.service.js'

export async function reserveVendorPaymentNumber(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  event: PostingEvent,
): Promise<string> {
  const reservation = await reserveSourceDocumentNumber(
    tenantId,
    legalEntityId,
    financialYearId,
    'VENDOR_PAYMENT',
    event,
  )
  return reservation.documentNumber
}
