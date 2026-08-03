import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess, hrLegalEntityScopeWhere } from '../hrms-scope.js'
import { datesOverlap, toDateOnly } from '../shared/shift-time.util.js'
import { decSalaryAmount } from './salary-component.service.js'
import type {
  CreateStructureInput,
  CreateVersionInput,
  ListStructuresQuery,
  StructureLineInput,
  UpdateStructureInput,
  UpdateVersionInput,
} from './salary.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayBefore(d: Date): Date {
  const r = new Date(d.getTime())
  r.setUTCDate(r.getUTCDate() - 1)
  return r
}

function structureWhere(tenantId: string, scope: UserDataScope, query: ListStructuresQuery): Prisma.HrSalaryStructureWhereInput {
  return {
    tenantId,
    deletedAt: null,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.workerCategory ? { workerCategory: query.workerCategory } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
      : {}),
    ...hrLegalEntityScopeWhere(scope),
  }
}

function mapStructureSummary(row: {
  id: string
  code: string
  name: string
  description: string | null
  legalEntityId: string | null
  workerCategory: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    legalEntityId: row.legalEntityId,
    workerCategory: row.workerCategory,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapVersionSummary(row: {
  id: string
  salaryStructureId: string
  versionNo: number
  effectiveFrom: Date
  effectiveTo: Date | null
  status: string
  approvedByUserId: string | null
  approvedAt: Date | null
  createdAt: Date
}) {
  return {
    id: row.id,
    salaryStructureId: row.salaryStructureId,
    versionNo: row.versionNo,
    effectiveFrom: formatDateOnly(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? formatDateOnly(row.effectiveTo) : null,
    status: row.status,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapLine(row: {
  id: string
  salaryComponentId: string
  sequence: number
  calculationType: string
  fixedAmount: Prisma.Decimal | null
  percentage: Prisma.Decimal | null
  percentageOfComponentId: string | null
  monthlyCap: Prisma.Decimal | null
  annualCap: Prisma.Decimal | null
  isActive: boolean
  salaryComponent?: { id: string; code: string; name: string; type: string; isActive: boolean } | null
  percentageOfComponent?: { id: string; code: string; name: string } | null
}) {
  return {
    id: row.id,
    salaryComponentId: row.salaryComponentId,
    sequence: row.sequence,
    calculationType: row.calculationType,
    fixedAmount: decSalaryAmount(row.fixedAmount),
    percentage: decSalaryAmount(row.percentage),
    percentageOfComponentId: row.percentageOfComponentId,
    monthlyCap: decSalaryAmount(row.monthlyCap),
    annualCap: decSalaryAmount(row.annualCap),
    isActive: row.isActive,
    salaryComponent: row.salaryComponent ?? null,
    percentageOfComponent: row.percentageOfComponent ?? null,
  }
}

export function validateStructureLines(lines: StructureLineInput[]): void {
  if (lines.length === 0) return

  const componentIds = new Set<string>()
  for (const line of lines) {
    if (componentIds.has(line.salaryComponentId)) {
      throw new ValidationError('Duplicate salary component on structure version')
    }
    componentIds.add(line.salaryComponentId)

    if (line.calculationType === 'FIXED') {
      if (line.fixedAmount == null) {
        throw new ValidationError('FIXED lines require fixedAmount')
      }
    } else if (line.calculationType === 'PERCENTAGE') {
      if (line.percentage == null) {
        throw new ValidationError('PERCENTAGE lines require percentage')
      }
      if (!line.percentageOfComponentId) {
        throw new ValidationError('PERCENTAGE lines require percentageOfComponentId')
      }
      if (line.percentageOfComponentId === line.salaryComponentId) {
        throw new ValidationError('PERCENTAGE cannot reference the same component')
      }
    }
  }

  const sorted = [...lines].sort((a, b) => (a.sequence ?? 10) - (b.sequence ?? 10))
  const resolved = new Set<string>()
  for (const line of sorted) {
    if (line.calculationType === 'PERCENTAGE' && line.percentageOfComponentId) {
      if (!componentIds.has(line.percentageOfComponentId)) {
        throw new ValidationError(
          `percentageOfComponentId must reference a component on this version`,
        )
      }
      if (!resolved.has(line.percentageOfComponentId)) {
        throw new ValidationError(
          `PERCENTAGE line for ${line.salaryComponentId} must come after its base component in sequence order`,
        )
      }
    }
    resolved.add(line.salaryComponentId)
  }
}

async function assertStructureAccess(
  tenantId: string,
  structureId: string,
  scope: UserDataScope,
) {
  const structure = await prisma.hrSalaryStructure.findFirst({
    where: { id: structureId, tenantId, deletedAt: null, ...hrLegalEntityScopeWhere(scope) },
  })
  if (!structure) throw new NotFoundError('Salary structure not found')
  if (structure.legalEntityId) {
    assertHrAccess(scope, { legalEntityId: structure.legalEntityId })
  }
  return structure
}

export async function listStructures(tenantId: string, scope: UserDataScope, query: ListStructuresQuery) {
  const { page, limit, skip } = getPagination(query)
  const where = structureWhere(tenantId, scope, query)
  const [total, rows] = await Promise.all([
    prisma.hrSalaryStructure.count({ where }),
    prisma.hrSalaryStructure.findMany({
      where,
      orderBy: { code: 'asc' },
      skip,
      take: limit,
      include: {
        versions: {
          where: { deletedAt: null, status: 'ACTIVE' },
          orderBy: { versionNo: 'desc' },
          take: 1,
        },
      },
    }),
  ])
  return {
    items: rows.map((row) => ({
      ...mapStructureSummary(row),
      activeVersion: row.versions[0] ? mapVersionSummary(row.versions[0]) : null,
    })),
    total,
    page,
    limit,
  }
}

export async function getStructure(tenantId: string, structureId: string, scope: UserDataScope) {
  const structure = await assertStructureAccess(tenantId, structureId, scope)
  const versions = await prisma.hrSalaryStructureVersion.findMany({
    where: { tenantId, salaryStructureId: structureId, deletedAt: null },
    orderBy: { versionNo: 'desc' },
  })
  const activeVersion = versions.find((v) => v.status === 'ACTIVE') ?? null
  return {
    ...mapStructureSummary(structure),
    versions: versions.map(mapVersionSummary),
    activeVersion: activeVersion ? mapVersionSummary(activeVersion) : null,
  }
}

export async function createStructure(
  tenantId: string,
  input: CreateStructureInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  if (input.legalEntityId) {
    assertHrAccess(scope, { legalEntityId: input.legalEntityId })
  }
  const code = input.code.trim().toUpperCase()
  const clash = await prisma.hrSalaryStructure.findFirst({ where: { tenantId, code, deletedAt: null } })
  if (clash) throw new ConflictError(`Salary structure ${code} already exists`)

  const row = await prisma.hrSalaryStructure.create({
    data: {
      tenantId,
      code,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      legalEntityId: input.legalEntityId ?? null,
      workerCategory: input.workerCategory ?? null,
      isActive: input.isActive ?? true,
      createdBy: audit?.userId,
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryStructure',
    entityId: row.id,
    action: 'CREATE',
    newValues: { code: row.code, name: row.name },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapStructureSummary(row)
}

export async function updateStructure(
  tenantId: string,
  structureId: string,
  input: UpdateStructureInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const existing = await assertStructureAccess(tenantId, structureId, scope)
  const nextLe = input.legalEntityId !== undefined ? input.legalEntityId : existing.legalEntityId
  if (nextLe) assertHrAccess(scope, { legalEntityId: nextLe })

  if (input.code) {
    const code = input.code.trim().toUpperCase()
    const clash = await prisma.hrSalaryStructure.findFirst({
      where: { tenantId, code, deletedAt: null, NOT: { id: structureId } },
    })
    if (clash) throw new ConflictError(`Salary structure ${code} already exists`)
  }

  const row = await prisma.hrSalaryStructure.update({
    where: { id: structureId },
    data: {
      ...(input.code ? { code: input.code.trim().toUpperCase() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() ?? null } : {}),
      ...(input.legalEntityId !== undefined ? { legalEntityId: input.legalEntityId } : {}),
      ...(input.workerCategory !== undefined ? { workerCategory: input.workerCategory } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryStructure',
    entityId: row.id,
    action: 'UPDATE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return mapStructureSummary(row)
}

export async function createVersion(
  tenantId: string,
  structureId: string,
  input: CreateVersionInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  await assertStructureAccess(tenantId, structureId, scope)
  const effectiveFrom = toDateOnly(input.effectiveFrom)
  const effectiveTo = input.effectiveTo ? toDateOnly(input.effectiveTo) : null
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new ValidationError('effectiveTo must be on or after effectiveFrom')
  }

  const maxVersion = await prisma.hrSalaryStructureVersion.aggregate({
    where: { tenantId, salaryStructureId: structureId, deletedAt: null },
    _max: { versionNo: true },
  })
  const versionNo = (maxVersion._max.versionNo ?? 0) + 1

  let copyLines: StructureLineInput[] = []
  if (input.copyFromVersionId) {
    const source = await prisma.hrSalaryStructureVersion.findFirst({
      where: {
        id: input.copyFromVersionId,
        tenantId,
        salaryStructureId: structureId,
        deletedAt: null,
      },
      include: {
        lines: { where: { deletedAt: null }, orderBy: { sequence: 'asc' } },
      },
    })
    if (!source) throw new NotFoundError('Source version not found for copy')
    copyLines = source.lines.map((l) => ({
      salaryComponentId: l.salaryComponentId,
      sequence: l.sequence,
      calculationType: l.calculationType,
      fixedAmount: decSalaryAmount(l.fixedAmount),
      percentage: decSalaryAmount(l.percentage),
      percentageOfComponentId: l.percentageOfComponentId,
      monthlyCap: decSalaryAmount(l.monthlyCap),
      annualCap: decSalaryAmount(l.annualCap),
      isActive: l.isActive,
    }))
  }

  const version = await prisma.$transaction(async (tx) => {
    const row = await tx.hrSalaryStructureVersion.create({
      data: {
        tenantId,
        salaryStructureId: structureId,
        versionNo,
        effectiveFrom,
        effectiveTo,
        status: 'DRAFT',
        createdBy: audit?.userId,
        updatedBy: audit?.userId,
      },
    })

    if (copyLines.length > 0) {
      validateStructureLines(copyLines)
      await tx.hrSalaryStructureLine.createMany({
        data: copyLines.map((line) => ({
          tenantId,
          versionId: row.id,
          salaryComponentId: line.salaryComponentId,
          sequence: line.sequence ?? 10,
          calculationType: line.calculationType,
          fixedAmount: line.fixedAmount ?? null,
          percentage: line.percentage ?? null,
          percentageOfComponentId: line.percentageOfComponentId ?? null,
          monthlyCap: line.monthlyCap ?? null,
          annualCap: line.annualCap ?? null,
          isActive: line.isActive ?? true,
          createdBy: audit?.userId,
          updatedBy: audit?.userId,
        })),
      })
    }

    return row
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryStructureVersion',
    entityId: version.id,
    action: 'CREATE',
    newValues: { structureId, versionNo, effectiveFrom: input.effectiveFrom },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getVersion(tenantId, version.id, scope)
}

export async function getVersion(tenantId: string, versionId: string, scope: UserDataScope) {
  const version = await prisma.hrSalaryStructureVersion.findFirst({
    where: { id: versionId, tenantId, deletedAt: null },
    include: {
      structure: true,
      lines: {
        where: { deletedAt: null },
        orderBy: [{ sequence: 'asc' }, { salaryComponentId: 'asc' }],
        include: {
          salaryComponent: { select: { id: true, code: true, name: true, type: true, isActive: true } },
          percentageOfComponent: { select: { id: true, code: true, name: true } },
        },
      },
    },
  })
  if (!version) throw new NotFoundError('Salary structure version not found')
  await assertStructureAccess(tenantId, version.salaryStructureId, scope)

  return {
    ...mapVersionSummary(version),
    structure: mapStructureSummary(version.structure),
    lines: version.lines.map(mapLine),
  }
}

export async function updateVersion(
  tenantId: string,
  versionId: string,
  input: UpdateVersionInput,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const version = await prisma.hrSalaryStructureVersion.findFirst({
    where: { id: versionId, tenantId, deletedAt: null },
    include: { structure: true },
  })
  if (!version) throw new NotFoundError('Salary structure version not found')
  await assertStructureAccess(tenantId, version.salaryStructureId, scope)

  if (version.status !== 'DRAFT') {
    throw new ValidationError('Only DRAFT versions can be edited')
  }

  const effectiveFrom =
    input.effectiveFrom !== undefined ? toDateOnly(input.effectiveFrom) : version.effectiveFrom
  const effectiveTo =
    input.effectiveTo !== undefined
      ? input.effectiveTo
        ? toDateOnly(input.effectiveTo)
        : null
      : version.effectiveTo
  if (effectiveTo && effectiveTo.getTime() < effectiveFrom.getTime()) {
    throw new ValidationError('effectiveTo must be on or after effectiveFrom')
  }

  if (input.lines) {
    validateStructureLines(input.lines)
  }

  await prisma.$transaction(async (tx) => {
    await tx.hrSalaryStructureVersion.update({
      where: { id: versionId },
      data: {
        ...(input.effectiveFrom !== undefined ? { effectiveFrom } : {}),
        ...(input.effectiveTo !== undefined ? { effectiveTo } : {}),
        updatedBy: audit?.userId,
      },
    })

    if (input.lines) {
      await tx.hrSalaryStructureLine.deleteMany({ where: { versionId } })
      if (input.lines.length > 0) {
        await tx.hrSalaryStructureLine.createMany({
          data: input.lines.map((line) => ({
            tenantId,
            versionId,
            salaryComponentId: line.salaryComponentId,
            sequence: line.sequence ?? 10,
            calculationType: line.calculationType,
            fixedAmount: line.fixedAmount ?? null,
            percentage: line.percentage ?? null,
            percentageOfComponentId: line.percentageOfComponentId ?? null,
            monthlyCap: line.monthlyCap ?? null,
            annualCap: line.annualCap ?? null,
            isActive: line.isActive ?? true,
            createdBy: audit?.userId,
            updatedBy: audit?.userId,
          })),
        })
      }
    }
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrSalaryStructureVersion',
    entityId: versionId,
    action: 'UPDATE',
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getVersion(tenantId, versionId, scope)
}

export async function activateVersion(
  tenantId: string,
  versionId: string,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const version = await prisma.hrSalaryStructureVersion.findFirst({
    where: { id: versionId, tenantId, deletedAt: null },
    include: {
      structure: true,
      lines: {
        where: { deletedAt: null, isActive: true },
        include: { salaryComponent: true },
      },
    },
  })
  if (!version) throw new NotFoundError('Salary structure version not found')
  await assertStructureAccess(tenantId, version.salaryStructureId, scope)

  if (version.status !== 'DRAFT') {
    throw new ValidationError('Only DRAFT versions can be activated')
  }
  if (version.lines.length === 0) {
    throw new ValidationError('At least one active line is required to activate')
  }

  for (const line of version.lines) {
    if (!line.salaryComponent.isActive) {
      throw new ValidationError(
        `Component ${line.salaryComponent.code} is inactive and cannot be in an active structure version`,
      )
    }
  }

  validateStructureLines(
    version.lines.map((l) => ({
      salaryComponentId: l.salaryComponentId,
      sequence: l.sequence,
      calculationType: l.calculationType,
      fixedAmount: decSalaryAmount(l.fixedAmount),
      percentage: decSalaryAmount(l.percentage),
      percentageOfComponentId: l.percentageOfComponentId,
      monthlyCap: decSalaryAmount(l.monthlyCap),
      annualCap: decSalaryAmount(l.annualCap),
      isActive: l.isActive,
    })),
  )

  const overlappingActive = await prisma.hrSalaryStructureVersion.findMany({
    where: {
      tenantId,
      salaryStructureId: version.salaryStructureId,
      status: 'ACTIVE',
      deletedAt: null,
      NOT: { id: versionId },
    },
  })

  const closeBefore = dayBefore(version.effectiveFrom)

  await prisma.$transaction(async (tx) => {
    for (const other of overlappingActive) {
      if (datesOverlap(version.effectiveFrom, version.effectiveTo, other.effectiveFrom, other.effectiveTo)) {
        await tx.hrSalaryStructureVersion.update({
          where: { id: other.id },
          data: {
            status: 'SUPERSEDED',
            effectiveTo: closeBefore,
            updatedBy: audit?.userId,
          },
        })
      }
    }

    await tx.hrSalaryStructureVersion.update({
      where: { id: versionId },
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
    entity: 'HrSalaryStructureVersion',
    entityId: versionId,
    action: 'ACTIVATE',
    newValues: { status: 'ACTIVE', effectiveFrom: formatDateOnly(version.effectiveFrom) },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getVersion(tenantId, versionId, scope)
}
