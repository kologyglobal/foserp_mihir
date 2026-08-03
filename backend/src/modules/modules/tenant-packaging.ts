/**
 * Tenant product packaging — SERVICES vs MANUFACTURING.
 * Driven by Tenant.businessType + TenantModuleFlag. Never branch on tenantSlug.
 */

import { prisma } from '../../config/database.js'
import { TENANT_MODULE_CATALOG } from './module-catalog.js'

export type TenantBusinessType = 'MANUFACTURING' | 'SERVICES'

/** Catalog keys enabled for a SERVICES tenant (Bank & Cash lives under accounting). */
export const SERVICES_ENABLED_MODULES = [
  'masters',
  'crm',
  'accounting',
  'reports',
  'knowledge',
] as const

/** Catalog keys explicitly disabled for SERVICES. */
export const SERVICES_DISABLED_MODULES = [
  'purchase',
  'inventory',
  'manufacturing',
  'quality',
  'dispatch',
  'logistics',
  'gate',
] as const

export const SERVICES_DISPLAY_TERMINOLOGY: Record<string, string> = {
  product: 'Service',
  products: 'Services',
  productLine: 'Service Line',
  productDescription: 'Service Description',
  item: 'Service',
  items: 'Services',
  deliveryDate: 'Service Start / Delivery Date',
}

/**
 * Apply module flags for a SERVICES tenant. Fail-closed for manufacturing stack.
 * Idempotent upsert.
 */
export async function applyServicesModulePack(tenantId: string): Promise<void> {
  const catalogKeys = new Set(TENANT_MODULE_CATALOG.map((m) => m.key))
  for (const key of SERVICES_ENABLED_MODULES) {
    if (!catalogKeys.has(key)) continue
    await prisma.tenantModuleFlag.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: key } },
      create: { tenantId, moduleKey: key, isEnabled: true },
      update: { isEnabled: true },
    })
  }
  for (const key of SERVICES_DISABLED_MODULES) {
    if (!catalogKeys.has(key)) continue
    await prisma.tenantModuleFlag.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: key } },
      create: { tenantId, moduleKey: key, isEnabled: false },
      update: { isEnabled: false },
    })
  }
}

export function isServicesBusinessType(businessType: string | null | undefined): boolean {
  return businessType === 'SERVICES'
}
