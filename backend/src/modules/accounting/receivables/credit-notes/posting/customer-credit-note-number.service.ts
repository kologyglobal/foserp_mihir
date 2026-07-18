import type { PostingEvent } from '@prisma/client'
import { reserveSourceDocumentNumber } from '../../../posting/posting-number.service.js'

export async function reserveCustomerCreditNoteNumber(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  event: PostingEvent,
) {
  return (await reserveSourceDocumentNumber(
    tenantId, legalEntityId, financialYearId, 'CUSTOMER_CREDIT_NOTE', event,
  )).documentNumber
}
