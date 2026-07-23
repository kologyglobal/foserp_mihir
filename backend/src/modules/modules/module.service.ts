import { prisma } from '../../config/database.js'
import { createAuditLog } from '../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../utils/errors.js'
import { getModuleDef, TENANT_MODULE_CATALOG } from './module-catalog.js'
import type { SetModuleFlagInput } from './module.validation.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export type ModuleStatusRow = {
  key: string
  name: string
  description: string
  dependsOn: string[]
  alwaysOn: boolean
  isEnabled: boolean
  /** Explicit row exists in DB */
  configured: boolean
  blockedBy: string[]
}

/**
 * Fail-open: no flag row ⇒ enabled.
 */
export async function isModuleEnabled(tenantId: string, moduleKey: string): Promise<boolean> {
  const def = getModuleDef(moduleKey)
  if (!def) return true
  if (def.alwaysOn) return true
  const row = await prisma.tenantModuleFlag.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
  })
  if (!row) return true
  return row.isEnabled
}

export async function getEnabledModuleKeys(tenantId: string): Promise<string[]> {
  const flags = await prisma.tenantModuleFlag.findMany({
    where: { tenantId, isEnabled: false },
    select: { moduleKey: true },
  })
  const disabled = new Set(flags.map((f) => f.moduleKey))
  return TENANT_MODULE_CATALOG.filter((m) => m.alwaysOn || !disabled.has(m.key)).map((m) => m.key)
}

async function loadFlagMap(tenantId: string) {
  const rows = await prisma.tenantModuleFlag.findMany({ where: { tenantId } })
  return new Map(rows.map((r) => [r.moduleKey, r]))
}

function effectiveEnabled(
  key: string,
  flagMap: Map<string, { isEnabled: boolean }>,
): boolean {
  const def = getModuleDef(key)
  if (def?.alwaysOn) return true
  const row = flagMap.get(key)
  if (!row) return true
  return row.isEnabled
}

export async function listModuleStatus(tenantId: string): Promise<{
  modules: ModuleStatusRow[]
  enabledKeys: string[]
}> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } })
  if (!tenant) throw new NotFoundError('Tenant not found')

  const flagMap = await loadFlagMap(tenantId)
  const modules: ModuleStatusRow[] = TENANT_MODULE_CATALOG.map((def) => {
    const isEnabled = effectiveEnabled(def.key, flagMap)
    const blockedBy = def.dependsOn.filter((dep) => !effectiveEnabled(dep, flagMap))
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      dependsOn: def.dependsOn,
      alwaysOn: Boolean(def.alwaysOn),
      isEnabled,
      configured: flagMap.has(def.key),
      blockedBy,
    }
  })

  return {
    modules,
    enabledKeys: modules.filter((m) => m.isEnabled).map((m) => m.key),
  }
}

export async function setModuleFlag(
  tenantId: string,
  moduleKey: string,
  input: SetModuleFlagInput,
  audit?: AuditMeta,
): Promise<ModuleStatusRow> {
  const def = getModuleDef(moduleKey)
  if (!def) throw new NotFoundError(`Unknown module: ${moduleKey}`)
  if (def.alwaysOn && !input.isEnabled) {
    throw new ValidationError(`${def.name} cannot be disabled`)
  }

  const flagMap = await loadFlagMap(tenantId)

  if (input.isEnabled) {
    const missing = def.dependsOn.filter((dep) => !effectiveEnabled(dep, flagMap))
    if (missing.length) {
      throw new ValidationError(
        `Enable dependencies first: ${missing.join(', ')}`,
        missing.map((m) => ({ field: 'dependsOn', message: m })),
      )
    }
  } else {
    // Block disable when dependents are still enabled
    const dependents = TENANT_MODULE_CATALOG.filter(
      (m) => m.dependsOn.includes(moduleKey) && effectiveEnabled(m.key, flagMap),
    )
    if (dependents.length) {
      throw new ValidationError(
        `Disable dependents first: ${dependents.map((d) => d.key).join(', ')}`,
        dependents.map((d) => ({ field: 'dependents', message: d.key })),
      )
    }
  }

  const existing = await prisma.tenantModuleFlag.findUnique({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
  })

  if (existing) {
    await prisma.tenantModuleFlag.update({
      where: { id: existing.id },
      data: { isEnabled: input.isEnabled, updatedBy: audit?.userId },
    })
  } else {
    await prisma.tenantModuleFlag.create({
      data: {
        tenantId,
        moduleKey,
        isEnabled: input.isEnabled,
        updatedBy: audit?.userId,
      },
    })
  }

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'module',
    entity: 'TenantModuleFlag',
    entityId: moduleKey,
    action: 'UPDATE',
    newValues: { moduleKey, isEnabled: input.isEnabled },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  const status = await listModuleStatus(tenantId)
  const row = status.modules.find((m) => m.key === moduleKey)
  if (!row) throw new NotFoundError('Module status not found after update')
  return row
}
