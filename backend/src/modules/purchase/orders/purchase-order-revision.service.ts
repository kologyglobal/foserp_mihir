/**
 * Versioned PO amendments — persists every Rev N snapshot + field diffs.
 * See docs/PURCHASE_PO_VERSIONING.md
 */
import type { PurchaseOrderLine, PurchaseOrderStatus } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { PURCHASE_AUDIT_ACTION, PURCHASE_AUDIT_ENTITY, writePurchaseAudit } from '../shared/purchase-audit.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  lineAmountFromVendor,
  toUomQuantity,
} from '../shared/uom-conversion.js'
import {
  PurchaseOrderNotFoundError,
  PurchaseOrderValidationError,
  PurchaseOrderWorkflowError,
} from './purchase-order.errors.js'
import { mapPurchaseOrderToDto } from './purchase-order.mapper.js'
import * as repo from './purchase-order.repository.js'
import type { RevisePurchaseOrderInput } from './purchase-order.validation.js'
import {
  assertRevisable,
  money,
  parseDateInput,
} from './purchase-order.workflow.js'
import {
  getPurchasePolicy,
  matrixRoleToApi,
  resolveDocumentApprovalRoles,
} from '../shared/purchase-setup-enforcement.js'

type ChangeRow = {
  fieldPath: string
  fieldLabel: string
  previousValue: string
  newValue: string
}

function str(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

function snapHeader(order: {
  expectedDeliveryDate: Date | null
  paymentTerms: string | null
  deliveryTerms: string | null
  freightAmount: unknown
  remarks: string | null
  subtotalAmount: unknown
  taxAmount: unknown
  totalAmount: unknown
  revisionNo: number
  status: string
}) {
  return {
    expectedDeliveryDate: order.expectedDeliveryDate?.toISOString().slice(0, 10) ?? null,
    paymentTerms: order.paymentTerms,
    deliveryTerms: order.deliveryTerms,
    freightAmount: Number(order.freightAmount ?? 0),
    remarks: order.remarks,
    subtotalAmount: Number(order.subtotalAmount ?? 0),
    taxAmount: Number(order.taxAmount ?? 0),
    totalAmount: Number(order.totalAmount ?? 0),
    revisionNo: order.revisionNo,
    status: order.status,
  }
}

function snapLines(lines: PurchaseOrderLine[]) {
  return lines.map((l) => ({
    id: l.id,
    lineNumber: l.lineNumber,
    itemId: l.itemId,
    itemCodeSnapshot: l.itemCodeSnapshot,
    itemNameSnapshot: l.itemNameSnapshot,
    quantity: Number(l.quantity),
    uomQuantity: Number(l.uomQuantity),
    uomConversionFactor: Number(l.uomConversionFactor),
    unitCostPrimary: Number(l.unitCostPrimary),
    rate: Number(l.rate),
    amount: Number(l.amount),
    receivedQuantity: Number(l.receivedQuantity),
    requiredDate: l.requiredDate?.toISOString().slice(0, 10) ?? null,
  }))
}

function track(
  changes: ChangeRow[],
  fieldPath: string,
  fieldLabel: string,
  previousValue: string,
  newValue: string,
) {
  if (previousValue === newValue) return
  changes.push({ fieldPath, fieldLabel, previousValue, newValue })
}

async function toDto(tenantId: string, orderId: string) {
  const order = await repo.findPurchaseOrderById(tenantId, orderId)
  if (!order) throw new PurchaseOrderNotFoundError()
  const names = await repo.resolveUserNames(tenantId, [
    order.createdById,
    order.updatedById,
    ...((order as { revisions?: Array<{ revisedById?: string | null }> }).revisions?.map(
      (r) => r.revisedById,
    ) ?? []),
  ])
  return mapPurchaseOrderToDto(order as never, names)
}

export async function listPurchaseOrderRevisions(tenantId: string, purchaseOrderId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, tenantId, deletedAt: null },
    select: { id: true },
  })
  if (!po) throw new PurchaseOrderNotFoundError()

  const rows = await prisma.purchaseOrderRevision.findMany({
    where: { tenantId, purchaseOrderId },
    orderBy: { revisionNo: 'desc' },
  })
  const names = await repo.resolveUserNames(
    tenantId,
    rows.map((r) => r.revisedById),
  )
  return rows.map((r) => ({
    id: r.id,
    revisionNo: r.revisionNo,
    reason: r.reason,
    statusBefore: r.statusBefore,
    statusAfter: r.statusAfter,
    revisedAt: r.revisedAt.toISOString(),
    revisedById: r.revisedById,
    revisedByName: (r.revisedById && names.get(r.revisedById)) || null,
    headerSnapshot: r.headerSnapshot,
    linesSnapshot: r.linesSnapshot,
    changes: r.changes,
  }))
}

export async function revisePurchaseOrder(
  tenantId: string,
  id: string,
  actorId: string,
  input: RevisePurchaseOrderInput,
) {
  const existing = await repo.findPurchaseOrderById(tenantId, id)
  if (!existing) throw new PurchaseOrderNotFoundError()
  assertRevisable(existing)

  const reason = input.reason?.trim()
  if (!reason) {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_REVISION_REASON_REQUIRED),
      PURCHASE_ERROR_CODE.PO_REVISION_REASON_REQUIRED,
      [{ field: 'reason', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_REVISION_REASON_REQUIRED) }],
    )
  }

  const changes: ChangeRow[] = []
  const nextRev = (existing.revisionNo ?? 0) + 1
  const headerBefore = snapHeader(existing)
  const linesBefore = snapLines(existing.lines)

  const headerUpdate: {
    expectedDeliveryDate?: Date | null
    paymentTerms?: string | null
    deliveryTerms?: string | null
    freightAmount?: number
    remarks?: string | null
  } = {}

  if (input.expectedDeliveryDate !== undefined) {
    const next = parseDateInput(input.expectedDeliveryDate) ?? null
    track(
      changes,
      'expectedDeliveryDate',
      'Expected Delivery Date',
      str(existing.expectedDeliveryDate),
      str(next),
    )
    headerUpdate.expectedDeliveryDate = next
  }
  if (input.paymentTerms !== undefined) {
    track(changes, 'paymentTerms', 'Payment Terms', str(existing.paymentTerms), str(input.paymentTerms))
    headerUpdate.paymentTerms = input.paymentTerms
  }
  if (input.deliveryTerms !== undefined) {
    track(changes, 'deliveryTerms', 'Delivery Terms', str(existing.deliveryTerms), str(input.deliveryTerms))
    headerUpdate.deliveryTerms = input.deliveryTerms
  }
  if (input.freightAmount !== undefined) {
    track(
      changes,
      'freightAmount',
      'Freight',
      str(Number(existing.freightAmount)),
      str(input.freightAmount),
    )
    headerUpdate.freightAmount = money(input.freightAmount)
  }
  if (input.remarks !== undefined) {
    track(changes, 'remarks', 'Remarks', str(existing.remarks), str(input.remarks))
    headerUpdate.remarks = input.remarks
  }

  type LinePatch = {
    id: string
    quantity: number
    uomQuantity: number
    unitCostPrimary: number
    rate: number
    amount: number
  }
  const linePatches: LinePatch[] = []

  if (input.lines?.length) {
    const byId = new Map(existing.lines.map((l) => [l.id, l]))
    for (const patch of input.lines) {
      const line = byId.get(patch.id)
      if (!line) {
        throw new PurchaseOrderValidationError(
          purchaseMessage(PURCHASE_ERROR_CODE.PO_REVISION_LINE_NOT_FOUND),
          PURCHASE_ERROR_CODE.PO_REVISION_LINE_NOT_FOUND,
          [{ field: 'lines', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_REVISION_LINE_NOT_FOUND) }],
        )
      }
      const factor = Number(line.uomConversionFactor) > 0 ? Number(line.uomConversionFactor) : 1
      let quantity = Number(line.quantity)
      let rate = Number(line.rate)
      if (patch.quantity != null) quantity = Number(patch.quantity)
      if (patch.rate != null) rate = Number(patch.rate)

      const received = Number(line.receivedQuantity)
      if (quantity + 1e-9 < received) {
        throw new PurchaseOrderValidationError(
          purchaseMessage(PURCHASE_ERROR_CODE.PO_REVISION_QTY_BELOW_RECEIVED),
          PURCHASE_ERROR_CODE.PO_REVISION_QTY_BELOW_RECEIVED,
          [
            {
              field: `lines.${line.lineNumber}.quantity`,
              message: purchaseMessage(PURCHASE_ERROR_CODE.PO_REVISION_QTY_BELOW_RECEIVED),
            },
          ],
        )
      }

      const uomQuantity = toUomQuantity(quantity, factor)
      const unitCostPrimary = money(rate * factor)
      const amount = money(lineAmountFromVendor(rate, uomQuantity))

      track(
        changes,
        `lines[${line.lineNumber}].quantity`,
        `Line ${line.lineNumber} Quantity`,
        str(Number(line.quantity)),
        str(quantity),
      )
      track(
        changes,
        `lines[${line.lineNumber}].rate`,
        `Line ${line.lineNumber} Unit Price`,
        str(Number(line.rate)),
        str(rate),
      )

      if (
        Math.abs(quantity - Number(line.quantity)) > 1e-9 ||
        Math.abs(rate - Number(line.rate)) > 1e-9
      ) {
        linePatches.push({ id: line.id, quantity, uomQuantity, unitCostPrimary, rate, amount })
      }
    }
  }

  if (changes.length === 0) {
    throw new PurchaseOrderWorkflowError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_REVISION_NO_CHANGES),
      PURCHASE_ERROR_CODE.PO_REVISION_NO_CHANGES,
    )
  }

  const policy = await getPurchasePolicy(tenantId)
  const requireApproval = Boolean(policy.requireApprovalOnPoRevision)
  const statusBefore = existing.status
  const statusAfter: PurchaseOrderStatus = requireApproval ? 'PENDING_APPROVAL' : statusBefore

  // Recompute totals from lines after patches
  const lineAmounts = existing.lines.map((l) => {
    const p = linePatches.find((x) => x.id === l.id)
    return p ? p.amount : Number(l.amount)
  })
  const subtotalAmount = money(lineAmounts.reduce((s, a) => s + a, 0))
  const freightAmount =
    headerUpdate.freightAmount !== undefined
      ? headerUpdate.freightAmount
      : Number(existing.freightAmount)
  const taxAmount = Number(existing.taxAmount)
  const totalAmount = money(subtotalAmount + taxAmount + freightAmount)

  await prisma.$transaction(async (tx) => {
    for (const p of linePatches) {
      await tx.purchaseOrderLine.update({
        where: { id: p.id },
        data: {
          quantity: p.quantity,
          uomQuantity: p.uomQuantity,
          unitCostPrimary: p.unitCostPrimary,
          rate: p.rate,
          amount: p.amount,
        },
      })
    }

    await tx.purchaseOrder.update({
      where: { id: existing.id },
      data: {
        ...headerUpdate,
        subtotalAmount,
        totalAmount,
        revisionNo: nextRev,
        status: statusAfter,
        updatedById: actorId,
        ...(requireApproval
          ? {
              submittedAt: new Date(),
              approvedAt: null,
              sentAt: null,
            }
          : {}),
      },
    })

    await tx.purchaseOrderRevision.create({
      data: {
        tenantId,
        purchaseOrderId: existing.id,
        revisionNo: nextRev,
        reason,
        statusBefore,
        statusAfter,
        revisedById: actorId,
        headerSnapshot: headerBefore,
        linesSnapshot: linesBefore,
        changes,
      },
    })

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: existing.id,
        documentNumber: existing.orderNumber,
        action: 'REVISED',
        fromStatus: statusBefore,
        toStatus: statusAfter,
        actorId,
        remarks: `Revision ${nextRev}: ${reason}`,
      },
      tx,
    )

    if (requireApproval) {
      await repo.resolvePendingApprovals(tenantId, existing.id, 'CANCELLED', actorId, 'Superseded by revision', tx)
      const roles = resolveDocumentApprovalRoles(policy, totalAmount, 'PURCHASE_ORDER')
      await repo.createApprovalRequest(
        {
          tenantId,
          documentId: existing.id,
          documentNumber: existing.orderNumber,
          requesterId: actorId,
          amount: totalAmount,
          level: 1,
          approverRole: matrixRoleToApi(roles[0]!),
        },
        tx,
      )
    }
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PO,
    entityId: existing.id,
    action: PURCHASE_AUDIT_ACTION.PO_UPDATED,
    previousValue: { status: statusBefore, revisionNo: existing.revisionNo },
    newValue: { status: statusAfter, revisionNo: nextRev, reason, changeCount: changes.length },
  })

  return toDto(tenantId, existing.id)
}
