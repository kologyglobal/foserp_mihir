import type { InventoryItemType } from '../types/inventoryDomain'

export const INVENTORY_ITEM_TYPE_LABELS: Record<InventoryItemType, string> = {
  raw_material: 'Raw Materials',
  component: 'Components',
  semi_finished: 'Semi-Finished',
  finished_good: 'Finished Goods',
  consumable: 'Consumables',
  packing_material: 'Packing Materials',
  spare: 'Spares',
  trading_item: 'Trading Items',
  scrap: 'Scrap',
}

export const INVENTORY_ITEM_REGISTER_TABS = [
  { id: 'all', label: 'All', itemType: null as InventoryItemType | null },
  { id: 'raw_material', label: 'Raw Materials', itemType: 'raw_material' as const },
  { id: 'component', label: 'Components', itemType: 'component' as const },
  { id: 'semi_finished', label: 'Semi-Finished', itemType: 'semi_finished' as const },
  { id: 'finished_good', label: 'Finished Goods', itemType: 'finished_good' as const },
  { id: 'consumable', label: 'Consumables', itemType: 'consumable' as const },
  { id: 'packing_material', label: 'Packing Materials', itemType: 'packing_material' as const },
  { id: 'spare', label: 'Spares', itemType: 'spare' as const },
  { id: 'trading_item', label: 'Trading Items', itemType: 'trading_item' as const },
  { id: 'scrap', label: 'Scrap', itemType: 'scrap' as const },
  { id: 'inactive', label: 'Inactive', itemType: null as InventoryItemType | null },
] as const

export function trackingLabel(item: {
  batchTracking: boolean
  serialTracking: boolean
  expiryTracking: boolean
}): string {
  const parts: string[] = []
  if (item.batchTracking) parts.push('Batch')
  if (item.serialTracking) parts.push('Serial')
  if (item.expiryTracking) parts.push('Expiry')
  return parts.length ? parts.join(', ') : 'None'
}

export function stockStatusLabel(
  onHand: number,
  available: number,
  reorderLevel: number,
): 'Available' | 'Low Stock' | 'Out of Stock' | 'Negative' {
  if (onHand < 0 || available < 0) return 'Negative'
  if (onHand === 0) return 'Out of Stock'
  if (onHand <= reorderLevel) return 'Low Stock'
  return 'Available'
}
