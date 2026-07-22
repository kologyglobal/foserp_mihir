import { prisma } from '../../../../config/database.js'

const DOCUMENT_TYPE = 'BANK_RECONCILIATION_MATCH' as const
const DEFAULT_PREFIX = 'BREC/'
const DEFAULT_PAD_LENGTH = 6

/**
 * Standalone `BREC/######` reference generator for bank reconciliation matches.
 * Unlike `reserveVoucherNumber` / `reserveSourceDocumentNumber`, this is NOT tied to a
 * PostingEvent — DIRECT_BANK_GL matches never create a voucher/GL/PostingEvent, so the
 * FinanceNumberSeries row (documentType = BANK_RECONCILIATION_MATCH) is incremented directly.
 * Auto-creates the series (prefix `BREC/`, padLength 6) the first time it is needed for a
 * legal entity, mirroring the "ensure-in-service create if missing" pattern used elsewhere.
 */
export async function reserveBankReconciliationMatchReference(
  tenantId: string,
  legalEntityId: string,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    let series = await tx.financeNumberSeries.findFirst({
      where: { tenantId, legalEntityId, documentType: DOCUMENT_TYPE },
    })

    if (!series) {
      try {
        series = await tx.financeNumberSeries.create({
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
        series = await tx.financeNumberSeries.findFirst({
          where: { tenantId, legalEntityId, documentType: DOCUMENT_TYPE },
        })
      }
    }
    if (!series) {
      throw new Error('Unable to resolve or create BANK_RECONCILIATION_MATCH number series')
    }

    await tx.financeNumberSeries.update({
      where: { id: series.id },
      data: { currentValue: { increment: 1 } },
    })
    const updated = await tx.financeNumberSeries.findUniqueOrThrow({ where: { id: series.id } })
    const padded = String(updated.currentValue).padStart(updated.padLength, '0')
    return `${updated.prefix}${padded}`
  })
}
