import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import type { ChequeAccountSnapshot } from '../api/treasury-cheque.types'

export function parseDecimal(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Formats a decimal-string cheque amount as INR currency. */
export function formatChequeAmount(value: string | number | null | undefined): string {
  return formatCurrency(parseDecimal(value))
}

export function formatChequeDate(value: string | null | undefined): string {
  return formatDate(value)
}

export function formatChequeDateTime(value: string | null | undefined): string {
  return formatDateTime(value)
}

/** Best-effort masking when the backend does not supply a pre-masked account number. */
export function maskAccountNumber(raw: string | null | undefined): string {
  if (!raw) return '—'
  const digits = raw.replace(/\s+/g, '')
  if (digits.length <= 4) return digits
  return `••••${digits.slice(-4)}`
}

/** "CODE — Name (••••1234)" account label used across selector / summary panels. */
export function formatChequeAccountLabel(account: ChequeAccountSnapshot | undefined | null): string {
  if (!account) return '—'
  const masked = maskAccountNumber(account.maskedNumber)
  return [`${account.code} — ${account.name}`, masked && masked !== '—' ? `(${masked})` : null].filter(Boolean).join(' ')
}

export function toIsoDateInput(value: string | null | undefined): string {
  if (!value) return ''
  return value.length >= 10 ? value.slice(0, 10) : value
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}
