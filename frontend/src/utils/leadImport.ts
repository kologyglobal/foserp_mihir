import type { LeadPriority, LeadSource, LeadStage } from '../types/sales'
import { getActiveLeadUsers } from '../data/crm/leadUsers'
import { getSessionUser } from './permissions'
import { resolveLeadStageOptions, resolveLeadPriorityOptions } from './leadUtils'
import { sanitizePhoneDigits } from './phoneValidation'
import { normalizeEmail, validateEmail } from './validation/email'

export const LEAD_IMPORT_HEADERS = [
  'Prospect Name',
  'Source',
  'Industry',
  'Lead Owner',
  'Expected Value',
  'Probability',
  'Priority',
  'Stage',
  'Contact Person',
  'Mobile',
  'Email',
  'Product Requirement',
  'Remarks',
  'Expected Close Date',
  'Expected Qty',
  'Created Date',
] as const

export type LeadImportFieldGuide = {
  column: string
  required: boolean
  example: string
  hint: string
}

/** Column reference shown in the import dialog and implied by the downloadable template. */
export function getLeadImportFieldGuide(): LeadImportFieldGuide[] {
  const stages = resolveLeadStageOptions().join(', ')
  const priorities = resolveLeadPriorityOptions().map((p) => p.value).join(', ')
  const owners = getActiveLeadUsers().map((u) => u.name).join(', ')
  const sources = 'website, referral, trade_show, cold_call, existing_customer, indiamart, justdial, field_visit, other'

  return [
    { column: 'Prospect Name', required: true, example: 'Acme Logistics Pvt Ltd', hint: 'Company or prospect name' },
    { column: 'Source', required: false, example: 'referral', hint: `One of: ${sources}` },
    { column: 'Industry', required: false, example: 'Logistics', hint: 'Industry segment' },
    { column: 'Lead Owner', required: false, example: 'Rajesh Kumar', hint: `Sales owner — e.g. ${owners}` },
    { column: 'Expected Value', required: true, example: '1500000', hint: 'Positive number (INR, no commas)' },
    { column: 'Probability', required: false, example: '35', hint: '0–100 (percent win chance)' },
    { column: 'Priority', required: false, example: 'high', hint: `One of: ${priorities}` },
    { column: 'Stage', required: false, example: 'new', hint: `One of: ${stages}` },
    { column: 'Contact Person', required: false, example: 'Ravi Mehta', hint: 'Primary contact name' },
    { column: 'Mobile', required: false, example: '9876543210', hint: '10-digit mobile' },
    { column: 'Email', required: false, example: 'ravi@acme.in', hint: 'Contact email' },
    { column: 'Product Requirement', required: false, example: '45 m3 bulker trailer', hint: 'What the prospect needs' },
    { column: 'Remarks', required: false, example: 'Met at trade show', hint: 'Internal notes' },
    { column: 'Expected Close Date', required: false, example: '2026-09-30', hint: 'YYYY-MM-DD' },
    { column: 'Expected Qty', required: false, example: '2', hint: 'Expected order quantity' },
    { column: 'Created Date', required: false, example: new Date().toISOString().slice(0, 10), hint: 'YYYY-MM-DD (defaults to today)' },
  ]
}

export const LEAD_IMPORT_SAMPLE_ROWS: (string | number)[][] = [
  [
    'Acme Logistics Pvt Ltd',
    'referral',
    'Logistics',
    'Rajesh Kumar',
    1500000,
    35,
    'high',
    'new',
    'Ravi Mehta',
    '9876543210',
    'ravi@acme.in',
    '45 m3 bulker trailer requirement',
    'Referred by existing customer',
    '2026-09-30',
    2,
    new Date().toISOString().slice(0, 10),
  ],
  [
    'UltraTech Cement Ltd.',
    'website',
    'Cement',
    'Priya Deshmukh',
    2850000,
    50,
    'medium',
    'contacted',
    'Vikram Mehta',
    '9820012345',
    'vikram.mehta@ultratech.com',
    'Side tipper trailer — 30 m3',
    '',
    '2026-12-15',
    1,
    new Date().toISOString().slice(0, 10),
  ],
]

export type LeadImportRowInput = {
  prospectName: string
  source: LeadSource
  industry: string
  leadOwnerId: string
  leadOwnerName: string
  expectedValue: number
  probability: number
  priority: LeadPriority
  stage: LeadStage
  contactPerson: string | null
  mobile: string | null
  email: string | null
  productRequirement: string
  remarks: string
  expectedCloseDate: string | null
  expectedQty: number | null
  createdDate: string
}

export type LeadImportPreviewRow = {
  rowNo: number
  input: LeadImportRowInput
  errors: string[]
}

export type LeadImportResult = {
  ok: boolean
  imported: number
  failed: number
  errors: { row: number; message: string }[]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

export function parseCsvText(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine)
}

function mapSource(raw: string): LeadSource {
  const key = normalizeKey(raw).replace(/ /g, '_')
  const allowed: LeadSource[] = [
    'website', 'referral', 'trade_show', 'cold_call', 'existing_customer', 'other',
    'indiamart', 'justdial', 'field_visit', 'other_channel',
  ]
  if (allowed.includes(key as LeadSource)) return key as LeadSource
  if (key.includes('referral')) return 'referral'
  if (key.includes('website')) return 'website'
  if (key.includes('trade')) return 'trade_show'
  if (key.includes('indiamart')) return 'indiamart'
  if (key.includes('justdial')) return 'justdial'
  if (key.includes('field')) return 'field_visit'
  return 'other'
}

function mapStage(raw: string): LeadStage | null {
  const key = normalizeKey(raw).replace(/ /g, '_')
  const stages = resolveLeadStageOptions()
  const hit = stages.find((s) => s === key || s.replace(/_/g, ' ') === normalizeKey(raw))
  return hit ?? null
}

function mapPriority(raw: string): LeadPriority | null {
  const key = normalizeKey(raw)
  const options = resolveLeadPriorityOptions()
  const hit = options.find((p) => p.value === key || normalizeKey(p.label) === key)
  return (hit?.value as LeadPriority | undefined) ?? null
}

function resolveOwner(raw: string): { id: string; name: string } {
  const session = getSessionUser()
  const trimmed = raw.trim()
  if (!trimmed) return { id: session.id, name: session.name }
  const users = getActiveLeadUsers()
  const exact = users.find((u) => normalizeKey(u.name) === normalizeKey(trimmed))
  if (exact) return { id: exact.id, name: exact.name }
  const partial = users.find((u) => normalizeKey(u.name).includes(normalizeKey(trimmed)))
  if (partial) return { id: partial.id, name: partial.name }
  return { id: session.id, name: trimmed }
}

function rowToObject(headers: string[], cells: string[]): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.forEach((h, idx) => {
    obj[normalizeKey(h)] = cells[idx]?.trim() ?? ''
  })
  return obj
}

export function parseLeadImportCsv(text: string): { rows: LeadImportPreviewRow[]; headerErrors: string[] } {
  const parsed = parseCsvText(text)
  if (parsed.length === 0) return { rows: [], headerErrors: ['CSV file is empty.'] }

  const headerRow = parsed[0]!.map((h) => normalizeKey(h))
  const required = normalizeKey('Prospect Name')
  if (!headerRow.includes(required)) {
    return { rows: [], headerErrors: ['Missing required column: Prospect Name'] }
  }

  const rows: LeadImportPreviewRow[] = []
  for (let i = 1; i < parsed.length; i += 1) {
    const obj = rowToObject(parsed[0]!, parsed[i]!)
    const errors: string[] = []
    const prospectName = obj[required] ?? ''
    if (!prospectName) errors.push('Prospect Name is required')

    const expectedValue = Number((obj[normalizeKey('Expected Value')] ?? '0').replace(/,/g, ''))
    if (!expectedValue || Number.isNaN(expectedValue) || expectedValue <= 0) {
      errors.push('Expected Value must be a positive number')
    }

    const probabilityRaw = obj[normalizeKey('Probability')] ?? '30'
    const probability = Number(probabilityRaw.replace('%', ''))
    if (Number.isNaN(probability) || probability < 0 || probability > 100) {
      errors.push('Probability must be between 0 and 100')
    }

    const priority = mapPriority(obj[normalizeKey('Priority')] ?? 'medium')
    if (!priority) errors.push('Invalid Priority')

    const stage = mapStage(obj[normalizeKey('Stage')] ?? 'new')
    if (!stage) errors.push('Invalid Stage')

    const owner = resolveOwner(obj[normalizeKey('Lead Owner')] ?? '')
    const createdDate = obj[normalizeKey('Created Date')] || new Date().toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(createdDate)) {
      errors.push('Created Date must be YYYY-MM-DD')
    }

    const expectedCloseRaw = obj[normalizeKey('Expected Close Date')] ?? ''
    let expectedCloseDate: string | null = null
    if (expectedCloseRaw) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedCloseRaw)) {
        errors.push('Expected Close Date must be YYYY-MM-DD')
      } else {
        expectedCloseDate = expectedCloseRaw
      }
    }

    const expectedQtyRaw = obj[normalizeKey('Expected Qty')] ?? ''
    let expectedQty: number | null = null
    if (expectedQtyRaw) {
      const qty = Number(expectedQtyRaw.replace(/,/g, ''))
      if (Number.isNaN(qty) || qty <= 0) {
        errors.push('Expected Qty must be a positive number')
      } else {
        expectedQty = qty
      }
    }

    const emailRaw = obj[normalizeKey('Email')] ?? ''
    const emailError = validateEmail(emailRaw)
    if (emailError) errors.push(emailError)
    const email = emailRaw.trim() ? normalizeEmail(emailRaw) : null

    rows.push({
      rowNo: i + 1,
      input: {
        prospectName,
        source: mapSource(obj[normalizeKey('Source')] ?? 'other'),
        industry: obj[normalizeKey('Industry')] ?? '',
        leadOwnerId: owner.id,
        leadOwnerName: owner.name,
        expectedValue,
        probability: Number.isNaN(probability) ? 30 : probability,
        priority: priority ?? 'medium',
        stage: stage ?? 'new',
        contactPerson: obj[normalizeKey('Contact Person')] || null,
        mobile: sanitizePhoneDigits(obj[normalizeKey('Mobile')] ?? '') || null,
        email,
        productRequirement: obj[normalizeKey('Product Requirement')] || 'Imported lead',
        remarks: obj[normalizeKey('Remarks')] ?? '',
        expectedCloseDate,
        expectedQty,
        createdDate,
      },
      errors,
    })
  }

  return { rows, headerErrors: [] }
}

export function buildLeadImportTemplateCsv(): string {
  const escape = (val: string | number | null | undefined) => {
    const s = val == null ? '' : String(val)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    [...LEAD_IMPORT_HEADERS].map(escape).join(','),
    ...LEAD_IMPORT_SAMPLE_ROWS.map((row) => row.map(escape).join(',')),
  ]
  return lines.join('\n')
}

export function downloadLeadImportTemplate() {
  const csv = buildLeadImportTemplateCsv()
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lead-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function importLeadRows(
  createLead: (input: LeadImportRowInput & {
    activityStatus: 'active'
    lifecycleStatus: 'open'
  }) => { ok: boolean; error?: string },
  rows: LeadImportPreviewRow[],
): LeadImportResult {
  const errors: { row: number; message: string }[] = []
  let imported = 0

  for (const row of rows) {
    if (row.errors.length > 0) {
      errors.push({ row: row.rowNo, message: row.errors.join('; ') })
      continue
    }
    const result = createLead({
      ...row.input,
      expectedCloseDate: row.input.expectedCloseDate,
      expectedQty: row.input.expectedQty,
      activityStatus: 'active',
      lifecycleStatus: 'open',
    })
    if (result.ok) {
      imported += 1
    } else {
      errors.push({ row: row.rowNo, message: result.error ?? 'Import failed' })
    }
  }

  return {
    ok: imported > 0 && errors.length === 0,
    imported,
    failed: errors.length,
    errors,
  }
}
