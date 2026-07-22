/**
 * Payment terms — CRM masters kind `payment-terms` + day overrides.
 * No MasterPaymentTerm Prisma model.
 */
import { prisma } from '../../../../config/database.js'

export interface AccountingPaymentTermsLookup {
  id: string
  code: string
  name: string
  creditDays: number | null
  attributes: Record<string, unknown> | null
  isActive: boolean
}

function creditDaysFromAttributes(attributes: unknown): number | null {
  if (!attributes || typeof attributes !== 'object') return null
  const days = (attributes as Record<string, unknown>).creditDays
  return typeof days === 'number' && Number.isFinite(days) ? days : null
}

export async function resolvePaymentTermsByCode(
  tenantId: string,
  code: string,
): Promise<AccountingPaymentTermsLookup | null> {
  const row = await prisma.crmMaster.findFirst({
    where: {
      tenantId,
      kind: 'payment-terms',
      code,
      deletedAt: null,
    },
  })
  if (!row) return null
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    creditDays: creditDaysFromAttributes(row.attributes),
    attributes: (row.attributes as Record<string, unknown> | null) ?? null,
    isActive: row.status === 'active',
  }
}

export async function listPaymentTerms(
  tenantId: string,
  search?: string,
): Promise<AccountingPaymentTermsLookup[]> {
  const rows = await prisma.crmMaster.findMany({
    where: {
      tenantId,
      kind: 'payment-terms',
      deletedAt: null,
      status: 'active',
      ...(search
        ? {
            OR: [{ code: { contains: search } }, { name: { contains: search } }],
          }
        : {}),
    },
    orderBy: { code: 'asc' },
    take: 100,
  })
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    creditDays: creditDaysFromAttributes(row.attributes),
    attributes: (row.attributes as Record<string, unknown> | null) ?? null,
    isActive: row.status === 'active',
  }))
}

/** Prefer explicit days; else CRM master creditDays; else null. */
export function resolvePaymentTermsDays(opts: {
  explicitDays?: number | null
  master?: AccountingPaymentTermsLookup | null
}): number | null {
  if (opts.explicitDays != null) return opts.explicitDays
  return opts.master?.creditDays ?? null
}
