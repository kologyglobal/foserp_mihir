/** Minimum UOM + item category seed (stockability defaults for item create). */

export type UomSeedRow = {
  code: string
  name: string
  description: string
  uomType: 'integer' | 'weight' | 'length' | 'volume'
  decimalPlaces: number
  isBaseUnit: boolean
}

/** Stock policy applied when creating items under this category. */
export type CategoryStockPolicy = 'REQUIRED' | 'OPTIONAL' | 'FORBIDDEN'

export type ItemCategorySeedRow = {
  code: string
  name: string
  level: number
  parentCode?: string
  /** Items in this category must / may / must-not affect stock. */
  stockPolicy: CategoryStockPolicy
  defaultIsStockable: boolean
  defaultInventoryType: 'inventory' | 'non_inventory' | 'service'
  defaultItemType: 'raw' | 'bought_out' | 'consumable' | 'sub_assembly' | 'finished_good' | 'scrap' | 'service'
}

/** Minimum UOM set for manufacturing. */
export const UOM_SEED_ROWS: UomSeedRow[] = [
  { code: 'NOS', name: 'Numbers', description: 'Each / piece count', uomType: 'integer', decimalPlaces: 0, isBaseUnit: true },
  { code: 'KG', name: 'Kilogram', description: 'Kilogram', uomType: 'weight', decimalPlaces: 3, isBaseUnit: true },
  { code: 'MTR', name: 'Metre', description: 'Metre', uomType: 'length', decimalPlaces: 3, isBaseUnit: true },
  { code: 'LTR', name: 'Litre', description: 'Litre', uomType: 'volume', decimalPlaces: 2, isBaseUnit: true },
  { code: 'SET', name: 'Set', description: 'Set / kit', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
  { code: 'BOX', name: 'Box', description: 'Box / carton', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
  { code: 'PLATE', name: 'Plate', description: 'Plate (count / sheet plate)', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
  { code: 'SHEET', name: 'Sheet', description: 'Sheet', uomType: 'integer', decimalPlaces: 0, isBaseUnit: false },
]

/**
 * Core item categories.
 * RM/BO/FG/CON/SCRAP → stockable; SFG → optional (logical or stockable); SERVICE → non-stock.
 */
export const ITEM_CATEGORY_SEED_ROWS: ItemCategorySeedRow[] = [
  {
    code: 'RM',
    name: 'Raw Material',
    level: 1,
    stockPolicy: 'REQUIRED',
    defaultIsStockable: true,
    defaultInventoryType: 'inventory',
    defaultItemType: 'raw',
  },
  {
    code: 'BO',
    name: 'Bought-Out',
    level: 1,
    stockPolicy: 'REQUIRED',
    defaultIsStockable: true,
    defaultInventoryType: 'inventory',
    defaultItemType: 'bought_out',
  },
  {
    code: 'SFG',
    name: 'Semi-Finished',
    level: 1,
    stockPolicy: 'OPTIONAL',
    defaultIsStockable: true,
    defaultInventoryType: 'inventory',
    defaultItemType: 'sub_assembly',
  },
  {
    code: 'FG',
    name: 'Finished Goods',
    level: 1,
    stockPolicy: 'REQUIRED',
    defaultIsStockable: true,
    defaultInventoryType: 'inventory',
    defaultItemType: 'finished_good',
  },
  {
    code: 'CON',
    name: 'Consumables',
    level: 1,
    stockPolicy: 'REQUIRED',
    defaultIsStockable: true,
    defaultInventoryType: 'inventory',
    defaultItemType: 'consumable',
  },
  {
    code: 'SCRAP',
    name: 'Scrap',
    level: 1,
    stockPolicy: 'REQUIRED',
    defaultIsStockable: true,
    defaultInventoryType: 'inventory',
    defaultItemType: 'scrap',
  },
  {
    code: 'SERVICE',
    name: 'Service',
    level: 1,
    stockPolicy: 'FORBIDDEN',
    defaultIsStockable: false,
    defaultInventoryType: 'service',
    defaultItemType: 'service',
  },
]
