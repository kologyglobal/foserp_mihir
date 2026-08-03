/**
 * Maintenance V1.1 — Machine Health read model (aggregate only, no second ledger).
 */
import type { MaintenanceFailureCategory, ManufacturingMachineStatus, Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { formatDowntime } from './ticket.service.js'
import type { MachineHealthQuery } from './ticket.schemas.js'

export type MachineHealthStatus = 'AVAILABLE' | 'DOWN' | 'MAINTENANCE' | 'ATTENTION'

function dec(n: Prisma.Decimal | number | null | undefined) {
  return n == null ? 0 : Number(n)
}

function downtimeMinutes(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000))
}

function periodBounds(query: MachineHealthQuery): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date()
  if (query.period === 'custom' && query.from) {
    return { from: new Date(query.from), to }
  }
  if (query.period === '30d') {
    const from = new Date(to)
    from.setUTCDate(from.getUTCDate() - 30)
    return { from, to }
  }
  if (query.period === '90d') {
    const from = new Date(to)
    from.setUTCDate(from.getUTCDate() - 90)
    return { from, to }
  }
  // YTD
  const from = new Date(Date.UTC(to.getUTCFullYear(), 0, 1))
  return { from, to }
}

function healthStatus(input: {
  machineStatus: ManufacturingMachineStatus
  openTicketStatus: string | null
  repeatBreakdown: boolean
  waitingForPart: boolean
  downtime30d: number
}): MachineHealthStatus {
  if (input.machineStatus === 'OUT_OF_SERVICE') return 'DOWN'
  if (input.machineStatus === 'UNDER_MAINTENANCE') return 'MAINTENANCE'
  if (input.waitingForPart || input.repeatBreakdown || input.downtime30d >= 24 * 60) return 'ATTENTION'
  return 'AVAILABLE'
}

function mostCommonCategory(
  tickets: Array<{ failureCategory: MaintenanceFailureCategory | null }>,
): MaintenanceFailureCategory | null {
  const counts = new Map<MaintenanceFailureCategory, number>()
  for (const t of tickets) {
    if (!t.failureCategory) continue
    counts.set(t.failureCategory, (counts.get(t.failureCategory) ?? 0) + 1)
  }
  let best: MaintenanceFailureCategory | null = null
  let n = 0
  for (const [k, v] of counts) {
    if (v > n) {
      best = k
      n = v
    }
  }
  return best
}

export async function listMachineHealth(tenantId: string, query: MachineHealthQuery) {
  const { from, to } = periodBounds(query)
  const now = new Date()
  const d30 = new Date(now)
  d30.setUTCDate(d30.getUTCDate() - 30)
  const d90 = new Date(now)
  d90.setUTCDate(d90.getUTCDate() - 90)
  const ytd = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const repeatFrom = new Date(now)
  repeatFrom.setUTCDate(repeatFrom.getUTCDate() - query.repeatBreakdownDays)

  const machines = await prisma.manufacturingMachine.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      ...(query.machineId ? { id: query.machineId } : {}),
      ...(query.workCentreId ? { workCentreId: query.workCentreId } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    include: {
      workCentre: { select: { id: true, code: true, name: true, plantCode: true } },
    },
    orderBy: { code: 'asc' },
    take: 500,
  })

  const machineIds = machines.map((m) => m.id)
  if (machineIds.length === 0) return { period: { from, to, label: query.period }, items: [] }

  const tickets = await prisma.maintenanceTicket.findMany({
    where: {
      tenantId,
      deletedAt: null,
      machineId: { in: machineIds },
      ...(query.failureCategory ? { failureCategory: query.failureCategory } : {}),
    },
    select: {
      id: true,
      ticketNumber: true,
      machineId: true,
      status: true,
      failureCategory: true,
      reportedAt: true,
      closedAt: true,
      downtimeMinutes: true,
      downtimeEndedAt: true,
      repairStartedAt: true,
      repairEndedAt: true,
      testedAt: true,
      totalCost: true,
      partsCost: true,
      serviceCost: true,
      otherCost: true,
      workOrderId: true,
      jobCardId: true,
      problem: true,
    },
  })

  const byMachine = new Map<string, typeof tickets>()
  for (const t of tickets) {
    const list = byMachine.get(t.machineId) ?? []
    list.push(t)
    byMachine.set(t.machineId, list)
  }

  const items = machines.map((m) => {
    const all = byMachine.get(m.id) ?? []
    const open = all.find((t) => !['CLOSED', 'CANCELLED'].includes(t.status)) ?? null

    const inRange = (t: (typeof tickets)[0], start: Date, end: Date) =>
      t.reportedAt >= start && t.reportedAt <= end

    const ticketDowntime = (t: (typeof tickets)[0]) => {
      if (t.downtimeMinutes != null) return t.downtimeMinutes
      const end = t.downtimeEndedAt ?? t.closedAt ?? now
      return downtimeMinutes(t.reportedAt, end)
    }

    const ticketRepair = (t: (typeof tickets)[0]) => {
      if (!t.repairStartedAt) return null
      const end = t.repairEndedAt ?? t.testedAt ?? t.closedAt
      if (!end) return null
      return downtimeMinutes(t.repairStartedAt, end)
    }

    const t30 = all.filter((t) => inRange(t, d30, now))
    const t90 = all.filter((t) => inRange(t, d90, now))
    const tYtd = all.filter((t) => inRange(t, ytd, now))
    const tPeriod = all.filter((t) => inRange(t, from, to))
    const tRepeat = all.filter((t) => inRange(t, repeatFrom, now))

    const closedWithRepair = all.filter((t) => t.status === 'CLOSED' && ticketRepair(t) != null)
    const avgRepair =
      closedWithRepair.length === 0
        ? null
        : Math.round(
            closedWithRepair.reduce((s, t) => s + (ticketRepair(t) ?? 0), 0) / closedWithRepair.length,
          )

    const downtime30d = t30.reduce((s, t) => s + ticketDowntime(t), 0)
    const downtime90d = t90.reduce((s, t) => s + ticketDowntime(t), 0)
    const downtimeYtd = tYtd.reduce((s, t) => s + ticketDowntime(t), 0)
    const cost30d = t30.reduce((s, t) => s + dec(t.totalCost), 0)
    const costYtd = tYtd.reduce((s, t) => s + dec(t.totalCost), 0)
    const costPeriod = tPeriod.reduce((s, t) => s + dec(t.totalCost), 0)

    const repeatBreakdown = tRepeat.length >= query.repeatBreakdownCount
    const waitingForPart = open?.status === 'WAITING_FOR_PART'

    const health = healthStatus({
      machineStatus: m.status,
      openTicketStatus: open?.status ?? null,
      repeatBreakdown,
      waitingForPart: Boolean(waitingForPart),
      downtime30d,
    })

    const lastBreakdown = all.reduce<Date | null>((acc, t) => {
      if (!acc || t.reportedAt > acc) return t.reportedAt
      return acc
    }, null)

    const lastClosed = all
      .filter((t) => t.closedAt)
      .reduce<Date | null>((acc, t) => {
        if (!acc || (t.closedAt && t.closedAt > acc)) return t.closedAt
        return acc
      }, null)

    const affectedWos = new Set(tYtd.map((t) => t.workOrderId).filter(Boolean))
    const affectedJcs = new Set(tYtd.map((t) => t.jobCardId).filter(Boolean))
    const productionDowntimeYtd = tYtd
      .filter((t) => t.workOrderId || t.jobCardId)
      .reduce((s, t) => s + ticketDowntime(t), 0)

    return {
      machineId: m.id,
      machineCode: m.code,
      machineName: m.name,
      workCentre: m.workCentre
        ? {
            id: m.workCentre.id,
            code: m.workCentre.code,
            name: m.workCentre.name,
            plantCode: m.workCentre.plantCode,
          }
        : null,
      status: m.status,
      healthStatus: health,
      openTicket: open
        ? {
            id: open.id,
            ticketNumber: open.ticketNumber,
            status: open.status,
            failureCategory: open.failureCategory,
            problem: open.problem,
            downtimeMinutes: ticketDowntime(open),
            downtimeLabel: formatDowntime(ticketDowntime(open)),
          }
        : null,
      breakdowns30d: t30.length,
      breakdowns90d: t90.length,
      breakdownsYtd: tYtd.length,
      breakdownsPeriod: tPeriod.length,
      downtime30d,
      downtime30dLabel: formatDowntime(downtime30d),
      downtime90d,
      downtimeYtd,
      downtimeYtdLabel: formatDowntime(downtimeYtd),
      downtimePeriod: tPeriod.reduce((s, t) => s + ticketDowntime(t), 0),
      maintenanceCost30d: Math.round(cost30d * 100) / 100,
      maintenanceCostYtd: Math.round(costYtd * 100) / 100,
      maintenanceCostPeriod: Math.round(costPeriod * 100) / 100,
      partsCostYtd: Math.round(tYtd.reduce((s, t) => s + dec(t.partsCost), 0) * 100) / 100,
      serviceCostYtd: Math.round(tYtd.reduce((s, t) => s + dec(t.serviceCost), 0) * 100) / 100,
      otherCostYtd: Math.round(tYtd.reduce((s, t) => s + dec(t.otherCost), 0) * 100) / 100,
      averageRepairMinutes: avgRepair,
      averageRepairLabel: avgRepair == null ? null : formatDowntime(avgRepair),
      lastBreakdownAt: lastBreakdown?.toISOString() ?? null,
      lastMaintenanceAt: lastClosed?.toISOString() ?? null,
      mostCommonFailureCategory: mostCommonCategory(tYtd),
      repeatBreakdown,
      repeatBreakdownCount: tRepeat.length,
      repeatBreakdownDays: query.repeatBreakdownDays,
      repeatDowntimeMinutes: tRepeat.reduce((s, t) => s + ticketDowntime(t), 0),
      repeatCost: Math.round(tRepeat.reduce((s, t) => s + dec(t.totalCost), 0) * 100) / 100,
      productionImpact: {
        affectedWorkOrdersYtd: affectedWos.size,
        affectedJobCardsYtd: affectedJcs.size,
        productionDowntimeYtd,
        productionDowntimeYtdLabel: formatDowntime(productionDowntimeYtd),
      },
    }
  })

  // Rank helpers for dashboard
  const byDowntime = [...items].sort((a, b) => b.downtimeYtd - a.downtimeYtd)
  const byBreakdowns = [...items].sort((a, b) => b.breakdownsYtd - a.breakdownsYtd)
  const byCost = [...items].sort((a, b) => b.maintenanceCostYtd - a.maintenanceCostYtd)

  return {
    period: { from: from.toISOString(), to: to.toISOString(), label: query.period },
    items,
    topByDowntime: byDowntime.slice(0, 10),
    topByBreakdowns: byBreakdowns.slice(0, 10),
    topByCost: byCost.slice(0, 10),
    attention: items.filter((i) => i.healthStatus === 'ATTENTION' || i.healthStatus === 'DOWN'),
  }
}

export async function getMachineHealthDetail(tenantId: string, machineId: string, query: MachineHealthQuery) {
  const list = await listMachineHealth(tenantId, { ...query, machineId })
  const row = list.items[0]
  if (!row) return null

  const history = await prisma.maintenanceTicket.findMany({
    where: { tenantId, machineId, deletedAt: null },
    orderBy: { reportedAt: 'desc' },
    take: 25,
    select: {
      id: true,
      ticketNumber: true,
      reportedAt: true,
      closedAt: true,
      status: true,
      failureCategory: true,
      problem: true,
      rootCause: true,
      repairAction: true,
      downtimeMinutes: true,
      totalCost: true,
      repairStartedAt: true,
      repairEndedAt: true,
      workOrderId: true,
      jobCardCode: true,
      operationName: true,
      technicianName: true,
      contractorId: true,
    },
  })

  return {
    ...row,
    recentTickets: history.map((t) => ({
      ...t,
      totalCost: dec(t.totalCost),
      downtimeLabel: t.downtimeMinutes != null ? formatDowntime(t.downtimeMinutes) : null,
    })),
  }
}
