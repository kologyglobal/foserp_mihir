import { z } from 'zod'

export const postFgReceiptSchema = z.object({
  quantity: z.coerce.number().positive(),
  warehouseId: z.string().uuid().optional(),
  receiptDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  batchOrLotNumber: z.string().trim().max(64).optional(),
  serialNumbers: z.array(z.string().trim().min(1).max(64)).optional(),
  qualityInspectionId: z.string().uuid().optional(),
  qualityStatus: z.string().trim().max(32).optional(),
  remarks: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  /** When true, create DRAFT only (no inventory post). Default posts immediately. */
  draftOnly: z.boolean().optional(),
})

export type PostFgReceiptInput = z.infer<typeof postFgReceiptSchema>

export const previewFgReceiptSchema = z.object({
  quantity: z.coerce.number().positive().optional(),
  warehouseId: z.string().uuid().optional(),
})

export type PreviewFgReceiptInput = z.infer<typeof previewFgReceiptSchema>

export const createFgDraftSchema = postFgReceiptSchema.omit({ draftOnly: true })

export type CreateFgDraftInput = z.infer<typeof createFgDraftSchema>
