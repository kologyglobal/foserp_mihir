import { prisma } from '../../../config/prisma.js'
import type { RegisterDeviceTokenInput, RevokeDeviceTokenInput } from './device-token.validation.js'

export async function registerDeviceToken(
  tenantId: string,
  userId: string,
  input: RegisterDeviceTokenInput,
) {
  const row = await prisma.mobileDeviceToken.upsert({
    where: {
      tenantId_expoPushToken: {
        tenantId,
        expoPushToken: input.expoPushToken,
      },
    },
    create: {
      tenantId,
      userId,
      expoPushToken: input.expoPushToken,
      deviceId: input.deviceId ?? null,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      status: 'ACTIVE',
      revokedAt: null,
      lastSeenAt: new Date(),
    },
    update: {
      userId,
      deviceId: input.deviceId ?? null,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      status: 'ACTIVE',
      revokedAt: null,
      lastSeenAt: new Date(),
    },
  })

  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    expoPushToken: row.expoPushToken,
    deviceId: row.deviceId,
    platform: row.platform,
    appVersion: row.appVersion,
    status: row.status,
    lastSeenAt: row.lastSeenAt.toISOString(),
  }
}

export async function revokeDeviceToken(
  tenantId: string,
  userId: string,
  input: RevokeDeviceTokenInput,
) {
  const where = {
    tenantId,
    userId,
    status: 'ACTIVE',
    ...(input.expoPushToken ? { expoPushToken: input.expoPushToken } : {}),
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
  }

  const result = await prisma.mobileDeviceToken.updateMany({
    where,
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
  })

  return { revoked: result.count }
}
