/**
 * Fixed Assets Management — dual-mode service.
 * Demo (`VITE_USE_API=false`): in-memory seed.
 * API (`VITE_USE_API=true`): live overview, categories, register, capitalize, depreciation,
 * dispose (full + partial), and intra-LE location transfers.
 * Maintenance, revaluation, impairment, verification, ledger remain demo.
 *
 * SECURITY: Backend enforces tenant isolation + finance.fa.* permissions.
 */

import { isApiMode } from '@/config/apiConfig'
import {
  capitalizeFixedAsset,
  completeFixedAssetTransfer,
  createDepreciationRun,
  createFixedAssetTransfer,
  disposeFixedAsset,
  fetchDepreciationRun,
  fetchDepreciationRuns,
  fetchFixedAsset,
  fetchFixedAssetCategories,
  fetchFixedAssetTransfers,
  fetchFixedAssets,
  fetchFixedAssetsOverview,
  previewDepreciationRun,
  previewFixedAssetDispose,
  type FixedAssetCategoryDto,
  type FixedAssetDepreciationLineDto,
  type FixedAssetDepreciationPreviewDto,
  type FixedAssetDepreciationRunDto,
  type FixedAssetDto,
  type FixedAssetOverviewDto,
  type FixedAssetTransferDto,
} from '@/services/api/fixedAssetsApi'
import { resolveDefaultLegalEntity } from '@/services/accounting/fixedAssetsApiComposer'
import {
  seedAssetAcquisitions,
  seedAssetCapitalizations,
  seedAssetDisposals,
  seedAssetImpairments,
  seedAssetLedger,
  seedAssetMaintenance,
  seedAssetRevaluations,
  seedAssetTransfers,
  seedDepreciationRuns,
  seedFixedAssetCategories,
  seedFixedAssetComponents,
  seedFixedAssets,
  seedFixedAssetsAudit,
  seedFixedAssetsSetup,
  seedPhysicalVerifications,
} from '../../data/accounting/fixedAssetsSeed'
import type {
  AssetAcquisition,
  AssetCapitalization,
  AssetDisposal,
  AssetImpairment,
  AssetLedgerEntry,
  AssetMaintenance,
  AssetRevaluation,
  AssetTransfer,
  DepreciationLine,
  DepreciationMethod,
  DepreciationPreview,
  DepreciationRun,
  DisposalGainLossPreview,
  DisposalType,
  FixedAsset,
  FixedAssetCategory,
  FixedAssetComponent,
  FixedAssetsAuditEntry,
  FixedAssetsDashboardData,
  FixedAssetsExportRequest,
  FixedAssetsFilter,
  FixedAssetsPrintPreview,
  FixedAssetsReportCard,
  FixedAssetsSetup,
  PhysicalVerification,
} from '../../types/fixedAssets'
import { DEFAULT_FIXED_ASSETS_FILTER } from '../../types/fixedAssets'
import { getSessionUser } from '../../utils/permissions'

export { DEFAULT_FIXED_ASSETS_FILTER }

export class FixedAssetsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FixedAssetsServiceError'
  }
}

const COMPANY_NAME = 'Vasant Trailers Pvt Ltd'
const delay = () => new Promise((r) => setTimeout(r, 80 + Math.floor(Math.random() * 70)))

function money(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

const STATUS_TO_API: Partial<Record<FixedAsset['status'], string>> = {
  Draft: 'DRAFT',
  'Pending Capitalization': 'PENDING_CAPITALIZATION',
  Active: 'ACTIVE',
  Idle: 'IDLE',
  'Fully Depreciated': 'FULLY_DEPRECIATED',
  Disposed: 'DISPOSED',
}

function legalEntityLabel(le: { displayName: string; legalName: string }): string {
  return le.displayName || le.legalName
}

function mapCategoryDto(dto: FixedAssetCategoryDto): FixedAssetCategory {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    depreciationMethod: dto.depreciationMethod,
    usefulLifeYears: dto.usefulLifeYears,
    residualPercent: money(dto.residualPercent),
    glAssetAccount: dto.assetAccountId,
    glAccumDepAccount: dto.accumDepAccountId,
    glDepExpenseAccount: dto.depExpenseAccountId,
    active: dto.isActive,
  }
}

function mapAssetDto(dto: FixedAssetDto, companyName = COMPANY_NAME): FixedAsset {
  return {
    id: dto.id,
    assetNumber: dto.assetNumber,
    name: dto.name,
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    status: dto.status as FixedAsset['status'],
    location: dto.location ?? '',
    plant: dto.plant ?? '',
    department: dto.department ?? '',
    custodian: dto.custodian ?? '',
    acquisitionDate: dto.acquisitionDate,
    capitalizationDate: dto.capitalizationDate,
    acquisitionCost: money(dto.acquisitionCost),
    residualValue: money(dto.residualValue),
    usefulLifeYears: dto.usefulLifeYears,
    depreciationMethod: dto.depreciationMethod,
    accumulatedDepreciation: money(dto.accumulatedDepreciation),
    netBookValue: money(dto.netBookValue),
    salvageValue: money(dto.residualValue),
    serialNumber: dto.serialNumber,
    manufacturer: dto.manufacturer,
    model: dto.model,
    vendorName: dto.vendorName,
    poNumber: null,
    invoiceNumber: null,
    insurancePolicy: null,
    insuranceExpiry: null,
    lastVerificationDate: null,
    nextVerificationDate: null,
    warrantyExpiry: null,
    isComponent: false,
    parentAssetId: null,
    currency: dto.currencyCode,
    company: companyName,
    createdBy: '—',
    createdAt: dto.createdAt,
    modifiedAt: dto.updatedAt,
    notes: dto.notes,
  }
}

function mapDepreciationLineDto(
  dto: FixedAssetDepreciationLineDto,
  runId: string,
  periodKey: string,
  method: DepreciationMethod = 'Straight Line',
): DepreciationLine {
  return {
    id: dto.id ?? `fadl-${runId}-${dto.lineNumber}`,
    runId,
    assetId: dto.assetId,
    assetNumber: dto.assetNumber,
    assetName: dto.assetName,
    categoryName: dto.categoryName,
    method,
    period: periodKey,
    openingWDV: money(dto.openingNbv),
    depreciationAmount: money(dto.depreciationAmount),
    closingWDV: money(dto.closingNbv),
    accumulatedDepreciation: money(dto.accumulatedDepreciation),
    netBookValue: money(dto.closingNbv),
  }
}

function mapDepreciationRunDto(dto: FixedAssetDepreciationRunDto): DepreciationRun {
  const status =
    dto.status === 'Previewed' ? 'Preview' : (dto.status as DepreciationRun['status'])
  const lines = (dto.lines ?? []).map((line) => mapDepreciationLineDto(line, dto.id, dto.periodKey))
  return {
    id: dto.id,
    runNumber: dto.runNumber,
    period: dto.periodKey,
    periodFrom: dto.periodFrom,
    periodTo: dto.periodTo,
    runDate: dto.runDate,
    status,
    methodSummary: 'Straight Line',
    totalDepreciation: money(dto.totalDepreciation),
    assetCount: dto.assetCount,
    postedBy: dto.postedAt ? 'System' : null,
    postedAt: dto.postedAt,
    lines,
    createdBy: '—',
    createdAt: dto.createdAt,
  }
}

function mapOverviewToDashboard(
  overview: FixedAssetOverviewDto,
  companyName: string,
): FixedAssetsDashboardData {
  const statusSummary = overview.statusSummary.map((row) => ({
    status: row.status as FixedAsset['status'],
    count: row.count,
    nbv: 0,
  }))
  const categorySummary = overview.categorySummary.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    count: row.count,
    nbv: money(row.netBookValue),
  }))

  return {
    asOfDate: new Date().toISOString().slice(0, 10),
    companyName,
    totalAssetValue: money(overview.totalAssetValue),
    netBookValue: money(overview.netBookValue),
    accumulatedDepreciation: money(overview.accumulatedDepreciation),
    assetsUnderConstruction: overview.assetsUnderConstruction,
    depreciationDue: money(overview.depreciationDue),
    pendingCapitalization: overview.pendingCapitalization,
    dueForVerification: overview.dueForVerification,
    pendingDisposal: overview.pendingDisposal,
    statusSummary,
    categorySummary,
    recentActivity: [],
    alerts: [],
    depreciationTrend: [],
    nbvByCategory: categorySummary.map((c) => ({ category: c.categoryName, nbv: c.nbv })),
  }
}

function mapPreviewDto(dto: FixedAssetDepreciationPreviewDto, message: string): DepreciationPreview {
  return {
    period: dto.periodKey,
    periodFrom: dto.periodFrom,
    periodTo: dto.periodTo,
    assetCount: dto.assetCount,
    totalDepreciation: money(dto.totalDepreciation),
    lines: dto.lines.map((line) => mapDepreciationLineDto(line, 'preview', dto.periodKey)),
    message,
  }
}

async function unwrapApiData<T>(promise: Promise<{ data: T }>): Promise<T> {
  const res = await promise
  return res.data
}

let categoriesStore = seedFixedAssetCategories()
let assetsStore = seedFixedAssets()
let componentsStore = seedFixedAssetComponents()
let acquisitionsStore = seedAssetAcquisitions()
let capitalizationsStore = seedAssetCapitalizations()
let depreciationRunsStore = seedDepreciationRuns()
let transfersStore = seedAssetTransfers()
let maintenanceStore = seedAssetMaintenance()
let revaluationsStore = seedAssetRevaluations()
let impairmentsStore = seedAssetImpairments()
let disposalsStore = seedAssetDisposals()
let verificationsStore = seedPhysicalVerifications()
let ledgerStore = seedAssetLedger()
let setupStore = seedFixedAssetsSetup()
let auditStore = seedFixedAssetsAudit()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function pushAudit(entityType: string, entityId: string, action: string, details: string) {
  const user = getSessionUser()
  auditStore = [
    {
      id: `faa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      entityType,
      entityId,
      action,
      details,
      performedBy: user.name,
      performedAt: new Date().toISOString(),
      isDemo: true,
    },
    ...auditStore,
  ]
}

function matchSearch(blob: string, q: string): boolean {
  return !q || blob.toLowerCase().includes(q.toLowerCase())
}

function inDateRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function applyAssetFilter(list: FixedAsset[], filter: Partial<FixedAssetsFilter>): FixedAsset[] {
  const f = { ...DEFAULT_FIXED_ASSETS_FILTER, ...filter }
  return list.filter((a) => {
    if (f.search) {
      const blob = `${a.assetNumber} ${a.name} ${a.categoryName} ${a.location} ${a.custodian} ${a.serialNumber ?? ''}`
      if (!matchSearch(blob, f.search)) return false
    }
    if (f.categoryId && a.categoryId !== f.categoryId) return false
    if (f.status && a.status !== f.status) return false
    if (f.plant && a.plant !== f.plant) return false
    if (f.department && a.department !== f.department) return false
    if (f.location && !a.location.includes(f.location)) return false
    if (f.custodian && a.custodian !== f.custodian) return false
    if (f.depreciationMethod && a.depreciationMethod !== f.depreciationMethod) return false
    if (f.isComponent === 'yes' && !a.isComponent) return false
    if (f.isComponent === 'no' && a.isComponent) return false
    if (!inDateRange(a.acquisitionDate, f.dateFrom, f.dateTo)) return false
    if (f.amountMin != null && a.acquisitionCost < f.amountMin) return false
    if (f.amountMax != null && a.acquisitionCost > f.amountMax) return false
    return true
  })
}

function nextNumber(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear()
  const nums = existing
    .map((n) => {
      const m = n.match(new RegExp(`${prefix}-(\\d{4})-(\\d+)`))
      return m && Number(m[1]) === year ? Number(m[2]) : 0
    })
    .filter((n) => n > 0)
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getFixedAssetsDashboard(): Promise<FixedAssetsDashboardData> {
  if (isApiMode()) {
    const le = await resolveDefaultLegalEntity()
    const overview = await unwrapApiData(fetchFixedAssetsOverview({ legalEntityId: le.id }))
    return mapOverviewToDashboard(overview, legalEntityLabel(le))
  }

  await delay()
  const activeAssets = assetsStore.filter((a) => !['Disposed', 'Written Off', 'Sold'].includes(a.status))
  const totalAssetValue = activeAssets.reduce((s, a) => s + a.acquisitionCost, 0)
  const netBookValue = activeAssets.reduce((s, a) => s + a.netBookValue, 0)
  const accumulatedDepreciation = activeAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0)
  const assetsUnderConstruction = assetsStore.filter((a) => a.status === 'Under Construction').length
  const pendingCapitalization = assetsStore.filter((a) => a.status === 'Pending Capitalization').length
  const dueForVerification = assetsStore.filter(
    (a) => a.nextVerificationDate && a.nextVerificationDate <= '2026-07-16',
  ).length
  const pendingDisposal = disposalsStore.filter((d) => d.status === 'Draft' || d.status === 'Pending Approval').length
  const draftRun = depreciationRunsStore.find((r) => r.status === 'Draft')

  const statusMap = new Map<string, { count: number; nbv: number }>()
  for (const a of assetsStore) {
    const cur = statusMap.get(a.status) ?? { count: 0, nbv: 0 }
    statusMap.set(a.status, { count: cur.count + 1, nbv: cur.nbv + a.netBookValue })
  }

  const catMap = new Map<string, { categoryName: string; count: number; nbv: number }>()
  for (const a of activeAssets) {
    const cur = catMap.get(a.categoryId) ?? { categoryName: a.categoryName, count: 0, nbv: 0 }
    catMap.set(a.categoryId, { categoryName: a.categoryName, count: cur.count + 1, nbv: cur.nbv + a.netBookValue })
  }

  return {
    asOfDate: '2026-07-16',
    companyName: COMPANY_NAME,
    totalAssetValue,
    netBookValue,
    accumulatedDepreciation,
    assetsUnderConstruction,
    depreciationDue: draftRun?.totalDepreciation ?? 0,
    pendingCapitalization,
    dueForVerification,
    pendingDisposal,
    statusSummary: [...statusMap.entries()].map(([status, v]) => ({
      status: status as FixedAsset['status'],
      count: v.count,
      nbv: v.nbv,
    })),
    categorySummary: [...catMap.entries()].map(([categoryId, v]) => ({
      categoryId,
      categoryName: v.categoryName,
      count: v.count,
      nbv: v.nbv,
    })),
    recentActivity: [
      {
        id: 'act-001',
        type: 'Depreciation',
        description: 'Jul 2026 depreciation run prepared — 8 assets',
        date: '2026-07-14',
        amount: draftRun?.totalDepreciation ?? 0,
        href: '/accounting/fixed-assets/depreciation',
      },
      {
        id: 'act-002',
        type: 'Capitalization',
        description: 'Laser Welding Machine capitalization submitted',
        date: '2026-07-12',
        amount: 72_00_000,
        href: '/accounting/fixed-assets/capitalization',
      },
      {
        id: 'act-003',
        type: 'Disposal',
        description: 'Bolero pickup sale draft created',
        date: '2026-07-10',
        amount: 85_000,
        href: '/accounting/fixed-assets/disposal',
      },
      {
        id: 'act-004',
        type: 'Maintenance',
        description: 'Paint booth breakdown maintenance in progress',
        date: '2026-07-08',
        amount: 1_25_000,
        href: '/accounting/fixed-assets/maintenance',
      },
      {
        id: 'act-005',
        type: 'Transfer',
        description: 'Laptops transfer to Chakan Plant approved',
        date: '2026-07-05',
        amount: null,
        href: '/accounting/fixed-assets/transfers',
      },
    ],
    alerts: [
      {
        id: 'alrt-001',
        severity: 'warning',
        message: 'Jul 2026 depreciation run pending — ₹3,65,118 due',
        href: '/accounting/fixed-assets/depreciation',
      },
      {
        id: 'alrt-002',
        severity: 'info',
        message: '1 asset pending capitalization — Laser Welding Machine',
        href: '/accounting/fixed-assets/capitalization',
      },
      {
        id: 'alrt-003',
        severity: 'warning',
        message: 'DG Set verification due — scheduled Jul 15, 2026',
        href: '/accounting/fixed-assets/verification',
      },
      {
        id: 'alrt-004',
        severity: 'critical',
        message: 'CNC Plasma insurance expired — renew before Mar 31',
        href: '/accounting/fixed-assets/register',
      },
      {
        id: 'alrt-005',
        severity: 'info',
        message: '2 disposal drafts pending approval',
        href: '/accounting/fixed-assets/disposal',
      },
    ],
    depreciationTrend: [
      { month: 'Apr 2026', amount: 3_42_180 },
      { month: 'May 2026', amount: 3_48_920 },
      { month: 'Jun 2026', amount: 3_58_420 },
      { month: 'Jul 2026', amount: draftRun?.totalDepreciation ?? 3_65_118 },
    ],
    nbvByCategory: [...catMap.values()].map((v) => ({ category: v.categoryName, nbv: v.nbv })),
  }
}

// ─── Register / categories ────────────────────────────────────────────────────

export async function getAssets(filter?: Partial<FixedAssetsFilter>): Promise<FixedAsset[]> {
  if (isApiMode()) {
    const le = await resolveDefaultLegalEntity()
    const f = { ...DEFAULT_FIXED_ASSETS_FILTER, ...filter }
    const statusApi = f.status ? STATUS_TO_API[f.status] : undefined
    const items = await unwrapApiData(
      fetchFixedAssets({
        legalEntityId: le.id,
        categoryId: f.categoryId || undefined,
        status: statusApi,
        search: f.search || undefined,
      }),
    )
    const mapped = items.map((dto) => mapAssetDto(dto, legalEntityLabel(le)))
    return applyAssetFilter(mapped, f)
  }

  await delay()
  return clone(applyAssetFilter(assetsStore, filter ?? {}))
}

export async function getAssetById(id: string): Promise<FixedAsset | null> {
  if (isApiMode()) {
    try {
      const le = await resolveDefaultLegalEntity()
      const dto = await unwrapApiData(fetchFixedAsset(id))
      return mapAssetDto(dto, legalEntityLabel(le))
    } catch {
      return null
    }
  }

  await delay()
  const asset = assetsStore.find((a) => a.id === id)
  return asset ? clone(asset) : null
}

export async function getCategories(): Promise<FixedAssetCategory[]> {
  if (isApiMode()) {
    const le = await resolveDefaultLegalEntity()
    const items = await unwrapApiData(fetchFixedAssetCategories({ legalEntityId: le.id }))
    return items.map(mapCategoryDto)
  }

  await delay()
  return clone(categoriesStore)
}

export async function getCategoryById(id: string): Promise<FixedAssetCategory | null> {
  await delay()
  const cat = categoriesStore.find((c) => c.id === id)
  return cat ? clone(cat) : null
}

export async function getAssetComponents(parentAssetId?: string): Promise<FixedAssetComponent[]> {
  await delay()
  const list = parentAssetId
    ? componentsStore.filter((c) => c.parentAssetId === parentAssetId)
    : componentsStore
  return clone(list)
}

// ─── Acquisition / capitalization ─────────────────────────────────────────────

export async function getAcquisitions(): Promise<AssetAcquisition[]> {
  await delay()
  return clone(acquisitionsStore)
}

export async function createAcquisitionDemo(partial?: Partial<AssetAcquisition>): Promise<AssetAcquisition> {
  await delay()
  const user = getSessionUser()
  const acq: AssetAcquisition = {
    id: `faacq-${Date.now()}`,
    acquisitionNumber: nextNumber(
      'ACQ',
      acquisitionsStore.map((a) => a.acquisitionNumber),
    ),
    acquisitionDate: new Date().toISOString().slice(0, 10),
    acquisitionType: partial?.acquisitionType ?? 'Purchase',
    assetName: partial?.assetName ?? 'New Asset — Demo',
    categoryId: partial?.categoryId ?? categoriesStore[0].id,
    categoryName: partial?.categoryName ?? categoriesStore[0].name,
    vendorName: partial?.vendorName ?? null,
    poNumber: partial?.poNumber ?? null,
    invoiceNumber: partial?.invoiceNumber ?? null,
    invoiceDate: partial?.invoiceDate ?? null,
    amount: partial?.amount ?? 10_00_000,
    gstAmount: partial?.gstAmount ?? 1_80_000,
    totalAmount: partial?.totalAmount ?? 11_80_000,
    currency: 'INR',
    status: 'Draft',
    assetId: null,
    location: partial?.location ?? 'Chakan Plant',
    plant: partial?.plant ?? 'Chakan Plant',
    department: partial?.department ?? 'Production',
    notes: partial?.notes ?? 'Demo acquisition record',
    createdBy: user.name,
    createdAt: new Date().toISOString(),
  }
  acquisitionsStore = [acq, ...acquisitionsStore]
  pushAudit('AssetAcquisition', acq.id, 'Create', `Created acquisition ${acq.acquisitionNumber}`)
  return clone(acq)
}

export async function getCapitalizations(): Promise<AssetCapitalization[]> {
  await delay()
  return clone(capitalizationsStore)
}

export async function capitalizeAssetDemo(id: string): Promise<AssetCapitalization> {
  if (isApiMode()) {
    const result = await unwrapApiData(capitalizeFixedAsset(id))
    const asset = result.asset
    const le = await resolveDefaultLegalEntity()
    const mapped = mapAssetDto(asset, legalEntityLabel(le))
    return {
      id: `cap-${asset.id}`,
      capitalizationNumber: asset.assetNumber,
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      assetName: asset.name,
      categoryName: asset.categoryName,
      capitalizationDate: asset.capitalizationDate ?? new Date().toISOString().slice(0, 10),
      totalCost: mapped.acquisitionCost,
      cwIpAmount: 0,
      additionalCosts: 0,
      status: 'Capitalized',
      approvedBy: 'System',
      approvedAt: asset.capitalizedAt,
      glAssetAccount: '—',
      notes: result.idempotentReplay ? 'Capitalization replayed (idempotent).' : null,
      createdBy: '—',
      createdAt: asset.updatedAt,
    }
  }

  await delay()
  const cap = capitalizationsStore.find((c) => c.id === id || c.assetId === id)
  if (!cap) throw new FixedAssetsServiceError('Capitalization record not found')

  const user = getSessionUser()
  const updated: AssetCapitalization = {
    ...cap,
    status: 'Capitalized',
    approvedBy: user.name,
    approvedAt: new Date().toISOString(),
  }
  capitalizationsStore = capitalizationsStore.map((c) => (c.id === cap.id ? updated : c))

  assetsStore = assetsStore.map((a) =>
    a.id === cap.assetId
      ? {
          ...a,
          status: 'Active',
          capitalizationDate: cap.capitalizationDate,
          modifiedAt: new Date().toISOString(),
        }
      : a,
  )

  pushAudit('AssetCapitalization', cap.id, 'Capitalize', `Capitalized asset ${cap.assetNumber} (demo only; no GL posting)`)
  return clone(updated)
}

// ─── Depreciation ─────────────────────────────────────────────────────────────

export async function getDepreciationRuns(): Promise<DepreciationRun[]> {
  if (isApiMode()) {
    const le = await resolveDefaultLegalEntity()
    const items = await unwrapApiData(fetchDepreciationRuns({ legalEntityId: le.id }))
    return items.map(mapDepreciationRunDto)
  }

  await delay()
  return clone(depreciationRunsStore)
}

export async function getDepreciationRunById(id: string): Promise<DepreciationRun | null> {
  if (isApiMode()) {
    try {
      const dto = await unwrapApiData(fetchDepreciationRun(id))
      return mapDepreciationRunDto(dto)
    } catch {
      return null
    }
  }

  await delay()
  const run = depreciationRunsStore.find((r) => r.id === id)
  return run ? clone(run) : null
}

export async function previewDepreciationDemo(period: string): Promise<DepreciationPreview> {
  if (isApiMode()) {
    const le = await resolveDefaultLegalEntity()
    const periodKey = /^\d{4}-\d{2}$/.test(period) ? period : period.replace(/\s+/g, '-').slice(0, 7)
    const dto = await unwrapApiData(
      previewDepreciationRun({ legalEntityId: le.id, periodKey }),
    )
    return mapPreviewDto(
      dto,
      `Depreciation preview for ${dto.periodKey} — ${dto.assetCount} assets, total ${money(dto.totalDepreciation).toLocaleString('en-IN')}.`,
    )
  }

  await delay()
  const draftRun = depreciationRunsStore.find((r) => r.period === period || r.status === 'Draft')
  if (draftRun) {
    return {
      period: draftRun.period,
      periodFrom: draftRun.periodFrom,
      periodTo: draftRun.periodTo,
      assetCount: draftRun.assetCount,
      totalDepreciation: draftRun.totalDepreciation,
      lines: clone(draftRun.lines),
      message: 'Preview based on existing draft run. Demo only — no GL posting.',
    }
  }

  const eligible = assetsStore.filter((a) => a.status === 'Active' && a.netBookValue > a.residualValue)
  const lines = eligible.slice(0, 5).map((a, i) => ({
    id: `fadl-prev-${i}`,
    runId: 'preview',
    assetId: a.id,
    assetNumber: a.assetNumber,
    assetName: a.name,
    categoryName: a.categoryName,
    method: a.depreciationMethod,
    period,
    openingWDV: a.netBookValue,
    depreciationAmount: Math.round((a.acquisitionCost - a.residualValue) / (a.usefulLifeYears * 12)),
    closingWDV: a.netBookValue,
    accumulatedDepreciation: a.accumulatedDepreciation,
    netBookValue: a.netBookValue,
  }))

  return {
    period,
    periodFrom: `${period.split(' ')[1] ?? '2026'}-07-01`,
    periodTo: `${period.split(' ')[1] ?? '2026'}-07-31`,
    assetCount: lines.length,
    totalDepreciation: lines.reduce((s, l) => s + l.depreciationAmount, 0),
    lines,
    message: 'Generated preview for demo. No GL posting will occur.',
  }
}

export async function postDepreciationDemo(runId: string, periodKey?: string): Promise<{ run: DepreciationRun; message: string }> {
  if (isApiMode()) {
    const le = await resolveDefaultLegalEntity()
    const pk = periodKey ?? runId
    if (!/^\d{4}-\d{2}$/.test(pk)) {
      throw new FixedAssetsServiceError('Period must be YYYY-MM for depreciation posting')
    }
    const result = await unwrapApiData(
      createDepreciationRun({ legalEntityId: le.id, periodKey: pk }),
    )
    const run = mapDepreciationRunDto(result.run)
    return {
      run,
      message: result.idempotentReplay
        ? 'Depreciation run replayed (already posted for this period).'
        : 'Depreciation posted to the general ledger.',
    }
  }

  await delay()
  const run = depreciationRunsStore.find((r) => r.id === runId)
  if (!run) throw new FixedAssetsServiceError('Depreciation run not found')
  if (run.status === 'Posted') throw new FixedAssetsServiceError('Depreciation run already posted')

  const user = getSessionUser()
  const updated: DepreciationRun = {
    ...run,
    status: 'Posted',
    postedBy: user.name,
    postedAt: new Date().toISOString(),
  }
  depreciationRunsStore = depreciationRunsStore.map((r) => (r.id === runId ? updated : r))

  for (const line of run.lines) {
    assetsStore = assetsStore.map((a) =>
      a.id === line.assetId
        ? {
            ...a,
            accumulatedDepreciation: a.accumulatedDepreciation + line.depreciationAmount,
            netBookValue: Math.max(a.residualValue, a.netBookValue - line.depreciationAmount),
            modifiedAt: new Date().toISOString(),
          }
        : a,
    )
  }

  pushAudit('DepreciationRun', runId, 'Post', `Posted ${run.period} depreciation — demo only; no GL journal created`)
  return {
    run: clone(updated),
    message: 'Depreciation marked as posted in demo store. No real GL entries were created.',
  }
}

// ─── Transfers / maintenance / revaluation / impairment ───────────────────────

function mapTransferDto(row: FixedAssetTransferDto): AssetTransfer {
  return {
    id: row.id,
    transferNumber: row.transferNumber,
    transferDate: row.transferDate,
    assetId: row.assetId,
    assetNumber: row.assetNumber,
    assetName: row.assetName,
    fromLocation: row.fromLocation ?? '',
    fromPlant: row.fromPlant ?? '',
    fromDepartment: row.fromDepartment ?? '',
    fromCustodian: row.fromCustodian ?? '',
    toLocation: row.toLocation ?? '',
    toPlant: row.toPlant ?? '',
    toDepartment: row.toDepartment ?? '',
    toCustodian: row.toCustodian ?? '',
    status: row.status,
    reason: row.reason,
    approvedBy: null,
    approvedAt: row.completedAt,
    createdBy: '—',
    createdAt: row.createdAt,
  }
}

export async function getTransfers(): Promise<AssetTransfer[]> {
  if (isApiMode()) {
    const le = await resolveDefaultLegalEntity()
    const rows = await unwrapApiData(
      fetchFixedAssetTransfers({ legalEntityId: le.id, pageSize: 200 }),
    )
    return rows.map(mapTransferDto)
  }
  await delay()
  return clone(transfersStore)
}

export async function createTransfer(partial?: Partial<AssetTransfer>): Promise<AssetTransfer> {
  if (isApiMode()) {
    if (!partial?.assetId) throw new FixedAssetsServiceError('Asset is required')
    if (!partial.reason?.trim()) throw new FixedAssetsServiceError('Reason is required')
    const le = await resolveDefaultLegalEntity()
    const created = await unwrapApiData(
      createFixedAssetTransfer({
        legalEntityId: le.id,
        assetId: partial.assetId,
        transferDate: partial.transferDate,
        toLocation: partial.toLocation || undefined,
        toPlant: partial.toPlant || undefined,
        toDepartment: partial.toDepartment || undefined,
        toCustodian: partial.toCustodian || undefined,
        reason: partial.reason.trim(),
      }),
    )
    return mapTransferDto(created)
  }
  return createTransferDemo(partial)
}

export async function createTransferDemo(partial?: Partial<AssetTransfer>): Promise<AssetTransfer> {
  await delay()
  const user = getSessionUser()
  const asset = partial?.assetId ? assetsStore.find((a) => a.id === partial.assetId) : assetsStore[0]
  if (!asset) throw new FixedAssetsServiceError('Asset not found for transfer')

  const trf: AssetTransfer = {
    id: `fatr-${Date.now()}`,
    transferNumber: nextNumber(
      'TRF',
      transfersStore.map((t) => t.transferNumber),
    ),
    transferDate: partial?.transferDate ?? new Date().toISOString().slice(0, 10),
    assetId: asset.id,
    assetNumber: asset.assetNumber,
    assetName: asset.name,
    fromLocation: partial?.fromLocation ?? asset.location,
    fromPlant: partial?.fromPlant ?? asset.plant,
    fromDepartment: partial?.fromDepartment ?? asset.department,
    fromCustodian: partial?.fromCustodian ?? asset.custodian,
    toLocation: partial?.toLocation ?? asset.location,
    toPlant: partial?.toPlant ?? asset.plant,
    toDepartment: partial?.toDepartment ?? asset.department,
    toCustodian: partial?.toCustodian ?? asset.custodian,
    status: 'Draft',
    reason: partial?.reason ?? 'Demo transfer',
    approvedBy: null,
    approvedAt: null,
    createdBy: user.name,
    createdAt: new Date().toISOString(),
  }
  transfersStore = [trf, ...transfersStore]
  pushAudit('AssetTransfer', trf.id, 'Create', `Created transfer ${trf.transferNumber}`)
  return clone(trf)
}

export async function completeTransfer(id: string): Promise<AssetTransfer> {
  if (isApiMode()) {
    const completed = await unwrapApiData(completeFixedAssetTransfer(id))
    return mapTransferDto(completed)
  }

  await delay()
  const trf = transfersStore.find((t) => t.id === id)
  if (!trf) throw new FixedAssetsServiceError('Transfer not found')
  if (trf.status === 'Completed') return clone(trf)
  if (trf.status !== 'Draft') throw new FixedAssetsServiceError('Only draft transfers can be completed')

  const user = getSessionUser()
  const updated: AssetTransfer = {
    ...trf,
    status: 'Completed',
    approvedBy: user.name,
    approvedAt: new Date().toISOString(),
  }
  transfersStore = transfersStore.map((t) => (t.id === id ? updated : t))
  assetsStore = assetsStore.map((a) =>
    a.id === trf.assetId
      ? {
          ...a,
          location: trf.toLocation || a.location,
          plant: trf.toPlant || a.plant,
          department: trf.toDepartment || a.department,
          custodian: trf.toCustodian || a.custodian,
          modifiedAt: new Date().toISOString(),
        }
      : a,
  )
  pushAudit('AssetTransfer', id, 'Complete', `Completed transfer ${trf.transferNumber} (demo — no GL)`)
  return clone(updated)
}

export async function getMaintenance(): Promise<AssetMaintenance[]> {
  await delay()
  return clone(maintenanceStore)
}

export async function getRevaluations(): Promise<AssetRevaluation[]> {
  await delay()
  return clone(revaluationsStore)
}

export async function getImpairments(): Promise<AssetImpairment[]> {
  await delay()
  return clone(impairmentsStore)
}

// ─── Disposal ─────────────────────────────────────────────────────────────────

export async function getDisposals(): Promise<AssetDisposal[]> {
  if (isApiMode()) {
    const le = await resolveDefaultLegalEntity()
    const disposed = await unwrapApiData(
      fetchFixedAssets({ legalEntityId: le.id, status: 'DISPOSED', pageSize: 200 }),
    )
    return disposed.map((a) => ({
      id: a.id,
      disposalNumber: a.assetNumber,
      assetId: a.id,
      assetNumber: a.assetNumber,
      assetName: a.name,
      disposalType: (a.disposalType as DisposalType) ?? 'Write-off',
      disposalDate: a.disposalDate ?? a.disposedAt?.slice(0, 10) ?? a.updatedAt.slice(0, 10),
      proceeds: money(a.disposalProceeds),
      nbv: money(a.disposalProceeds) - money(a.disposalGainLoss),
      gainLoss: money(a.disposalGainLoss),
      status: 'Completed' as const,
      buyerName: a.disposalBuyerName ?? null,
      reason: a.disposalReason ?? 'Disposed',
      approvedBy: null,
      approvedAt: a.disposedAt ?? null,
      createdBy: '—',
      createdAt: a.disposedAt ?? a.updatedAt,
    }))
  }

  await delay()
  return clone(disposalsStore)
}

export async function createDisposalDemo(partial?: Partial<AssetDisposal>): Promise<AssetDisposal> {
  if (isApiMode()) {
    throw new FixedAssetsServiceError('In API mode use postDisposal instead of draft create')
  }
  await delay()
  const user = getSessionUser()
  const asset = partial?.assetId ? assetsStore.find((a) => a.id === partial.assetId) : assetsStore.find((a) => a.status === 'Held for Disposal')
  if (!asset) throw new FixedAssetsServiceError('Asset not found for disposal')

  const disposalType = partial?.disposalType ?? 'Sale'
  const proceeds = partial?.proceeds ?? 0
  const nbv = asset.netBookValue
  const gainLoss = proceeds - nbv

  const dsp: AssetDisposal = {
    id: `fadsp-${Date.now()}`,
    disposalNumber: nextNumber(
      'DSP',
      disposalsStore.map((d) => d.disposalNumber),
    ),
    assetId: asset.id,
    assetNumber: asset.assetNumber,
    assetName: asset.name,
    disposalType,
    disposalDate: partial?.disposalDate ?? new Date().toISOString().slice(0, 10),
    proceeds,
    nbv,
    gainLoss,
    status: 'Draft',
    buyerName: partial?.buyerName ?? null,
    reason: partial?.reason ?? 'Demo disposal',
    approvedBy: null,
    approvedAt: null,
    createdBy: user.name,
    createdAt: new Date().toISOString(),
  }
  disposalsStore = [dsp, ...disposalsStore]
  pushAudit('AssetDisposal', dsp.id, 'Create', `Created disposal ${dsp.disposalNumber}`)
  return clone(dsp)
}

const DISPOSAL_TYPE_TO_API: Record<DisposalType, 'SALE' | 'SCRAP' | 'WRITE_OFF'> = {
  Sale: 'SALE',
  Scrap: 'SCRAP',
  'Write-off': 'WRITE_OFF',
  'Theft or Loss': 'WRITE_OFF',
  Exchange: 'SALE',
}

export async function previewDisposalGainLoss(
  assetId: string,
  type: DisposalType,
  proceeds: number,
  disposeCostAmount?: number,
): Promise<DisposalGainLossPreview> {
  if (isApiMode()) {
    const preview = await unwrapApiData(
      previewFixedAssetDispose(assetId, {
        disposalType: DISPOSAL_TYPE_TO_API[type] ?? 'WRITE_OFF',
        proceeds: String(proceeds),
        disposeCostAmount:
          disposeCostAmount != null && disposeCostAmount > 0 ? String(disposeCostAmount) : undefined,
      }),
    )
    return {
      assetId: preview.assetId,
      assetNumber: preview.assetNumber,
      assetName: preview.assetName,
      disposalType: type,
      nbv: money(preview.isPartial ? preview.disposedNbv ?? preview.netBookValue : preview.netBookValue),
      proceeds: money(preview.proceeds),
      gainLoss: money(preview.gainLoss),
      isGain: preview.isGain,
      isPartial: preview.isPartial,
      disposeCostAmount: preview.disposeCostAmount != null ? money(preview.disposeCostAmount) : null,
      remainingCost: preview.remainingCost != null ? money(preview.remainingCost) : null,
      remainingNbv: preview.remainingNbv != null ? money(preview.remainingNbv) : null,
    }
  }

  await delay()
  const asset = assetsStore.find((a) => a.id === assetId)
  if (!asset) throw new FixedAssetsServiceError('Asset not found')

  const isPartial =
    disposeCostAmount != null && disposeCostAmount > 0 && disposeCostAmount < asset.acquisitionCost
  const ratio = isPartial ? disposeCostAmount! / asset.acquisitionCost : 1
  const nbv = isPartial ? Math.round(asset.netBookValue * ratio) : asset.netBookValue
  const gainLoss = proceeds - nbv
  return {
    assetId: asset.id,
    assetNumber: asset.assetNumber,
    assetName: asset.name,
    disposalType: type,
    nbv,
    proceeds,
    gainLoss,
    isGain: gainLoss >= 0,
    isPartial,
    disposeCostAmount: isPartial ? disposeCostAmount! : null,
    remainingCost: isPartial ? asset.acquisitionCost - disposeCostAmount! : null,
    remainingNbv: isPartial ? asset.netBookValue - nbv : null,
  }
}

/** API-mode atomic dispose (posts GL). Demo mode uses create + complete. */
export async function postDisposal(input: {
  assetId: string
  disposalType: DisposalType
  proceeds: number
  disposeCostAmount?: number
  proceedsAccountId?: string
  buyerName?: string
  reason: string
  disposalDate?: string
}): Promise<{ asset: FixedAsset; gainLoss: number; idempotentReplay: boolean; isPartial: boolean }> {
  if (!isApiMode()) {
    throw new FixedAssetsServiceError('postDisposal is API-mode only')
  }
  const result = await unwrapApiData(
    disposeFixedAsset(input.assetId, {
      disposalType: DISPOSAL_TYPE_TO_API[input.disposalType] ?? 'WRITE_OFF',
      proceeds: String(input.proceeds),
      disposeCostAmount:
        input.disposeCostAmount != null && input.disposeCostAmount > 0
          ? String(input.disposeCostAmount)
          : undefined,
      proceedsAccountId: input.proceedsAccountId,
      buyerName: input.buyerName,
      reason: input.reason,
      disposalDate: input.disposalDate,
      postingDate: input.disposalDate,
    }),
  )
  return {
    asset: mapAssetDto(result.asset),
    gainLoss: money(result.preview.gainLoss),
    idempotentReplay: result.idempotentReplay,
    isPartial: !!result.isPartial,
  }
}

export async function completeDisposalDemo(id: string): Promise<AssetDisposal> {
  if (isApiMode()) {
    throw new FixedAssetsServiceError('In API mode disposal posts immediately via postDisposal')
  }
  await delay()
  const dsp = disposalsStore.find((d) => d.id === id)
  if (!dsp) throw new FixedAssetsServiceError('Disposal not found')

  const user = getSessionUser()
  const updated: AssetDisposal = {
    ...dsp,
    status: 'Completed',
    approvedBy: user.name,
    approvedAt: new Date().toISOString(),
  }
  disposalsStore = disposalsStore.map((d) => (d.id === id ? updated : d))

  const newStatus = dsp.disposalType === 'Sale' ? 'Sold' : dsp.disposalType === 'Scrap' ? 'Disposed' : 'Written Off'
  assetsStore = assetsStore.map((a) =>
    a.id === dsp.assetId ? { ...a, status: newStatus, netBookValue: 0, modifiedAt: new Date().toISOString() } : a,
  )

  pushAudit('AssetDisposal', id, 'Complete', `Completed ${dsp.disposalType} disposal for ${dsp.assetNumber} (demo only)`)
  return clone(updated)
}

// ─── Verification / ledger / reports / setup ──────────────────────────────────

export async function getVerifications(): Promise<PhysicalVerification[]> {
  await delay()
  return clone(verificationsStore)
}

export async function getVerificationById(id: string): Promise<PhysicalVerification | null> {
  await delay()
  const ver = verificationsStore.find((v) => v.id === id)
  return ver ? clone(ver) : null
}

export async function getAssetLedger(assetId?: string): Promise<AssetLedgerEntry[]> {
  await delay()
  const list = assetId ? ledgerStore.filter((e) => e.assetId === assetId) : ledgerStore
  return clone(list)
}

export async function getReports(): Promise<FixedAssetsReportCard[]> {
  await delay()
  return [
    { id: 'rpt-register', name: 'Asset Register', description: 'Complete fixed asset register with NBV', category: 'Register', lastGeneratedAt: '2026-07-10T10:00:00.000Z' },
    { id: 'rpt-dep-schedule', name: 'Depreciation Schedule', description: 'Monthly depreciation by asset and category', category: 'Depreciation', lastGeneratedAt: '2026-07-14T10:00:00.000Z' },
    { id: 'rpt-dep-run', name: 'Depreciation Run Report', description: 'Posted and draft depreciation runs', category: 'Depreciation', lastGeneratedAt: '2026-06-30T16:00:00.000Z' },
    { id: 'rpt-verification', name: 'Physical Verification Report', description: 'Verification status and variances', category: 'Compliance', lastGeneratedAt: '2026-04-06T16:00:00.000Z' },
    { id: 'rpt-disposal', name: 'Asset Disposal Register', description: 'Disposals with gain/loss summary', category: 'Register', lastGeneratedAt: null },
    { id: 'rpt-category', name: 'Assets by Category', description: 'NBV and count grouped by category', category: 'Analysis', lastGeneratedAt: '2026-07-01T10:00:00.000Z' },
    { id: 'rpt-insurance', name: 'Insurance Expiry Report', description: 'Assets with insurance due for renewal', category: 'Compliance', lastGeneratedAt: null },
    { id: 'rpt-wdv', name: 'WDV Schedule (IT Act)', description: 'Written down value per Income Tax Act', category: 'Depreciation', lastGeneratedAt: '2026-07-01T10:00:00.000Z' },
  ]
}

export async function getSetup(): Promise<FixedAssetsSetup> {
  await delay()
  return clone(setupStore)
}

export async function updateSetupDemo(patch: Partial<FixedAssetsSetup>): Promise<FixedAssetsSetup> {
  await delay()
  setupStore = { ...setupStore, ...patch }
  pushAudit('Setup', 'fixed-assets', 'Update', 'Updated fixed assets setup configuration')
  return clone(setupStore)
}

export async function getAuditTrail(entityType?: string, entityId?: string): Promise<FixedAssetsAuditEntry[]> {
  await delay()
  return clone(
    auditStore.filter((a) => {
      if (entityType && a.entityType !== entityType) return false
      if (entityId && a.entityId !== entityId) return false
      return true
    }),
  )
}

export async function exportFixedAssetsData(
  req: FixedAssetsExportRequest,
): Promise<{ fileName: string; rowCount: number; format: string }> {
  await delay()
  let rowCount = 0
  if (req.reportName.toLowerCase().includes('register')) rowCount = (await getAssets(req.filter)).length
  else if (req.reportName.toLowerCase().includes('depreciation')) rowCount = depreciationRunsStore.length
  else if (req.reportName.toLowerCase().includes('disposal')) rowCount = disposalsStore.length
  else rowCount = assetsStore.length

  pushAudit('Export', req.reportName, 'Export', `Exported ${rowCount} rows as ${req.format}`)
  return {
    fileName: `${req.reportName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${req.format}`,
    rowCount,
    format: req.format,
  }
}

export async function getFixedAssetsPrintPreview(
  reportName: string,
  filter?: Partial<FixedAssetsFilter>,
): Promise<FixedAssetsPrintPreview> {
  await delay()
  const f = filter ?? {}
  let rows: Array<Record<string, string | number | null>> = []

  if (reportName.toLowerCase().includes('register')) {
    rows = (await getAssets(f)).map((a) => ({
      'Asset No': a.assetNumber,
      Name: a.name,
      Category: a.categoryName,
      Status: a.status,
      Cost: a.acquisitionCost,
      NBV: a.netBookValue,
      Location: a.location,
    }))
  } else if (reportName.toLowerCase().includes('depreciation')) {
    const run = depreciationRunsStore.find((r) => r.status === 'Draft') ?? depreciationRunsStore[0]
    rows = (run?.lines ?? []).map((l) => ({
      Asset: l.assetNumber,
      Name: l.assetName,
      Method: l.method,
      Opening: l.openingWDV,
      Depreciation: l.depreciationAmount,
      Closing: l.closingWDV,
    }))
  } else {
    rows = categoriesStore.map((c) => ({
      Code: c.code,
      Name: c.name,
      Method: c.depreciationMethod,
      'Useful Life': c.usefulLifeYears,
      'GL Asset': c.glAssetAccount,
    }))
  }

  return {
    reportName,
    generatedAt: new Date().toISOString(),
    companyName: COMPANY_NAME,
    filterSummary: f.search ? `Search: ${f.search}` : 'All records',
    rows,
  }
}

export function resetFixedAssetsDemo(): void {
  categoriesStore = seedFixedAssetCategories()
  assetsStore = seedFixedAssets()
  componentsStore = seedFixedAssetComponents()
  acquisitionsStore = seedAssetAcquisitions()
  capitalizationsStore = seedAssetCapitalizations()
  depreciationRunsStore = seedDepreciationRuns()
  transfersStore = seedAssetTransfers()
  maintenanceStore = seedAssetMaintenance()
  revaluationsStore = seedAssetRevaluations()
  impairmentsStore = seedAssetImpairments()
  disposalsStore = seedAssetDisposals()
  verificationsStore = seedPhysicalVerifications()
  ledgerStore = seedAssetLedger()
  setupStore = seedFixedAssetsSetup()
  auditStore = seedFixedAssetsAudit()
}
