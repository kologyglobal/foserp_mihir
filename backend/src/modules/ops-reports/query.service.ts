import { AuthorizationError } from '../../utils/errors.js'
import { REPORT_EXECUTORS } from './executors/index.js'
import { reportFiltersSchema } from './filters.js'
import { findReportDefinition } from './registry.js'
import { ReportNotFoundError } from './ops-reports.errors.js'
import { buildReportResult, buildUnavailableReportResult } from './response.js'
import { resolveTenantTimezone } from './timezone.js'
import type { ReportDefinition, ReportResult } from './types.js'

function hasPermission(userPerms: string[], permission: string): boolean {
  return userPerms.includes('tenant.manage') || userPerms.includes(permission)
}

export function assertCanViewReport(definition: ReportDefinition, userPerms: string[]): void {
  if (!hasPermission(userPerms, definition.permission)) {
    throw new AuthorizationError(`Missing permission: ${definition.permission}`)
  }
}

export interface ExecuteReportOptions {
  /** Overrides filters.pageSize (used by export to fetch the full bounded set in one page). */
  pageSizeOverride?: number
}

export async function executeReport(
  tenantId: string,
  reportKey: string,
  rawFilters: Record<string, unknown>,
  userPerms: string[],
  options: ExecuteReportOptions = {},
): Promise<ReportResult> {
  const definition = findReportDefinition(reportKey)
  if (!definition) throw new ReportNotFoundError(reportKey)
  assertCanViewReport(definition, userPerms)

  const filters = reportFiltersSchema.parse(rawFilters ?? {})
  const timezone = await resolveTenantTimezone(tenantId)
  const pageSize = options.pageSizeOverride ?? filters.pageSize

  if (definition.availability === 'UNAVAILABLE') {
    return buildUnavailableReportResult({ definition, filters, timezone, pageSize })
  }

  const executor = REPORT_EXECUTORS[reportKey]
  if (!executor) throw new ReportNotFoundError(reportKey)

  const output = await executor({ tenantId, filters, timezone, userPerms })

  return buildReportResult({
    definition,
    filters,
    timezone,
    output,
    page: options.pageSizeOverride ? 1 : filters.page,
    pageSize,
  })
}
