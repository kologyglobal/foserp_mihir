import { createHash } from 'node:crypto'
import type { Request } from 'express'
import type { ProductionOrderMaterialLineStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { assertItem, assertUom } from '../shared/manufacturing.helpers.js'
import {
  cancelReservation,
  createReservation,
} from '../../inventory/reservations/reservation.service.js'
import { postIssueToWorkOrder, postReturnFromWorkOrder } from '../../inventory/movements/movement.service.js'
import { tryRecordManufacturingAccountingEvent } from '../accounting/manufacturing-accounting-event.service.js'
import { getStockPosition } from '../../inventory/balances/balance.service.js'
import { InventoryInsufficientStockError } from '../../inventory/shared/inventory.errors.js'
import {
  addDec,
  dec as decQty,
  isPositive,
  subDec,
  toDecimal,
  type DecimalInput,
} from '../../inventory/shared/quantity.helpers.js'
import { createFromProductionShortage } from '../../purchase/requisitions/production-shortage-pr.service.js'
import { dec } from '../shared/manufacturing.mappers.js'
import * as repo from './material.repository.js'
import type {
  AddMaterialRequirementInput,
  IssueMaterialInput,
  ReallocateReservationInput,
  ReleaseReservationInput,
  ReserveMaterialsInput,
  ReturnMaterialInput,
  ShortageRequisitionInput,
  BulkShortageRequisitionInput,
  UpdateMaterialRequirementInput,
} from './material.schemas.js'

function hasPerm(req: Request, permission: string) {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

function remainingToReserve(material: { requiredQty: DecimalInput; reservedQty: DecimalInput }) {
  return subDec(material.requiredQty, material.reservedQty)
}

function netIssued(material: { issuedQty: DecimalInput; returnedQty: DecimalInput }) {
  return subDec(material.issuedQty, material.returnedQty)
}

function remainingToIssue(material: { requiredQty: DecimalInput; issuedQty: DecimalInput; returnedQty: DecimalInput }) {
  return subDec(material.requiredQty, netIssued(material))
}

function deriveMaterialStatus(
  required: ReturnType<typeof toDecimal>,
  reserved: ReturnType<typeof toDecimal>,
  issued: ReturnType<typeof toDecimal>,
  returned: ReturnType<typeof toDecimal>,
  shortage: ReturnType<typeof toDecimal>,
): ProductionOrderMaterialLineStatus {
  const net = subDec(issued, returned)
  if (shortage.greaterThan(0)) return 'SHORT'
  if (net.greaterThanOrEqualTo(required)) return 'ISSUED'
  if (net.greaterThan(0)) return 'PARTIAL'
  if (reserved.greaterThanOrEqualTo(required)) return 'RESERVED'
  if (reserved.greaterThan(0)) return 'PARTIAL'
  return 'OPEN'
}

export function mapMaterial(row: repo.MaterialRow, extras?: { freeQty?: string; hasShortage?: boolean }) {
  return {
    id: row.id,
    productionOrderId: row.productionOrderId,
    bomLineId: row.bomLineId,
    itemId: row.itemId,
    item: row.item,
    uomId: row.uomId,
    uom: row.uom,
    warehouseId: row.warehouseId,
    warehouse: row.warehouse,
    requiredQty: dec(row.requiredQty),
    reservedQty: dec(row.reservedQty),
    issuedQty: dec(row.issuedQty),
    returnedQty: dec(row.returnedQty),
    shortageQty: dec(row.shortageQty),
    status: row.status,
    reservationId: row.reservationId,
    reservation: row.reservation
      ? {
          ...row.reservation,
          quantity: dec(row.reservation.quantity),
          fulfilledQty: dec(row.reservation.fulfilledQty),
        }
      : null,
    purchaseRequisitionId: row.purchaseRequisitionId,
    purchaseRequisition: row.purchaseRequisition,
    issueStageGroupId: row.issueStageGroupId,
    issueOperationId: row.issueOperationId,
    remarks: row.remarks,
    freeQty: extras?.freeQty ?? null,
    hasShortage: extras?.hasShortage ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function bomLineEligible(
  line: { makeOrBuy: string; item: { isStockable: boolean } },
): boolean {
  if (line.makeOrBuy === 'BUY') return true
  if (line.item.isStockable) return true
  return false
}

export async function syncRequirements(req: Request, tenantId: string, orderId: string) {
  const userId = req.context?.userId ?? ''
  const order = await repo.findWorkOrderWithProfile(tenantId, orderId)

  if (order.status === 'DRAFT') {
    throw new InvalidStateError('Work order must be released before syncing material requirements')
  }
  if (!order.bomSnapshot) {
    throw new ValidationError('Work order has no BOM snapshot; release the order first')
  }

  const warehouseId = order.manufacturingProfile.productionWarehouseId
  if (!warehouseId) {
    throw new ValidationError('Manufacturing profile has no production warehouse configured')
  }

  const eligibleLines = order.bomSnapshot.lines.filter(bomLineEligible)
  const existing = await repo.findExistingBomLineIds(
    tenantId,
    orderId,
    eligibleLines.map((l) => l.id),
  )

  const created = await prisma.$transaction(async (tx) => {
    await tx.productionOrder.update({
      where: { id: orderId, tenantId },
      data: { materialControlStatus: 'PENDING_INVENTORY', updatedBy: userId },
    })

    const rows: repo.MaterialRow[] = []
    for (const line of eligibleLines) {
      if (existing.has(line.id)) continue

      const createdRow = await tx.productionOrderMaterial.create({
        data: {
          tenantId,
          productionOrderId: orderId,
          bomLineId: line.id,
          itemId: line.itemId,
          uomId: line.uomId,
          warehouseId,
          requiredQty: line.requiredQuantity,
          issueStageGroupId: line.issueStageGroupId,
          issueOperationId: line.issueOperationId,
          status: 'OPEN',
          createdBy: userId,
          updatedBy: userId,
        },
        include: repo.materialInclude,
      })
      rows.push(createdRow)
    }

    await tx.productionOrder.update({
      where: { id: orderId, tenantId },
      data: { materialControlStatus: 'ACTIVE', updatedBy: userId },
    })

    return rows
  })

  const allMaterials = await repo.listMaterials(tenantId, orderId)
  return {
    createdCount: created.length,
    skippedCount: eligibleLines.length - created.length,
    materials: allMaterials.map((m) => mapMaterial(m)),
  }
}

export async function listMaterials(tenantId: string, orderId: string) {
  await repo.findWorkOrderWithProfile(tenantId, orderId)
  const materials = await repo.listMaterials(tenantId, orderId)
  return materials.map((m) => mapMaterial(m))
}

/**
 * Add a material requirement to this WO only: appends a BOM-snapshot line + material row.
 * Does not change the master BOM.
 */
export async function addMaterialRequirement(
  req: Request,
  tenantId: string,
  orderId: string,
  input: AddMaterialRequirementInput,
) {
  const userId = req.context?.userId ?? ''
  const order = await repo.findWorkOrderWithProfile(tenantId, orderId)

  if (order.status === 'DRAFT') {
    throw new InvalidStateError('Release the work order before adding material requirements')
  }
  if (!order.bomSnapshot) {
    throw new ValidationError('Work order has no BOM snapshot; release the order first')
  }

  await assertItem(tenantId, input.itemId)
  await assertUom(tenantId, input.uomId)

  const warehouseId = order.manufacturingProfile.productionWarehouseId
  const planned = toDecimal(order.plannedQuantity)
  const required = toDecimal(input.requiredQty)
  const perUnit = planned.greaterThan(0) ? required.div(planned) : required

  const material = await prisma.$transaction(async (tx) => {
    const maxSeq = await tx.productionOrderBomLine.aggregate({
      where: { tenantId, bomSnapshotId: order.bomSnapshot!.id },
      _max: { sequence: true },
    })
    const sequence = (maxSeq._max.sequence ?? 0) + 10

    const bomLine = await tx.productionOrderBomLine.create({
      data: {
        tenantId,
        bomSnapshotId: order.bomSnapshot!.id,
        sourceBomLineId: null,
        parentLineId: null,
        sequence,
        level: 1,
        itemId: input.itemId,
        descriptionOverride: null,
        perUnitQuantity: perUnit,
        uomId: input.uomId,
        scrapPercent: 0,
        requiredQuantity: required,
        makeOrBuy: input.makeOrBuy,
        lineType: input.lineType,
        isOptional: false,
      },
    })

    const created = await tx.productionOrderMaterial.create({
      data: {
        tenantId,
        productionOrderId: orderId,
        bomLineId: bomLine.id,
        itemId: input.itemId,
        uomId: input.uomId,
        warehouseId: warehouseId ?? null,
        requiredQty: required,
        status: 'OPEN',
        remarks: input.remarks ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
      include: repo.materialInclude,
    })

    await tx.productionOrder.update({
      where: { id: orderId, tenantId },
      data: {
        materialControlStatus: warehouseId ? 'ACTIVE' : 'PENDING_INVENTORY',
        updatedBy: userId,
      },
    })

    return created
  })

  return mapMaterial(material)
}

/**
 * Edit required qty or substitute item on a WO material line (and its snapshot BOM line).
 * Item change is blocked once reservation or issue has started.
 */
export async function updateMaterialRequirement(
  req: Request,
  tenantId: string,
  orderId: string,
  materialId: string,
  input: UpdateMaterialRequirementInput,
) {
  const userId = req.context?.userId ?? ''
  const material = await repo.findMaterialOrThrow(tenantId, orderId, materialId)

  if (input.itemId) await assertItem(tenantId, input.itemId)
  if (input.uomId) await assertUom(tenantId, input.uomId)

  const reserved = toDecimal(material.reservedQty)
  const issued = toDecimal(material.issuedQty)
  const returned = toDecimal(material.returnedQty)
  const net = subDec(issued, returned)

  if ((input.itemId || input.uomId) && (reserved.greaterThan(0) || net.greaterThan(0))) {
    throw new InvalidStateError('Cannot change item/UOM after reservation or issue has started')
  }

  if (input.requiredQty !== undefined) {
    const nextRequired = toDecimal(input.requiredQty)
    if (nextRequired.lessThan(net)) {
      throw new ValidationError(`Required qty cannot be less than net issued (${dec(net)})`)
    }
    if (nextRequired.lessThan(reserved) && reserved.greaterThan(net)) {
      throw new ValidationError(
        `Required qty cannot be less than reserved qty (${dec(reserved)}). Release reservation first.`,
      )
    }
  }

  const nextItemId = input.itemId ?? material.itemId
  const nextUomId = input.uomId ?? material.uomId
  const nextRequired = input.requiredQty !== undefined ? toDecimal(input.requiredQty) : toDecimal(material.requiredQty)

  const order = await repo.findWorkOrderWithProfile(tenantId, orderId)
  const planned = toDecimal(order.plannedQuantity)
  const perUnit = planned.greaterThan(0) ? nextRequired.div(planned) : nextRequired

  const shortage = toDecimal(material.shortageQty)
  const status = deriveMaterialStatus(nextRequired, reserved, issued, returned, shortage)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.productionOrderBomLine.update({
      where: { id: material.bomLineId, tenantId },
      data: {
        itemId: nextItemId,
        uomId: nextUomId,
        requiredQuantity: nextRequired,
        perUnitQuantity: perUnit,
      },
    })

    return tx.productionOrderMaterial.update({
      where: { id: materialId, tenantId },
      data: {
        itemId: nextItemId,
        uomId: nextUomId,
        requiredQty: nextRequired,
        status,
        remarks: input.remarks === undefined ? undefined : input.remarks,
        updatedBy: userId,
      },
      include: repo.materialInclude,
    })
  })

  return mapMaterial(updated)
}

/** Remove a WO material line that has no reservation/issue activity. */
export async function removeMaterialRequirement(
  req: Request,
  tenantId: string,
  orderId: string,
  materialId: string,
) {
  const userId = req.context?.userId ?? ''
  const material = await repo.findMaterialOrThrow(tenantId, orderId, materialId)

  if (toDecimal(material.reservedQty).greaterThan(0) || toDecimal(material.issuedQty).greaterThan(0)) {
    throw new InvalidStateError('Cannot remove a material line with reservation or issue history')
  }

  await prisma.$transaction(async (tx) => {
    await tx.productionOrderMaterial.delete({ where: { id: materialId, tenantId } })
    await tx.productionOrderBomLine.delete({ where: { id: material.bomLineId, tenantId } })
    await tx.productionOrder.update({
      where: { id: orderId, tenantId },
      data: { updatedBy: userId },
    })
  })

  return { id: materialId }
}

export async function getMaterialsReadiness(tenantId: string, orderId: string) {
  const materials = await repo.listMaterials(tenantId, orderId)
  const readiness = await Promise.all(
    materials.map(async (material) => {
      const warehouseId = material.warehouseId
      if (!warehouseId) {
        return mapMaterial(material, { freeQty: '0', hasShortage: true })
      }

      try {
        const position = await getStockPosition(tenantId, material.itemId, warehouseId)
        const free = toDecimal(position.freeQty)
        const remaining = remainingToReserve(material)
        const uncovered = subDec(remaining, free)
        const hasShortage =
          toDecimal(material.shortageQty).greaterThan(0) || (remaining.greaterThan(0) && uncovered.greaterThan(0))

        return mapMaterial(material, {
          freeQty: position.freeQty,
          hasShortage,
        })
      } catch {
        // Stock-balance schema / lookup must not hide requirement lines (e.g. missing valuation columns).
        return mapMaterial(material, { freeQty: '0', hasShortage: toDecimal(material.shortageQty).greaterThan(0) })
      }
    }),
  )

  return {
    materials: readiness,
    summary: {
      totalLines: readiness.length,
      shortageLines: readiness.filter((m) => m.hasShortage).length,
    },
  }
}

export async function reserveMaterials(req: Request, tenantId: string, orderId: string, input: ReserveMaterialsInput) {
  const userId = req.context?.userId ?? ''
  const order = await repo.findWorkOrderWithProfile(tenantId, orderId)

  if (order.materialControlStatus === 'NOT_CONNECTED') {
    throw new InvalidStateError('Material requirements are not synced; run sync-requirements first')
  }

  let materials = await repo.listMaterials(tenantId, orderId)
  if (input.materialIds?.length) {
    const idSet = new Set(input.materialIds)
    materials = materials.filter((m) => idSet.has(m.id))
  }

  const results: Array<{ materialId: string; reservedQty: string; shortageQty: string; status: string; error?: string }> = []

  for (const material of materials) {
    const remaining = remainingToReserve(material)
    if (!isPositive(remaining)) {
      results.push({
        materialId: material.id,
        reservedQty: dec(material.reservedQty)!,
        shortageQty: dec(material.shortageQty)!,
        status: material.status,
      })
      continue
    }

    const warehouseId = material.warehouseId
    if (!warehouseId) {
      results.push({
        materialId: material.id,
        reservedQty: dec(material.reservedQty)!,
        shortageQty: decQty(remaining),
        status: 'SHORT',
        error: 'No warehouse configured on material line',
      })
      await prisma.productionOrderMaterial.update({
        where: { id: material.id },
        data: { shortageQty: remaining, status: 'SHORT', updatedBy: userId },
      })
      continue
    }

    const position = await getStockPosition(tenantId, material.itemId, warehouseId)
    const free = toDecimal(position.freeQty)
    const reserveQty = remaining.lessThanOrEqualTo(free) ? remaining : free
    const shortfall = subDec(remaining, reserveQty)

    let reservationId = material.reservationId
    if (isPositive(reserveQty)) {
      try {
        const reservation = await createReservation(req, tenantId, {
          itemId: material.itemId,
          warehouseId,
          quantity: reserveQty.toNumber(),
          demandType: 'WO',
          demandId: orderId,
          referenceNo: order.orderNumber,
          idempotencyKey: `wo-mat-res:${material.id}:${dec(reserveQty)}`,
          remarks: `Material reservation for WO ${order.orderNumber}`,
        })
        reservationId = reservation.id
      } catch (err) {
        if (!(err instanceof InventoryInsufficientStockError)) throw err
        results.push({
          materialId: material.id,
          reservedQty: dec(material.reservedQty)!,
          shortageQty: decQty(remaining),
          status: 'SHORT',
          error: 'Insufficient free stock',
        })
        await prisma.productionOrderMaterial.update({
          where: { id: material.id },
          data: { shortageQty: remaining, status: 'SHORT', updatedBy: userId },
        })
        continue
      }
    }

    const newReserved = addDec(material.reservedQty, reserveQty)
    const status = deriveMaterialStatus(
      toDecimal(material.requiredQty),
      newReserved,
      toDecimal(material.issuedQty),
      toDecimal(material.returnedQty),
      shortfall,
    )

    await prisma.productionOrderMaterial.update({
      where: { id: material.id },
      data: {
        reservedQty: newReserved,
        shortageQty: shortfall,
        reservationId,
        status,
        updatedBy: userId,
      },
    })

    results.push({
      materialId: material.id,
      reservedQty: dec(newReserved)!,
      shortageQty: dec(shortfall)!,
      status,
    })
  }

  return {
    results,
    materials: (await repo.listMaterials(tenantId, orderId)).map((m) => mapMaterial(m)),
  }
}

export async function issueMaterial(req: Request, tenantId: string, orderId: string, input: IssueMaterialInput) {
  const userId = req.context?.userId ?? ''
  const material = await repo.findMaterialOrThrow(tenantId, orderId, input.materialId)
  const warehouseId = input.warehouseId ?? material.warehouseId
  if (!warehouseId) throw new ValidationError('Material line has no warehouse configured — pick a warehouse to issue from')

  const issueQty = toDecimal(input.quantity)
  const remaining = remainingToIssue(material)
  if (issueQty.greaterThan(remaining)) {
    const allowed =
      hasPerm(req, 'manufacturing.material.additional_issue') ||
      (hasPerm(req, 'manufacturing.materials.issue') && Boolean(input.additional))
    if (!allowed) {
      throw new ValidationError(
        `Cannot issue more than remaining requirement (${dec(remaining)}) without additional issue permission or additional: true`,
      )
    }
  }

  const batchTracked = Boolean(material.item.batchTracked)
  const serialTracked = Boolean(material.item.serialTracked)
  if (batchTracked && !input.batchId && !input.batchNumber?.trim()) {
    throw new ValidationError(
      `Item ${material.item.code} is batch-tracked — provide batchId or batchNumber when issuing`,
    )
  }
  if (serialTracked && !input.serialId && !input.serialNumber?.trim()) {
    throw new ValidationError(
      `Item ${material.item.code} is serial-tracked — provide serialId or serialNumber when issuing`,
    )
  }
  if (serialTracked && !issueQty.equals(1)) {
    throw new ValidationError(
      `Item ${material.item.code} is serial-tracked — issue quantity must be 1 (one serial per posting)`,
    )
  }

  const movement = await postIssueToWorkOrder(req, tenantId, {
    itemId: material.itemId,
    warehouseId,
    quantity: issueQty.toNumber(),
    workOrderId: orderId,
    consumeReservation: Boolean(material.reservationId),
    idempotencyKey: input.idempotencyKey,
    remarks: input.remarks,
    rate: input.rate,
    referenceNo: material.bomLine.sequence.toString(),
    batchId: input.batchId,
    batchNumber: input.batchNumber,
    serialId: input.serialId,
    serialNumber: input.serialNumber,
  })

  const movementAmount = Math.abs(Number(movement.value ?? 0))
  await tryRecordManufacturingAccountingEvent(req, tenantId, {
    eventType: 'MATERIAL_ISSUED',
    idempotencyKey: `PROD_MAT_ISSUE:${movement.id}:V1`,
    sourceDocumentType: 'INVENTORY_STOCK_MOVEMENT',
    sourceDocumentId: movement.id,
    productionOrderId: orderId,
    quantity: issueQty,
    amount: movementAmount,
    narration: `Material issue for WO material ${material.id}`,
    payloadJson: { materialId: material.itemId, productionOrderMaterialId: material.id },
  })

  const newIssued = addDec(material.issuedQty, issueQty)
  const status = deriveMaterialStatus(
    toDecimal(material.requiredQty),
    toDecimal(material.reservedQty),
    newIssued,
    toDecimal(material.returnedQty),
    toDecimal(material.shortageQty),
  )

  const updated = await prisma.productionOrderMaterial.update({
    where: { id: material.id },
    data: {
      issuedQty: newIssued,
      status,
      updatedBy: userId,
      ...(!material.warehouseId && input.warehouseId ? { warehouseId: input.warehouseId } : {}),
    },
    include: repo.materialInclude,
  })

  return mapMaterial(updated)
}

export async function returnMaterial(req: Request, tenantId: string, orderId: string, input: ReturnMaterialInput) {
  const userId = req.context?.userId ?? ''
  const material = await repo.findMaterialOrThrow(tenantId, orderId, input.materialId)
  const warehouseId = material.warehouseId
  if (!warehouseId) throw new ValidationError('Material line has no warehouse configured')

  const returnQty = toDecimal(input.quantity)
  const net = netIssued(material)
  if (returnQty.greaterThan(net)) {
    throw new ValidationError(`Cannot return more than net issued quantity (${dec(net)})`)
  }

  const movement = await postReturnFromWorkOrder(req, tenantId, {
    itemId: material.itemId,
    warehouseId,
    quantity: returnQty.toNumber(),
    workOrderId: orderId,
    idempotencyKey: input.idempotencyKey ?? `wo-mat-ret:${material.id}:${dec(returnQty)}`,
    remarks: input.remarks,
    rate: input.rate,
  })

  const movementAmount = Math.abs(Number(movement.value ?? 0))
  await tryRecordManufacturingAccountingEvent(req, tenantId, {
    eventType: 'MATERIAL_RETURNED',
    idempotencyKey: `PROD_MAT_RETURN:${movement.id}:V1`,
    sourceDocumentType: 'INVENTORY_STOCK_MOVEMENT',
    sourceDocumentId: movement.id,
    productionOrderId: orderId,
    quantity: returnQty,
    amount: movementAmount,
    narration: `Material return for WO material ${material.id}`,
    payloadJson: { materialId: material.itemId, productionOrderMaterialId: material.id },
  })

  const newReturned = addDec(material.returnedQty, returnQty)
  const status = deriveMaterialStatus(
    toDecimal(material.requiredQty),
    toDecimal(material.reservedQty),
    toDecimal(material.issuedQty),
    newReturned,
    toDecimal(material.shortageQty),
  )

  const updated = await prisma.productionOrderMaterial.update({
    where: { id: material.id },
    data: { returnedQty: newReturned, status, updatedBy: userId },
    include: repo.materialInclude,
  })

  return mapMaterial(updated)
}

export async function releaseReservation(
  req: Request,
  tenantId: string,
  orderId: string,
  input: ReleaseReservationInput,
) {
  const userId = req.context?.userId ?? ''
  await repo.findWorkOrderWithProfile(tenantId, orderId)

  let materials = await repo.listMaterials(tenantId, orderId)
  if (input.materialIds?.length) {
    const idSet = new Set(input.materialIds)
    materials = materials.filter((m) => idSet.has(m.id))
  }

  const results: Array<{
    materialId: string
    released: boolean
    reservationId: string | null
    reservedQty: string
    status: string
    error?: string
  }> = []

  for (const material of materials) {
    if (!material.reservationId || material.reservation?.status !== 'ACTIVE') {
      results.push({
        materialId: material.id,
        released: false,
        reservationId: material.reservationId,
        reservedQty: dec(material.reservedQty)!,
        status: material.status,
        error: 'No ACTIVE reservation on material line',
      })
      continue
    }

    await cancelReservation(req, tenantId, material.reservationId, {
      remarks: input.reason ?? `Release reservation for WO material ${material.id}`,
    })

    const status = deriveMaterialStatus(
      toDecimal(material.requiredQty),
      toDecimal(0),
      toDecimal(material.issuedQty),
      toDecimal(material.returnedQty),
      toDecimal(material.shortageQty),
    )

    await prisma.productionOrderMaterial.update({
      where: { id: material.id },
      data: {
        reservedQty: 0,
        reservationId: null,
        status,
        updatedBy: userId,
        remarks: input.reason ?? material.remarks,
      },
    })

    results.push({
      materialId: material.id,
      released: true,
      reservationId: material.reservationId,
      reservedQty: '0',
      status,
    })
  }

  return {
    results,
    materials: (await repo.listMaterials(tenantId, orderId)).map((m) => mapMaterial(m)),
  }
}

export async function reallocateReservation(
  req: Request,
  tenantId: string,
  orderId: string,
  input: ReallocateReservationInput,
) {
  const userId = req.context?.userId ?? ''
  const sourceOrder = await repo.findWorkOrderWithProfile(tenantId, orderId)
  const targetOrder = await repo.findWorkOrderWithProfile(tenantId, input.targetWorkOrderId)

  if (input.targetWorkOrderId === orderId) {
    throw new ValidationError('Cannot reallocate reservation to the same work order')
  }

  const source = await repo.findMaterialOrThrow(tenantId, orderId, input.sourceMaterialId)
  if (!source.reservationId || source.reservation?.status !== 'ACTIVE') {
    throw new InvalidStateError('Source material has no ACTIVE reservation to reallocate')
  }
  if (!source.warehouseId) {
    throw new ValidationError('Source material line has no warehouse configured')
  }

  const qty = toDecimal(input.quantity)
  const sourceReserved = toDecimal(source.reservedQty)
  if (qty.greaterThan(sourceReserved)) {
    throw new ValidationError(`Cannot reallocate more than reserved quantity (${dec(sourceReserved)})`)
  }

  let target =
    input.targetMaterialId != null
      ? await repo.findMaterialOrThrow(tenantId, input.targetWorkOrderId, input.targetMaterialId)
      : (await repo.listMaterials(tenantId, input.targetWorkOrderId)).find((m) => m.itemId === source.itemId)

  if (!target) {
    throw new NotFoundError('Target material line not found for item on target work order')
  }
  if (target.itemId !== source.itemId) {
    throw new ValidationError('Target material item must match source material item')
  }

  const targetWarehouseId = target.warehouseId ?? targetOrder.manufacturingProfile.productionWarehouseId
  if (!targetWarehouseId) {
    throw new ValidationError('Target material line has no warehouse configured')
  }

  const reservation = source.reservation!
  const remainingOnReservation = subDec(reservation.quantity, reservation.fulfilledQty)
  if (qty.greaterThan(remainingOnReservation)) {
    throw new ValidationError(
      `Cannot reallocate more than unfulfilled reservation quantity (${dec(remainingOnReservation)})`,
    )
  }

  await cancelReservation(req, tenantId, source.reservationId, {
    remarks: input.reason ?? `Reallocate ${dec(qty)} to WO ${targetOrder.orderNumber}`,
  })

  const sourceKeep = subDec(remainingOnReservation, qty)
  let sourceReservationId: string | null = null
  if (isPositive(sourceKeep)) {
    const kept = await createReservation(req, tenantId, {
      itemId: source.itemId,
      warehouseId: source.warehouseId,
      quantity: sourceKeep.toNumber(),
      demandType: 'WO',
      demandId: orderId,
      referenceNo: sourceOrder.orderNumber,
      idempotencyKey: `wo-mat-realloc-keep:${source.id}:${dec(sourceKeep)}:${Date.now()}`,
      remarks: `Remainder after reallocate from ${source.id}`,
    })
    sourceReservationId = kept.id
  }

  let targetReserveQty = qty
  if (target.reservationId && target.reservation?.status === 'ACTIVE') {
    const targetRemaining = subDec(target.reservation.quantity, target.reservation.fulfilledQty)
    await cancelReservation(req, tenantId, target.reservationId, {
      remarks: input.reason ?? `Replace reservation before reallocate onto ${target.id}`,
    })
    targetReserveQty = addDec(targetRemaining, qty)
  }

  const targetReservation = await createReservation(req, tenantId, {
    itemId: target.itemId,
    warehouseId: targetWarehouseId,
    quantity: targetReserveQty.toNumber(),
    demandType: 'WO',
    demandId: input.targetWorkOrderId,
    referenceNo: targetOrder.orderNumber,
    idempotencyKey: `wo-mat-realloc-tgt:${source.id}:${target.id}:${dec(qty)}:${Date.now()}`,
    remarks: input.reason ?? `Reallocated from WO ${sourceOrder.orderNumber} material ${source.id}`,
  })

  const newSourceReserved = clampNonNeg(subDec(sourceReserved, qty))
  const sourceStatus = deriveMaterialStatus(
    toDecimal(source.requiredQty),
    newSourceReserved,
    toDecimal(source.issuedQty),
    toDecimal(source.returnedQty),
    toDecimal(source.shortageQty),
  )

  const newTargetReserved = addDec(target.reservedQty, qty)
  const targetStatus = deriveMaterialStatus(
    toDecimal(target.requiredQty),
    newTargetReserved,
    toDecimal(target.issuedQty),
    toDecimal(target.returnedQty),
    toDecimal(target.shortageQty),
  )

  await prisma.$transaction([
    prisma.productionOrderMaterial.update({
      where: { id: source.id },
      data: {
        reservedQty: newSourceReserved,
        reservationId: sourceReservationId,
        status: sourceStatus,
        updatedBy: userId,
      },
    }),
    prisma.productionOrderMaterial.update({
      where: { id: target.id },
      data: {
        reservedQty: newTargetReserved,
        reservationId: targetReservation.id,
        warehouseId: targetWarehouseId,
        status: targetStatus,
        updatedBy: userId,
      },
    }),
  ])

  return {
    quantity: dec(qty)!,
    source: mapMaterial(await repo.findMaterialOrThrow(tenantId, orderId, source.id)),
    target: mapMaterial(await repo.findMaterialOrThrow(tenantId, input.targetWorkOrderId, target.id)),
    targetReservationId: targetReservation.id,
  }
}

function clampNonNeg(value: ReturnType<typeof toDecimal>) {
  return value.lessThan(0) ? toDecimal(0) : value
}

export async function createShortageRequisition(
  req: Request,
  tenantId: string,
  orderId: string,
  input: ShortageRequisitionInput,
) {
  const userId = req.context?.userId ?? ''
  const order = await repo.findWorkOrderWithProfile(tenantId, orderId)
  const materials = await repo.listMaterials(tenantId, orderId)
  const selectedIds = input.materialIds?.length ? new Set(input.materialIds) : null

  const shortageLines: Array<{
    material: repo.MaterialRow
    qty: ReturnType<typeof toDecimal>
  }> = []

  for (const material of materials) {
    if (selectedIds && !selectedIds.has(material.id)) continue
    const warehouseId = material.warehouseId
    if (!warehouseId) continue

    const position = await getStockPosition(tenantId, material.itemId, warehouseId)
    const free = toDecimal(position.freeQty)
    const remaining = remainingToReserve(material)
    const uncovered = subDec(remaining, free)
    const fromShortageField = toDecimal(material.shortageQty)

    let qty = toDecimal(0)
    if (fromShortageField.greaterThan(0)) {
      qty = fromShortageField
    } else if (uncovered.greaterThan(0)) {
      qty = uncovered
    }

    // Selected lines with no free stock still raise PR for remaining-to-issue when reserve remaining is 0
    // but issue balance remains (already reserved but stock gone is rare). Prefer remaining-to-issue shortfall.
    if (!isPositive(qty) && selectedIds) {
      const issueRemaining = remainingToIssue(material)
      const issueShort = subDec(issueRemaining, free)
      if (issueShort.greaterThan(0)) qty = issueShort
    }

    if (isPositive(qty)) {
      shortageLines.push({ material, qty })
    }
  }

  if (shortageLines.length === 0) {
    throw new ValidationError('No material shortages found for this work order')
  }

  const idempotencyKey = input.idempotencyKey ?? `wo-shortage-pr:${orderId}`
  const requisition = await createFromProductionShortage(req, tenantId, {
    productionOrderId: orderId,
    warehouseId: order.manufacturingProfile.productionWarehouseId ?? undefined,
    priority: input.priority,
    purpose: `Production shortage for WO ${order.orderNumber}`,
    idempotencyKey,
    submit: input.submit,
    rfqRequired: input.rfqRequired === true ? true : undefined,
    lines: shortageLines.map(({ material, qty }) => ({
      itemId: material.itemId,
      quantity: qty.toNumber(),
      warehouseId: material.warehouseId ?? undefined,
      uomId: material.uomId,
      bomLineId: material.bomLineId,
      productionOrderId: orderId,
      stageId: material.issueStageGroupId ?? undefined,
      operationId: material.issueOperationId ?? undefined,
      remarks: `Shortage from material line ${material.id}`,
    })),
  })

  await prisma.$transaction(async (tx) => {
    for (const { material } of shortageLines) {
      await tx.productionOrderMaterial.update({
        where: { id: material.id },
        data: {
          purchaseRequisitionId: requisition.id,
          updatedBy: userId,
        },
      })
    }
  })

  return {
    requisition,
    linkedMaterialIds: shortageLines.map((l) => l.material.id),
    materials: (await repo.listMaterials(tenantId, orderId)).map((m) => mapMaterial(m)),
  }
}

/**
 * One purchase requisition for many selected WO material lines (same PR number).
 * Used by Issue Stock multi-select “Create PR for short”.
 */
export async function createBulkShortageRequisition(
  req: Request,
  tenantId: string,
  input: BulkShortageRequisitionInput,
) {
  const userId = req.context?.userId ?? ''
  const materials = await repo.listMaterialsByIds(tenantId, input.materialIds)
  if (materials.length === 0) {
    throw new ValidationError('No material lines found for the selection')
  }

  const foundIds = new Set(materials.map((m) => m.id))
  const missing = input.materialIds.filter((id) => !foundIds.has(id))
  if (missing.length > 0) {
    throw new ValidationError(
      `Material line(s) not found: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
    )
  }

  const alreadyLinked = materials.filter((m) => m.purchaseRequisitionId)
  const candidates = materials.filter((m) => !m.purchaseRequisitionId)
  if (candidates.length === 0) {
    throw new ValidationError('All selected lines already have a purchase requisition')
  }

  const shortageLines: Array<{
    material: repo.MaterialRow
    qty: ReturnType<typeof toDecimal>
  }> = []

  for (const material of candidates) {
    const warehouseId = material.warehouseId
    if (!warehouseId) continue

    const position = await getStockPosition(tenantId, material.itemId, warehouseId)
    const free = toDecimal(position.freeQty)
    const remaining = remainingToReserve(material)
    const uncovered = subDec(remaining, free)
    const fromShortageField = toDecimal(material.shortageQty)

    let qty = toDecimal(0)
    if (fromShortageField.greaterThan(0)) {
      qty = fromShortageField
    } else if (uncovered.greaterThan(0)) {
      qty = uncovered
    }

    if (!isPositive(qty)) {
      const issueRemaining = remainingToIssue(material)
      const issueShort = subDec(issueRemaining, free)
      if (issueShort.greaterThan(0)) qty = issueShort
    }

    if (isPositive(qty)) {
      shortageLines.push({ material, qty })
    }
  }

  if (shortageLines.length === 0) {
    throw new ValidationError('No material shortages found for the selected lines')
  }

  const orderIds = [...new Set(shortageLines.map((l) => l.material.productionOrderId))]
  const orders = await prisma.productionOrder.findMany({
    where: { tenantId, id: { in: orderIds }, deletedAt: null },
    select: {
      id: true,
      orderNumber: true,
      manufacturingProfile: { select: { productionWarehouseId: true } },
    },
  })
  const orderById = new Map(orders.map((o) => [o.id, o]))
  const primaryOrder = orders[0]
  if (!primaryOrder) {
    throw new ValidationError('Work order not found for selected materials')
  }

  const woLabels = orderIds
    .map((id) => orderById.get(id)?.orderNumber ?? id.slice(0, 8))
    .join(', ')

  // Keep ≤150 chars (purchase_requisition.idempotencyKey / Zod). Joining UUIDs overflows at ~3+ lines.
  const idempotencyKey =
    input.idempotencyKey ??
    `wo-shortage-pr-bulk:${createHash('sha256')
      .update([...input.materialIds].sort().join(','))
      .digest('hex')
      .slice(0, 40)}`

  const requisition = await createFromProductionShortage(req, tenantId, {
    productionOrderId: primaryOrder.id,
    warehouseId: primaryOrder.manufacturingProfile?.productionWarehouseId ?? undefined,
    priority: input.priority,
    purpose:
      orderIds.length === 1
        ? `Production shortage for WO ${primaryOrder.orderNumber} (${shortageLines.length} line(s))`
        : `Production shortage for ${shortageLines.length} line(s) across ${orderIds.length} WOs (${woLabels})`,
    idempotencyKey,
    submit: input.submit,
    rfqRequired: input.rfqRequired === true ? true : undefined,
    lines: shortageLines.map(({ material, qty }) => ({
      itemId: material.itemId,
      quantity: qty.toNumber(),
      warehouseId: material.warehouseId ?? undefined,
      uomId: material.uomId,
      bomLineId: material.bomLineId,
      productionOrderId: material.productionOrderId,
      stageId: material.issueStageGroupId ?? undefined,
      operationId: material.issueOperationId ?? undefined,
      remarks: `Shortage from material line ${material.id} · WO ${
        orderById.get(material.productionOrderId)?.orderNumber ?? material.productionOrderId
      }`,
    })),
  })

  await prisma.$transaction(async (tx) => {
    for (const { material } of shortageLines) {
      await tx.productionOrderMaterial.update({
        where: { id: material.id },
        data: {
          purchaseRequisitionId: requisition.id,
          updatedBy: userId,
        },
      })
    }
  })

  return {
    requisition,
    linkedMaterialIds: shortageLines.map((l) => l.material.id),
    skippedAlreadyLinkedIds: alreadyLinked.map((m) => m.id),
    workOrderIds: orderIds,
    workOrderNumbers: orderIds.map((id) => orderById.get(id)?.orderNumber ?? id.slice(0, 8)),
  }
}
