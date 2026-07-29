import type { MaintenanceTicketStatus, Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { NotFoundError } from '../../utils/errors.js'
import type { ListTicketsQuery } from './ticket.schemas.js'

const OPEN_STATUSES: MaintenanceTicketStatus[] = [
  'REPORTED',
  'IN_REPAIR',
  'WAITING_FOR_PART',
  'ON_HOLD',
  'TESTING',
]

export const ticketInclude = {
  machine: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      workCentreId: true,
      workCentre: { select: { id: true, code: true, name: true, plantCode: true } },
    },
  },
  contractor: { select: { id: true, code: true, name: true } },
  parts: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' as const } },
  photos: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' as const } },
} satisfies Prisma.MaintenanceTicketInclude

export async function listTickets(tenantId: string, query: ListTicketsQuery) {
  const where: Prisma.MaintenanceTicketWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.openOnly ? { status: { in: OPEN_STATUSES } } : {}),
    ...(query.machineId ? { machineId: query.machineId } : {}),
    ...(query.workCentreId ? { workCentreId: query.workCentreId } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.workOrderId ? { workOrderId: query.workOrderId } : {}),
    ...(query.search
      ? {
          OR: [
            { ticketNumber: { contains: query.search } },
            { problem: { contains: query.search } },
            { machine: { code: { contains: query.search } } },
            { machine: { name: { contains: query.search } } },
          ],
        }
      : {}),
  }
  const [total, items] = await Promise.all([
    prisma.maintenanceTicket.count({ where }),
    prisma.maintenanceTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: { reportedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ])
  return { total, page: query.page, limit: query.limit, items }
}

export async function getTicket(tenantId: string, id: string) {
  const row = await prisma.maintenanceTicket.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: ticketInclude,
  })
  if (!row) throw new NotFoundError('Maintenance ticket not found')
  return row
}

export async function findOpenTicketForMachine(tenantId: string, machineId: string, excludeId?: string) {
  return prisma.maintenanceTicket.findFirst({
    where: {
      tenantId,
      machineId,
      deletedAt: null,
      status: { in: OPEN_STATUSES },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, ticketNumber: true, status: true },
  })
}

export async function dashboardCounts(tenantId: string) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [open, downMachines, underRepair, waitingParts, closedMonth, attention] = await Promise.all([
    prisma.maintenanceTicket.count({
      where: { tenantId, deletedAt: null, status: { in: OPEN_STATUSES } },
    }),
    prisma.manufacturingMachine.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['OUT_OF_SERVICE', 'UNDER_MAINTENANCE'] },
      },
    }),
    prisma.maintenanceTicket.count({
      where: { tenantId, deletedAt: null, status: 'IN_REPAIR' },
    }),
    prisma.maintenanceTicket.count({
      where: { tenantId, deletedAt: null, status: 'WAITING_FOR_PART' },
    }),
    prisma.maintenanceTicket.count({
      where: {
        tenantId,
        deletedAt: null,
        status: 'CLOSED',
        closedAt: { gte: startOfMonth },
      },
    }),
    prisma.maintenanceTicket.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['REPORTED', 'IN_REPAIR', 'WAITING_FOR_PART', 'ON_HOLD', 'TESTING'] },
      },
      include: ticketInclude,
      orderBy: [{ priority: 'desc' }, { reportedAt: 'asc' }],
      take: 15,
    }),
  ])

  const recent = await prisma.maintenanceTicket.findMany({
    where: { tenantId, deletedAt: null },
    include: ticketInclude,
    orderBy: { updatedAt: 'desc' },
    take: 10,
  })

  return {
    openTickets: open,
    machinesDown: downMachines,
    underRepair,
    waitingForParts: waitingParts,
    closedThisMonth: closedMonth,
    needsAttention: attention,
    recent,
  }
}

export async function machineHistory(tenantId: string, machineId: string) {
  const tickets = await prisma.maintenanceTicket.findMany({
    where: { tenantId, machineId, deletedAt: null },
    include: ticketInclude,
    orderBy: { reportedAt: 'desc' },
    take: 100,
  })
  const closed = tickets.filter((t) => t.status === 'CLOSED')
  const downtime = closed.reduce((s, t) => s + (t.downtimeMinutes ?? 0), 0)
  const cost = closed.reduce((s, t) => s + Number(t.totalCost), 0)
  return {
    ticketCount: tickets.length,
    closedCount: closed.length,
    downtimeMinutes: downtime,
    repairCost: cost,
    tickets,
  }
}
