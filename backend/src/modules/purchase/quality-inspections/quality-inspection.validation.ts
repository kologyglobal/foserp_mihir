import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const QI_STATUSES = ['DRAFT', 'PENDING', 'IN_PROGRESS', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'DEVIATION_PENDING', 'CLOSED', 'CANCELLED'] as const
export const listQualityInspectionsQuerySchema = paginationSchema.extend({
  status: z.enum(QI_STATUSES).optional(),
  goodsReceiptId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
})
export const qualityInspectionLineSchema = z.object({
  goodsReceiptLineId: z.string().uuid().optional().nullable(),
  purchaseOrderLineId: z.string().uuid().optional().nullable(),
  itemId: z.string().uuid().optional().nullable(),
  itemCode: z.string().trim().max(64).optional(),
  itemName: z.string().trim().max(300).optional(),
  inspectedQuantity: z.coerce.number().positive(),
  acceptedQuantity: z.coerce.number().min(0).default(0),
  rejectedQuantity: z.coerce.number().min(0).default(0),
  deviationQuantity: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(2000).optional().nullable(),
})
export const createQualityInspectionSchema = z.object({
  inspectionDate: z.string().trim().optional(),
  goodsReceiptId: z.string().uuid().optional().nullable(),
  purchaseOrderId: z.string().uuid().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  plantId: z.string().uuid().optional().nullable(),
  inspectedById: z.string().trim().max(36).optional().nullable(),
  inspectedByName: z.string().trim().max(200).optional().nullable(),
  remarks: z.string().trim().max(5000).optional().nullable(),
  deviationRemarks: z.string().trim().max(5000).optional().nullable(),
  lines: z.array(qualityInspectionLineSchema).min(1).optional(),
}).refine((input) => input.goodsReceiptId || input.lines?.length, { message: 'Provide a goods receipt or inspection lines.', path: ['lines'] })
export const updateQualityInspectionSchema = z.object({
  inspectionDate: z.string().trim().optional(),
  warehouseId: z.string().uuid().optional().nullable(),
  inspectedById: z.string().trim().max(36).optional().nullable(),
  inspectedByName: z.string().trim().max(200).optional().nullable(),
  remarks: z.string().trim().max(5000).optional().nullable(),
  deviationRemarks: z.string().trim().max(5000).optional().nullable(),
  lines: z.array(qualityInspectionLineSchema).min(1).optional(),
})
export const completeQualityInspectionSchema = z.object({
  outcome: z.enum(['AUTO', 'ACCEPT', 'REJECT']).default('AUTO'),
  remarks: z.string().trim().max(2000).optional(),
  deviationRemarks: z.string().trim().max(5000).optional(),
}).default({ outcome: 'AUTO' })
export const qualityInspectionRemarksSchema = z.object({ remarks: z.string().trim().max(2000).optional() }).default({})
export type ListQualityInspectionsQuery = z.infer<typeof listQualityInspectionsQuerySchema>
export type CreateQualityInspectionInput = z.infer<typeof createQualityInspectionSchema>
export type UpdateQualityInspectionInput = z.infer<typeof updateQualityInspectionSchema>
export type QualityInspectionLineInput = z.infer<typeof qualityInspectionLineSchema>
