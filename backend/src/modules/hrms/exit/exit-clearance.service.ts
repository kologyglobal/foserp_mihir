import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import { formatForPersistence } from '../../accounting/shared/finance-decimal.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import type {
  CreateAssetLineInput,
  SetAssetStatusInput,
  UpdateAssetLineInput,
} from './exit.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

/** Default clearance checklist used when no active `HrExitClearanceTemplate` rows exist for the tenant/legal entity. */
const DEFAULT_CLEARANCE_ITEMS: Array<{ code: string; name: string; sequence: number }> = [
  { code: 'IT', name: 'IT Clearance', sequence: 10 },
  { code: 'ADMIN', name: 'Admin Clearance', sequence: 20 },
  { code: 'STORES', name: 'Stores Clearance', sequence: 30 },
  { code: 'FINANCE', name: 'Finance Clearance', sequence: 40 },
  { code: 'HR', name: 'HR Clearance', sequence: 50 },
  { code: 'DEPARTMENT', name: 'Department Clearance', sequence: 60 },
]

function dec(n: Prisma.Decimal | number | string | null | undefined): number {
  if (n == null) return 0
  return Number(n)
}

function mapClearanceLine(row: {
  id: string
  exitId: string
  itemId: string | null
  code: string
  name: string
  sequence: number
  status: string
  ownerUserId: string | null
  remarks: string | null
  clearedByUserId: string | null
  clearedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    exitId: row.exitId,
    itemId: row.itemId,
    code: row.code,
    name: row.name,
    sequence: row.sequence,
    status: row.status,
    ownerUserId: row.ownerUserId,
    remarks: row.remarks,
    clearedByUserId: row.clearedByUserId,
    clearedAt: row.clearedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapAssetLine(row: {
  id: string
  exitId: string
  description: string
  assetCategory: string | null
  status: string
  recoveryAmount: Prisma.Decimal
  remarks: string | null
  clearedByUserId: string | null
  clearedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    exitId: row.exitId,
    description: row.description,
    assetCategory: row.assetCategory,
    status: row.status,
    recoveryAmount: dec(row.recoveryAmount),
    remarks: row.remarks,
    clearedByUserId: row.clearedByUserId,
    clearedAt: row.clearedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadExitForAccess(tenantId: string, exitId: string, scope: UserDataScope) {
  const exit = await prisma.hrEmployeeExit.findFirst({
    where: { id: exitId, tenantId, deletedAt: null },
    include: { employee: { select: { id: true, legalEntityId: true, branchId: true } } },
  })
  if (!exit) throw new NotFoundError('Exit record not found')
  assertHrAccess(scope, { legalEntityId: exit.employee.legalEntityId, branchId: exit.employee.branchId })
  return exit
}

/**
 * Seed the clearance checklist for an exit from active `HrExitClearanceTemplate` rows
 * (tenant-wide or legal-entity-specific, LE-specific wins on code clash) or the hardcoded
 * IT/Admin/Stores/Finance/HR/Department default when no templates are configured.
 * No-op if lines already exist (idempotent — safe to call from exit approval).
 */
export async function seedClearanceLinesTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  exitId: string,
  legalEntityId: string,
): Promise<void> {
  const existing = await tx.hrExitClearanceLine.count({ where: { tenantId, exitId } })
  if (existing > 0) return

  const templates = await tx.hrExitClearanceTemplate.findMany({
    where: { tenantId, isActive: true, OR: [{ legalEntityId }, { legalEntityId: null }] },
    orderBy: [{ sequence: 'asc' }],
  })

  const byCode = new Map<string, { code: string; name: string; sequence: number }>()
  for (const t of templates) {
    // Iterate LE-specific after tenant-wide so a legal-entity override always wins on clash.
    if (t.legalEntityId == null && byCode.has(t.code)) continue
    byCode.set(t.code, { code: t.code, name: t.name, sequence: t.sequence })
  }
  for (const t of templates) {
    if (t.legalEntityId) byCode.set(t.code, { code: t.code, name: t.name, sequence: t.sequence })
  }

  const source = byCode.size > 0 ? [...byCode.values()].sort((a, b) => a.sequence - b.sequence) : DEFAULT_CLEARANCE_ITEMS

  for (const entry of source) {
    const item = await tx.hrExitClearanceItem.create({
      data: { tenantId, exitId, code: entry.code, name: entry.name, sequence: entry.sequence },
    })
    await tx.hrExitClearanceLine.create({
      data: {
        tenantId,
        exitId,
        itemId: item.id,
        code: entry.code,
        name: entry.name,
        sequence: entry.sequence,
        status: 'PENDING',
      },
    })
  }
}

export async function seedClearance(tenantId: string, exitId: string, scope: UserDataScope, audit?: AuditMeta) {
  const exit = await loadExitForAccess(tenantId, exitId, scope)
  const existing = await prisma.hrExitClearanceLine.count({ where: { tenantId, exitId } })
  if (existing > 0) throw new ValidationError('Clearance lines have already been seeded for this exit')

  await prisma.$transaction((tx) => seedClearanceLinesTx(tx, tenantId, exitId, exit.employee.legalEntityId))

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeExit',
    entityId: exitId,
    action: 'CLEARANCE_SEED',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return listClearance(tenantId, exitId, scope)
}

export async function listClearance(tenantId: string, exitId: string, scope: UserDataScope) {
  await loadExitForAccess(tenantId, exitId, scope)
  const lines = await prisma.hrExitClearanceLine.findMany({
    where: { tenantId, exitId },
    orderBy: [{ sequence: 'asc' }],
  })
  return lines.map(mapClearanceLine)
}

/**
 * Auto-transition CLEARANCE_PENDING → READY_FOR_SETTLEMENT once every clearance line is
 * CLEARED/WAIVED and no asset line remains PENDING. Called after every clear/waive/asset
 * status change; no-op for exits not currently in CLEARANCE_PENDING.
 */
export async function recomputeReadiness(tenantId: string, exitId: string, audit?: AuditMeta) {
  const exit = await prisma.hrEmployeeExit.findFirst({ where: { id: exitId, tenantId, deletedAt: null } })
  if (!exit) throw new NotFoundError('Exit record not found')
  if (exit.status !== 'CLEARANCE_PENDING') {
    return { status: exit.status, transitioned: false }
  }

  const [pendingClearance, pendingAssets] = await Promise.all([
    prisma.hrExitClearanceLine.count({ where: { tenantId, exitId, status: 'PENDING' } }),
    prisma.hrExitAssetLine.count({ where: { tenantId, exitId, status: 'PENDING' } }),
  ])

  if (pendingClearance > 0 || pendingAssets > 0) {
    return { status: exit.status, transitioned: false }
  }

  const updated = await prisma.hrEmployeeExit.update({
    where: { id: exitId },
    data: { status: 'READY_FOR_SETTLEMENT', updatedBy: audit?.userId },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrEmployeeExit',
    entityId: exitId,
    action: 'READY_FOR_SETTLEMENT',
    oldValues: { status: 'CLEARANCE_PENDING' },
    newValues: { status: 'READY_FOR_SETTLEMENT' },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { status: updated.status, transitioned: true }
}

export async function clearLine(
  tenantId: string,
  userId: string,
  exitId: string,
  lineId: string,
  remarks: string | undefined,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  await loadExitForAccess(tenantId, exitId, scope)
  const line = await prisma.hrExitClearanceLine.findFirst({ where: { id: lineId, tenantId, exitId } })
  if (!line) throw new NotFoundError('Clearance line not found')
  if (line.status !== 'PENDING') throw new ValidationError('Only a pending clearance line can be cleared')

  const updated = await prisma.hrExitClearanceLine.update({
    where: { id: lineId },
    data: {
      status: 'CLEARED',
      clearedByUserId: userId,
      clearedAt: new Date(),
      remarks: remarks ?? line.remarks,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrExitClearanceLine',
    entityId: lineId,
    action: 'CLEAR',
    oldValues: { status: 'PENDING' },
    newValues: { status: 'CLEARED' },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  const readiness = await recomputeReadiness(tenantId, exitId, { ...audit, userId: audit?.userId ?? userId })
  return { line: mapClearanceLine(updated), exitStatus: readiness.status }
}

export async function waiveLine(
  tenantId: string,
  userId: string,
  exitId: string,
  lineId: string,
  reason: string,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  await loadExitForAccess(tenantId, exitId, scope)
  const line = await prisma.hrExitClearanceLine.findFirst({ where: { id: lineId, tenantId, exitId } })
  if (!line) throw new NotFoundError('Clearance line not found')
  if (line.status !== 'PENDING') throw new ValidationError('Only a pending clearance line can be waived')

  const updated = await prisma.hrExitClearanceLine.update({
    where: { id: lineId },
    data: {
      status: 'WAIVED',
      clearedByUserId: userId,
      clearedAt: new Date(),
      remarks: reason,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrExitClearanceLine',
    entityId: lineId,
    action: 'WAIVE',
    oldValues: { status: 'PENDING' },
    newValues: { status: 'WAIVED', reason },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  const readiness = await recomputeReadiness(tenantId, exitId, { ...audit, userId: audit?.userId ?? userId })
  return { line: mapClearanceLine(updated), exitStatus: readiness.status }
}

// ─── Asset lines ─────────────────────────────────────────────────────────

const EDITABLE_ASSET_EXIT_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'CLEARANCE_PENDING'] as const

export async function listAssetLines(tenantId: string, exitId: string, scope: UserDataScope) {
  await loadExitForAccess(tenantId, exitId, scope)
  const rows = await prisma.hrExitAssetLine.findMany({ where: { tenantId, exitId }, orderBy: [{ createdAt: 'asc' }] })
  return rows.map(mapAssetLine)
}

export async function addAssetLine(
  tenantId: string,
  exitId: string,
  input: CreateAssetLineInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const exit = await loadExitForAccess(tenantId, exitId, scope)
  if (!(EDITABLE_ASSET_EXIT_STATUSES as readonly string[]).includes(exit.status)) {
    throw new ValidationError('Cannot add asset lines once the exit is ready for settlement or beyond')
  }

  const row = await prisma.hrExitAssetLine.create({
    data: {
      tenantId,
      exitId,
      description: input.description.trim(),
      assetCategory: input.assetCategory?.trim() ?? null,
      recoveryAmount: formatForPersistence(input.recoveryAmount ?? 0, 2),
      remarks: input.remarks?.trim() ?? null,
      status: 'PENDING',
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrExitAssetLine',
    entityId: row.id,
    action: 'CREATE',
    newValues: { description: row.description },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapAssetLine(row)
}

export async function updateAssetLine(
  tenantId: string,
  exitId: string,
  assetLineId: string,
  input: UpdateAssetLineInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  await loadExitForAccess(tenantId, exitId, scope)
  const line = await prisma.hrExitAssetLine.findFirst({ where: { id: assetLineId, tenantId, exitId } })
  if (!line) throw new NotFoundError('Asset line not found')
  if (line.status !== 'PENDING') throw new ValidationError('Only a pending asset line can be edited — use the status action instead')

  const updated = await prisma.hrExitAssetLine.update({
    where: { id: assetLineId },
    data: {
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.assetCategory !== undefined ? { assetCategory: input.assetCategory?.trim() ?? null } : {}),
      ...(input.remarks !== undefined ? { remarks: input.remarks?.trim() ?? null } : {}),
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrExitAssetLine',
    entityId: assetLineId,
    action: 'UPDATE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapAssetLine(updated)
}

export async function removeAssetLine(
  tenantId: string,
  exitId: string,
  assetLineId: string,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  await loadExitForAccess(tenantId, exitId, scope)
  const line = await prisma.hrExitAssetLine.findFirst({ where: { id: assetLineId, tenantId, exitId } })
  if (!line) throw new NotFoundError('Asset line not found')
  if (line.status !== 'PENDING') throw new ValidationError('Only a pending asset line can be removed')

  await prisma.hrExitAssetLine.delete({ where: { id: assetLineId } })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrExitAssetLine',
    entityId: assetLineId,
    action: 'DELETE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })
}

export async function setAssetStatus(
  tenantId: string,
  userId: string,
  exitId: string,
  assetLineId: string,
  input: SetAssetStatusInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  await loadExitForAccess(tenantId, exitId, scope)
  const line = await prisma.hrExitAssetLine.findFirst({ where: { id: assetLineId, tenantId, exitId } })
  if (!line) throw new NotFoundError('Asset line not found')

  const resolvedRecovery =
    input.recoveryAmount !== undefined ? formatForPersistence(input.recoveryAmount, 2) : line.recoveryAmount

  const updated = await prisma.hrExitAssetLine.update({
    where: { id: assetLineId },
    data: {
      status: input.status,
      recoveryAmount: resolvedRecovery,
      remarks: input.remarks !== undefined ? input.remarks?.trim() ?? null : line.remarks,
      clearedByUserId: input.status === 'PENDING' ? null : userId,
      clearedAt: input.status === 'PENDING' ? null : new Date(),
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrExitAssetLine',
    entityId: assetLineId,
    action: 'STATUS',
    oldValues: { status: line.status },
    newValues: { status: input.status, recoveryAmount: resolvedRecovery },
    userId: audit?.userId ?? userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  const readiness = await recomputeReadiness(tenantId, exitId, { ...audit, userId: audit?.userId ?? userId })
  return { line: mapAssetLine(updated), exitStatus: readiness.status }
}

export { mapClearanceLine, mapAssetLine }
