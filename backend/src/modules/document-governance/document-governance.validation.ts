import { z } from 'zod'
import { ALLOWANCE_KINDS, DATE_POLICY_MODES } from './document-governance.constants.js'

const emptyToNull = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === '' || v == null ? null : v))

export const listDateControlsQuerySchema = z.object({
  moduleKey: z.string().optional(),
  documentType: z.string().optional(),
  active: z
    .enum(['true', 'false', 'all'])
    .optional()
    .default('all'),
  policyEnabled: z.enum(['true', 'false', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

export const dateControlIdParamSchema = z.object({
  id: z.string().uuid(),
})

const allowanceSchema = z
  .object({
    kind: z.enum(ALLOWANCE_KINDS),
    roleId: emptyToNull,
    userId: emptyToNull,
  })
  .superRefine((val, ctx) => {
    const isRole = val.kind.endsWith('_ROLE')
    if (isRole && !val.roleId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'roleId required for role allowances' })
    }
    if (!isRole && !val.userId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'userId required for user allowances' })
    }
  })

const dateControlBodySchema = z.object({
  legalEntityId: emptyToNull,
  branchId: emptyToNull,
  moduleKey: z.string().min(1).max(64),
  documentType: z.string().min(1).max(64),
  policyEnabled: z.boolean().optional().default(false),
  futureDateMode: z.enum(DATE_POLICY_MODES).optional().default('CURRENT_BEHAVIOUR'),
  pastDateMode: z.enum(DATE_POLICY_MODES).optional().default('CURRENT_BEHAVIOUR'),
  maxFutureDays: z.number().int().min(0).nullable().optional(),
  maxBackDateDays: z.number().int().min(0).nullable().optional(),
  approvalRequired: z.boolean().optional().default(false),
  allowEmergencyOverride: z.boolean().optional().default(false),
  policyProfile: emptyToNull,
  profileId: emptyToNull,
  effectiveFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  effectiveTo: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  active: z.boolean().optional().default(true),
  allowances: z.array(allowanceSchema).optional().default([]),
})

function refineEffectiveRange(
  val: { effectiveFrom?: string | null; effectiveTo?: string | null },
  ctx: z.RefinementCtx,
) {
  if (val.effectiveFrom && val.effectiveTo) {
    if (new Date(val.effectiveFrom).getTime() > new Date(val.effectiveTo).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'effectiveFrom must be on or before effectiveTo',
        path: ['effectiveFrom'],
      })
    }
  }
}

export const createDateControlSchema = dateControlBodySchema.superRefine(refineEffectiveRange)

// partial() must run on ZodObject — ZodEffects (after superRefine) has no .partial()
export const updateDateControlSchema = dateControlBodySchema.partial().superRefine(refineEffectiveRange)

const profileBodySchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  futureDateMode: z.enum(DATE_POLICY_MODES).optional().default('CURRENT_BEHAVIOUR'),
  pastDateMode: z.enum(DATE_POLICY_MODES).optional().default('CURRENT_BEHAVIOUR'),
  maxFutureDays: z.number().int().min(0).nullable().optional(),
  maxBackDateDays: z.number().int().min(0).nullable().optional(),
  approvalRequired: z.boolean().optional().default(false),
  allowEmergencyOverride: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
})

export const createProfileSchema = profileBodySchema
export const updateProfileSchema = profileBodySchema.partial()

export const profileIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type CreateDateControlInput = z.infer<typeof createDateControlSchema>
export type UpdateDateControlInput = z.infer<typeof updateDateControlSchema>
export type ListDateControlsQuery = z.infer<typeof listDateControlsQuerySchema>
export type CreateProfileInput = z.infer<typeof createProfileSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
