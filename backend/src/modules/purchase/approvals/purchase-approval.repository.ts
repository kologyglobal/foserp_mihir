import type { PurchaseApprovalStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'

const approvalInclude = {
  purchaseRequisition: {
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      lines: { orderBy: { lineNumber: 'asc' as const } },
    },
  },
  purchaseOrder: {
    include: {
      lines: { orderBy: { lineNumber: 'asc' as const } },
      vendor: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.PurchaseApprovalInclude

export type ApprovalWithDocs = Prisma.PurchaseApprovalGetPayload<{ include: typeof approvalInclude }>

export async function listApprovals(
  tenantId: string,
  opts: {
    statuses?: PurchaseApprovalStatus[]
    documentTypes?: Array<'PURCHASE_REQUISITION' | 'PURCHASE_ORDER'>
    documentNumber?: string
    actorId?: string
    actorScope?: 'pending' | 'responded' | 'all'
    /** Self-approval allowed — keep the actor's own requests in their pending queue. */
    includeOwnRequests?: boolean
    skip: number
    take: number
  },
) {
  const where: Prisma.PurchaseApprovalWhereInput = {
    tenantId,
    documentType: { in: opts.documentTypes ?? ['PURCHASE_REQUISITION', 'PURCHASE_ORDER'] },
    ...(opts.statuses?.length ? { status: { in: opts.statuses } } : {}),
    ...(opts.documentNumber
      ? { documentNumber: { contains: opts.documentNumber } }
      : {}),
    ...(opts.actorScope === 'pending' && opts.actorId
      ? {
          AND: [
            ...(opts.includeOwnRequests
              ? []
              : [{ OR: [{ requesterId: null }, { requesterId: { not: opts.actorId } }] }]),
            { OR: [{ approverId: null }, { approverId: opts.actorId }] },
          ],
        }
      : {}),
    ...(opts.actorScope === 'responded' && opts.actorId
      ? { approverId: opts.actorId }
      : {}),
  }

  const [total, items] = await Promise.all([
    prisma.purchaseApproval.count({ where }),
    prisma.purchaseApproval.findMany({
      where,
      include: approvalInclude,
      orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
      skip: opts.skip,
      take: opts.take,
    }),
  ])

  return { total, items }
}

/** PRs / POs in PENDING_APPROVAL with no PENDING approval row (legacy / orphan). */
export async function findOrphanPendingDocuments(
  tenantId: string,
  documentTypes: Array<'PURCHASE_REQUISITION' | 'PURCHASE_ORDER'>,
) {
  const orphans: Array<{
    documentType: 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER'
    documentId: string
  }> = []

  if (documentTypes.includes('PURCHASE_REQUISITION')) {
    const prs = await prisma.purchaseRequisition.findMany({
      where: { tenantId, deletedAt: null, status: 'PENDING_APPROVAL' },
      select: { id: true },
    })
    for (const pr of prs) {
      const pending = await prisma.purchaseApproval.findFirst({
        where: {
          tenantId,
          purchaseRequisitionId: pr.id,
          status: 'PENDING',
        },
        select: { id: true },
      })
      if (!pending) orphans.push({ documentType: 'PURCHASE_REQUISITION', documentId: pr.id })
    }
  }

  if (documentTypes.includes('PURCHASE_ORDER')) {
    const pos = await prisma.purchaseOrder.findMany({
      where: { tenantId, deletedAt: null, status: 'PENDING_APPROVAL' },
      select: { id: true },
    })
    for (const po of pos) {
      const pending = await prisma.purchaseApproval.findFirst({
        where: {
          tenantId,
          purchaseOrderId: po.id,
          status: 'PENDING',
        },
        select: { id: true },
      })
      if (!pending) orphans.push({ documentType: 'PURCHASE_ORDER', documentId: po.id })
    }
  }

  return orphans
}

export async function ensurePendingApprovalForDocument(
  tenantId: string,
  documentType: 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER',
  documentId: string,
): Promise<ApprovalWithDocs | null> {
  if (documentType === 'PURCHASE_REQUISITION') {
    const pr = await prisma.purchaseRequisition.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        lines: { orderBy: { lineNumber: 'asc' } },
      },
    })
    if (!pr || pr.status !== 'PENDING_APPROVAL') return null

    const amount = pr.lines.reduce((s, l) => s + Number(l.estimatedAmount), 0)
    const created = await prisma.purchaseApproval.create({
      data: {
        tenantId,
        documentType: 'PURCHASE_REQUISITION',
        documentId: pr.id,
        documentNumber: pr.requisitionNumber,
        purchaseRequisitionId: pr.id,
        level: 1,
        status: 'PENDING',
        requesterId: pr.requestedById ?? pr.createdById,
        amount,
        requestedAt: pr.submittedAt ?? pr.updatedAt,
      },
      include: approvalInclude,
    })
    return created
  }

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: documentId, tenantId, deletedAt: null },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
      vendor: { select: { id: true, name: true, code: true } },
    },
  })
  if (!po || po.status !== 'PENDING_APPROVAL') return null

  const created = await prisma.purchaseApproval.create({
    data: {
      tenantId,
      documentType: 'PURCHASE_ORDER',
      documentId: po.id,
      documentNumber: po.orderNumber,
      purchaseOrderId: po.id,
      level: 1,
      status: 'PENDING',
      requesterId: po.createdById,
      amount: po.totalAmount,
      requestedAt: po.submittedAt ?? po.updatedAt,
    },
    include: approvalInclude,
  })
  return created
}

export async function findApprovalById(tenantId: string, id: string) {
  return prisma.purchaseApproval.findFirst({
    where: { id, tenantId },
    include: approvalInclude,
  })
}

export async function findPendingApprovalByDocumentId(tenantId: string, documentId: string) {
  return prisma.purchaseApproval.findFirst({
    where: {
      tenantId,
      documentId,
      status: 'PENDING',
      documentType: { in: ['PURCHASE_REQUISITION', 'PURCHASE_ORDER'] },
    },
    include: approvalInclude,
    orderBy: { requestedAt: 'desc' },
  })
}

export async function listStatusHistory(
  tenantId: string,
  documentType: 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER',
  documentId: string,
) {
  return prisma.purchaseStatusHistory.findMany({
    where: { tenantId, documentType, documentId },
    orderBy: { actedAt: 'desc' },
    take: 50,
  })
}

export async function resolveRequesterNames(tenantId: string, userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return new Map<string, string>()
  const users = await prisma.user.findMany({
    where: { tenantId, id: { in: ids }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  })
  return new Map(
    users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
  )
}

export async function listEligibleApprovers(
  tenantId: string,
  permission: 'purchase.pr.approve' | 'purchase.po.approve',
  excludeUserId?: string | null,
) {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      deletedAt: null,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      userRoles: {
        some: {
          role: {
            deletedAt: null,
            rolePermissions: {
              some: { permission: { name: permission } },
            },
          },
        },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      userRoles: {
        select: { role: { select: { name: true } } },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  return users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    email: user.email,
    role: user.userRoles[0]?.role.name ?? 'Approver',
  }))
}

export async function delegatePendingApproval(input: {
  tenantId: string
  approvalId: string
  actorId: string
  toUserId: string
  toRole: string
  remarks?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.purchaseApproval.findFirst({
      where: { id: input.approvalId, tenantId: input.tenantId, status: 'PENDING' },
    })
    if (!current) return null
    const actor = await tx.user.findFirst({
      where: { id: input.actorId, tenantId: input.tenantId, deletedAt: null },
      select: { firstName: true, lastName: true },
    })

    const updated = await tx.purchaseApproval.update({
      where: { id: current.id },
      data: {
        approverId: input.toUserId,
        approverRole: input.toRole,
        remarks: input.remarks?.trim() || null,
      },
      include: approvalInclude,
    })

    await tx.purchaseStatusHistory.create({
      data: {
        tenantId: input.tenantId,
        documentType:
          current.documentType === 'PURCHASE_ORDER'
            ? 'PURCHASE_ORDER'
            : 'PURCHASE_REQUISITION',
        documentId: current.documentId,
        documentNumber: current.documentNumber,
        action: 'DELEGATED',
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
        actorId: input.actorId,
        actorName: actor ? `${actor.firstName} ${actor.lastName}`.trim() : null,
        remarks: input.remarks?.trim() || `Delegated to ${input.toRole}`,
      },
    })

    return updated
  })
}
