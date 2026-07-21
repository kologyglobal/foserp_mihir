import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'

export function parseDecimal(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatBookAmount(value: string | number | null | undefined): string {
  return formatCurrency(parseDecimal(value))
}

export function formatBookDate(value: string | null | undefined): string {
  return formatDate(value)
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function firstOfMonthIsoDate(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
