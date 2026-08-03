/**
 * Maintenance V2 — Preventive Maintenance plans (schedule only).
 * Execution is always an existing MaintenanceTicket with sourceType=PREVENTIVE.
 */
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { nextCode } from '../../services/codeSeries.service.js'
import { auditFromRequest, createAuditLog } from '../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js'
import type {
  CreatePmPlanInput,
  CreatePmTicketInput,
  ListPmPlansQuery,
  PmComplianceQuery,
  UpdatePmPlanInput,
} from './pm.schemas.js'
import { OPEN_STATUSES } from './ticket.repository.js'

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function parseDateOnly(s: string): Date {
  const [y, m, day] = s.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

function toDateOnlyIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addFrequency(from: Date, frequencyType: 'DAYS' | 'WEEKS' | 'MONTHS', value: number): Date {
  const d = new Date(from.getTime())
  if (frequencyType === 'DAYS') {
    d.setUTCDate(d.getUTCDate() + value)
  } else if (frequencyType === 'WEEKS') {
    d.setUTCDate(d.getUTCDate() + value * 7)
  } else {
    d.setUTCMonth(d.getUTCMonth() + value)
  }
  return startOfUtcDay(d)
}

export function computeDueStatus(nextDueDate: Date, today = startOfUtcDay(new Date())): 'UPCOMING' | 'DUE' | 'OVERDUE' {
  const due = startOfUtcDay(nextDueDate)
  if (due.getTime() < today.getTime()) return 'OVERDUE'
  if (due.getTime() === today.getTime()) return 'DUE'
  return 'UPCOMING'
}

function formatFrequency(type: string, value: number) {
  const unit = type === 'DAYS' ? 'Day' : type === 'WEEKS' ? 'Week' : 'Month'
  return `Every ${value} ${unit}${value === 1 ? '' : 's'}`
}

const planInclude = {
  machine: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      workCentreId: true,
      workCentre: { select: { id: true, code: true, name: true } },
    },
  },
  contractor: { select: { id: true, code: true, name: true } },
  checklist: { orderBy: { sequence: 'asc' as const } },
} satisfies Prisma.PreventiveMaintenancePlanInclude

async function audit(
  req: Request,
  tenantId: string,
  entityId: string,
  action: string,
  oldValues: unknown,
  newValues: unknown,
) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'maintenance',
    entity: 'preventiveMaintenancePlan',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export function mapPlan(
  row: Prisma.PreventiveMaintenancePlanGetPayload<{ include: typeof planInclude }>,
  openTicket?: { id: string; ticketNumber: string; status: string } | null,
) {
  const dueStatus = computeDueStatus(row.nextDueDate)
  return {
    id: row.id,
    planNumber: row.planNumber,
    machineId: row.machineId,
    machine: row.machine,
    name: row.name,
    description: row.description,
    frequencyType: row.frequencyType,
    frequencyValue: row.frequencyValue,
    frequencyLabel: formatFrequency(row.frequencyType, row.frequencyValue),
    startDate: toDateOnlyIso(row.startDate),
    lastCompletedDate: row.lastCompletedDate ? toDateOnlyIso(row.lastCompletedDate) : null,
    nextDueDate: toDateOnlyIso(row.nextDueDate),
    dueStatus,
    assignedTechnicianId: row.assignedTechnicianId,
    assignedContractorId: row.assignedContractorId,
    contractor: row.contractor,
    estimatedDurationMin: row.estimatedDurationMin,
    isActive: row.isActive,
    checklist: row.checklist.map((c) => ({ id: c.id, sequence: c.sequence, text: c.text })),
    openTicket: openTicket ?? null,
    canCreateTicket: row.isActive && (dueStatus === 'DUE' || dueStatus === 'OVERDUE') && !openTicket,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadOpenTicketsByPlan(tenantId: string, planIds: string[]) {
  if (!planIds.length) return new Map<string, { id: string; ticketNumber: string; status: string }>()
  const open = await prisma.maintenanceTicket.findMany({
    where: {
      tenantId,
      deletedAt: null,
      preventiveMaintenancePlanId: { in: planIds },
      status: { in: OPEN_STATUSES },
      sourceType: 'PREVENTIVE',
    },
    select: { id: true, ticketNumber: true, status: true, preventiveMaintenancePlanId: true },
  })
  const map = new Map<string, { id: string; ticketNumber: string; status: string }>()
  for (const t of open) {
    if (t.preventiveMaintenancePlanId) {
      map.set(t.preventiveMaintenancePlanId, {
        id: t.id,
        ticketNumber: t.ticketNumber,
        status: t.status,
      })
    }
  }
  return map
}

export async function listPlans(tenantId: string, query: ListPmPlansQuery) {
  const today = startOfUtcDay(new Date())
  const where: Prisma.PreventiveMaintenancePlanWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.machineId ? { machineId: query.machineId } : {}),
    ...(query.workCentreId ? { machine: { workCentreId: query.workCentreId } } : {}),
    ...(query.activeOnly === true ? { isActive: true } : {}),
    ...(query.activeOnly === false ? { isActive: false } : {}),
    ...(query.search
      ? {
          OR: [
            { planNumber: { contains: query.search } },
            { name: { contains: query.search } },
            { machine: { code: { contains: query.search } } },
            { machine: { name: { contains: query.search } } },
          ],
        }
      : {}),
    ...(query.dueStatus === 'OVERDUE' ? { nextDueDate: { lt: today }, isActive: true } : {}),
    ...(query.dueStatus === 'DUE' ? { nextDueDate: today, isActive: true } : {}),
    ...(query.dueStatus === 'UPCOMING' ? { nextDueDate: { gt: today }, isActive: true } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.preventiveMaintenancePlan.count({ where }),
    prisma.preventiveMaintenancePlan.findMany({
      where,
      include: planInclude,
      orderBy: [{ nextDueDate: 'asc' }, { planNumber: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ])
  const openMap = await loadOpenTicketsByPlan(
    tenantId,
    rows.map((r) => r.id),
  )
  return {
    total,
    page: query.page,
    limit: query.limit,
    items: rows.map((r) => mapPlan(r, openMap.get(r.id) ?? null)),
  }
}

export async function getPlan(tenantId: string, id: string) {
  const row = await prisma.preventiveMaintenancePlan.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: planInclude,
  })
  if (!row) throw new NotFoundError('Preventive maintenance plan not found')
  const openMap = await loadOpenTicketsByPlan(tenantId, [id])
  return mapPlan(row, openMap.get(id) ?? null)
}

export async function createPlan(req: Request, tenantId: string, input: CreatePmPlanInput) {
  const userId = req.context?.userId ?? ''
  const machine = await prisma.manufacturingMachine.findFirst({
    where: { id: input.machineId, tenantId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!machine) throw new ValidationError('Machine not found or inactive')

  if (input.assignedContractorId) {
    const vendor = await prisma.masterVendor.findFirst({
      where: { id: input.assignedContractorId, tenantId, deletedAt: null },
      select: { id: true },
    })
    if (!vendor) throw new ValidationError('Contractor not found')
  }

  const startDate = parseDateOnly(input.startDate)
  const nextDueDate = input.nextDueDate ? parseDateOnly(input.nextDueDate) : startDate
  const checklist = (input.checklist ?? []).map((c, i) => ({
    sequence: c.sequence ?? i + 1,
    text: c.text.trim(),
  }))

  const created = await prisma.$transaction(async (tx) => {
    const planNumber = await nextCode(tenantId, 'PREVENTIVE_MAINTENANCE_PLAN', tx)
    return tx.preventiveMaintenancePlan.create({
      data: {
        tenantId,
        planNumber,
        machineId: machine.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        frequencyType: input.frequencyType,
        frequencyValue: input.frequencyValue,
        startDate,
        nextDueDate,
        assignedTechnicianId: input.assignedTechnicianId ?? null,
        assignedContractorId: input.assignedContractorId ?? null,
        estimatedDurationMin: input.estimatedDurationMin ?? null,
        isActive: input.isActive ?? true,
        createdBy: userId || null,
        updatedBy: userId || null,
        checklist: {
          create: checklist.map((c) => ({
            tenantId,
            sequence: c.sequence,
            text: c.text,
          })),
        },
      },
      include: planInclude,
    })
  })

  await audit(req, tenantId, created.id, 'CREATE', undefined, {
    planNumber: created.planNumber,
    machineId: created.machineId,
    nextDueDate: toDateOnlyIso(created.nextDueDate),
  })
  return mapPlan(created, null)
}

export async function updatePlan(req: Request, tenantId: string, id: string, input: UpdatePmPlanInput) {
  const userId = req.context?.userId ?? ''
  const before = await prisma.preventiveMaintenancePlan.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { checklist: true },
  })
  if (!before) throw new NotFoundError('Preventive maintenance plan not found')

  if (input.assignedContractorId) {
    const vendor = await prisma.masterVendor.findFirst({
      where: { id: input.assignedContractorId, tenantId, deletedAt: null },
      select: { id: true },
    })
    if (!vendor) throw new ValidationError('Contractor not found')
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.checklist) {
      await tx.preventiveMaintenanceChecklistItem.deleteMany({ where: { planId: id, tenantId } })
      await tx.preventiveMaintenanceChecklistItem.createMany({
        data: input.checklist.map((c, i) => ({
          tenantId,
          planId: id,
          sequence: c.sequence ?? i + 1,
          text: c.text.trim(),
        })),
      })
    }
    return tx.preventiveMaintenancePlan.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.frequencyType !== undefined ? { frequencyType: input.frequencyType } : {}),
        ...(input.frequencyValue !== undefined ? { frequencyValue: input.frequencyValue } : {}),
        ...(input.startDate !== undefined ? { startDate: parseDateOnly(input.startDate) } : {}),
        ...(input.nextDueDate !== undefined ? { nextDueDate: parseDateOnly(input.nextDueDate) } : {}),
        ...(input.assignedTechnicianId !== undefined
          ? { assignedTechnicianId: input.assignedTechnicianId }
          : {}),
        ...(input.assignedContractorId !== undefined
          ? { assignedContractorId: input.assignedContractorId }
          : {}),
        ...(input.estimatedDurationMin !== undefined
          ? { estimatedDurationMin: input.estimatedDurationMin }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedBy: userId || null,
      },
      include: planInclude,
    })
  })

  await audit(req, tenantId, id, 'UPDATE', before, {
    isActive: updated.isActive,
    nextDueDate: toDateOnlyIso(updated.nextDueDate),
  })
  const openMap = await loadOpenTicketsByPlan(tenantId, [id])
  return mapPlan(updated, openMap.get(id) ?? null)
}

export async function deactivatePlan(req: Request, tenantId: string, id: string) {
  return updatePlan(req, tenantId, id, { isActive: false })
}

/**
 * Generate MaintenanceTicket from plan. Does NOT set machine OUT_OF_SERVICE —
 * machine status changes only when repair/service starts (existing V1 rule).
 */
export async function createTicketFromPlan(
  req: Request,
  tenantId: string,
  planId: string,
  input: CreatePmTicketInput,
) {
  const userId = req.context?.userId ?? ''
  const plan = await prisma.preventiveMaintenancePlan.findFirst({
    where: { id: planId, tenantId, deletedAt: null },
    include: { checklist: { orderBy: { sequence: 'asc' } }, machine: true },
  })
  if (!plan) throw new NotFoundError('Preventive maintenance plan not found')
  if (!plan.isActive) throw new ValidationError('Deactivated plan cannot generate tickets')

  const dueStatus = computeDueStatus(plan.nextDueDate)
  if (dueStatus === 'UPCOMING') {
    throw new ValidationError('Plan is not due yet — create ticket when Due or Overdue')
  }

  const openForPlan = await prisma.maintenanceTicket.findFirst({
    where: {
      tenantId,
      preventiveMaintenancePlanId: planId,
      deletedAt: null,
      status: { in: OPEN_STATUSES },
      sourceType: 'PREVENTIVE',
    },
    select: { ticketNumber: true },
  })
  if (openForPlan) {
    throw new ConflictError(
      `Open PM ticket ${openForPlan.ticketNumber} already exists for this plan/due cycle`,
    )
  }

  const openMachine = await prisma.maintenanceTicket.findFirst({
    where: {
      tenantId,
      machineId: plan.machineId,
      deletedAt: null,
      status: { in: OPEN_STATUSES },
    },
    select: { ticketNumber: true, status: true },
  })
  if (openMachine) {
    throw new ConflictError(
      `Machine already has open maintenance ticket ${openMachine.ticketNumber} (${openMachine.status})`,
    )
  }

  let technicianName: string | null = null
  if (plan.assignedTechnicianId) {
    const user = await prisma.user.findFirst({
      where: { id: plan.assignedTechnicianId, tenantId },
      select: { firstName: true, lastName: true, email: true },
    })
    if (user) {
      technicianName = `${user.firstName} ${user.lastName}`.trim() || user.email
    }
  }

  const scheduledDate = input.scheduledDate ? parseDateOnly(input.scheduledDate) : plan.nextDueDate
  const problem = [
    `Preventive maintenance: ${plan.name}`,
    plan.description?.trim() || null,
    input.remarks?.trim() ? `Remarks: ${input.remarks.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  const ticket = await prisma.$transaction(async (tx) => {
    const ticketNumber = await nextCode(tenantId, 'MAINTENANCE_TICKET', tx)
    const created = await tx.maintenanceTicket.create({
      data: {
        tenantId,
        ticketNumber,
        machineId: plan.machineId,
        workCentreId: plan.machine.workCentreId,
        problem,
        priority: input.priority ?? 'NORMAL',
        sourceType: 'PREVENTIVE',
        sourceDocumentId: plan.planNumber,
        preventiveMaintenancePlanId: plan.id,
        pmScheduledDueDate: plan.nextDueDate,
        scheduledDate,
        technicianUserId: plan.assignedTechnicianId,
        contractorId: plan.assignedContractorId,
        technicianName,
        technicianType: plan.assignedContractorId
          ? 'EXTERNAL'
          : plan.assignedTechnicianId
            ? 'INTERNAL'
            : null,
        reportedByUserId: userId || null,
        reportedAt: new Date(),
        status: 'REPORTED',
        inventoryPostingPending: false,
        createdBy: userId || null,
        updatedBy: userId || null,
        checklistItems: {
          create: plan.checklist.map((c) => ({
            tenantId,
            sequence: c.sequence,
            text: c.text,
            isDone: false,
          })),
        },
      },
    })
    // Intentionally do NOT set machine OUT_OF_SERVICE for PM create.
    return created
  })

  await audit(req, tenantId, plan.id, 'CREATE_TICKET', undefined, {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    scheduledDue: toDateOnlyIso(plan.nextDueDate),
  })

  const { getTicket } = await import('./ticket.service.js')
  return getTicket(tenantId, ticket.id)
}

/** Called from closeTicket when sourceType=PREVENTIVE. */
export async function onPmTicketClosed(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ticket: {
    id: string
    preventiveMaintenancePlanId: string | null
    closedAt: Date | null
  },
  userId: string,
) {
  if (!ticket.preventiveMaintenancePlanId || !ticket.closedAt) return
  const plan = await tx.preventiveMaintenancePlan.findFirst({
    where: { id: ticket.preventiveMaintenancePlanId, tenantId, deletedAt: null },
  })
  if (!plan || !plan.isActive) return

  const completed = startOfUtcDay(ticket.closedAt)
  const nextDue = addFrequency(completed, plan.frequencyType, plan.frequencyValue)
  await tx.preventiveMaintenancePlan.update({
    where: { id: plan.id },
    data: {
      lastCompletedDate: completed,
      nextDueDate: nextDue,
      updatedBy: userId || null,
    },
  })
}

export async function getDashboardPmCounts(tenantId: string) {
  const today = startOfUtcDay(new Date())
  const weekEnd = new Date(today)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const active = { tenantId, deletedAt: null, isActive: true } as const
  const [dueToday, dueThisWeek, overdue, overduePlans] = await Promise.all([
    prisma.preventiveMaintenancePlan.count({
      where: { ...active, nextDueDate: today },
    }),
    prisma.preventiveMaintenancePlan.count({
      where: { ...active, nextDueDate: { gte: today, lt: weekEnd } },
    }),
    prisma.preventiveMaintenancePlan.count({
      where: { ...active, nextDueDate: { lt: today } },
    }),
    prisma.preventiveMaintenancePlan.findMany({
      where: { ...active, nextDueDate: { lte: today } },
      include: planInclude,
      orderBy: { nextDueDate: 'asc' },
      take: 10,
    }),
  ])
  const openMap = await loadOpenTicketsByPlan(
    tenantId,
    overduePlans.map((p) => p.id),
  )
  return {
    pmDueToday: dueToday,
    pmDueThisWeek: dueThisWeek,
    pmOverdue: overdue,
    pmNeedsAttention: overduePlans.map((p) => mapPlan(p, openMap.get(p.id) ?? null)),
  }
}

export async function listPlansForMachine(tenantId: string, machineId: string) {
  const rows = await prisma.preventiveMaintenancePlan.findMany({
    where: { tenantId, machineId, deletedAt: null, isActive: true },
    include: planInclude,
    orderBy: { nextDueDate: 'asc' },
  })
  const openMap = await loadOpenTicketsByPlan(
    tenantId,
    rows.map((r) => r.id),
  )
  return rows.map((r) => mapPlan(r, openMap.get(r.id) ?? null))
}

export async function getPmCompliance(tenantId: string, query: PmComplianceQuery) {
  const from = query.from ? parseDateOnly(query.from) : undefined
  const to = query.to ? parseDateOnly(query.to) : undefined
  const today = startOfUtcDay(new Date())

  const closedTickets = await prisma.maintenanceTicket.findMany({
    where: {
      tenantId,
      deletedAt: null,
      sourceType: 'PREVENTIVE',
      status: 'CLOSED',
      ...(query.machineId ? { machineId: query.machineId } : {}),
      ...(query.workCentreId ? { workCentreId: query.workCentreId } : {}),
      ...(from || to
        ? {
            closedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: new Date(to.getTime() + 86400000 - 1) } : {}),
            },
          }
        : {}),
    },
    include: {
      machine: { select: { code: true, name: true } },
      pmPlan: { select: { planNumber: true, name: true } },
    },
    orderBy: { closedAt: 'desc' },
    take: 500,
  })

  const rows: Array<{
    planNumber: string | null
    planName: string | null
    machineCode: string
    machineName: string
    dueDate: string | null
    completedDate: string | null
    status: 'COMPLETED_ON_TIME' | 'COMPLETED_LATE' | 'OVERDUE'
    delayDays: number
    ticketNumber: string | null
    ticketId: string | null
  }> = closedTickets.map((t) => {
    const due = t.pmScheduledDueDate ? startOfUtcDay(t.pmScheduledDueDate) : null
    const completed = t.closedAt ? startOfUtcDay(t.closedAt) : null
    let status: 'COMPLETED_ON_TIME' | 'COMPLETED_LATE' = 'COMPLETED_ON_TIME'
    let delayDays = 0
    if (due && completed) {
      delayDays = Math.round((completed.getTime() - due.getTime()) / 86400000)
      if (delayDays > 0) status = 'COMPLETED_LATE'
      else delayDays = 0
    }
    return {
      planNumber: t.pmPlan?.planNumber ?? t.sourceDocumentId,
      planName: t.pmPlan?.name ?? null,
      machineCode: t.machine.code,
      machineName: t.machine.name,
      dueDate: due ? toDateOnlyIso(due) : null,
      completedDate: completed ? toDateOnlyIso(completed) : null,
      status,
      delayDays,
      ticketNumber: t.ticketNumber,
      ticketId: t.id,
    }
  })

  const overduePlans = await prisma.preventiveMaintenancePlan.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      nextDueDate: { lt: today },
      ...(query.machineId ? { machineId: query.machineId } : {}),
      ...(query.workCentreId ? { machine: { workCentreId: query.workCentreId } } : {}),
    },
    include: {
      machine: { select: { code: true, name: true } },
    },
  })

  const openMap = await loadOpenTicketsByPlan(
    tenantId,
    overduePlans.map((p) => p.id),
  )

  for (const p of overduePlans) {
    if (openMap.has(p.id)) continue
    const delayDays = Math.round((today.getTime() - startOfUtcDay(p.nextDueDate).getTime()) / 86400000)
    rows.push({
      planNumber: p.planNumber,
      planName: p.name,
      machineCode: p.machine.code,
      machineName: p.machine.name,
      dueDate: toDateOnlyIso(p.nextDueDate),
      completedDate: null,
      status: 'OVERDUE',
      delayDays,
      ticketNumber: null,
      ticketId: null,
    })
  }

  const scheduled = await prisma.preventiveMaintenancePlan.count({
    where: {
      tenantId,
      deletedAt: null,
      isActive: true,
      nextDueDate: { gte: today },
      ...(query.machineId ? { machineId: query.machineId } : {}),
      ...(query.workCentreId ? { machine: { workCentreId: query.workCentreId } } : {}),
    },
  })

  const completedOnTime = rows.filter((r) => r.status === 'COMPLETED_ON_TIME').length
  const completedLate = rows.filter((r) => r.status === 'COMPLETED_LATE').length
  const overdue = rows.filter((r) => r.status === 'OVERDUE').length

  return {
    summary: {
      scheduled,
      completedOnTime,
      completedLate,
      overdue,
    },
    rows,
  }
}
