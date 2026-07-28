import type { PurchaseApprovalStatus } from '@prisma/client'
import { permissionSetIncludes } from '../../../constants/permissions.js'
import { isSelfApprovalAllowed, resolveApprovalRolesFromDefaults, resolveEffectivePurchaseDefaults } from '../shared/purchase-defaults.js'
import { PURCHASE_ERROR_CODE } from '../shared/purchase-error-catalog.js'
import {
  PurchaseApprovalActionError,
  PurchaseApprovalNotFoundError,
} from './purchase-approval.errors.js'
import {
  mapApprovalQueueRow,
  mapApprovalReviewDetail,
  mapGrnLinesForReview,
  mapPoLinesForReview,
  mapPrLinesForReview,
  mapStatusHistoryToPreviousApproval,
} from './purchase-approval.mapper.js'
import * as repo from './purchase-approval.repository.js'
import type { ApprovalDocumentType } from './purchase-approval.repository.js'
import type { ListPurchaseApprovalsQuery } from './purchase-approval.validation.js'

function tabToStatuses(tab: ListPurchaseApprovalsQuery['tab']): PurchaseApprovalStatus[] | undefined {
  switch (tab) {
    case 'pending_mine':
      return ['PENDING']
    case 'approved_by_me':
      return ['APPROVED']
    case 'rejected_by_me':
      return ['REJECTED']
    case 'all_history':
      return undefined
    default:
      return ['PENDING']
  }
}

function tabToActorScope(
  tab: ListPurchaseApprovalsQuery['tab'],
): 'pending' | 'responded' | 'all' {
  if (tab === 'pending_mine') return 'pending'
  if (tab === 'approved_by_me' || tab === 'rejected_by_me') return 'responded'
  return 'all'
}

function allowedDocumentTypes(
  permissions: string[],
  requireApprovalPermission = false,
): ApprovalDocumentType[] {
  const types: ApprovalDocumentType[] = []
  if (
    permissionSetIncludes(permissions, 'purchase.pr.approve') ||
    (!requireApprovalPermission && permissionSetIncludes(permissions, 'purchase.pr.view'))
  ) {
    types.push('PURCHASE_REQUISITION')
  }
  if (
    permissionSetIncludes(permissions, 'purchase.po.approve') ||
    (!requireApprovalPermission && permissionSetIncludes(permissions, 'purchase.po.view'))
  ) {
    types.push('PURCHASE_ORDER')
  }
  if (
    permissionSetIncludes(permissions, 'purchase.grn.post') ||
    (!requireApprovalPermission && permissionSetIncludes(permissions, 'purchase.grn.view'))
  ) {
    types.push('GOODS_RECEIPT')
  }
  return types
}

function canActOn(documentType: ApprovalDocumentType, permissions: string[]) {
  if (documentType === 'PURCHASE_REQUISITION') {
    return permissionSetIncludes(permissions, 'purchase.pr.approve')
  }
  if (documentType === 'GOODS_RECEIPT') {
    return permissionSetIncludes(permissions, 'purchase.grn.post')
  }
  return permissionSetIncludes(permissions, 'purchase.po.approve')
}

function requiredPermissionFor(
  documentType: ApprovalDocumentType,
): 'purchase.pr.approve' | 'purchase.po.approve' | 'purchase.grn.post' {
  if (documentType === 'PURCHASE_REQUISITION') return 'purchase.pr.approve'
  if (documentType === 'GOODS_RECEIPT') return 'purchase.grn.post'
  return 'purchase.po.approve'
}

function toDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null
  return date.toISOString().slice(0, 10)
}

export async function listPurchaseApprovals(
  tenantId: string,
  actorId: string,
  permissions: string[],
  query: ListPurchaseApprovalsQuery,
) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const skip = (page - 1) * limit

  let documentTypes = allowedDocumentTypes(permissions, query.tab !== 'all_history')
  if (query.documentType) {
    documentTypes = documentTypes.filter((t) => t === query.documentType)
  }
  if (documentTypes.length === 0) {
    return { items: [], total: 0, page, limit }
  }

  const statuses = tabToStatuses(query.tab)

  // Heal orphan PENDING_APPROVAL documents so they appear in the queue.
  if (!statuses || statuses.includes('PENDING')) {
    const orphans = await repo.findOrphanPendingDocuments(tenantId, documentTypes)
    for (const orphan of orphans) {
      await repo.ensurePendingApprovalForDocument(tenantId, orphan.documentType, orphan.documentId)
    }
  }

  const selfApprovalAllowed = await isSelfApprovalAllowed(tenantId, permissions)

  const { total, items } = await repo.listApprovals(tenantId, {
    statuses,
    documentTypes,
    documentNumber: query.documentNumber,
    actorId,
    actorScope: tabToActorScope(query.tab),
    includeOwnRequests: selfApprovalAllowed,
    skip,
    take: limit,
  })

  const userIds = items
    .flatMap((a) => [a.requesterId, a.approverId])
    .filter((id): id is string => Boolean(id))
  const nameById = await repo.resolveRequesterNames(tenantId, userIds)

  const grnIds = items
    .filter((a) => a.documentType === 'GOODS_RECEIPT')
    .map((a) => a.documentId)
  const grnById = new Map<
    string,
    Awaited<ReturnType<typeof repo.findGoodsReceiptForApproval>>
  >()
  await Promise.all(
    grnIds.map(async (id) => {
      const grn = await repo.findGoodsReceiptForApproval(tenantId, id)
      if (grn) grnById.set(id, grn)
    }),
  )

  let rows = items.map((approval) => {
    const pr = approval.purchaseRequisition
    const po = approval.purchaseOrder
    const grn = approval.documentType === 'GOODS_RECEIPT' ? grnById.get(approval.documentId) : null
    const requestedByName = approval.requesterId
      ? nameById.get(approval.requesterId) ?? null
      : null

    const docType = approval.documentType as ApprovalDocumentType
    const hasPermission = canActOn(docType, permissions)
    return mapApprovalQueueRow(approval, {
      canAct:
        hasPermission &&
        (selfApprovalAllowed || approval.requesterId !== actorId) &&
        (!approval.approverId || approval.approverId === actorId),
      requestedByName,
      approverName: approval.approverId
        ? nameById.get(approval.approverId) ?? null
        : null,
      departmentName: pr?.departmentId ?? null,
      locationId: pr?.warehouseId ?? grn?.warehouseId ?? null,
      locationName:
        pr?.warehouse?.name ||
        pr?.warehouse?.code ||
        grn?.warehouse?.name ||
        grn?.warehouseNameSnapshot ||
        (po?.vendor ? `${po.vendor.code} · ${po.vendor.name}` : null) ||
        (grn?.vendor ? `${grn.vendor.code} · ${grn.vendor.name}` : null),
      documentDate:
        pr?.requisitionDate ?? po?.orderDate ?? grn?.receiptDate ?? null,
      priority: pr?.priority ?? 'NORMAL',
    })
  })

  if (query.requester?.trim()) {
    const q = query.requester.trim().toLowerCase()
    rows = rows.filter((r) => r.requestedBy.toLowerCase().includes(q))
  }
  if (query.department?.trim()) {
    const q = query.department.trim().toLowerCase()
    rows = rows.filter((r) => r.department.toLowerCase().includes(q))
  }
  if (query.locationId) {
    rows = rows.filter((r) => r.locationId === query.locationId)
  }
  return { items: rows, total, page, limit }
}

export async function getPurchaseApprovalReview(
  tenantId: string,
  actorId: string,
  permissions: string[],
  approvalId: string,
) {
  let approval = await repo.findApprovalById(tenantId, approvalId)
  if (!approval) {
    approval = await repo.findPendingApprovalByDocumentId(tenantId, approvalId)
  }
  if (!approval) {
    // Last resort: orphan pending document id
    for (const documentType of [
      'PURCHASE_REQUISITION',
      'PURCHASE_ORDER',
      'GOODS_RECEIPT',
    ] as const) {
      const healed = await repo.ensurePendingApprovalForDocument(tenantId, documentType, approvalId)
      if (healed) {
        approval = healed
        break
      }
    }
  }
  if (!approval) throw new PurchaseApprovalNotFoundError()

  const allowed = allowedDocumentTypes(permissions)
  const docType = approval.documentType as ApprovalDocumentType
  if (!allowed.includes(docType)) {
    throw new PurchaseApprovalNotFoundError()
  }

  const pr = approval.purchaseRequisition
  const po = approval.purchaseOrder
  const grn =
    docType === 'GOODS_RECEIPT'
      ? await repo.findGoodsReceiptForApproval(tenantId, approval.documentId)
      : null
  const nameById = await repo.resolveRequesterNames(
    tenantId,
    [approval.requesterId, approval.approverId].filter((id): id is string => Boolean(id)),
  )
  const requestedByName = approval.requesterId
    ? nameById.get(approval.requesterId) ?? null
    : null

  const selfApprovalAllowed = await isSelfApprovalAllowed(tenantId, permissions)
  const row = mapApprovalQueueRow(approval, {
    canAct:
      canActOn(docType, permissions) &&
      (selfApprovalAllowed || approval.requesterId !== actorId) &&
      (!approval.approverId || approval.approverId === actorId),
    requestedByName,
    approverName: approval.approverId
      ? nameById.get(approval.approverId) ?? null
      : null,
    departmentName: pr?.departmentId ?? null,
    locationId: pr?.warehouseId ?? grn?.warehouseId ?? null,
    locationName:
      pr?.warehouse?.name ||
      pr?.warehouse?.code ||
      grn?.warehouse?.name ||
      grn?.warehouseNameSnapshot ||
      (po?.vendor ? `${po.vendor.code} · ${po.vendor.name}` : null) ||
      (grn?.vendor ? `${grn.vendor.code} · ${grn.vendor.name}` : null),
    documentDate: pr?.requisitionDate ?? po?.orderDate ?? grn?.receiptDate ?? null,
    priority: pr?.priority ?? 'NORMAL',
  })

  const history = await repo.listStatusHistory(tenantId, docType, approval.documentId)
  const historyActorNames = await repo.resolveRequesterNames(
    tenantId,
    history.map((entry) => entry.actorId).filter((id): id is string => Boolean(id)),
  )
  const requiredPermission = requiredPermissionFor(docType)
  const eligibleApprovers = (
    await repo.listEligibleApprovers(tenantId, requiredPermission, approval.requesterId)
  ).filter((user) => user.id !== actorId)

  const defaults = await resolveEffectivePurchaseDefaults(tenantId)
  const chainRoles =
    docType === 'GOODS_RECEIPT'
      ? ['purchase_head']
      : resolveApprovalRolesFromDefaults(
          defaults,
          Number(approval.amount ?? 0),
          docType as 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER',
        ).map((role) => {
          switch (role) {
            case 'DEPARTMENT_HEAD':
              return 'department_head'
            case 'PURCHASE_HEAD':
              return 'purchase_head'
            case 'FINANCE_HEAD':
              return 'finance_head'
            case 'MANAGEMENT':
              return 'management'
            default:
              return 'purchase_head'
          }
        })

  return mapApprovalReviewDetail({
    row: {
      ...row,
      submittedDate: row.submittedDate ?? '',
      chainLength: chainRoles.length || 1,
      approvalLevelLabel: `${approval.level} of ${chainRoles.length || 1} · ${approval.approverRole ?? 'Approver'}`,
    },
    purpose:
      pr?.purchasePurpose ??
      po?.remarks ??
      (grn ? `Tolerance exception · ${grn.purchaseOrderNumber}` : ''),
    requesterRemarks: pr?.remarks ?? po?.remarks ?? grn?.remarks ?? '',
    expectedDeliveryDate: toDateOnly(pr?.requiredDate ?? po?.expectedDeliveryDate ?? null),
    lines: pr
      ? mapPrLinesForReview(pr.lines)
      : po
        ? mapPoLinesForReview(po.lines)
        : grn
          ? mapGrnLinesForReview(grn.lines)
          : [],
    previousApprovals: history.map((entry) =>
      mapStatusHistoryToPreviousApproval(
        entry,
        entry.actorId ? historyActorNames.get(entry.actorId) : null,
      ),
    ),
    eligibleApprovers,
    chainRoles,
  })
}

export async function delegatePurchaseApproval(
  tenantId: string,
  actorId: string,
  permissions: string[],
  approvalId: string,
  input: { toUserId: string; remarks?: string | null },
) {
  const approval = await repo.findApprovalById(tenantId, approvalId)
  if (!approval || approval.status !== 'PENDING') {
    throw new PurchaseApprovalNotFoundError()
  }

  const documentType = approval.documentType as ApprovalDocumentType
  if (
    !canActOn(documentType, permissions) ||
    (approval.approverId && approval.approverId !== actorId)
  ) {
    throw new PurchaseApprovalActionError(PURCHASE_ERROR_CODE.APPROVAL_DELEGATE_INVALID)
  }
  if (input.toUserId === actorId || input.toUserId === approval.requesterId) {
    throw new PurchaseApprovalActionError(PURCHASE_ERROR_CODE.APPROVAL_DELEGATE_INVALID)
  }

  const requiredPermission = requiredPermissionFor(documentType)
  const eligible = (
    await repo.listEligibleApprovers(tenantId, requiredPermission, approval.requesterId)
  ).filter((user) => user.id !== actorId)
  const target = eligible.find((user) => user.id === input.toUserId)
  if (!target) {
    throw new PurchaseApprovalActionError(PURCHASE_ERROR_CODE.APPROVAL_DELEGATE_INVALID)
  }

  const updated = await repo.delegatePendingApproval({
    tenantId,
    approvalId,
    actorId,
    toUserId: target.id,
    toRole: target.role,
    remarks: input.remarks,
  })
  if (!updated) throw new PurchaseApprovalNotFoundError()
  return { approvalId: updated.id, delegatedTo: target }
}
