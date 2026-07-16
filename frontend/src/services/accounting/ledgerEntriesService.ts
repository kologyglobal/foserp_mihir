/**
 * Ledger Entries mock service — Promise-based for future API swap.
 * Demo / UI only. Does NOT post real GL or enforce statutory compliance.
 *
 * SECURITY: All reads, exports, and saved views must also be enforced by the future backend
 * (tenant isolation + accounting.ledger.* permissions). UI gating alone is not security.
 */

import {
  LEDGER_LOOKUP_COST_CENTRES,
  LEDGER_LOOKUP_DEPARTMENTS,
  LEDGER_LOOKUP_PARTIES,
  LEDGER_LOOKUP_PLANTS,
  LEDGER_LOOKUP_PROJECTS,
  seedLedgerEntries,
} from '../../data/accounting/ledgerEntriesSeed'
import type {
  AccountLedgerSummary,
  CostCentreLedgerSummary,
  LedgerEntry,
  LedgerEntryAuditEvent,
  LedgerEntryFilter,
  LedgerEntryParty,
  LedgerEntrySourceDocument,
  LedgerExportRequest,
  LedgerPrintPreview,
  LedgerSummary,
  ManufacturingLedgerSummary,
  PartyLedgerSummary,
  ProjectLedgerSummary,
  SavedLedgerView,
} from '../../types/ledgerEntries'
import { DEFAULT_LEDGER_FILTER } from '../../types/ledgerEntries'
import {
  getIndianFinancialYear,
  resolveLedgerDateRange,
} from '../../utils/accounting/indianFinancialYear'
import { getSessionUser } from '../../utils/permissions'

export { DEFAULT_LEDGER_FILTER }

export class LedgerEntriesServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LedgerEntriesServiceError'
  }
}

const COMPANY_NAME = 'Vasant Trailers Pvt Ltd'
const CONFIDENTIALITY_NOTE =
  'Confidential — for internal use only. Demo data; not a statutory financial statement.'
const AUDIT_USER = 'Rahul Mehta'

const delay = () => new Promise((r) => setTimeout(r, 80 + Math.floor(Math.random() * 70)))

let entriesStore: LedgerEntry[] = seedLedgerEntries()

const SEED_SAVED_VIEWS: SavedLedgerView[] = [
  {
    id: 'slv-payments-month',
    name: 'This Month Payments',
    filters: { ...DEFAULT_LEDGER_FILTER, dateQuickRange: 'this_month', voucherType: 'Payment', viewTab: 'general' },
    columns: ['postingDate', 'entryNumber', 'voucherNumber', 'account', 'party', 'debit', 'credit', 'narration'],
    sortKey: 'postingDate',
    sortDir: 'desc',
    createdAt: '2026-04-15T08:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'slv-vendor-control',
    name: 'Vendor Control Account',
    filters: { ...DEFAULT_LEDGER_FILTER, accountId: 'coa-2111', partyType: 'Vendor', viewTab: 'party' },
    columns: ['postingDate', 'entryNumber', 'party', 'debit', 'credit', 'runningBalance', 'referenceNumber'],
    sortKey: 'postingDate',
    sortDir: 'asc',
    createdAt: '2026-04-20T08:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'slv-factory-exp',
    name: 'Factory Expenses',
    filters: {
      ...DEFAULT_LEDGER_FILTER,
      costCentreId: 'cc-prod',
      accountCode: '5300',
      viewTab: 'cost_centre',
    },
    columns: ['postingDate', 'entryNumber', 'account', 'debit', 'narration', 'costCentre'],
    sortKey: 'postingDate',
    sortDir: 'asc',
    createdAt: '2026-05-01T08:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'slv-prod-variance',
    name: 'Production Variance',
    filters: {
      ...DEFAULT_LEDGER_FILTER,
      manufacturingAccountType: 'Production Variance',
      productionOrder: 'PO-MFG-2401',
      viewTab: 'manufacturing',
    },
    columns: ['postingDate', 'entryNumber', 'productionOrder', 'itemCode', 'debit', 'credit', 'narration'],
    sortKey: 'postingDate',
    sortDir: 'asc',
    createdAt: '2026-05-16T08:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'slv-reversed',
    name: 'Reversed Entries',
    filters: { ...DEFAULT_LEDGER_FILTER, hasReversal: 'yes', viewTab: 'general' },
    columns: ['postingDate', 'entryNumber', 'status', 'voucherNumber', 'narration', 'reversal'],
    sortKey: 'postingDate',
    sortDir: 'desc',
    createdAt: '2026-06-12T08:00:00.000Z',
    isDemo: true,
  },
  {
    id: 'slv-current-fy',
    name: 'Current Financial Year',
    filters: { ...DEFAULT_LEDGER_FILTER, dateQuickRange: 'this_financial_year', viewTab: 'general' },
    columns: ['postingDate', 'entryNumber', 'voucherType', 'account', 'debit', 'credit', 'status'],
    sortKey: 'postingDate',
    sortDir: 'asc',
    createdAt: '2026-04-01T08:00:00.000Z',
    isDemo: true,
  },
]

let savedViewsStore: SavedLedgerView[] = structuredClone(SEED_SAVED_VIEWS)

function currentUser(): string {
  try {
    return getSessionUser().name
  } catch {
    return 'Demo User'
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function clone<T>(v: T): T {
  return structuredClone(v)
}

function mergeFilter(partial?: Partial<LedgerEntryFilter>): LedgerEntryFilter {
  return { ...DEFAULT_LEDGER_FILTER, ...partial }
}

function resolvePostingRange(filter: LedgerEntryFilter): { from: string; to: string } {
  if (filter.dateQuickRange === 'custom') {
    return {
      from: filter.postingDateFrom || getIndianFinancialYear().startDate,
      to: filter.postingDateTo || nowIso().slice(0, 10),
    }
  }
  const resolved = resolveLedgerDateRange(
    filter.dateQuickRange,
    filter.postingDateFrom,
    filter.postingDateTo,
  )
  return { from: resolved.from, to: resolved.to }
}

function matchesFilter(e: LedgerEntry, filter: LedgerEntryFilter): boolean {
  if (!filter.includePreview && e.isPreviewOnly) return false

  const { from, to } = resolvePostingRange(filter)
  if (e.postingDate < from || e.postingDate > to) return false

  if (filter.documentDateFrom && e.documentDate < filter.documentDateFrom) return false
  if (filter.documentDateTo && e.documentDate > filter.documentDateTo) return false

  if (filter.entryNumber && !e.entryNumber.toLowerCase().includes(filter.entryNumber.toLowerCase())) return false
  if (filter.voucherNumber && !e.voucherNumber.toLowerCase().includes(filter.voucherNumber.toLowerCase())) return false
  if (filter.voucherType && e.voucherType !== filter.voucherType) return false
  if (filter.entryStatus && e.status !== filter.entryStatus) return false

  if (filter.accountId && e.account.accountId !== filter.accountId) return false
  if (filter.accountCode && e.account.code !== filter.accountCode) return false
  if (filter.accountName && !e.account.name.toLowerCase().includes(filter.accountName.toLowerCase())) return false
  if (filter.accountCategory && e.account.category !== filter.accountCategory) return false
  if (filter.accountType && e.account.accountType !== filter.accountType) return false
  if (filter.controlAccountType && e.account.controlAccountType !== filter.controlAccountType) return false
  if (filter.normalBalance && e.account.normalBalance !== filter.normalBalance) return false

  if (filter.partyType && e.party?.partyType !== filter.partyType) return false
  if (filter.partyId && e.party?.partyId !== filter.partyId) return false
  if (filter.partyCode && e.party?.partyCode !== filter.partyCode) return false
  if (filter.partyName && !e.party?.partyName.toLowerCase().includes(filter.partyName.toLowerCase())) return false

  if (filter.locationId && e.dimensions.locationId !== filter.locationId) return false
  if (filter.plantId && e.dimensions.plantId !== filter.plantId) return false
  if (filter.departmentId && e.dimensions.departmentId !== filter.departmentId) return false
  if (filter.costCentreId && e.dimensions.costCentreId !== filter.costCentreId) return false
  if (filter.projectId && e.dimensions.projectId !== filter.projectId) return false
  if (filter.businessUnit && e.dimensions.businessUnit !== filter.businessUnit) return false

  if (filter.productionOrder && e.manufacturing.productionOrder !== filter.productionOrder) return false
  if (filter.workCentre && e.manufacturing.workCentre !== filter.workCentre) return false
  if (filter.itemCode && e.manufacturing.itemCode !== filter.itemCode) return false
  if (filter.itemCategory && e.manufacturing.itemCategory !== filter.itemCategory) return false
  if (filter.batchNumber && e.manufacturing.batchNumber !== filter.batchNumber) return false
  if (filter.jobWorkOrder && e.manufacturing.jobWorkOrder !== filter.jobWorkOrder) return false
  if (
    filter.manufacturingAccountType &&
    e.manufacturing.manufacturingAccountType !== filter.manufacturingAccountType
  ) {
    return false
  }

  if (filter.createdBy && !e.createdBy.toLowerCase().includes(filter.createdBy.toLowerCase())) return false
  if (filter.postedBy && !e.postedBy.toLowerCase().includes(filter.postedBy.toLowerCase())) return false

  if (filter.hasAttachments === 'yes' && !e.hasAttachments) return false
  if (filter.hasAttachments === 'no' && e.hasAttachments) return false
  if (filter.hasSourceDocument === 'yes' && !e.sourceDocument) return false
  if (filter.hasSourceDocument === 'no' && e.sourceDocument) return false
  if (filter.hasReversal === 'yes' && !e.reversal) return false
  if (filter.hasReversal === 'no' && e.reversal) return false
  if (filter.isReversalEntry === 'yes' && e.status !== 'Reversal Entry') return false
  if (filter.isReversalEntry === 'no' && e.status === 'Reversal Entry') return false

  const debitFrom = filter.debitFrom ? Number(filter.debitFrom) : null
  const debitTo = filter.debitTo ? Number(filter.debitTo) : null
  if (debitFrom != null && Number.isFinite(debitFrom) && e.debit < debitFrom) return false
  if (debitTo != null && Number.isFinite(debitTo) && e.debit > debitTo) return false

  const creditFrom = filter.creditFrom ? Number(filter.creditFrom) : null
  const creditTo = filter.creditTo ? Number(filter.creditTo) : null
  if (creditFrom != null && Number.isFinite(creditFrom) && e.credit < creditFrom) return false
  if (creditTo != null && Number.isFinite(creditTo) && e.credit > creditTo) return false

  const absFrom = filter.absoluteAmountFrom ? Number(filter.absoluteAmountFrom) : null
  const absTo = filter.absoluteAmountTo ? Number(filter.absoluteAmountTo) : null
  const absAmt = Math.max(e.debit, e.credit)
  if (absFrom != null && Number.isFinite(absFrom) && absAmt < absFrom) return false
  if (absTo != null && Number.isFinite(absTo) && absAmt > absTo) return false

  if (filter.hasBalanceImpact === 'yes' && e.debit === 0 && e.credit === 0) return false
  if (filter.hasBalanceImpact === 'no' && (e.debit !== 0 || e.credit !== 0)) return false

  const q = filter.search.trim().toLowerCase()
  if (q) {
    const hay = [
      e.entryNumber,
      e.voucherNumber,
      e.account.code,
      e.account.name,
      e.party?.partyName ?? '',
      e.referenceNumber,
      e.narration,
      e.externalDocumentNumber,
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }

  return true
}

function sortEntries(rows: LedgerEntry[]): LedgerEntry[] {
  return [...rows].sort(
    (a, b) => a.postingDate.localeCompare(b.postingDate) || a.entryNumber.localeCompare(b.entryNumber),
  )
}

/** Recompute running balance chronologically for one account on the returned subset. */
function recomputeRunningForAccount(rows: LedgerEntry[], accountId: string): LedgerEntry[] {
  const sorted = sortEntries(rows.filter((r) => r.account.accountId === accountId))
  let balance = 0
  const isDebitNormal = sorted[0]?.account.normalBalance === 'Debit'

  return sorted.map((e) => {
    const movement = isDebitNormal ? e.debit - e.credit : e.credit - e.debit
    balance = Math.round((balance + movement) * 100) / 100
    const side: 'Dr' | 'Cr' = balance >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : isDebitNormal ? 'Cr' : 'Dr'
    return { ...e, runningBalance: Math.abs(balance), runningBalanceSide: side }
  })
}

function applyRunningBalanceDisplay(rows: LedgerEntry[], filter: LedgerEntryFilter): LedgerEntry[] {
  if (filter.accountId) {
    return recomputeRunningForAccount(rows, filter.accountId)
  }
  return rows
}

function filterEntries(partial?: Partial<LedgerEntryFilter>): LedgerEntry[] {
  const filter = mergeFilter(partial)
  const matched = entriesStore.filter((e) => matchesFilter(e, filter))
  return applyRunningBalanceDisplay(sortEntries(matched), filter)
}

function buildLedgerSummary(rows: LedgerEntry[]): LedgerSummary {
  const voucherIds = new Set(rows.map((r) => r.voucherId).filter(Boolean))
  const accountIds = new Set(rows.map((r) => r.account.accountId))
  const totalDebit = Math.round(rows.reduce((s, r) => s + r.debit, 0) * 100) / 100
  const totalCredit = Math.round(rows.reduce((s, r) => s + r.credit, 0) * 100) / 100
  return {
    entryCount: rows.length,
    totalDebit,
    totalCredit,
    netMovement: Math.round((totalDebit - totalCredit) * 100) / 100,
    postedVouchers: voucherIds.size,
    reversedEntries: rows.filter((r) => r.status === 'Reversed' || r.status === 'Reversal Entry').length,
    accountsAffected: accountIds.size,
  }
}

function signedBalance(amount: number, side: 'Dr' | 'Cr', normal: 'Debit' | 'Credit'): number {
  const onNormalSide = (normal === 'Debit' && side === 'Dr') || (normal === 'Credit' && side === 'Cr')
  return onNormalSide ? amount : -amount
}

function buildAccountLedgerSummary(accountId: string, partial?: Partial<LedgerEntryFilter>): AccountLedgerSummary {
  const filter = mergeFilter({ ...partial, accountId })
  const { from } = resolvePostingRange(filter)
  const allForAccount = sortEntries(
    entriesStore.filter((e) => e.account.accountId === accountId && (!e.isPreviewOnly || filter.includePreview)),
  )
  const beforeRange = allForAccount.filter((e) => e.postingDate < from)
  const inRange = filterEntries(filter)

  let openingBalance = 0
  let openingSide: 'Dr' | 'Cr' = allForAccount[0]?.account.normalBalance === 'Debit' ? 'Dr' : 'Cr'
  if (beforeRange.length > 0) {
    const last = beforeRange[beforeRange.length - 1]
    openingBalance = last.runningBalance
    openingSide = last.runningBalanceSide
  }

  const totalDebit = Math.round(inRange.reduce((s, r) => s + r.debit, 0) * 100) / 100
  const totalCredit = Math.round(inRange.reduce((s, r) => s + r.credit, 0) * 100) / 100
  const normal = allForAccount[0]?.account.normalBalance ?? 'Debit'
  const openingSigned = signedBalance(openingBalance, openingSide, normal)
  const netMovement =
    normal === 'Debit'
      ? Math.round((totalDebit - totalCredit) * 100) / 100
      : Math.round((totalCredit - totalDebit) * 100) / 100
  const closingSigned = Math.round((openingSigned + netMovement) * 100) / 100
  const closingSide: 'Dr' | 'Cr' = closingSigned >= 0 ? (normal === 'Debit' ? 'Dr' : 'Cr') : normal === 'Debit' ? 'Cr' : 'Dr'

  return {
    accountId,
    openingBalance: Math.abs(openingSigned),
    openingSide,
    totalDebit,
    totalCredit,
    netMovement,
    closingBalance: Math.abs(closingSigned),
    closingSide,
    entryCount: inRange.length,
    lastPostingDate: inRange.length ? inRange[inRange.length - 1].postingDate : null,
  }
}

function buildPartyLedgerSummary(
  partyType: LedgerEntryParty['partyType'],
  partyId: string,
  partial?: Partial<LedgerEntryFilter>,
): PartyLedgerSummary {
  const filter = mergeFilter({ ...partial, partyType, partyId })
  const rows = filterEntries(filter)
  const debitMovement = Math.round(rows.reduce((s, r) => s + r.debit, 0) * 100) / 100
  const creditMovement = Math.round(rows.reduce((s, r) => s + r.credit, 0) * 100) / 100
  const closingBalance = Math.round(Math.abs(debitMovement - creditMovement) * 100) / 100
  const closingSide: 'Dr' | 'Cr' = debitMovement >= creditMovement ? 'Dr' : 'Cr'

  return {
    partyId,
    openingBalance: 0,
    openingSide: 'Dr',
    debitMovement,
    creditMovement,
    closingBalance,
    closingSide,
    unappliedAmount: Math.round(Math.max(0, debitMovement - creditMovement) * 100) / 100,
    entryCount: rows.length,
  }
}

function buildManufacturingLedgerSummary(partial?: Partial<LedgerEntryFilter>): ManufacturingLedgerSummary {
  const rows = filterEntries({
    ...partial,
    viewTab: 'manufacturing',
  }).filter((e) => e.manufacturing.manufacturingAccountType || ['5100', '5200', '5300', '5500', '1142', '1143', '4400'].includes(e.account.code))

  const sumDebit = (code: string) =>
    Math.round(rows.filter((r) => r.account.code === code).reduce((s, r) => s + r.debit, 0) * 100) / 100
  const sumCredit = (code: string) =>
    Math.round(rows.filter((r) => r.account.code === code).reduce((s, r) => s + r.credit, 0) * 100) / 100

  return {
    materialConsumption: sumDebit('5100'),
    labourCost: sumDebit('5200'),
    factoryOverhead: sumDebit('5300'),
    wipMovement: Math.round((sumDebit('1142') - sumCredit('1142')) * 100) / 100,
    finishedGoodsValue: Math.round((sumDebit('1143') - sumCredit('1143')) * 100) / 100,
    productionVariance: sumDebit('5500'),
    scrapValue: sumCredit('4400'),
  }
}

/** Demo project rollup — categorises by account codes; not a real profitability engine. */
function buildProjectLedgerSummary(
  projectId: string,
  partial?: Partial<LedgerEntryFilter>,
): ProjectLedgerSummary {
  const meta = LEDGER_LOOKUP_PROJECTS.find((p) => p.id === projectId)
  const rows = filterEntries({ ...partial, projectId, viewTab: 'project' })
  const sumDebit = (codes: string[]) =>
    Math.round(
      rows.filter((r) => codes.includes(r.account.code)).reduce((s, r) => s + r.debit, 0) * 100,
    ) / 100
  const sumCredit = (codes: string[]) =>
    Math.round(
      rows.filter((r) => codes.includes(r.account.code)).reduce((s, r) => s + r.credit, 0) * 100,
    ) / 100

  const revenue = sumCredit(['4110', '4120', '4400'])
  const materialCost = sumDebit(['5100', '5110'])
  const labourCost = sumDebit(['5200', '5210'])
  const overhead = sumDebit(['5300', '5310'])
  const otherCost = Math.round(
    (rows.reduce((s, r) => s + r.debit, 0) - materialCost - labourCost - overhead) * 100,
  ) / 100

  return {
    projectId,
    projectCode: meta?.code ?? projectId,
    projectName: meta?.name ?? 'Project',
    customer: meta?.customer ?? '—',
    projectManager: meta?.projectManager ?? '—',
    status: meta?.status ?? 'Active',
    revenue,
    materialCost,
    labourCost,
    overhead,
    otherCost: Math.max(0, otherCost),
    netResult: Math.round((revenue - materialCost - labourCost - overhead - Math.max(0, otherCost)) * 100) / 100,
    entryCount: rows.length,
  }
}

function buildCostCentreLedgerSummary(
  costCentreId: string,
  partial?: Partial<LedgerEntryFilter>,
): CostCentreLedgerSummary {
  const meta = LEDGER_LOOKUP_COST_CENTRES.find((c) => c.id === costCentreId)
  const rows = filterEntries({ ...partial, costCentreId, viewTab: 'cost_centre' })
  const totalDebit = Math.round(rows.reduce((s, r) => s + r.debit, 0) * 100) / 100
  const totalCredit = Math.round(rows.reduce((s, r) => s + r.credit, 0) * 100) / 100
  return {
    costCentreId,
    costCentreCode: meta?.code ?? costCentreId,
    costCentreName: meta?.name ?? 'Cost Centre',
    totalDebit,
    totalCredit,
    netCost: Math.round((totalDebit - totalCredit) * 100) / 100,
    entryCount: rows.length,
  }
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function entriesToCsv(rows: LedgerEntry[]): string {
  const header = [
    'Entry Number',
    'Posting Date',
    'Voucher Number',
    'Voucher Type',
    'Account Code',
    'Account Name',
    'Party',
    'Debit',
    'Credit',
    'Running Balance',
    'Side',
    'Status',
    'Narration',
  ].join(',')
  const lines = rows.map((e) =>
    [
      e.entryNumber,
      e.postingDate,
      e.voucherNumber,
      e.voucherType,
      e.account.code,
      `"${e.account.name.replace(/"/g, '""')}"`,
      e.party ? `"${e.party.partyName.replace(/"/g, '""')}"` : '',
      e.debit,
      e.credit,
      e.runningBalance,
      e.runningBalanceSide,
      e.status,
      `"${e.narration.replace(/"/g, '""')}"`,
    ].join(','),
  )
  return [header, ...lines].join('\n')
}

function filtersLabel(filter: LedgerEntryFilter): string {
  const parts: string[] = []
  if (filter.search) parts.push(`Search: ${filter.search}`)
  if (filter.accountId) parts.push(`Account: ${filter.accountId}`)
  if (filter.partyId) parts.push(`Party: ${filter.partyId}`)
  if (filter.voucherType) parts.push(`Voucher: ${filter.voucherType}`)
  if (filter.entryStatus) parts.push(`Status: ${filter.entryStatus}`)
  if (filter.costCentreId) parts.push(`Cost Centre: ${filter.costCentreId}`)
  if (filter.projectId) parts.push(`Project: ${filter.projectId}`)
  if (filter.productionOrder) parts.push(`PO: ${filter.productionOrder}`)
  return parts.length ? parts.join(' · ') : 'All posted entries'
}

export async function getLedgerEntries(filter?: Partial<LedgerEntryFilter>): Promise<LedgerEntry[]> {
  await delay()
  return clone(filterEntries(filter))
}

export async function getLedgerEntryById(id: string): Promise<LedgerEntry | null> {
  await delay()
  const row = entriesStore.find((e) => e.id === id)
  return row ? clone(row) : null
}

export async function getGeneralLedgerSummary(filter?: Partial<LedgerEntryFilter>): Promise<LedgerSummary> {
  await delay()
  return buildLedgerSummary(filterEntries(filter))
}

export async function getAccountLedger(
  accountId: string,
  filter?: Partial<LedgerEntryFilter>,
): Promise<LedgerEntry[]> {
  await delay()
  return clone(filterEntries({ ...filter, accountId }))
}

export async function getAccountLedgerSummary(
  accountId: string,
  filter?: Partial<LedgerEntryFilter>,
): Promise<AccountLedgerSummary> {
  await delay()
  const exists = entriesStore.some((e) => e.account.accountId === accountId)
  if (!exists) throw new LedgerEntriesServiceError(`Account not found in ledger: ${accountId}`)
  return buildAccountLedgerSummary(accountId, filter)
}

export async function getVoucherEntries(voucherId: string): Promise<LedgerEntry[]> {
  await delay()
  return clone(
    sortEntries(entriesStore.filter((e) => e.voucherId === voucherId && !e.isPreviewOnly)),
  )
}

export async function getPartyLedger(
  partyType: LedgerEntryParty['partyType'],
  partyId: string,
  filter?: Partial<LedgerEntryFilter>,
): Promise<LedgerEntry[]> {
  await delay()
  return clone(filterEntries({ ...filter, partyType, partyId }))
}

export async function getPartyLedgerSummary(
  partyType: LedgerEntryParty['partyType'],
  partyId: string,
  filter?: Partial<LedgerEntryFilter>,
): Promise<PartyLedgerSummary> {
  await delay()
  return buildPartyLedgerSummary(partyType, partyId, filter)
}

export async function getCostCentreLedger(filter?: Partial<LedgerEntryFilter>): Promise<LedgerEntry[]> {
  await delay()
  const merged = mergeFilter(filter)
  if (!merged.costCentreId) {
    throw new LedgerEntriesServiceError('costCentreId is required for cost centre ledger')
  }
  return clone(filterEntries({ ...merged, viewTab: 'cost_centre' }))
}

export async function getProjectLedger(filter?: Partial<LedgerEntryFilter>): Promise<LedgerEntry[]> {
  await delay()
  const merged = mergeFilter(filter)
  if (!merged.projectId) {
    throw new LedgerEntriesServiceError('projectId is required for project ledger')
  }
  return clone(filterEntries({ ...merged, viewTab: 'project' }))
}

export async function getManufacturingLedger(filter?: Partial<LedgerEntryFilter>): Promise<LedgerEntry[]> {
  await delay()
  const rows = filterEntries({ ...filter, viewTab: 'manufacturing' }).filter(
    (e) =>
      e.manufacturing.manufacturingAccountType ||
      ['5100', '5200', '5300', '5500', '1141', '1142', '1143', '4400', '5700'].includes(e.account.code),
  )
  return clone(rows)
}

export async function getManufacturingLedgerSummary(
  filter?: Partial<LedgerEntryFilter>,
): Promise<ManufacturingLedgerSummary> {
  await delay()
  return buildManufacturingLedgerSummary(filter)
}

export async function getProjectLedgerSummary(
  projectId: string,
  filter?: Partial<LedgerEntryFilter>,
): Promise<ProjectLedgerSummary> {
  await delay()
  if (!projectId) throw new LedgerEntriesServiceError('projectId is required for project ledger summary')
  return buildProjectLedgerSummary(projectId, filter)
}

export async function getCostCentreLedgerSummary(
  costCentreId: string,
  filter?: Partial<LedgerEntryFilter>,
): Promise<CostCentreLedgerSummary> {
  await delay()
  if (!costCentreId) {
    throw new LedgerEntriesServiceError('costCentreId is required for cost centre ledger summary')
  }
  return buildCostCentreLedgerSummary(costCentreId, filter)
}

export async function getRelatedDocument(entryId: string): Promise<LedgerEntrySourceDocument | null> {
  await delay()
  const entry = entriesStore.find((e) => e.id === entryId)
  if (!entry) throw new LedgerEntriesServiceError(`Ledger entry not found: ${entryId}`)
  return entry.sourceDocument ? clone(entry.sourceDocument) : null
}

export async function getLedgerAuditTrail(entryId: string): Promise<LedgerEntryAuditEvent[]> {
  await delay()
  const entry = entriesStore.find((e) => e.id === entryId)
  if (!entry) throw new LedgerEntriesServiceError(`Ledger entry not found: ${entryId}`)

  const events: LedgerEntryAuditEvent[] = [
    {
      id: genId('aud'),
      entryId,
      action: 'Created',
      user: entry.createdBy,
      at: entry.createdAt,
      reference: entry.voucherNumber,
      comment: null,
      status: 'Draft',
    },
    {
      id: genId('aud'),
      entryId,
      action: 'Posted',
      user: entry.postedBy,
      at: entry.postedAt,
      reference: entry.entryNumber,
      comment: entry.narration,
      status: entry.status,
    },
  ]

  if (entry.reversal?.reversalDate) {
    events.push({
      id: genId('aud'),
      entryId,
      action: entry.status === 'Reversal Entry' ? 'Reversal Posted' : 'Reversed',
      user: AUDIT_USER,
      at: `${entry.reversal.reversalDate}T11:00:00.000Z`,
      reference: entry.reversal.reversalVoucherNumber ?? entry.reversal.originalVoucherNumber,
      comment: entry.reversal.reversalReason,
      status: entry.status,
    })
  }

  events.push({
    id: genId('aud'),
    entryId,
    action: 'Viewed',
    user: currentUser(),
    at: nowIso(),
    reference: null,
    comment: 'Ledger detail viewed (demo)',
    status: entry.status,
  })

  return events
}

export async function getSavedLedgerViews(): Promise<SavedLedgerView[]> {
  await delay()
  return clone(savedViewsStore)
}

export async function saveLedgerView(
  input: Omit<SavedLedgerView, 'id' | 'createdAt' | 'isDemo'>,
): Promise<SavedLedgerView> {
  await delay()
  const view: SavedLedgerView = {
    ...input,
    id: genId('slv'),
    createdAt: nowIso(),
    isDemo: true,
  }
  savedViewsStore = [...savedViewsStore, view]
  return clone(view)
}

export async function deleteSavedLedgerView(id: string): Promise<void> {
  await delay()
  const before = savedViewsStore.length
  savedViewsStore = savedViewsStore.filter((v) => v.id !== id)
  if (savedViewsStore.length === before) {
    throw new LedgerEntriesServiceError(`Saved view not found: ${id}`)
  }
}

export async function exportLedgerEntries(req: LedgerExportRequest): Promise<{
  fileName: string
  mime: string
  content: string
  message: string
}> {
  await delay()

  let rows: LedgerEntry[]
  if (req.scope === 'selected' && req.selectedIds?.length) {
    rows = sortEntries(entriesStore.filter((e) => req.selectedIds!.includes(e.id)))
  } else {
    rows = filterEntries(req.filter)
  }

  const stamp = nowIso().slice(0, 10)
  if (req.format === 'pdf') {
    return {
      fileName: `ledger-export-${stamp}.txt`,
      mime: 'text/plain',
      content: `PDF export placeholder — ${rows.length} ledger rows.\nUse CSV/Excel in demo mode.`,
      message: 'PDF export is a demo placeholder. Download CSV for structured data.',
    }
  }

  const ext = req.format === 'excel' ? 'csv' : 'csv'
  const mime = req.format === 'excel' ? 'text/csv' : 'text/csv'
  return {
    fileName: `ledger-export-${stamp}.${ext}`,
    mime,
    content: entriesToCsv(rows),
    message: `Exported ${rows.length} ledger entries as ${req.format.toUpperCase()}.`,
  }
}

export async function getPrintPreview(
  reportName: string,
  filter?: Partial<LedgerEntryFilter>,
  selectedIds?: string[],
): Promise<LedgerPrintPreview> {
  await delay()
  const merged = mergeFilter(filter)
  const range = resolveLedgerDateRange(
    merged.dateQuickRange,
    merged.postingDateFrom,
    merged.postingDateTo,
  )
  const rows =
    selectedIds?.length
      ? sortEntries(entriesStore.filter((e) => selectedIds.includes(e.id)))
      : filterEntries(filter)

  return {
    reportName,
    companyName: COMPANY_NAME,
    dateRangeLabel: range.label,
    filtersLabel: filtersLabel(merged),
    generatedBy: currentUser(),
    generatedAt: nowIso(),
    rows: clone(rows),
    confidentialityNote: CONFIDENTIALITY_NOTE,
    isDemo: true,
  }
}

export async function getLedgerLookups(): Promise<{
  costCentres: typeof LEDGER_LOOKUP_COST_CENTRES
  projects: typeof LEDGER_LOOKUP_PROJECTS
  plants: typeof LEDGER_LOOKUP_PLANTS
  departments: typeof LEDGER_LOOKUP_DEPARTMENTS
  parties: typeof LEDGER_LOOKUP_PARTIES
  vouchers: { id: string; number: string; type: string }[]
}> {
  await delay()
  const voucherMap = new Map<string, { id: string; number: string; type: string }>()
  for (const e of entriesStore) {
    if (e.voucherId && e.voucherNumber && !voucherMap.has(e.voucherId)) {
      voucherMap.set(e.voucherId, { id: e.voucherId, number: e.voucherNumber, type: e.voucherType })
    }
  }
  return {
    costCentres: clone(LEDGER_LOOKUP_COST_CENTRES),
    projects: clone(LEDGER_LOOKUP_PROJECTS),
    plants: clone(LEDGER_LOOKUP_PLANTS),
    departments: clone(LEDGER_LOOKUP_DEPARTMENTS),
    parties: clone(LEDGER_LOOKUP_PARTIES),
    vouchers: [...voucherMap.values()].sort((a, b) => a.number.localeCompare(b.number)),
  }
}

export async function getFinancialPeriodContext(): Promise<{
  companyName: string
  fy: ReturnType<typeof getIndianFinancialYear>
  postingDateRange: ReturnType<typeof resolveLedgerDateRange>
  asOfDate: string
}> {
  await delay()
  const fy = getIndianFinancialYear()
  const postingDateRange = resolveLedgerDateRange('this_financial_year')
  return {
    companyName: COMPANY_NAME,
    fy,
    postingDateRange,
    asOfDate: nowIso().slice(0, 10),
  }
}

/** Reset in-memory demo stores (tests / dev). */
export function resetLedgerEntriesDemo(): void {
  entriesStore = seedLedgerEntries()
  savedViewsStore = structuredClone(SEED_SAVED_VIEWS)
}
