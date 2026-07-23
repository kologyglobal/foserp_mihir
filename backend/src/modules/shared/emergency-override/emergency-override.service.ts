/**
 * Emergency override grants — document-scoped, time-bound, single-use when consumed.
 * Does not alter posted transactions; audit only.
 */
import { randomUUID } from 'node:crypto'
import type { EmergencyOverrideUrgency, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { ConflictError, UnprocessableEntityError } from '../../../utils/errors.js'
import {
  classifyBlockersForEmergencyOverride,
  type BlockerLike,
} from './emergency-override.catalog.js'

export type GrantEmergencyOverrideInput = {
  tenantId: string
  module: string
  documentType: string
  documentId: string
  documentNo?: string | null
  blockedAction: string
  blockers: BlockerLike[]
  businessReason: string
  urgency?: EmergencyOverrideUrgency
  riskAcknowledged: boolean
  approvalReference?: string | null
  approvedByName?: string | null
  approvedByUserId?: string | null
  requestedByUserId?: string | null
  requestedByName?: string | null
  /** ISO datetime; default +4h when omitted. */
  expiresAt?: string | Date | null
  scope?: string | null
  remarks?: string | null
  supportingAttachmentKey?: string | null
  /** When true (default), create as GRANTED (supervisor override perm path). */
  grantImmediately?: boolean
  actorUserId?: string | null
}

function defaultExpiry(): Date {
  return new Date(Date.now() + 4 * 60 * 60 * 1000)
}

async function nextOverrideNo(tenantId: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.emergencyOverride.count({
    where: { tenantId, createdAt: { gte: new Date(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T00:00:00.000Z`) } },
  })
  return `EO-${day}-${String(count + 1).padStart(4, '0')}`
}

export function assertBlockersAllowEmergencyOverride(blockers: BlockerLike[]): {
  overridable: BlockerLike[]
  primaryBlockerCode: string | null
} {
  const classified = classifyBlockersForEmergencyOverride(blockers)
  if (classified.neverOverridable.length) {
    const codes = classified.neverOverridable.map((b) => b.code).join(', ')
    throw new ConflictError(
      `Emergency override denied — never-overridable blocker(s): ${codes}. Fix the underlying integrity / policy issue.`,
    )
  }
  if (classified.unknown.length) {
    const codes = classified.unknown.map((b) => b.code).join(', ')
    throw new ConflictError(
      `Emergency override denied — unclassified blocker(s) treated as hard: ${codes}`,
    )
  }
  if (!classified.overridable.length) {
    throw new UnprocessableEntityError(
      'Emergency override requires at least one operational overridable blocker',
    )
  }
  return {
    overridable: classified.overridable,
    primaryBlockerCode: classified.overridable[0]?.code ?? null,
  }
}

export async function grantEmergencyOverride(input: GrantEmergencyOverrideInput) {
  const reason = input.businessReason?.trim()
  if (!reason || reason.length < 8) {
    throw new UnprocessableEntityError('Business reason is required (min 8 characters)')
  }
  if (!input.riskAcknowledged) {
    throw new UnprocessableEntityError('Risk acknowledgement is required for emergency override')
  }

  const { overridable, primaryBlockerCode } = assertBlockersAllowEmergencyOverride(input.blockers)
  const expiresAt =
    input.expiresAt != null
      ? input.expiresAt instanceof Date
        ? input.expiresAt
        : new Date(input.expiresAt)
      : defaultExpiry()
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new UnprocessableEntityError('Override expiry must be a future date/time')
  }

  const grantImmediately = input.grantImmediately !== false
  const overrideNo = await nextOverrideNo(input.tenantId)
  const id = randomUUID()
  const now = new Date()

  return prisma.emergencyOverride.create({
    data: {
      id,
      tenantId: input.tenantId,
      overrideNo,
      module: input.module,
      documentType: input.documentType,
      documentId: input.documentId,
      documentNo: input.documentNo ?? null,
      blockedAction: input.blockedAction,
      primaryBlockerCode,
      blockerCodesJson: overridable.map((b) => b.code) as Prisma.InputJsonValue,
      originalBlockersSnapshot: input.blockers as unknown as Prisma.InputJsonValue,
      businessReason: reason,
      urgency: input.urgency ?? 'HIGH',
      riskAcknowledged: true,
      supportingAttachmentKey: input.supportingAttachmentKey ?? null,
      requestedByUserId: input.requestedByUserId ?? null,
      requestedByName: input.requestedByName ?? null,
      approvedByUserId: grantImmediately
        ? (input.approvedByUserId ?? input.requestedByUserId ?? null)
        : (input.approvedByUserId ?? null),
      approvedByName: grantImmediately
        ? (input.approvedByName ?? input.requestedByName ?? null)
        : (input.approvedByName ?? null),
      approvalReference: input.approvalReference?.trim() || null,
      expiresAt,
      scope:
        input.scope?.trim() ||
        'Operational document gates only — integrity / statutory / stock policy preserved',
      remarks: input.remarks?.trim() || null,
      status: grantImmediately ? 'GRANTED' : 'REQUESTED',
      grantedAt: grantImmediately ? now : null,
      createdBy: input.actorUserId ?? null,
      updatedBy: input.actorUserId ?? null,
    },
  })
}

export async function consumeEmergencyOverride(params: {
  tenantId: string
  overrideId: string
  consumedByAction: string
  consumedDocumentId?: string | null
  actorUserId?: string | null
  tx?: Prisma.TransactionClient
}) {
  const db = params.tx ?? prisma
  const row = await db.emergencyOverride.findFirst({
    where: { id: params.overrideId, tenantId: params.tenantId },
  })
  if (!row) throw new ConflictError('Emergency override not found')
  if (row.status === 'CONSUMED') {
    throw new ConflictError(`Emergency override ${row.overrideNo} already consumed`)
  }
  if (row.status === 'EXPIRED' || row.status === 'CANCELLED' || row.status === 'REJECTED') {
    throw new ConflictError(`Emergency override ${row.overrideNo} is ${row.status}`)
  }
  if (row.status !== 'GRANTED' && row.status !== 'REQUESTED') {
    throw new ConflictError(`Emergency override ${row.overrideNo} cannot be consumed`)
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.emergencyOverride.update({
      where: { id: row.id },
      data: { status: 'EXPIRED', updatedBy: params.actorUserId ?? null },
    })
    throw new ConflictError(`Emergency override ${row.overrideNo} has expired`)
  }

  return db.emergencyOverride.update({
    where: { id: row.id },
    data: {
      status: 'CONSUMED',
      consumedAt: new Date(),
      consumedByAction: params.consumedByAction,
      consumedDocumentId: params.consumedDocumentId ?? null,
      updatedBy: params.actorUserId ?? null,
    },
  })
}

export async function listEmergencyOverridesForDocument(params: {
  tenantId: string
  documentType: string
  documentId: string
}) {
  return prisma.emergencyOverride.findMany({
    where: {
      tenantId: params.tenantId,
      documentType: params.documentType,
      documentId: params.documentId,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export function mapEmergencyOverride(row: {
  id: string
  overrideNo: string
  module: string
  documentType: string
  documentId: string
  documentNo: string | null
  blockedAction: string
  primaryBlockerCode: string | null
  blockerCodesJson: unknown
  businessReason: string
  urgency: string
  riskAcknowledged: boolean
  approvalReference: string | null
  approvedByName: string | null
  requestedByName: string | null
  expiresAt: Date
  scope: string | null
  remarks: string | null
  status: string
  grantedAt: Date | null
  consumedAt: Date | null
  createdAt: Date
}) {
  return {
    id: row.id,
    overrideNo: row.overrideNo,
    module: row.module,
    documentType: row.documentType,
    documentId: row.documentId,
    documentNo: row.documentNo,
    blockedAction: row.blockedAction,
    primaryBlockerCode: row.primaryBlockerCode,
    blockerCodes: Array.isArray(row.blockerCodesJson) ? row.blockerCodesJson : [],
    businessReason: row.businessReason,
    urgency: row.urgency,
    riskAcknowledged: row.riskAcknowledged,
    approvalReference: row.approvalReference,
    approvedByName: row.approvedByName,
    requestedByName: row.requestedByName,
    expiresAt: row.expiresAt.toISOString(),
    scope: row.scope,
    remarks: row.remarks,
    status: row.status,
    grantedAt: row.grantedAt?.toISOString() ?? null,
    consumedAt: row.consumedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}
