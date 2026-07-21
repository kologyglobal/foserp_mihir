import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode, previewNextCode } from '../../../services/codeSeries.service.js'
import { syncPurchasePlanningRowsFromApprovedPr } from '../planning/purchase-planning-sync.service.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { isSelfApprovalAllowed } from '../shared/purchase-defaults.js'
import {
  getPurchasePolicy,
  matrixRoleToApi,
  resolveDocumentApprovalRoles,
} from '../shared/purchase-setup-enforcement.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  PurchaseRequisitionNotApprovableError,
  PurchaseRequisitionNotFoundError,
} from './purchase-requisition.errors.js'
import { mapPurchaseRequisitionToDto } from './purchase-requisition.mapper.js'
import * as repo from './purchase-requisition.repository.js'
import type {
  CreatePurchaseRequisitionInput,
  LifecycleRemarksInput,
  ListPurchaseRequisitionsQuery,
  RejectPurchaseRequisitionInput,
  UpdatePurchaseRequisitionInput,
} from './purchase-requisition.validation.js'
import {
  assertApprovable,
  assertCancellable,
  assertDraftEditable,
  assertRejectable,
  assertRejectionReason,
  assertReopenable,
  assertRequiredDateNotBeforeRequisition,
  assertSendBackable,
  assertSendBackReason,
  assertSubmittable,
  isSelfApproval,
  normalizeLineInputs,
  parseDateInput,
} from './purchase-requisition.workflow.js'

async function loadOrThrow(tenantId: string, id: string) {
  const pr = await repo.findPurchaseRequisitionById(tenantId, id)
  if (!pr) throw new PurchaseRequisitionNotFoundError()
  return pr
}

async function assertApprovalAssignedToActor(
  tenantId: string,
  purchaseRequisitionId: string,
  actorId: string,
) {
  const approval = await prisma.purchaseApproval.findFirst({
    where: { tenantId, purchaseRequisitionId, status: 'PENDING' },
    select: { approverId: true },
  })
  if (approval?.approverId && approval.approverId !== actorId) {
    throw new PurchaseRequisitionNotApprovableError(
      purchaseMessage(PURCHASE_ERROR_CODE.APPROVAL_ASSIGNED_TO_ANOTHER_USER),
      PURCHASE_ERROR_CODE.APPROVAL_ASSIGNED_TO_ANOTHER_USER,
    )
  }
}

export async function listPurchaseRequisitions(tenantId: string, query: ListPurchaseRequisitionsQuery) {
  const result = await repo.findPurchaseRequisitions(tenantId, query)
  return {
    items: result.items.map(mapPurchaseRequisitionToDto),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getPurchaseRequisition(tenantId: string, id: string) {
  const pr = await loadOrThrow(tenantId, id)
  return mapPurchaseRequisitionToDto(pr)
}

export async function previewNextPurchaseRequisitionNumber(tenantId: string) {
  const requisitionNumber = await previewNextCode(tenantId, 'PURCHASE_REQUISITION')
  return { requisitionNumber }
}

export async function createPurchaseRequisition(
  tenantId: string,
  actorId: string,
  input: CreatePurchaseRequisitionInput,
) {
  const requisitionDate = parseDateInput(input.requisitionDate) ?? new Date()
  const requiredDate = parseDateInput(input.requiredDate) ?? null
  assertRequiredDateNotBeforeRequisition(requisitionDate, requiredDate)

  const lines = normalizeLineInputs(input.lines ?? [])
  for (const line of lines) {
    assertRequiredDateNotBeforeRequisition(requisitionDate, line.requiredDate)
  }

  const defaults = await getPurchasePolicy(tenantId)
  const warehouseId =
    input.warehouseId ||
    defaults.defaultRequisitionWarehouseId ||
    defaults.defaultWarehouseId ||
    null
  const rfqRequired =
    input.rfqRequired !== undefined ? input.rfqRequired : defaults.defaultRfqRequired

  const requisitionNumber = await nextCode(tenantId, 'PURCHASE_REQUISITION')

  const created = await prisma.$transaction(async (tx) => {
    const pr = await repo.createPurchaseRequisition(
      {
        tenant: { connect: { id: tenantId } },
        requisitionNumber,
        requisitionDate,
        departmentId: input.departmentId ?? null,
        requestedById: input.requestedById ?? actorId,
        warehouse: warehouseId ? { connect: { id: warehouseId } } : undefined,
        requiredDate,
        priority: input.priority ?? 'NORMAL',
        purchasePurpose: input.purchasePurpose?.trim() || null,
        rfqRequired,
        status: 'DRAFT',
        remarks: input.remarks?.trim() || null,
        createdById: actorId,
        updatedById: actorId,
        lines: {
          create: lines.map((line) => ({
            tenantId,
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            itemCodeSnapshot: line.itemCodeSnapshot,
            itemNameSnapshot: line.itemNameSnapshot,
            description: line.description,
            requiredQuantity: line.requiredQuantity,
            uomId: line.uomId,
            estimatedRate: line.estimatedRate,
            estimatedAmount: line.estimatedAmount,
            warehouseId: line.warehouseId,
            binId: line.binId,
            preferredVendorId: line.preferredVendorId,
            requiredDate: line.requiredDate,
            remarks: line.remarks,
          })),
        },
      },
      tx,
    )

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: pr.id,
        documentNumber: pr.requisitionNumber,
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        actorId,
      },
      tx,
    )

    return pr
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PR,
    entityId: created.id,
    action: PURCHASE_AUDIT_ACTION.PR_CREATED,
    newValue: {
      requisitionNumber: created.requisitionNumber,
      status: created.status,
      rfqRequired: created.rfqRequired,
      lineCount: created.lines?.length ?? 0,
    },
  })

  return mapPurchaseRequisitionToDto(created)
}

export async function updatePurchaseRequisition(
  tenantId: string,
  id: string,
  actorId: string,
  input: UpdatePurchaseRequisitionInput,
) {
  const existing = await loadOrThrow(tenantId, id)
  assertDraftEditable(existing)

  const requisitionDate =
    input.requisitionDate !== undefined
      ? (parseDateInput(input.requisitionDate) ?? existing.requisitionDate)
      : existing.requisitionDate
  const requiredDate =
    input.requiredDate !== undefined
      ? (parseDateInput(input.requiredDate) ?? null)
      : existing.requiredDate
  assertRequiredDateNotBeforeRequisition(requisitionDate, requiredDate)

  const lines =
    input.lines !== undefined ? normalizeLineInputs(input.lines) : null
  if (lines) {
    for (const line of lines) {
      assertRequiredDateNotBeforeRequisition(requisitionDate, line.requiredDate)
    }
  }

  const data: Prisma.PurchaseRequisitionUncheckedUpdateInput = {
    updatedById: actorId,
    requisitionDate,
    requiredDate,
  }
  if (input.departmentId !== undefined) data.departmentId = input.departmentId
  if (input.requestedById !== undefined) data.requestedById = input.requestedById
  if (input.warehouseId !== undefined) data.warehouseId = input.warehouseId
  if (input.priority !== undefined) data.priority = input.priority
  if (input.purchasePurpose !== undefined) data.purchasePurpose = input.purchasePurpose?.trim() || null
  if (input.rfqRequired !== undefined) data.rfqRequired = input.rfqRequired
  if (input.remarks !== undefined) data.remarks = input.remarks?.trim() || null

  const updated = await prisma.$transaction(async (tx) => {
    if (lines) {
      await repo.replacePurchaseRequisitionLines(tenantId, id, lines, tx)
    }
    return repo.updatePurchaseRequisition(tenantId, id, data, tx)
  })

  if (!updated) throw new PurchaseRequisitionNotFoundError()

  if (input.rfqRequired !== undefined && input.rfqRequired !== existing.rfqRequired) {
    await writePurchaseAudit({
      tenantId,
      actorId,
      entity: PURCHASE_AUDIT_ENTITY.PR,
      entityId: id,
      action: PURCHASE_AUDIT_ACTION.PR_RFQ_DECISION_CHANGED,
      previousValue: { rfqRequired: existing.rfqRequired },
      newValue: { rfqRequired: updated.rfqRequired },
    })
  }

  if (lines) {
    const beforeById = new Map(existing.lines.map((l) => [l.id, l]))
    const afterIds = new Set((updated.lines ?? []).map((l) => l.id))
    for (const line of updated.lines ?? []) {
      const prev = beforeById.get(line.id)
      if (!prev) {
        await writePurchaseAudit({
          tenantId,
          actorId,
          entity: PURCHASE_AUDIT_ENTITY.PR,
          entityId: id,
          action: PURCHASE_AUDIT_ACTION.PR_LINE_ADDED,
          newValue: {
            lineId: line.id,
            lineNumber: line.lineNumber,
            itemCode: line.itemCodeSnapshot,
            quantity: Number(line.requiredQuantity),
          },
        })
      } else if (
        Number(prev.requiredQuantity) !== Number(line.requiredQuantity) ||
        prev.itemCodeSnapshot !== line.itemCodeSnapshot ||
        Number(prev.estimatedRate) !== Number(line.estimatedRate)
      ) {
        await writePurchaseAudit({
          tenantId,
          actorId,
          entity: PURCHASE_AUDIT_ENTITY.PR,
          entityId: id,
          action: PURCHASE_AUDIT_ACTION.PR_LINE_UPDATED,
          previousValue: {
            lineId: prev.id,
            quantity: Number(prev.requiredQuantity),
            rate: Number(prev.estimatedRate),
          },
          newValue: {
            lineId: line.id,
            quantity: Number(line.requiredQuantity),
            rate: Number(line.estimatedRate),
          },
        })
      }
    }
    for (const prev of existing.lines) {
      if (!afterIds.has(prev.id)) {
        await writePurchaseAudit({
          tenantId,
          actorId,
          entity: PURCHASE_AUDIT_ENTITY.PR,
          entityId: id,
          action: PURCHASE_AUDIT_ACTION.PR_LINE_REMOVED,
          previousValue: {
            lineId: prev.id,
            lineNumber: prev.lineNumber,
            itemCode: prev.itemCodeSnapshot,
          },
        })
      }
    }
  }

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PR,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.PR_UPDATED,
    previousValue: {
      status: existing.status,
      rfqRequired: existing.rfqRequired,
      remarks: existing.remarks,
    },
    newValue: {
      status: updated.status,
      rfqRequired: updated.rfqRequired,
      remarks: updated.remarks,
    },
  })

  return mapPurchaseRequisitionToDto(updated)
}

export async function submitPurchaseRequisition(
  tenantId: string,
  id: string,
  actorId: string,
  input: LifecycleRemarksInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertSubmittable(existing)

  const estimatedTotal = existing.lines.reduce(
    (sum, line) => sum + Number(line.estimatedAmount),
    0,
  )

  const updated = await prisma.$transaction(async (tx) => {
    const pr = await repo.updatePurchaseRequisition(
      tenantId,
      id,
      {
        status: 'PENDING_APPROVAL',
        submittedAt: new Date(),
        updatedById: actorId,
        rejectionReason: null,
        rejectedAt: null,
      },
      tx,
    )
    if (!pr) throw new PurchaseRequisitionNotFoundError()

    await repo.createApprovalRequest(
      {
        tenantId,
        documentId: pr.id,
        documentNumber: pr.requisitionNumber,
        purchaseRequisitionId: pr.id,
        requesterId: actorId,
        amount: estimatedTotal,
        level: 1,
        approverRole: matrixRoleToApi(
          resolveDocumentApprovalRoles(
            await getPurchasePolicy(tenantId),
            estimatedTotal,
            'PURCHASE_REQUISITION',
          )[0]!,
        ),
      },
      tx,
    )

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: pr.id,
        documentNumber: pr.requisitionNumber,
        action: 'SUBMITTED',
        fromStatus: existing.status,
        toStatus: 'PENDING_APPROVAL',
        actorId,
        remarks: input.remarks ?? null,
      },
      tx,
    )

    return pr
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PR,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.PR_SUBMITTED,
    previousValue: { status: existing.status },
    newValue: { status: updated.status },
  })

  return mapPurchaseRequisitionToDto(updated)
}

export async function approvePurchaseRequisition(
  tenantId: string,
  id: string,
  actorId: string,
  input: LifecycleRemarksInput = {},
  actorPermissions: readonly string[] = [],
) {
  const existing = await loadOrThrow(tenantId, id)
  const selfApproval = isSelfApproval(existing, actorId)
  const allowSelfApproval = selfApproval
    ? await isSelfApprovalAllowed(tenantId, actorPermissions)
    : false
  assertApprovable(existing, actorId, { allowSelfApproval })
  await assertApprovalAssignedToActor(tenantId, id, actorId)

  const estimatedTotal = existing.lines.reduce(
    (sum, line) => sum + Number(line.estimatedAmount),
    0,
  )
  const defaults = await getPurchasePolicy(tenantId)
  const roles = resolveDocumentApprovalRoles(defaults, estimatedTotal, 'PURCHASE_REQUISITION')

  const updated = await prisma.$transaction(async (tx) => {
    const pending = await tx.purchaseApproval.findFirst({
      where: { tenantId, purchaseRequisitionId: id, status: 'PENDING' },
      orderBy: { level: 'asc' },
    })
    if (pending) {
      await tx.purchaseApproval.update({
        where: { id: pending.id },
        data: {
          status: 'APPROVED',
          approverId: actorId,
          respondedAt: new Date(),
          remarks: input.remarks ?? null,
        },
      })
      const nextLevel = pending.level + 1
      if (nextLevel <= roles.length) {
        await repo.createApprovalRequest(
          {
            tenantId,
            documentId: id,
            documentNumber: existing.requisitionNumber,
            purchaseRequisitionId: id,
            requesterId: existing.requestedById ?? existing.createdById ?? actorId,
            amount: estimatedTotal,
            level: nextLevel,
            approverRole: matrixRoleToApi(roles[nextLevel - 1]!),
          },
          tx,
        )
        const pr = await repo.updatePurchaseRequisition(
          tenantId,
          id,
          { status: 'PENDING_APPROVAL', updatedById: actorId },
          tx,
        )
        if (!pr) throw new PurchaseRequisitionNotFoundError()
        await repo.createStatusHistory(
          {
            tenantId,
            documentId: pr.id,
            documentNumber: pr.requisitionNumber,
            action: 'APPROVAL_LEVEL_COMPLETED',
            fromStatus: existing.status,
            toStatus: 'PENDING_APPROVAL',
            actorId,
            remarks: input.remarks ?? null,
          },
          tx,
        )
        return pr
      }
    }

    const pr = await repo.updatePurchaseRequisition(
      tenantId,
      id,
      {
        status: 'APPROVED',
        approvedAt: new Date(),
        updatedById: actorId,
        rejectionReason: null,
        rejectedAt: null,
      },
      tx,
    )
    if (!pr) throw new PurchaseRequisitionNotFoundError()

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: pr.id,
        documentNumber: pr.requisitionNumber,
        action: 'APPROVED',
        fromStatus: existing.status,
        toStatus: 'APPROVED',
        actorId,
        remarks: input.remarks ?? null,
      },
      tx,
    )

    // RFQ path: do not create planning rows. Direct path: sync planning.
    if (!pr.rfqRequired) {
      await syncPurchasePlanningRowsFromApprovedPr(pr.id, tenantId, actorId, tx)
    }

    return pr
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PR,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.PR_APPROVED,
    previousValue: { status: existing.status },
    newValue: {
      status: updated.status,
      rfqRequired: updated.rfqRequired,
      readyForRfq: updated.rfqRequired === true,
      // Traceability: maker-checker was bypassed via self-approval policy/permission.
      ...(selfApproval ? { selfApproved: true } : {}),
    },
  })

  // Reload with lines after planning sync side-effects
  const fresh = await loadOrThrow(tenantId, id)
  return mapPurchaseRequisitionToDto(fresh)
}

export async function rejectPurchaseRequisition(
  tenantId: string,
  id: string,
  actorId: string,
  input: RejectPurchaseRequisitionInput,
) {
  const existing = await loadOrThrow(tenantId, id)
  assertRejectable(existing)
  await assertApprovalAssignedToActor(tenantId, id, actorId)
  const reason = assertRejectionReason(input.reason)

  const updated = await prisma.$transaction(async (tx) => {
    const pr = await repo.updatePurchaseRequisition(
      tenantId,
      id,
      {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedById: actorId,
      },
      tx,
    )
    if (!pr) throw new PurchaseRequisitionNotFoundError()

    await repo.resolvePendingApprovals(tenantId, id, 'REJECTED', actorId, reason, tx)

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: pr.id,
        documentNumber: pr.requisitionNumber,
        action: 'REJECTED',
        fromStatus: existing.status,
        toStatus: 'REJECTED',
        actorId,
        remarks: input.remarks ?? reason,
      },
      tx,
    )

    return pr
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PR,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.PR_REJECTED,
    previousValue: { status: existing.status },
    newValue: { status: updated.status, rejectionReason: reason },
  })

  return mapPurchaseRequisitionToDto(updated)
}

export async function sendBackPurchaseRequisition(
  tenantId: string,
  id: string,
  actorId: string,
  input: RejectPurchaseRequisitionInput,
) {
  const existing = await loadOrThrow(tenantId, id)
  assertSendBackable(existing)
  await assertApprovalAssignedToActor(tenantId, id, actorId)
  const reason = assertSendBackReason(input.reason ?? input.remarks)

  const updated = await prisma.$transaction(async (tx) => {
    const pr = await repo.updatePurchaseRequisition(
      tenantId,
      id,
      {
        status: 'DRAFT',
        updatedById: actorId,
        submittedAt: null,
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
      },
      tx,
    )
    if (!pr) throw new PurchaseRequisitionNotFoundError()

    await repo.resolvePendingApprovals(tenantId, id, 'RETURNED', actorId, reason, tx)

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: pr.id,
        documentNumber: pr.requisitionNumber,
        action: 'SENT_BACK',
        fromStatus: existing.status,
        toStatus: 'DRAFT',
        actorId,
        remarks: reason,
      },
      tx,
    )

    return pr
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PR,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.PR_SENT_BACK,
    previousValue: { status: existing.status },
    newValue: { status: updated.status, sendBackReason: reason },
  })

  return mapPurchaseRequisitionToDto(updated)
}

export async function cancelPurchaseRequisition(
  tenantId: string,
  id: string,
  actorId: string,
  input: LifecycleRemarksInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertCancellable(existing)

  const updated = await prisma.$transaction(async (tx) => {
    const pr = await repo.updatePurchaseRequisition(
      tenantId,
      id,
      {
        status: 'CANCELLED',
        updatedById: actorId,
      },
      tx,
    )
    if (!pr) throw new PurchaseRequisitionNotFoundError()

    await repo.resolvePendingApprovals(tenantId, id, 'CANCELLED', actorId, input.remarks ?? null, tx)
    await repo.softDeletePlanningRowsForPr(tenantId, id, actorId, tx)

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: pr.id,
        documentNumber: pr.requisitionNumber,
        action: 'CANCELLED',
        fromStatus: existing.status,
        toStatus: 'CANCELLED',
        actorId,
        remarks: input.remarks ?? null,
      },
      tx,
    )

    return pr
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PR,
    entityId: id,
    action: PURCHASE_AUDIT_ACTION.PR_CANCELLED,
    previousValue: { status: existing.status },
    newValue: { status: updated.status },
  })

  return mapPurchaseRequisitionToDto(updated)
}

export async function reopenPurchaseRequisition(
  tenantId: string,
  id: string,
  actorId: string,
  input: LifecycleRemarksInput = {},
) {
  const existing = await loadOrThrow(tenantId, id)
  assertReopenable(existing)

  const updated = await prisma.$transaction(async (tx) => {
    const pr = await repo.updatePurchaseRequisition(
      tenantId,
      id,
      {
        status: 'DRAFT',
        submittedAt: null,
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        updatedById: actorId,
      },
      tx,
    )
    if (!pr) throw new PurchaseRequisitionNotFoundError()

    await repo.softDeletePlanningRowsForPr(tenantId, id, actorId, tx)

    await repo.createStatusHistory(
      {
        tenantId,
        documentId: pr.id,
        documentNumber: pr.requisitionNumber,
        action: 'REOPENED',
        fromStatus: existing.status,
        toStatus: 'DRAFT',
        actorId,
        remarks: input.remarks ?? null,
      },
      tx,
    )

    return pr
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PR,
    entityId: id,
    action:
      existing.status === 'PENDING_APPROVAL'
        ? PURCHASE_AUDIT_ACTION.PR_SENT_BACK
        : PURCHASE_AUDIT_ACTION.PR_REOPENED,
    previousValue: { status: existing.status },
    newValue: { status: updated.status },
  })

  return mapPurchaseRequisitionToDto(updated)
}
