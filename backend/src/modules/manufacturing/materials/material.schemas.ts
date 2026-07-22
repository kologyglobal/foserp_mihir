import { z } from 'zod'

export const reserveMaterialsSchema = z.object({
  materialIds: z.array(z.string().uuid()).optional(),
})

export const issueMaterialSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0).optional(),
  idempotencyKey: z.string().trim().min(1).max(150),
  remarks: z.string().trim().max(2000).optional(),
  /** When true (or with manufacturing.material.additional_issue), allow issue beyond remaining requirement. */
  additional: z.boolean().optional(),
})

export const issuePreviewSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  additional: z.boolean().optional(),
})

export const returnMaterialSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  remarks: z.string().trim().max(2000).optional(),
})

export const shortageRequisitionSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  submit: z.boolean().default(false),
})

export const releaseReservationSchema = z.object({
  materialIds: z.array(z.string().uuid()).optional(),
  reason: z.string().trim().max(2000).optional(),
})

export const reallocateReservationSchema = z.object({
  sourceMaterialId: z.string().uuid(),
  targetWorkOrderId: z.string().uuid(),
  targetMaterialId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive(),
  reason: z.string().trim().max(2000).optional(),
})

export type ReserveMaterialsInput = z.infer<typeof reserveMaterialsSchema>
export type IssueMaterialInput = z.infer<typeof issueMaterialSchema>
export type IssuePreviewInput = z.infer<typeof issuePreviewSchema>
export type ReturnMaterialInput = z.infer<typeof returnMaterialSchema>
export type ShortageRequisitionInput = z.infer<typeof shortageRequisitionSchema>
export type ReleaseReservationInput = z.infer<typeof releaseReservationSchema>
export type ReallocateReservationInput = z.infer<typeof reallocateReservationSchema>
