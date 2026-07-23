/**
 * ManufacturingAccountingReadinessService — consolidated enablement readiness.
 * Read-only: no posting, no feature-flag mutation.
 */
import { getManufacturingAccountingReadiness } from '../costing/accounting-readiness.service.js'
import { getManufacturingAccountingGateStatus } from './manufacturing-accounting-gate.service.js'
import { prisma } from '../../../config/database.js'

export type NextActionCode =
  | 'CONFIGURE_ACCOUNT_MAPPINGS'
  | 'OPEN_ACCOUNTING_PERIOD'
  | 'RESOLVE_FAILED_EVENTS'
  | 'RESOLVE_UNRECONCILED_EVENTS'
  | 'COMPLETE_INVENTORY_SIGNOFF'
  | 'COMPLETE_FINANCE_SIGNOFF'
  | 'ENABLE_MANUFACTURING_ACCOUNTING'
  | 'NONE'

const NEXT_ACTION_LABELS: Record<NextActionCode, string> = {
  CONFIGURE_ACCOUNT_MAPPINGS: 'Configure Missing Accounts',
  OPEN_ACCOUNTING_PERIOD: 'Open Accounting Period',
  RESOLVE_FAILED_EVENTS: 'Resolve Failed Events',
  RESOLVE_UNRECONCILED_EVENTS: 'Reconcile Inventory / Accounting Exceptions',
  COMPLETE_INVENTORY_SIGNOFF: 'Complete Inventory Reconciliation Sign-Off',
  COMPLETE_FINANCE_SIGNOFF: 'Complete Finance Pilot Sign-Off',
  ENABLE_MANUFACTURING_ACCOUNTING: 'Enable Manufacturing Accounting',
  NONE: 'No action required',
}

function deriveNextAction(blockingCodes: string[], canEnable: boolean, enabled: boolean): {
  code: NextActionCode
  label: string
} {
  if (enabled) return { code: 'NONE', label: NEXT_ACTION_LABELS.NONE }
  const priority: Array<{ match: (c: string) => boolean; code: NextActionCode }> = [
    {
      match: (c) =>
        c === 'MISSING_ACCOUNT_MAPPINGS' ||
        c.endsWith('_ACCOUNT_NOT_CONFIGURED') ||
        c.startsWith('MAPPING_'),
      code: 'CONFIGURE_ACCOUNT_MAPPINGS',
    },
    { match: (c) => c === 'NO_OPEN_ACCOUNTING_PERIOD', code: 'OPEN_ACCOUNTING_PERIOD' },
    { match: (c) => c === 'FAILED_ACCOUNTING_EVENTS', code: 'RESOLVE_FAILED_EVENTS' },
    {
      match: (c) => c === 'INVENTORY_POSTINGS_UNRECONCILED' || c === 'UNRECONCILED_ACCOUNTING_EVENTS',
      code: 'RESOLVE_UNRECONCILED_EVENTS',
    },
    { match: (c) => c === 'INVENTORY_RECONCILE_NOT_SIGNED_OFF', code: 'COMPLETE_INVENTORY_SIGNOFF' },
    { match: (c) => c === 'PILOT_FINANCE_SIGNOFF_REQUIRED', code: 'COMPLETE_FINANCE_SIGNOFF' },
  ]
  for (const rule of priority) {
    if (blockingCodes.some(rule.match)) {
      return { code: rule.code, label: NEXT_ACTION_LABELS[rule.code] }
    }
  }
  if (canEnable) {
    return {
      code: 'ENABLE_MANUFACTURING_ACCOUNTING',
      label: NEXT_ACTION_LABELS.ENABLE_MANUFACTURING_ACCOUNTING,
    }
  }
  return { code: 'NONE', label: NEXT_ACTION_LABELS.NONE }
}

export async function getReadiness(args: {
  tenantId: string
  legalEntityId?: string | null
  postingDate?: string | Date | null
  userId?: string | null
  includeTechnicalDetails?: boolean
}) {
  const gate = await getManufacturingAccountingGateStatus(args.tenantId, args.legalEntityId ?? undefined)
  const base = await getManufacturingAccountingReadiness(
    args.tenantId,
    undefined,
    gate.legalEntityId ?? args.legalEntityId ?? undefined,
    args.postingDate,
    { includeTechnicalDetails: args.includeTechnicalDetails === true },
  )

  const enablementIgnored = new Set(['MANUFACTURING_ACCOUNTING_FLAG_DISABLED'])
  const blockingCodes = base.blockers.filter((b) => !enablementIgnored.has(b))
  const canEnable = Boolean(base.enablementChecks?.canEnable)
  const nextAction = deriveNextAction(blockingCodes, canEnable, gate.enabled)

  const signOffRows = gate.legalEntityId
    ? await prisma.manufacturingAccountingSignOff.findMany({
        where: { tenantId: args.tenantId, legalEntityId: gate.legalEntityId },
        orderBy: { confirmedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          signOffType: true,
          status: true,
          confirmedById: true,
          confirmedAt: true,
          remarks: true,
        },
      })
    : []

  const missingMappings = base.mappingKeys.missing
  // Product alias for UI examples (SCRAP_EXPENSE → SCRAP_LOSS already in missing as enum key)
  const checks = {
    accountMappings: {
      passed: Boolean(base.enablementChecks?.accountMappingsReady),
      missingMappings,
      present: base.mappingKeys.present,
      required: base.mappingKeys.required,
      core: base.mappingKeys.core,
      conditional: base.mappingKeys.conditional,
    },
    openFinancialPeriod: {
      passed: Boolean(base.enablementChecks?.openFinancialPeriodExists),
      periodId: base.openPeriod?.id ?? null,
      periodCode: base.openPeriod?.code ?? null,
      periodStatus: base.openPeriod?.status ?? null,
      periodStart: base.openPeriod?.startDate ?? null,
      periodEnd: base.openPeriod?.endDate ?? null,
      postingDate: base.postingDateChecked,
    },
    failedAccountingEvents: {
      passed: (base.failedEventCount ?? 0) === 0,
      failedCount: base.failedEventCount ?? 0,
    },
    unreconciledAccountingEvents: {
      passed: (base.inventoryPostingsUnreconciledCount ?? 0) === 0,
      unreconciledCount: base.inventoryPostingsUnreconciledCount ?? 0,
    },
    inventoryReconciliation: {
      passed: Boolean(base.enablementChecks?.inventoryReconcileConfirmed),
      confirmedBy: base.signOffSnapshot?.inventoryReconcile?.confirmedBy ?? null,
      confirmedAt: base.signOffSnapshot?.inventoryReconcile?.confirmedAt ?? null,
      remarks: base.signOffSnapshot?.inventoryReconcile?.remarks ?? null,
      scope: base.signOffSnapshot?.inventoryReconcile?.scope ?? null,
    },
    pilotFinanceSignOff: {
      passed: Boolean(base.enablementChecks?.pilotSignOff),
      signedOffBy: base.signOffSnapshot?.pilotFinance?.signedOffBy ?? null,
      signedOffAt: base.signOffSnapshot?.pilotFinance?.signedOffAt ?? null,
      remarks: base.signOffSnapshot?.pilotFinance?.remarks ?? null,
      scope: base.signOffSnapshot?.pilotFinance?.scope ?? null,
    },
  }

  const control = gate.legalEntityId
    ? await prisma.financeFeatureControl.findFirst({
        where: {
          tenantId: args.tenantId,
          legalEntityId: gate.legalEntityId,
          featureKey: 'MANUFACTURING_ACCOUNTING',
        },
      })
    : null
  const config =
    control?.configurationJson && typeof control.configurationJson === 'object' && !Array.isArray(control.configurationJson)
      ? (control.configurationJson as Record<string, unknown>)
      : {}

  return {
    ready: blockingCodes.length === 0 && gate.enabled,
    canEnable,
    legalEntityId: gate.legalEntityId,
    postingDateChecked: base.postingDateChecked,
    featureFlag: {
      enabled: gate.enabled,
      reason: gate.reason,
      enabledBy: (config.enabledBy as string | undefined) ?? null,
      enabledAt: (config.enabledAt as string | undefined) ?? null,
      disabledBy: (config.disabledBy as string | undefined) ?? null,
      disabledAt: (config.disabledAt as string | undefined) ?? null,
      activationNote: (config.activationNote as string | undefined) ?? null,
      configurationVersion: Number(config.configurationVersion ?? 0),
      pilotScope: config.pilotScope ?? null,
    },
    checks,
    blockingCodes,
    blockers: blockingCodes,
    nextAction,
    allowedActions: {
      ...base.allowedActions,
      enable: canEnable && !gate.enabled,
      disable: gate.enabled,
      inventorySignOff: Boolean(gate.legalEntityId),
      financeSignOff: Boolean(gate.legalEntityId),
    },
    signOffHistorySummary: signOffRows.map((row) => ({
      id: row.id,
      signOffType: row.signOffType,
      status: row.status,
      confirmedById: row.confirmedById,
      confirmedAt: row.confirmedAt.toISOString(),
      remarks: row.remarks,
    })),
    /** Full legacy readiness payload for workspace compatibility. */
    readiness: base,
    eventIntegrity: base.eventIntegrity,
    requestedBy: args.userId ?? null,
  }
}

/** @deprecated alias — prefer getReadiness */
export const ManufacturingAccountingReadinessService = { getReadiness }
