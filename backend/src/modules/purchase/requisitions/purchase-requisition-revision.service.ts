import type { PurchaseRequisitionLine, PurchaseRequisitionStatus } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import {
  PURCHASE_AUDIT_ACTION,
  PURCHASE_AUDIT_ENTITY,
  writePurchaseAudit,
} from '../shared/purchase-audit.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import { getPurchasePolicy } from '../shared/purchase-setup-enforcement.js'
import {
  PurchaseRequisitionNotFoundError,
  PurchaseRequisitionValidationError,
} from './purchase-requisition.errors.js'
import { mapPurchaseRequisitionToDto } from './purchase-requisition.mapper.js'
import * as repo from './purchase-requisition.repository.js'
import type { RevisePurchaseRequisitionInput } from './purchase-requisition.validation.js'
import {
  assertRevisable,
  parseDateInput,
  type PrWithLines,
} from './purchase-requisition.workflow.js'

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

function track(changes: ChangeRow[], fieldPath: string, fieldLabel: string, prev: string, next: string) {
  if (prev === next) return
  changes.push({ fieldPath, fieldLabel, previousValue: prev, newValue: next })
}

function snapHeader(pr: PrWithLines) {
  return {
    requiredDate: pr.requiredDate?.toISOString().slice(0, 10) ?? null,
    priority: pr.priority,
    purchasePurpose: pr.purchasePurpose,
    remarks: pr.remarks,
    revisionNo: pr.revisionNo,
    status: pr.status,
  }
}

function snapLines(lines: PurchaseRequisitionLine[]) {
  return lines.map((l) => ({
    id: l.id,
    lineNumber: l.lineNumber,
    itemId: l.itemId,
    itemCodeSnapshot: l.itemCodeSnapshot,
    itemNameSnapshot: l.itemNameSnapshot,
    requiredQuantity: Number(l.requiredQuantity),
    estimatedRate: Number(l.estimatedRate),
    requiredDate: l.requiredDate?.toISOString().slice(0, 10) ?? null,
    preferredVendorId: l.preferredVendorId,
    remarks: l.remarks,
  }))
}

export async function listPurchaseRequisitionRevisions(tenantId: string, purchaseRequisitionId: string) {
  const pr = await prisma.purchaseRequisition.findFirst({
    where: { id: purchaseRequisitionId, ...tenantActiveFilter(tenantId) },
    select: { id: true },
  })
  if (!pr) throw new PurchaseRequisitionNotFoundError()

  return prisma.purchaseRequisitionRevision.findMany({
    where: { tenantId, purchaseRequisitionId },
    orderBy: { revisionNo: 'desc' },
  })
}

export async function revisePurchaseRequisition(
  tenantId: string,
  id: string,
  actorId: string,
  input: RevisePurchaseRequisitionInput,
) {
  const existing = await repo.findPurchaseRequisitionById(tenantId, id)
  if (!existing) throw new PurchaseRequisitionNotFoundError()
  assertRevisable(existing, existing.lines)

  const reason = input.reason?.trim()
  if (!reason) {
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_REVISION_REASON_REQUIRED),
      PURCHASE_ERROR_CODE.PR_REVISION_REASON_REQUIRED,
      [{ field: 'reason', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_REVISION_REASON_REQUIRED) }],
    )
  }

  const changes: ChangeRow[] = []
  const nextRev = (existing.revisionNo ?? 0) + 1
  const headerBefore = snapHeader(existing)
  const linesBefore = snapLines(existing.lines)

  const headerUpdate: {
    requiredDate?: Date | null
    priority?: typeof existing.priority
    purchasePurpose?: string | null
    remarks?: string | null
  } = {}

  if (input.requiredDate !== undefined) {
    const next = parseDateInput(input.requiredDate) ?? null
    track(changes, 'requiredDate', 'Required Date', str(existing.requiredDate), str(next))
    headerUpdate.requiredDate = next
  }
  if (input.priority !== undefined) {
    track(changes, 'priority', 'Priority', str(existing.priority), str(input.priority))
    headerUpdate.priority = input.priority
  }
  if (input.purchasePurpose !== undefined) {
    track(changes, 'purchasePurpose', 'Purpose', str(existing.purchasePurpose), str(input.purchasePurpose))
    headerUpdate.purchasePurpose = input.purchasePurpose
  }
  if (input.remarks !== undefined) {
    track(changes, 'remarks', 'Remarks', str(existing.remarks), str(input.remarks))
    headerUpdate.remarks = input.remarks
  }

  const linePatches: Array<{
    id: string
    requiredQuantity: number
    estimatedRate: number
    estimatedAmount: number
    requiredDate?: Date | null
    preferredVendorId?: string | null
    remarks?: string | null
  }> = []

  if (input.lines?.length) {
    for (const patch of input.lines) {
      const line = existing.lines.find((l) => l.id === patch.id)
      if (!line) {
        throw new PurchaseRequisitionValidationError(
          purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_FOUND),
          PURCHASE_ERROR_CODE.PR_NOT_FOUND,
        )
      }
      const qty = patch.requiredQuantity ?? Number(line.requiredQuantity)
      const rate = patch.estimatedRate ?? Number(line.estimatedRate)
      const reqDate =
        patch.requiredDate !== undefined ? parseDateInput(patch.requiredDate) ?? null : undefined
      const vendorId = patch.preferredVendorId !== undefined ? patch.preferredVendorId : undefined
      const remarks = patch.remarks !== undefined ? patch.remarks : undefined

      if (patch.requiredQuantity !== undefined) {
        track(
          changes,
          `lines.${line.lineNumber}.requiredQuantity`,
          `Line ${line.lineNumber} Qty`,
          str(line.requiredQuantity),
          str(qty),
        )
      }
      if (patch.estimatedRate !== undefined) {
        track(
          changes,
          `lines.${line.lineNumber}.estimatedRate`,
          `Line ${line.lineNumber} Rate`,
          str(line.estimatedRate),
          str(rate),
        )
      }
      if (
        patch.requiredQuantity !== undefined ||
        patch.estimatedRate !== undefined ||
        reqDate !== undefined ||
        vendorId !== undefined ||
        remarks !== undefined
      ) {
        linePatches.push({
          id: line.id,
          requiredQuantity: qty,
          estimatedRate: rate,
          estimatedAmount: Number((qty * rate).toFixed(2)),
          ...(reqDate !== undefined ? { requiredDate: reqDate } : {}),
          ...(vendorId !== undefined ? { preferredVendorId: vendorId } : {}),
          ...(remarks !== undefined ? { remarks } : {}),
        })
      }
    }
  }

  if (changes.length === 0) {
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_REVISION_NO_CHANGES),
      PURCHASE_ERROR_CODE.PR_REVISION_NO_CHANGES,
    )
  }

  const policy = await getPurchasePolicy(tenantId)
  const requireApproval = Boolean(
    (policy as { requireApprovalOnPrRevision?: boolean }).requireApprovalOnPrRevision ?? true,
  )
  const statusBefore = existing.status
  const statusAfter: PurchaseRequisitionStatus = requireApproval ? 'PENDING_APPROVAL' : statusBefore

  await prisma.$transaction(async (tx) => {
    for (const p of linePatches) {
      await tx.purchaseRequisitionLine.update({
        where: { id: p.id },
        data: {
          requiredQuantity: p.requiredQuantity,
          estimatedRate: p.estimatedRate,
          estimatedAmount: p.estimatedAmount,
          ...(p.requiredDate !== undefined ? { requiredDate: p.requiredDate } : {}),
          ...(p.preferredVendorId !== undefined ? { preferredVendorId: p.preferredVendorId } : {}),
          ...(p.remarks !== undefined ? { remarks: p.remarks } : {}),
        },
      })
    }

    await tx.purchaseRequisition.update({
      where: { id: existing.id },
      data: {
        ...headerUpdate,
        revisionNo: nextRev,
        status: statusAfter,
        updatedById: actorId,
        ...(requireApproval ? { submittedAt: new Date(), approvedAt: null } : {}),
      },
    })

    await tx.purchaseRequisitionRevision.create({
      data: {
        tenantId,
        purchaseRequisitionId: existing.id,
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

    const archivedHeader = await tx.purchaseRequisitionArchived.create({
      data: {
        tenantId,
        purchaseRequisitionId: existing.id,
        revisionNo: existing.revisionNo,
        requisitionNumber: existing.requisitionNumber,
        requisitionDate: existing.requisitionDate,
        departmentId: existing.departmentId,
        requestedById: existing.requestedById,
        warehouseId: existing.warehouseId,
        requiredDate: existing.requiredDate,
        priority: existing.priority,
        purchasePurpose: existing.purchasePurpose,
        rfqRequired: existing.rfqRequired,
        status: existing.status,
        remarks: existing.remarks,
        archivedById: actorId,
        reason,
      },
    })

    for (const line of existing.lines) {
      await tx.purchaseRequisitionLineArchived.create({
        data: {
          tenantId,
          archivedHeaderId: archivedHeader.id,
          purchaseRequisitionId: existing.id,
          sourceLineId: line.id,
          revisionNo: existing.revisionNo,
          lineNumber: line.lineNumber,
          itemId: line.itemId,
          itemCodeSnapshot: line.itemCodeSnapshot,
          itemNameSnapshot: line.itemNameSnapshot,
          description: line.description,
          requiredQuantity: line.requiredQuantity,
          uomId: line.uomId,
          estimatedRate: line.estimatedRate,
          estimatedAmount: line.estimatedAmount,
          preferredVendorId: line.preferredVendorId,
          requiredDate: line.requiredDate,
          remarks: line.remarks,
        },
      })
    }
  })

  await writePurchaseAudit({
    tenantId,
    actorId,
    entity: PURCHASE_AUDIT_ENTITY.PR,
    entityId: existing.id,
    action: PURCHASE_AUDIT_ACTION.PR_REVISED,
    newValue: { revisionNo: nextRev, reason },
  })

  const fresh = await repo.findPurchaseRequisitionById(tenantId, id)
  return mapPurchaseRequisitionToDto(fresh!)
}
