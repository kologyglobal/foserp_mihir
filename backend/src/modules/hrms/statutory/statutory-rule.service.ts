import type { HrStatutoryRuleType, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertEmployeeAccessible } from '../employees/employee.service.js'
import { assertHrAccess, hrLegalEntityScopeWhere } from '../hrms-scope.js'
import { toDateOnly } from '../shared/shift-time.util.js'
import { decStatutory } from './wage-basis.service.js'
import type {
  CreateRuleInput,
  ListRulesQuery,
  PutPtSlabsInput,
  PutWageBasisInput,
  UpdateRuleInput,
} from './statutory.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const ruleWithLinesInclude = {
  wageBasisLines: { orderBy: { sequence: 'asc' } },
  ptSlabs: { orderBy: [{ specialMonth: 'asc' }, { sequence: 'asc' }] },
} satisfies Prisma.HrStatutoryRuleInclude

export type EffectiveStatutoryRule = Prisma.HrStatutoryRuleGetPayload<{ include: typeof ruleWithLinesInclude }>

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayBefore(d: Date): Date {
  const r = new Date(d.getTime())
  r.setUTCDate(r.getUTCDate() - 1)
  return r
}

function mapRule(row: Prisma.HrStatutoryRuleGetPayload<{ include: typeof ruleWithLinesInclude }>) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    type: row.type,
    code: row.code,
    name: row.name,
    stateCode: row.stateCode,
    effectiveFrom: formatDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
    status: row.status,
    employeeRatePct: decStatutory(row.employeeRatePct),
    employerRatePct: decStatutory(row.employerRatePct),
    wageCeiling: decStatutory(row.wageCeiling),
    eligibilityWageCeiling: decStatutory(row.eligibilityWageCeiling),
    roundingMode: row.roundingMode,
    frequency: row.frequency,
    employeeFixedAmount: decStatutory(row.employeeFixedAmount),
    employerFixedAmount: decStatutory(row.employerFixedAmount),
    configJson: row.configJson ? (JSON.parse(row.configJson) as Record<string, unknown>) : null,
    isActive: row.isActive,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    wageBasisLines: row.wageBasisLines.map((l) => ({
      id: l.id,
      componentCode: l.componentCode,
      salaryComponentId: l.salaryComponentId,
      sequence: l.sequence,
      include: l.include,
    })),
    ptSlabs: row.ptSlabs.map((s) => ({
      id: s.id,
      fromAmount: decStatutory(s.fromAmount),
      toAmount: decStatutory(s.toAmount),
      taxAmount: decStatutory(s.taxAmount),
      specialMonth: s.specialMonth,
      sequence: s.sequence,
    })),
  }
}

function ruleWhere(tenantId: string, scope: UserDataScope, query: ListRulesQuery): Prisma.HrStatutoryRuleWhereInput {
  return {
    tenantId,
    deletedAt: null,
    ...(query.type ? { type: query.type } : {}),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.stateCode ? { stateCode: query.stateCode.toUpperCase() } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] } : {}),
    ...hrLegalEntityScopeWhere(scope),
  }
}

async function assertRuleAccess(tenantId: string, ruleId: string, scope: UserDataScope) {
  const rule = await prisma.hrStatutoryRule.findFirst({
    where: { id: ruleId, tenantId, deletedAt: null, ...hrLegalEntityScopeWhere(scope) },
    include: ruleWithLinesInclude,
  })
  if (!rule) throw new NotFoundError('Statutory rule not found')
  if (rule.legalEntityId) assertHrAccess(scope, { legalEntityId: rule.legalEntityId })
  return rule
}

export async function listRules(tenantId: string, scope: UserDataScope, query: ListRulesQuery) {
  const { page, limit, skip } = getPagination(query)
  const where = ruleWhere(tenantId, scope, query)
  const [total, rows] = await Promise.all([
    prisma.hrStatutoryRule.count({ where }),
    prisma.hrStatutoryRule.findMany({
      where,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      skip,
      take: limit,
      include: ruleWithLinesInclude,
    }),
  ])
  return { items: rows.map(mapRule), total, page, limit }
}

export async function getRule(tenantId: string, ruleId: string, scope: UserDataScope) {
  const rule = await assertRuleAccess(tenantId, ruleId, scope)
  return mapRule(rule)
}

function normalizeConfigJson(configJson: Record<string, unknown> | null | undefined): string | null {
  if (configJson == null) return null
  return JSON.stringify(configJson)
}

function validateRuleInput(_type: HrStatutoryRuleType, input: CreateRuleInput | UpdateRuleInput): void {
  if (input.effectiveTo) {
    const from = input.effectiveFrom ? toDateOnly(input.effectiveFrom) : null
    if (from && toDateOnly(input.effectiveTo).getTime() < from.getTime()) {
      throw new ValidationError('effectiveTo must be on or after effectiveFrom')
    }
  }
}

export async function createRule(
  tenantId: string,
  input: CreateRuleInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  if (input.legalEntityId) assertHrAccess(scope, { legalEntityId: input.legalEntityId })
  validateRuleInput(input.type, input)

  const code = input.code.trim().toUpperCase()
  const clash = await prisma.hrStatutoryRule.findFirst({ where: { tenantId, code, deletedAt: null } })
  if (clash) throw new ConflictError(`Statutory rule ${code} already exists`)

  const row = await prisma.hrStatutoryRule.create({
    data: {
      tenantId,
      type: input.type,
      code,
      name: input.name.trim(),
      legalEntityId: input.legalEntityId ?? null,
      stateCode: input.stateCode ? input.stateCode.trim().toUpperCase() : null,
      effectiveFrom: toDateOnly(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? toDateOnly(input.effectiveTo) : null,
      status: 'DRAFT',
      employeeRatePct: input.employeeRatePct ?? null,
      employerRatePct: input.employerRatePct ?? null,
      wageCeiling: input.wageCeiling ?? null,
      eligibilityWageCeiling: input.eligibilityWageCeiling ?? null,
      roundingMode: input.roundingMode ?? 'NEAREST',
      frequency: input.frequency ?? null,
      employeeFixedAmount: input.employeeFixedAmount ?? null,
      employerFixedAmount: input.employerFixedAmount ?? null,
      configJson: normalizeConfigJson(input.configJson),
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
    include: ruleWithLinesInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrStatutoryRule',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code, type: row.type },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapRule(row)
}

export async function updateRule(
  tenantId: string,
  ruleId: string,
  input: UpdateRuleInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await assertRuleAccess(tenantId, ruleId, scope)
  if (existing.status !== 'DRAFT') {
    throw new ValidationError('Only DRAFT statutory rules can be edited')
  }
  const nextLe = input.legalEntityId !== undefined ? input.legalEntityId : existing.legalEntityId
  if (nextLe) assertHrAccess(scope, { legalEntityId: nextLe })
  validateRuleInput(existing.type, input)

  if (input.code) {
    const code = input.code.trim().toUpperCase()
    const clash = await prisma.hrStatutoryRule.findFirst({
      where: { tenantId, code, deletedAt: null, NOT: { id: ruleId } },
    })
    if (clash) throw new ConflictError(`Statutory rule ${code} already exists`)
  }

  const row = await prisma.hrStatutoryRule.update({
    where: { id: ruleId },
    data: {
      ...(input.code ? { code: input.code.trim().toUpperCase() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.legalEntityId !== undefined ? { legalEntityId: input.legalEntityId } : {}),
      ...(input.stateCode !== undefined ? { stateCode: input.stateCode ? input.stateCode.trim().toUpperCase() : null } : {}),
      ...(input.effectiveFrom !== undefined ? { effectiveFrom: toDateOnly(input.effectiveFrom) } : {}),
      ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo ? toDateOnly(input.effectiveTo) : null } : {}),
      ...(input.employeeRatePct !== undefined ? { employeeRatePct: input.employeeRatePct } : {}),
      ...(input.employerRatePct !== undefined ? { employerRatePct: input.employerRatePct } : {}),
      ...(input.wageCeiling !== undefined ? { wageCeiling: input.wageCeiling } : {}),
      ...(input.eligibilityWageCeiling !== undefined ? { eligibilityWageCeiling: input.eligibilityWageCeiling } : {}),
      ...(input.roundingMode !== undefined ? { roundingMode: input.roundingMode } : {}),
      ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
      ...(input.employeeFixedAmount !== undefined ? { employeeFixedAmount: input.employeeFixedAmount } : {}),
      ...(input.employerFixedAmount !== undefined ? { employerFixedAmount: input.employerFixedAmount } : {}),
      ...(input.configJson !== undefined ? { configJson: normalizeConfigJson(input.configJson) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
    include: ruleWithLinesInclude,
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrStatutoryRule',
    entityId: row.id,
    action: 'UPDATE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapRule(row)
}

export async function putWageBasis(
  tenantId: string,
  ruleId: string,
  input: PutWageBasisInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await assertRuleAccess(tenantId, ruleId, scope)
  if (existing.status !== 'DRAFT') {
    throw new ValidationError('Wage-basis lines can only be edited while the rule is DRAFT')
  }

  const seen = new Set<string>()
  for (const line of input.lines) {
    const code = line.componentCode.trim().toUpperCase()
    if (seen.has(code)) throw new ValidationError(`Duplicate wage-basis component ${code}`)
    seen.add(code)
  }

  await prisma.$transaction(async (tx) => {
    await tx.hrStatutoryWageBasisLine.deleteMany({ where: { statutoryRuleId: ruleId } })
    if (input.lines.length > 0) {
      await tx.hrStatutoryWageBasisLine.createMany({
        data: input.lines.map((line) => ({
          tenantId,
          statutoryRuleId: ruleId,
          componentCode: line.componentCode.trim().toUpperCase(),
          salaryComponentId: line.salaryComponentId ?? null,
          sequence: line.sequence ?? 10,
          include: line.include ?? true,
        })),
      })
    }
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrStatutoryRule',
    entityId: ruleId,
    action: 'UPDATE_WAGE_BASIS',
    newValues: { lineCount: input.lines.length },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getRule(tenantId, ruleId, scope)
}

export async function putPtSlabs(
  tenantId: string,
  ruleId: string,
  input: PutPtSlabsInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await assertRuleAccess(tenantId, ruleId, scope)
  if (existing.type !== 'PROFESSIONAL_TAX') {
    throw new ValidationError('PT slabs can only be configured on a PROFESSIONAL_TAX rule')
  }
  if (existing.status !== 'DRAFT') {
    throw new ValidationError('PT slabs can only be edited while the rule is DRAFT')
  }

  await prisma.$transaction(async (tx) => {
    await tx.hrStatutoryPtSlab.deleteMany({ where: { statutoryRuleId: ruleId } })
    if (input.slabs.length > 0) {
      await tx.hrStatutoryPtSlab.createMany({
        data: input.slabs.map((slab) => ({
          tenantId,
          statutoryRuleId: ruleId,
          fromAmount: slab.fromAmount,
          toAmount: slab.toAmount ?? null,
          taxAmount: slab.taxAmount,
          specialMonth: slab.specialMonth ?? null,
          sequence: slab.sequence ?? 10,
        })),
      })
    }
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrStatutoryRule',
    entityId: ruleId,
    action: 'UPDATE_PT_SLABS',
    newValues: { slabCount: input.slabs.length },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getRule(tenantId, ruleId, scope)
}

/**
 * Activate a DRAFT rule. Supersedes any overlapping ACTIVE rule of the same
 * type + legalEntityId + stateCode (mirrors salary structure version activation).
 */
export async function activateRule(tenantId: string, ruleId: string, scope: UserDataScope, audit?: AuditMeta) {
  const rule = await assertRuleAccess(tenantId, ruleId, scope)
  if (rule.status !== 'DRAFT') {
    throw new ValidationError('Only DRAFT statutory rules can be activated')
  }
  if (rule.type === 'PROFESSIONAL_TAX' && rule.ptSlabs.length === 0) {
    throw new ValidationError('At least one PT slab is required to activate a PROFESSIONAL_TAX rule')
  }

  const overlapping = await prisma.hrStatutoryRule.findMany({
    where: {
      tenantId,
      type: rule.type,
      legalEntityId: rule.legalEntityId,
      stateCode: rule.stateCode,
      status: 'ACTIVE',
      deletedAt: null,
      NOT: { id: ruleId },
    },
  })

  const closeBefore = dayBefore(rule.effectiveFrom)
  const overlapsDates = (other: { effectiveFrom: Date; effectiveTo: Date | null }): boolean => {
    const aEnd = rule.effectiveTo ?? new Date('9999-12-31')
    const bEnd = other.effectiveTo ?? new Date('9999-12-31')
    return rule.effectiveFrom.getTime() <= bEnd.getTime() && other.effectiveFrom.getTime() <= aEnd.getTime()
  }

  await prisma.$transaction(async (tx) => {
    for (const other of overlapping) {
      if (overlapsDates(other)) {
        await tx.hrStatutoryRule.update({
          where: { id: other.id },
          data: { status: 'SUPERSEDED', effectiveTo: closeBefore, updatedBy: audit?.userId },
        })
      }
    }

    await tx.hrStatutoryRule.update({
      where: { id: ruleId },
      data: {
        status: 'ACTIVE',
        approvedByUserId: audit?.userId ?? null,
        approvedAt: new Date(),
        updatedBy: audit?.userId,
      },
    })
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrStatutoryRule',
    entityId: ruleId,
    action: 'ACTIVATE',
    newValues: { status: 'ACTIVE', effectiveFrom: formatDateOnly(rule.effectiveFrom) },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getRule(tenantId, ruleId, scope)
}

/**
 * Resolve the single best-matching ACTIVE rule for a type on a given date.
 * Specificity scoring: exact legalEntityId match beats tenant-wide (null); exact
 * stateCode match beats a rule with no stateCode. A rule whose stateCode is set
 * but does not match the given stateCode (or no stateCode was supplied) is excluded.
 * Ties broken by the most recent effectiveFrom.
 */
export async function getEffectiveStatutoryRule(
  tenantId: string,
  type: HrStatutoryRuleType,
  ctx: { legalEntityId?: string | null; stateCode?: string | null },
  date: Date,
): Promise<EffectiveStatutoryRule | null> {
  const asOf = toDateOnly(date)
  const candidates = await prisma.hrStatutoryRule.findMany({
    where: {
      tenantId,
      type,
      status: 'ACTIVE',
      deletedAt: null,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    include: ruleWithLinesInclude,
  })

  let best: EffectiveStatutoryRule | null = null
  let bestScore = -1

  for (const rule of candidates) {
    let leScore: number
    if (rule.legalEntityId === null) leScore = 1
    else if (ctx.legalEntityId && rule.legalEntityId === ctx.legalEntityId) leScore = 2
    else continue

    let stateScore: number
    if (rule.stateCode === null) stateScore = 1
    else if (ctx.stateCode && rule.stateCode === ctx.stateCode.toUpperCase()) stateScore = 2
    else continue

    const score = leScore * 10 + stateScore
    if (
      score > bestScore ||
      (score === bestScore && best && rule.effectiveFrom.getTime() > best.effectiveFrom.getTime())
    ) {
      best = rule
      bestScore = score
    }
  }

  return best
}

/** Resolve helper for tests/docs: shows the effective rule + resolution context for one employee. */
export async function resolveRuleForEmployee(
  tenantId: string,
  scope: UserDataScope,
  type: HrStatutoryRuleType,
  employeeId: string,
  date: Date,
) {
  const employee = await assertEmployeeAccessible(tenantId, scope, employeeId)
  const branch = await prisma.branch.findFirst({ where: { id: employee.branchId, tenantId }, select: { stateCode: true } })
  const stateCode = branch?.stateCode ?? null
  const rule = await getEffectiveStatutoryRule(tenantId, type, { legalEntityId: employee.legalEntityId, stateCode }, date)

  return {
    employeeId,
    type,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    stateCode,
    asOfDate: formatDateOnly(toDateOnly(date)),
    rule: rule ? mapRule(rule) : null,
  }
}
