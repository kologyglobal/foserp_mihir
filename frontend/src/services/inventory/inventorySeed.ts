import type { InventoryItemInput, InventoryItemType } from '../../types/inventoryDomain'
import type { Item, ItemType } from '../../types/master'

/** Per-item inventory extensions keyed by master item id */
export type InventoryItemExtension = Omit<
  InventoryItemInput,
  'itemCode' | 'itemName' | 'categoryId' | 'baseUomId' | 'status'
> & {
  masterItemId: string
  inventoryItemType: InventoryItemType
  createdBy: string
  modifiedBy: string
}

export function mapMasterItemTypeToInventory(item: Item): InventoryItemType {
  if (item.productType === 'scrap') return 'scrap'
  switch (item.itemType) {
    case 'raw':
      return 'raw_material'
    case 'bought_out':
      return 'component'
    case 'consumable':
      return 'consumable'
    case 'sub_assembly':
      return 'semi_finished'
    case 'finished_good':
      return 'finished_good'
    default:
      return 'raw_material'
  }
}

export function mapInventoryTypeToMaster(type: InventoryItemType): ItemType {
  switch (type) {
    case 'raw_material':
      return 'raw'
    case 'component':
    case 'trading_item':
    case 'spare':
    case 'packing_material':
      return 'bought_out'
    case 'consumable':
      return 'consumable'
    case 'semi_finished':
      return 'sub_assembly'
    case 'finished_good':
      return 'finished_good'
    case 'scrap':
      return 'consumable'
    default:
      return 'raw'
  }
}

export function defaultExtensionForItem(item: Item): InventoryItemExtension {
  const inventoryItemType = mapMasterItemTypeToInventory(item)
  return {
    masterItemId: item.id,
    inventoryItemType,
    itemType: inventoryItemType,
    defaultWarehouseId: null,
    isInventoryItem: item.isStockable,
    allowNegativeStock: false,
    minimumStock: 0,
    maximumStock: 0,
    safetyStock: 0,
    reorderLevel: item.reorderLevel ?? 0,
    reorderQuantity: item.reorderQty ?? 0,
    hsnCode: item.hsnCode ?? '',
    gstRate: 18,
    costingMethod: 'standard',
    standardCost: item.standardRate ?? 0,
    averageCost: item.standardRate ?? 0,
    lastPurchaseCost: item.standardRate ?? 0,
    batchTracking: false,
    serialTracking: false,
    expiryTracking: false,
    shelfLifeDays: null,
    qualityInspectionRequired: Boolean(item.qcRequired),
    automaticBatchSelection: false,
    reorderPlanningEnabled: (item.reorderLevel ?? 0) > 0,
    leadTimeDays: 7,
    preferredSource: inventoryItemType === 'finished_good' || inventoryItemType === 'semi_finished' ? 'production' : 'purchase',
    minimumOrderQuantity: item.reorderQty ?? 1,
    maximumOrderQuantity: 0,
    createdBy: 'System',
    modifiedBy: 'System',
  }
}

/** Demo quality-hold quantities per item (warehouse-scoped in service) */
export const DEMO_QUALITY_HOLD: Record<string, number> = {}

/** Demo blocked quantities */
export const DEMO_BLOCKED: Record<string, number> = {}

/** Demo expected receipts / planned issues */
export const DEMO_EXPECTED_RECEIPT: Record<string, number> = {}
export const DEMO_PLANNED_ISSUE: Record<string, number> = {}

export const PENDING_RECEIPTS_COUNT = 4
export const PENDING_ISSUES_COUNT = 3
export const PENDING_TRANSFERS_COUNT = 2
export const STOCK_COUNT_DIFFERENCES = 5
