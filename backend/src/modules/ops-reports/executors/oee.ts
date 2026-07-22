import { prisma } from '../../../config/database.js'
import { getManufacturingSettingsForTenant } from '../../manufacturing/settings/manufacturing-settings.service.js'
import { applyDateRangeFilter, round2, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export interface OeeFactorInput {
  plannedMinutes: number
  downtimeMinutes: number
  idealRunMinutes: number
  actualMachineMinutes: number
  goodQty: number
  scrapQty: number
  rejectQty: number
}

export function calculateOeeFactors(input: OeeFactorInput) {
  const availability = input.plannedMinutes > 0
    ? Math.max(0, input.plannedMinutes - input.downtimeMinutes) / input.plannedMinutes
    : 0
  const performance = input.actualMachineMinutes > 0
    ? input.idealRunMinutes / input.actualMachineMinutes
    : 0
  const qualityDenominator = input.goodQty + input.scrapQty + input.rejectQty
  const quality = qualityDenominator > 0 ? input.goodQty / qualityDenominator : 0
  return {
    availability,
    performance,
    quality,
    oee: availability * performance * quality,
  }
}

function inclusiveDays(dateFrom?: string, dateTo?: string): number {
  if (!dateFrom && !dateTo) return 1
  const from = new Date(`${dateFrom ?? dateTo}T00:00:00.000Z`)
  const to = new Date(`${dateTo ?? dateFrom}T00:00:00.000Z`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 1
  return Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1)
}

export async function executeOee(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const settings = await getManufacturingSettingsForTenant(tenantId)
  if (!settings.oeeEnabled) {
    return {
      rows: [],
      summary: { oeeEnabled: false },
      warnings: ['OEE is disabled in Manufacturing Settings. Enable advanced OEE reporting to populate this report.'],
    }
  }

  const f = filters as { dateFrom?: string; dateTo?: string; workCentreId?: string }
  const workCentres = await prisma.manufacturingWorkCentre.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      ...(f.workCentreId ? { id: f.workCentreId } : {}),
    },
    select: { id: true, code: true, name: true },
    take: 500,
  })
  const workCentreIds = workCentres.map((wc) => wc.id)
  if (!workCentreIds.length) {
    return { rows: [], summary: { oeeEnabled: true, workCentreCount: 0 }, warnings: ['No active work centres match the filters.'] }
  }

  const lineWhere: Record<string, unknown> = { tenantId, workCentreId: { in: workCentreIds } }
  applyDateRangeFilter(lineWhere, 'createdAt', f, timezone)
  const lines = await prisma.dailyProductionLine.findMany({
    where: lineWhere as never,
    select: {
      workCentreId: true,
      goodQuantity: true,
      rejectedQuantity: true,
      scrapQuantity: true,
      machineMinutes: true,
      downtimeMinutes: true,
      operation: {
        select: {
          runTimeValue: true,
          runTimeBasis: true,
          plannedQuantity: true,
        },
      },
    },
    take: 20000,
  })

  const downWhere: Record<string, unknown> = { tenantId, workCentreId: { in: workCentreIds } }
  applyDateRangeFilter(downWhere, 'startedAt', f, timezone)
  const downtimes = await prisma.productionDowntime.findMany({
    where: downWhere as never,
    select: { workCentreId: true, durationMinutes: true },
    take: 20000,
  })

  const daysInRange = inclusiveDays(f.dateFrom, f.dateTo)
  const plannedMinutesPerCentre = settings.shiftMinutesPerDay * daysInRange
  const totals = new Map<string, {
    good: number
    reject: number
    scrap: number
    machine: number
    lineDowntime: number
    eventDowntime: number
    ideal: number
  }>()
  for (const wc of workCentres) {
    totals.set(wc.id, { good: 0, reject: 0, scrap: 0, machine: 0, lineDowntime: 0, eventDowntime: 0, ideal: 0 })
  }
  for (const line of lines) {
    if (!line.workCentreId) continue
    const total = totals.get(line.workCentreId)
    if (!total) continue
    const good = toNum(line.goodQuantity)
    total.good += good
    total.reject += toNum(line.rejectedQuantity)
    total.scrap += toNum(line.scrapQuantity)
    total.machine += line.machineMinutes ?? 0
    total.lineDowntime += line.downtimeMinutes ?? 0
    if (line.operation) {
      const standard = toNum(line.operation.runTimeValue)
      const idealCycleMinutes = line.operation.runTimeBasis === 'PER_UNIT'
        ? standard
        : standard / Math.max(1, toNum(line.operation.plannedQuantity))
      total.ideal += idealCycleMinutes * good
    }
  }
  for (const downtime of downtimes) {
    if (downtime.workCentreId) {
      const total = totals.get(downtime.workCentreId)
      if (total) total.eventDowntime += downtime.durationMinutes ?? 0
    }
  }

  const rows: ReportRow[] = workCentres.map((wc) => {
    const total = totals.get(wc.id)!
    // Prefer explicit downtime events. Daily-line downtime is the fallback when no event was posted.
    const downtimeMinutes = total.eventDowntime || total.lineDowntime
    const factors = calculateOeeFactors({
      plannedMinutes: plannedMinutesPerCentre,
      downtimeMinutes,
      idealRunMinutes: total.ideal,
      actualMachineMinutes: total.machine,
      goodQty: total.good,
      scrapQty: total.scrap,
      rejectQty: total.reject,
    })
    return {
      workCentreId: wc.id,
      workCentreCode: wc.code,
      workCentreName: wc.name,
      plannedMinutes: plannedMinutesPerCentre,
      downtimeMinutes,
      actualMachineMinutes: total.machine,
      goodQuantity: round2(total.good),
      scrapQuantity: round2(total.scrap),
      rejectedQuantity: round2(total.reject),
      availabilityPercent: round2(factors.availability * 100),
      performancePercent: round2(factors.performance * 100),
      qualityPercent: round2(factors.quality * 100),
      oeePercent: round2(factors.oee * 100),
    }
  })

  const aggregate = calculateOeeFactors({
    plannedMinutes: plannedMinutesPerCentre * workCentres.length,
    downtimeMinutes: rows.reduce((sum, row) => sum + Number(row.downtimeMinutes ?? 0), 0),
    idealRunMinutes: [...totals.values()].reduce((sum, total) => sum + total.ideal, 0),
    actualMachineMinutes: [...totals.values()].reduce((sum, total) => sum + total.machine, 0),
    goodQty: [...totals.values()].reduce((sum, total) => sum + total.good, 0),
    scrapQty: [...totals.values()].reduce((sum, total) => sum + total.scrap, 0),
    rejectQty: [...totals.values()].reduce((sum, total) => sum + total.reject, 0),
  })
  return {
    rows,
    summary: {
      workCentreCount: workCentres.length,
      daysInRange,
      plannedMinutes: plannedMinutesPerCentre * workCentres.length,
      availabilityPercent: round2(aggregate.availability * 100),
      performancePercent: round2(aggregate.performance * 100),
      qualityPercent: round2(aggregate.quality * 100),
      oeePercent: round2(aggregate.oee * 100),
    },
    warnings: lines.some((line) => !line.operation)
      ? ['Some daily-production lines have no routing operation; their output is excluded from ideal run minutes.']
      : [],
  }
}
