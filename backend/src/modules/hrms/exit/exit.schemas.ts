import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const exitTypes = [
  'RESIGNATION',
  'TERMINATION',
  'RETIREMENT',
  'CONTRACT_END',
  'ABSCONDING',
  'OTHER',
] as const

export const exitStatuses = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'CLEARANCE_PENDING',
  'READY_FOR_SETTLEMENT',
  'SETTLED',
  'CLOSED',
  'CANCELLED',
] as const

export const noticeSettlementModes = ['recover', 'pay', 'none'] as const

export const clearanceLineStatuses = ['PENDING', 'CLEARED', 'WAIVED'] as const

export const assetLineStatuses = ['PENDING', 'RETURNED', 'NOT_RETURNED', 'DAMAGED', 'WAIVED'] as const

export const fnfSettlementStatuses = ['DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED', 'POSTED', 'PAID', 'CLOSED'] as const

export const fnfPaymentMethods = ['BANK', 'CASH'] as const

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// ─── Exit ────────────────────────────────────────────────────────────────

export const createExitSchema = z.object({
  employeeId: z.string().uuid().optional(),
  exitType: z.enum(exitTypes),
  resignationDate: dateOnly.optional(),
  requestedLastWorkingDate: dateOnly,
  noticePeriodDays: z.number().int().min(0).optional(),
  noticeSettlementMode: z.enum(noticeSettlementModes).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
  remarks: z.string().trim().min(1).max(1000).optional(),
})

export const updateExitDraftSchema = z.object({
  exitType: z.enum(exitTypes).optional(),
  resignationDate: dateOnly.nullable().optional(),
  requestedLastWorkingDate: dateOnly.optional(),
  noticePeriodDays: z.number().int().min(0).optional(),
  noticeSettlementMode: z.enum(noticeSettlementModes).optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
  remarks: z.string().trim().max(1000).nullable().optional(),
})

export const approveExitSchema = z.object({
  approvedLastWorkingDate: dateOnly.optional(),
  noticeSettlementMode: z.enum(noticeSettlementModes).optional(),
  remarks: z.string().trim().max(1000).optional(),
})

export const cancelExitSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
})

export const listExitsQuerySchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  exitType: z.enum(exitTypes).optional(),
  status: z.enum(exitStatuses).optional(),
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
})

export const listMyExitsQuerySchema = paginationSchema.extend({
  status: z.enum(exitStatuses).optional(),
})

export const exitIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  exitId: z.string().uuid(),
})

// ─── Clearance ───────────────────────────────────────────────────────────

export const clearanceLineIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  exitId: z.string().uuid(),
  lineId: z.string().uuid(),
})

export const clearClearanceLineSchema = z.object({
  remarks: z.string().trim().max(500).optional(),
})

export const waiveClearanceLineSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

// ─── Asset lines ─────────────────────────────────────────────────────────

export const assetLineIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  exitId: z.string().uuid(),
  assetLineId: z.string().uuid(),
})

export const createAssetLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  assetCategory: z.string().trim().max(64).optional(),
  recoveryAmount: z.number().min(0).optional(),
  remarks: z.string().trim().max(500).optional(),
})

export const updateAssetLineSchema = z.object({
  description: z.string().trim().min(1).max(200).optional(),
  assetCategory: z.string().trim().max(64).nullable().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
})

export const setAssetStatusSchema = z.object({
  status: z.enum(assetLineStatuses),
  recoveryAmount: z.number().min(0).optional(),
  remarks: z.string().trim().max(500).optional(),
})

// ─── Full & Final Settlement ─────────────────────────────────────────────

export const listFnfQuerySchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  status: z.enum(fnfSettlementStatuses).optional(),
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
})

export const payFnfSchema = z.object({
  treasuryAccountId: z.string().uuid(),
  method: z.enum(fnfPaymentMethods),
  paymentDate: dateOnly,
  reference: z.string().trim().max(120).optional(),
})

export type CreateExitInput = z.infer<typeof createExitSchema>
export type UpdateExitDraftInput = z.infer<typeof updateExitDraftSchema>
export type ApproveExitInput = z.infer<typeof approveExitSchema>
export type CancelExitInput = z.infer<typeof cancelExitSchema>
export type ListExitsQuery = z.infer<typeof listExitsQuerySchema>
export type ListMyExitsQuery = z.infer<typeof listMyExitsQuerySchema>
export type ClearClearanceLineInput = z.infer<typeof clearClearanceLineSchema>
export type WaiveClearanceLineInput = z.infer<typeof waiveClearanceLineSchema>
export type CreateAssetLineInput = z.infer<typeof createAssetLineSchema>
export type UpdateAssetLineInput = z.infer<typeof updateAssetLineSchema>
export type SetAssetStatusInput = z.infer<typeof setAssetStatusSchema>
export type ListFnfQuery = z.infer<typeof listFnfQuerySchema>
export type PayFnfInput = z.infer<typeof payFnfSchema>
