import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'

export function n(value: Prisma.Decimal | number | string | null | undefined | unknown): number {
  if (value == null) return 0
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return Number((value as { toString(): string }).toString())
  }
  return Number(value as string | number)
}

export function roundQty(value: number): number {
  return Math.max(0, Math.round(value * 10000) / 10000)
}

export function shipToKeyFromAddress(shippingAddress: string | null | undefined, deliveryLocation: string | null | undefined): string {
  const raw = (shippingAddress?.trim() || deliveryLocation?.trim() || '').toLowerCase().replace(/\s+/g, ' ')
  return raw || 'UNSPECIFIED'
}

export function fingerprint(parts: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40)
}

export function startOfTenantDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function overdueDays(due: Date | null | undefined, now = new Date()): number | null {
  if (!due) return null
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const days = Math.floor((today - dueDay) / 86_400_000)
  return days > 0 ? days : 0
}
