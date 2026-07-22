import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { getStockPosition } from '../../inventory/balances/balance.service.js'
import { addDec, dec as decQty, isPositive, isZero, subDec, toDecimal } from '../../inventory/shared/quantity.helpers.js'
import { dec } from '../shared/manufacturing.mappers.js'
import * as repo from './material.repository.js'

export const MATERIAL_READINESS_STATUSES = [
  'NOT_RESERVED',
  'PARTIALLY_RESERVED',
  'RESERVED',
  'PARTIALLY_ISSUED',
  'ISSUED',
  'SHORT',
  'COMPLETE',
  'NOT_REQUIRED',
] as const

export type MaterialReadinessStatus = (typeof MATERIAL_READINESS_STATUSES)[number]

export type MaterialLinePosition = {
  materialId: string
  productionOrderId: string
  itemId: string
  item: { id: string; code: string; name: string; isStockable: boolean }
  uomId: string
  uom: { id: string; code: string; name: string }
  warehouseId: string | null
  warehouse: { id: string; code: string; name: string } | null
  requiredQty: string
  reservedQty: string
  issuedQty: string
  returnedQty: string
  additionalIssuedQty: string
  transferredInQty: string
  transferredOutQty: string
  netIssuedResponsibility: string
  heldQty: string
  freeQty: string | null
  shortageQty: string
  lineStatus: string
  reservationId: string | null
  reservationStatus: string | null
  readinessStatus: MaterialReadinessStatus
  remainingToReserve: string
  remainingToIssue: string
  allowedActions: {
    reserve: boolean
    releaseReservation: boolean
    reallocate: boolean
    issue: boolean
    additionalIssue: boolean
    return: boolean
    transfer: boolean
  }
}

function can(req: Request | undefined, permission: string) {
  if (!req?.context) return false
  const permissions = req.context.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

function clampNonNegative(value: ReturnType<typeof toDecimal>) {
  return value.lessThan(0) ? toDecimal(0) : value
}

function maxDec(a: ReturnType<typeof toDecimal>, b: ReturnType<typeof toDecimal>) {
  return a.greaterThan(b) ? a : b
}

/**
 * Transfer qtys from ProductionWipMovement when materialLineId is set; else 0.
 * MATERIAL_RELOCATE (same WO) counts as out+in on that line so custody nets to zero.
 * WO_TO_WO out → source line; in → target WO line matching itemId.
 */
async function loadTransferQtys(
  tenantId: string,
  orderId: string,
  materials: Array<{ id: string; itemId: string }>,
) {
  const outByLine = new Map<string, ReturnType<typeof toDecimal>>()
  const inByLine = new Map<string, ReturnType<typeof toDecimal>>()
  const lineByItem = new Map<string, string>()
  for (const m of materials) {
    outByLine.set(m.id, toDecimal(0))
    inByLine.set(m.id, toDecimal(0))
    if (!lineByItem.has(m.itemId)) lineByItem.set(m.itemId, m.id)
  }

  const materialIds = materials.map((m) => m.id)
  const itemIds = [...lineByItem.keys()]
  if (materialIds.length === 0) return { outByLine, inByLine }

  const movements = await prisma.productionWipMovement.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: 'POSTED',
      movementType: { in: ['MATERIAL_RELOCATE', 'WO_TO_WO'] },
      OR: [
        { productionOrderId: orderId, materialLineId: { in: materialIds } },
        {
          targetProductionOrderId: orderId,
          materialLineId: { not: null },
          itemId: { in: itemIds },
        },
      ],
    },
    select: {
      movementType: true,
      quantity: true,
      materialLineId: true,
      productionOrderId: true,
      targetProductionOrderId: true,
      itemId: true,
    },
  })

  for (const m of movements) {
    const qty = toDecimal(m.quantity)
    if (!m.materialLineId) continue

    if (m.productionOrderId === orderId && outByLine.has(m.materialLineId)) {
      outByLine.set(m.materialLineId, addDec(outByLine.get(m.materialLineId)!, qty))
      if (m.movementType === 'MATERIAL_RELOCATE') {
        inByLine.set(m.materialLineId, addDec(inByLine.get(m.materialLineId)!, qty))
      }
    }

    if (m.movementType === 'WO_TO_WO' && m.targetProductionOrderId === orderId) {
      const targetLineId = lineByItem.get(m.itemId)
      if (targetLineId) {
        inByLine.set(targetLineId, addDec(inByLine.get(targetLineId)!, qty))
      }
    }
  }

  return { outByLine, inByLine }
}

export function deriveReadinessStatus(input: {
  required: ReturnType<typeof toDecimal>
  reserved: ReturnType<typeof toDecimal>
  issued: ReturnType<typeof toDecimal>
  returned: ReturnType<typeof toDecimal>
  held: ReturnType<typeof toDecimal>
  shortage: ReturnType<typeof toDecimal>
  free: ReturnType<typeof toDecimal> | null
}): MaterialReadinessStatus {
  const { required, reserved, issued, returned, held, shortage, free } = input
  if (isZero(required) || required.lessThan(0)) return 'NOT_REQUIRED'

  const netIssued = clampNonNegative(subDec(issued, returned))
  const remainingReserve = clampNonNegative(subDec(required, reserved))
  const remainingIssue = clampNonNegative(subDec(required, netIssued))

  if (shortage.greaterThan(0)) return 'SHORT'
  if (remainingReserve.greaterThan(0) && free !== null && free.lessThan(remainingReserve) && isZero(issued)) {
    return 'SHORT'
  }

  // Fully issued (or beyond) and no remaining WO custody → complete for close/reconcile.
  if (netIssued.greaterThanOrEqualTo(required) && isZero(held)) return 'COMPLETE'
  if (netIssued.greaterThanOrEqualTo(required)) return 'ISSUED'
  if (netIssued.greaterThan(0) || issued.greaterThan(0)) return 'PARTIALLY_ISSUED'
  if (reserved.greaterThanOrEqualTo(required)) return 'RESERVED'
  if (reserved.greaterThan(0)) return 'PARTIALLY_RESERVED'
  if (remainingIssue.greaterThan(0) && free !== null && isZero(free) && isZero(reserved)) return 'SHORT'
  return 'NOT_RESERVED'
}

function resolveAllowedActions(
  req: Request | undefined,
  pos: {
    readinessStatus: MaterialReadinessStatus
    remainingToReserve: ReturnType<typeof toDecimal>
    remainingToIssue: ReturnType<typeof toDecimal>
    reserved: ReturnType<typeof toDecimal>
    held: ReturnType<typeof toDecimal>
    reservationActive: boolean
    required: ReturnType<typeof toDecimal>
  },
) {
  const viewish = can(req, 'manufacturing.materials.view') || can(req, 'manufacturing.material_position.view')
  if (!viewish && !req) {
    // No request context (internal callers) — expose capability flags by state only.
  }

  const canReserve = can(req, 'manufacturing.materials.reserve')
  const canRelease = can(req, 'manufacturing.material.release_reservation')
  const canReallocate = can(req, 'manufacturing.material.reallocate')
  const canIssue = can(req, 'manufacturing.materials.issue')
  const canAdditional = can(req, 'manufacturing.material.additional_issue') || canIssue
  const canReturn = can(req, 'manufacturing.materials.return')
  const canTransfer = can(req, 'manufacturing.materials.transfer') || can(req, 'manufacturing.wip.move')

  const notRequired = pos.readinessStatus === 'NOT_REQUIRED'

  return {
    reserve: !notRequired && isPositive(pos.remainingToReserve) && canReserve,
    releaseReservation: pos.reservationActive && isPositive(pos.reserved) && canRelease,
    reallocate: pos.reservationActive && isPositive(pos.reserved) && canReallocate,
    issue: !notRequired && isPositive(pos.remainingToIssue) && canIssue,
    additionalIssue: !notRequired && isZero(pos.remainingToIssue) && isPositive(pos.required) && canAdditional,
    return: isPositive(pos.held) && canReturn,
    transfer: isPositive(pos.held) && canTransfer,
  }
}

export async function getMaterialPosition(
  tenantId: string,
  orderId: string,
  req?: Request,
): Promise<{ productionOrderId: string; lines: MaterialLinePosition[]; summary: Record<string, number> }> {
  await repo.findWorkOrderWithProfile(tenantId, orderId)
  const materials = await repo.listMaterials(tenantId, orderId)
  const { outByLine, inByLine } = await loadTransferQtys(
    tenantId,
    orderId,
    materials.map((m) => ({ id: m.id, itemId: m.itemId })),
  )

  const lines: MaterialLinePosition[] = []

  for (const material of materials) {
    const required = toDecimal(material.requiredQty)
    const reserved = toDecimal(material.reservedQty)
    const issued = toDecimal(material.issuedQty)
    const returned = toDecimal(material.returnedQty)
    const shortageField = toDecimal(material.shortageQty)
    const additionalIssuedQty = maxDec(subDec(issued, required), toDecimal(0))
    const transferredOut = outByLine.get(material.id) ?? toDecimal(0)
    const transferredIn = inByLine.get(material.id) ?? toDecimal(0)

    // issued + transferredIn - returned - transferredOut (clamp >= 0). No consumed tracker.
    const netIssuedResponsibility = clampNonNegative(
      subDec(addDec(issued, transferredIn), addDec(returned, transferredOut)),
    )
    const heldQty = netIssuedResponsibility

    let free: ReturnType<typeof toDecimal> | null = null
    let freeQtyStr: string | null = null
    if (material.warehouseId) {
      const position = await getStockPosition(tenantId, material.itemId, material.warehouseId)
      free = toDecimal(position.freeQty)
      freeQtyStr = position.freeQty
    }

    const remainingToReserve = clampNonNegative(subDec(required, reserved))
    const netIssued = clampNonNegative(subDec(issued, returned))
    const remainingToIssue = clampNonNegative(subDec(required, netIssued))

    let shortageQty = shortageField
    if (remainingToReserve.greaterThan(0) && free !== null) {
      const uncovered = subDec(remainingToReserve, free)
      if (uncovered.greaterThan(shortageQty)) shortageQty = maxDec(uncovered, toDecimal(0))
    }

    const readinessStatus = deriveReadinessStatus({
      required,
      reserved,
      issued,
      returned,
      held: heldQty,
      shortage: shortageQty,
      free,
    })

    const reservationActive = material.reservation?.status === 'ACTIVE'

    const allowedActions = resolveAllowedActions(req, {
      readinessStatus,
      remainingToReserve,
      remainingToIssue,
      reserved,
      held: heldQty,
      reservationActive: Boolean(reservationActive),
      required,
    })

    lines.push({
      materialId: material.id,
      productionOrderId: material.productionOrderId,
      itemId: material.itemId,
      item: material.item,
      uomId: material.uomId,
      uom: material.uom,
      warehouseId: material.warehouseId,
      warehouse: material.warehouse,
      requiredQty: dec(required)!,
      reservedQty: dec(reserved)!,
      issuedQty: dec(issued)!,
      returnedQty: dec(returned)!,
      additionalIssuedQty: dec(additionalIssuedQty)!,
      transferredInQty: dec(transferredIn)!,
      transferredOutQty: dec(transferredOut)!,
      netIssuedResponsibility: dec(netIssuedResponsibility)!,
      heldQty: dec(heldQty)!,
      freeQty: freeQtyStr,
      shortageQty: dec(shortageQty)!,
      lineStatus: material.status,
      reservationId: material.reservationId,
      reservationStatus: material.reservation?.status ?? null,
      readinessStatus,
      remainingToReserve: dec(remainingToReserve)!,
      remainingToIssue: dec(remainingToIssue)!,
      allowedActions,
    })
  }

  const summary = {
    totalLines: lines.length,
    notReserved: lines.filter((l) => l.readinessStatus === 'NOT_RESERVED').length,
    partiallyReserved: lines.filter((l) => l.readinessStatus === 'PARTIALLY_RESERVED').length,
    reserved: lines.filter((l) => l.readinessStatus === 'RESERVED').length,
    partiallyIssued: lines.filter((l) => l.readinessStatus === 'PARTIALLY_ISSUED').length,
    issued: lines.filter((l) => l.readinessStatus === 'ISSUED').length,
    short: lines.filter((l) => l.readinessStatus === 'SHORT').length,
    complete: lines.filter((l) => l.readinessStatus === 'COMPLETE').length,
    notRequired: lines.filter((l) => l.readinessStatus === 'NOT_REQUIRED').length,
    withHeldQty: lines.filter((l) => isPositive(l.heldQty)).length,
    withAdditionalIssue: lines.filter((l) => isPositive(l.additionalIssuedQty)).length,
  }

  return { productionOrderId: orderId, lines, summary }
}

export async function previewIssue(
  tenantId: string,
  orderId: string,
  input: { materialId: string; quantity: number; additional?: boolean },
  req?: Request,
) {
  const position = await getMaterialPosition(tenantId, orderId, req)
  const line = position.lines.find((l) => l.materialId === input.materialId)
  if (!line) {
    return {
      ok: false,
      error: 'Material line not found on this work order',
      materialId: input.materialId,
    }
  }

  const qty = toDecimal(input.quantity)
  const remaining = toDecimal(line.remainingToIssue)
  const additional = Boolean(input.additional)
  const canAdditional =
    can(req, 'manufacturing.material.additional_issue') ||
    (can(req, 'manufacturing.materials.issue') && additional)

  const isAdditionalIssue = remaining.isZero() || qty.greaterThan(remaining)
  if (isAdditionalIssue && !canAdditional && !additional) {
    return {
      ok: false,
      error: `Cannot issue more than remaining requirement (${line.remainingToIssue}) without additional issue`,
      line,
      requestedQty: decQty(qty),
      remainingToIssue: line.remainingToIssue,
      additionalRequired: true,
    }
  }

  if (!line.warehouseId) {
    return {
      ok: false,
      error: 'Material line has no warehouse configured',
      line,
      requestedQty: decQty(qty),
    }
  }

  const stock = await getStockPosition(tenantId, line.itemId, line.warehouseId)
  const free = toDecimal(stock.freeQty)
  const insufficient = qty.greaterThan(free)

  return {
    ok: !insufficient,
    line,
    requestedQty: decQty(qty),
    remainingToIssue: line.remainingToIssue,
    freeQty: stock.freeQty,
    isAdditionalIssue: isAdditionalIssue || additional,
    insufficientStock: insufficient,
    error: insufficient ? 'Insufficient free stock for issue' : undefined,
  }
}
