import type { Customer, CustomerType, SalesTerritory } from '../types/master'
import { DEFAULT_CUSTOMER_COUNTRY } from '../config/countries'
import { suggestCustomerCode } from '../components/masters/CustomerFormSections'
import { isValidGstin, panFromGstin } from './customerUtils'
import { parseCsvText } from './leadImport'
import { sanitizePhoneDigits } from './phoneValidation'

export const COMPANY_IMPORT_HEADERS = [
  'Company Code',
  'Company Name',
  'Type',
  'Industry',
  'Address Line 1',
  'City',
  'State',
  'Pincode',
  'Country',
  'GSTIN',
  'PAN',
  'Contact Person',
  'Mobile',
  'Email',
  'Credit Days',
  'Credit Limit',
  'Sales Territory',
  'Active',
] as const

export type CompanyImportFieldGuide = {
  column: string
  required: boolean
  example: string
  hint: string
}

export function getCompanyImportFieldGuide(): CompanyImportFieldGuide[] {
  return [
    { column: 'Company Code', required: false, example: 'CUST-0042', hint: 'Auto-generated if blank (CUST-0001 format)' },
    { column: 'Company Name', required: true, example: 'Acme Logistics Pvt Ltd', hint: 'Legal or trading name' },
    { column: 'Type', required: false, example: 'corporate', hint: 'corporate, dealer, or government' },
    { column: 'Industry', required: false, example: 'Cement', hint: 'Industry segment' },
    { column: 'Address Line 1', required: false, example: 'Plot 12, MIDC Bhosari', hint: 'Billing address line' },
    { column: 'City', required: true, example: 'Pune', hint: 'Billing city' },
    { column: 'State', required: true, example: 'Maharashtra', hint: 'Billing state' },
    { column: 'Pincode', required: false, example: '411026', hint: '6-digit PIN code' },
    { column: 'Country', required: false, example: 'India', hint: 'Defaults to India' },
    { column: 'GSTIN', required: true, example: '27AABCU9603R1ZN', hint: '15-character GSTIN' },
    { column: 'PAN', required: false, example: 'AABCU9603R', hint: 'Optional — derived from GSTIN if blank' },
    { column: 'Contact Person', required: false, example: 'Ravi Mehta', hint: 'Primary contact name' },
    { column: 'Mobile', required: false, example: '9876543210', hint: 'Contact phone' },
    { column: 'Email', required: false, example: 'ravi@acme.in', hint: 'Contact email' },
    { column: 'Credit Days', required: false, example: '30', hint: 'Payment terms in days' },
    { column: 'Credit Limit', required: false, example: '5000000', hint: 'Approved credit limit (INR)' },
    { column: 'Sales Territory', required: false, example: 'West', hint: 'West, North, South, or East' },
    { column: 'Active', required: false, example: 'yes', hint: 'yes/no — defaults to yes' },
  ]
}

export const COMPANY_IMPORT_SAMPLE_ROWS: (string | number)[][] = [
  [
    '',
    'Acme Logistics Pvt Ltd',
    'corporate',
    'Logistics',
    'Ahura Centre, Mahakali Caves Road',
    'Mumbai',
    'Maharashtra',
    '400093',
    'India',
    '27AABCU9603R1ZN',
    '',
    'Vikram Mehta',
    '9820012345',
    'vikram.mehta@acme.in',
    30,
    5000000,
    'West',
    'yes',
  ],
  [
    'CUST-SAMPLE-002',
    'Patel Bulk Carriers',
    'dealer',
    'Transport',
    'NH-48, Vapi',
    'Vapi',
    'Gujarat',
    '396191',
    'India',
    '24AABCP3456E1Z7',
    '',
    'Hitesh Patel',
    '9825044002',
    'hitesh@patelbulk.com',
    15,
    2000000,
    'West',
    'yes',
  ],
]

export type CompanyImportRowInput = Omit<Customer, 'id' | 'createdAt' | 'isCustomer' | 'firstInvoicedAt'>

export type CompanyImportPreviewRow = {
  rowNo: number
  input: CompanyImportRowInput
  errors: string[]
}

export type CompanyImportResult = {
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

function mapCustomerType(raw: string): CustomerType | null {
  const key = normalizeKey(raw).replace(/ /g, '_')
  if (key === 'corporate' || key === 'dealer' || key === 'government') return key
  if (key.includes('dealer')) return 'dealer'
  if (key.includes('gov')) return 'government'
  if (key.includes('corp')) return 'corporate'
  return null
}

function mapTerritory(raw: string): SalesTerritory | null {
  const key = normalizeKey(raw)
  const hit = (['West', 'North', 'South', 'East'] as SalesTerritory[]).find(
    (t) => t.toLowerCase() === key,
  )
  return hit ?? null
}

function mapActive(raw: string): boolean {
  const key = normalizeKey(raw)
  if (!key || key === 'yes' || key === 'y' || key === 'true' || key === '1' || key === 'active') return true
  if (key === 'no' || key === 'n' || key === 'false' || key === '0' || key === 'inactive') return false
  return true
}

function nextCustomerCode(existing: Customer[]): string {
  return suggestCustomerCode(existing)
}

export function parseCompanyImportCsv(text: string): { rows: CompanyImportPreviewRow[]; headerErrors: string[] } {
  const parsed = parseCsvText(text)
  if (parsed.length === 0) return { rows: [], headerErrors: ['CSV file is empty.'] }

  const headerRow = parsed[0]!.map((h) => normalizeKey(h))
  const requiredName = normalizeKey('Company Name')
  if (!headerRow.includes(requiredName)) {
    return { rows: [], headerErrors: ['Missing required column: Company Name'] }
  }

  const rows: CompanyImportPreviewRow[] = []
  for (let i = 1; i < parsed.length; i += 1) {
    const obj = rowToObject(parsed[0]!, parsed[i]!)
    const errors: string[] = []

    const customerName = obj[requiredName] ?? ''
    if (!customerName) errors.push('Company Name is required')

    const city = obj[normalizeKey('City')] ?? ''
    if (!city) errors.push('City is required')

    const state = obj[normalizeKey('State')] ?? ''
    if (!state) errors.push('State is required')

    const gstin = (obj[normalizeKey('GSTIN')] ?? '').toUpperCase()
    if (!gstin) {
      errors.push('GSTIN is required')
    } else if (!isValidGstin(gstin)) {
      errors.push('Invalid GSTIN format (15 characters)')
    }

    const typeRaw = obj[normalizeKey('Type')] ?? 'corporate'
    const customerType = mapCustomerType(typeRaw)
    if (!customerType) errors.push('Invalid Type — use corporate, dealer, or government')

    const territoryRaw = obj[normalizeKey('Sales Territory')] ?? 'West'
    const salesTerritory = mapTerritory(territoryRaw)
    if (!salesTerritory) errors.push('Invalid Sales Territory — use West, North, South, or East')

    const creditDaysRaw = obj[normalizeKey('Credit Days')] ?? '30'
    const creditDays = Number(creditDaysRaw.replace(/,/g, ''))
    if (Number.isNaN(creditDays) || creditDays < 0) {
      errors.push('Credit Days must be zero or a positive number')
    }

    const creditLimitRaw = obj[normalizeKey('Credit Limit')] ?? '0'
    const creditLimit = Number(creditLimitRaw.replace(/,/g, ''))
    if (Number.isNaN(creditLimit) || creditLimit < 0) {
      errors.push('Credit Limit must be zero or a positive number')
    }

    const panRaw = (obj[normalizeKey('PAN')] ?? '').toUpperCase()
    const pan = panRaw || (gstin ? panFromGstin(gstin) : '')

    rows.push({
      rowNo: i + 1,
      input: {
        customerCode: obj[normalizeKey('Company Code')] ?? '',
        customerName,
        customerType: customerType ?? 'corporate',
        industry: obj[normalizeKey('Industry')] ?? '',
        addressLine1: obj[normalizeKey('Address Line 1')] ?? '',
        city,
        state,
        pincode: obj[normalizeKey('Pincode')] ?? '',
        country: obj[normalizeKey('Country')] || DEFAULT_CUSTOMER_COUNTRY,
        gstin,
        pan: pan || undefined,
        contactPerson: obj[normalizeKey('Contact Person')] ?? '',
        contactPhone: sanitizePhoneDigits(obj[normalizeKey('Mobile')] ?? ''),
        contactEmail: obj[normalizeKey('Email')] ?? '',
        creditDays: Number.isNaN(creditDays) ? 30 : creditDays,
        creditLimit: Number.isNaN(creditLimit) ? 0 : creditLimit,
        salesTerritory: salesTerritory ?? 'West',
        isActive: mapActive(obj[normalizeKey('Active')] ?? 'yes'),
      },
      errors,
    })
  }

  return { rows, headerErrors: [] }
}

export function buildCompanyImportTemplateCsv(): string {
  const escape = (val: string | number | null | undefined) => {
    const s = val == null ? '' : String(val)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    [...COMPANY_IMPORT_HEADERS].map(escape).join(','),
    ...COMPANY_IMPORT_SAMPLE_ROWS.map((row) => row.map(escape).join(',')),
  ].join('\n')
}

export function downloadCompanyImportTemplate() {
  const csv = buildCompanyImportTemplateCsv()
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'company-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function importCompanyRows(
  addCustomer: (data: Omit<Customer, 'id' | 'createdAt'>) => string,
  existingCustomers: Customer[],
  rows: CompanyImportPreviewRow[],
): CompanyImportResult {
  const errors: { row: number; message: string }[] = []
  let imported = 0
  const working = [...existingCustomers]

  for (const row of rows) {
    if (row.errors.length > 0) {
      errors.push({ row: row.rowNo, message: row.errors.join('; ') })
      continue
    }

    const gstin = row.input.gstin.toUpperCase()
    if (working.some((c) => c.gstin.toUpperCase() === gstin)) {
      errors.push({ row: row.rowNo, message: `GSTIN ${gstin} already exists` })
      continue
    }

    let customerCode = row.input.customerCode.trim()
    if (customerCode) {
      if (working.some((c) => c.customerCode.toLowerCase() === customerCode.toLowerCase())) {
        errors.push({ row: row.rowNo, message: `Company Code ${customerCode} already exists` })
        continue
      }
    } else {
      customerCode = nextCustomerCode(working)
    }

    const id = addCustomer({
      ...row.input,
      customerCode,
      gstin,
      pan: row.input.pan ?? panFromGstin(gstin),
      isCustomer: false,
      firstInvoicedAt: null,
    })

    working.push({
      ...row.input,
      id,
      customerCode,
      gstin,
      pan: row.input.pan ?? panFromGstin(gstin),
      isCustomer: false,
      firstInvoicedAt: null,
      createdAt: new Date().toISOString(),
    })
    imported += 1
  }

  return {
    ok: imported > 0 && errors.length === 0,
    imported,
    failed: errors.length,
    errors,
  }
}
