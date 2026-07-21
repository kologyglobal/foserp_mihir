import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import {
  nextPurchaseDocumentNumber,
  previewPurchaseDocumentNumber,
} from '../shared/purchase-document-number.js'
import {
  isSelfApprovalAllowed,
  resolveDeliveryWarehouseId,
  resolveEffectivePurchaseDefaults,
} from '../shared/purchase-defaults.js'
import {
  assertDirectPoAllowed,
  assertShortCloseAllowed,
  getPurchasePolicy,
  matrixRoleToApi,
  resolveDocumentApprovalRoles,
} from '../shared/purchase-setup-enforcement.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  PurchaseOrderNotFoundError,
  PurchaseOrderValidationError,
  PurchaseOrderWorkflowError,
} from './purchase-order.errors.js'
import { mapPurchaseOrderToDto } from './purchase-order.mapper.js'
import * as repo from './purchase-order.repository.js'
import type {
  CreatePurchaseOrderInput,
  ListPurchaseOrdersQuery,
  PoLifecycleRemarksInput,
  PoReasonInput,
  UpdatePurchaseOrderInput,
} from './purchase-order.validation.js'
import {
  assertApprovable,
  assertCancellable,
  assertCloseable,
  assertEditable,
  assertReasonPresent,
  assertRejectable,
  assertReopenable,
  assertSendBackable,
  assertSendableToVendor,
  assertSubmittable,
  deriveReceiptStatus,
  isSelfApproval,
  money,
  normalizeLineInputs,
  parseDateInput,
} from './purchase-order.workflow.js'

async function loadOrThrow(tenantId: string, id: string) {
  const order = await repo.findPurchaseOrderById(tenantId, id)
  if (!order) throw new PurchaseOrderNotFoundError()
  return order
}

async function assertApprovalAssignedToActor(
  tenantId: string,
  purchaseOrderId: string,
  actorId: string,
) {
  const approval = await prisma.purchaseApproval.findFirst({
    where: { tenantId, purchaseOrderId, status: 'PENDING' },
    select: { approverId: true },
  })
  if (approval?.approverId && approval.approverId !== actorId) {
    throw new PurchaseOrderWorkflowError(
      purchaseMessage(PURCHASE_ERROR_CODE.APPROVAL_ASSIGNED_TO_ANOTHER_USER),
      PURCHASE_ERROR_CODE.APPROVAL_ASSIGNED_TO_ANOTHER_USER,
    )
  }
}

async function assertVendorActive(tenantId: string, vendorId: string) {
  const vendor = await prisma.masterVendor.findFirst({
    where: { id: vendorId, tenantId, deletedAt: null },
    select: { status: true },
  })
  if (!vendor || vendor.status !== 'ACTIVE') {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE),
      PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE,
      [{ field: 'vendorId', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE) }],
    )
  }
}

async function assertLineMastersActive(
  tenantId: string,
  lines: Array<{ itemId: string | null; uomId: string | null }>,
) {
  const itemIds = [...new Set(lines.map((l) => l.itemId).filter((v): v is string => Boolean(v)))]
  const uomIds = [...new Set(lines.map((l) => l.uomId).filter((v): v is string => Boolean(v)))]
  if (itemIds.length) {
    const activeCount = await prisma.masterItem.count({
      where: { id: { in: itemIds }, tenantId, deletedAt: null, status: 'ACTIVE' },
    })
    if (activeCount !== itemIds.length) {
      throw new PurchaseOrderValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_ITEM_INACTIVE),
        PURCHASE_ERROR_CODE.PO_ITEM_INACTIVE,
        [{ field: 'lines.itemId', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_ITEM_INACTIVE) }],
      )
    }
  }
  if (uomIds.length) {
    const activeCount = await prisma.masterUom.count({
      where: { id: { in: uomIds }, tenantId, deletedAt: null, status: 'ACTIVE' },
    })
    if (activeCount !== uomIds.length) {
      throw new PurchaseOrderValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_UOM_INACTIVE),
        PURCHASE_ERROR_CODE.PO_UOM_INACTIVE,
        [{ field: 'lines.uomId', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_UOM_INACTIVE) }],
      )
    }
  }
}

async function assertWarehouseActive(tenantId: string, warehouseId: string) {
  const warehouse = await prisma.masterWarehouse.findFirst({
    where: { id: warehouseId, tenantId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, plantId: true },
  })
  if (!warehouse) {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.SETUP_WAREHOUSE_INACTIVE),
      PURCHASE_ERROR_CODE.SETUP_WAREHOUSE_INACTIVE,
      [{ field: 'deliveryWarehouseId', message: purchaseMessage(PURCHASE_ERROR_CODE.SETUP_WAREHOUSE_INACTIVE) }],
    )
  }
  return warehouse
}

async function resolveSourceWarehouseId(
  tenantId: string,
  purchaseRequisitionId: string | null | undefined,
): Promise<string | null> {
  if (!purchaseRequisitionId) return null
  const pr = await prisma.purchaseRequisition.findFirst({
    where: { id: purchaseRequisitionId, tenantId, deletedAt: null },
    select: {
      warehouseId: true,
      lines: { select: { warehouseId: true }, take: 20 },
    },
  })
  if (!pr) return null
  if (pr.warehouseId) return pr.warehouseId
  return pr.lines.find((l) => l.warehouseId)?.warehouseId ?? null
}

/** Fill item code/name snapshots from the item master when only itemId was sent. */
async function fillItemSnapshots(
  tenantId: string,
  lines: ReturnType<typeof normalizeLineInputs>,
) {
  const missing = lines.filter((l) => l.itemId && (!l.itemCodeSnapshot || !l.itemNameSnapshot))
  if (!missing.length) return lines
  const items = await prisma.masterItem.findMany({
    where: { tenantId, id: { in: missing.map((l) => l.itemId!) }, deletedAt: null },
    select: { id: true, code: true, name: true },
  })
  const byId = new Map(items.map((i) => [i.id, i]))
  for (const line of missing) {
    const item = byId.get(line.itemId!)
    if (item) {
      if (!line.itemCodeSnapshot) line.itemCodeSnapshot = item.code
      if (!line.itemNameSnapshot) line.itemNameSnapshot = item.name
    }
  }
  return lines
}

function computeTotals(
  lines: Array<{ amount: number }>,
  taxAmount: number,
  freightAmount: number,
) {
  const subtotal = money(lines.reduce((sum, l) => sum + l.amount, 0))
  return {
    subtotalAmount: subtotal,
    taxAmount: money(taxAmount),
    freightAmount: money(freightAmount),
    totalAmount: money(subtotal + taxAmount + freightAmount),
  }
}

export async function listPurchaseOrders(tenantId: string, query: ListPurchaseOrdersQuery) {
  const result = await repo.findPurchaseOrders(tenantId, query)
  return {
    items: result.items.map(mapPurchaseOrderToDto),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getPurchaseOrder(tenantId: string, id: string) {
  const order = await loadOrThrow(tenantId, id)
  return mapPurchaseOrderToDto(order)
}

export async function previewNextPurchaseOrderNumber(tenantId: string) {
  const orderNumber = await previewPurchaseDocumentNumber(tenantId, 'PURCHASE_ORDER', 'PO')
  return { orderNumber }
}

export async function createPurchaseOrder(
  tenantId: string,
  actorId: string,
  input: CreatePurchaseOrderInput,
) {
  await assertVendorActive(tenantId, input.vendorId)
  const lines = await fillItemSnapshots(tenantId, normalizeLineInputs(input.lines))
  await assertLineMastersActive(tenantId, lines)

  const sourceWarehouseId = await resolveSourceWarehouseId(tenantId, input.purchaseRequisitionId)
  const deliveryWarehouseId = await resolveDeliveryWarehouseId({
    tenantId,
    explicitWarehouseId: input.deliveryWarehouseId,
    sourceWarehouseId,
  })
  const settings = await resolveEffectivePurchaseDefaults(tenantId)
  const directPoError = assertDirectPoAllowed(settings, Boolean(input.purchaseRequisitionId))
  if (directPoError) {
    throw new PurchaseOrderValidationError(directPoError, PURCHASE_ERROR_CODE.PO_VALIDATION_FAILED, [
      { field: 'purchaseRequisitionId', message: directPoError },
    ])
  }
  if (settings.requirePoWarehouse && !deliveryWarehouseId) {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_WAREHOUSE_REQUIRED),
      PURCHASE_ERROR_CODE.PO_WAREHOUSE_REQUIRED,
      [{ field: 'deliveryWarehouseId', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_WAREHOUSE_REQUIRED) }],
    )
  }
  if (deliveryWarehouseId) await assertWarehouseActive(tenantId, deliveryWarehouseId)

  const totals = computeTotals(lines, input.taxAmount ?? 0, input.freightAmount ?? 0)
  const orderNumber = await nextPurchaseDocumentNumber(tenantId, 'PURCHASE_ORDER', 'PO')

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.create({
      data: {
        tenantId,
        orderNumber,
        orderDate: parseDateInput(input.orderDate) ?? new Date(),
        vendorId: input.vendorId,
        origin: input.purchaseRequisitionId ? 'PURCHASE_REQUISITION' : 'MANUAL',
        status: 'DRAFT',
        purchaseRequisitionId: input.purchaseRequisitionId ?? null,
        currencyCode: input.currencyCode ?? settings.defaultCurrencyCode ?? 'INR',
        expectedDeliveryDate: parseDateInput(input.expectedDeliveryDate) ?? null,
        paymentTerms:
          input.paymentTerms?.trim() ||
          settings.defaultPaymentTermName ||
          settings.defaultPaymentTermCode ||
          null,
        deliveryTerms:
          input.deliveryTerms?.trim() || settings.defaultDeliveryTerms || null,
        deliveryWarehouseId,
        ...totals,
        remarks: input.remarks?.trim() || null,
        createdById: actorId,
        updatedById: actorId,
        lines: { create: lines.map((line) => ({ ...line, tenantId })) },
      },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: order.id,
        documentNumber: order.orderNumber,
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        actorId,
      },
      tx,
    )

    return order
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PO,
    entityId: created.id,
    action: PURCHASE_AUDIT_ACTION.PO_CREATED,
    newValue: {
      orderNumber: created.orderNumber,
      origin: created.origin,
      vendorId: created.vendorId,
      deliveryWarehouseId: created.deliveryWarehouseId,
      totalAmount: Number(created.totalAmount),
      lineCount: created.lines.length,
    },
  })

  const fresh = await loadOrThrow(tenantId, created.id)
  return mapPurchaseOrderToDto(fresh)
}

export async function updatePurchaseOrder(
  tenantId: string,
  id: string,
  actorId: string,
  input: UpdatePurchaseOrderInput,
) {
  const existing = await loadOrThrow(tenantId, id)
  assertEditable(existing)

  if (input.vendorId && input.vendorId !== existing.vendorId) {
    await assertVendorActive(tenantId, input.vendorId)
  }

  let lines: ReturnType<typeof normalizeLineInputs> | null = null
  if (input.lines !== undefined) {
    lines = await fillItemSnapshots(tenantId, normalizeLineInputs(input.lines))
    await assertLineMastersActive(tenantId, lines)
    // Preserve PR/Planning references when the client resends existing lines by id.
    const existingById = new Map(existing.lines.map((l) => [l.id, l]))
    input.lines.forEach((inputLine, index) => {
      const prev = inputLine.id ? existingById.get(inputLine.id) : undefined
      if (prev && lines) {
        lines[index].purchaseRequisitionLineId ??= prev.purchaseRequisitionLineId
        lines[index].purchasePlanningRowId ??= prev.purchasePlanningRowId
      }
    })
  }

  const effectiveLines = lines ?? existing.lines.map((l) => ({ amount: Number(l.amount) }))
  const totals = computeTotals(
    effectiveLines,
    input.taxAmount ?? Number(existing.taxAmount),
    input.freightAmount ?? Number(existing.freightAmount),
  )

  const data: Prisma.PurchaseOrderUncheckedUpdateInput = {
    updatedById: actorId,
    ...totals,
  }
  if (input.orderDate !== undefined) {
    data.orderDate = parseDateInput(input.orderDate) ?? existing.orderDate
  }
  if (input.vendorId !== undefined) data.vendorId = input.vendorId
  if (input.expectedDeliveryDate !== undefined) {
    data.expectedDeliveryDate = parseDateInput(input.expectedDeliveryDate) ?? null
  }
  if (input.currencyCode !== undefined) data.currencyCode = input.currencyCode
  if (input.paymentTerms !== undefined) data.paymentTerms = input.paymentTerms?.trim() || null
  if (input.deliveryTerms !== undefined) data.deliveryTerms = input.deliveryTerms?.trim() || null
  if (input.deliveryWarehouseId !== undefined) {
    if (input.deliveryWarehouseId) {
      await assertWarehouseActive(tenantId, input.deliveryWarehouseId)
    }
    data.deliveryWarehouseId = input.deliveryWarehouseId
  }
  if (input.remarks !== undefined) data.remarks = input.remarks?.trim() || null

  const settings = await resolveEffectivePurchaseDefaults(tenantId)
  const effectiveWarehouseId =
    input.deliveryWarehouseId !== undefined
      ? input.deliveryWarehouseId
      : existing.deliveryWarehouseId
  if (settings.requirePoWarehouse && !effectiveWarehouseId) {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_WAREHOUSE_REQUIRED),
      PURCHASE_ERROR_CODE.PO_WAREHOUSE_REQUIRED,
      [{ field: 'deliveryWarehouseId', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_WAREHOUSE_REQUIRED) }],
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (lines) {
      await repo.replacePurchaseOrderLines(tenantId, id, lines, tx)
    }
    const order = await repo.updatePurchaseOrder(tenantId, id, data, tx)
    if (!order) throw new PurchaseOrderNotFoundError()

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: order.id,
        documentNumber: order.orderNumber,
        action: 'UPDATED',
        fromStatus: existing.status,
        toStatus: order.status,
        actorId,
      },
      tx,
    )

    return order
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PO,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.PO_UPDATED,
    previousValue: {
      vendorId: existing.vendorId,
      totalAmount: Number(existing.totalAmount),
      lineCount: existing.lines.length,
    },
    newValue: {
      vendorId: updated.vendorId,
      totalAmount: Number(updated.totalAmount),
      lineCount: updated.lines.length,
    },
  })

  return mapPurchaseOrderToDto(updated)
}

type LifecycleTransition = {
  action: string
  auditAction: string
  data: Prisma.PurchaseOrderUncheckedUpdateInput
  approvalResolution?: 'APPROVED' | 'REJECTED' | 'RETURNED' | 'CANCELLED'
  createApproval?: boolean
  remarks?: string | null
  /** Extra fields merged into the audit newValue (e.g. selfApproved traceability flag). */
  auditExtra?: Record<string, unknown>
}

async function applyLifecycleTransition(
  tenantId: string,
  actorId: string,
  existing: Awaited<ReturnType<typeof loadOrThrow>>,
  transition: LifecycleTransition,
) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await repo.updatePurchaseOrder(
      tenantId,
      existing.id,
      { ...transition.data, updatedById: actorId },
      tx,
    )
    if (!order) throw new PurchaseOrderNotFoundError()

    if (transition.createApproval) {
      const defaults = await getPurchasePolicy(tenantId)
      const roles = resolveDocumentApprovalRoles(
        defaults,
        Number(order.totalAmount),
        'PURCHASE_ORDER',
      )
      await repo.createApprovalRequest(
        {
          tenantId,
          documentId: order.id,
          documentNumber: order.orderNumber,
          requesterId: actorId,
          amount: Number(order.totalAmount),
          level: 1,
          approverRole: matrixRoleToApi(roles[0]!),
        },
        tx,
      )
    }
    if (transition.approvalResolution === 'APPROVED') {
      const pending = await tx.purchaseApproval.findFirst({
        where: { tenantId, purchaseOrderId: existing.id, status: 'PENDING' },
        orderBy: { level: 'asc' },
      })
      if (pending) {
        await tx.purchaseApproval.update({
          where: { id: pending.id },
          data: {
            status: 'APPROVED',
            approverId: actorId,
            respondedAt: new Date(),
            remarks: transition.remarks ?? null,
          },
        })
        const defaults = await getPurchasePolicy(tenantId)
        const roles = resolveDocumentApprovalRoles(
          defaults,
          Number(existing.totalAmount),
          'PURCHASE_ORDER',
        )
        const nextLevel = pending.level + 1
        if (nextLevel <= roles.length) {
          await repo.createApprovalRequest(
            {
              tenantId,
              documentId: existing.id,
              documentNumber: existing.orderNumber,
              requesterId: existing.createdById ?? actorId,
              amount: Number(existing.totalAmount),
              level: nextLevel,
              approverRole: matrixRoleToApi(roles[nextLevel - 1]!),
            },
            tx,
          )
          // Keep document pending until the full chain completes.
          await repo.updatePurchaseOrder(
            tenantId,
            existing.id,
            { status: 'PENDING_APPROVAL', updatedById: actorId },
            tx,
          )
          const kept = await tx.purchaseOrder.findFirst({
            where: { id: existing.id, tenantId, deletedAt: null },
            include: { lines: { orderBy: { lineNumber: 'asc' } } },
          })
          if (!kept) throw new PurchaseOrderNotFoundError()
          await repo.createStatusHistory(
            {
              tenantId,
              documentId: existing.id,
              documentNumber: existing.orderNumber,
              action: 'APPROVAL_LEVEL_COMPLETED',
              fromStatus: existing.status,
              toStatus: 'PENDING_APPROVAL',
              actorId,
              remarks: transition.remarks ?? null,
            },
            tx,
          )
          return kept
        }
      }
    } else if (transition.approvalResolution) {
      await repo.resolvePendingApprovals(
        tenantId,
        existing.id,
        transition.approvalResolution,
        actorId,
        transition.remarks ?? null,
        tx,
      )
    }

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: order.id,
        documentNumber: order.orderNumber,
        action: transition.action,
        fromStatus: existing.status,
        toStatus: String(transition.data.status ?? order.status),
        actorId,
        remarks: transition.remarks ?? null,
      },
      tx,
    )

    return order
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PO,
    entityId: existing.id,
    action: transition.auditAction,
    previousValue: { status: existing.status },
    newValue: {
      status: updated.status,
      remarks: transition.remarks ?? undefined,
      ...(transition.auditExtra ?? {}),
    },
  })

  return mapPurchaseOrderToDto(updated)
}

export async function submitPurchaseOrder(
  tenantId: string,
  id: string,
  actorId: string,
  input: PoLifecycleRemarksInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertSubmittable(existing)

  const settings = await resolveEffectivePurchaseDefaults(
    tenantId,
    existing.deliveryWarehouse?.plantId,
  )
  const errors: Array<{ field: string; message: string }> = []
  if (settings.requirePoWarehouse && !existing.deliveryWarehouseId) {
    errors.push({
      field: 'deliveryWarehouseId',
      message: purchaseMessage(PURCHASE_ERROR_CODE.PO_WAREHOUSE_REQUIRED),
    })
  }
  if (settings.requireExpectedDeliveryDate && !existing.expectedDeliveryDate) {
    errors.push({
      field: 'expectedDeliveryDate',
      message: purchaseMessage(PURCHASE_ERROR_CODE.PO_EXPECTED_DELIVERY_REQUIRED),
    })
  }
  if (settings.requirePaymentTerms && !existing.paymentTerms?.trim()) {
    errors.push({
      field: 'paymentTerms',
      message: purchaseMessage(PURCHASE_ERROR_CODE.PO_PAYMENT_TERMS_REQUIRED),
    })
  }
  if (errors.length) {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_VALIDATION_FAILED),
      PURCHASE_ERROR_CODE.PO_VALIDATION_FAILED,
      errors,
    )
  }

  return applyLifecycleTransition(tenantId, actorId, existing, {
    action: 'SUBMITTED',
    auditAction: PURCHASE_AUDIT_ACTION.PO_SUBMITTED,
    data: {
      status: 'PENDING_APPROVAL',
      submittedAt: new Date(),
      rejectedAt: null,
      rejectionReason: null,
      sentBackAt: null,
      sendBackReason: null,
    },
    createApproval: true,
    remarks: input.remarks ?? null,
  })
}

export async function approvePurchaseOrder(
  tenantId: string,
  id: string,
  actorId: string,
  input: PoLifecycleRemarksInput = {},
  actorPermissions: readonly string[] = [],
) {
  const existing = await loadOrThrow(tenantId, id)
  const selfApproval = isSelfApproval(existing, actorId)
  const allowSelfApproval = selfApproval
    ? await isSelfApprovalAllowed(tenantId, actorPermissions)
    : false
  assertApprovable(existing, actorId, { allowSelfApproval })
  await assertApprovalAssignedToActor(tenantId, id, actorId)
  return applyLifecycleTransition(tenantId, actorId, existing, {
    action: 'APPROVED',
    auditAction: PURCHASE_AUDIT_ACTION.PO_APPROVED,
    data: { status: 'APPROVED', approvedAt: new Date() },
    approvalResolution: 'APPROVED',
    remarks: input.remarks ?? null,
    // Traceability: maker-checker was bypassed via self-approval policy/permission.
    ...(selfApproval ? { auditExtra: { selfApproved: true } } : {}),
  })
}

export async function rejectPurchaseOrder(
  tenantId: string,
  id: string,
  actorId: string,
  input: PoReasonInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertRejectable(existing)
  await assertApprovalAssignedToActor(tenantId, id, actorId)
  const reason = assertReasonPresent(
    input.reason ?? input.remarks,
    PURCHASE_ERROR_CODE.PO_REJECTION_REASON_REQUIRED,
  )
  return applyLifecycleTransition(tenantId, actorId, existing, {
    action: 'REJECTED',
    auditAction: PURCHASE_AUDIT_ACTION.PO_REJECTED,
    data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason },
    approvalResolution: 'REJECTED',
    remarks: reason,
  })
}

export async function sendBackPurchaseOrder(
  tenantId: string,
  id: string,
  actorId: string,
  input: PoReasonInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertSendBackable(existing)
  await assertApprovalAssignedToActor(tenantId, id, actorId)
  const reason = assertReasonPresent(
    input.reason ?? input.remarks,
    PURCHASE_ERROR_CODE.PO_SEND_BACK_REASON_REQUIRED,
  )
  return applyLifecycleTransition(tenantId, actorId, existing, {
    action: 'SENT_BACK',
    auditAction: PURCHASE_AUDIT_ACTION.PO_SENT_BACK,
    data: { status: 'SENT_BACK', sentBackAt: new Date(), sendBackReason: reason },
    approvalResolution: 'RETURNED',
    remarks: reason,
  })
}

export async function sendPurchaseOrderToVendor(
  tenantId: string,
  id: string,
  actorId: string,
  input: PoLifecycleRemarksInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertSendableToVendor(existing)
  return applyLifecycleTransition(tenantId, actorId, existing, {
    action: 'SENT_TO_VENDOR',
    auditAction: PURCHASE_AUDIT_ACTION.PO_SENT_TO_VENDOR,
    data: { status: 'SENT_TO_VENDOR', sentAt: new Date() },
    remarks: input.remarks ?? null,
  })
}

export async function cancelPurchaseOrder(
  tenantId: string,
  id: string,
  actorId: string,
  input: PoLifecycleRemarksInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertCancellable(existing)
  return applyLifecycleTransition(tenantId, actorId, existing, {
    action: 'CANCELLED',
    auditAction: PURCHASE_AUDIT_ACTION.PO_CANCELLED,
    data: { status: 'CANCELLED', cancelledAt: new Date() },
    approvalResolution: 'CANCELLED',
    remarks: input.remarks ?? null,
  })
}

export async function closePurchaseOrder(
  tenantId: string,
  id: string,
  actorId: string,
  input: PoLifecycleRemarksInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertCloseable(existing)
  const defaults = await getPurchasePolicy(tenantId)
  const shortCloseError = assertShortCloseAllowed(defaults)
  const fullyReceived = existing.lines.every(
    (line) => Number(line.receivedQuantity) >= Number(line.quantity),
  )
  if (!fullyReceived && shortCloseError) {
    throw new PurchaseOrderValidationError(
      shortCloseError,
      PURCHASE_ERROR_CODE.PO_VALIDATION_FAILED,
      [{ field: 'status', message: shortCloseError }],
    )
  }
  return applyLifecycleTransition(tenantId, actorId, existing, {
    action: 'CLOSED',
    auditAction: PURCHASE_AUDIT_ACTION.PO_CLOSED,
    data: { status: 'CLOSED', closedAt: new Date() },
    remarks: input.remarks ?? null,
  })
}

export async function reopenPurchaseOrder(
  tenantId: string,
  id: string,
  actorId: string,
  input: PoLifecycleRemarksInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertReopenable(existing)

  // Rejected/cancelled reopen to DRAFT for rework; closed reopens to its receipt-derived state.
  const nextStatus =
    existing.status === 'CLOSED' ? deriveReceiptStatus(existing.lines) : 'DRAFT'

  return applyLifecycleTransition(tenantId, actorId, existing, {
    action: 'REOPENED',
    auditAction: PURCHASE_AUDIT_ACTION.PO_REOPENED,
    data: {
      status: nextStatus,
      ...(nextStatus === 'DRAFT'
        ? {
            submittedAt: null,
            approvedAt: null,
            rejectedAt: null,
            rejectionReason: null,
            sentBackAt: null,
            sendBackReason: null,
            cancelledAt: null,
          }
        : { closedAt: null }),
    },
    remarks: input.remarks ?? null,
  })
}
