import type { Request } from 'express'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../config/prisma.js'
import { nextCode } from '../../services/codeSeries.service.js'
import { auditFromRequest, createAuditLog } from '../../services/audit.service.js'
import { ConflictError, InvalidStateError, ValidationError } from '../../utils/errors.js'
import { postStockMovement } from '../inventory/shared/stock-posting.service.js'
import { InventoryInsufficientStockError } from '../inventory/shared/inventory.errors.js'
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
  const repairEnd =
    row.repairEndedAt ??
    (row.testResult === 'PASS' ? row.testedAt : null) ??
    (row.status === 'CLOSED' ? row.closedAt : null)
  const repairMins =
    row.repairStartedAt && repairEnd ? downtimeMinutes(row.repairStartedAt, repairEnd) : null
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
    repairMinutes: repairMins,
    repairLabel: repairMins == null ? null : formatDowntime(repairMins),
    pmScheduledDueDate: row.pmScheduledDueDate
      ? row.pmScheduledDueDate.toISOString().slice(0, 10)
      : null,
    scheduledDate: row.scheduledDate ? row.scheduledDate.toISOString().slice(0, 10) : null,
    ticketKind: row.sourceType === 'PREVENTIVE' ? 'PREVENTIVE' : 'BREAKDOWN',
    parts: row.parts.map((p) => ({
      ...p,
      qty: dec(p.qty),
      unitCost: dec(p.unitCost),
      totalCost: dec(p.totalCost),
      shortageQty: p.shortageQty == null ? null : dec(p.shortageQty),
    })),
    checklistItems: (row.checklistItems ?? []).map((c) => ({
      id: c.id,
      sequence: c.sequence,
      text: c.text,
      isDone: c.isDone,
      remark: c.remark,
    })),
  }
}

export function formatDowntime(mins: number) {
  const d = Math.floor(mins / (60 * 24))
  const h = Math.floor((mins % (60 * 24)) / 60)
  const m = mins % 60
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h <= 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
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
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthTickets = await prisma.maintenanceTicket.findMany({
    where: {
      tenantId,
      deletedAt: null,
      reportedAt: { gte: monthStart },
    },
    select: { downtimeMinutes: true, totalCost: true, status: true, reportedAt: true, closedAt: true, downtimeEndedAt: true },
  })
  const downtimeThisMonth = monthTickets.reduce((s, t) => {
    if (t.downtimeMinutes != null) return s + t.downtimeMinutes
    const end = t.downtimeEndedAt ?? t.closedAt ?? now
    return s + downtimeMinutes(t.reportedAt, end)
  }, 0)
  const costThisMonth = monthTickets.reduce((s, t) => s + Number(t.totalCost), 0)

  const { getDashboardPmCounts } = await import('./pm.service.js')
  const pm = await getDashboardPmCounts(tenantId)

  return {
    openTickets: d.openTickets,
    machinesDown: d.machinesDown,
    underRepair: d.underRepair,
    waitingForParts: d.waitingForParts,
    closedThisMonth: d.closedThisMonth,
    downtimeThisMonth,
    downtimeThisMonthLabel: formatDowntime(downtimeThisMonth),
    maintenanceCostThisMonth: Math.round(costThisMonth * 100) / 100,
    pmDueToday: pm.pmDueToday,
    pmDueThisWeek: pm.pmDueThisWeek,
    pmOverdue: pm.pmOverdue,
    pmNeedsAttention: pm.pmNeedsAttention,
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
        inventoryPostingPending: false,
        createdBy: userId || null,
        updatedBy: userId || null,
        ...(input.remarks?.trim()
          ? { problem: `${input.problem.trim()}\n\nRemarks: ${input.remarks.trim()}` }
          : {}),
      },
    })
    // Breakdown report → OUT_OF_SERVICE. Preventive create leaves machine available until start.
    if (input.sourceType !== 'PREVENTIVE') {
      await setMachineStatus(tx, tenantId, machine.id, 'OUT_OF_SERVICE', userId)
    }
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

  await prisma.$transaction(async (tx) => {
    if (input.checklistItems?.length) {
      for (const item of input.checklistItems) {
        await tx.maintenanceTicketChecklistItem.updateMany({
          where: { id: item.id, ticketId: id, tenantId },
          data: {
            isDone: item.isDone,
            remark: item.remark === undefined ? undefined : item.remark,
          },
        })
      }
    }
    await tx.maintenanceTicket.update({
      where: { id },
      data: {
        ...(input.repairDetails !== undefined ? { repairDetails: input.repairDetails } : {}),
        ...(input.rootCause !== undefined ? { rootCause: input.rootCause } : {}),
        ...(input.repairAction !== undefined ? { repairAction: input.repairAction } : {}),
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
  })
  await audit(req, tenantId, id, 'UPDATE_REPAIR', before, { ...input })
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
  let warehouseId: string | null = input.warehouseId ?? null
  let shouldPostIssue = false

  if (input.itemId) {
    const item = await prisma.masterItem.findFirst({
      where: { id: input.itemId, tenantId, deletedAt: null },
      select: {
        name: true,
        code: true,
        standardRate: true,
        isStockable: true,
        isBlocked: true,
        status: true,
      },
    })
    if (!item) throw new ValidationError('Item not found')
    if (!description) description = `${item.code} — ${item.name}`
    if (!unitCost) unitCost = Number(item.standardRate ?? 0)

    if (item.isStockable) {
      if (item.isBlocked || item.status !== 'ACTIVE') {
        throw new ValidationError('Item is blocked or inactive and cannot be issued from inventory')
      }
      if (!warehouseId) {
        throw new ValidationError('Warehouse is required to issue stockable spare parts from inventory')
      }
      const warehouse = await prisma.masterWarehouse.findFirst({
        where: { id: warehouseId, tenantId, deletedAt: null },
        select: { id: true, status: true },
      })
      if (!warehouse) throw new ValidationError('Warehouse not found')
      if (warehouse.status !== 'ACTIVE') throw new ValidationError('Warehouse is not active')
      shouldPostIssue = true
    } else {
      // Non-stockable master item: record on ticket only (no stock movement).
      warehouseId = null
    }
  }

  const partId = randomUUID()
  const lineTotal = Math.round(input.qty * unitCost * 100) / 100

  try {
    await prisma.$transaction(async (tx) => {
      let inventoryMovementId: string | null = null
      let postedUnitCost = unitCost
      let postedTotalCost = lineTotal

      if (shouldPostIssue && input.itemId && warehouseId) {
        const movement = await postStockMovement(
          {
            tenantId,
            itemId: input.itemId,
            warehouseId,
            movementType: 'ISSUE',
            referenceType: 'ISSUE_TO_MAINTENANCE',
            quantity: input.qty,
            referenceNo: before.ticketNumber,
            remarks: `Maintenance spare issue · ${before.ticketNumber} · ${description}`,
            idempotencyKey: `MT_PART:${partId}`,
            rate: unitCost > 0 ? unitCost : undefined,
            createdBy: userId || undefined,
            allowNegativeStock: false,
          },
          tx,
        )
        inventoryMovementId = movement.id
        const absQty = Math.abs(Number(movement.quantity))
        const movementValue = Math.abs(Number(movement.value))
        if (absQty > 0 && movementValue > 0) {
          postedUnitCost = Math.round((movementValue / absQty) * 10000) / 10000
          postedTotalCost = Math.round(movementValue * 100) / 100
        }
      }

      await tx.maintenancePart.create({
        data: {
          id: partId,
          tenantId,
          ticketId: id,
          itemId: input.itemId ?? null,
          warehouseId,
          description,
          qty: input.qty,
          unitCost: postedUnitCost,
          totalCost: postedTotalCost,
          remarks: input.remarks,
          shortageQty: input.shortageQty,
          inventoryMovementId,
          createdBy: userId || null,
          updatedBy: userId || null,
        },
      })

      const parts = await tx.maintenancePart.findMany({
        where: { ticketId: id, deletedAt: null },
        select: { totalCost: true, itemId: true, warehouseId: true, inventoryMovementId: true },
      })
      const partsCost = parts.reduce((s, p) => s + Number(p.totalCost), 0)
      const totals = recomputeTotals(partsCost, dec(before.serviceCost), dec(before.otherCost))
      // Stockable issues always set warehouseId; pending only if movement missing.
      const inventoryPostingPending = parts.some(
        (p) => Boolean(p.itemId) && Boolean(p.warehouseId) && !p.inventoryMovementId,
      )
      await tx.maintenanceTicket.update({
        where: { id },
        data: { ...totals, inventoryPostingPending, updatedBy: userId || null },
      })
    })
  } catch (err) {
    if (err instanceof InventoryInsufficientStockError) {
      throw new ValidationError(
        `Insufficient stock to issue spare part "${description}". Record shortage and create a Purchase Requisition, or reduce qty.`,
      )
    }
    throw err
  }

  await audit(req, tenantId, id, 'ADD_PART', before, {
    description,
    qty: input.qty,
    itemId: input.itemId ?? null,
    warehouseId,
    inventoryPosted: shouldPostIssue,
  })
  return getTicket(tenantId, id)
}

export async function testMachine(req: Request, tenantId: string, id: string, input: TestMachineInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getTicket(tenantId, id)
  if (!['IN_REPAIR', 'TESTING', 'WAITING_FOR_PART'].includes(before.status)) {
    throw new InvalidStateError(`Cannot test from status ${before.status}`)
  }
  if (!before.repairStartedAt) throw new ValidationError('Start repair before testing')
  const hasRepairNotes = Boolean(before.repairAction?.trim() || before.repairDetails?.trim())
  if (!hasRepairNotes) throw new ValidationError('Enter repair action (or repair details) before testing')

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
        repairEndedAt: null,
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
      repairEndedAt: testedAt,
      testRemarks: input.remarks,
      updatedBy: userId || null,
    },
  })
  await audit(req, tenantId, id, 'TEST_PASS', before, updated)
  return getTicket(tenantId, id)
}

export function closeReadiness(ticket: Awaited<ReturnType<typeof getTicket>>) {
  const photoCount = ticket.photos?.length ?? 0
  const isPm = ticket.sourceType === 'PREVENTIVE'
  const checklist = ticket.checklistItems ?? []
  const checklistComplete =
    checklist.length === 0 || checklist.every((c: { isDone: boolean }) => c.isDone)
  const hasPartsOrService =
    (ticket.parts?.length ?? 0) > 0 ||
    Boolean(ticket.serviceDescription?.trim()) ||
    Boolean(ticket.repairAction?.trim()) ||
    Boolean(ticket.repairDetails?.trim()) ||
    (isPm && checklistComplete && checklist.length > 0)
  const amountCaptured = dec(ticket.serviceCost) > 0 || dec(ticket.partsCost) > 0 || dec(ticket.otherCost) > 0

  const checks: Array<{ code: string; ok: boolean; message: string }> = [
    {
      code: 'REPAIR_STARTED',
      ok: Boolean(ticket.repairStartedAt),
      message: 'Maintenance started',
    },
    {
      code: 'PHOTOS',
      ok: isPm ? true : photoCount >= 1,
      message: isPm ? 'Photos optional for preventive' : 'At least one photo uploaded (max 4)',
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
      ok: isPm ? true : Boolean(ticket.operatorName?.trim()),
      message: isPm ? 'Operator optional for preventive' : 'Operator name captured',
    },
    {
      code: 'REPAIR_ACTION',
      ok: Boolean(ticket.repairAction?.trim() || ticket.repairDetails?.trim()) || (isPm && checklistComplete),
      message: isPm ? 'Repair action or completed checklist' : 'Repair action documented',
    },
    {
      code: 'CHECKLIST',
      ok: !isPm || checklistComplete,
      message: 'PM checklist completed',
    },
    {
      code: 'PARTS_OR_SERVICE',
      ok: hasPartsOrService,
      message: 'Parts changed and/or service performed details',
    },
    {
      code: 'TEST_PASS',
      ok: ticket.testResult === 'PASS' && ticket.status === 'TESTING',
      message: 'Machine test PASS required before close',
    },
    {
      code: 'INVOICE',
      ok: Boolean(ticket.invoiceNumber?.trim()) || ticket.technicianType === 'INTERNAL' || isPm,
      message: 'Invoice number (required for external service)',
    },
    {
      code: 'AMOUNT',
      ok:
        amountCaptured ||
        ticket.technicianType === 'INTERNAL' ||
        isPm ||
        (Boolean(ticket.invoiceNumber?.trim()) && Boolean(ticket.invoiceDate)),
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
      // For PREVENTIVE that never set OUT_OF_SERVICE, still safe to set AVAILABLE after start→close.
      await setMachineStatus(tx, tenantId, before.machineId, 'AVAILABLE', userId)
    }
    if (before.sourceType === 'PREVENTIVE' && before.preventiveMaintenancePlanId) {
      const { onPmTicketClosed } = await import('./pm.service.js')
      await onPmTicketClosed(
        tx,
        tenantId,
        {
          id: row.id,
          preventiveMaintenancePlanId: before.preventiveMaintenancePlanId,
          closedAt,
        },
        userId,
      )
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
    {
      contractorId: string
      code: string
      name: string
      jobs: number
      closedJobs: number
      totalCost: number
      avgRepairMinutes: number
    }
  >()
  for (const t of tickets.filter((x) => x.contractorId && x.contractor)) {
    const repairMins =
      t.repairStartedAt && (t.repairEndedAt ?? t.closedAt)
        ? downtimeMinutes(t.repairStartedAt, (t.repairEndedAt ?? t.closedAt)!)
        : t.downtimeMinutes ?? 0
    const key = t.contractorId!
    const cur = contractors.get(key) ?? {
      contractorId: key,
      code: t.contractor!.code,
      name: t.contractor!.name,
      jobs: 0,
      closedJobs: 0,
      totalCost: 0,
      avgRepairMinutes: 0,
    }
    cur.jobs += 1
    if (t.status === 'CLOSED') cur.closedJobs += 1
    cur.totalCost += Number(t.totalCost)
    cur.avgRepairMinutes += repairMins
    contractors.set(key, cur)
  }
  for (const c of contractors.values()) {
    c.avgRepairMinutes = c.jobs ? Math.round(c.avgRepairMinutes / c.jobs) : 0
  }

  const productionImpactByMachine = [...byMachine.values()]
    .map((m) => {
      const mt = tickets.filter((t) => t.machineId === m.machineId)
      const affectedWos = new Set(mt.map((t) => t.workOrderId).filter(Boolean))
      const affectedJcs = new Set(mt.map((t) => t.jobCardId).filter(Boolean))
      const productionDowntime = mt
        .filter((t) => t.workOrderId || t.jobCardId)
        .reduce((s, t) => s + (t.downtimeMinutes ?? 0), 0)
      return {
        machineId: m.machineId,
        code: m.code,
        name: m.name,
        breakdowns: m.breakdowns,
        affectedWorkOrders: affectedWos.size,
        affectedJobCards: affectedJcs.size,
        productionDowntimeMinutes: productionDowntime,
      }
    })
    .filter((r) => r.affectedWorkOrders > 0 || r.affectedJobCards > 0)
    .sort((a, b) => b.productionDowntimeMinutes - a.productionDowntimeMinutes)

  return {
    summary: {
      totalBreakdowns: tickets.length,
      totalDowntimeMinutes: tickets.reduce((s, t) => s + (t.downtimeMinutes ?? 0), 0),
      totalCost: tickets.reduce((s, t) => s + Number(t.totalCost), 0),
    },
    downtimeByMachine: [...byMachine.values()].sort((a, b) => b.downtimeMinutes - a.downtimeMinutes),
    costByMachine: [...byMachine.values()].sort((a, b) => b.cost - a.cost),
    breakdownFrequency: [...byMachine.values()].sort((a, b) => b.breakdowns - a.breakdowns),
    productionImpactByMachine,
    contractors: [...contractors.values()],
    tickets: tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      machineCode: t.machine.code,
      machineName: t.machine.name,
      status: t.status,
      failureCategory: t.failureCategory,
      sourceType: t.sourceType,
      ticketKind: t.sourceType === 'PREVENTIVE' ? 'PREVENTIVE' : 'BREAKDOWN',
      downtimeMinutes: t.downtimeMinutes,
      totalCost: Number(t.totalCost),
      reportedAt: t.reportedAt,
      closedAt: t.closedAt,
      workOrderId: t.workOrderId,
      jobCardId: t.jobCardId,
      jobCardCode: t.jobCardCode,
      operationCode: t.operationCode,
      operationName: t.operationName,
      rootCause: t.rootCause,
      repairAction: t.repairAction,
      repairMinutes:
        t.repairStartedAt && (t.repairEndedAt ?? t.closedAt)
          ? downtimeMinutes(t.repairStartedAt, (t.repairEndedAt ?? t.closedAt)!)
          : null,
    })),
    pmCompliance: await (async () => {
      const { getPmCompliance } = await import('./pm.service.js')
      return getPmCompliance(tenantId, {
        from: query.from,
        to: query.to,
        machineId: query.machineId,
        workCentreId: query.workCentreId,
      })
    })(),
  }
}

/** Active (non-closed) ticket for a machine — Manufacturing banner. */
export async function getActiveTicketForMachine(tenantId: string, machineId: string) {
  const open = await repo.findOpenTicketForMachine(tenantId, machineId)
  if (!open) return null
  return getTicket(tenantId, open.id)
}

/** Link a shortage part line to a Purchase Requisition (backlink). */
export async function linkPartToPurchaseRequisition(
  req: Request,
  tenantId: string,
  ticketId: string,
  input: { partId: string; purchaseRequisitionId: string },
) {
  const userId = req.context?.userId ?? ''
  const ticket = await repo.getTicket(tenantId, ticketId)
  const part = ticket.parts.find((p) => p.id === input.partId)
  if (!part) throw new ValidationError('Part line not found on ticket')

  const pr = await prisma.purchaseRequisition.findFirst({
    where: { id: input.purchaseRequisitionId, tenantId, deletedAt: null },
    select: { id: true, requisitionNumber: true, sourceType: true, sourceId: true },
  })
  if (!pr) throw new ValidationError('Purchase requisition not found')

  await prisma.$transaction(async (tx) => {
    await tx.maintenancePart.update({
      where: { id: part.id },
      data: { purchaseRequisitionId: pr.id, updatedBy: userId || null },
    })
    // Stamp PR source if not already set
    if (!pr.sourceType || !pr.sourceId) {
      await tx.purchaseRequisition.update({
        where: { id: pr.id },
        data: {
          sourceType: 'MAINTENANCE',
          sourceId: ticketId,
          sourceDocumentNumber: ticket.ticketNumber,
          updatedById: userId || null,
        },
      })
    }
    // Put ticket in waiting-for-part when linking shortage PR
    if (ticket.status !== 'WAITING_FOR_PART' && !['CLOSED', 'CANCELLED'].includes(ticket.status)) {
      await tx.maintenanceTicket.update({
        where: { id: ticketId },
        data: {
          status: 'WAITING_FOR_PART',
          holdReason: `Waiting for part via ${pr.requisitionNumber}`,
          updatedBy: userId || null,
        },
      })
    }
  })

  await audit(req, tenantId, ticketId, 'LINK_PART_PR', ticket, {
    partId: part.id,
    purchaseRequisitionId: pr.id,
    requisitionNumber: pr.requisitionNumber,
  })
  return getTicket(tenantId, ticketId)
}
