import { z } from 'zod'
import { paginationSchema } from '../../utils/pagination.js'
import { ADMIN_AUDIT_MODULES } from './security.constants.js'

export const listLoginActivityQuerySchema = paginationSchema.extend({
  success: z.enum(['true', 'false', 'all']).optional().default('all'),
  email: z.string().trim().max(255).optional(),
  userId: z.string().uuid().optional(),
})

export const listSessionsQuerySchema = paginationSchema.extend({
  userId: z.string().uuid().optional(),
})

export const sessionIdParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  sessionId: z.string().uuid(),
})

export const lockUserParamSchema = z.object({
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
  userId: z.string().uuid(),
})

export const listAuditLogsQuerySchema = paginationSchema.extend({
  module: z.string().trim().max(64).optional(),
  entity: z.string().trim().max(64).optional(),
  action: z.string().trim().max(64).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  modules: z.string().trim().max(500).optional().default(ADMIN_AUDIT_MODULES.join(',')),
})

export const updateSecurityPolicySchema = z.object({
  passwordMinLength: z.coerce.number().int().min(8).max(128).optional(),
  maxFailedLogins: z.coerce.number().int().min(3).max(50).optional(),
  requireComplexity: z.boolean().optional(),
  mfaMode: z.enum(['off', 'optional', 'required']).optional(),
})

export type ListLoginActivityQuery = z.infer<typeof listLoginActivityQuerySchema>
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>
export type UpdateSecurityPolicyInput = z.infer<typeof updateSecurityPolicySchema>
