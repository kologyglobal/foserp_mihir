import type { AccountingPeriod, AccountingVoucherStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { AppError } from '../../../utils/errors.js'
import {
  JOURNAL_SOURCE_DOCUMENT_TYPE,
  JOURNAL_SOURCE_MODULE,
} from '../journals/journal.types.js'
import { getLatestCloseGateRun } from '../payables/reconciliation/payable-close-gate-read.service.js'
import { getPeriod } from './accounting-period.repository.js'

export type CloseReadinessSeverity = 'PASS' | 'WARN' | 'BLOCK'

export type CloseReadinessCheckKey =
  | 'PERIOD_STATUS'
  | 'AP_CLOSE_GATE'
  | 'UNPOSTED_JOURNALS'
  | 'BANK_RECON'
  | 'INVENTORY_GL'
  | 'MFG_GL'

export interface CloseReadinessCheck {
  key: CloseReadinessCheckKey
  label: string
  severity: CloseReadinessSeverity
  message: string
  href?: string
  count?: number
  featureEnabled?: boolean
}

export interface CloseReadinessResult {
  periodId: string
  periodName: string
  periodStatus: string
  legalEntityId: string
  startDate: string
  endDate: string
  hardBlockEnabled: boolean
  canClose: boolean
  blockingCount: number
  warningCount: number
  unpostedJournalCount: number
  openBankReconCount: number
  checks: CloseReadinessCheck[]
  blockers: CloseReadinessCheck[]
}

const UNPOSTED_STATUSES: AccountingVoucherStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_BACK']

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function periodBounds(period: AccountingPeriod) {
  const start = new Date(period.startDate)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(period.endDate)
  end.setUTCHours(23, 59, 59, 999)
  return { start, end }
}

async function isFeatureEnabled(
  tenantId: string,
  legalEntityId: string,
  featureKey: 'INVENTORY_ACCOUNTING' | 'MANUFACTURING_ACCOUNTING',
): Promise<boolean> {
  const row = await prisma.financeFeatureControl.findFirst({
    where: { tenantId, legalEntityId, featureKey, isEnabled: true },
  })
  return row != null
}

async function countUnpostedJournals(tenantId: string, legalEntityId: string, period: AccountingPeriod) {
  const { start, end } = periodBounds(period)
  return prisma.accountingVoucher.count({
    where: {
      tenantId,
      legalEntityId,
      voucherType: 'JOURNAL',
      sourceModule: JOURNAL_SOURCE_MODULE,
      sourceDocumentType: JOURNAL_SOURCE_DOCUMENT_TYPE,
      status: { in: UNPOSTED_STATUSES },
      postingDate: { gte: start, lte: end },
    },
  })
}

async function countOpenBankRecon(tenantId: string, legalEntityId: string, period: AccountingPeriod) {
  const start = dateOnly(period.startDate)
  const end = dateOnly(period.endDate)
  const sessions = await prisma.bankReconciliationSession.findMany({
    where: {
      tenantId,
      legalEntityId,
      status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] },
    },
    select: { statementStartDate: true, statementEndDate: true },
  })
  return sessions.filter((s) => {
    const sStart = dateOnly(s.statementStartDate)
    const sEnd = dateOnly(s.statementEndDate)
    return sStart <= end && sEnd >= start
  }).length
}

export async function getCloseReadiness(tenantId: string, periodId: string): Promise<CloseReadinessResult> {
  const period = await getPeriod(tenantId, periodId)
  const settings = await prisma.financeSettings.findFirst({
    where: { tenantId, legalEntityId: period.legalEntityId },
    select: { periodCloseHardBlock: true },
  })
  const hardBlockEnabled = settings?.periodCloseHardBlock === true

  const [unpostedJournalCount, openBankReconCount, apGate, inventoryEnabled, mfgEnabled] = await Promise.all([
    countUnpostedJournals(tenantId, period.legalEntityId, period),
    countOpenBankRecon(tenantId, period.legalEntityId, period),
    getLatestCloseGateRun(tenantId, { legalEntityId: period.legalEntityId, periodId: period.id }),
    isFeatureEnabled(tenantId, period.legalEntityId, 'INVENTORY_ACCOUNTING'),
    isFeatureEnabled(tenantId, period.legalEntityId, 'MANUFACTURING_ACCOUNTING'),
  ])

  const checks: CloseReadinessCheck[] = []

  if (period.status === 'CLOSED') {
    checks.push({
      key: 'PERIOD_STATUS',
      label: 'Period status',
      severity: 'PASS',
      message: `${period.name} is CLOSED. Journal posting into this period is blocked.`,
      href: '/accounting/period-close/period-locking',
    })
  } else if (period.status === 'UNDER_REVIEW') {
    checks.push({
      key: 'PERIOD_STATUS',
      label: 'Period status',
      severity: 'WARN',
      message: `${period.name} is UNDER_REVIEW. Close when ready.`,
      href: '/accounting/period-close/period-locking',
    })
  } else {
    checks.push({
      key: 'PERIOD_STATUS',
      label: 'Period status',
      severity: 'WARN',
      message: `${period.name} is ${period.status}.`,
      href: '/accounting/period-close/period-locking',
    })
  }

  if (!apGate?.run) {
    checks.push({
      key: 'AP_CLOSE_GATE',
      label: 'AP close gate',
      severity: 'WARN',
      message: 'No AP close-gate run for this period yet. Run assessment from Money Out → Close Gate.',
      href: '/accounting/money-out/close-gate',
    })
  } else if (apGate.run.status === 'PASS') {
    checks.push({
      key: 'AP_CLOSE_GATE',
      label: 'AP close gate',
      severity: 'PASS',
      message: `Latest AP close gate: ${apGate.run.status} (${apGate.run.checksPassed}/${apGate.run.checksTotal} passed).`,
      href: '/accounting/money-out/close-gate',
    })
  } else if (apGate.run.status === 'PASS_WITH_WARNINGS') {
    checks.push({
      key: 'AP_CLOSE_GATE',
      label: 'AP close gate',
      severity: 'WARN',
      message: `Latest AP close gate: ${apGate.run.status} (${apGate.run.checksPassed}/${apGate.run.checksTotal} passed).`,
      href: '/accounting/money-out/close-gate',
    })
  } else {
    checks.push({
      key: 'AP_CLOSE_GATE',
      label: 'AP close gate',
      severity: 'BLOCK',
      message: `Latest AP close gate: ${apGate.run.status} (${apGate.run.checksPassed}/${apGate.run.checksTotal} passed).`,
      href: '/accounting/money-out/close-gate',
    })
  }

  if (unpostedJournalCount === 0) {
    checks.push({
      key: 'UNPOSTED_JOURNALS',
      label: 'Unposted journals',
      severity: 'PASS',
      message: 'No draft / pending / approved (unposted) journals in this period date range.',
      href: '/accounting/entries/journals',
      count: 0,
    })
  } else {
    checks.push({
      key: 'UNPOSTED_JOURNALS',
      label: 'Unposted journals',
      severity: 'BLOCK',
      message: `${unpostedJournalCount} unposted journal(s) with posting date in ${period.name}.`,
      href: '/accounting/entries/journals',
      count: unpostedJournalCount,
    })
  }

  if (openBankReconCount === 0) {
    checks.push({
      key: 'BANK_RECON',
      label: 'Bank reconciliation',
      severity: 'PASS',
      message: 'No open bank reconciliation sessions overlapping this period.',
      href: '/accounting/bank-cash/reconciliation',
      count: 0,
    })
  } else {
    checks.push({
      key: 'BANK_RECON',
      label: 'Bank reconciliation',
      severity: 'BLOCK',
      message: `${openBankReconCount} open bank reconciliation session(s) overlap this period.`,
      href: '/accounting/bank-cash/reconciliation',
      count: openBankReconCount,
    })
  }

  if (inventoryEnabled) {
    const [recorded, failed] = await Promise.all([
      prisma.inventoryAccountingEvent.count({
        where: { tenantId, legalEntityId: period.legalEntityId, status: 'RECORDED' },
      }),
      prisma.inventoryAccountingEvent.count({
        where: { tenantId, legalEntityId: period.legalEntityId, status: 'FAILED' },
      }),
    ])
    const problem = recorded + failed
    checks.push({
      key: 'INVENTORY_GL',
      label: 'Inventory GL events',
      severity: problem > 0 ? 'BLOCK' : 'PASS',
      message:
        problem > 0
          ? `${recorded} unposted and ${failed} failed inventory GL event(s).`
          : 'Inventory GL events clear.',
      href: '/inventory/accounting',
      count: problem,
      featureEnabled: true,
    })
  } else {
    checks.push({
      key: 'INVENTORY_GL',
      label: 'Inventory GL events',
      severity: 'PASS',
      message: 'INVENTORY_ACCOUNTING flag off — inventory GL check skipped.',
      href: '/inventory/accounting',
      featureEnabled: false,
    })
  }

  if (mfgEnabled) {
    const [recorded, failed] = await Promise.all([
      prisma.productionAccountingEvent.count({
        where: { tenantId, legalEntityId: period.legalEntityId, status: 'RECORDED' },
      }),
      prisma.productionAccountingEvent.count({
        where: { tenantId, legalEntityId: period.legalEntityId, status: 'FAILED' },
      }),
    ])
    const problem = recorded + failed
    checks.push({
      key: 'MFG_GL',
      label: 'Manufacturing GL events',
      severity: problem > 0 ? 'BLOCK' : 'PASS',
      message:
        problem > 0
          ? `${recorded} unposted and ${failed} failed manufacturing GL event(s).`
          : 'Manufacturing GL events clear.',
      href: '/accounting/manufacturing',
      count: problem,
      featureEnabled: true,
    })
  } else {
    checks.push({
      key: 'MFG_GL',
      label: 'Manufacturing GL events',
      severity: 'PASS',
      message: 'MANUFACTURING_ACCOUNTING flag off — manufacturing GL check skipped.',
      href: '/accounting/manufacturing',
      featureEnabled: false,
    })
  }

  const blockers = checks.filter((c) => c.severity === 'BLOCK')
  const warningCount = checks.filter((c) => c.severity === 'WARN').length
  const alreadyClosed = period.status === 'CLOSED'
  const canClose = !alreadyClosed && (!hardBlockEnabled || blockers.length === 0)

  return {
    periodId: period.id,
    periodName: period.name,
    periodStatus: period.status,
    legalEntityId: period.legalEntityId,
    startDate: dateOnly(period.startDate),
    endDate: dateOnly(period.endDate),
    hardBlockEnabled,
    canClose,
    blockingCount: blockers.length,
    warningCount,
    unpostedJournalCount,
    openBankReconCount,
    checks,
    blockers,
  }
}

export async function assertCloseAllowed(tenantId: string, periodId: string): Promise<CloseReadinessResult> {
  const readiness = await getCloseReadiness(tenantId, periodId)
  if (!readiness.hardBlockEnabled) return readiness
  if (readiness.blockers.length === 0) return readiness
  throw new AppError(
    400,
    'Period close blocked by readiness checks. Resolve blockers or disable periodCloseHardBlock in Finance Settings.',
    'PERIOD_CLOSE_BLOCKED',
    undefined,
    {
      hardBlockEnabled: true,
      blockers: readiness.blockers,
      blockingCount: readiness.blockingCount,
    },
  )
}
