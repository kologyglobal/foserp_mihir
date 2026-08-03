import { z } from 'zod'

export const registerDeviceTokenSchema = z.object({
  expoPushToken: z.string().trim().min(8).max(512),
  deviceId: z.string().trim().max(128).optional().nullable(),
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().trim().max(32).optional().nullable(),
})

export const revokeDeviceTokenSchema = z.object({
  expoPushToken: z.string().trim().min(8).max(512).optional(),
  deviceId: z.string().trim().max(128).optional(),
}).refine((v) => Boolean(v.expoPushToken || v.deviceId), {
  message: 'expoPushToken or deviceId is required',
})

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>
export type RevokeDeviceTokenInput = z.infer<typeof revokeDeviceTokenSchema>
