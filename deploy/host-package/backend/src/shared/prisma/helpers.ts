import type { Prisma } from '@prisma/client'

export function tenantActiveFilter(tenantId: string): { tenantId: string; deletedAt: null } {
  return { tenantId, deletedAt: null }
}

export function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null
}

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : Number(value)
}
