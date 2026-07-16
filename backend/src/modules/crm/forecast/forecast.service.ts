import { prisma } from '../../../config/database.js'
import { decimalToNumber, resolveUserNames, tenantActiveFilter, toIso } from '../../../shared/index.js'
import { aggregateSalesForecast, type ForecastInputRow } from './forecast.aggregate.js'
import type { ForecastQuery } from './forecast.validation.js'

export async function getSalesForecast(tenantId: string, query: ForecastQuery) {
  const where = {
    ...tenantActiveFilter(tenantId),
    status: 'OPEN' as const,
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
    ...(query.from || query.to
      ? {
          expectedCloseDate: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  }

  const opps = await prisma.crmOpportunity.findMany({
    where,
    select: {
      id: true,
      name: true,
      amount: true,
      probability: true,
      expectedCloseDate: true,
      ownerId: true,
      stageId: true,
      stage: {
        select: {
          id: true,
          slug: true,
          name: true,
          probability: true,
        },
      },
    },
  })

  const ownerNames = await resolveUserNames(
    opps.map((o) => o.ownerId),
    tenantId,
    prisma,
  )

  const rows: ForecastInputRow[] = opps.map((o) => {
    // Prefer pipeline stage probability (master) over denormalized opportunity field.
    const probability = o.stage?.probability ?? o.probability
    return {
      id: o.id,
      name: o.name,
      amount: decimalToNumber(o.amount),
      probability,
      expectedCloseDate: toIso(o.expectedCloseDate)?.slice(0, 10) ?? null,
      ownerId: o.ownerId,
      ownerName: o.ownerId ? (ownerNames.get(o.ownerId) ?? 'Unassigned') : 'Unassigned',
      stageId: o.stageId,
      stageSlug: o.stage?.slug ?? '',
      stageLabel: o.stage?.name ?? o.stage?.slug ?? 'Unknown',
    }
  })

  return aggregateSalesForecast(rows)
}
