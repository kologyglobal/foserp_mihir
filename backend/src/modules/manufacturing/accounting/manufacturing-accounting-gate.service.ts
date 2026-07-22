import { prisma } from '../../../config/database.js'

/** True when MANUFACTURING_ACCOUNTING is enabled for the legal entity (default off). */
export async function isManufacturingAccountingEnabled(
  tenantId: string,
  legalEntityId: string,
): Promise<boolean> {
  const feature = await prisma.financeFeatureControl.findFirst({
    where: { tenantId, legalEntityId, featureKey: 'MANUFACTURING_ACCOUNTING', isEnabled: true },
  })
  return feature != null
}

/** Prefer default active LE, else first active LE for the tenant. */
export async function resolveManufacturingLegalEntityId(tenantId: string): Promise<string | null> {
  const def = await prisma.legalEntity.findFirst({
    where: { tenantId, isDefault: true, isActive: true },
    select: { id: true },
  })
  if (def) return def.id
  const any = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return any?.id ?? null
}

export async function getManufacturingAccountingGateStatus(tenantId: string, legalEntityId?: string) {
  const resolvedId = legalEntityId ?? (await resolveManufacturingLegalEntityId(tenantId))
  if (!resolvedId) {
    return {
      legalEntityId: null,
      enabled: false,
      reason: 'NO_LEGAL_ENTITY' as const,
    }
  }
  const enabled = await isManufacturingAccountingEnabled(tenantId, resolvedId)
  return {
    legalEntityId: resolvedId,
    enabled,
    reason: enabled ? ('ENABLED' as const) : ('FLAG_OFF' as const),
  }
}
