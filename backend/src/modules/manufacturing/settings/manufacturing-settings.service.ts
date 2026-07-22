import { Prisma } from '@prisma/client'
import { ConflictError } from '../../../utils/errors.js'
import { VersionConflictError } from './manufacturing-settings.errors.js'
import * as repo from './manufacturing-settings.repository.js'
import type {
  PatchManufacturingSettingsInput,
  PutManufacturingSettingsInput,
} from './manufacturing-settings.validation.js'

type SettingsPayload = Record<string, unknown>
type SettingsInput = PutManufacturingSettingsInput | PatchManufacturingSettingsInput

const cloneDefault = (): SettingsPayload =>
  structuredClone(repo.SERVER_DEFAULT) as SettingsPayload

function group(payload: SettingsPayload, key: string): Record<string, unknown> {
  const value = payload[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function mergePayload(base: SettingsPayload, patch: SettingsPayload): SettingsPayload {
  const merged = { ...base, ...patch }
  for (const key of [
    'general', 'numberSeries', 'materialConsumption', 'operations', 'quality',
    'jobWork', 'costing', 'approvals', 'advanced',
  ]) {
    if (patch[key] != null) merged[key] = { ...group(base, key), ...group(patch, key) }
  }
  return merged
}

function denormalize(payload: SettingsPayload, input: SettingsInput) {
  const general = group(payload, 'general')
  const material = group(payload, 'materialConsumption')
  const advanced = group(payload, 'advanced')
  const costing = group(payload, 'costing')
  return {
    allowOverproduction: input.allowOverproduction ?? general.allowOverproduction as boolean ?? true,
    overproductionTolerancePercent:
      input.overproductionTolerancePercent ?? Number(general.overproductionTolerancePercent ?? 5),
    allowCloseWithoutQc: input.allowCloseWithoutQc ?? general.allowCloseWithoutQc as boolean ?? false,
    requireReservation: input.requireReservation ?? material.requireReservation as boolean ?? false,
    allowPartialProduction:
      input.allowPartialProduction ?? general.allowPartialProduction as boolean ?? true,
    allowProductionWithoutFullMaterial:
      input.allowProductionWithoutFullMaterial
      ?? material.allowProductionWithoutFullMaterial as boolean
      ?? true,
    autoPostAbsorption:
      input.autoPostAbsorption ?? costing.autoPostAbsorption as boolean ?? false,
    oeeEnabled: input.oeeEnabled ?? advanced.oee as boolean ?? false,
    shiftMinutesPerDay:
      input.shiftMinutesPerDay ?? Number(advanced.shiftMinutesPerDay ?? 480),
  }
}

function toDto(row: Awaited<ReturnType<typeof repo.find>> | null) {
  if (!row) {
    const payloadJson = cloneDefault()
    return { id: null, tenantId: null, version: 0, payloadJson, ...denormalize(payloadJson, {}) }
  }
  return {
    ...row,
    overproductionTolerancePercent: Number(row.overproductionTolerancePercent),
  }
}

export async function getManufacturingSettingsForTenant(tenantId: string) {
  return toDto(await repo.find(tenantId))
}

export const getManufacturingSettings = getManufacturingSettingsForTenant

export async function upsertManufacturingSettings(
  tenantId: string,
  actorId: string,
  input: PutManufacturingSettingsInput,
) {
  const existing = await repo.find(tenantId)
  if (existing && input.version != null && input.version !== existing.version) {
    throw new VersionConflictError()
  }
  if (!existing && input.version != null && input.version !== 0) {
    throw new VersionConflictError()
  }
  const base = existing ? existing.payloadJson as SettingsPayload : cloneDefault()
  const supplied = (input.settings ?? input.payloadJson ?? {}) as SettingsPayload
  const payloadJson = mergePayload(base, supplied)
  const data = { payloadJson: payloadJson as Prisma.InputJsonValue, ...denormalize(payloadJson, input) }
  const saved = existing
    ? await repo.update(tenantId, actorId, existing.version, data)
    : await repo.create(tenantId, actorId, data)
  if (!saved) throw new VersionConflictError()
  return toDto(saved)
}

export async function patchManufacturingSettings(
  tenantId: string,
  actorId: string,
  input: PatchManufacturingSettingsInput,
) {
  const existing = await repo.find(tenantId)
  const base = existing ? existing.payloadJson as SettingsPayload : cloneDefault()
  return upsertManufacturingSettings(tenantId, actorId, {
    ...input,
    settings: mergePayload(base, (input.settings ?? input.payloadJson ?? {}) as SettingsPayload),
  })
}

export type ManufacturingSettingsCheck =
  | 'CLOSE_WITHOUT_QC'
  | 'START_WITHOUT_RESERVATION'
  | 'PRODUCE_WITHOUT_FULL_MATERIAL'
  | 'OVERPRODUCTION'

export async function assertSettingsAllow(tenantId: string, check: ManufacturingSettingsCheck) {
  const settings = await getManufacturingSettingsForTenant(tenantId)
  const allowed = {
    CLOSE_WITHOUT_QC: settings.allowCloseWithoutQc,
    START_WITHOUT_RESERVATION: !settings.requireReservation,
    PRODUCE_WITHOUT_FULL_MATERIAL: settings.allowProductionWithoutFullMaterial,
    OVERPRODUCTION: settings.allowOverproduction,
  }[check]
  if (!allowed) throw new ConflictError(`Manufacturing settings block ${check.toLowerCase().replaceAll('_', ' ')}`)
  return settings
}
