import type { PostingEvent } from '@prisma/client'
import { reserveSourceDocumentNumber } from '../../../posting/posting-number.service.js'

export async function reserveVendorInvoiceNumber(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  event: PostingEvent,
): Promise<string> {
  const reservation = await reserveSourceDocumentNumber(
    tenantId,
    legalEntityId,
    financialYearId,
    'VENDOR_INVOICE',
    event,
  )
  return reservation.documentNumber
}
