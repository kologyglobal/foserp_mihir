import type { PurchaseOrder, PurchaseOrderLine, PurchasePlanningRow } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { mapPurchaseOrderToDto } from '../comparisons/comparison.mapper.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { nextPurchaseDocumentNumber } from '../shared/purchase-document-number.js'
import { linkPurchaseRequisitionLinesToOrder } from '../shared/purchase-pr-line-po-link.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  PlanningNoSelectionError,
  PlanningRfqRequiredError,
  PurchaseOrderCreationError,
} from './purchase-planning.errors.js'
import {
  assertPlanningRowReadyForPo,
  derivePrConversionStatus,
  groupPlanningRowsByVendor,
} from './purchase-planning.workflow.js'

export type CreatePoFromPlanningInput = {
  rowIds: string[]
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

      // Concurrent guard: every row must still be unconverted
      for (const row of vendorRows) {
        const fresh = await tx.purchasePlanningRow.findFirst({
          where: {
            id: row.id,
            tenantId,
            deletedAt: null,
            purchaseOrderId: null,
            status: { notIn: ['PO_CREATED', 'CANCELLED', 'COMPLETED'] },
          },
        })
        if (!fresh) {
          throw new PurchaseOrderCreationError(
            purchaseMessage(PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED),
            PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED,
          )
        }
      }

      const first = vendorRows[0]
      let subtotal = 0
      const lineCreates = vendorRows.map((row, index) => {
        const qty = Number(row.netPurchaseQuantity)
        const rate = Number(row.negotiatedRate ?? row.expectedRate)
        const amount = Number((qty * rate).toFixed(2))
        subtotal += amount
        return {
          tenantId,
          lineNumber: index + 1,
          purchaseRequisitionLineId: row.purchaseRequisitionLineId,
          purchasePlanningRowId: row.id,
          itemId: row.itemId,
          itemCodeSnapshot: row.itemCodeSnapshot,
          itemNameSnapshot: row.itemNameSnapshot,
          description: row.itemDescriptionSnapshot,
          quantity: qty,
          uomId: row.uomId,
          rate,
          amount,
          requiredDate: row.requiredDate,
        }
      })

      const order = await tx.purchaseOrder.create({
        data: {
          tenantId,
          orderNumber,
          orderDate: new Date(),
          vendorId,
          origin: 'PLANNING_SHEET',
          status: 'DRAFT',
          purchaseRequisitionId: first.purchaseRequisitionId,
          currencyCode: 'INR',
          expectedDeliveryDate: first.requiredDate,
          subtotalAmount: subtotal,
          taxAmount: 0,
          freightAmount: 0,
          totalAmount: subtotal,
          remarks: `Created from planning (${vendorRows.map((r) => r.planningNumber).join(', ')})`,
          createdById: actorId,
          updatedById: actorId,
          lines: { create: lineCreates },
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      })

      for (const row of vendorRows) {
        const updated = await tx.purchasePlanningRow.updateMany({
          where: {
            id: row.id,
            tenantId,
            purchaseOrderId: null,
            deletedAt: null,
          },
          data: {
            status: 'PO_CREATED',
            purchaseOrderId: order.id,
            purchaseOrderNumberSnapshot: order.orderNumber,
            convertedAt: new Date(),
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
        vendorRows.map((r) => r.purchaseRequisitionLineId),
      )

      orders.push(order)
    }

    // Update PR conversion status per affected requisition
    const prIds = [...new Set(rows.map((r) => r.purchaseRequisitionId))]
    for (const prId of prIds) {
      const planning = await tx.purchasePlanningRow.findMany({
        where: { tenantId, purchaseRequisitionId: prId, deletedAt: null },
        select: { status: true },
      })
      const next = derivePrConversionStatus(planning.map((p) => p.status))
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
