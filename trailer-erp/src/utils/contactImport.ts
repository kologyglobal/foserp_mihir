import type { Customer } from '../types/master'
import type { CrmContact } from '../types/crm'
import { parseCsvText } from './leadImport'
import { reserveCode, confirmCode } from '../services/codeSeriesService'
import { sanitizePhoneDigits } from './phoneValidation'

export const CONTACT_IMPORT_HEADERS = [
  'Company Code',
  'Company Name',
  'Contact Name',
  'Designation',
  'Department',
  'Email',
  'Phone',
  'Primary',
  'Active',
] as const

export type ContactImportFieldGuide = {
  column: string
  required: boolean
  example: string
  hint: string
}

export function getContactImportFieldGuide(): ContactImportFieldGuide[] {
  return [
    { column: 'Company Code', required: false, example: 'CUST-UBL-001', hint: 'Match existing company code (use with or without Company Name)' },
    { column: 'Company Name', required: false, example: 'UltraBuild Logistics', hint: 'Match existing company name — required if Company Code is blank' },
    { column: 'Contact Name', required: true, example: 'Vikram Desai', hint: 'Full name of the contact' },
    { column: 'Designation', required: false, example: 'Purchase Manager', hint: 'Job title' },
    { column: 'Department', required: false, example: 'Procurement', hint: 'Department or function' },
    { column: 'Email', required: false, example: 'vikram@ultrabuild.in', hint: 'Work email address' },
    { column: 'Phone', required: false, example: '9823022001', hint: 'Mobile or desk phone' },
    { column: 'Primary', required: false, example: 'yes', hint: 'yes/no — mark as primary contact for the company' },
    { column: 'Active', required: false, example: 'yes', hint: 'yes/no — defaults to yes' },
  ]
}

export const CONTACT_IMPORT_SAMPLE_ROWS: (string | number)[][] = [
  [
    'CUST-UBL-001',
    'UltraBuild Logistics',
    'Vikram Desai',
    'Purchase Manager',
    'Procurement',
    'vikram@ultrabuild.in',
    '9823022001',
    'yes',
    'yes',
  ],
  [
    '',
    'Patel Bulk Carriers',
    'Hitesh Patel',
    'Director',
    'Operations',
    'hitesh@patelbulk.com',
    '9825044002',
    'no',
    'yes',
  ],
]

export type ContactImportRowInput = {
  contactCode: string
  customerId: string
  name: string
  designation: string
  department: string
  email: string
  phone: string
  isPrimary: boolean
  isActive: boolean
}

export type ContactImportPreviewRow = {
  rowNo: number
  input: ContactImportRowInput
  companyLabel: string
  errors: string[]
}

export type ContactImportResult = {
  ok: boolean
  imported: number
  failed: number
  errors: { row: number; message: string }[]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function rowToObject(headers: string[], cells: string[]): Record<string, string> {
  const obj: Record<string, string> = {}
  headers.forEach((h, idx) => {
    obj[normalizeKey(h)] = cells[idx]?.trim() ?? ''
  })
  return obj
}

function mapYesNo(raw: string, defaultValue: boolean): boolean {
  const key = normalizeKey(raw)
  if (!key) return defaultValue
  if (key === 'yes' || key === 'y' || key === 'true' || key === '1') return true
  if (key === 'no' || key === 'n' || key === 'false' || key === '0') return false
  return defaultValue
}

function resolveCustomer(
  companyCode: string,
  companyName: string,
  customers: Customer[],
): Customer | null {
  const code = companyCode.trim()
  const name = companyName.trim()
  if (code) {
    const byCode = customers.find((c) => c.customerCode.toLowerCase() === code.toLowerCase())
    if (byCode) return byCode
  }
  if (name) {
    const byName = customers.find((c) => normalizeKey(c.customerName) === normalizeKey(name))
    if (byName) return byName
    const partial = customers.find((c) => normalizeKey(c.customerName).includes(normalizeKey(name)))
    if (partial) return partial
  }
  return null
}

export function parseContactImportCsv(
  text: string,
  customers: Customer[],
): { rows: ContactImportPreviewRow[]; headerErrors: string[] } {
  const parsed = parseCsvText(text)
  if (parsed.length === 0) return { rows: [], headerErrors: ['CSV file is empty.'] }

  const headerRow = parsed[0]!.map((h) => normalizeKey(h))
  const requiredName = normalizeKey('Contact Name')
  if (!headerRow.includes(requiredName)) {
    return { rows: [], headerErrors: ['Missing required column: Contact Name'] }
  }

  const rows: ContactImportPreviewRow[] = []
  for (let i = 1; i < parsed.length; i += 1) {
    const obj = rowToObject(parsed[0]!, parsed[i]!)
    const errors: string[] = []

    const name = obj[requiredName] ?? ''
    if (!name) errors.push('Contact Name is required')

    const companyCode = obj[normalizeKey('Company Code')] ?? ''
    const companyName = obj[normalizeKey('Company Name')] ?? ''
    if (!companyCode && !companyName) {
      errors.push('Company Code or Company Name is required')
    }

    const customer = resolveCustomer(companyCode, companyName, customers)
    if ((companyCode || companyName) && !customer) {
      errors.push(`Company not found: ${companyCode || companyName}`)
    }

    const email = obj[normalizeKey('Email')] ?? ''
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Invalid email format')
    }

    rows.push({
      rowNo: i + 1,
      input: {
        contactCode: '',
        customerId: customer?.id ?? '',
        name,
        designation: obj[normalizeKey('Designation')] ?? '',
        department: obj[normalizeKey('Department')] ?? '',
        email,
        phone: sanitizePhoneDigits(obj[normalizeKey('Phone')] ?? ''),
        isPrimary: mapYesNo(obj[normalizeKey('Primary')] ?? '', false),
        isActive: mapYesNo(obj[normalizeKey('Active')] ?? '', true),
      },
      companyLabel: customer?.customerName ?? (companyName || companyCode),
      errors,
    })
  }

  return { rows, headerErrors: [] }
}

export function buildContactImportTemplateCsv(): string {
  const escape = (val: string | number | null | undefined) => {
    const s = val == null ? '' : String(val)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    [...CONTACT_IMPORT_HEADERS].map(escape).join(','),
    ...CONTACT_IMPORT_SAMPLE_ROWS.map((row) => row.map(escape).join(',')),
  ].join('\n')
}

export function downloadContactImportTemplate() {
  const csv = buildContactImportTemplateCsv()
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'contact-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function importContactRows(
  createContact: (
    input: Omit<CrmContact, keyof import('../types/audit').AuditTrail | 'id' | 'masterContactId'>,
  ) => { ok: boolean; error?: string; contactId?: string },
  existingContacts: CrmContact[],
  rows: ContactImportPreviewRow[],
): ContactImportResult {
  const errors: { row: number; message: string }[] = []
  let imported = 0
  const working = [...existingContacts]

  for (const row of rows) {
    if (row.errors.length > 0) {
      errors.push({ row: row.rowNo, message: row.errors.join('; ') })
      continue
    }

    const nameKey = normalizeKey(row.input.name)
    const duplicate = working.find(
      (c) => c.customerId === row.input.customerId && normalizeKey(c.name) === nameKey,
    )
    if (duplicate) {
      errors.push({ row: row.rowNo, message: `Contact "${row.input.name}" already exists for this company` })
      continue
    }

    if (row.input.email) {
      const emailDup = working.find(
        (c) => c.customerId === row.input.customerId
          && c.email.toLowerCase() === row.input.email.toLowerCase(),
      )
      if (emailDup) {
        errors.push({ row: row.rowNo, message: `Email ${row.input.email} already exists for this company` })
        continue
      }
    }

    let contactCode = ''
    try {
      contactCode = reserveCode('contact')
    } catch {
      errors.push({ row: row.rowNo, message: 'Code Series is not configured for contacts' })
      continue
    }

    const result = createContact({ ...row.input, contactCode })
    if (result.ok) {
      confirmCode('contact', contactCode)
      imported += 1
      working.push({
        id: result.contactId ?? `import-${row.rowNo}`,
        masterContactId: undefined,
        ...row.input,
        contactCode,
        createdAt: new Date().toISOString(),
        createdById: '',
        createdByName: '',
        modifiedAt: new Date().toISOString(),
        modifiedById: '',
        modifiedByName: '',
        approvedById: null,
        approvedByName: null,
        approvedAt: null,
      })
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
