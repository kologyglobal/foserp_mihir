import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DEFAULT_FINANCIAL_REPORT_FILTER,
  type AccountScheduleDefinition,
  type AccountScheduleRunResult,
  type FinancialReportComparisonMode,
  type FinancialReportFilter,
  type FinancialReportViewMode,
  type ManufacturingProfitabilityRow,
  type StatementLine,
} from '@/types/financialReports'
import { cn } from '@/utils/cn'
import { formatCurrency } from '@/utils/formatters/currency'

export function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Parentheses for negatives — matches FinancialStatementTable display. */
export function formatSignedAmount(amount: number): string {
  if (amount < 0) return `(${formatCurrency(Math.abs(amount))})`
  return formatCurrency(amount)
}

export type FinancialReportLoadState = 'loading' | 'ready' | 'error' | 'empty'

export const FINANCIAL_REPORTS_BREADCRUMB = [
  { label: 'Accounting', to: '/accounting' },
  { label: 'Financial Reports', to: '/accounting/reports' },
] as const

export function financialReportsBreadcrumb(label: string) {
  return [...FINANCIAL_REPORTS_BREADCRUMB, { label }]
}

export function varianceToneClass(variance: number): string {
  if (variance > 0) return 'text-emerald-700'
  if (variance < 0) return 'text-rose-700'
  return 'text-erp-text'
}

export function marginToneClass(pct: number): string {
  if (pct >= 25) return 'text-emerald-700'
  if (pct >= 15) return 'text-erp-text'
  if (pct >= 0) return 'text-amber-700'
  return 'text-rose-700'
}

export const ACCOUNT_SCHEDULE_BC_HELP =
  'BC-style layout: Posting Accounts sum GL ranges; Total aggregates row codes; Formula evaluates expressions (e.g. 10+20); Underline/Blank control formatting. Columns map to Current/Previous period, Budget, Variance, and Variance %.'

export function scheduleRunToStatementLines(
  schedule: AccountScheduleDefinition,
  run: AccountScheduleRunResult,
): StatementLine[] {
  const colByType = (types: string[]) =>
    schedule.columns.find((c) => types.includes(c.columnType))?.id

  const amountCol =
    colByType(['CurrentYear', 'CurrentMonth']) ?? schedule.columns[0]?.id
  const priorCol = colByType(['PreviousYear', 'PreviousMonth'])
  const budgetCol = colByType(['Budget'])
  const varianceCol = colByType(['Variance'])
  const variancePctCol = colByType(['VariancePct'])

  return schedule.rows
    .filter((row) => row.show)
    .map((row) => ({
      code: row.rowCode,
      label: row.description,
      amount: amountCol ? (run.values[row.rowCode]?.[amountCol] ?? 0) : 0,
      priorAmount: priorCol ? run.values[row.rowCode]?.[priorCol] : undefined,
      budgetAmount: budgetCol ? run.values[row.rowCode]?.[budgetCol] : undefined,
      variance: varianceCol ? run.values[row.rowCode]?.[varianceCol] : undefined,
      variancePct: variancePctCol ? run.values[row.rowCode]?.[variancePctCol] : undefined,
      indent: row.indent,
      bold: row.bold || row.totalingType === 'Total',
      underline: row.underline || row.totalingType === 'Underline',
      isTotal: row.totalingType === 'Total',
      isHeader: row.totalingType === 'Blank',
      signReversed: row.signReversal,
      accountRange: row.accountRange || undefined,
    }))
}

export type ManufacturingDisplayRow = ManufacturingProfitabilityRow & {
  product: string
  category: string
  productionOrder: string
  plant: string
  qty: number
  machineCost: number
  overheadAlloc: number
  cogs: number
}

export function enrichManufacturingRow(
  row: ManufacturingProfitabilityRow,
  index: number,
): ManufacturingDisplayRow {
  const match = row.productCategory.match(/^(.+?)\s*\((.+)\)\s*$/)
  const product = match ? match[1].trim() : row.productCategory
  const category = match ? match[2].trim() : 'General'
  const plants = ['Pune Main Plant', 'Chakan Unit 2']
  return {
    ...row,
    product,
    category,
    productionOrder: row.unitsProduced > 0 ? `PO-26${String(1400 + index).padStart(4, '0')}` : '—',
    plant: row.unitsProduced > 0 ? plants[index % plants.length] : 'Central / Spares',
    qty: row.unitsProduced,
    machineCost: Math.round(row.overhead * 0.55),
    overheadAlloc: Math.round(row.overhead * 0.45),
    cogs: row.materialCost + row.labourCost + row.overhead,
  }
}

export function denseTableClass(className?: string) {
  return cn(
    'w-full min-w-[48rem] border-collapse text-[11px]',
    className,
  )
}

export const DENSE_TH_CLASS =
  'sticky top-0 z-10 whitespace-nowrap border-b border-erp-border bg-erp-surface px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-erp-muted'

export const DENSE_TD_CLASS = 'border-b border-erp-border/50 px-2 py-1 tabular-nums'

const COMPARISON_MODES = new Set<FinancialReportComparisonMode>([
  'none',
  'previous_year',
  'budget',
  'monthly',
  'quarterly',
  'ytd',
])

const VIEW_MODES = new Set<FinancialReportViewMode>(['summary', 'detailed', 'consolidated'])

function parseComparisonMode(value: string | null): FinancialReportComparisonMode {
  if (value && COMPARISON_MODES.has(value as FinancialReportComparisonMode)) {
    return value as FinancialReportComparisonMode
  }
  return DEFAULT_FINANCIAL_REPORT_FILTER.comparisonMode
}

function parseViewMode(value: string | null): FinancialReportViewMode {
  if (value && VIEW_MODES.has(value as FinancialReportViewMode)) {
    return value as FinancialReportViewMode
  }
  return DEFAULT_FINANCIAL_REPORT_FILTER.viewMode
}

/** Read shared report filters from URL search params. */
export function parseFinancialReportFilterFromSearch(searchParams: URLSearchParams): FinancialReportFilter {
  const includeZero = searchParams.get('includeZeroBalance')
  return {
    ...DEFAULT_FINANCIAL_REPORT_FILTER,
    fy: searchParams.get('fy') ?? DEFAULT_FINANCIAL_REPORT_FILTER.fy,
    fromDate: searchParams.get('from') ?? DEFAULT_FINANCIAL_REPORT_FILTER.fromDate,
    toDate: searchParams.get('to') ?? DEFAULT_FINANCIAL_REPORT_FILTER.toDate,
    location: searchParams.get('location') ?? '',
    plant: searchParams.get('plant') ?? '',
    department: searchParams.get('department') ?? '',
    costCentre: searchParams.get('costCentre') ?? '',
    project: searchParams.get('project') ?? '',
    accountGroup: searchParams.get('accountGroup') ?? '',
    includeZeroBalance: includeZero === '1' || includeZero === 'true',
    comparisonMode: parseComparisonMode(searchParams.get('comparison')),
    viewMode: parseViewMode(searchParams.get('viewMode')),
  }
}

/** Serialize filter to query string (without leading ?). */
export function financialReportFilterToSearchString(filter: FinancialReportFilter): string {
  const params = new URLSearchParams()
  const defaults = DEFAULT_FINANCIAL_REPORT_FILTER

  if (filter.fy && filter.fy !== defaults.fy) params.set('fy', filter.fy)
  if (filter.fromDate && filter.fromDate !== defaults.fromDate) params.set('from', filter.fromDate)
  if (filter.toDate && filter.toDate !== defaults.toDate) params.set('to', filter.toDate)
  if (filter.location) params.set('location', filter.location)
  if (filter.plant) params.set('plant', filter.plant)
  if (filter.department) params.set('department', filter.department)
  if (filter.costCentre) params.set('costCentre', filter.costCentre)
  if (filter.project) params.set('project', filter.project)
  if (filter.accountGroup) params.set('accountGroup', filter.accountGroup)
  if (filter.includeZeroBalance) params.set('includeZeroBalance', '1')
  if (filter.comparisonMode !== defaults.comparisonMode) params.set('comparison', filter.comparisonMode)
  if (filter.viewMode !== defaults.viewMode) params.set('viewMode', filter.viewMode)

  return params.toString()
}

export function appendFilterQuery(path: string, filter: FinancialReportFilter): string {
  const qs = financialReportFilterToSearchString(filter)
  return qs ? `${path}?${qs}` : path
}

/** Sync draft/applied filter with URL search params for cross-tab navigation. */
export function useFinancialReportFilterSync() {
  const [searchParams, setSearchParams] = useSearchParams()

  const appliedFilter = useMemo(
    () => parseFinancialReportFilterFromSearch(searchParams),
    [searchParams],
  )

  const preserveQuery = useMemo(
    () => financialReportFilterToSearchString(appliedFilter),
    [appliedFilter],
  )

  const syncFilterToUrl = useCallback(
    (filter: FinancialReportFilter) => {
      const next = financialReportFilterToSearchString(filter)
      setSearchParams(next ? new URLSearchParams(next) : {}, { replace: true })
    },
    [setSearchParams],
  )

  const resetFilter = useCallback(() => {
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  return {
    appliedFilter,
    preserveQuery,
    syncFilterToUrl,
    resetFilter,
  }
}
