import { Prisma } from '@prisma/client'
import type { ManufacturingBomLine } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { assertItem, assertNoTreeCycle, assertUom } from '../shared/manufacturing.helpers.js'
import type {
  CreateBomInput,
  CreateBomLineInput,
  CreateBomVersionInput,
  ListBomVersionsQuery,
  ListBomsQuery,
  UpdateBomLineInput,
  UpdateBomVersionInput,
} from './bom.schemas.js'

/** Item/UOM snapshots so list/tree UIs never fall back to raw UUIDs. */
const bomLineMasterInclude = {
  item: { select: { id: true, code: true, name: true } },
  uom: { select: { id: true, code: true, name: true } },
} as const

function buildBomWhere(tenantId: string, query: ListBomsQuery) {
  const where: Prisma.ManufacturingBomWhereInput = {
    ...tenantActiveFilter(tenantId),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.productItemId ? { productItemId: query.productItemId } : {}),
  }
  if (query.search) {
    where.OR = [{ code: { contains: query.search } }, { name: { contains: query.search } }]
  }
  return where
}

export async function listBoms(tenantId: string, query: ListBomsQuery) {
  const { skip, take } = getPagination(query)
  const where = buildBomWhere(tenantId, query)
  const sortField = query.sortBy === 'code' || query.sortBy === 'name' ? query.sortBy : 'createdAt'
  const [items, total] = await Promise.all([
    prisma.manufacturingBom.findMany({
      where,
      skip,
      take,
      orderBy: { [sortField]: query.sortOrder },
      include: {
        productItem: { select: { id: true, code: true, name: true } },
        // Lightweight revision summary so list pages can show revision/status
        // chips and component counts without N+1 detail calls.
        versions: {
          where: { deletedAt: null },
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            revisionCode: true,
            status: true,
            effectiveFrom: true,
            _count: { select: { lines: { where: { deletedAt: null } } } },
          },
        },
      },
    }),
    prisma.manufacturingBom.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getBom(tenantId: string, bomId: string) {
  const bom = await prisma.manufacturingBom.findFirst({
    where: { id: bomId, ...tenantActiveFilter(tenantId) },
    include: {
      productItem: { select: { id: true, code: true, name: true } },
    },
  })
  if (!bom) throw new NotFoundError('BOM not found')
  return bom
}

export async function createBom(tenantId: string, userId: string, input: CreateBomInput) {
  await assertItem(tenantId, input.productItemId)
  try {
    return await prisma.manufacturingBom.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        productItemId: input.productItemId,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate BOM code in tenant')
    }
    throw err
  }
}

export async function updateBom(
  tenantId: string,
  userId: string,
  bomId: string,
  input: { name?: string; description?: string | null; isActive?: boolean },
) {
  await getBom(tenantId, bomId)
  return prisma.manufacturingBom.update({
    where: { id: bomId, tenantId },
    data: { ...input, updatedBy: userId },
    include: {
      productItem: { select: { id: true, code: true, name: true } },
    },
  })
}

export async function softDeleteBom(tenantId: string, userId: string, bomId: string) {
  await getBom(tenantId, bomId)
  return prisma.manufacturingBom.update({
    where: { id: bomId, tenantId },
    data: { deletedAt: new Date(), isActive: false, updatedBy: userId },
  })
}

export async function setBomActive(tenantId: string, userId: string, bomId: string, isActive: boolean) {
  await getBom(tenantId, bomId)
  return prisma.manufacturingBom.update({
    where: { id: bomId, tenantId },
    data: { isActive, updatedBy: userId },
    include: {
      productItem: { select: { id: true, code: true, name: true } },
    },
  })
}

// ─── BOM versions ──────────────────────────────────────────────────────────

export async function listBomVersions(tenantId: string, bomId: string, query: ListBomVersionsQuery) {
  await getBom(tenantId, bomId)
  const { skip, take } = getPagination(query)
  const where: Prisma.ManufacturingBomVersionWhereInput = {
    ...tenantActiveFilter(tenantId),
    bomId,
    ...(query.status ? { status: query.status } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.manufacturingBomVersion.findMany({ where, skip, take, orderBy: { versionNumber: 'desc' } }),
    prisma.manufacturingBomVersion.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function getBomVersion(tenantId: string, versionId: string) {
  const version = await prisma.manufacturingBomVersion.findFirst({
    where: { id: versionId, ...tenantActiveFilter(tenantId) },
    include: { bom: true },
  })
  if (!version) throw new NotFoundError('BOM version not found')
  return version
}

export async function getBomVersionWithLines(tenantId: string, versionId: string) {
  const version = await getBomVersion(tenantId, versionId)
  const lines = await prisma.manufacturingBomLine.findMany({
    where: { bomVersionId: versionId, ...tenantActiveFilter(tenantId) },
    orderBy: { sequence: 'asc' },
    include: bomLineMasterInclude,
  })
  return { version, lines }
}

export async function createBomVersion(
  tenantId: string,
  userId: string,
  bomId: string,
  input: CreateBomVersionInput,
) {
  await getBom(tenantId, bomId)
  await assertUom(tenantId, input.baseUomId)
  const maxVersion = await prisma.manufacturingBomVersion.aggregate({
    where: { tenantId, bomId },
    _max: { versionNumber: true },
  })
  const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1
  try {
    return await prisma.manufacturingBomVersion.create({
      data: {
        tenantId,
        bomId,
        versionNumber,
        revisionCode: input.revisionCode,
        status: 'DRAFT',
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        baseQuantity: input.baseQuantity,
        baseUomId: input.baseUomId,
        expectedYieldPercent: input.expectedYieldPercent,
        drawingRevision: input.drawingRevision ?? null,
        revisionNotes: input.revisionNotes ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Duplicate BOM version number')
    }
    throw err
  }
}

function assertDraft(version: { status: string }): void {
  if (version.status !== 'DRAFT') {
    throw new InvalidStateError('BOM version must be in DRAFT status for this operation')
  }
}

export async function updateBomVersionMeta(
  tenantId: string,
  versionId: string,
  userId: string,
  input: UpdateBomVersionInput,
) {
  const version = await getBomVersion(tenantId, versionId)
  assertDraft(version)
  if (input.baseUomId) await assertUom(tenantId, input.baseUomId)
  return prisma.manufacturingBomVersion.update({
    where: { id: versionId, tenantId },
    data: { ...input, updatedBy: userId },
  })
}

// ─── BOM lines ─────────────────────────────────────────────────────────────

export async function listBomLines(tenantId: string, bomVersionId: string) {
  return prisma.manufacturingBomLine.findMany({
    where: { bomVersionId, ...tenantActiveFilter(tenantId) },
    orderBy: { sequence: 'asc' },
    include: bomLineMasterInclude,
  })
}

export async function getBomLine(tenantId: string, lineId: string) {
  const line = await prisma.manufacturingBomLine.findFirst({
    where: { id: lineId, ...tenantActiveFilter(tenantId) },
    include: bomLineMasterInclude,
  })
  if (!line) throw new NotFoundError('BOM line not found')
  return line
}

export async function createBomLine(
  tenantId: string,
  userId: string,
  bomVersionId: string,
  input: CreateBomLineInput,
) {
  const version = await getBomVersion(tenantId, bomVersionId)
  assertDraft(version)
  await assertItem(tenantId, input.itemId)
  await assertUom(tenantId, input.uomId)

  const existingLines = await listBomLines(tenantId, bomVersionId)
  let level = 1
  if (input.parentLineId) {
    const parent = existingLines.find((l) => l.id === input.parentLineId)
    if (!parent) throw new ValidationError('Parent BOM line not found in this version')
    level = parent.level + 1
  }

  const sequence =
    input.sequence ?? (existingLines.length > 0 ? Math.max(...existingLines.map((l) => l.sequence)) + 10 : 10)

  return prisma.manufacturingBomLine.create({
    data: {
      tenantId,
      bomVersionId,
      parentLineId: input.parentLineId ?? null,
      sequence,
      level,
      itemId: input.itemId,
      descriptionOverride: input.descriptionOverride ?? null,
      quantity: input.quantity,
      uomId: input.uomId,
      quantityBasis: input.quantityBasis,
      fixedQuantity: input.fixedQuantity ?? null,
      scrapPercent: input.scrapPercent,
      yieldPercent: input.yieldPercent,
      makeOrBuy: input.makeOrBuy,
      lineType: input.lineType,
      issueStageGroupId: input.issueStageGroupId ?? null,
      issueOperationId: input.issueOperationId ?? null,
      consumptionMethod: input.consumptionMethod ?? null,
      isOptional: input.isOptional,
      substituteAllowed: input.substituteAllowed,
      qualityRequired: input.qualityRequired,
      certificateRequired: input.certificateRequired,
      childProductionOrderRequired: input.childProductionOrderRequired,
      stockedSemiFinished: input.stockedSemiFinished,
      phantomAssembly: input.phantomAssembly,
      drawingReference: input.drawingReference ?? null,
      specification: input.specification ?? null,
      notes: input.notes ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
    include: bomLineMasterInclude,
  })
}

export async function updateBomLine(tenantId: string, userId: string, lineId: string, input: UpdateBomLineInput) {
  const line = await getBomLine(tenantId, lineId)
  const version = await getBomVersion(tenantId, line.bomVersionId)
  assertDraft(version)

  if (input.itemId) await assertItem(tenantId, input.itemId)
  if (input.uomId) await assertUom(tenantId, input.uomId)

  const data: Record<string, unknown> = { ...input, updatedBy: userId }

  if (input.parentLineId !== undefined) {
    const siblings = await listBomLines(tenantId, line.bomVersionId)
    const nodesById = new Map(siblings.map((l) => [l.id, { id: l.id, parentLineId: l.parentLineId }]))
    assertNoTreeCycle(lineId, input.parentLineId ?? null, nodesById)
    if (input.parentLineId) {
      const parent = siblings.find((l) => l.id === input.parentLineId)
      if (!parent) throw new ValidationError('Parent BOM line not found in this version')
      data.level = parent.level + 1
    } else {
      data.level = 1
    }
  }

  return prisma.manufacturingBomLine.update({
    where: { id: lineId, tenantId },
    data,
    include: bomLineMasterInclude,
  })
}

export async function deleteBomLine(tenantId: string, lineId: string) {
  const line = await getBomLine(tenantId, lineId)
  const version = await getBomVersion(tenantId, line.bomVersionId)
  assertDraft(version)

  const childCount = await prisma.manufacturingBomLine.count({
    where: { parentLineId: lineId, ...tenantActiveFilter(tenantId) },
  })
  if (childCount > 0) {
    throw new InvalidStateError('Cannot delete a BOM line that has child lines — delete children first')
  }

  return prisma.manufacturingBomLine.update({
    where: { id: lineId, tenantId },
    data: { deletedAt: new Date() },
  })
}

export function buildBomTree(lines: Array<ManufacturingBomLine & Record<string, unknown>>) {
  const byId = new Map(lines.map((line) => [line.id, { ...line, children: [] as unknown[] }]))
  const roots: unknown[] = []
  for (const line of byId.values()) {
    if (line.parentLineId && byId.has(line.parentLineId)) {
      ;(byId.get(line.parentLineId) as { children: unknown[] }).children.push(line)
    } else {
      roots.push(line)
    }
  }
  return roots
}

export async function findLatestActiveBomVersion(tenantId: string, bomId: string) {
  return prisma.manufacturingBomVersion.findFirst({
    where: { tenantId, bomId, status: 'ACTIVE', deletedAt: null },
    orderBy: { versionNumber: 'desc' },
  })
}
