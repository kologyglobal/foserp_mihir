import { prisma } from '../../../../config/database.js'
import { add, formatForPersistence, subtract } from '../../shared/finance-decimal.js'
import { getDailyLiquidity } from './daily-liquidity.service.js'
import type { ForecastQuery } from './treasury-liquidity.schemas.js'
import type {
  ForecastHorizonBucket,
  ForecastLine,
  ShortTermForecastResult,
} from './treasury-liquidity.types.js'

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function inHorizon(dueDate: Date, asOfDate: string, horizonDays: number): boolean {
  const due = dueDate.toISOString().slice(0, 10)
  return due >= asOfDate && due <= addDays(asOfDate, horizonDays)
}

export async function getShortTermForecast(tenantId: string, query: ForecastQuery): Promise<ShortTermForecastResult> {
  const liquidity = await getDailyLiquidity(tenantId, query)
  const asOfDate = liquidity.asOfDate
  const horizonDays = query.horizonDays ?? 30
  const horizonEnd = addDays(asOfDate, horizonDays)
  const asOf = new Date(`${asOfDate}T00:00:00.000Z`)
  const end = new Date(`${horizonEnd}T23:59:59.999Z`)

  const [standing, payables, receivables, cheques] = await Promise.all([
    prisma.standingInstruction.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: 'ACTIVE',
        amountMode: 'FIXED',
        fixedAmount: { not: null },
        nextDueDate: { gte: asOf, lte: end },
      },
      select: {
        id: true,
        name: true,
        direction: true,
        fixedAmount: true,
        nextDueDate: true,
      },
    }),
    prisma.payableOpenItem.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
        dueDate: { gte: asOf, lte: end },
        outstandingAmount: { gt: 0 },
      },
      select: {
        id: true,
        outstandingAmount: true,
        dueDate: true,
        currencyCode: true,
        documentNumber: true,
      },
      take: 500,
    }),
    prisma.receivableOpenItem.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        side: 'DEBIT',
        status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
        dueDate: { gte: asOf, lte: end },
        openAmount: { gt: 0 },
      },
      select: {
        id: true,
        openAmount: true,
        dueDate: true,
        currencyCode: true,
        documentNumberSnapshot: true,
      },
      take: 500,
    }),
    prisma.treasuryCheque.findMany({
      where: {
        tenantId,
        legalEntityId: query.legalEntityId,
        status: { in: ['ISSUED', 'DEPOSITED'] },
        chequeDate: { gte: asOf, lte: end },
      },
      select: {
        id: true,
        direction: true,
        amount: true,
        chequeDate: true,
        chequeNumber: true,
        currencyCode: true,
      },
      take: 200,
    }),
  ])

  const lines: ForecastLine[] = []

  for (const si of standing) {
    if (!si.fixedAmount) continue
    lines.push({
      source: 'STANDING_INSTRUCTION',
      sourceId: si.id,
      direction: si.direction === 'BANK_DEBIT' ? 'OUTFLOW' : 'INFLOW',
      dueDate: si.nextDueDate.toISOString().slice(0, 10),
      amount: formatForPersistence(si.fixedAmount),
      currencyCode: liquidity.currencyCode,
      description: `Standing instruction: ${si.name}`,
      confidence: 'HIGH',
    })
  }

  for (const p of payables) {
    if (!p.dueDate || !inHorizon(p.dueDate, asOfDate, horizonDays)) continue
    lines.push({
      source: 'PAYABLE_OPEN_ITEM',
      sourceId: p.id,
      direction: 'OUTFLOW',
      dueDate: p.dueDate.toISOString().slice(0, 10),
      amount: formatForPersistence(p.outstandingAmount),
      currencyCode: p.currencyCode,
      description: `AP open item ${p.documentNumber}`,
      confidence: 'MEDIUM',
    })
  }

  for (const r of receivables) {
    if (!r.dueDate || !inHorizon(r.dueDate, asOfDate, horizonDays)) continue
    lines.push({
      source: 'RECEIVABLE_OPEN_ITEM',
      sourceId: r.id,
      direction: 'INFLOW',
      dueDate: r.dueDate.toISOString().slice(0, 10),
      amount: formatForPersistence(r.openAmount),
      currencyCode: r.currencyCode,
      description: `AR open item ${r.documentNumberSnapshot ?? r.id.slice(0, 8)}`,
      confidence: 'MEDIUM',
    })
  }

  for (const c of cheques) {
    lines.push({
      source: 'TREASURY_CHEQUE',
      sourceId: c.id,
      direction: c.direction === 'ISSUED' ? 'OUTFLOW' : 'INFLOW',
      dueDate: c.chequeDate.toISOString().slice(0, 10),
      amount: formatForPersistence(c.amount),
      currencyCode: c.currencyCode,
      description: `Cheque ${c.chequeNumber} (${c.direction})`,
      confidence: 'LOW',
    })
  }

  lines.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.source.localeCompare(b.source))

  const horizons = [7, 14, 30].filter((h) => h <= horizonDays)
  if (!horizons.includes(horizonDays)) horizons.push(horizonDays)

  const opening = liquidity.availableLiquidity
  const buckets: ForecastHorizonBucket[] = horizons.map((h) => {
    const cutoff = addDays(asOfDate, h)
    let inflow = '0.0000'
    let outflow = '0.0000'
    for (const line of lines) {
      if (line.dueDate > cutoff) continue
      if (line.direction === 'INFLOW') inflow = formatForPersistence(add(inflow, line.amount))
      else outflow = formatForPersistence(add(outflow, line.amount))
    }
    const net = formatForPersistence(subtract(inflow, outflow))
    return {
      horizonDays: h,
      inflow,
      outflow,
      net,
      projectedClosing: formatForPersistence(add(opening, net)),
    }
  })

  return {
    legalEntityId: query.legalEntityId,
    asOfDate,
    horizonDays,
    currencyCode: liquidity.currencyCode,
    openingAvailableLiquidity: opening,
    lines,
    buckets,
  }
}
