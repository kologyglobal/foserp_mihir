import { z } from 'zod'

export const markInTransitSchema = z.object({
  remarks: z.string().trim().max(2000).optional().nullable(),
})

export type MarkInTransitInput = z.infer<typeof markInTransitSchema>

const podLineSchema = z.object({
  outboundDispatchLineId: z.string().uuid(),
  deliveredQty: z.coerce.number().min(0),
  damagedQty: z.coerce.number().min(0).optional().default(0),
  shortQty: z.coerce.number().min(0).optional().default(0),
  remarks: z.string().trim().max(500).optional().nullable(),
})

export const capturePodSchema = z.object({
  status: z
    .enum([
      'IN_TRANSIT',
      'DELIVERED',
      'PARTIALLY_DELIVERED',
      'DELIVERY_EXCEPTION',
      'REJECTED_BY_CUSTOMER',
      'RETURN_INITIATED',
    ])
    .optional(),
  deliveredAt: z.string().datetime().optional().nullable(),
  receiverName: z.string().trim().max(200).optional().nullable(),
  receiverContact: z.string().trim().max(64).optional().nullable(),
  deliveryAddress: z.string().trim().max(2000).optional().nullable(),
  quantityDelivered: z.coerce.number().min(0).optional(),
  quantityDamaged: z.coerce.number().min(0).optional(),
  quantityShort: z.coerce.number().min(0).optional(),
  deliveryRemarks: z.string().trim().max(4000).optional().nullable(),
  transporterRemarks: z.string().trim().max(4000).optional().nullable(),
  exceptionCode: z.string().trim().max(64).optional().nullable(),
  exceptionNotes: z.string().trim().max(2000).optional().nullable(),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  lines: z.array(podLineSchema).max(200).optional(),
})

export type CapturePodInput = z.infer<typeof capturePodSchema>

export const podExceptionSchema = capturePodSchema.extend({
  exceptionCode: z.string().trim().min(1).max(64),
})

export type PodExceptionInput = z.infer<typeof podExceptionSchema>

export const podAttachmentSchema = z.object({
  kind: z.enum([
    'SIGNATURE',
    'PHOTO',
    'STAMPED_INVOICE',
    'SIGNED_CHALLAN',
    'TRANSPORTER_CONFIRMATION',
    'OTHER',
  ]),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(120),
  contentBase64: z.string().min(1),
})

export type PodAttachmentInput = z.infer<typeof podAttachmentSchema>
