import type { Request } from 'express'
import { createHash } from 'node:crypto'
import {
  ManufacturingBomLineType,
  ManufacturingConsumptionMethod,
  ManufacturingMakeOrBuy,
  ManufacturingQuantityBasis,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { auditFromRequest } from '../../../services/audit.service.js'
import { ConflictError, ValidationError } from '../../../utils/errors.js'
import type { ConfirmBomImportInput, PreviewBomImportInput } from './bom.schemas.js'

export const BOM_IMPORT_HEADERS = [
  'bom_code',
  'bom_name',
  'output_item_code',
  'output_quantity',
  'output_uom_code',
  'line_ref',
  'parent_line_ref',
  'component_item_code',
  'component_quantity',
  'component_uom_code',
  'sequence',
  'revision_note',
  'effective_from',
  'effective_to',
  'scrap_percentage',
  'yield_percentage',
  'source_warehouse_code',
  'operation_code',
  'make_buy',
  'line_type',
  'quantity_basis',
  'consumption_method',
  'is_optional',
  'substitute_allowed',
  'quality_required',
  'certificate_required',
  'child_production_order_required',
  'stocked_semi_finished',
  'phantom_assembly',
  'remarks',
] as const

const REQUIRED_HEADERS = [
  'bom_code',
  'output_item_code',
  'output_quantity',
  'output_uom_code',
  'line_ref',
  'component_item_code',
  'component_quantity',
  'component_uom_code',
  'sequence',
] as const

export function bomImportTemplateCsv(): string {
  const rows = [
    [
      'BOM-PUMP-001', 'Pump Assembly', 'PUMP-001', '1', 'NOS', 'L10', '', 'PUMP-BODY', '1', 'NOS',
      '10', 'Initial import', '', '', '0', '100', 'RM-WH', 'CUTTING', 'MAKE', 'SUBASSEMBLY',
      'PER_UNIT', 'ACTUAL', 'false', 'false', 'true', 'false', 'false', 'true', 'false', 'Main body',
    ],
    [
      'BOM-PUMP-001', 'Pump Assembly', 'PUMP-001', '1', 'NOS', 'L20', '', 'MOTOR-001', '1', 'NOS',
      '20', 'Initial import', '', '', '0', '100', 'RM-WH', 'ASSEMBLY', 'BUY', 'BOUGHT_OUT',
      'PER_UNIT', 'ACTUAL', 'false', 'false', 'true', 'false', 'false', 'false', 'false', 'Motor',
    ],
    [
      'BOM-PUMP-001', 'Pump Assembly', 'PUMP-001', '1', 'NOS', 'L11', 'L10', 'STEEL-PLATE', '5', 'KG',
      '10', 'Initial import', '', '', '2', '100', 'RM-WH', 'CUTTING', 'BUY', 'RAW_MATERIAL',
      'PER_UNIT', 'ACTUAL', 'false', 'false', 'false', 'false', 'false', 'false', 'false', 'Body raw material',
    ],
    [
      'BOM-PUMP-001', 'Pump Assembly', 'PUMP-001', '1', 'NOS', 'L12', 'L10', 'FASTENER-001', '8', 'NOS',
      '20', 'Initial import', '', '', '0', '100', 'RM-WH', 'ASSEMBLY', 'BUY', 'RAW_MATERIAL',
      'PER_UNIT', 'ACTUAL', 'false', 'true', 'false', 'false', 'false', 'false', 'false', 'Body fasteners',
    ],
  ]
  const escape = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  return [BOM_IMPORT_HEADERS, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
}

type ImportRow = Record<string, string>

interface RowIssue {
  row: number
  lineRef: string
  errors: string[]
  warnings: string[]
}

interface ResolvedLine {
  row: number
  lineRef: string
  parentLineRef: string | null
  sequence: number
  level: number
  itemId: string
  itemCode: string
  itemName: string
  quantity: number
  uomId: string
  uomCode: string
  scrapPercent: number
  yieldPercent: number
  makeOrBuy: ManufacturingMakeOrBuy
  lineType: ManufacturingBomLineType
  quantityBasis: ManufacturingQuantityBasis
  consumptionMethod: ManufacturingConsumptionMethod | null
  issueOperationId: string | null
  operationCode: string | null
  isOptional: boolean
  substituteAllowed: boolean
  qualityRequired: boolean
  certificateRequired: boolean
  childProductionOrderRequired: boolean
  stockedSemiFinished: boolean
  phantomAssembly: boolean
  notes: string | null
}

interface ResolvedGroup {
  bomCode: string
  bomName: string
  outputItemId: string
  outputItemCode: string
  outputItemName: string
  outputQuantity: number
  outputUomId: string
  outputUomCode: string
  revisionNote: string | null
  effectiveFrom: Date
  effectiveTo: Date | null
  existingBomId: string | null
  nextVersionNumber: number
  action: 'CREATE_BOM' | 'CREATE_REVISION'
  lines: ResolvedLine[]
  issues: RowIssue[]
  errors: string[]
  warnings: string[]
}

function hashGroup(group: ResolvedGroup): string {
  return createHash('sha256').update(JSON.stringify({
    bomCode: group.bomCode,
    bomName: group.bomName,
    outputItemId: group.outputItemId,
    outputQuantity: group.outputQuantity,
    outputUomId: group.outputUomId,
    revisionNote: group.revisionNote,
    effectiveFrom: group.effectiveFrom.toISOString(),
    effectiveTo: group.effectiveTo?.toISOString() ?? null,
    lines: group.lines.map((line) => ({
      lineRef: line.lineRef,
      parentLineRef: line.parentLineRef,
      sequence: line.sequence,
      itemId: line.itemId,
      quantity: line.quantity,
      uomId: line.uomId,
      scrapPercent: line.scrapPercent,
      yieldPercent: line.yieldPercent,
      makeOrBuy: line.makeOrBuy,
      lineType: line.lineType,
      quantityBasis: line.quantityBasis,
      consumptionMethod: line.consumptionMethod,
      issueOperationId: line.issueOperationId,
      isOptional: line.isOptional,
      substituteAllowed: line.substituteAllowed,
      qualityRequired: line.qualityRequired,
      certificateRequired: line.certificateRequired,
      childProductionOrderRequired: line.childProductionOrderRequired,
      stockedSemiFinished: line.stockedSemiFinished,
      phantomAssembly: line.phantomAssembly,
      notes: line.notes,
    })),
  })).digest('hex')
}

export interface BomImportPreview {
  ready: boolean
  bomCount: number
  lineCount: number
  errorCount: number
  warningCount: number
  groups: Array<{
    bomCode: string
    bomName: string
    outputItemCode: string
    outputItemName: string
    action: 'CREATE_BOM' | 'CREATE_REVISION'
    nextVersionNumber: number
    lineCount: number
    errors: string[]
    warnings: string[]
    rows: Array<{
      row: number
      lineRef: string
      parentLineRef: string | null
      itemCode: string
      itemName: string
      quantity: number
      uomCode: string
      sequence: number
      level: number
      errors: string[]
      warnings: string[]
    }>
  }>
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function normalizeRow(row: ImportRow): ImportRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? '').trim()]))
}

function parsePositive(value: string, label: string, errors: string[]): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) errors.push(`${label} must be greater than zero`)
  return parsed
}

function parsePercent(value: string, label: string, fallback: number, errors: string[]): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) errors.push(`${label} must be between 0 and 100`)
  return parsed
}

function parseBoolean(value: string, fallback = false): boolean {
  if (!value) return fallback
  return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase())
}

function parseEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
  label: string,
  errors: string[],
): T {
  if (!value) return fallback
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_') as T
  if (!allowed.includes(normalized)) {
    errors.push(`${label} must be one of: ${allowed.join(', ')}`)
    return fallback
  }
  return normalized
}

function parseDate(value: string, fallback: Date, label: string, errors: string[]): Date {
  if (!value) return fallback
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${label} must be YYYY-MM-DD`)
    return fallback
  }
  return parsed
}

function sameHeaderValue(rows: ImportRow[], key: string, errors: string[]): string {
  const values = [...new Set(rows.map((row) => row[key] ?? '').filter(Boolean))]
  if (values.length > 1) errors.push(`${key} must be consistent for every row in the BOM`)
  return values[0] ?? ''
}

function deriveLevels(rows: Array<{ lineRef: string; parentLineRef: string | null }>, issues: Map<string, RowIssue>): Map<string, number> {
  const parentByRef = new Map(rows.map((row) => [row.lineRef, row.parentLineRef]))
  const levels = new Map<string, number>()

  const visit = (lineRef: string, path: Set<string>): number => {
    const cached = levels.get(lineRef)
    if (cached) return cached
    if (path.has(lineRef)) {
      issues.get(lineRef)?.errors.push('Circular parent_line_ref detected')
      return 1
    }
    const parent = parentByRef.get(lineRef)
    if (!parent) {
      levels.set(lineRef, 1)
      return 1
    }
    if (!parentByRef.has(parent)) {
      issues.get(lineRef)?.errors.push(`Parent line_ref "${parent}" was not found in this BOM`)
      levels.set(lineRef, 1)
      return 1
    }
    const nextPath = new Set(path)
    nextPath.add(lineRef)
    const level = visit(parent, nextPath) + 1
    levels.set(lineRef, level)
    return level
  }

  for (const row of rows) visit(row.lineRef, new Set())
  return levels
}

async function resolveImport(tenantId: string, input: PreviewBomImportInput): Promise<ResolvedGroup[]> {
  const rows = input.rows.map(normalizeRow)
  const presentHeaders = new Set(Object.keys(rows[0] ?? {}))
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !presentHeaders.has(header))
  if (missingHeaders.length) throw new ValidationError(`Missing required CSV columns: ${missingHeaders.join(', ')}`)

  const grouped = new Map<string, Array<{ row: ImportRow; rowNo: number }>>()
  rows.forEach((row, index) => {
    const code = row.bom_code?.trim().toUpperCase()
    if (!code) throw new ValidationError(`Row ${index + 2}: bom_code is required`)
    const list = grouped.get(code) ?? []
    list.push({ row, rowNo: index + 2 })
    grouped.set(code, list)
  })

  if (input.restrictBomCode) {
    const expected = input.restrictBomCode.trim().toUpperCase()
    const unexpected = [...grouped.keys()].filter((code) => code !== expected)
    if (unexpected.length) throw new ValidationError(`This import is restricted to BOM ${expected}`)
  }

  const itemCodes = new Set<string>()
  const uomCodes = new Set<string>()
  const warehouseCodes = new Set<string>()
  const operationCodes = new Set<string>()
  for (const row of rows) {
    if (row.output_item_code) itemCodes.add(row.output_item_code.toUpperCase())
    if (row.component_item_code) itemCodes.add(row.component_item_code.toUpperCase())
    if (row.output_uom_code) uomCodes.add(row.output_uom_code.toUpperCase())
    if (row.component_uom_code) uomCodes.add(row.component_uom_code.toUpperCase())
    if (row.source_warehouse_code) warehouseCodes.add(row.source_warehouse_code.toUpperCase())
    if (row.operation_code) operationCodes.add(row.operation_code.toUpperCase())
  }

  const [items, uoms, warehouses, operations, existingBoms] = await Promise.all([
    prisma.masterItem.findMany({
      where: { tenantId, code: { in: [...itemCodes] }, status: 'ACTIVE', deletedAt: null },
      select: { id: true, code: true, name: true },
    }),
    prisma.masterUom.findMany({
      where: { tenantId, code: { in: [...uomCodes] }, status: 'ACTIVE', deletedAt: null },
      select: { id: true, code: true, name: true },
    }),
    prisma.masterWarehouse.findMany({
      where: { tenantId, code: { in: [...warehouseCodes] }, status: 'ACTIVE', deletedAt: null },
      select: { id: true, code: true },
    }),
    prisma.manufacturingRoutingOperation.findMany({
      where: {
        tenantId,
        code: { in: [...operationCodes] },
        isActive: true,
        deletedAt: null,
        routingVersion: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, code: true },
    }),
    prisma.manufacturingBom.findMany({
      where: { tenantId, code: { in: [...grouped.keys()] }, deletedAt: null },
      include: { versions: { where: { deletedAt: null }, select: { versionNumber: true } } },
    }),
  ])

  const itemByCode = new Map(items.map((item) => [item.code.toUpperCase(), item]))
  const uomByCode = new Map(uoms.map((uom) => [uom.code.toUpperCase(), uom]))
  const warehouseByCode = new Map(warehouses.map((warehouse) => [warehouse.code.toUpperCase(), warehouse]))
  const operationsByCode = new Map<string, typeof operations>()
  for (const operation of operations) {
    const list = operationsByCode.get(operation.code.toUpperCase()) ?? []
    list.push(operation)
    operationsByCode.set(operation.code.toUpperCase(), list)
  }
  const existingByCode = new Map(existingBoms.map((bom) => [bom.code.toUpperCase(), bom]))
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const result: ResolvedGroup[] = []
  for (const [bomCode, sourceRows] of grouped) {
    const normalizedRows = sourceRows.map(({ row }) => row)
    const groupErrors: string[] = []
    const groupWarnings: string[] = []
    const issueByRef = new Map<string, RowIssue>()
    const duplicateRefs = new Set<string>()
    const refs = new Set<string>()

    for (const { row, rowNo } of sourceRows) {
      const lineRef = row.line_ref
      const issue: RowIssue = { row: rowNo, lineRef, errors: [], warnings: [] }
      for (const header of REQUIRED_HEADERS) {
        if (!row[header]) issue.errors.push(`${header} is required`)
      }
      if (lineRef && refs.has(lineRef)) duplicateRefs.add(lineRef)
      refs.add(lineRef)
      issueByRef.set(lineRef || `__row_${rowNo}`, issue)
    }
    for (const ref of duplicateRefs) issueByRef.get(ref)?.errors.push(`Duplicate line_ref "${ref}"`)

    const simpleRows = sourceRows.map(({ row }) => ({
      lineRef: row.line_ref,
      parentLineRef: row.parent_line_ref || null,
    }))
    const levels = deriveLevels(simpleRows, issueByRef)
    const childRefs = new Set(simpleRows.map((row) => row.parentLineRef).filter((value): value is string => Boolean(value)))

    const bomName = sameHeaderValue(normalizedRows, 'bom_name', groupErrors) || bomCode
    const outputItemCode = sameHeaderValue(normalizedRows, 'output_item_code', groupErrors).toUpperCase()
    const outputUomCode = sameHeaderValue(normalizedRows, 'output_uom_code', groupErrors).toUpperCase()
    const outputQuantityRaw = sameHeaderValue(normalizedRows, 'output_quantity', groupErrors)
    const revisionNote = sameHeaderValue(normalizedRows, 'revision_note', groupErrors) || null
    const effectiveFromRaw = sameHeaderValue(normalizedRows, 'effective_from', groupErrors)
    const effectiveToRaw = sameHeaderValue(normalizedRows, 'effective_to', groupErrors)
    const outputQuantity = parsePositive(outputQuantityRaw, 'output_quantity', groupErrors)
    const outputItem = itemByCode.get(outputItemCode)
    const outputUom = uomByCode.get(outputUomCode)
    if (!outputItem) groupErrors.push(`Output item not found or inactive in this tenant: ${outputItemCode}`)
    if (!outputUom) groupErrors.push(`Output UOM not found or inactive in this tenant: ${outputUomCode}`)
    const effectiveFrom = parseDate(effectiveFromRaw, today, 'effective_from', groupErrors)
    const effectiveTo = effectiveToRaw ? parseDate(effectiveToRaw, today, 'effective_to', groupErrors) : null
    if (effectiveTo && effectiveTo < effectiveFrom) groupErrors.push('effective_to cannot be before effective_from')

    const existing = existingByCode.get(bomCode)
    if (existing && outputItem && existing.productItemId !== outputItem.id) {
      groupErrors.push(`Existing BOM ${bomCode} belongs to a different output item`)
    }
    if (existing && existing.name !== bomName) {
      groupWarnings.push(`Existing BOM name "${existing.name}" is retained; CSV name "${bomName}" does not overwrite it`)
    }
    const nextVersionNumber = existing
      ? Math.max(0, ...existing.versions.map((version) => version.versionNumber)) + 1
      : 1

    const resolvedLines: ResolvedLine[] = sourceRows.map(({ row, rowNo }) => {
      const issue = issueByRef.get(row.line_ref || `__row_${rowNo}`)!
      const itemCode = row.component_item_code.toUpperCase()
      const uomCode = row.component_uom_code.toUpperCase()
      const item = itemByCode.get(itemCode)
      const uom = uomByCode.get(uomCode)
      if (!item) issue.errors.push(`Component item not found or inactive in this tenant: ${itemCode}`)
      if (!uom) issue.errors.push(`Component UOM not found or inactive in this tenant: ${uomCode}`)
      const quantity = parsePositive(row.component_quantity, 'component_quantity', issue.errors)
      const sequence = parsePositive(row.sequence, 'sequence', issue.errors)
      if (!Number.isInteger(sequence)) issue.errors.push('sequence must be a positive integer')
      const scrapPercent = parsePercent(row.scrap_percentage, 'scrap_percentage', 0, issue.errors)
      const yieldPercent = parsePercent(row.yield_percentage, 'yield_percentage', 100, issue.errors)
      const isParent = childRefs.has(row.line_ref)
      const makeOrBuy = parseEnum(
        row.make_buy,
        Object.values(ManufacturingMakeOrBuy),
        isParent ? ManufacturingMakeOrBuy.MAKE : ManufacturingMakeOrBuy.BUY,
        'make_buy',
        issue.errors,
      )
      const lineType = parseEnum(
        row.line_type,
        Object.values(ManufacturingBomLineType),
        isParent ? ManufacturingBomLineType.SUBASSEMBLY : ManufacturingBomLineType.RAW_MATERIAL,
        'line_type',
        issue.errors,
      )
      const quantityBasis = parseEnum(
        row.quantity_basis,
        Object.values(ManufacturingQuantityBasis),
        ManufacturingQuantityBasis.PER_UNIT,
        'quantity_basis',
        issue.errors,
      )
      const consumptionMethod = row.consumption_method
        ? parseEnum(
            row.consumption_method,
            Object.values(ManufacturingConsumptionMethod),
            ManufacturingConsumptionMethod.ACTUAL,
            'consumption_method',
            issue.errors,
          )
        : null

      if (row.source_warehouse_code) {
        const warehouseCode = row.source_warehouse_code.toUpperCase()
        if (!warehouseByCode.has(warehouseCode)) {
          issue.errors.push(`Source warehouse not found or inactive in this tenant: ${warehouseCode}`)
        } else {
          issue.warnings.push('source_warehouse_code was validated but is not stored because BOM lines have no warehouse field')
        }
      }

      let issueOperationId: string | null = null
      let operationCode: string | null = null
      if (row.operation_code) {
        operationCode = row.operation_code.toUpperCase()
        const matches = operationsByCode.get(operationCode) ?? []
        if (matches.length === 0) issue.errors.push(`Operation not found or inactive in this tenant: ${operationCode}`)
        else if (matches.length > 1) issue.errors.push(`Operation code is ambiguous across routing versions: ${operationCode}`)
        else issueOperationId = matches[0].id
      }

      return {
        row: rowNo,
        lineRef: row.line_ref,
        parentLineRef: row.parent_line_ref || null,
        sequence,
        level: levels.get(row.line_ref) ?? 1,
        itemId: item?.id ?? '',
        itemCode,
        itemName: item?.name ?? '',
        quantity,
        uomId: uom?.id ?? '',
        uomCode,
        scrapPercent,
        yieldPercent,
        makeOrBuy,
        lineType,
        quantityBasis,
        consumptionMethod,
        issueOperationId,
        operationCode,
        isOptional: parseBoolean(row.is_optional),
        substituteAllowed: parseBoolean(row.substitute_allowed),
        qualityRequired: parseBoolean(row.quality_required),
        certificateRequired: parseBoolean(row.certificate_required),
        childProductionOrderRequired: parseBoolean(row.child_production_order_required),
        stockedSemiFinished: parseBoolean(row.stocked_semi_finished),
        phantomAssembly: parseBoolean(row.phantom_assembly),
        notes: row.remarks || null,
      }
    })

    const siblingSequences = new Set<string>()
    for (const line of resolvedLines) {
      const key = `${line.parentLineRef ?? '__root'}:${line.sequence}`
      if (siblingSequences.has(key)) issueByRef.get(line.lineRef)?.errors.push(`Duplicate sequence ${line.sequence} under the same parent`)
      siblingSequences.add(key)
    }

    result.push({
      bomCode,
      bomName,
      outputItemId: outputItem?.id ?? '',
      outputItemCode,
      outputItemName: outputItem?.name ?? '',
      outputQuantity,
      outputUomId: outputUom?.id ?? '',
      outputUomCode,
      revisionNote,
      effectiveFrom,
      effectiveTo,
      existingBomId: existing?.id ?? null,
      nextVersionNumber,
      action: existing ? 'CREATE_REVISION' : 'CREATE_BOM',
      lines: resolvedLines,
      issues: [...issueByRef.values()],
      errors: groupErrors,
      warnings: groupWarnings,
    })
  }
  return result
}

function toPreview(groups: ResolvedGroup[]): BomImportPreview {
  const mapped = groups.map((group) => ({
    bomCode: group.bomCode,
    bomName: group.bomName,
    outputItemCode: group.outputItemCode,
    outputItemName: group.outputItemName,
    action: group.action,
    nextVersionNumber: group.nextVersionNumber,
    lineCount: group.lines.length,
    errors: group.errors,
    warnings: group.warnings,
    rows: group.lines.map((line) => {
      const issue = group.issues.find((entry) => entry.row === line.row)!
      return {
        row: line.row,
        lineRef: line.lineRef,
        parentLineRef: line.parentLineRef,
        itemCode: line.itemCode,
        itemName: line.itemName,
        quantity: line.quantity,
        uomCode: line.uomCode,
        sequence: line.sequence,
        level: line.level,
        errors: issue.errors,
        warnings: issue.warnings,
      }
    }),
  }))
  const errorCount = mapped.reduce(
    (sum, group) => sum + group.errors.length + group.rows.reduce((rowSum, row) => rowSum + row.errors.length, 0),
    0,
  )
  const warningCount = mapped.reduce(
    (sum, group) => sum + group.warnings.length + group.rows.reduce((rowSum, row) => rowSum + row.warnings.length, 0),
    0,
  )
  return {
    ready: errorCount === 0,
    bomCount: mapped.length,
    lineCount: mapped.reduce((sum, group) => sum + group.lineCount, 0),
    errorCount,
    warningCount,
    groups: mapped,
  }
}

export async function previewBomImport(tenantId: string, input: PreviewBomImportInput): Promise<BomImportPreview> {
  return toPreview(await resolveImport(tenantId, input))
}

async function importGroup(
  req: Request,
  tenantId: string,
  userId: string,
  group: ResolvedGroup,
  idempotencyKey: string,
) {
  const audit = auditFromRequest(req)
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        let bom = await tx.manufacturingBom.findFirst({
          where: { tenantId, code: group.bomCode, deletedAt: null },
        })
        if (bom && bom.productItemId !== group.outputItemId) {
          throw new ConflictError(`Existing BOM ${group.bomCode} belongs to a different output item`)
        }
        if (!bom) {
          bom = await tx.manufacturingBom.create({
            data: {
              tenantId,
              code: group.bomCode,
              name: group.bomName,
              productItemId: group.outputItemId,
              description: `Created by BOM CSV import ${idempotencyKey}`,
              isActive: true,
              createdBy: userId,
              updatedBy: userId,
            },
          })
        }

        const maxVersion = await tx.manufacturingBomVersion.aggregate({
          where: { tenantId, bomId: bom.id },
          _max: { versionNumber: true },
        })
        const versionNumber = (maxVersion._max.versionNumber ?? 0) + 1
        const version = await tx.manufacturingBomVersion.create({
          data: {
            tenantId,
            bomId: bom.id,
            versionNumber,
            revisionCode: versionNumber === 1 ? 'A' : `R${versionNumber}`,
            status: 'DRAFT',
            effectiveFrom: group.effectiveFrom,
            effectiveTo: group.effectiveTo,
            baseQuantity: group.outputQuantity,
            baseUomId: group.outputUomId,
            expectedYieldPercent: 100,
            revisionNotes: group.revisionNote ?? `Imported from CSV (${idempotencyKey})`,
            createdBy: userId,
            updatedBy: userId,
          },
        })

        const idByRef = new Map<string, string>()
        const sorted = [...group.lines].sort((a, b) => a.level - b.level || a.sequence - b.sequence || a.row - b.row)
        for (const line of sorted) {
          const parentLineId = line.parentLineRef ? idByRef.get(line.parentLineRef) : null
          if (line.parentLineRef && !parentLineId) throw new ValidationError(`Parent ${line.parentLineRef} was not created`)
          const created = await tx.manufacturingBomLine.create({
            data: {
              tenantId,
              bomVersionId: version.id,
              parentLineId,
              sequence: line.sequence,
              level: line.level,
              itemId: line.itemId,
              quantity: line.quantity,
              uomId: line.uomId,
              quantityBasis: line.quantityBasis,
              fixedQuantity: null,
              scrapPercent: line.scrapPercent,
              yieldPercent: line.yieldPercent,
              makeOrBuy: line.makeOrBuy,
              lineType: line.lineType,
              issueStageGroupId: null,
              issueOperationId: line.issueOperationId,
              consumptionMethod: line.consumptionMethod,
              isOptional: line.isOptional,
              substituteAllowed: line.substituteAllowed,
              qualityRequired: line.qualityRequired,
              certificateRequired: line.certificateRequired,
              childProductionOrderRequired: line.childProductionOrderRequired,
              stockedSemiFinished: line.stockedSemiFinished,
              phantomAssembly: line.phantomAssembly,
              notes: line.notes,
              createdBy: userId,
              updatedBy: userId,
            },
          })
          idByRef.set(line.lineRef, created.id)
        }

        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            module: 'manufacturing',
            entity: 'manufacturingBomVersion',
            entityId: version.id,
            action: 'CSV_IMPORT',
            newValues: {
              idempotencyKey,
              payloadHash: hashGroup(group),
              bomCode: group.bomCode,
              versionNumber,
              lineCount: group.lines.length,
              action: group.action,
            } as Prisma.InputJsonValue,
            ipAddress: audit.ipAddress,
            userAgent: audit.userAgent,
          },
        })

        return {
          bomId: bom.id,
          bomCode: bom.code,
          versionId: version.id,
          versionNumber,
          revisionCode: version.revisionCode,
          lineCount: group.lines.length,
          action: group.action,
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError
        && (error.code === 'P2034' || error.code === 'P2002')
      if (!retryable || attempt === 3) throw error
    }
  }
  throw new ConflictError(`Could not reserve the next version for BOM ${group.bomCode}`)
}

export async function confirmBomImport(req: Request, tenantId: string, userId: string, input: ConfirmBomImportInput) {
  const groups = await resolveImport(tenantId, input)
  const preview = toPreview(groups)
  if (!preview.ready) {
    throw new ValidationError('BOM import contains validation errors', preview.groups.flatMap((group) => [
      ...group.errors.map((message) => ({ field: group.bomCode, message })),
      ...group.rows.flatMap((row) => row.errors.map((message) => ({ field: `${group.bomCode}.row.${row.row}`, message }))),
    ]))
  }

  const priorLogs = await prisma.auditLog.findMany({
    where: { tenantId, userId, module: 'manufacturing', action: 'CSV_IMPORT' },
    orderBy: { createdAt: 'desc' },
    take: Math.max(groups.length * 4, 20),
  })
  const priorByBomCode = new Map<string, (typeof priorLogs)[number]>()
  for (const log of priorLogs) {
    const value = log.newValues
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const record = value as Record<string, unknown>
    if (record.idempotencyKey === input.idempotencyKey && typeof record.bomCode === 'string') {
      priorByBomCode.set(record.bomCode, log)
    }
  }

  const created: Array<Awaited<ReturnType<typeof importGroup>>> = []
  let replayed = 0
  for (const group of groups) {
    const prior = priorByBomCode.get(group.bomCode)
    if (prior?.entityId) {
      const priorValue = prior.newValues as Record<string, unknown>
      if (priorValue.payloadHash !== hashGroup(group)) {
        throw new ConflictError(`Idempotency key was already used with different BOM data for ${group.bomCode}`)
      }
      const version = await prisma.manufacturingBomVersion.findFirst({
        where: { id: prior.entityId, tenantId },
        include: { bom: true, _count: { select: { lines: true } } },
      })
      if (version) {
        created.push({
          bomId: version.bomId,
          bomCode: version.bom.code,
          versionId: version.id,
          versionNumber: version.versionNumber,
          revisionCode: version.revisionCode,
          lineCount: version._count.lines,
          action: priorValue.action === 'CREATE_REVISION' ? 'CREATE_REVISION' : 'CREATE_BOM',
        })
        replayed += 1
        continue
      }
    }
    created.push(await importGroup(req, tenantId, userId, group, input.idempotencyKey))
  }
  return {
    importedBomCount: created.length,
    importedLineCount: created.reduce((sum, item) => sum + item.lineCount, 0),
    created,
    warnings: preview.warningCount,
    idempotentReplay: replayed === groups.length,
  }
}
