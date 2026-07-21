import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import type { TransferAccountSnapshot } from '../api/treasury-transfer.types'
import { maskAccountNumber, parseDecimal } from './treasuryTransferUi'

/** Formats a decimal-string transfer amount as INR currency. */
export function formatTransferAmount(value: string | number | null | undefined): string {
  return formatCurrency(parseDecimal(value))
}

export function formatTransferDate(value: string | null | undefined): string {
  return formatDate(value)
}

export function formatTransferDateTime(value: string | null | undefined): string {
  return formatDateTime(value)
}

/** "CODE — Name (••••1234)" account label used across selector / summary / timeline. */
export function formatAccountLabel(account: TransferAccountSnapshot | undefined | null): string {
  if (!account) return '—'
  const masked = account.accountType === 'BANK' ? maskAccountNumber(account.maskedNumber) : null
  return [`${account.code} — ${account.name}`, masked && masked !== '—' ? `(${masked})` : null]
    .filter(Boolean)
    .join(' ')
}

/** YYYY-MM-DD for date-only inputs / API payloads. */
export function toIsoDateInput(value: string | null | undefined): string {
  if (!value) return ''
  return value.length >= 10 ? value.slice(0, 10) : value
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}
