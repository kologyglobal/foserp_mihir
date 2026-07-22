import type { DefaultAccountMappingKey } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getManufacturingAccountingGateStatus } from '../accounting/manufacturing-accounting-gate.service.js'

export const REQUIRED_MANUFACTURING_MAPPING_KEYS: DefaultAccountMappingKey[] = [
  'RAW_MATERIAL_INVENTORY',
  'WIP_INVENTORY',
  'FINISHED_GOODS_INVENTORY',
  'LABOUR_ABSORPTION',
  'MACHINE_ABSORPTION',
  'JOB_WORK_ABSORPTION',
  'PRODUCTION_OVERHEAD_ABSORPTION',
  'PRODUCTION_VARIANCE',
  'SCRAP_LOSS',
]

export async function getManufacturingAccountingReadiness(
  tenantId: string,
  workOrderId?: string,
  legalEntityId?: string,
) {
  const gate = await getManufacturingAccountingGateStatus(tenantId, legalEntityId)
  const blockers: string[] = []
  const warnings: string[] = []
  if (!gate.legalEntityId) blockers.push('NO_LEGAL_ENTITY')
  if (!gate.enabled) blockers.push('MANUFACTURING_ACCOUNTING_FLAG_DISABLED')

  const mappings = gate.legalEntityId
    ? await prisma.defaultAccountMapping.findMany({
        where: { tenantId, legalEntityId: gate.legalEntityId, mappingKey: { in: REQUIRED_MANUFACTURING_MAPPING_KEYS } },
        select: { mappingKey: true },
      })
    : []
  const present = new Set(mappings.map((mapping) => mapping.mappingKey))
  const missingMappingKeys = REQUIRED_MANUFACTURING_MAPPING_KEYS.filter((key) => !present.has(key))
  if (missingMappingKeys.length) blockers.push('MISSING_ACCOUNT_MAPPINGS')

  const now = new Date()
  const openPeriod = gate.legalEntityId
    ? await prisma.accountingPeriod.findFirst({
        where: {
          tenantId,
          legalEntityId: gate.legalEntityId,
          status: 'OPEN',
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: { id: true, name: true, startDate: true, endDate: true },
      })
    : null
  if (!openPeriod) blockers.push('NO_OPEN_ACCOUNTING_PERIOD')

  const eventWhere = { tenantId, ...(workOrderId ? { productionOrderId: workOrderId } : {}) }
  const [pendingEventCount, failedEventCount, provisionalCostCount] = await Promise.all([
    prisma.productionAccountingEvent.count({ where: { ...eventWhere, status: 'RECORDED' } }),
    prisma.productionAccountingEvent.count({ where: { ...eventWhere, status: 'FAILED' } }),
    prisma.workOrderCostSnapshot.count({
      where: { tenantId, ...(workOrderId ? { productionOrderId: workOrderId } : {}), provisionalCost: { gt: 0 } },
    }),
  ])
  if (failedEventCount) blockers.push('FAILED_ACCOUNTING_EVENTS')
  if (provisionalCostCount) warnings.push('PROVISIONAL_COST_PRESENT')

  return {
    ready: blockers.length === 0,
    costingEnabled: true,
    accountingFlag: gate,
    legalEntityId: gate.legalEntityId,
    mappingKeys: { required: REQUIRED_MANUFACTURING_MAPPING_KEYS, present: [...present], missing: missingMappingKeys },
    openPeriod,
    pendingEventCount,
    failedEventCount,
    provisionalCostCount,
    blockers,
    warnings,
    allowedActions: {
      validate: Boolean(gate.legalEntityId),
      post: blockers.length === 0,
      retry: gate.enabled && failedEventCount > 0,
      financialClose: blockers.length === 0 && failedEventCount === 0,
    },
  }
}
