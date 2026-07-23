import { prisma } from '../../../config/database.js'
import { checkOpenAccountingPeriod } from '../../accounting/accounting-periods/accounting-period.service.js'
import { getManufacturingAccountingGateStatus } from '../accounting/manufacturing-accounting-gate.service.js'
import {
  REQUIRED_MANUFACTURING_MAPPING_KEYS,
  validateManufacturingAccountMappings,
} from './manufacturing-account-mapping-readiness.service.js'
import { inspectManufacturingAccountingEventIntegrity } from './manufacturing-accounting-event-integrity.service.js'

export {
  CORE_MANUFACTURING_MAPPING_KEYS,
  PRODUCT_ALIAS_TO_MAPPING_KEY,
  REQUIRED_MANUFACTURING_MAPPING_KEYS,
  validateManufacturingAccountMappings,
} from './manufacturing-account-mapping-readiness.service.js'

export {
  inspectManufacturingAccountingEventIntegrity,
  sanitizeFailureReason,
} from './manufacturing-accounting-event-integrity.service.js'

type SignOffConfig = {
  inventoryReconcileConfirmed?: boolean
  inventoryReconcileConfirmedAt?: string
  inventoryReconcileConfirmedBy?: string
  inventoryReconcileRemarks?: string
  inventoryReconcileScope?: unknown
  inventoryReconcileReportRef?: string
  pilotSignOff?: boolean
  pilotSignOffAt?: string
  pilotSignOffBy?: string
  pilotSignOffRemarks?: string
  pilotScope?: unknown
  signOffNote?: string
}

function readSignOffConfig(configurationJson: unknown): SignOffConfig {
  if (!configurationJson || typeof configurationJson !== 'object' || Array.isArray(configurationJson)) {
    return {}
  }
  return configurationJson as SignOffConfig
}

/**
 * Manufacturing accounting enablement / ops readiness.
 *
 * Open-period check uses `checkOpenAccountingPeriod` (Accounting Period service →
 * `resolvePeriodByDate`). Passing enablement does **not** bypass posting-time
 * validation — every mfg `post()` still runs `resolvePostingPeriod`.
 */
export async function getManufacturingAccountingReadiness(
  tenantId: string,
  workOrderId?: string,
  legalEntityId?: string,
  /** Explicit posting date (YYYY-MM-DD or Date); default = tenant timezone "today". */
  postingDate?: string | Date | null,
  options?: { includeTechnicalDetails?: boolean },
) {
  const gate = await getManufacturingAccountingGateStatus(tenantId, legalEntityId)
  const blockers: string[] = []
  const warnings: string[] = []
  if (!gate.legalEntityId) blockers.push('NO_LEGAL_ENTITY')
  if (!gate.enabled) blockers.push('MANUFACTURING_ACCOUNTING_FLAG_DISABLED')

  const mappingReadiness = gate.legalEntityId
    ? await validateManufacturingAccountMappings(tenantId, gate.legalEntityId)
    : null

  const accountMappingsReady = mappingReadiness?.accountMappingsReady ?? false
  if (mappingReadiness) {
    for (const code of mappingReadiness.blockers) {
      if (!blockers.includes(code)) blockers.push(code)
    }
  }

  const periodCheck = gate.legalEntityId
    ? await checkOpenAccountingPeriod(tenantId, gate.legalEntityId, postingDate)
    : null
  const openFinancialPeriodExists = periodCheck?.openFinancialPeriodExists ?? false
  if (!openFinancialPeriodExists) blockers.push('NO_OPEN_ACCOUNTING_PERIOD')

  const openPeriod = periodCheck?.period
    ? {
        id: periodCheck.period.id,
        code: periodCheck.period.code,
        periodNumber: periodCheck.period.periodNumber,
        name: periodCheck.period.name,
        startDate: periodCheck.period.startDate,
        endDate: periodCheck.period.endDate,
        status: periodCheck.period.status,
      }
    : null
  const postingDateChecked = periodCheck?.postingDateChecked ?? null

  const eventIntegrity = gate.legalEntityId
    ? await inspectManufacturingAccountingEventIntegrity(tenantId, gate.legalEntityId, {
        workOrderId,
        includeTechnicalDetails: options?.includeTechnicalDetails === true,
      })
    : null

  const failedEventCount = eventIntegrity?.failedAccountingEventCount ?? 0
  const unreconciledAccountingEventCount = eventIntegrity?.unreconciledAccountingEventCount ?? 0
  const inventoryPostingsUnreconciledCount = eventIntegrity?.inventoryPostingsUnreconciledCount ?? 0
  const pendingEventCount = unreconciledAccountingEventCount

  if (eventIntegrity) {
    for (const code of eventIntegrity.blockers) {
      if (!blockers.includes(code)) blockers.push(code)
    }
  }

  const provisionalCostCount = await prisma.workOrderCostSnapshot.count({
    where: {
      tenantId,
      ...(workOrderId ? { productionOrderId: workOrderId } : {}),
      provisionalCost: { gt: 0 },
    },
  })

  const control = gate.legalEntityId
    ? await prisma.financeFeatureControl.findFirst({
        where: {
          tenantId,
          legalEntityId: gate.legalEntityId,
          featureKey: 'MANUFACTURING_ACCOUNTING',
        },
        select: { configurationJson: true },
      })
    : null

  if (provisionalCostCount) warnings.push('PROVISIONAL_COST_PRESENT')

  const signOff = readSignOffConfig(control?.configurationJson)
  const inventoryReconcileConfirmed = Boolean(
    signOff.inventoryReconcileConfirmed === true || signOff.inventoryReconcileConfirmedAt,
  )
  const pilotSignOff = Boolean(signOff.pilotSignOff === true || signOff.pilotSignOffAt)
  if (!inventoryReconcileConfirmed) {
    blockers.push('INVENTORY_RECONCILE_NOT_SIGNED_OFF')
  }
  if (!pilotSignOff) {
    blockers.push('PILOT_FINANCE_SIGNOFF_REQUIRED')
  }

  const canEnable =
    accountMappingsReady &&
    openFinancialPeriodExists &&
    failedEventCount === 0 &&
    inventoryPostingsUnreconciledCount === 0 &&
    inventoryReconcileConfirmed &&
    pilotSignOff

  const missingMappingKeys = mappingReadiness?.missing ?? [...REQUIRED_MANUFACTURING_MAPPING_KEYS]
  const presentMappingKeys = mappingReadiness?.present ?? []
  const requiredMappingKeys = mappingReadiness?.requiredKeys ?? [...REQUIRED_MANUFACTURING_MAPPING_KEYS]

  return {
    ready: blockers.length === 0,
    costingEnabled: true,
    accountingFlag: gate,
    legalEntityId: gate.legalEntityId,
    mappingKeys: {
      required: requiredMappingKeys,
      core: mappingReadiness?.coreKeys ?? [],
      conditional: mappingReadiness?.conditionalKeys ?? [],
      present: presentMappingKeys,
      missing: missingMappingKeys,
      invalid: mappingReadiness?.invalid ?? [],
      conditionalEnabled: mappingReadiness?.conditionalEnabled ?? {},
    },
    enablementChecks: {
      accountMappingsReady,
      openFinancialPeriodExists,
      failedAccountingEventCount: failedEventCount,
      unreconciledAccountingEventCount,
      inventoryPostingsUnreconciledCount,
      inventoryReconcileConfirmed,
      pilotSignOff,
      canEnable,
    },
    checklist: {
      wipConfigured: mappingReadiness?.checklist.wipConfigured ?? false,
      fgConfigured: mappingReadiness?.checklist.finishedGoodsConfigured ?? false,
      finishedGoodsConfigured: mappingReadiness?.checklist.finishedGoodsConfigured ?? false,
      varianceConfigured: mappingReadiness?.checklist.productionVarianceConfigured ?? false,
      productionVarianceConfigured: mappingReadiness?.checklist.productionVarianceConfigured ?? false,
      rmConfigured: mappingReadiness?.checklist.rawMaterialConfigured ?? false,
      labourConfigured: mappingReadiness?.checklist.labourConfigured ?? false,
      machineConfigured: mappingReadiness?.checklist.machineConfigured ?? false,
      jobWorkConfigured: mappingReadiness?.checklist.jobWorkConfigured ?? false,
      overheadConfigured: mappingReadiness?.checklist.overheadConfigured ?? false,
      scrapConfigured: mappingReadiness?.checklist.scrapConfigured ?? false,
      periodOpen: openFinancialPeriodExists,
      accountMappingsReady,
      noFailedEvents: failedEventCount === 0,
      noUnreconciledEvents: inventoryPostingsUnreconciledCount === 0,
      inventoryReconcileSignedOff: inventoryReconcileConfirmed,
      pilotFinanceSignedOff: pilotSignOff,
      canEnable,
    },
    signOffSnapshot: {
      inventoryReconcile: {
        confirmed: inventoryReconcileConfirmed,
        confirmedBy: signOff.inventoryReconcileConfirmedBy ?? null,
        confirmedAt: signOff.inventoryReconcileConfirmedAt ?? null,
        remarks: signOff.inventoryReconcileRemarks ?? signOff.signOffNote ?? null,
        scope: signOff.inventoryReconcileScope ?? null,
        reportRef: signOff.inventoryReconcileReportRef ?? null,
      },
      pilotFinance: {
        confirmed: pilotSignOff,
        signedOffBy: signOff.pilotSignOffBy ?? null,
        signedOffAt: signOff.pilotSignOffAt ?? null,
        remarks: signOff.pilotSignOffRemarks ?? signOff.signOffNote ?? null,
        scope: signOff.pilotScope ?? null,
      },
    },
    openPeriod,
    postingDateChecked,
    /** @deprecated prefer postingDateChecked (YYYY-MM-DD) */
    postingDate: postingDateChecked,
    pendingEventCount,
    failedEventCount,
    unreconciledAccountingEventCount,
    inventoryPostingsUnreconciledCount,
    provisionalCostCount,
    eventIntegrity: eventIntegrity
      ? {
          counts: eventIntegrity.counts,
          exceptions: eventIntegrity.exceptions,
          ...(eventIntegrity.technicalDetails
            ? { technicalDetails: eventIntegrity.technicalDetails }
            : {}),
        }
      : {
          counts: {
            failed: 0,
            unreconciled: 0,
            retryExhausted: 0,
            inventoryMissingAccounting: 0,
            accountingMissingInventory: 0,
            reversalChainInconsistent: 0,
            duplicatePendingPosting: 0,
            totalExceptions: 0,
          },
          exceptions: [],
        },
    blockers,
    warnings,
    notes: {
      periodCheckDoesNotBypassPosting:
        'Enablement open-period check is a readiness gate only. Every manufacturing post() still validates the period via resolvePostingPeriod.',
      eventExceptionsUiSafe:
        'eventIntegrity.exceptions never includes stack traces. technicalDetails is only present when explicitly requested by an authorised caller.',
    },
    allowedActions: {
      validate: Boolean(gate.legalEntityId),
      post: blockers.length === 0,
      retry: gate.enabled && failedEventCount > 0,
      financialClose: blockers.length === 0 && failedEventCount === 0,
      enable: canEnable && !gate.enabled,
    },
  }
}
