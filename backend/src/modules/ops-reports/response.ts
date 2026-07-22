import type { ReportDefinition, ReportPagination, ReportResult, ReportRow, ExecutorOutput } from './types.js'

export function paginateRows<T>(rows: T[], page: number, pageSize: number): { rows: T[]; pagination: ReportPagination } {
  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  const paged = rows.slice(start, start + pageSize)
  return { rows: paged, pagination: { page: safePage, pageSize, totalRows, totalPages } }
}

export function buildReportResult(params: {
  definition: ReportDefinition
  filters: Record<string, unknown>
  timezone: string
  output: ExecutorOutput
  page: number
  pageSize: number
}): ReportResult {
  const { definition, filters, timezone, output, page, pageSize } = params
  const { rows: pagedRows, pagination } = paginateRows<ReportRow>(output.rows, page, pageSize)
  return {
    reportKey: definition.key,
    title: definition.name,
    description: definition.description,
    generatedAt: new Date().toISOString(),
    timezone,
    filters,
    columns: output.columns ?? definition.columns,
    rows: pagedRows,
    pagination,
    summary: output.summary,
    groups: output.groups,
    chartData: output.chartData,
    warnings: output.warnings ?? [],
    dataFreshness: output.dataFreshness ?? new Date().toISOString(),
    allowedActions: output.allowedActions ?? [],
    availability: definition.availability,
  }
}

/** Builds an "unavailable"/empty ReportResult without invoking an executor. */
export function buildUnavailableReportResult(params: {
  definition: ReportDefinition
  filters: Record<string, unknown>
  timezone: string
  pageSize: number
}): ReportResult {
  const { definition, filters, timezone, pageSize } = params
  return {
    reportKey: definition.key,
    title: definition.name,
    description: definition.description,
    generatedAt: new Date().toISOString(),
    timezone,
    filters,
    columns: definition.columns,
    rows: [],
    pagination: { page: 1, pageSize, totalRows: 0, totalPages: 1 },
    warnings: [
      definition.unavailableReason ??
        'This report is unavailable in the current build — the underlying source data does not exist yet.',
    ],
    dataFreshness: new Date().toISOString(),
    allowedActions: [],
    availability: definition.availability,
  }
}
