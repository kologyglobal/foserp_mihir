import { apiRequest, tenantPath } from './client'
import type { InventorySetup } from '../../types/inventoryDomain'

export type InventorySetupDto = InventorySetup & {
  version?: number
  updatedAt?: string | null
}

export type InventoryLookupMatch = {
  kind: 'ITEM' | 'LOT' | 'SERIAL'
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string | null
  freeQty: string | null
  lotId: string | null
  lotNumber: string | null
  serialId: string | null
  serialNumber: string | null
}

export async function getInventorySetupApi() {
  return apiRequest<InventorySetupDto>(tenantPath('/inventory/setup'))
}

export async function putInventorySetupApi(data: Partial<InventorySetup>) {
  return apiRequest<InventorySetupDto>(tenantPath('/inventory/setup'), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function lookupInventoryCode(code: string, warehouseId?: string) {
  const qs = new URLSearchParams({ code })
  if (warehouseId) qs.set('warehouseId', warehouseId)
  return apiRequest<{ matches: InventoryLookupMatch[] }>(
    `${tenantPath('/inventory/setup/lookup')}?${qs.toString()}`,
  )
}
