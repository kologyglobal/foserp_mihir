/**
 * Phase 7D — Manufacturing/Quality/Dispatch reporting foundation.
 * Shared shapes for the report registry, executors, and the query/export/catalog services.
 */

export type ReportModule =
  | 'PRODUCTION'
  | 'MATERIALS'
  | 'WIP'
  | 'JOB_WORK'
  | 'QUALITY'
  | 'DISPATCH'
  | 'TRACEABILITY'
  | 'EXCEPTIONS'

export type ReportAvailability = 'READY' | 'PARTIAL' | 'UNAVAILABLE'

export type ReportColumnType = 'string' | 'number' | 'date' | 'datetime' | 'boolean' | 'currency' | 'percent'

export interface ReportColumn {
  key: string
  label: string
  type?: ReportColumnType
  sortable?: boolean
  groupable?: boolean
}

export interface ReportPagination {
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
}

export interface ReportChartSeriesPoint {
  label: string
  value: number
  [extra: string]: unknown
}

export interface ReportChartData {
  type: 'bar' | 'line' | 'pie' | 'donut'
  title?: string
  series: ReportChartSeriesPoint[]
}

export interface ReportGroup {
  key: string
  label: string
  rowCount: number
  summary?: Record<string, unknown>
}

export type ReportRow = Record<string, unknown>

/** Canonical shape returned by every report query/export. */
export interface ReportResult {
  reportKey: string
  title: string
  description: string
  generatedAt: string
  timezone: string
  filters: Record<string, unknown>
  columns: ReportColumn[]
  rows: ReportRow[]
  pagination: ReportPagination
  summary?: Record<string, unknown>
  groups?: ReportGroup[]
  chartData?: ReportChartData[]
  warnings: string[]
  dataFreshness: string
  allowedActions: string[]
  availability: ReportAvailability
}

/** Registry entry — static metadata describing a report (no data). */
export interface ReportDefinition {
  key: string
  name: string
  module: ReportModule
  description: string
  /** Permission required to view this report (checked against req.context.permissions). */
  permission: string
  /** Common filter keys (from filters.ts) this report understands. */
  filters: string[]
  columns: ReportColumn[]
  defaultColumns: string[]
  exportSupported: boolean
  /** Which date field the report's date filters apply to, for UI hinting. */
  dateBasis: string
  calculationNotes: string
  availability: ReportAvailability
  unavailableReason?: string
}

/** Input passed to a report executor after filter validation + timezone resolution. */
export interface ExecutorContext {
  tenantId: string
  filters: Record<string, unknown>
  timezone: string
  userPerms: string[]
}

/** Output returned by a report executor — merged with registry metadata by query.service. */
export interface ExecutorOutput {
  /** Override registry columns when the executor computes columns dynamically. */
  columns?: ReportColumn[]
  rows: ReportRow[]
  summary?: Record<string, unknown>
  groups?: ReportGroup[]
  chartData?: ReportChartData[]
  warnings?: string[]
  allowedActions?: string[]
  dataFreshness?: string
}

export type ReportExecutor = (ctx: ExecutorContext) => Promise<ExecutorOutput>
