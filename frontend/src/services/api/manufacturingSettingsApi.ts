import type { ManufacturingSettings } from '@/types/manufacturingSettings'
import { apiRequest, tenantPath } from './client'

export interface ApiManufacturingSettings {
  id: string | null
  tenantId: string | null
  version: number
  payloadJson: ManufacturingSettings
  allowOverproduction: boolean
  overproductionTolerancePercent: number
  allowCloseWithoutQc: boolean
  requireReservation: boolean
  allowPartialProduction: boolean
  allowProductionWithoutFullMaterial: boolean
  autoPostAbsorption: boolean
  oeeEnabled: boolean
  shiftMinutesPerDay: number
}

export async function getManufacturingSettingsApi() {
  return apiRequest<ApiManufacturingSettings>(tenantPath('/manufacturing/settings'))
}

export async function putManufacturingSettingsApi(
  settings: ManufacturingSettings,
  version?: number,
) {
  return apiRequest<ApiManufacturingSettings>(tenantPath('/manufacturing/settings'), {
    method: 'PUT',
    body: JSON.stringify({ version, settings }),
  })
}
