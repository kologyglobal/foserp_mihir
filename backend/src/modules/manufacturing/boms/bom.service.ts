import type { Request } from 'express'
import type { ManufacturingBomLine, ManufacturingBomVersion } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { tenantActiveFilter } from '../../../shared/index.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import * as repo from './bom.repository.js'
import type {
  CreateBomInput,
  CreateBomLineInput,
  CreateBomVersionInput,
  ListBomVersionsQuery,
  ListBomsQuery,
  UpdateBomLineInput,
  UpdateBomVersionInput,
} from './bom.schemas.js'

async function audit(
  req: Request,
  tenantId: string,
  entity: string,
  entityId: string,
  action: string,
  oldValues: unknown,
  newValues: unknown,
) {
  const meta = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: meta.userId,
    module: 'manufacturing',
    entity,
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  })
}

export async function listBoms(tenantId: string, query: ListBomsQuery) {
  return repo.listBoms(tenantId, query)
}

export async function getBom(tenantId: string, bomId: string) {
  const bom = await repo.getBom(tenantId, bomId)
  const versions = await prisma.manufacturingBomVersion.findMany({
    where: { bomId, ...tenantActiveFilter(tenantId) },
    orderBy: { versionNumber: 'desc' },
  })
  return { bom, versions }
}

export async function createBom(req: Request, tenantId: string, input: CreateBomInput) {
  const userId = req.context?.userId ?? ''
  const record = await repo.createBom(tenantId, userId, input)
  await audit(req, tenantId, 'manufacturingBom', record.id, 'CREATE', undefined, record)
  return record
}

export async function listBomVersions(tenantId: string, bomId: string, query: ListBomVersionsQuery) {
  return repo.listBomVersions(tenantId, bomId, query)
}

export async function createBomVersion(
  req: Request,
  tenantId: string,
  bomId: string,
  input: CreateBomVersionInput,
) {
  const userId = req.context?.userId ?? ''
  const record = await repo.createBomVersion(tenantId, userId, bomId, input)
  await audit(req, tenantId, 'manufacturingBomVersion', record.id, 'CREATE', undefined, record)
  return record
}

export async function getBomVersion(tenantId: string, versionId: string) {
  return repo.getBomVersionWithLines(tenantId, versionId)
}

export async function updateBomVersionMeta(
  req: Request,
  tenantId: string,
  versionId: string,
  input: UpdateBomVersionInput,
) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getBomVersion(tenantId, versionId)
  const record = await repo.updateBomVersionMeta(tenantId, versionId, userId, input)
  await audit(req, tenantId, 'manufacturingBomVersion', versionId, 'UPDATE', before, record)
  return record
}

export async function getBomVersionTree(tenantId: string, versionId: string) {
  const version = await repo.getBomVersion(tenantId, versionId)
  const lines = await repo.listBomLines(tenantId, versionId)
  return { version, tree: repo.buildBomTree(lines) }
}

export async function createBomLine(req: Request, tenantId: string, versionId: string, input: CreateBomLineInput) {
  const userId = req.context?.userId ?? ''
  const record = await repo.createBomLine(tenantId, userId, versionId, input)
  await audit(req, tenantId, 'manufacturingBomLine', record.id, 'CREATE', undefined, record)
  return record
}

export async function updateBomLine(req: Request, tenantId: string, lineId: string, input: UpdateBomLineInput) {
  const userId = req.context?.userId ?? ''
  const before = await repo.getBomLine(tenantId, lineId)
  const record = await repo.updateBomLine(tenantId, userId, lineId, input)
  await audit(req, tenantId, 'manufacturingBomLine', lineId, 'UPDATE', before, record)
  return record
}

export async function deleteBomLine(req: Request, tenantId: string, lineId: string) {
  const before = await repo.getBomLine(tenantId, lineId)
  const record = await repo.deleteBomLine(tenantId, lineId)
  await audit(req, tenantId, 'manufacturingBomLine', lineId, 'DELETE', before, record)
  return record
}

export interface BomValidationResult {
  valid: boolean
  errors: string[]
  lineCount: number
}

export async function validateBomVersion(tenantId: string, versionId: string): Promise<BomValidationResult> {
  const { version, lines } = await repo.getBomVersionWithLines(tenantId, versionId)
  const errors: string[] = []

  if (lines.length === 0) {
    errors.push('BOM version must have at least one line')
  }

  const seenSequences = new Set<string>()
  const idsInVersion = new Set(lines.map((l) => l.id))
  for (const line of lines) {
    const sequenceKey = `${line.parentLineId ?? '__root'}:${line.sequence}`
    if (seenSequences.has(sequenceKey)) {
      errors.push(`Duplicate sequence ${line.sequence} under the same BOM parent`)
    }
    seenSequences.add(sequenceKey)

    if (line.parentLineId && !idsInVersion.has(line.parentLineId)) {
      errors.push(`Line ${line.sequence}: parent line not found in this version`)
    }
    if (Number(line.quantity) <= 0) {
      errors.push(`Line ${line.sequence}: quantity must be greater than zero`)
    }
    if (Number(line.scrapPercent) < 0 || Number(line.scrapPercent) > 100) {
      errors.push(`Line ${line.sequence}: scrapPercent must be between 0 and 100`)
    }
    if (Number(line.yieldPercent) < 0 || Number(line.yieldPercent) > 100) {
      errors.push(`Line ${line.sequence}: yieldPercent must be between 0 and 100`)
    }
  }

  // Cycle scan across the full parentLineId graph (defense in depth).
  const nodesById = new Map(lines.map((l) => [l.id, { id: l.id, parentLineId: l.parentLineId }]))
  for (const line of lines) {
    let cursor = line.parentLineId
    const seen = new Set<string>([line.id])
    while (cursor) {
      if (seen.has(cursor)) {
        errors.push(`Line ${line.sequence}: circular parentLineId reference detected`)
        break
      }
      seen.add(cursor)
      cursor = nodesById.get(cursor)?.parentLineId ?? null
    }
  }

  if (version.status !== 'DRAFT') {
    errors.push('Only DRAFT versions can be validated for activation')
  }

  return { valid: errors.length === 0, errors, lineCount: lines.length }
}

export async function activateBomVersion(req: Request, tenantId: string, versionId: string) {
  const { version } = await repo.getBomVersionWithLines(tenantId, versionId)
  if (version.status !== 'DRAFT') {
    throw new InvalidStateError('Only DRAFT BOM versions can be activated')
  }
  const result = await validateBomVersion(tenantId, versionId)
  if (!result.valid) {
    throw new ValidationError(
      'BOM version failed validation',
      result.errors.map((message) => ({ field: 'lines', message })),
    )
  }

  const userId = req.context?.userId ?? ''
  const now = new Date()

  const updated = await prisma.$transaction(async (tx) => {
    await tx.manufacturingBomVersion.updateMany({
      where: { tenantId, bomId: version.bomId, status: 'ACTIVE', id: { not: versionId } },
      data: { status: 'SUPERSEDED', updatedBy: userId },
    })
    return tx.manufacturingBomVersion.update({
      where: { id: versionId, tenantId },
      data: { status: 'ACTIVE', activatedBy: userId, activatedAt: now, updatedBy: userId },
    })
  })

  await audit(req, tenantId, 'manufacturingBomVersion', versionId, 'ACTIVATE', version, updated)
  return updated
}

export async function reviseBomVersion(req: Request, tenantId: string, versionId: string) {
  const { version: source, lines } = await repo.getBomVersionWithLines(tenantId, versionId)
  const userId = req.context?.userId ?? ''

  const maxVersion = await prisma.manufacturingBomVersion.aggregate({
    where: { tenantId, bomId: source.bomId },
    _max: { versionNumber: true },
  })
  const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1

  const created = await prisma.$transaction(async (tx) => {
    const newVersion = await tx.manufacturingBomVersion.create({
      data: {
        tenantId,
        bomId: source.bomId,
        versionNumber,
        revisionCode: `${source.revisionCode}-REV${versionNumber}`,
        status: 'DRAFT',
        effectiveFrom: new Date(),
        effectiveTo: null,
        baseQuantity: source.baseQuantity,
        baseUomId: source.baseUomId,
        expectedYieldPercent: source.expectedYieldPercent,
        drawingRevision: source.drawingRevision,
        revisionNotes: `Revised from version ${source.versionNumber}`,
        createdBy: userId,
        updatedBy: userId,
      },
    })

    const idRemap = new Map<string, string>()
    const sortedLines = [...lines].sort((a, b) => a.level - b.level || a.sequence - b.sequence)
    for (const line of sortedLines) {
      const newLine = await tx.manufacturingBomLine.create({
        data: {
          tenantId,
          bomVersionId: newVersion.id,
          parentLineId: line.parentLineId ? idRemap.get(line.parentLineId) ?? null : null,
          sequence: line.sequence,
          level: line.level,
          itemId: line.itemId,
          descriptionOverride: line.descriptionOverride,
          quantity: line.quantity,
          uomId: line.uomId,
          quantityBasis: line.quantityBasis,
          fixedQuantity: line.fixedQuantity,
          scrapPercent: line.scrapPercent,
          yieldPercent: line.yieldPercent,
          makeOrBuy: line.makeOrBuy,
          lineType: line.lineType,
          issueStageGroupId: line.issueStageGroupId,
          issueOperationId: line.issueOperationId,
          consumptionMethod: line.consumptionMethod,
          isOptional: line.isOptional,
          substituteAllowed: line.substituteAllowed,
          qualityRequired: line.qualityRequired,
          certificateRequired: line.certificateRequired,
          childProductionOrderRequired: line.childProductionOrderRequired,
          stockedSemiFinished: line.stockedSemiFinished,
          phantomAssembly: line.phantomAssembly,
          drawingReference: line.drawingReference,
          specification: line.specification,
          notes: line.notes,
          createdBy: userId,
          updatedBy: userId,
        },
      })
      idRemap.set(line.id, newLine.id)
    }

    return newVersion
  })

  await audit(req, tenantId, 'manufacturingBomVersion', created.id, 'REVISE', source, created)
  return created
}

interface BomLineDiffEntry {
  itemId: string
  from: { quantity: string; uomId: string; sequence: number } | null
  to: { quantity: string; uomId: string; sequence: number } | null
  changed: boolean
  summary: string
}

export async function compareBomVersions(tenantId: string, fromVersionId: string, toVersionId: string) {
  const [{ version: fromVersion, lines: fromLines }, { version: toVersion, lines: toLines }] = await Promise.all([
    repo.getBomVersionWithLines(tenantId, fromVersionId),
    repo.getBomVersionWithLines(tenantId, toVersionId),
  ])

  const itemIds = [...new Set([...fromLines, ...toLines].map((l) => l.itemId))]
  const uomIds = [...new Set([...fromLines, ...toLines].map((l) => l.uomId))]
  const [items, uoms] = await Promise.all([
    itemIds.length
      ? prisma.masterItem.findMany({
          where: { tenantId, id: { in: itemIds }, deletedAt: null },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    uomIds.length
      ? prisma.masterUom.findMany({
          where: { tenantId, id: { in: uomIds }, deletedAt: null },
          select: { id: true, code: true },
        })
      : Promise.resolve([]),
  ])
  const itemName = (id: string) => {
    const row = items.find((i) => i.id === id)
    return row ? `${row.code} (${row.name})` : id.slice(0, 8)
  }
  const uomCode = (id: string) => uoms.find((u) => u.id === id)?.code ?? 'UOM'

  const byItem = (lines: ManufacturingBomLine[]) => {
    const map = new Map<string, ManufacturingBomLine[]>()
    for (const line of lines) {
      const list = map.get(line.itemId) ?? []
      list.push(line)
      map.set(line.itemId, list)
    }
    return map
  }

  const fromMap = byItem(fromLines)
  const toMap = byItem(toLines)
  const allItemIds = new Set([...fromMap.keys(), ...toMap.keys()])

  const diff: BomLineDiffEntry[] = []
  for (const itemId of allItemIds) {
    const fromEntries = fromMap.get(itemId) ?? []
    const toEntries = toMap.get(itemId) ?? []
    const max = Math.max(fromEntries.length, toEntries.length)
    for (let i = 0; i < max; i += 1) {
      const f = fromEntries[i]
      const t = toEntries[i]
      const fromSnap = f ? { quantity: f.quantity.toString(), uomId: f.uomId, sequence: f.sequence } : null
      const toSnap = t ? { quantity: t.quantity.toString(), uomId: t.uomId, sequence: t.sequence } : null
      const changed = JSON.stringify(fromSnap) !== JSON.stringify(toSnap)
      let summary: string
      if (!fromSnap && toSnap) {
        summary = `Added ${itemName(itemId)} — quantity ${toSnap.quantity} ${uomCode(toSnap.uomId)}.`
      } else if (fromSnap && !toSnap) {
        summary = `Removed ${itemName(itemId)} — was ${fromSnap.quantity} ${uomCode(fromSnap.uomId)}.`
      } else if (fromSnap && toSnap && changed) {
        const parts: string[] = []
        if (fromSnap.quantity !== toSnap.quantity || fromSnap.uomId !== toSnap.uomId) {
          parts.push(
            `quantity changed from ${fromSnap.quantity} ${uomCode(fromSnap.uomId)} to ${toSnap.quantity} ${uomCode(toSnap.uomId)}`,
          )
        }
        if (fromSnap.sequence !== toSnap.sequence) {
          parts.push(`sequence changed from ${fromSnap.sequence} to ${toSnap.sequence}`)
        }
        summary = `${itemName(itemId)} ${parts.join('; ') || 'updated'}.`
      } else {
        summary = `${itemName(itemId)} unchanged.`
      }
      diff.push({ itemId, from: fromSnap, to: toSnap, changed, summary })
    }
  }

  const added = diff.filter((d) => d.from === null)
  const removed = diff.filter((d) => d.to === null)
  const changed = diff.filter((d) => d.from !== null && d.to !== null && d.changed)

  return {
    from: { id: fromVersion.id, versionNumber: fromVersion.versionNumber, status: fromVersion.status },
    to: { id: toVersion.id, versionNumber: toVersion.versionNumber, status: toVersion.status },
    added,
    removed,
    changed,
    unchanged: diff.filter((d) => d.from !== null && d.to !== null && !d.changed).length,
    summaries: [...added, ...removed, ...changed].map((d) => d.summary),
  }
}

export type { ManufacturingBomVersion }
