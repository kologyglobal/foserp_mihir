import { z } from 'zod'
import { CORRECTION_TRANSACTION_TYPES, CORRECTION_TYPES } from './correction.enums.js'

export const listCorrectionsQuerySchema = z.object({
  status: z.string().optional(),
  transactionType: z.enum(CORRECTION_TRANSACTION_TYPES).optional(),
  productionOrderId: z.string().uuid().optional(),
  riskLevel: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export const previewCorrectionSchema = z.object({
  transactionType: z.enum(CORRECTION_TRANSACTION_TYPES),
  correctionType: z.enum(CORRECTION_TYPES).default('REVERSE_ONLY'),
  sourceEntityType: z.string().min(1).max(64),
  sourceEntityId: z.string().uuid(),
  productionOrderId: z.string().uuid().optional(),
  requestedAction: z.string().min(1).max(64).default('REVERSE'),
  requestedValues: z.record(z.unknown()).optional(),
})

export const createCorrectionSchema = previewCorrectionSchema.extend({
  reason: z.string().trim().min(1).max(2000),
  businessJustification: z.string().trim().max(2000).optional(),
  previewToken: z.string().min(1).max(150).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
})

export const updateCorrectionSchema = z.object({
  reason: z.string().trim().min(1).max(2000).optional(),
  businessJustification: z.string().trim().max(2000).optional(),
  correctionType: z.enum(CORRECTION_TYPES).optional(),
  requestedAction: z.string().min(1).max(64).optional(),
  requestedValues: z.record(z.unknown()).optional(),
})

export const rejectCorrectionSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
})

export const applyCorrectionSchema = z.object({
  previewToken: z.string().min(1).max(150).optional(),
}).passthrough()

export const cancelCorrectionSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
})

export type ListCorrectionsQuery = z.infer<typeof listCorrectionsQuerySchema>
export type PreviewCorrectionInput = z.infer<typeof previewCorrectionSchema>
export type CreateCorrectionInput = z.infer<typeof createCorrectionSchema>
export type UpdateCorrectionInput = z.infer<typeof updateCorrectionSchema>
export type RejectCorrectionInput = z.infer<typeof rejectCorrectionSchema>
export type ApplyCorrectionInput = z.infer<typeof applyCorrectionSchema>
export type CancelCorrectionInput = z.infer<typeof cancelCorrectionSchema>
