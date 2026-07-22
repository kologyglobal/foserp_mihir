import { z } from 'zod'
import { paginationSchema } from '../../../../utils/pagination.js'
import { legalEntityIdQuerySchema } from '../../legal-entities/legal-entity.validation.js'

const PAYMENT_METHODS = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'PAYMENT_GATEWAY', 'DIRECT_DEBIT', 'OTHER'] as const
const USE_CASES = [
  'CUSTOMER_RECEIPT', 'CUSTOMER_REFUND', 'VENDOR_PAYMENT', 'VENDOR_ADVANCE', 'VENDOR_REFUND',
  'BANK_TRANSFER_IN', 'BANK_TRANSFER_OUT', 'CASH_DEPOSIT', 'CASH_WITHDRAWAL', 'BANK_CHARGE',
  'BANK_INTEREST', 'CARD_SETTLEMENT', 'UPI_SETTLEMENT', 'CHEQUE_RECEIPT', 'CHEQUE_PAYMENT', 'OTHER',
] as const
const ROLES = ['DIRECT_POSTING', 'CLEARING', 'SETTLEMENT', 'CHARGE'] as const
const DIRECTIONS = ['RECEIPT', 'PAYMENT', 'BOTH'] as const

export const listPaymentAccountMappingsQuerySchema = paginationSchema.merge(legalEntityIdQuerySchema).extend({
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  useCase: z.enum(USE_CASES).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined
      if (typeof v === 'boolean') return v
      return v === 'true' || v === '1'
    }),
})

export const createPaymentAccountMappingSchema = z
  .object({
    legalEntityId: z.string().uuid(),
    branchId: z.string().uuid().nullable().optional(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    direction: z.enum(DIRECTIONS).default('BOTH'),
    useCase: z.enum(USE_CASES).default('OTHER'),
    role: z.enum(ROLES).default('DIRECT_POSTING'),
    currencyCode: z.string().trim().max(8).nullable().optional(),
    treasuryAccountId: z.string().uuid(),
    clearingAccountId: z.string().uuid().nullable().optional(),
    priority: z.number().int().min(1).max(1000).default(100),
    isDefault: z.boolean().default(false),
    description: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.role === 'CLEARING' || data.role === 'SETTLEMENT') && !data.clearingAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clearingAccountId'],
        message: 'clearingAccountId is required when role is CLEARING or SETTLEMENT',
      })
    }
  })

export const updatePaymentAccountMappingSchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  direction: z.enum(DIRECTIONS).optional(),
  currencyCode: z.string().trim().max(8).nullable().optional(),
  treasuryAccountId: z.string().uuid().optional(),
  clearingAccountId: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  isDefault: z.boolean().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  expectedUpdatedAt: z.string().datetime(),
})

export const paymentAccountMappingLifecycleSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
})

export const resolvePaymentAccountMappingSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  useCase: z.enum(USE_CASES),
  direction: z.enum(['RECEIPT', 'PAYMENT']),
  currencyCode: z.string().trim().max(8).optional(),
})

export type ListPaymentAccountMappingsQuery = z.infer<typeof listPaymentAccountMappingsQuerySchema>
export type CreatePaymentAccountMappingInput = z.infer<typeof createPaymentAccountMappingSchema>
export type UpdatePaymentAccountMappingInput = z.infer<typeof updatePaymentAccountMappingSchema>
export type PaymentAccountMappingLifecycleInput = z.infer<typeof paymentAccountMappingLifecycleSchema>
export type ResolvePaymentAccountMappingInput = z.infer<typeof resolvePaymentAccountMappingSchema>
