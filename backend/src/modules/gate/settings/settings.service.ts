import { prisma } from '../../../config/database.js'
import {
  DEFAULT_GATE_LOCATIONS,
  DEFAULT_GATE_SETTINGS,
} from '../shared/gate-shared.js'
import { mapLocation, mapSettings } from '../shared/gate-mappers.js'

export async function ensureGateDefaults(tenantId: string, actor = 'system') {
  const existing = await prisma.gateSettings.findUnique({ where: { tenantId } })
  if (!existing) {
    await prisma.gateSettings.create({
      data: {
        tenantId,
        payloadJson: DEFAULT_GATE_SETTINGS,
        createdBy: actor,
        updatedBy: actor,
      },
    })
  }

  const locationCount = await prisma.gateLocation.count({
    where: { tenantId, deletedAt: null },
  })
  if (locationCount === 0) {
    await prisma.gateLocation.createMany({
      data: DEFAULT_GATE_LOCATIONS.map((loc) => ({
        tenantId,
        name: loc.name,
        plant: loc.plant,
        entryTypesAllowed: loc.entryTypesAllowed,
        isActive: true,
      })),
    })
  }
}

export async function getGateSettings(tenantId: string, actor = 'system') {
  await ensureGateDefaults(tenantId, actor)
  const row = await prisma.gateSettings.findUniqueOrThrow({ where: { tenantId } })
  return mapSettings(row.payloadJson)
}

export async function updateGateSettings(
  tenantId: string,
  actor: string,
  payload: unknown,
) {
  await ensureGateDefaults(tenantId, actor)
  const row = await prisma.gateSettings.update({
    where: { tenantId },
    data: { payloadJson: payload as object, updatedBy: actor },
  })
  return mapSettings(row.payloadJson)
}

export async function getSettingsPayload(tenantId: string) {
  const settings = await getGateSettings(tenantId)
  return settings as typeof DEFAULT_GATE_SETTINGS
}

export async function listGateLocations(tenantId: string) {
  await ensureGateDefaults(tenantId)
  const rows = await prisma.gateLocation.findMany({
    where: { tenantId, deletedAt: null, isActive: true },
    orderBy: { name: 'asc' },
  })
  return rows.map(mapLocation)
}
