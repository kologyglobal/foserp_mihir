import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { ValidationError } from '../../utils/errors.js'

/** Guard against unbounded per-user growth (each grid layout is one row). */
const MAX_PREFERENCES_PER_USER = 300

export interface UiPreferenceDto {
  prefKey: string
  value: unknown
  updatedAt: Date
}

export async function listUiPreferences(
  tenantId: string,
  userId: string,
): Promise<UiPreferenceDto[]> {
  return prisma.userUiPreference.findMany({
    where: { tenantId, userId },
    select: { prefKey: true, value: true, updatedAt: true },
    orderBy: { prefKey: 'asc' },
  })
}

export async function putUiPreference(
  tenantId: string,
  userId: string,
  prefKey: string,
  value: unknown,
): Promise<UiPreferenceDto> {
  const jsonValue = value as Prisma.InputJsonValue

  const existing = await prisma.userUiPreference.findUnique({
    where: { tenantId_userId_prefKey: { tenantId, userId, prefKey } },
    select: { id: true },
  })
  if (!existing) {
    const count = await prisma.userUiPreference.count({ where: { tenantId, userId } })
    if (count >= MAX_PREFERENCES_PER_USER) {
      throw new ValidationError(`Too many stored UI preferences (max ${MAX_PREFERENCES_PER_USER})`)
    }
  }

  const row = await prisma.userUiPreference.upsert({
    where: { tenantId_userId_prefKey: { tenantId, userId, prefKey } },
    create: { tenantId, userId, prefKey, value: jsonValue },
    update: { value: jsonValue },
    select: { prefKey: true, value: true, updatedAt: true },
  })
  return row
}

export async function deleteUiPreference(
  tenantId: string,
  userId: string,
  prefKey: string,
): Promise<void> {
  await prisma.userUiPreference.deleteMany({ where: { tenantId, userId, prefKey } })
}
