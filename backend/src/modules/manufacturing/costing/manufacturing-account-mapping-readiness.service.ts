/**
 * Manufacturing account-mapping readiness — uses finance DefaultAccountMapping only (ADR-039).
 * Product aliases (DIRECT_LABOUR_ABSORPTION, SCRAP_EXPENSE, …) resolve to existing enum keys.
 */
import type { DefaultAccountMappingKey } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { resolveCostingPolicy } from './costing-policy.service.js'

/** Always required for Manufacturing Accounting enablement / posting. */
export const CORE_MANUFACTURING_MAPPING_KEYS: DefaultAccountMappingKey[] = [
  'WIP_INVENTORY',
  'FINISHED_GOODS_INVENTORY',
  'PRODUCTION_VARIANCE',
]

/** Aliases used in product / UAT language → real enum keys (no parallel tables). */
export const PRODUCT_ALIAS_TO_MAPPING_KEY: Record<string, DefaultAccountMappingKey | null> = {
  WIP_INVENTORY: 'WIP_INVENTORY',
  FINISHED_GOODS_INVENTORY: 'FINISHED_GOODS_INVENTORY',
  PRODUCTION_VARIANCE: 'PRODUCTION_VARIANCE',
  RAW_MATERIAL_INVENTORY: 'RAW_MATERIAL_INVENTORY',
  MATERIAL_CONSUMPTION: 'MATERIAL_CONSUMPTION',
  DIRECT_LABOUR_ABSORPTION: 'LABOUR_ABSORPTION',
  MACHINE_COST_ABSORPTION: 'MACHINE_ABSORPTION',
  JOB_WORK_COST: 'JOB_WORK_ABSORPTION',
  MANUFACTURING_OVERHEAD: 'PRODUCTION_OVERHEAD_ABSORPTION',
  SCRAP_EXPENSE: 'SCRAP_LOSS',
  /** No dedicated DefaultAccountMappingKey — rework posts via variance / operational cost only. */
  REWORK_COST: null,
  /** No PRODUCTION_CLEARING key in finance enum — not validated. */
  PRODUCTION_CLEARING: null,
  WIP_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  /** FG capitalisation uses FINISHED_GOODS_INVENTORY (core). */
  FG_CAPITALISATION: 'FINISHED_GOODS_INVENTORY',
}

const KEY_BLOCKER: Partial<Record<DefaultAccountMappingKey, string>> = {
  WIP_INVENTORY: 'WIP_ACCOUNT_NOT_CONFIGURED',
  FINISHED_GOODS_INVENTORY: 'FINISHED_GOODS_ACCOUNT_NOT_CONFIGURED',
  PRODUCTION_VARIANCE: 'PRODUCTION_VARIANCE_ACCOUNT_NOT_CONFIGURED',
  LABOUR_ABSORPTION: 'LABOUR_ACCOUNT_NOT_CONFIGURED',
  MACHINE_ABSORPTION: 'MACHINE_ACCOUNT_NOT_CONFIGURED',
  JOB_WORK_ABSORPTION: 'JOB_WORK_ACCOUNT_NOT_CONFIGURED',
  PRODUCTION_OVERHEAD_ABSORPTION: 'OVERHEAD_ACCOUNT_NOT_CONFIGURED',
  SCRAP_LOSS: 'SCRAP_ACCOUNT_NOT_CONFIGURED',
}

export type MappingValidationIssue = {
  mappingKey: DefaultAccountMappingKey
  code: string
  message: string
}

export type ManufacturingMappingReadiness = {
  requiredKeys: DefaultAccountMappingKey[]
  coreKeys: DefaultAccountMappingKey[]
  conditionalKeys: DefaultAccountMappingKey[]
  conditionalEnabled: Record<string, boolean>
  present: DefaultAccountMappingKey[]
  missing: DefaultAccountMappingKey[]
  invalid: MappingValidationIssue[]
  blockers: string[]
  accountMappingsReady: boolean
  checklist: {
    wipConfigured: boolean
    finishedGoodsConfigured: boolean
    productionVarianceConfigured: boolean
    rawMaterialConfigured: boolean
    labourConfigured: boolean
    machineConfigured: boolean
    jobWorkConfigured: boolean
    overheadConfigured: boolean
    scrapConfigured: boolean
  }
}

type MappingRow = {
  id: string
  mappingKey: DefaultAccountMappingKey
  accountId: string
  account: {
    id: string
    tenantId: string
    legalEntityId: string
    isActive: boolean
    isGroup: boolean
    allowManualPosting: boolean
  } | null
}

function uniqueKeys(keys: DefaultAccountMappingKey[]): DefaultAccountMappingKey[] {
  return [...new Set(keys)]
}

/**
 * Which conditional cost/event mappings are in scope for this tenant.
 * Driven by active costing policy (and built-in defaults). No new feature tables.
 */
export async function resolveConditionalMappingRequirements(
  tenantId: string,
): Promise<{ keys: DefaultAccountMappingKey[]; enabled: Record<string, boolean> }> {
  const policy = await resolveCostingPolicy(tenantId, null)
  const overheadOn = policy.overheadMethod !== 'NONE'

  const enabled: Record<string, boolean> = {
    RAW_MATERIAL_INVENTORY: true,
    MATERIAL_CONSUMPTION: false,
    LABOUR_ABSORPTION: true,
    MACHINE_ABSORPTION: true,
    JOB_WORK_ABSORPTION: true,
    PRODUCTION_OVERHEAD_ABSORPTION: overheadOn,
    SCRAP_LOSS: true,
    STOCK_ADJUSTMENT: false,
    REWORK_COST: false,
    PRODUCTION_CLEARING: false,
    FG_CAPITALISATION: true,
  }

  const keys: DefaultAccountMappingKey[] = []
  if (enabled.RAW_MATERIAL_INVENTORY) keys.push('RAW_MATERIAL_INVENTORY')
  if (enabled.MATERIAL_CONSUMPTION) keys.push('MATERIAL_CONSUMPTION')
  if (enabled.LABOUR_ABSORPTION) keys.push('LABOUR_ABSORPTION')
  if (enabled.MACHINE_ABSORPTION) keys.push('MACHINE_ABSORPTION')
  if (enabled.JOB_WORK_ABSORPTION) keys.push('JOB_WORK_ABSORPTION')
  if (enabled.PRODUCTION_OVERHEAD_ABSORPTION) keys.push('PRODUCTION_OVERHEAD_ABSORPTION')
  if (enabled.SCRAP_LOSS) keys.push('SCRAP_LOSS')
  if (enabled.STOCK_ADJUSTMENT) keys.push('STOCK_ADJUSTMENT')

  return { keys: uniqueKeys(keys), enabled }
}

function validateMappedAccount(
  mappingKey: DefaultAccountMappingKey,
  row: MappingRow | undefined,
  tenantId: string,
  legalEntityId: string,
): MappingValidationIssue | null {
  if (!row) {
    return {
      mappingKey,
      code: KEY_BLOCKER[mappingKey] ?? 'MISSING_ACCOUNT_MAPPINGS',
      message: `Mapping ${mappingKey} is not configured`,
    }
  }
  const account = row.account
  if (!account) {
    return {
      mappingKey,
      code: KEY_BLOCKER[mappingKey] ?? 'MISSING_ACCOUNT_MAPPINGS',
      message: `Mapping ${mappingKey} has no linked account`,
    }
  }
  if (account.tenantId !== tenantId || account.legalEntityId !== legalEntityId) {
    return {
      mappingKey,
      code: 'MAPPING_ACCOUNT_WRONG_SCOPE',
      message: `Account for ${mappingKey} does not belong to the current tenant/legal entity`,
    }
  }
  if (!account.isActive) {
    return {
      mappingKey,
      code: 'MAPPING_ACCOUNT_INACTIVE',
      message: `Account for ${mappingKey} is inactive / blocked for posting`,
    }
  }
  if (account.isGroup) {
    return {
      mappingKey,
      code: 'MAPPING_ACCOUNT_NOT_POSTABLE',
      message: `Account for ${mappingKey} is a group account and cannot be posted`,
    }
  }
  return null
}

/**
 * Full mapping readiness for a legal entity: core + conditional keys, account quality, missing list.
 */
export async function validateManufacturingAccountMappings(
  tenantId: string,
  legalEntityId: string,
): Promise<ManufacturingMappingReadiness> {
  const conditional = await resolveConditionalMappingRequirements(tenantId)
  const requiredKeys = uniqueKeys([...CORE_MANUFACTURING_MAPPING_KEYS, ...conditional.keys])

  const rows = (await prisma.defaultAccountMapping.findMany({
    where: {
      tenantId,
      legalEntityId,
      mappingKey: { in: requiredKeys },
    },
    include: {
      account: {
        select: {
          id: true,
          tenantId: true,
          legalEntityId: true,
          isActive: true,
          isGroup: true,
          allowManualPosting: true,
        },
      },
    },
  })) as MappingRow[]

  const byKey = new Map<DefaultAccountMappingKey, MappingRow[]>()
  for (const row of rows) {
    const list = byKey.get(row.mappingKey) ?? []
    list.push(row)
    byKey.set(row.mappingKey, list)
  }

  const blockers: string[] = []
  const invalid: MappingValidationIssue[] = []
  const missing: DefaultAccountMappingKey[] = []
  const present: DefaultAccountMappingKey[] = []

  for (const key of requiredKeys) {
    const list = byKey.get(key) ?? []
    if (list.length > 1) {
      invalid.push({
        mappingKey: key,
        code: 'DUPLICATE_CONFLICTING_MAPPING',
        message: `Duplicate DefaultAccountMapping rows for ${key}`,
      })
      if (!blockers.includes('DUPLICATE_CONFLICTING_MAPPING')) {
        blockers.push('DUPLICATE_CONFLICTING_MAPPING')
      }
    }
    const row = list[0]
    const issue = validateMappedAccount(key, row, tenantId, legalEntityId)
    if (issue) {
      invalid.push(issue)
      missing.push(key)
      const specific = KEY_BLOCKER[key]
      if (specific && !blockers.includes(specific)) blockers.push(specific)
    } else {
      present.push(key)
    }
  }

  if (missing.length > 0 && !blockers.includes('MISSING_ACCOUNT_MAPPINGS')) {
    blockers.push('MISSING_ACCOUNT_MAPPINGS')
  }

  for (const key of CORE_MANUFACTURING_MAPPING_KEYS) {
    if (!present.includes(key)) {
      const code = KEY_BLOCKER[key]!
      if (!blockers.includes(code)) blockers.push(code)
      if (!missing.includes(key)) missing.push(key)
    }
  }

  const accountMappingsReady =
    missing.length === 0 && !blockers.includes('DUPLICATE_CONFLICTING_MAPPING')

  return {
    requiredKeys,
    coreKeys: [...CORE_MANUFACTURING_MAPPING_KEYS],
    conditionalKeys: conditional.keys,
    conditionalEnabled: conditional.enabled,
    present,
    missing: uniqueKeys(missing),
    invalid,
    blockers: [...new Set(blockers)],
    accountMappingsReady,
    checklist: {
      wipConfigured: present.includes('WIP_INVENTORY'),
      finishedGoodsConfigured: present.includes('FINISHED_GOODS_INVENTORY'),
      productionVarianceConfigured: present.includes('PRODUCTION_VARIANCE'),
      rawMaterialConfigured:
        !conditional.enabled.RAW_MATERIAL_INVENTORY || present.includes('RAW_MATERIAL_INVENTORY'),
      labourConfigured: !conditional.enabled.LABOUR_ABSORPTION || present.includes('LABOUR_ABSORPTION'),
      machineConfigured: !conditional.enabled.MACHINE_ABSORPTION || present.includes('MACHINE_ABSORPTION'),
      jobWorkConfigured: !conditional.enabled.JOB_WORK_ABSORPTION || present.includes('JOB_WORK_ABSORPTION'),
      overheadConfigured:
        !conditional.enabled.PRODUCTION_OVERHEAD_ABSORPTION ||
        present.includes('PRODUCTION_OVERHEAD_ABSORPTION'),
      scrapConfigured: !conditional.enabled.SCRAP_LOSS || present.includes('SCRAP_LOSS'),
    },
  }
}

/** Static default required set (core + typical conditionals). Prefer validateManufacturingAccountMappings. */
export const REQUIRED_MANUFACTURING_MAPPING_KEYS: DefaultAccountMappingKey[] = [
  ...CORE_MANUFACTURING_MAPPING_KEYS,
  'RAW_MATERIAL_INVENTORY',
  'LABOUR_ABSORPTION',
  'MACHINE_ABSORPTION',
  'JOB_WORK_ABSORPTION',
  'SCRAP_LOSS',
]
