import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listInspectionsQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'DECIDED', 'SUPERSEDED', 'PASSED', 'REWORK', 'REJECTED', 'CANCELLED']).optional(),
  category: z.enum(['INCOMING', 'IN_PROCESS', 'FINAL', 'SUBCONTRACT_RETURN', 'MATERIAL_RETURN', 'REWORK', 'AD_HOC']).optional(),
  productionOrderId: z.string().uuid().optional(),
})

export const createInspectionSchema = z.object({
  category: z.enum(['IN_PROCESS', 'FINAL', 'MATERIAL_RETURN', 'REWORK', 'AD_HOC']),
  productionOrderId: z.string().uuid(),
  stageId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  inspectionPlanId: z.string().uuid().optional(),
  inspectedQty: z.number().positive().optional(),
  manualSampleSize: z.number().positive().optional(),
  title: z.string().min(1).max(200).optional(),
  remarks: z.string().max(5000).optional(),
  idempotencyKey: z.string().max(150).optional(),
})

export const parameterResultSchema = z.object({
  parameterId: z.string().uuid(),
  measuredValue: z.string().max(500).nullable().optional(),
  measuredNumeric: z.number().nullable().optional(),
  passed: z.boolean().nullable().optional(),
  remarks: z.string().max(2000).nullable().optional(),
})

export const decideInspectionSchema = z.object({
  decision: z.enum(['PASS', 'CONDITIONAL_PASS', 'HOLD', 'USE_AS_IS', 'REWORK', 'REJECT']),
  acceptedQty: z.number().min(0).optional(),
  rejectedQty: z.number().min(0).optional(),
  reworkQty: z.number().min(0).optional(),
  conditionallyAcceptedQty: z.number().min(0).optional(),
  heldQty: z.number().min(0).optional(),
  scrapQty: z.number().min(0).optional(),
  pendingQty: z.number().min(0).optional(),
  stockDisposition: z.enum(['QUARANTINE', 'UNRESTRICTED', 'REWORK', 'SUPPLIER_RETURN', 'SCRAP', 'HOLD', 'USE_AS_IS']).optional(),
  remarks: z.string().max(5000).optional(),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).optional(),
  parameterResults: z.array(parameterResultSchema).optional(),
})

export const cancelInspectionSchema = z.object({
  remarks: z.string().max(5000).optional(),
})

export const productionOrderIdParamSchema = z.object({
  productionOrderId: z.string().uuid(),
})

export type ListInspectionsQuery = z.infer<typeof listInspectionsQuerySchema>
export type CreateInspectionInput = z.infer<typeof createInspectionSchema>
export type DecideInspectionInput = z.infer<typeof decideInspectionSchema>
export type CancelInspectionInput = z.infer<typeof cancelInspectionSchema>
