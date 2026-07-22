import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../../legal-entities/legal-entity.validation.js'

export const listTreasuryAccountsQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  accountType: z.enum(['BANK', 'CASH', 'CLEARING']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CLOSED']).optional(),
})

const bankProfileInputSchema = z.object({
  bankName: z.string().trim().min(1).max(200),
  branchName: z.string().trim().max(200).optional(),
  ifscCode: z.string().trim().max(11).optional(),
  swiftCode: z.string().trim().max(11).optional(),
  micrCode: z.string().trim().max(20).optional(),
  bankAccountKind: z
    .enum(['CURRENT', 'SAVINGS', 'OVERDRAFT', 'CASH_CREDIT', 'ESCROW', 'VIRTUAL', 'NOSTRO', 'OTHER'])
    .default('CURRENT'),
  /** Plaintext — write-only. Never persisted as-is; see treasury-account-security.service.ts. */
  accountNumber: z.string().trim().min(4).max(34).optional(),
  accountHolderName: z.string().trim().max(200).optional(),
  overdraftLimit: z.coerce.number().min(0).optional(),
  upiVpa: z.string().trim().max(100).optional(),
})

const cashProfileInputSchema = z.object({
  custodianName: z.string().trim().max(200).optional(),
  custodianUserId: z.string().uuid().optional(),
  locationDescription: z.string().trim().max(300).optional(),
  imprestLimit: z.coerce.number().min(0).optional(),
})

const createTreasuryAccountBaseSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  accountType: z.enum(['BANK', 'CASH', 'CLEARING']),
  glAccountId: z.string().uuid(),
  currencyCode: z.string().trim().max(8).default('INR'),
  description: z.string().trim().max(500).optional(),
  bankProfile: bankProfileInputSchema.optional(),
  cashProfile: cashProfileInputSchema.optional(),
})

export const createTreasuryAccountSchema = createTreasuryAccountBaseSchema.superRefine((data, ctx) => {
  if (data.accountType === 'BANK' && !data.bankProfile) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bankProfile'], message: 'bankProfile is required for BANK accounts' })
  }
  if (data.accountType !== 'BANK' && data.bankProfile) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bankProfile'], message: 'bankProfile is only allowed for BANK accounts' })
  }
  if (data.accountType !== 'CASH' && data.cashProfile) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cashProfile'], message: 'cashProfile is only allowed for CASH accounts' })
  }
})

export const updateTreasuryAccountSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  branchId: z.string().uuid().nullable().optional(),
  glAccountId: z.string().uuid().optional(),
  currencyCode: z.string().trim().max(8).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  bankProfile: bankProfileInputSchema.partial().optional(),
  cashProfile: cashProfileInputSchema.optional(),
  expectedUpdatedAt: z.string().datetime(),
})

export const treasuryAccountLifecycleSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  reason: z.string().trim().max(500).optional(),
})

export type ListTreasuryAccountsQuery = z.infer<typeof listTreasuryAccountsQuerySchema>
export type CreateTreasuryAccountInput = z.infer<typeof createTreasuryAccountSchema>
export type UpdateTreasuryAccountInput = z.infer<typeof updateTreasuryAccountSchema>
export type TreasuryAccountLifecycleInput = z.infer<typeof treasuryAccountLifecycleSchema>
export type BankProfileInput = z.infer<typeof bankProfileInputSchema>
export type CashProfileInput = z.infer<typeof cashProfileInputSchema>
