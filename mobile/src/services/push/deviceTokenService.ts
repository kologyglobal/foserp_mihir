import { apiClient, tenantPath } from '@/api/client'
import { Platform } from 'react-native'
import { env } from '@/config/env'

export type DevicePlatform = 'ios' | 'android' | 'web'

export interface RegisterDeviceTokenInput {
  expoPushToken: string
  deviceId?: string | null
  platform: DevicePlatform
  appVersion?: string | null
}

/**
 * Register Expo push token with backend foundation API.
 * Delivery is not implemented yet — contracts only.
 */
export async function registerDeviceToken(input: RegisterDeviceTokenInput) {
  return apiClient.post(tenantPath('/mobile/device-tokens'), {
    expoPushToken: input.expoPushToken,
    deviceId: input.deviceId ?? null,
    platform: input.platform,
    appVersion: input.appVersion ?? env.appVersion ?? null,
  })
}

export async function removeDeviceToken(input: {
  expoPushToken?: string
  deviceId?: string
}) {
  return apiClient.post(tenantPath('/mobile/device-tokens/revoke'), input)
}

export function currentPlatform(): DevicePlatform {
  if (Platform.OS === 'ios') return 'ios'
  if (Platform.OS === 'android') return 'android'
  return 'web'
}

export { handleNotificationDeepLink } from '@/features/crm/deeplinks'
