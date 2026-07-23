import type { Account, LegalEntity } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { MAX_ACCOUNT_DEPTH, MAX_COST_CENTRE_DEPTH } from './finance.constants.js'

export async function getLegalEntityOrThrow(tenantId: string, legalEntityId: string): Promise<LegalEntity> {
  const entity = await prisma.legalEntity.findFirst({
    where: { id: legalEntityId, tenantId },
  })
  if (!entity) throw new NotFoundError('Legal entity not found')
  return entity
}

export async function assertLegalEntityUsed(tenantId: string, legalEntityId: string): Promise<boolean> {
  const [fyCount, accountCount, settings] = await Promise.all([
    prisma.financialYear.count({ where: { tenantId, legalEntityId } }),
    prisma.account.count({ where: { tenantId, legalEntityId } }),
    prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } }),
  ])
  return fyCount > 0 || accountCount > 0 || settings != null
}

export async function assertNoCircularParent(
  entityId: string,
  parentId: string | null | undefined,
  loadParent: (id: string) => Promise<{ id: string; parentAccountId?: string | null; parentId?: string | null } | null>,
  parentField: 'parentAccountId' | 'parentId' = 'parentAccountId',
): Promise<void> {
  if (!parentId) return
  if (parentId === entityId) {
    throw new ValidationError('Account hierarchy cannot contain circular references')
  }
  const visited = new Set<string>([entityId])
  let cursor: string | null | undefined = parentId
  while (cursor) {
    if (visited.has(cursor)) {
      throw new ValidationError('Account hierarchy cannot contain circular references')
    }
    visited.add(cursor)
    const parent = await loadParent(cursor)
    if (!parent) break
    cursor = parent[parentField] ?? null
  }
}

export async function assertHierarchyDepth(
  parentId: string | null | undefined,
  loadParent: (id: string) => Promise<{ id: string; parentAccountId?: string | null; parentId?: string | null; level?: number } | null>,
  maxDepth: number,
  parentField: 'parentAccountId' | 'parentId' = 'parentAccountId',
): Promise<number> {
  if (!parentId) return 1
  let depth = 1
  let cursor: string | null | undefined = parentId
  while (cursor) {
    depth += 1
    if (depth > maxDepth) {
      throw new ValidationError(`Maximum hierarchy depth of ${maxDepth} exceeded`)
    }
    const parent = await loadParent(cursor)
    if (!parent) break
    if (parent.level != null && parent.level >= maxDepth) {
      throw new ValidationError(`Maximum hierarchy depth of ${maxDepth} exceeded`)
    }
    cursor = parent[parentField] ?? null
  }
  return depth
}

export function assertAccountDepth(parentLevel: number | undefined, maxDepth = MAX_ACCOUNT_DEPTH): number {
  const level = (parentLevel ?? 0) + 1
  if (level > maxDepth) {
    throw new ValidationError(`Maximum account hierarchy depth of ${maxDepth} exceeded`)
  }
  return level
}

export function assertCostCentreDepth(parentLevel: number | undefined, maxDepth = MAX_COST_CENTRE_DEPTH): number {
  const level = (parentLevel ?? 0) + 1
  if (level > maxDepth) {
    throw new ValidationError(`Maximum cost centre hierarchy depth of ${maxDepth} exceeded`)
  }
  return level
}

export function assertAccountForMapping(account: Account): void {
  if (account.isGroup) {
    throw new ValidationError('A group account cannot be selected for posting')
  }
  if (!account.isActive) {
    throw new ValidationError('Inactive accounts cannot be mapped')
  }
}

export function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError('Invalid date value')
  }
  return d
}

/** UTC calendar date as YYYY-MM-DD (API / NIC payload dates). */
export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** Calendar date YYYY-MM-DD in a tenant / legal-entity timezone (default Asia/Kolkata). */
export function getTodayInTimezone(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export function monthName(date: Date): string {
  return date.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

export function generateMonthlyPeriodDefs(startDate: Date, endDate: Date): Array<{
  periodNumber: number
  name: string
  startDate: Date
  endDate: Date
}> {
  const periods: Array<{ periodNumber: number; name: string; startDate: Date; endDate: Date }> = []
  let cursor = new Date(startDate)
  for (let i = 1; i <= 12; i += 1) {
    const periodStart = new Date(cursor)
    let periodEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    if (i === 12) {
      periodEnd = new Date(endDate)
    }
    if (periodEnd > endDate) periodEnd = new Date(endDate)
    periods.push({
      periodNumber: i,
      name: monthName(periodStart),
      startDate: periodStart,
      endDate: periodEnd,
    })
    cursor = new Date(periodEnd)
    cursor.setDate(cursor.getDate() + 1)
  }
  return periods
}

export function assertFyDateOrder(startDate: Date, endDate: Date): void {
  if (startDate >= endDate) {
    throw new ValidationError('Financial year start date must be before end date')
  }
}

export function assertPeriodInYear(
  periodStart: Date,
  periodEnd: Date,
  fyStart: Date,
  fyEnd: Date,
): void {
  if (periodStart < fyStart || periodEnd > fyEnd || periodStart >= periodEnd) {
    throw new ValidationError('Accounting period must remain inside the financial year')
  }
}

export async function unsetOtherDefaults(
  tenantId: string,
  legalEntityId: string | null,
  table: 'legalEntity' | 'branch',
  excludeId: string,
): Promise<void> {
  if (table === 'legalEntity') {
    await prisma.legalEntity.updateMany({
      where: { tenantId, isDefault: true, id: { not: excludeId } },
      data: { isDefault: false },
    })
    return
  }
  await prisma.branch.updateMany({
    where: { tenantId, legalEntityId: legalEntityId!, isDefault: true, id: { not: excludeId } },
    data: { isDefault: false },
  })
}

export async function unsetOtherHeadOffices(
  tenantId: string,
  legalEntityId: string,
  excludeId: string,
): Promise<void> {
  await prisma.branch.updateMany({
    where: { tenantId, legalEntityId, isHeadOffice: true, id: { not: excludeId } },
    data: { isHeadOffice: false },
  })
}

export async function unsetOtherCurrentFy(
  tenantId: string,
  legalEntityId: string,
  excludeId: string,
): Promise<void> {
  await prisma.financialYear.updateMany({
    where: { tenantId, legalEntityId, isCurrent: true, id: { not: excludeId } },
    data: { isCurrent: false },
  })
}

export function requireActiveState(isActive: boolean, label: string): void {
  if (!isActive) throw new InvalidStateError(`${label} is not active`)
}
