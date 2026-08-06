import type { PurchaseOrder, PurchaseOrderLine, PurchasePlanningRow } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { findPurchaseOrderById } from '../orders/purchase-order.repository.js'
import { mapPurchaseOrderToDto as mapPoDetailDto } from '../orders/purchase-order.mapper.js'
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
import {
  preparePurchaseOrderLinesForCreate,
  taxAmountFromLineSnapshots,
} from '../orders/purchase-order.service.js'
import type { CreatePurchaseOrderInput } from '../orders/purchase-order.validation.js'
import { linkPurchaseRequisitionLinesToOrder } from '../shared/purchase-pr-line-po-link.js'
import { resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
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
import {
  allocateVendorQtyFifo,
  assertAllocationBalances,
} from './purchase-planning-consolidation.js'

export type CreatePoFromPlanningInput = {
  rowIds: string[]
  /** Optional per-row order qty (defaults to remaining allocated qty). */
  orderQuantities?: Record<string, number>
  orderDate?: string
  deliveryWarehouseId?: string
  deliveryAddress?: string
  remarks?: string
}

export type CreatePoFromConsolidationInput = {
  planningRowIds: string[]
  allocations: Array<{ vendorId: string; quantity: number; rate: number }>
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

/** Open qty still available on a planning row for (partial) create-PO. */
function planningRowOpenQty(row: Pick<PurchasePlanningRow, 'netPurchaseQuantity' | 'requiredQuantity'>): number {
  const n = Number(row.netPurchaseQuantity)
  if (n > 0) return n
  return Math.max(0, Number(row.requiredQuantity) || 0)
}

function isPlanningOpenForConsolidation(
  row: Pick<PurchasePlanningRow, 'status' | 'netPurchaseQuantity' | 'requiredQuantity'>,
): boolean {
  if (['PO_CREATED', 'CANCELLED', 'COMPLETED'].includes(row.status)) return false
  return planningRowOpenQty(row) > 0
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

async function mapCreatedOrdersToDetailDto(
  tenantId: string,
  orders: Array<{ id: string }>,
) {
  const loaded = await Promise.all(
    orders.map(async (order) => {
      const full = await findPurchaseOrderById(tenantId, order.id)
      if (!full) {
        throw new PurchaseOrderCreationError(
          purchaseMessage(PURCHASE_ERROR_CODE.PO_NOT_FOUND),
          PURCHASE_ERROR_CODE.PO_NOT_FOUND,
        )
      }
      return mapPoDetailDto(full)
    }),
  )
  return loaded
}

type PrLineForPoContext = {
  id: string
  binId: string | null
  hsnId: string | null
  gstGroupId: string | null
  itemId: string | null
}

async function loadPlanningPoPrLineContext(tenantId: string, prLineIds: string[]) {
  if (!prLineIds.length) {
    return {
      prLineById: new Map<string, PrLineForPoContext>(),
      defaultBinByItemId: new Map<string, string | null>(),
    }
  }
  const prLines = await prisma.purchaseRequisitionLine.findMany({
    where: { tenantId, id: { in: prLineIds } },
    select: {
      id: true,
      binId: true,
      hsnId: true,
      gstGroupId: true,
      itemId: true,
    },
  })
  const prLineById = new Map(prLines.map((l) => [l.id, l]))
  const itemIds = [
    ...new Set(prLines.map((l) => l.itemId).filter((id): id is string => Boolean(id))),
  ]
  const items = itemIds.length
    ? await prisma.masterItem.findMany({
        where: { tenantId, id: { in: itemIds }, deletedAt: null },
        select: { id: true, defaultBinId: true },
      })
    : []
  return {
    prLineById,
    defaultBinByItemId: new Map(items.map((i) => [i.id, i.defaultBinId ?? null])),
  }
}

async function resolvePlanningPoBinId(
  tenantId: string,
  prLine: PrLineForPoContext | undefined,
  itemId: string | null,
  defaultBinByItemId: Map<string, string | null>,
): Promise<string | null> {
  const candidates: string[] = []
  if (prLine?.binId?.trim()) candidates.push(prLine.binId.trim())
  if (itemId) {
    const def = defaultBinByItemId.get(itemId)
    if (def?.trim()) candidates.push(def.trim())
  }
  for (const raw of candidates) {
    const bin = await prisma.masterBin.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [{ id: raw }, { code: raw }],
      },
      select: { id: true },
    })
    if (bin) return bin.id
  }
  return null
}

type VendorPoBundle = {
  vendorId: string
  vendorRows: PurchasePlanningRow[]
  preparedLines: Awaited<ReturnType<typeof preparePurchaseOrderLinesForCreate>>
  prLineLinks: Array<{ purchaseRequisitionLineId: string; orderedQuantity: number }>
  deliveryWarehouseId: string | null
  remarks: string
  first: PurchasePlanningRow
  subtotal: number
  taxAmount: number
  totalAmount: number
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

  const prLineIds = [...new Set(rows.map((r) => r.purchaseRequisitionLineId))]
  const { prLineById, defaultBinByItemId } = await loadPlanningPoPrLineContext(tenantId, prLineIds)

  const vendorPoBundles: VendorPoBundle[] = []
  for (const [vendorId, vendorRows] of vendorGroups) {
    const first = vendorRows[0]
    const deliveryWarehouseId =
      input.deliveryWarehouseId ?? first.purchaseRequisition?.warehouseId ?? null
    const remarksBase = `Created from planning (${vendorRows.map((r) => r.planningNumber).join(', ')})`
    const addressNote = input.deliveryAddress?.trim()
    const remarksExtra = input.remarks?.trim()
    const remarks = [remarksBase, addressNote ? `Delivery: ${addressNote}` : '', remarksExtra]
      .filter(Boolean)
      .join('. ')

    const lineInputs: CreatePurchaseOrderInput['lines'] = []
    const prLineLinks: Array<{ purchaseRequisitionLineId: string; orderedQuantity: number }> = []

    for (const [index, row] of vendorRows.entries()) {
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
      const prLine = prLineById.get(row.purchaseRequisitionLineId)
      const binId = await resolvePlanningPoBinId(
        tenantId,
        prLine,
        row.itemId,
        defaultBinByItemId,
      )

      lineInputs.push({
        lineNumber: index + 1,
        itemId: row.itemId,
        itemCode: row.itemCodeSnapshot,
        itemName: row.itemNameSnapshot,
        description: row.itemDescriptionSnapshot,
        uomQuantity: orderQty,
        uomId: row.uomId,
        rate,
        requiredDate: row.requiredDate ? row.requiredDate.toISOString().slice(0, 10) : null,
        purchaseRequisitionLineId: row.purchaseRequisitionLineId,
        purchasePlanningRowId: row.id,
        requisitionNumber: row.purchaseRequisitionNumberSnapshot,
        binId,
        hsnId: prLine?.hsnId ?? null,
        gstGroupId: prLine?.gstGroupId ?? null,
      })
      prLineLinks.push({
        purchaseRequisitionLineId: row.purchaseRequisitionLineId,
        orderedQuantity: orderQty,
      })
    }

    const preparedLines = await preparePurchaseOrderLinesForCreate(tenantId, lineInputs, {
      orderDate,
      vendorId,
      deliveryWarehouseId,
    })
    const subtotal = Number(
      preparedLines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0).toFixed(2),
    )
    const taxAmount = taxAmountFromLineSnapshots(preparedLines)
    const totalAmount = Number((subtotal + taxAmount).toFixed(2))

    vendorPoBundles.push({
      vendorId,
      vendorRows,
      preparedLines,
      prLineLinks,
      deliveryWarehouseId,
      remarks,
      first,
      subtotal,
      taxAmount,
      totalAmount,
    })
  }

  let createdOrders: Array<PurchaseOrder & { lines: PurchaseOrderLine[] }>
  try {
    createdOrders = await prisma.$transaction(async (tx) => {
    const orders: Array<PurchaseOrder & { lines: PurchaseOrderLine[] }> = []

    for (let i = 0; i < vendorPoBundles.length; i++) {
      const bundle = vendorPoBundles[i]!
      const { vendorId, vendorRows, preparedLines, prLineLinks, deliveryWarehouseId, remarks, first, subtotal, taxAmount, totalAmount } = bundle
      const orderNumber = reservedNumbers[i]!

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
          taxAmount,
          freightAmount: 0,
          totalAmount,
          remarks,
          createdById: actorId,
          updatedById: actorId,
          lines: {
            create: preparedLines.map((line) => ({
              ...line,
              tenantId,
            })),
          },
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      })

      for (const row of vendorRows) {
        const orderQty =
          preparedLines.find((l) => l.purchasePlanningRowId === row.id)?.uomQuantity ?? 0
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

      // Document audit links: 1:1 source slice for classic create-PO path
      for (const line of order.lines) {
        if (!line.purchaseRequisitionLineId || !line.purchasePlanningRowId) continue
        const row = vendorRows.find((r) => r.id === line.purchasePlanningRowId)
        if (!row) continue
        await tx.purchaseOrderLinePrSource.create({
          data: {
            tenantId,
            purchaseOrderLineId: line.id,
            purchaseRequisitionId: row.purchaseRequisitionId,
            purchaseRequisitionLineId: row.purchaseRequisitionLineId,
            purchasePlanningRowId: row.id,
            requisitionNumber: row.purchaseRequisitionNumberSnapshot,
            planningNumber: row.planningNumber,
            quantity: line.quantity,
          },
        })
      }

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
    orders: await mapCreatedOrdersToDetailDto(tenantId, createdOrders),
    orderCount: createdOrders.length,
    vendorCount: byVendor.size,
  }
}

/**
 * Consolidation path: one PO per vendor allocation, each with a single consolidated line
 * for the item group. PR qty slices written to PurchaseOrderLinePrSource (FIFO by required date).
 * Does not merge PR documents. Does not change inventory / costing posting.
 */
export async function createPurchaseOrdersFromConsolidation(
  tenantId: string,
  actorId: string,
  input: CreatePoFromConsolidationInput,
) {
  if (!input.planningRowIds?.length) throw new PlanningNoSelectionError()
  if (!input.allocations?.length) {
    throw new PurchaseOrderCreationError(
      'At least one vendor allocation is required.',
      PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS,
    )
  }

  const rows = await prisma.purchasePlanningRow.findMany({
    where: {
      tenantId,
      id: { in: input.planningRowIds },
      deletedAt: null,
    },
    include: {
      purchaseRequisition: true,
    },
  })

  if (rows.length !== input.planningRowIds.length) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_NOT_FOUND),
      PURCHASE_ERROR_CODE.PPS_NOT_FOUND,
    )
  }

  for (const row of rows) {
    if (row.purchaseRequisition.rfqRequired) throw new PlanningRfqRequiredError()
  }

  // PARTIALLY_ORDERED rows stay eligible while net open qty > 0 (may already link a prior PO).
  const openRows = rows.filter((r) => isPlanningOpenForConsolidation(r))
  if (!openRows.length) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS),
      PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS,
    )
  }

  const totalNet = openRows.reduce((s, r) => s + planningRowOpenQty(r), 0)

  try {
    assertAllocationBalances(
      totalNet,
      input.allocations.map((a) => ({
        vendorId: a.vendorId,
        quantity: Number(a.quantity),
        rate: Number(a.rate),
      })),
    )
  } catch (err) {
    throw new PurchaseOrderCreationError(
      err instanceof Error ? err.message : 'Invalid allocation',
      PURCHASE_ERROR_CODE.PPS_NET_QTY_INVALID as never,
    )
  }

  const remainingPool = openRows
    .map((r) => ({
      planningRowId: r.id,
      purchaseRequisitionId: r.purchaseRequisitionId,
      purchaseRequisitionLineId: r.purchaseRequisitionLineId,
      purchaseRequisitionNumber: r.purchaseRequisitionNumberSnapshot,
      planningNumber: r.planningNumber,
      remainingQty: planningRowOpenQty(r),
      requiredDate: r.requiredDate ? r.requiredDate.toISOString().slice(0, 10) : null,
    }))
    .sort((a, b) => (a.requiredDate ?? '').localeCompare(b.requiredDate ?? ''))

  type VendorPlan = {
    vendorId: string
    quantity: number
    rate: number
    slices: ReturnType<typeof allocateVendorQtyFifo>['slices']
  }

  const vendorPlans: VendorPlan[] = []
  for (const alloc of input.allocations) {
    const allocQty = Number(alloc.quantity)
    const { slices, members } = allocateVendorQtyFifo(remainingPool, allocQty)
    // mutate pool remaining
    for (const m of members) {
      const pool = remainingPool.find((p) => p.planningRowId === m.planningRowId)
      if (pool) pool.remainingQty = m.remainingQty
    }
    const slicedQty = slices.reduce((s, x) => s + x.quantity, 0)
    if (!slices.length || Math.abs(slicedQty - allocQty) > 0.0001) {
      throw new PurchaseOrderCreationError(
        'Allocation could not be distributed across PR lines.',
        PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS,
      )
    }
    vendorPlans.push({
      vendorId: alloc.vendorId,
      quantity: allocQty,
      rate: Number(alloc.rate),
      slices,
    })
  }

  const first = openRows[0]
  const reservedNumbers: string[] = []
  for (let i = 0; i < vendorPlans.length; i++) {
    reservedNumbers.push(await reservePurchaseOrderNumber(tenantId))
  }

  let createdOrders: Array<PurchaseOrder & { lines: PurchaseOrderLine[] }>
  try {
    createdOrders = await prisma.$transaction(async (tx) => {
      const orders: Array<PurchaseOrder & { lines: PurchaseOrderLine[] }> = []

      for (let i = 0; i < vendorPlans.length; i++) {
        const plan = vendorPlans[i]
        const orderNumber = reservedNumbers[i]
        const qty = plan.quantity
        const rate = plan.rate
        const amount = Number((qty * rate).toFixed(2))

        // Guard slices still have open qty (PARTIALLY_ORDERED may already have a prior PO id).
        for (const slice of plan.slices) {
          const fresh = await tx.purchasePlanningRow.findFirst({
            where: {
              id: slice.planningRowId,
              tenantId,
              deletedAt: null,
              status: { notIn: ['PO_CREATED', 'CANCELLED', 'COMPLETED'] },
            },
          })
          if (!fresh || planningRowOpenQty(fresh) + 0.0001 < slice.quantity) {
            throw new PurchaseOrderCreationError(
              purchaseMessage(PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED),
              PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED,
            )
          }
        }

        const primarySlice = plan.slices[0]
        const order = await tx.purchaseOrder.create({
          data: {
            tenantId,
            orderNumber,
            orderDate: new Date(),
            vendorId: plan.vendorId,
            origin: 'PLANNING_SHEET',
            status: 'DRAFT',
            purchaseRequisitionId: primarySlice.purchaseRequisitionId,
            deliveryWarehouseId: first.purchaseRequisition?.warehouseId ?? null,
            currencyCode: 'INR',
            expectedDeliveryDate: first.requiredDate,
            subtotalAmount: amount,
            taxAmount: 0,
            freightAmount: 0,
            totalAmount: amount,
            remarks: `Consolidated planning allocation (${plan.slices.map((s) => s.purchaseRequisitionNumber).join(', ')})`,
            createdById: actorId,
            updatedById: actorId,
            lines: {
              create: [
                {
                  tenantId,
                  lineNumber: 1,
                  purchaseRequisitionLineId: primarySlice.purchaseRequisitionLineId,
                  purchasePlanningRowId: primarySlice.planningRowId,
                  itemId: first.itemId,
                  itemCodeSnapshot: first.itemCodeSnapshot,
                  itemNameSnapshot: first.itemNameSnapshot,
                  description: first.itemDescriptionSnapshot,
                  quantity: qty,
                  uomId: first.uomId,
                  rate,
                  amount,
                  requiredDate: first.requiredDate,
                  requisitionNumber:
                    plan.slices.length > 1
                      ? `${plan.slices.length} PRs`
                      : primarySlice.purchaseRequisitionNumber,
                },
              ],
            },
          },
          include: { lines: { orderBy: { lineNumber: 'asc' } } },
        })

        const line = order.lines[0]
        for (const slice of plan.slices) {
          await tx.purchaseOrderLinePrSource.create({
            data: {
              tenantId,
              purchaseOrderLineId: line.id,
              purchaseRequisitionId: slice.purchaseRequisitionId,
              purchaseRequisitionLineId: slice.purchaseRequisitionLineId,
              purchasePlanningRowId: slice.planningRowId,
              requisitionNumber: slice.purchaseRequisitionNumber,
              planningNumber: slice.planningNumber,
              quantity: slice.quantity,
            },
          })
        }

        await linkPurchaseRequisitionLinesToOrder(
          tx,
          tenantId,
          order.id,
          order.orderNumber,
          plan.slices.map((s) => s.purchaseRequisitionLineId),
        )

        orders.push(order)
      }

      // After all vendor POs: reduce residual open qty; full → PO_CREATED, partial → PARTIALLY_ORDERED.
      // Residual net stays on the planning row so the consolidated sheet group remains with reduced demand.
      const qtyByPlanning = new Map<string, number>()
      const lastOrderByPlanning = new Map<string, { id: string; number: string; vendorId: string }>()
      for (let i = 0; i < vendorPlans.length; i++) {
        const plan = vendorPlans[i]
        const order = orders[i]
        for (const slice of plan.slices) {
          qtyByPlanning.set(
            slice.planningRowId,
            (qtyByPlanning.get(slice.planningRowId) ?? 0) + slice.quantity,
          )
          lastOrderByPlanning.set(slice.planningRowId, {
            id: order.id,
            number: order.orderNumber,
            vendorId: plan.vendorId,
          })
        }
      }

      for (const row of openRows) {
        const ordered = qtyByPlanning.get(row.id) ?? 0
        if (ordered <= 0) continue
        const need = planningRowOpenQty(row)
        const last = lastOrderByPlanning.get(row.id)
        if (!last) continue
        const residual = Number(Math.max(0, need - ordered).toFixed(4))
        const full = residual <= 0.0001
        const rate = Number(row.negotiatedRate ?? row.expectedRate) || 0
        const openPoQty = Number(row.openPurchaseOrderQuantity) || 0
        await tx.purchasePlanningRow.updateMany({
          where: { id: row.id, tenantId, deletedAt: null },
          data: {
            status: full ? 'PO_CREATED' : 'PARTIALLY_ORDERED',
            netPurchaseQuantity: full ? 0 : residual,
            openPurchaseOrderQuantity: Number((openPoQty + ordered).toFixed(4)),
            estimatedAmount: full ? 0 : Number((residual * rate).toFixed(2)),
            purchaseOrderId: last.id,
            purchaseOrderNumberSnapshot: last.number,
            convertedAt: new Date(),
            actionMessage: false,
            selectedVendorId: last.vendorId,
            updatedById: actorId,
          },
        })
      }

      const prIds = [...new Set(openRows.map((r) => r.purchaseRequisitionId))]
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
        origin: 'PLANNING_SHEET_CONSOLIDATED',
        vendorId: order.vendorId,
      },
    })
  }

  return {
    orders: await mapCreatedOrdersToDetailDto(tenantId, createdOrders),
    orderCount: createdOrders.length,
    vendorCount: vendorPlans.length,
  }
}

/** Test helper — exposed for unit coverage of grouping. */
export function groupRowsForTests(rows: Array<{ selectedVendorId: string | null }>) {
  return groupPlanningRowsByVendor(rows)
}

export type { PurchasePlanningRow }
