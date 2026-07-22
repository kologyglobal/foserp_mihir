import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'

export function parseDecimal(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatSiAmount(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  return formatCurrency(parseDecimal(value))
}

export function formatSiDate(value: string | null | undefined): string {
  return formatDate(value)
}

export function formatSiDateTime(value: string | null | undefined): string {
  return formatDateTime(value)
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}
