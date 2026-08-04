import type { PurchaseOrder, PurchaseOrderLine, PurchasePlanningRow } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { mapPurchaseOrderToDto } from '../comparisons/comparison.mapper.js'
import {
  assertPoOrderDateAllowed,
  toPoBackdatePolicy,
} from '../orders/purchase-order-backdate.js'
import { parseDateInput } from '../orders/purchase-order.workflow.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { nextPurchaseDocumentNumber } from '../shared/purchase-document-number.js'
import { enrichPoLinesWithItemUomMappings } from '../shared/item-uom-resolution.js'
import { linkPurchaseRequisitionLinesToOrder } from '../shared/purchase-pr-line-po-link.js'
import { resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  lineAmountFromVendor,
  resolveDualQuantities,
  toPrimaryUnitCost,
} from '../shared/uom-conversion.js'
import {
  PlanningNoSelectionError,
  PlanningRfqRequiredError,
  PurchaseOrderCreationError,
} from './purchase-planning.errors.js'
import {
  assertPlanningRowReadyForPo,
  derivePrConversionStatus,
  derivePrHeaderConversionFromLines,
  groupPlanningRowsByVendor,
  planningAllocatedQuantity,
  planningRemainingQuantity,
} from './purchase-planning.workflow.js'

export type CreatePoFromPlanningInput = {
  rowIds: string[]
  /** Optional per-row order qty (defaults to remaining allocated qty). */
  orderQuantities?: Record<string, number>
  orderDate?: string
  deliveryWarehouseId?: string
  deliveryAddress?: string
  remarks?: string
}

function isTransactionWriteConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  if (code === 'P2034' || code === 'P2028') return true
  const cause = (err as { meta?: { driverAdapterError?: { cause?: { code?: string } } } }).meta
    ?.driverAdapterError?.cause?.code
  return cause === 'WriteConflict' || cause === 'Deadlock'
}

async function reservePurchaseOrderNumber(tenantId: string): Promise<string> {
  return nextPurchaseDocumentNumber(tenantId, 'PURCHASE_ORDER', 'PO')
}

async function isMasterActive(
  tenantId: string,
  model: 'masterVendor' | 'masterItem' | 'masterUom',
  id: string | null | undefined,
): Promise<boolean | undefined> {
  if (!id) return undefined
  if (model === 'masterVendor') {
    const row = await prisma.masterVendor.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { status: true },
    })
    return Boolean(row && row.status === 'ACTIVE')
  }
  if (model === 'masterItem') {
    const row = await prisma.masterItem.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { status: true },
    })
    return Boolean(row && row.status === 'ACTIVE')
  }
  const row = await prisma.masterUom.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { status: true },
  })
  return Boolean(row && row.status === 'ACTIVE')
}

/**
 * Create one draft PO per vendor from selected Planning Sheet rows.
 * Single transaction — failed mid-flight leaves no partial POs or status updates.
 */
export async function createPurchaseOrdersFromPlanning(
  tenantId: string,
  actorId: string,
  input: CreatePoFromPlanningInput,
) {
  if (!input.rowIds?.length) throw new PlanningNoSelectionError()

  const settings = await resolveEffectivePurchaseDefaults(tenantId)
  const orderDate =
    input.orderDate != null ? parseDateInput(input.orderDate) ?? new Date() : new Date()
  assertPoOrderDateAllowed(orderDate, toPoBackdatePolicy(settings))

  const rows = await prisma.purchasePlanningRow.findMany({
    where: {
      tenantId,
      id: { in: input.rowIds },
      deletedAt: null,
    },
    include: {
      purchaseRequisition: true,
    },
  })

  if (rows.length !== input.rowIds.length) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_NOT_FOUND),
      PURCHASE_ERROR_CODE.PPS_NOT_FOUND,
    )
  }

  for (const row of rows) {
    if (row.purchaseRequisition.rfqRequired) {
      throw new PlanningRfqRequiredError()
    }
    if (row.tenantId !== tenantId) {
      throw new PurchaseOrderCreationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_TENANT_MISMATCH),
        PURCHASE_ERROR_CODE.PO_TENANT_MISMATCH,
      )
    }

    const vendorActive = await isMasterActive(tenantId, 'masterVendor', row.selectedVendorId)
    const itemActive = await isMasterActive(tenantId, 'masterItem', row.itemId)
    const uomActive = await isMasterActive(tenantId, 'masterUom', row.uomId)

    assertPlanningRowReadyForPo(row, {
      tenantId,
      rfqRequired: false,
      vendorActive: vendorActive === false ? false : vendorActive,
      itemActive: row.itemId ? (itemActive === false ? false : itemActive) : undefined,
      uomActive: row.uomId ? (uomActive === false ? false : uomActive) : undefined,
      hasCommercialTerms: Number(row.negotiatedRate ?? row.expectedRate) > 0,
    })
  }

  const byVendor = groupPlanningRowsByVendor(rows)
  if (byVendor.size === 0) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS),
      PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS,
    )
  }

  // Reserve PO numbers outside the write transaction (avoids nested-tx code-series adapter issues).
  const vendorGroups = [...byVendor.entries()]
  const reservedNumbers: string[] = []
  for (let i = 0; i < vendorGroups.length; i++) {
    reservedNumbers.push(await reservePurchaseOrderNumber(tenantId))
  }

  let createdOrders: Array<PurchaseOrder & { lines: PurchaseOrderLine[] }>
  try {
    createdOrders = await prisma.$transaction(async (tx) => {
    const orders: Array<PurchaseOrder & { lines: PurchaseOrderLine[] }> = []

    for (let i = 0; i < vendorGroups.length; i++) {
      const [vendorId, vendorRows] = vendorGroups[i]
      const orderNumber = reservedNumbers[i]

      // Concurrent guard: row must still have remaining alloc qty
      for (const row of vendorRows) {
        const fresh = await tx.purchasePlanningRow.findFirst({
          where: {
            id: row.id,
            tenantId,
            deletedAt: null,
            status: { notIn: ['CANCELLED', 'COMPLETED'] },
          },
        })
        if (!fresh || !(planningRemainingQuantity(fresh) > 0)) {
          throw new PurchaseOrderCreationError(
            purchaseMessage(PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED),
            PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED,
          )
        }
      }

      const first = vendorRows[0]
      let subtotal = 0
      const rawLineCreates: Array<{
        tenantId: string
        lineNumber: number
        purchaseRequisitionLineId: string
        purchasePlanningRowId: string
        itemId: string | null
        itemCodeSnapshot: string
        itemNameSnapshot: string
        description: string | null
        uomQuantity: number
        uomId: string | null
        rate: number
        requiredDate: Date | null
        rowId: string
      }> = []
      const prLineLinks: Array<{ purchaseRequisitionLineId: string; orderedQuantity: number }> = []

      vendorRows.forEach((row, index) => {
        const remaining = planningRemainingQuantity(row)
        const requested = input.orderQuantities?.[row.id]
        const orderQty =
          requested != null && Number(requested) > 0
            ? Math.min(Number(requested), remaining)
            : remaining
        if (!(orderQty > 0)) {
          throw new PurchaseOrderCreationError(
            purchaseMessage(PURCHASE_ERROR_CODE.PPS_NET_QTY_INVALID),
            PURCHASE_ERROR_CODE.PPS_NET_QTY_INVALID,
          )
        }
        const rate = Number(row.negotiatedRate ?? row.expectedRate)
        rawLineCreates.push({
          tenantId,
          lineNumber: index + 1,
          purchaseRequisitionLineId: row.purchaseRequisitionLineId,
          purchasePlanningRowId: row.id,
          itemId: row.itemId,
          itemCodeSnapshot: row.itemCodeSnapshot,
          itemNameSnapshot: row.itemNameSnapshot,
          description: row.itemDescriptionSnapshot,
          uomQuantity: orderQty,
          uomId: row.uomId,
          rate,
          requiredDate: row.requiredDate,
          rowId: row.id,
        })
        prLineLinks.push({
          purchaseRequisitionLineId: row.purchaseRequisitionLineId,
          orderedQuantity: orderQty,
        })
      })

      const enriched = await enrichPoLinesWithItemUomMappings(
        tenantId,
        rawLineCreates.map((l) => ({
          itemId: l.itemId,
          uomId: l.uomId,
          uomQuantity: l.uomQuantity,
        })),
      )

      const lineCreates: Array<{
        tenantId: string
        lineNumber: number
        purchaseRequisitionLineId: string
        purchasePlanningRowId: string
        itemId: string | null
        itemCodeSnapshot: string
        itemNameSnapshot: string
        description: string | null
        quantity: number
        uomQuantity: number
        uomConversionFactor: number
        unitCostPrimary: number
        uomId: string | null
        rate: number
        amount: number
        requiredDate: Date | null
      }> = []

      rawLineCreates.forEach((raw, index) => {
        const uomMeta = enriched[index]
        const dual = resolveDualQuantities({
          uomQuantity: raw.uomQuantity,
          uomConversionFactor: uomMeta?.uomConversionFactor ?? 1,
        })
        const factor = dual.uomConversionFactor
        const unitCostPrimary = toPrimaryUnitCost(raw.rate, factor)
        const amount = Number(lineAmountFromVendor(raw.rate, dual.uomQuantity).toFixed(2))
        subtotal += amount
        lineCreates.push({
          tenantId: raw.tenantId,
          lineNumber: raw.lineNumber,
          purchaseRequisitionLineId: raw.purchaseRequisitionLineId,
          purchasePlanningRowId: raw.purchasePlanningRowId,
          itemId: raw.itemId,
          itemCodeSnapshot: raw.itemCodeSnapshot,
          itemNameSnapshot: raw.itemNameSnapshot,
          description: raw.description,
          quantity: dual.quantity,
          uomQuantity: dual.uomQuantity,
          uomConversionFactor: factor,
          unitCostPrimary,
          uomId: uomMeta?.uomId ?? raw.uomId,
          rate: raw.rate,
          amount,
          requiredDate: raw.requiredDate,
        })
      })

      const deliveryWarehouseId =
        input.deliveryWarehouseId ?? first.purchaseRequisition?.warehouseId ?? null
      const remarksBase = `Created from planning (${vendorRows.map((r) => r.planningNumber).join(', ')})`
      const addressNote = input.deliveryAddress?.trim()
      const remarksExtra = input.remarks?.trim()
      const remarks = [remarksBase, addressNote ? `Delivery: ${addressNote}` : '', remarksExtra]
        .filter(Boolean)
        .join('. ')

      const order = await tx.purchaseOrder.create({
        data: {
          tenantId,
          orderNumber,
          orderDate,
          vendorId,
          origin: 'PLANNING_SHEET',
          status: 'DRAFT',
          purchaseRequisitionId: first.purchaseRequisitionId,
          deliveryWarehouseId,
          currencyCode: 'INR',
          expectedDeliveryDate: first.requiredDate,
          subtotalAmount: subtotal,
          taxAmount: 0,
          freightAmount: 0,
          totalAmount: subtotal,
          remarks,
          createdById: actorId,
          updatedById: actorId,
          lines: { create: lineCreates },
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      })

      for (const row of vendorRows) {
        const orderQty =
          lineCreates.find((l) => l.purchasePlanningRowId === row.id)?.uomQuantity ?? 0
        const nextOrdered = (Number(row.orderedQuantity) || 0) + orderQty
        const allocated = planningAllocatedQuantity(row)
        const fullyOrdered = nextOrdered >= allocated - 1e-6
        const updated = await tx.purchasePlanningRow.updateMany({
          where: {
            id: row.id,
            tenantId,
            deletedAt: null,
          },
          data: {
            status: fullyOrdered ? 'PO_CREATED' : 'PARTIALLY_ORDERED',
            orderedQuantity: nextOrdered,
            purchaseOrderId: row.purchaseOrderId ?? order.id,
            purchaseOrderNumberSnapshot: order.orderNumber,
            convertedAt: fullyOrdered ? new Date() : row.convertedAt,
            actionMessage: false,
            updatedById: actorId,
          },
        })
        if (updated.count !== 1) {
          throw new PurchaseOrderCreationError(
            purchaseMessage(PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED),
            PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED,
          )
        }
      }

      await linkPurchaseRequisitionLinesToOrder(
        tx,
        tenantId,
        order.id,
        order.orderNumber,
        prLineLinks,
      )

      orders.push(order)
    }

    // Update PR conversion status per affected requisition
    const prIds = [...new Set(rows.map((r) => r.purchaseRequisitionId))]
    for (const prId of prIds) {
      const [planning, prLines] = await Promise.all([
        tx.purchasePlanningRow.findMany({
          where: { tenantId, purchaseRequisitionId: prId, deletedAt: null },
          select: { status: true },
        }),
        tx.purchaseRequisitionLine.findMany({
          where: { tenantId, purchaseRequisitionId: prId },
          select: { requiredQuantity: true, orderedQuantity: true, status: true },
        }),
      ])
      const fromLines = derivePrHeaderConversionFromLines(prLines)
      const fromPlanning = derivePrConversionStatus(planning.map((p) => p.status))
      const next = fromLines ?? fromPlanning
      if (!next) continue
      await tx.purchaseRequisition.update({
        where: { id: prId },
        data: { status: next, updatedById: actorId },
      })
    }

    return orders
  })
  } catch (err) {
    if (isTransactionWriteConflict(err)) {
      throw new PurchaseOrderCreationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED),
        PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED,
      )
    }
    throw err
  }

  for (const order of createdOrders) {
    await writePurchaseAudit({
      tenantId,
      actorId,
      entity: PURCHASE_AUDIT_ENTITY.PO,
      entityId: order.id,
      action: PURCHASE_AUDIT_ACTION.PO_CREATED,
      newValue: {
        orderNumber: order.orderNumber,
        origin: 'PLANNING_SHEET',
        vendorId: order.vendorId,
      },
    })
    for (const line of order.lines) {
      if (!line.purchasePlanningRowId) continue
      await writePurchaseAudit({
        tenantId,
        actorId,
        entity: PURCHASE_AUDIT_ENTITY.PLANNING,
        entityId: line.purchasePlanningRowId,
        action: PURCHASE_AUDIT_ACTION.PPS_CONVERTED_TO_PO,
        newValue: { purchaseOrderId: order.id, orderNumber: order.orderNumber },
      })
    }
  }

  return {
    orders: createdOrders.map((o) => mapPurchaseOrderToDto(o)),
    orderCount: createdOrders.length,
    vendorCount: byVendor.size,
  }
}

/** Test helper — exposed for unit coverage of grouping. */
export function groupRowsForTests(rows: Array<{ selectedVendorId: string | null }>) {
  return groupPlanningRowsByVendor(rows)
}

export type { PurchasePlanningRow }
