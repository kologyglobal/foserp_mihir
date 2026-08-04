import type { DocumentDatePolicy, DocumentDatePolicyAllowance, Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { createAuditLog } from '../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js'
import { buildPaginationMeta, getPagination } from '../../utils/pagination.js'
import {
  AUDIT_ENTITY_POLICY,
  AUDIT_ENTITY_PROFILE,
  AUDIT_MODULE,
} from './document-governance.constants.js'
import {
  defaultCurrentBehaviourPolicy,
  evaluateDocumentDatePolicy,
  resolveEffectivePolicyFromCandidates,
} from './document-date-policy.service.js'
import type {
  EvaluateDocumentDatePolicyInput,
  GetDocumentDatePolicyInput,
} from './document-date-policy.types.js'
import { isRegisteredDocument } from './document-registry.js'
import { documentGovernanceFeatureFlagStatus } from './feature-flag.js'
import type {
  CreateDateControlInput,
  CreateProfileInput,
  ListDateControlsQuery,
  UpdateDateControlInput,
  UpdateProfileInput,
} from './document-governance.validation.js'

type AuditMeta = {
  tenantId?: string
  userId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

const policyInclude = {
  allowances: true,
  profile: true,
} satisfies Prisma.DocumentDatePolicyInclude

type PolicyWithRel = DocumentDatePolicy & {
  allowances: DocumentDatePolicyAllowance[]
  profile: { id: string; code: string; name: string } | null
}

function scopeKey(input: {
  legalEntityId?: string | null
  branchId?: string | null
  moduleKey: string
  documentType: string
}) {
  return [
    input.moduleKey,
    input.documentType,
    input.legalEntityId ?? '',
    input.branchId ?? '',
  ].join('|')
}

function parseOptionalDate(value?: string | null): Date | null {
  if (value == null || value === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new ValidationError(`Invalid date: ${value}`)
  return d
}

function serializePolicy(row: PolicyWithRel) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    moduleKey: row.moduleKey,
    documentType: row.documentType,
    policyEnabled: row.policyEnabled,
    futureDateMode: row.futureDateMode,
    pastDateMode: row.pastDateMode,
    maxFutureDays: row.maxFutureDays,
    maxBackDateDays: row.maxBackDateDays,
    approvalRequired: row.approvalRequired,
    allowEmergencyOverride: row.allowEmergencyOverride,
    policyProfile: row.policyProfile,
    profileId: row.profileId,
    profile: row.profile
      ? { id: row.profile.id, code: row.profile.code, name: row.profile.name }
      : null,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    active: row.active,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    allowances: row.allowances.map((a) => ({
      id: a.id,
      kind: a.kind,
      roleId: a.roleId,
      userId: a.userId,
    })),
  }
}

async function assertRegistry(moduleKey: string, documentType: string) {
  if (!isRegisteredDocument(moduleKey, documentType)) {
    throw new ValidationError(
      `Unknown document type ${moduleKey}/${documentType} — not in Document Governance registry`,
    )
  }
}

async function assertAllowances(
  tenantId: string,
  allowances: Array<{ kind: string; roleId?: string | null; userId?: string | null }>,
) {
  for (const a of allowances) {
    if (a.roleId) {
      const role = await prisma.role.findFirst({
        where: {
          id: a.roleId,
          deletedAt: null,
          OR: [{ tenantId }, { tenantId: null }],
        },
      })
      if (!role) throw new ValidationError(`Invalid roleId: ${a.roleId}`)
    }
    if (a.userId) {
      const user = await prisma.user.findFirst({
        where: { id: a.userId, tenantId, deletedAt: null },
      })
      if (!user) throw new ValidationError(`Invalid userId: ${a.userId}`)
    }
  }
}

async function assertNoDuplicateActive(
  tenantId: string,
  input: {
    legalEntityId?: string | null
    branchId?: string | null
    moduleKey: string
    documentType: string
    active?: boolean
  },
  excludeId?: string,
) {
  if (input.active === false) return
  const where: Prisma.DocumentDatePolicyWhereInput = {
    tenantId,
    moduleKey: input.moduleKey,
    documentType: input.documentType,
    active: true,
    legalEntityId: input.legalEntityId ?? null,
    branchId: input.branchId ?? null,
  }
  if (excludeId) where.id = { not: excludeId }
  const existing = await prisma.documentDatePolicy.findFirst({ where })
  if (existing) {
    throw new ConflictError(
      `An active date policy already exists for scope ${scopeKey(input)} (id=${existing.id})`,
    )
  }
}

export async function listDateControls(tenantId: string, query: ListDateControlsQuery) {
  const { page, limit, skip } = getPagination(query)
  const where: Prisma.DocumentDatePolicyWhereInput = { tenantId }
  if (query.moduleKey) where.moduleKey = query.moduleKey
  if (query.documentType) where.documentType = query.documentType
  if (query.active === 'true') where.active = true
  if (query.active === 'false') where.active = false
  if (query.policyEnabled === 'true') where.policyEnabled = true
  if (query.policyEnabled === 'false') where.policyEnabled = false

  const [total, rows] = await Promise.all([
    prisma.documentDatePolicy.count({ where }),
    prisma.documentDatePolicy.findMany({
      where,
      include: policyInclude,
      orderBy: [{ moduleKey: 'asc' }, { documentType: 'asc' }, { updatedAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return {
    items: (rows as PolicyWithRel[]).map(serializePolicy),
    meta: buildPaginationMeta(total, page, limit),
    featureFlag: documentGovernanceFeatureFlagStatus(),
  }
}

export async function getDateControl(tenantId: string, id: string) {
  const row = await prisma.documentDatePolicy.findFirst({
    where: { id, tenantId },
    include: policyInclude,
  })
  if (!row) throw new NotFoundError('Document date policy not found')
  return serializePolicy(row as PolicyWithRel)
}

export async function createDateControl(
  tenantId: string,
  input: CreateDateControlInput,
  audit: AuditMeta,
) {
  await assertRegistry(input.moduleKey, input.documentType)
  await assertAllowances(tenantId, input.allowances ?? [])
  await assertNoDuplicateActive(tenantId, {
    legalEntityId: input.legalEntityId,
    branchId: input.branchId,
    moduleKey: input.moduleKey,
    documentType: input.documentType,
    active: input.active,
  })

  if (input.profileId) {
    const profile = await prisma.documentDatePolicyProfile.findFirst({
      where: { id: input.profileId, tenantId },
    })
    if (!profile) throw new ValidationError('Invalid profileId')
  }

  const row = await prisma.documentDatePolicy.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId ?? null,
      branchId: input.branchId ?? null,
      moduleKey: input.moduleKey,
      documentType: input.documentType,
      policyEnabled: input.policyEnabled ?? false,
      futureDateMode: input.futureDateMode ?? 'CURRENT_BEHAVIOUR',
      pastDateMode: input.pastDateMode ?? 'CURRENT_BEHAVIOUR',
      maxFutureDays: input.maxFutureDays ?? null,
      maxBackDateDays: input.maxBackDateDays ?? null,
      approvalRequired: input.approvalRequired ?? false,
      allowEmergencyOverride: input.allowEmergencyOverride ?? false,
      policyProfile: input.policyProfile ?? null,
      profileId: input.profileId ?? null,
      effectiveFrom: parseOptionalDate(input.effectiveFrom ?? null),
      effectiveTo: parseOptionalDate(input.effectiveTo ?? null),
      active: input.active ?? true,
      createdBy: audit.userId ?? null,
      updatedBy: audit.userId ?? null,
      allowances: {
        create: (input.allowances ?? []).map((a) => ({
          tenantId,
          kind: a.kind,
          roleId: a.roleId ?? null,
          userId: a.userId ?? null,
        })),
      },
    },
    include: policyInclude,
  })

  await createAuditLog({
    ...audit,
    tenantId,
    module: AUDIT_MODULE,
    entity: AUDIT_ENTITY_POLICY,
    entityId: row.id,
    action: 'POLICY_CREATED',
    newValues: serializePolicy(row as PolicyWithRel),
  })

  return serializePolicy(row as PolicyWithRel)
}

export async function updateDateControl(
  tenantId: string,
  id: string,
  input: UpdateDateControlInput,
  audit: AuditMeta,
) {
  const existing = await prisma.documentDatePolicy.findFirst({
    where: { id, tenantId },
    include: policyInclude,
  })
  if (!existing) throw new NotFoundError('Document date policy not found')

  const moduleKey = input.moduleKey ?? existing.moduleKey
  const documentType = input.documentType ?? existing.documentType
  await assertRegistry(moduleKey, documentType)

  if (input.allowances) await assertAllowances(tenantId, input.allowances)

  await assertNoDuplicateActive(
    tenantId,
    {
      legalEntityId: input.legalEntityId !== undefined ? input.legalEntityId : existing.legalEntityId,
      branchId: input.branchId !== undefined ? input.branchId : existing.branchId,
      moduleKey,
      documentType,
      active: input.active !== undefined ? input.active : existing.active,
    },
    id,
  )

  if (input.profileId) {
    const profile = await prisma.documentDatePolicyProfile.findFirst({
      where: { id: input.profileId, tenantId },
    })
    if (!profile) throw new ValidationError('Invalid profileId')
  }

  const data: Prisma.DocumentDatePolicyUpdateInput = {
    updatedBy: audit.userId ?? null,
  }
  if (input.legalEntityId !== undefined) data.legalEntityId = input.legalEntityId
  if (input.branchId !== undefined) data.branchId = input.branchId
  if (input.moduleKey !== undefined) data.moduleKey = input.moduleKey
  if (input.documentType !== undefined) data.documentType = input.documentType
  if (input.policyEnabled !== undefined) data.policyEnabled = input.policyEnabled
  if (input.futureDateMode !== undefined) data.futureDateMode = input.futureDateMode
  if (input.pastDateMode !== undefined) data.pastDateMode = input.pastDateMode
  if (input.maxFutureDays !== undefined) data.maxFutureDays = input.maxFutureDays
  if (input.maxBackDateDays !== undefined) data.maxBackDateDays = input.maxBackDateDays
  if (input.approvalRequired !== undefined) data.approvalRequired = input.approvalRequired
  if (input.allowEmergencyOverride !== undefined) {
    data.allowEmergencyOverride = input.allowEmergencyOverride
  }
  if (input.policyProfile !== undefined) data.policyProfile = input.policyProfile
  if (input.profileId !== undefined) {
    data.profile = input.profileId
      ? { connect: { id: input.profileId } }
      : { disconnect: true }
  }
  if (input.effectiveFrom !== undefined) data.effectiveFrom = parseOptionalDate(input.effectiveFrom)
  if (input.effectiveTo !== undefined) data.effectiveTo = parseOptionalDate(input.effectiveTo)
  if (input.active !== undefined) data.active = input.active

  const row = await prisma.$transaction(async (tx) => {
    if (input.allowances) {
      await tx.documentDatePolicyAllowance.deleteMany({ where: { policyId: id, tenantId } })
      if (input.allowances.length) {
        await tx.documentDatePolicyAllowance.createMany({
          data: input.allowances.map((a) => ({
            tenantId,
            policyId: id,
            kind: a.kind,
            roleId: a.roleId ?? null,
            userId: a.userId ?? null,
          })),
        })
      }
    }
    return tx.documentDatePolicy.update({
      where: { id },
      data,
      include: policyInclude,
    })
  })

  await createAuditLog({
    ...audit,
    tenantId,
    module: AUDIT_MODULE,
    entity: AUDIT_ENTITY_POLICY,
    entityId: id,
    action: 'POLICY_UPDATED',
    oldValues: serializePolicy(existing as PolicyWithRel),
    newValues: serializePolicy(row as PolicyWithRel),
  })

  if (input.profileId !== undefined) {
    await createAuditLog({
      ...audit,
      tenantId,
      module: AUDIT_MODULE,
      entity: AUDIT_ENTITY_POLICY,
      entityId: id,
      action: input.profileId ? 'PROFILE_ASSIGNED' : 'PROFILE_REMOVED',
      oldValues: { profileId: existing.profileId },
      newValues: { profileId: input.profileId },
    })
  }

  return serializePolicy(row as PolicyWithRel)
}

export async function activateDateControl(tenantId: string, id: string, audit: AuditMeta) {
  const existing = await prisma.documentDatePolicy.findFirst({
    where: { id, tenantId },
    include: policyInclude,
  })
  if (!existing) throw new NotFoundError('Document date policy not found')

  await assertNoDuplicateActive(
    tenantId,
    {
      legalEntityId: existing.legalEntityId,
      branchId: existing.branchId,
      moduleKey: existing.moduleKey,
      documentType: existing.documentType,
      active: true,
    },
    id,
  )

  const row = await prisma.documentDatePolicy.update({
    where: { id },
    data: {
      active: true,
      policyEnabled: true,
      updatedBy: audit.userId ?? null,
    },
    include: policyInclude,
  })

  await createAuditLog({
    ...audit,
    tenantId,
    module: AUDIT_MODULE,
    entity: AUDIT_ENTITY_POLICY,
    entityId: id,
    action: 'POLICY_ACTIVATED',
    oldValues: { active: existing.active, policyEnabled: existing.policyEnabled },
    newValues: { active: true, policyEnabled: true },
  })

  return serializePolicy(row as PolicyWithRel)
}

export async function deactivateDateControl(tenantId: string, id: string, audit: AuditMeta) {
  const existing = await prisma.documentDatePolicy.findFirst({
    where: { id, tenantId },
    include: policyInclude,
  })
  if (!existing) throw new NotFoundError('Document date policy not found')

  const row = await prisma.documentDatePolicy.update({
    where: { id },
    data: {
      active: false,
      policyEnabled: false,
      updatedBy: audit.userId ?? null,
    },
    include: policyInclude,
  })

  await createAuditLog({
    ...audit,
    tenantId,
    module: AUDIT_MODULE,
    entity: AUDIT_ENTITY_POLICY,
    entityId: id,
    action: 'POLICY_DEACTIVATED',
    oldValues: { active: existing.active, policyEnabled: existing.policyEnabled },
    newValues: { active: false, policyEnabled: false },
  })

  return serializePolicy(row as PolicyWithRel)
}

/** Reset modes/flags to current-behaviour defaults without deleting the row. */
export async function resetDateControlToCurrentBehaviour(
  tenantId: string,
  id: string,
  audit: AuditMeta,
) {
  const existing = await prisma.documentDatePolicy.findFirst({
    where: { id, tenantId },
    include: policyInclude,
  })
  if (!existing) throw new NotFoundError('Document date policy not found')

  const row = await prisma.documentDatePolicy.update({
    where: { id },
    data: {
      policyEnabled: false,
      futureDateMode: 'CURRENT_BEHAVIOUR',
      pastDateMode: 'CURRENT_BEHAVIOUR',
      maxFutureDays: null,
      maxBackDateDays: null,
      approvalRequired: false,
      allowEmergencyOverride: false,
      policyProfile: null,
      profile: { disconnect: true },
      updatedBy: audit.userId ?? null,
    },
    include: policyInclude,
  })

  await createAuditLog({
    ...audit,
    tenantId,
    module: AUDIT_MODULE,
    entity: AUDIT_ENTITY_POLICY,
    entityId: id,
    action: 'POLICY_RESET_CURRENT_BEHAVIOUR',
    oldValues: serializePolicy(existing as PolicyWithRel),
    newValues: serializePolicy(row as PolicyWithRel),
  })

  return serializePolicy(row as PolicyWithRel)
}

// ─── Profiles ────────────────────────────────────────────────────────────

export async function listProfiles(tenantId: string) {
  const rows = await prisma.documentDatePolicyProfile.findMany({
    where: { tenantId },
    orderBy: [{ code: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    futureDateMode: r.futureDateMode,
    pastDateMode: r.pastDateMode,
    maxFutureDays: r.maxFutureDays,
    maxBackDateDays: r.maxBackDateDays,
    approvalRequired: r.approvalRequired,
    allowEmergencyOverride: r.allowEmergencyOverride,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function createProfile(
  tenantId: string,
  input: CreateProfileInput,
  audit: AuditMeta,
) {
  const existing = await prisma.documentDatePolicyProfile.findFirst({
    where: { tenantId, code: input.code },
  })
  if (existing) throw new ConflictError(`Profile code already exists: ${input.code}`)

  const row = await prisma.documentDatePolicyProfile.create({
    data: {
      tenantId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      futureDateMode: input.futureDateMode ?? 'CURRENT_BEHAVIOUR',
      pastDateMode: input.pastDateMode ?? 'CURRENT_BEHAVIOUR',
      maxFutureDays: input.maxFutureDays ?? null,
      maxBackDateDays: input.maxBackDateDays ?? null,
      approvalRequired: input.approvalRequired ?? false,
      allowEmergencyOverride: input.allowEmergencyOverride ?? false,
      active: input.active ?? true,
      createdBy: audit.userId ?? null,
      updatedBy: audit.userId ?? null,
    },
  })

  await createAuditLog({
    ...audit,
    tenantId,
    module: AUDIT_MODULE,
    entity: AUDIT_ENTITY_PROFILE,
    entityId: row.id,
    action: 'PROFILE_CREATED',
    newValues: row,
  })

  return row
}

export async function updateProfile(
  tenantId: string,
  id: string,
  input: UpdateProfileInput,
  audit: AuditMeta,
) {
  const existing = await prisma.documentDatePolicyProfile.findFirst({
    where: { id, tenantId },
  })
  if (!existing) throw new NotFoundError('Profile not found')

  if (input.code && input.code !== existing.code) {
    const clash = await prisma.documentDatePolicyProfile.findFirst({
      where: { tenantId, code: input.code, id: { not: id } },
    })
    if (clash) throw new ConflictError(`Profile code already exists: ${input.code}`)
  }

  const row = await prisma.documentDatePolicyProfile.update({
    where: { id },
    data: {
      ...input,
      description: input.description === undefined ? undefined : input.description,
      updatedBy: audit.userId ?? null,
    },
  })

  await createAuditLog({
    ...audit,
    tenantId,
    module: AUDIT_MODULE,
    entity: AUDIT_ENTITY_PROFILE,
    entityId: id,
    action: 'PROFILE_UPDATED',
    oldValues: existing,
    newValues: row,
  })

  return row
}

// ─── Reusable policy resolution (not called from live document flows yet) ─

export async function getDocumentDatePolicy(input: GetDocumentDatePolicyInput) {
  const candidates = await prisma.documentDatePolicy.findMany({
    where: {
      tenantId: input.tenantId,
      moduleKey: input.moduleKey,
      documentType: input.documentType,
      active: true,
    },
  })
  if (!candidates.length) return defaultCurrentBehaviourPolicy(input)
  return resolveEffectivePolicyFromCandidates(candidates, input)
}

export function evaluatePolicyForDocument(input: EvaluateDocumentDatePolicyInput) {
  return evaluateDocumentDatePolicy(input)
}
