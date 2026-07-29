import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { nextCode } from '../../services/codeSeries.service.js'
import { auditFromRequest, createAuditLog } from '../../services/audit.service.js'
import { ConflictError, InvalidStateError, ValidationError } from '../../utils/errors.js'
import * as repo from './ticket.repository.js'
import type {
  AddPartInput,
  CloseTicketInput,
  CreateTicketInput,
  HoldTicketInput,
  ReportQuery,
  ResumeTicketInput,
  StartRepairInput,
  TestMachineInput,
  UpdateRepairInput,
} from './ticket.schemas.js'

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
    entity: 'maintenanceTicket',
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

function dec(n: Prisma.Decimal | number | null | undefined) {
  return n == null ? 0 : Number(n)
}

function recomputeTotals(partsCost: number, serviceCost: number, otherCost: number) {
  const p = Math.round(partsCost * 100) / 100
  const s = Math.round(serviceCost * 100) / 100
  const o = Math.round(otherCost * 100) / 100
  return { partsCost: p, serviceCost: s, otherCost: o, totalCost: Math.round((p + s + o) * 100) / 100 }
}

function downtimeMinutes(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000))
}

export function mapTicket(row: Awaited<ReturnType<typeof repo.getTicket>>) {
  const now = new Date()
  const end = row.downtimeEndedAt ?? (row.status === 'CLOSED' ? row.closedAt : null) ?? now
  const mins =
    row.downtimeMinutes ??
    (row.reportedAt ? downtimeMinutes(row.reportedAt, end) : null)
  return {
    ...row,
    partsCost: dec(row.partsCost),
    serviceCost: dec(row.serviceCost),
    otherCost: dec(row.otherCost),
    totalCost: dec(row.totalCost),
    reportedLatitude: row.reportedLatitude == null ? null : dec(row.reportedLatitude),
    reportedLongitude: row.reportedLongitude == null ? null : dec(row.reportedLongitude),
    reportedAccuracyM: row.reportedAccuracyM == null ? null : dec(row.reportedAccuracyM),
    downtimeMinutes: mins,
    downtimeLabel: mins == null ? null : formatDowntime(mins),
    parts: row.parts.map((p) => ({
      ...p,
      qty: dec(p.qty),
      unitCost: dec(p.unitCost),
      totalCost: dec(p.totalCost),
      shortageQty: p.shortageQty == null ? null : dec(p.shortageQty),
    })),
  }
}

function formatDowntime(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

/**
 * Machine status mapping (canonical ManufacturingMachineStatus):
 * Report breakdown → OUT_OF_SERVICE (business DOWN)
 * Start repair → UNDER_MAINTENANCE
 * Close success → AVAILABLE
 */
async function setMachineStatus(
  tx: Prisma.TransactionClient,
  tenantId: string,
  machineId: string,
  status: 'AVAILABLE' | 'OUT_OF_SERVICE' | 'UNDER_MAINTENANCE',
  userId: string,
) {
  await tx.manufacturingMachine.updateMany({
    where: { id: machineId, tenantId, deletedAt: null },
    data: { status, updatedBy: userId },
  })
}

export async function listTickets(tenantId: string, query: Parameters<typeof repo.listTickets>[1]) {
  const result = await repo.listTickets(tenantId, query)
  return { ...result, items: result.items.map(mapTicket) }
}

export async function getTicket(tenantId: string, id: string) {
  return mapTicket(await repo.getTicket(tenantId, id))
}

export async function getDashboard(tenantId: string) {
  const d = await repo.dashboardCounts(tenantId)
  return {
    openTickets: d.openTickets,
    machinesDown: d.machinesDown,
    underRepair: d.underRepair,
    waitingForParts: d.waitingForParts,
    closedThisMonth: d.closedThisMonth,
    needsAttention: d.needsAttention.map(mapTicket),
    recent: d.recent.map(mapTicket),
  }
}

export async function getMachineHistory(tenantId: string, machineId: string) {
  const h = await repo.machineHistory(tenantId, machineId)
  const machine = await prisma.manufacturingMachine.findFirst({
    where: { id: machineId, tenantId, deletedAt: null },
    include: { workCentre: { select: { id: true, code: true, name: true } } },
  })
  return {
    machine,
    ticketCount: h.ticketCount,
    closedCount: h.closedCount,
    downtimeMinutes: h.downtimeMinutes,
    downtimeLabel: formatDowntime(h.downtimeMinutes),
    repairCost: h.repairCost,
    tickets: h.tickets.map(mapTicket),
  }
}

export async function createTicket(req: Request, tenantId: string, input: CreateTicketInput) {
  const userId = req.context?.userId ?? ''
  const machine = await prisma.manufacturingMachine.findFirst({
    where: { id: input.machineId, tenantId, deletedAt: null, isActive: true },
    select: {
      id: true,
      workCentreId: true,
      status: true,
      code: true,
      workCentre: { select: { code: true, name: true, plantCode: true } },
    },
  })
  if (!machine) throw new ValidationError('Machine not found or inactive')

  const open = await repo.findOpenTicketForMachine(tenantId, machine.id)
  if (open) {
    throw new ConflictError(
      `Machine already has open maintenance ticket ${open.ticketNumber} (${open.status})`,
    )
  }

  const wc = machine.workCentre
  const derivedLocation =
    input.reportedLocationLabel?.trim() ||
    [wc?.plantCode, wc ? `${wc.code} — ${wc.name}` : null, machine.code].filter(Boolean).join(' · ') ||
    null

  const ticket = await prisma.$transaction(async (tx) => {
    const ticketNumber = await nextCode(tenantId, 'MAINTENANCE_TICKET', tx)
    const created = await tx.maintenanceTicket.create({
      data: {
        tenantId,
        ticketNumber,
        machineId: machine.id,
        workCentreId: machine.workCentreId,
        problem: input.problem,
        priority: input.priority,
        failureCategory: input.failureCategory,
        sourceType: input.sourceType,
        sourceDocumentId: input.sourceDocumentId,
        workOrderId: input.workOrderId,
        jobCardId: input.jobCardId,
        jobCardCode: input.jobCardCode,
        operationId: input.operationId,
        operationCode: input.operationCode,
        operationName: input.operationName,
        operatorName: input.operatorName?.trim() || null,
        reportedLatitude: input.reportedLatitude ?? null,
        reportedLongitude: input.reportedLongitude ?? null,
        reportedAccuracyM: input.reportedAccuracyM ?? null,
        reportedLocationLabel: derivedLocation,
        reportedByUserId: userId || null,
        reportedAt: new Date(),
        status: 'REPORTED',
        inventoryPostingPending: true,
        createdBy: userId || null,
        updatedBy: userId || null,
        // Optional create remarks append to problem context — never seed repairDetails
        ...(input.remarks?.trim()
          ? { problem: `${input.problem.trim()}\n\nRemarks: ${input.remarks.trim()}` }
          : {}),
      },
    })
    // Business DOWN → OUT_OF_SERVICE
    await setMachineStatus(tx, tenantId, machine.id, 'OUT_OF_SERVICE', userId)
    return created
  })

  await audit(req, tenantId, ticket.id, 'CREATE', undefined, ticket)
  return getTicket(tenantId, ticket.id)
}

export async function startRepair(req: Request, tenantId: string, id: string, input: StartRepairInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getTicket(tenantId, id)
  if (!['REPORTED', 'ON_HOLD', 'WAITING_FOR_PART'].includes(before.status)) {
    throw new InvalidStateError(`Cannot start repair from status ${before.status}`)
  }
  if (before.repairStartedAt && before.status === 'IN_REPAIR') {
    throw new ConflictError('Repair already started')
  }

  const startedAt = input.startedAt ? new Date(input.startedAt) : new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.maintenanceTicket.update({
      where: { id },
      data: {
        status: 'IN_REPAIR',
        repairStartedAt: before.repairStartedAt ?? startedAt,
        technicianType: input.technicianType,
        technicianUserId: input.technicianType === 'INTERNAL' ? input.technicianUserId ?? null : null,
        contractorId: input.technicianType === 'EXTERNAL' ? input.contractorId ?? null : null,
        technicianName: input.technicianName ?? null,
        ...(input.operatorName?.trim() ? { operatorName: input.operatorName.trim() } : {}),
        holdReason: null,
        updatedBy: userId || null,
      },
    })
    await setMachineStatus(tx, tenantId, before.machineId, 'UNDER_MAINTENANCE', userId)
    return row
  })
  await audit(req, tenantId, id, 'START_REPAIR', before, updated)
  return getTicket(tenantId, id)
}

export async function updateRepair(req: Request, tenantId: string, id: string, input: UpdateRepairInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getTicket(tenantId, id)
  if (['CLOSED', 'CANCELLED'].includes(before.status)) {
    throw new InvalidStateError('Closed tickets are read-only')
  }

  const serviceCost = input.serviceCost != null ? input.serviceCost : dec(before.serviceCost)
  const otherCost = input.otherCost != null ? input.otherCost : dec(before.otherCost)
  const totals = recomputeTotals(dec(before.partsCost), serviceCost, otherCost)

  const updated = await prisma.maintenanceTicket.update({
    where: { id },
    data: {
      ...(input.repairDetails !== undefined ? { repairDetails: input.repairDetails } : {}),
      ...(input.failureCategory !== undefined ? { failureCategory: input.failureCategory } : {}),
      ...(input.serviceDescription !== undefined ? { serviceDescription: input.serviceDescription } : {}),
      ...(input.invoiceNumber !== undefined ? { invoiceNumber: input.invoiceNumber } : {}),
      ...(input.invoiceDate !== undefined
        ? { invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : null }
        : {}),
      ...(input.technicianName !== undefined ? { technicianName: input.technicianName } : {}),
      ...(input.contractorId !== undefined ? { contractorId: input.contractorId } : {}),
      ...(input.operatorName !== undefined ? { operatorName: input.operatorName } : {}),
      ...totals,
      updatedBy: userId || null,
    },
  })
  await audit(req, tenantId, id, 'UPDATE_REPAIR', before, updated)
  return getTicket(tenantId, id)
}

export async function holdTicket(req: Request, tenantId: string, id: string, input: HoldTicketInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getTicket(tenantId, id)
  if (!['REPORTED', 'IN_REPAIR', 'TESTING'].includes(before.status)) {
    throw new InvalidStateError(`Cannot hold from status ${before.status}`)
  }
  const updated = await prisma.maintenanceTicket.update({
    where: { id },
    data: { status: input.status, holdReason: input.reason, updatedBy: userId || null },
  })
  await audit(req, tenantId, id, 'HOLD', before, updated)
  return getTicket(tenantId, id)
}

export async function resumeTicket(req: Request, tenantId: string, id: string, _input: ResumeTicketInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getTicket(tenantId, id)
  if (!['ON_HOLD', 'WAITING_FOR_PART'].includes(before.status)) {
    throw new InvalidStateError(`Cannot resume from status ${before.status}`)
  }
  const next = before.repairStartedAt ? 'IN_REPAIR' : 'REPORTED'
  const updated = await prisma.maintenanceTicket.update({
    where: { id },
    data: { status: next, holdReason: null, updatedBy: userId || null },
  })
  if (next === 'IN_REPAIR') {
    await setMachineStatus(prisma, tenantId, before.machineId, 'UNDER_MAINTENANCE', userId)
  }
  await audit(req, tenantId, id, 'RESUME', before, updated)
  return getTicket(tenantId, id)
}

export async function addPart(req: Request, tenantId: string, id: string, input: AddPartInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getTicket(tenantId, id)
  if (['CLOSED', 'CANCELLED'].includes(before.status)) {
    throw new InvalidStateError('Cannot add parts to a closed ticket')
  }

  let description = input.description
  let unitCost = input.unitCost
  if (input.itemId) {
    const item = await prisma.masterItem.findFirst({
      where: { id: input.itemId, tenantId, deletedAt: null },
      select: { name: true, code: true, standardRate: true },
    })
    if (!item) throw new ValidationError('Item not found')
    if (!description) description = `${item.code} — ${item.name}`
    if (!unitCost) unitCost = Number(item.standardRate ?? 0)
  }

  const lineTotal = Math.round(input.qty * unitCost * 100) / 100
  await prisma.$transaction(async (tx) => {
    await tx.maintenancePart.create({
      data: {
        tenantId,
        ticketId: id,
        itemId: input.itemId,
        description,
        qty: input.qty,
        unitCost,
        totalCost: lineTotal,
        remarks: input.remarks,
        shortageQty: input.shortageQty,
        // V1: no Inventory ISSUE — document INVENTORY_POSTING_PENDING
        inventoryMovementId: null,
        createdBy: userId || null,
        updatedBy: userId || null,
      },
    })
    const parts = await tx.maintenancePart.findMany({
      where: { ticketId: id, deletedAt: null },
      select: { totalCost: true },
    })
    const partsCost = parts.reduce((s, p) => s + Number(p.totalCost), 0)
    const totals = recomputeTotals(partsCost, dec(before.serviceCost), dec(before.otherCost))
    await tx.maintenanceTicket.update({
      where: { id },
      data: { ...totals, inventoryPostingPending: true, updatedBy: userId || null },
    })
  })
  await audit(req, tenantId, id, 'ADD_PART', before, { description, qty: input.qty, lineTotal })
  return getTicket(tenantId, id)
}

export async function testMachine(req: Request, tenantId: string, id: string, input: TestMachineInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getTicket(tenantId, id)
  if (!['IN_REPAIR', 'TESTING', 'WAITING_FOR_PART'].includes(before.status)) {
    throw new InvalidStateError(`Cannot test from status ${before.status}`)
  }
  if (!before.repairStartedAt) throw new ValidationError('Start repair before testing')
  if (!before.repairDetails?.trim()) throw new ValidationError('Enter repair details before testing')

  const testedAt = input.testedAt ? new Date(input.testedAt) : new Date()
  if (input.result === 'FAIL') {
    const updated = await prisma.maintenanceTicket.update({
      where: { id },
      data: {
        status: 'IN_REPAIR',
        testResult: 'FAIL',
        testedByUserId: userId || null,
        testedAt,
        testRemarks: input.remarks,
        updatedBy: userId || null,
      },
    })
    await setMachineStatus(prisma, tenantId, before.machineId, 'UNDER_MAINTENANCE', userId)
    await audit(req, tenantId, id, 'TEST_FAIL', before, updated)
    return getTicket(tenantId, id)
  }

  const updated = await prisma.maintenanceTicket.update({
    where: { id },
    data: {
      status: 'TESTING',
      testResult: 'PASS',
      testedByUserId: userId || null,
      testedAt,
      testRemarks: input.remarks,
      updatedBy: userId || null,
    },
  })
  await audit(req, tenantId, id, 'TEST_PASS', before, updated)
  return getTicket(tenantId, id)
}

export function closeReadiness(ticket: Awaited<ReturnType<typeof getTicket>>) {
  const photoCount = ticket.photos?.length ?? 0
  const hasPartsOrService =
    (ticket.parts?.length ?? 0) > 0 ||
    Boolean(ticket.serviceDescription?.trim()) ||
    Boolean(ticket.repairDetails?.trim())
  const amountCaptured = dec(ticket.serviceCost) > 0 || dec(ticket.partsCost) > 0 || dec(ticket.otherCost) > 0

  const checks: Array<{ code: string; ok: boolean; message: string }> = [
    {
      code: 'REPAIR_STARTED',
      ok: Boolean(ticket.repairStartedAt),
      message: 'Maintenance started',
    },
    {
      code: 'PHOTOS',
      ok: photoCount >= 1,
      message: 'At least one photo uploaded (max 4)',
    },
    {
      code: 'TECHNICIAN',
      ok:
        ticket.technicianType === 'INTERNAL'
          ? Boolean(ticket.technicianUserId || ticket.technicianName)
          : ticket.technicianType === 'EXTERNAL'
            ? Boolean(ticket.contractorId || ticket.technicianName)
            : false,
      message: 'Technician / contractor details',
    },
    {
      code: 'OPERATOR',
      ok: Boolean(ticket.operatorName?.trim()),
      message: 'Operator name captured',
    },
    {
      code: 'PARTS_OR_SERVICE',
      ok: hasPartsOrService,
      message: 'Parts changed and/or service performed details',
    },
    {
      code: 'INVOICE',
      ok: Boolean(ticket.invoiceNumber?.trim()),
      message: 'Invoice number',
    },
    {
      code: 'AMOUNT',
      ok: amountCaptured || (Boolean(ticket.invoiceNumber?.trim()) && Boolean(ticket.invoiceDate)),
      message: 'Service amount / total maintenance cost',
    },
  ]
  const blockers = checks.filter((c) => !c.ok)
  return { ready: blockers.length === 0, checks, blockers }
}

export async function closeTicket(req: Request, tenantId: string, id: string, input: CloseTicketInput) {
  const userId = req.context?.userId ?? ''
  const before = await getTicket(tenantId, id)
  if (before.status === 'CLOSED') throw new ConflictError('Ticket already closed')
  if (before.status === 'CANCELLED') throw new InvalidStateError('Cancelled ticket cannot be closed')

  const readiness = closeReadiness(before)
  if (!readiness.ready) {
    throw new ValidationError(
      `Cannot close: ${readiness.blockers.map((b) => b.message).join('; ')}`,
      readiness.blockers.map((b) => ({ field: b.code, message: b.message })),
    )
  }

  const otherOpen = await repo.findOpenTicketForMachine(tenantId, before.machineId, id)
  const closedAt = new Date()
  const mins = downtimeMinutes(before.reportedAt, closedAt)

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.maintenanceTicket.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt,
        closedByUserId: userId || null,
        closingRemarks: input.closingRemarks,
        downtimeEndedAt: closedAt,
        downtimeMinutes: mins,
        updatedBy: userId || null,
      },
    })
    if (!otherOpen) {
      await setMachineStatus(tx, tenantId, before.machineId, 'AVAILABLE', userId)
    }
    return row
  })
  await audit(req, tenantId, id, 'CLOSE', before, updated)
  return getTicket(tenantId, id)
}

export async function getReports(tenantId: string, query: ReportQuery) {
  const where: Prisma.MaintenanceTicketWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.machineId ? { machineId: query.machineId } : {}),
    ...(query.workCentreId ? { workCentreId: query.workCentreId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.failureCategory ? { failureCategory: query.failureCategory } : {}),
    ...(query.contractorId ? { contractorId: query.contractorId } : {}),
    ...(query.from || query.to
      ? {
          reportedAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  }
  const tickets = await prisma.maintenanceTicket.findMany({
    where,
    include: {
      machine: { select: { id: true, code: true, name: true } },
      contractor: { select: { id: true, code: true, name: true } },
    },
    orderBy: { reportedAt: 'desc' },
    take: 500,
  })

  const byMachine = new Map<
    string,
    { machineId: string; code: string; name: string; breakdowns: number; downtimeMinutes: number; cost: number }
  >()
  for (const t of tickets) {
    const key = t.machineId
    const cur = byMachine.get(key) ?? {
      machineId: t.machineId,
      code: t.machine.code,
      name: t.machine.name,
      breakdowns: 0,
      downtimeMinutes: 0,
      cost: 0,
    }
    cur.breakdowns += 1
    cur.downtimeMinutes += t.downtimeMinutes ?? 0
    cur.cost += Number(t.totalCost)
    byMachine.set(key, cur)
  }

  const contractors = new Map<
    string,
    { contractorId: string; code: string; name: string; jobs: number; totalCost: number; avgRepairMinutes: number }
  >()
  for (const t of tickets.filter((x) => x.contractorId && x.contractor)) {
    const key = t.contractorId!
    const repairMins =
      t.repairStartedAt && t.closedAt ? downtimeMinutes(t.repairStartedAt, t.closedAt) : t.downtimeMinutes ?? 0
    const cur = contractors.get(key) ?? {
      contractorId: key,
      code: t.contractor!.code,
      name: t.contractor!.name,
      jobs: 0,
      totalCost: 0,
      avgRepairMinutes: 0,
    }
    cur.jobs += 1
    cur.totalCost += Number(t.totalCost)
    cur.avgRepairMinutes += repairMins
    contractors.set(key, cur)
  }
  for (const c of contractors.values()) {
    c.avgRepairMinutes = c.jobs ? Math.round(c.avgRepairMinutes / c.jobs) : 0
  }

  return {
    summary: {
      totalBreakdowns: tickets.length,
      totalDowntimeMinutes: tickets.reduce((s, t) => s + (t.downtimeMinutes ?? 0), 0),
      totalCost: tickets.reduce((s, t) => s + Number(t.totalCost), 0),
    },
    downtimeByMachine: [...byMachine.values()].sort((a, b) => b.downtimeMinutes - a.downtimeMinutes),
    costByMachine: [...byMachine.values()].sort((a, b) => b.cost - a.cost),
    breakdownFrequency: [...byMachine.values()].sort((a, b) => b.breakdowns - a.breakdowns),
    contractors: [...contractors.values()],
    tickets: tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      machineCode: t.machine.code,
      machineName: t.machine.name,
      status: t.status,
      failureCategory: t.failureCategory,
      downtimeMinutes: t.downtimeMinutes,
      totalCost: Number(t.totalCost),
      reportedAt: t.reportedAt,
      closedAt: t.closedAt,
    })),
  }
}
