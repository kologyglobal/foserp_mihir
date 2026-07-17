import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow } from '../shared/finance.helpers.js'
import type { ListNumberSeriesQuery, UpsertNumberSeriesInput } from './finance-number-series.validation.js'

export async function listNumberSeries(tenantId: string, query: ListNumberSeriesQuery) {
  if (!query.legalEntityId) throw new NotFoundError('legalEntityId query parameter is required')
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  return prisma.financeNumberSeries.findMany({
    where: { tenantId, legalEntityId: query.legalEntityId },
    orderBy: { documentType: 'asc' },
  })
}

export async function upsertNumberSeries(tenantId: string, input: UpsertNumberSeriesInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  return prisma.$transaction(async (tx) => {
    const results = []
    for (const item of input.series) {
      const record = await tx.financeNumberSeries.upsert({
        where: {
          legalEntityId_documentType: { legalEntityId: input.legalEntityId, documentType: item.documentType },
        },
        create: {
          tenantId,
          legalEntityId: input.legalEntityId,
          documentType: item.documentType,
          prefix: item.prefix,
          financialYearId: item.financialYearId ?? null,
          padLength: item.padLength ?? 6,
          resetEachYear: item.resetEachYear ?? true,
          isActive: item.isActive ?? true,
        },
        update: {
          prefix: item.prefix,
          financialYearId: item.financialYearId ?? null,
          padLength: item.padLength,
          resetEachYear: item.resetEachYear,
          isActive: item.isActive,
        },
      })
      results.push(record)
    }
    return results
  })
}

export async function previewNextNumber(tenantId: string, legalEntityId: string, documentType: string) {
  const series = await prisma.financeNumberSeries.findFirst({
    where: { tenantId, legalEntityId, documentType: documentType as never, isActive: true },
  })
  if (!series) throw new NotFoundError('Number series not configured')
  const next = series.currentValue + 1
  const padded = String(next).padStart(series.padLength, '0')
  return { preview: `${series.prefix}${padded}`, nextValue: next, seriesId: series.id }
}
