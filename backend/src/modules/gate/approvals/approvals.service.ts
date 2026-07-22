import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import {
  type GateListFilter,
  matchesSearch,
  pushGateActivity,
  toJson,
} from '../shared/gate-shared.js'
import { mapApproval } from '../shared/gate-mappers.js'

async function getOrThrow(tenantId: string, id: string) {
  const row = await prisma.gateApproval.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!row) throw new NotFoundError('Approval request not found')
  return row
}

export async function listApprovals(tenantId: string, filter: GateListFilter = {}) {
  const rows = await prisma.gateApproval.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { requestedAt: 'desc' },
  })
  let mapped = rows.map(mapApproval)
  if (filter.search) {
    mapped = mapped.filter((a) =>
      matchesSearch(filter.search, a.requestNumber, a.subject, a.requestedBy, a.reason),
    )
  }
  return mapped
}

export async function getApprovalById(tenantId: string, id: string) {
  return mapApproval(await getOrThrow(tenantId, id))
}

async function reflectApproval(
  tenantId: string,
  actor: string,
  record: Awaited<ReturnType<typeof getOrThrow>>,
  remarks: string | undefined,
  approved: boolean,
) {
  const now = new Date()
  if (record.sourceType === 'visitor') {
    const visit = await prisma.gateVisitorVisit.findFirst({
      where: { id: record.sourceId, tenantId, deletedAt: null },
    })
    if (visit) {
      if (approved && ['waiting_approval', 'arrived', 'rejected'].includes(visit.status)) {
        const history = Array.isArray(visit.approvalHistoryJson)
          ? [...(visit.approvalHistoryJson as unknown[])]
          : []
        history.push({ at: now.toISOString(), by: actor, action: 'approved', remarks })
        await prisma.gateVisitorVisit.update({
          where: { id: visit.id },
          data: {
            status: 'approved',
            approvalStatus: 'approved',
            approvedBy: actor,
            approvedAt: now,
            approvalHistoryJson: toJson(history),
            updatedBy: actor,
          },
        })
      } else if (!approved && visit.status === 'waiting_approval') {
        const history = Array.isArray(visit.approvalHistoryJson)
          ? [...(visit.approvalHistoryJson as unknown[])]
          : []
        history.push({ at: now.toISOString(), by: actor, action: 'rejected', remarks })
        await prisma.gateVisitorVisit.update({
          where: { id: visit.id },
          data: {
            status: 'rejected',
            approvalStatus: 'rejected',
            approvalRemarks: remarks,
            approvalHistoryJson: toJson(history),
            updatedBy: actor,
          },
        })
      }
    }
  } else if (record.sourceType === 'material_outward') {
    const entry = await prisma.gateMaterialOutward.findFirst({
      where: { id: record.sourceId, tenantId, deletedAt: null },
    })
    if (entry) {
      const timeline = Array.isArray(entry.timelineJson) ? [...(entry.timelineJson as unknown[])] : []
      if (approved) {
        const status = entry.status === 'pending_approval' ? 'ready_for_gate' : entry.status
        timeline.push({ at: now.toISOString(), status, by: actor, note: 'Approval granted' })
        await prisma.gateMaterialOutward.update({
          where: { id: entry.id },
          data: {
            documentApproved: true,
            approvalStatus: 'approved',
            status,
            timelineJson: toJson(timeline),
            updatedBy: actor,
          },
        })
      } else if (!['released', 'cancelled'].includes(entry.status)) {
        timeline.push({ at: now.toISOString(), status: 'rejected', by: actor, note: remarks })
        await prisma.gateMaterialOutward.update({
          where: { id: entry.id },
          data: {
            status: 'rejected',
            approvalStatus: 'rejected',
            rejectRemarks: remarks,
            timelineJson: toJson(timeline),
            updatedBy: actor,
          },
        })
      }
    }
  } else if (record.sourceType === 'gate_pass') {
    const pass = await prisma.gatePass.findFirst({
      where: { id: record.sourceId, tenantId, deletedAt: null },
    })
    if (pass && pass.status === 'pending_approval') {
      await prisma.gatePass.update({
        where: { id: pass.id },
        data: approved
          ? {
              status: 'approved',
              approvalStatus: 'approved',
              approverName: actor,
              approvalRemarks: remarks ?? null,
              updatedBy: actor,
            }
          : {
              status: 'rejected',
              approvalStatus: 'rejected',
              approvalRemarks: remarks,
              updatedBy: actor,
            },
      })
    }
  } else if (record.sourceType === 'material_inward' && approved) {
    const entry = await prisma.gateMaterialInward.findFirst({
      where: { id: record.sourceId, tenantId, deletedAt: null },
    })
    if (entry && entry.status === 'vehicle_arrived') {
      const timeline = Array.isArray(entry.timelineJson) ? [...(entry.timelineJson as unknown[])] : []
      timeline.push({
        at: now.toISOString(),
        status: 'documents_verified',
        by: actor,
        note: 'Without-PO inward approved',
      })
      await prisma.gateMaterialInward.update({
        where: { id: entry.id },
        data: { status: 'documents_verified', timelineJson: toJson(timeline), updatedBy: actor },
      })
    }
  }
}

export async function approveGateRequest(
  tenantId: string,
  actor: string,
  id: string,
  remarks?: string,
) {
  const record = await getOrThrow(tenantId, id)
  if (record.status !== 'pending') {
    throw new InvalidStateError('Only pending requests can be actioned')
  }
  if (record.requestType === 'blacklist_override' && !remarks?.trim()) {
    throw new InvalidStateError('Override approvals require remarks')
  }

  await reflectApproval(tenantId, actor, record, remarks, true)

  const updated = await prisma.gateApproval.update({
    where: { id },
    data: {
      status: 'approved',
      actionedBy: actor,
      actionedAt: new Date(),
      actionRemarks: remarks ?? null,
    },
  })
  await pushGateActivity(tenantId, actor, {
    event: 'approval_actioned',
    recordType: 'approval',
    recordId: updated.id,
    recordLabel: `${updated.requestNumber} approved`,
    gate: 'Main Gate',
    status: 'approved',
  })
  return mapApproval(updated)
}

export async function rejectGateRequest(
  tenantId: string,
  actor: string,
  id: string,
  remarks: string,
) {
  if (!remarks?.trim()) throw new InvalidStateError('Rejection remarks are required')
  const record = await getOrThrow(tenantId, id)
  if (record.status !== 'pending') {
    throw new InvalidStateError('Only pending requests can be actioned')
  }
  await reflectApproval(tenantId, actor, record, remarks, false)
  const updated = await prisma.gateApproval.update({
    where: { id },
    data: {
      status: 'rejected',
      actionedBy: actor,
      actionedAt: new Date(),
      actionRemarks: remarks,
    },
  })
  return mapApproval(updated)
}

export async function sendBackGateRequest(
  tenantId: string,
  actor: string,
  id: string,
  remarks: string,
) {
  if (!remarks?.trim()) throw new InvalidStateError('Send-back remarks are required')
  const record = await getOrThrow(tenantId, id)
  if (record.status !== 'pending') {
    throw new InvalidStateError('Only pending requests can be actioned')
  }
  const updated = await prisma.gateApproval.update({
    where: { id },
    data: {
      status: 'sent_back',
      actionedBy: actor,
      actionedAt: new Date(),
      actionRemarks: remarks,
    },
  })
  return mapApproval(updated)
}
