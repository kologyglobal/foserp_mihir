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
  mapPoLinesForReview,
  mapPrLinesForReview,
  mapStatusHistoryToPreviousApproval,
} from './purchase-approval.mapper.js'
import * as repo from './purchase-approval.repository.js'
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
): Array<'PURCHASE_REQUISITION' | 'PURCHASE_ORDER'> {
  const types: Array<'PURCHASE_REQUISITION' | 'PURCHASE_ORDER'> = []
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
  return types
}

function canActOn(documentType: 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER', permissions: string[]) {
  if (documentType === 'PURCHASE_REQUISITION') {
    return permissionSetIncludes(permissions, 'purchase.pr.approve')
  }
  return permissionSetIncludes(permissions, 'purchase.po.approve')
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

  let rows = items.map((approval) => {
    const pr = approval.purchaseRequisition
    const po = approval.purchaseOrder
    const requestedByName = approval.requesterId
      ? nameById.get(approval.requesterId) ?? null
      : null

    const hasPermission = canActOn(
      approval.documentType as 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER',
      permissions,
    )
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
      locationId: pr?.warehouseId ?? null,
      locationName:
        pr?.warehouse?.name ||
        pr?.warehouse?.code ||
        (po?.vendor ? `${po.vendor.code} · ${po.vendor.name}` : null),
      documentDate: pr?.requisitionDate ?? po?.orderDate ?? null,
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
    for (const documentType of ['PURCHASE_REQUISITION', 'PURCHASE_ORDER'] as const) {
      const healed = await repo.ensurePendingApprovalForDocument(tenantId, documentType, approvalId)
      if (healed) {
        approval = healed
        break
      }
    }
  }
  if (!approval) throw new PurchaseApprovalNotFoundError()

  const allowed = allowedDocumentTypes(permissions)
  if (!allowed.includes(approval.documentType as 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER')) {
    throw new PurchaseApprovalNotFoundError()
  }

  const pr = approval.purchaseRequisition
  const po = approval.purchaseOrder
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
      canActOn(
        approval.documentType as 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER',
        permissions,
      ) &&
      (selfApprovalAllowed || approval.requesterId !== actorId) &&
      (!approval.approverId || approval.approverId === actorId),
    requestedByName,
    approverName: approval.approverId
      ? nameById.get(approval.approverId) ?? null
      : null,
    departmentName: pr?.departmentId ?? null,
    locationId: pr?.warehouseId ?? null,
    locationName:
      pr?.warehouse?.name ||
      pr?.warehouse?.code ||
      (po?.vendor ? `${po.vendor.code} · ${po.vendor.name}` : null),
    documentDate: pr?.requisitionDate ?? po?.orderDate ?? null,
    priority: pr?.priority ?? 'NORMAL',
  })

  const historyDocType =
    approval.documentType === 'PURCHASE_ORDER' ? 'PURCHASE_ORDER' : 'PURCHASE_REQUISITION'
  const history = await repo.listStatusHistory(tenantId, historyDocType, approval.documentId)
  const historyActorNames = await repo.resolveRequesterNames(
    tenantId,
    history.map((entry) => entry.actorId).filter((id): id is string => Boolean(id)),
  )
  const requiredPermission =
    approval.documentType === 'PURCHASE_ORDER'
      ? 'purchase.po.approve'
      : 'purchase.pr.approve'
  const eligibleApprovers = (
    await repo.listEligibleApprovers(tenantId, requiredPermission, approval.requesterId)
  ).filter((user) => user.id !== actorId)

  const defaults = await resolveEffectivePurchaseDefaults(tenantId)
  const chainRoles = resolveApprovalRolesFromDefaults(
    defaults,
    Number(approval.amount ?? 0),
    approval.documentType as 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER',
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
    purpose: pr?.purchasePurpose ?? po?.remarks ?? '',
    requesterRemarks: pr?.remarks ?? po?.remarks ?? '',
    expectedDeliveryDate: toDateOnly(pr?.requiredDate ?? po?.expectedDeliveryDate ?? null),
    lines: pr
      ? mapPrLinesForReview(pr.lines)
      : po
        ? mapPoLinesForReview(po.lines)
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

  const documentType = approval.documentType as 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER'
  if (
    !canActOn(documentType, permissions) ||
    (approval.approverId && approval.approverId !== actorId)
  ) {
    throw new PurchaseApprovalActionError(PURCHASE_ERROR_CODE.APPROVAL_DELEGATE_INVALID)
  }
  if (input.toUserId === actorId || input.toUserId === approval.requesterId) {
    throw new PurchaseApprovalActionError(PURCHASE_ERROR_CODE.APPROVAL_DELEGATE_INVALID)
  }

  const requiredPermission =
    documentType === 'PURCHASE_ORDER' ? 'purchase.po.approve' : 'purchase.pr.approve'
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
