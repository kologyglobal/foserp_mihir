import type { PostingEvent, VendorAdjustmentType } from '@prisma/client'
import { reserveSourceDocumentNumber } from '../../../posting/posting-number.service.js'

function documentTypeForAdjustment(adjustmentType: VendorAdjustmentType): 'VENDOR_DEBIT_NOTE' | 'VENDOR_CREDIT_ADJUSTMENT' {
  return adjustmentType === 'VENDOR_DEBIT_NOTE' ? 'VENDOR_DEBIT_NOTE' : 'VENDOR_CREDIT_ADJUSTMENT'
}

export async function reserveVendorAdjustmentNumber(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  adjustmentType: VendorAdjustmentType,
  event: PostingEvent,
): Promise<string> {
  const reservation = await reserveSourceDocumentNumber(
    tenantId,
    legalEntityId,
    financialYearId,
    documentTypeForAdjustment(adjustmentType),
    event,
  )
  return reservation.documentNumber
}
