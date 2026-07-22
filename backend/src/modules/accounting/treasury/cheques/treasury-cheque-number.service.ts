import type { PostingEvent } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { reserveSourceDocumentNumber, type ReservedSourceDocumentNumber } from '../../posting/posting-number.service.js'
import { TreasuryChequeNumberSeriesMissingError } from './treasury-cheque.errors.js'

const DOCUMENT_TYPE = 'TREASURY_CHEQUE' as const
const DEFAULT_PREFIX = 'CHQ/'
const DEFAULT_PAD_LENGTH = 6

/** Auto-creates the `TREASURY_CHEQUE` number series (prefix `CHQ/`) the first time it is needed. */
async function ensureTreasuryChequeNumberSeries(tenantId: string, legalEntityId: string): Promise<void> {
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

/** Reserves the CHQ/ register number via the posting engine's PostingEvent (POST_ON_LIFECYCLE path). */
export async function reserveTreasuryChequeNumberForPosting(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  event: PostingEvent,
): Promise<ReservedSourceDocumentNumber> {
  await ensureTreasuryChequeNumberSeries(tenantId, legalEntityId)
  return reserveSourceDocumentNumber(tenantId, legalEntityId, financialYearId, DOCUMENT_TYPE, event)
}

/** Reserves the CHQ/ register number outside the posting engine (TRACK_ONLY path — no PostingEvent/voucher). */
export async function reserveTreasuryChequeNumberStandalone(tenantId: string, legalEntityId: string): Promise<string> {
  await ensureTreasuryChequeNumberSeries(tenantId, legalEntityId)

  return prisma.$transaction(async (tx) => {
    const series = await tx.financeNumberSeries.findFirst({
      where: { tenantId, legalEntityId, documentType: DOCUMENT_TYPE },
    })
    if (!series) throw new TreasuryChequeNumberSeriesMissingError()
    if (!series.isActive) throw new TreasuryChequeNumberSeriesMissingError('Treasury cheque number series is inactive')

    await tx.financeNumberSeries.update({ where: { id: series.id }, data: { currentValue: { increment: 1 } } })
    const updated = await tx.financeNumberSeries.findUniqueOrThrow({ where: { id: series.id } })
    const padded = String(updated.currentValue).padStart(updated.padLength, '0')
    return `${updated.prefix}${padded}`
  })
}
