import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type PaginationInput = z.infer<typeof paginationSchema>

export function getPagination(input: PaginationInput): { skip: number; take: number; page: number; limit: number } {
  const page = input.page
  const limit = input.limit
  return { skip: (page - 1) * limit, take: limit, page, limit }
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  }
}

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
})

export const statementLineParamSchema = z.object({
  id: z.string().uuid(),
  lineId: z.string().uuid(),
})

export const tenantIdParamSchema = z.object({
  tenantId: z.string().uuid(),
})

export const tenantSlugParamSchema = z.object({
  tenantSlug: z.string().min(2).max(100),
})

export const tenantRouteParamSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    tenantSlug: z.string().min(2).max(100).optional(),
  })
  .refine((data) => Boolean(data.tenantId ?? data.tenantSlug), {
    message: 'tenantId or tenantSlug is required',
  })
