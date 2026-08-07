/**
 * Inventory item service — live API only.
 */

import type {
  InventoryAuditEntry,
  InventoryDashboardData,
  InventoryFilter,
  InventoryItem,
  InventoryItemInput,
  StockDetailsData,
} from '../../types/inventoryDomain'
import {
  deactivateLiveInventoryItem,
  getLiveInventoryItem,
  getLiveStockDetails,
  listLiveInventoryItems,
} from './inventoryItemsLive'

export class InventoryServiceError extends Error {
  code: string
  constructor(message: string, code: string = 'INVENTORY_ERROR') {
    super(message)
    this.name = 'InventoryServiceError'
    this.code = code
  }
}

export async function getInventoryDashboard(): Promise<InventoryDashboardData> {
  const { getLiveInventoryDashboard } = await import('./inventoryDashboardLive')
  return getLiveInventoryDashboard()
}

export async function getItems(filter: InventoryFilter = {}): Promise<InventoryItem[]> {
  return listLiveInventoryItems(filter)
}

export async function getItemById(id: string): Promise<InventoryItem | null> {
  return getLiveInventoryItem(id)
}

export async function createItem(_input: InventoryItemInput): Promise<InventoryItem> {
  throw new InventoryServiceError('Create items under Masters → Items', 'API_REDIRECT')
}

export async function updateItem(_id: string, _input: Partial<InventoryItemInput>): Promise<InventoryItem> {
  throw new InventoryServiceError('Edit items under Masters → Items', 'API_REDIRECT')
}

export async function deactivateItem(id: string): Promise<InventoryItem> {
  return deactivateLiveInventoryItem(id)
}

export async function duplicateItem(_id: string): Promise<InventoryItem> {
  throw new InventoryServiceError('Duplicate items under Masters → Items', 'API_REDIRECT')
}

export async function getStockDetails(itemId: string, _warehouseId?: string): Promise<StockDetailsData | null> {
  return getLiveStockDetails(itemId)
}

export async function getInventoryAuditTrail(_itemId: string): Promise<InventoryAuditEntry[]> {
  return []
}
