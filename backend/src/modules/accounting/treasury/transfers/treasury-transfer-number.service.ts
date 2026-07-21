import type { PostingEvent } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { reserveSourceDocumentNumber, type ReservedSourceDocumentNumber } from '../../posting/posting-number.service.js'

const DOCUMENT_TYPE = 'TREASURY_TRANSFER' as const
const DEFAULT_PREFIX = 'TTR/'
const DEFAULT_PAD_LENGTH = 6

/** Auto-creates the `TREASURY_TRANSFER` number series (prefix `TTR/`) the first time it is needed. */
async function ensureTreasuryTransferNumberSeries(tenantId: string, legalEntityId: string): Promise<void> {
  const existing = await prisma.financeNumberSeries.findFirst({
    where: { tenantId, legalEntityId, documentType: DOCUMENT_TYPE },
  })
  if (existing) return
  try {
    await prisma.financeNumberSeries.create({
      data: {
        tenantId,
        legalEntityId,
        documentType: DOCUMENT_TYPE,
        prefix: DEFAULT_PREFIX,
        currentValue: 0,
        padLength: DEFAULT_PAD_LENGTH,
        resetEachYear: false,
        isActive: true,
      },
    })
  } catch {
    // Concurrent auto-create race — another request already created it.
  }
}

export async function reserveTreasuryTransferNumber(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  event: PostingEvent,
): Promise<ReservedSourceDocumentNumber> {
  await ensureTreasuryTransferNumberSeries(tenantId, legalEntityId)
  return reserveSourceDocumentNumber(tenantId, legalEntityId, financialYearId, DOCUMENT_TYPE, event)
}
