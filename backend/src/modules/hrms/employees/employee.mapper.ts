/** Show only the last 4 digits of a bank account number; mask everything else. */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.trim()
  if (digits.length <= 4) return '•'.repeat(Math.max(0, digits.length - 1)) + digits.slice(-1)
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`
}

export interface BankDetailRow {
  id: string
  tenantId: string
  employeeId: string
  bankName: string
  accountHolderName: string
  accountNumber: string
  ifsc: string
  isPrimary: boolean
  effectiveFrom: Date | null
  effectiveTo: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/** Full detail (sensitive endpoints only) vs. masked summary (never expose full account number). */
export function mapBankDetail(row: BankDetailRow, reveal: boolean) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    bankName: row.bankName,
    accountHolderName: row.accountHolderName,
    accountNumber: reveal ? row.accountNumber : maskAccountNumber(row.accountNumber),
    accountNumberMasked: maskAccountNumber(row.accountNumber),
    ifsc: row.ifsc,
    isPrimary: row.isPrimary,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export interface StatutoryDetailRow {
  id: string
  tenantId: string
  employeeId: string
  pan: string | null
  aadhaarRef: string | null
  uan: string | null
  esicNumber: string | null
  createdAt: Date
  updatedAt: Date
}

function maskTail(value: string | null, visible = 4): string | null {
  if (!value) return value
  if (value.length <= visible) return '•'.repeat(Math.max(0, value.length - 1)) + value.slice(-1)
  return `${'•'.repeat(value.length - visible)}${value.slice(-visible)}`
}

export function mapStatutoryDetail(row: StatutoryDetailRow, reveal: boolean) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    pan: reveal ? row.pan : maskTail(row.pan),
    aadhaarRef: reveal ? row.aadhaarRef : maskTail(row.aadhaarRef),
    uan: reveal ? row.uan : maskTail(row.uan),
    esicNumber: reveal ? row.esicNumber : maskTail(row.esicNumber),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
