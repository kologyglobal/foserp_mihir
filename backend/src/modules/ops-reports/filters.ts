import { z } from 'zod'

/**
 * Common filter schema shared by every Phase 7D report. Individual executors only read the
 * subset of keys relevant to them (see `ReportDefinition.filters` in registry.ts) — unknown
 * keys are simply ignored by an executor, they are not rejected here, so the same body shape
 * can be POSTed to `/reports/manufacturing/:reportKey/query` regardless of report.
 */
export const reportFiltersSchema = z
  .object({
    dateFrom: z.string().trim().min(1).optional(),
    dateTo: z.string().trim().min(1).optional(),
    plantCode: z.string().trim().min(1).optional(),
    workCentreId: z.string().uuid().optional(),
    status: z.union([z.string(), z.array(z.string())]).optional(),
    productItemId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    salesOrderId: z.string().uuid().optional(),
    workOrderId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(500).default(50),
    sortBy: z.string().trim().min(1).optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
    groupBy: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
    severity: z.string().trim().min(1).optional(),
    shift: z.string().trim().min(1).optional(),
    supervisorId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    qualityStatus: z.string().trim().min(1).optional(),
    vendorId: z.string().uuid().optional(),
    dispatchStatus: z.string().trim().min(1).optional(),
  })
  .passthrough()

export type ReportFilters = z.infer<typeof reportFiltersSchema>

export function normalizeStatusFilter(status: unknown): string[] | undefined {
  if (!status) return undefined
  return Array.isArray(status) ? status : [status as string]
}

export const reportKeyParamSchema = z.object({
  reportKey: z.string().trim().min(1).max(100),
})
