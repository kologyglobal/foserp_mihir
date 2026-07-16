import type { CrmMasterCatalogItem, CrmMasterEntry, CrmMasterFieldDef, CrmMasterKind } from '../types/crmMasters'
import { getMasterRegisterCatalog } from './masterRegisterScope'
import { CRM_MASTERS_SEED } from '../data/crm/crmMastersSeed'
import { parseCsvText } from './leadImport'

export type CrmMasterImportFieldGuide = {
  column: string
  required: boolean
  example: string
  hint: string
}

export type CrmMasterImportRow = {
  code: string
  name: string
  status: 'active' | 'inactive'
  description?: string
  attributes: Record<string, string | number | boolean | null>
}

export type CrmMasterImportPreviewRow = {
  rowNo: number
  input: CrmMasterImportRow
  errors: string[]
}

export type CrmMasterImportParseResult = {
  rows: CrmMasterImportPreviewRow[]
  headerErrors: string[]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function resolveFieldKey(header: string, catalog: CrmMasterCatalogItem): string | null {
  const n = normalizeKey(header)
  for (const field of catalog.fields) {
    if (normalizeKey(field.label) === n || normalizeKey(field.key) === n) return field.key
  }
  if (['code', 'name', 'status', 'description', 'notes'].includes(n)) return n
  return null
}

function fieldGuideHint(field: CrmMasterFieldDef): string {
  if (field.type === 'select' && field.options?.length) {
    return `One of: ${field.options.map((o) => o.value).join(', ')}`
  }
  if (field.type === 'boolean') return 'yes/no'
  if (field.type === 'number') return 'Numeric value'
  if (field.key === 'status') return 'active or inactive'
  return field.placeholder ?? ''
}

export function getCrmMasterImportHeaders(catalog: CrmMasterCatalogItem): string[] {
  return catalog.fields.map((f) => f.label)
}

export function getCrmMasterImportFieldGuide(catalog: CrmMasterCatalogItem): CrmMasterImportFieldGuide[] {
  return catalog.fields.map((field) => ({
    column: field.label,
    required: Boolean(field.required),
    example: sampleValueForField(field, catalog.kind),
    hint: fieldGuideHint(field),
  }))
}

function sampleValueForField(field: CrmMasterFieldDef, kind: CrmMasterKind): string {
  const seed = CRM_MASTERS_SEED.find((e) => e.kind === kind)
  if (!seed) {
    if (field.key === 'code') return 'sample_code'
    if (field.key === 'name') return 'Sample Name'
    if (field.key === 'status') return 'active'
    return ''
  }
  if (field.key === 'code') return `${seed.code}_new`
  if (field.key === 'name') return `${seed.name} (Import Sample)`
  if (field.key === 'status') return 'active'
  if (field.key === 'description') return seed.description ?? 'Optional description'
  const val = seed.attributes[field.key]
  if (val === null || val === undefined) return field.type === 'boolean' ? 'no' : ''
  if (typeof val === 'boolean') return val ? 'yes' : 'no'
  return String(val)
}

function entryToCsvRow(entry: CrmMasterEntry, catalog: CrmMasterCatalogItem): string[] {
  return catalog.fields.map((field) => {
    if (field.key === 'code') return entry.code
    if (field.key === 'name') return entry.name
    if (field.key === 'status') return entry.status
    if (field.key === 'description') return entry.description ?? ''
    const val = entry.attributes[field.key]
    if (val === null || val === undefined) return ''
    if (typeof val === 'boolean') return val ? 'yes' : 'no'
    return String(val)
  })
}

export function getCrmMasterImportSampleRows(
  catalog: CrmMasterCatalogItem,
  kind: CrmMasterKind,
): string[][] {
  const seeds = CRM_MASTERS_SEED.filter((e) => e.kind === kind).slice(0, 2)
  if (seeds.length >= 2) {
    return seeds.map((entry) => entryToCsvRow(entry, catalog))
  }
  if (seeds.length === 1) {
    return [entryToCsvRow(seeds[0]!, catalog)]
  }
  return [catalog.fields.map((field) => sampleValueForField(field, kind))]
}

export function buildCrmMasterImportTemplateCsv(catalog: CrmMasterCatalogItem, kind: CrmMasterKind): string {
  const escape = (val: string | number | null | undefined) => {
    const s = val == null ? '' : String(val)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const headers = getCrmMasterImportHeaders(catalog)
  const samples = getCrmMasterImportSampleRows(catalog, kind)
  return [
    headers.map(escape).join(','),
    ...samples.map((row) => row.map(escape).join(',')),
  ].join('\n')
}

export function downloadCrmMasterImportTemplate(slug: string) {
  const catalog = getMasterRegisterCatalog(slug)
  if (!catalog) return
  const csv = buildCrmMasterImportTemplateCsv(catalog, catalog.kind)
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug}-import-template.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function mapYesNo(raw: string, defaultValue: boolean): boolean {
  const key = normalizeKey(raw)
  if (!key) return defaultValue
  if (key === 'yes' || key === 'y' || key === 'true' || key === '1') return true
  if (key === 'no' || key === 'n' || key === 'false' || key === '0') return false
  return defaultValue
}

function parseFieldValue(
  field: CrmMasterFieldDef,
  raw: string,
  errors: string[],
): string | number | boolean | null {
  const trimmed = raw.trim()
  if (!trimmed) return field.type === 'boolean' ? false : null

  if (field.type === 'boolean') return mapYesNo(trimmed, false)

  if (field.type === 'number') {
    const num = Number(trimmed.replace(/,/g, ''))
    if (Number.isNaN(num)) {
      errors.push(`${field.label} must be a number`)
      return null
    }
    return num
  }

  if (field.type === 'select' && field.options?.length) {
    const allowed = field.options.map((o) => o.value)
    if (allowed.includes(trimmed)) return trimmed
    const byLabel = field.options.find((o) => normalizeKey(o.label) === normalizeKey(trimmed))
    if (byLabel) return byLabel.value
    errors.push(`Invalid ${field.label} — use: ${allowed.join(', ')}`)
    return trimmed
  }

  return trimmed
}

export function parseCrmMasterImportCsv(
  text: string,
  catalog: CrmMasterCatalogItem,
  existingEntries: CrmMasterEntry[],
): CrmMasterImportParseResult {
  const parsed = parseCsvText(text)
  if (parsed.length === 0) return { rows: [], headerErrors: ['CSV file is empty.'] }

  const headers = parsed[0]!
  const fieldKeys = headers.map((h) => resolveFieldKey(h, catalog))
  const codeIdx = fieldKeys.findIndex((k) => k === 'code')
  const nameIdx = fieldKeys.findIndex((k) => k === 'name')
  if (codeIdx < 0 || nameIdx < 0) {
    return { rows: [], headerErrors: ['Missing required columns: Code and Name (use template headers).'] }
  }

  const rows: CrmMasterImportPreviewRow[] = []
  const seenCodes = new Set<string>()
  for (let i = 1; i < parsed.length; i += 1) {
    const cells = parsed[i]!
    const errors: string[] = []
    const values: Record<string, string> = {}

    fieldKeys.forEach((key, idx) => {
      if (key) values[key] = cells[idx]?.trim() ?? ''
    })

    const code = values.code ?? ''
    const name = values.name ?? ''
    if (!code) errors.push('Code is required')
    if (!name) errors.push('Name is required')

    for (const field of catalog.fields) {
      if (field.required && !values[field.key]?.trim() && field.key !== 'status') {
        errors.push(`${field.label} is required`)
      }
    }

    const statusRaw = values.status ?? 'active'
    const status: 'active' | 'inactive' = normalizeKey(statusRaw) === 'inactive' ? 'inactive' : 'active'

    const attributes: Record<string, string | number | boolean | null> = {}
    let description: string | undefined

    for (const field of catalog.fields) {
      if (field.key === 'code' || field.key === 'name' || field.key === 'status') continue
      const raw = values[field.key] ?? ''
      if (field.key === 'description') {
        description = raw || undefined
        continue
      }
      if (!raw && !field.required) continue
      attributes[field.key] = parseFieldValue(field, raw, errors)
    }

    if (code && existingEntries.some((e) => e.kind === catalog.kind && e.code.toLowerCase() === code.toLowerCase())) {
      errors.push(`Code "${code}" already exists`)
    }
    if (code) {
      const codeKey = code.toLowerCase()
      if (seenCodes.has(codeKey)) errors.push(`Duplicate code "${code}" in file`)
      seenCodes.add(codeKey)
    }

    rows.push({
      rowNo: i + 1,
      input: { code, name, status, description, attributes },
      errors,
    })
  }

  return { rows, headerErrors: [] }
}

export function importCrmMasterPreviewRows(
  importEntries: (
    kind: CrmMasterKind,
    rows: CrmMasterImportRow[],
  ) => { ok: boolean; imported: number; skipped: number },
  kind: CrmMasterKind,
  rows: CrmMasterImportPreviewRow[],
): { imported: number; skipped: number; errors: { row: number; message: string }[] } {
  const valid = rows.filter((r) => r.errors.length === 0)
  const invalid = rows.filter((r) => r.errors.length > 0)
  const batchErrors = invalid.map((r) => ({ row: r.rowNo, message: r.errors.join('; ') }))

  if (valid.length === 0) {
    return { imported: 0, skipped: invalid.length, errors: batchErrors }
  }

  const result = importEntries(kind, valid.map((r) => r.input))
  return {
    imported: result.imported,
    skipped: result.skipped + invalid.length,
    errors: batchErrors,
  }
}
