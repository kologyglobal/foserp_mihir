import { z } from 'zod'

export const loginSchema = z.object({
  tenantSlug: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

export const forgotPasswordSchema = z.object({
  tenantSlug: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
})

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
})

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  mobile: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === '' ? null : v)),
  designation: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v == null || v === '' ? null : v)),
})

/** Dev login helper — lists users for a tenant (no secrets). */
export const loginDirectoryQuerySchema = z.object({
  tenantSlug: z.string().trim().min(2).max(100),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>
export type LogoutInput = z.infer<typeof logoutSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type LoginDirectoryQuery = z.infer<typeof loginDirectoryQuerySchema>
