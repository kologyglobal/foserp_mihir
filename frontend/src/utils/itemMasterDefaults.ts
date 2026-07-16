import { previewNextCode } from '../services/codeSeriesService'
import type { Item } from '../types/master'
import type { EngineeringProductType } from '../types/taxMaster'
import { itemMasterExtensions } from '../data/masters/taxMasterSeed'

function mapItemTypeToProductType(itemType: Item['itemType']): EngineeringProductType {
  if (itemType === 'raw') return 'raw_material'
  if (itemType === 'bought_out') return 'boi'
  if (itemType === 'sub_assembly') return 'sub_assembly'
  if (itemType === 'finished_good') return 'finish_product'
  if (itemType === 'consumable') return 'raw_material'
  return 'raw_material'
}

export function enrichItemWithDefaults(item: Item): Item {
  const ext = itemMasterExtensions[item.id] ?? {}
  return {
    ...item,
    productType: item.productType ?? ext.productType ?? mapItemTypeToProductType(item.itemType),
    inventoryType: item.inventoryType ?? ext.inventoryType ?? (item.isStockable ? 'inventory' : 'non_inventory'),
    codeSeriesMode: item.codeSeriesMode ?? 'manual',
    itemName2: item.itemName2 ?? ext.itemName2 ?? '',
    hsnId: item.hsnId ?? ext.hsnId ?? null,
    gstGroupId: item.gstGroupId ?? ext.gstGroupId ?? null,
    isBlocked: item.isBlocked ?? false,
    quantityPerUom: item.quantityPerUom ?? ext.quantityPerUom ?? 1,
    purchaseUomId: item.purchaseUomId ?? ext.purchaseUomId ?? item.baseUomId,
    purchaseQtyPerUom: item.purchaseQtyPerUom ?? ext.purchaseQtyPerUom ?? 1,
    inventoryQty: item.inventoryQty ?? ext.inventoryQty ?? 0,
    qtyOnPurchaseOrder: item.qtyOnPurchaseOrder ?? ext.qtyOnPurchaseOrder ?? 0,
    qtyOnProductionOrder: item.qtyOnProductionOrder ?? ext.qtyOnProductionOrder ?? 0,
    qtyOnSalesOrder: item.qtyOnSalesOrder ?? ext.qtyOnSalesOrder ?? 0,
    qcRequired: item.qcRequired ?? ext.qcRequired ?? false,
    qualityTestGroupCode: item.qualityTestGroupCode ?? ext.qualityTestGroupCode ?? null,
    productionBomId: item.productionBomId ?? ext.productionBomId ?? null,
    routingNo: item.routingNo ?? ext.routingNo ?? null,
    drawingNo: item.drawingNo ?? ext.drawingNo ?? null,
  }
}

export function suggestItemCode(_prefix: string, _existingCodes: string[]): string {
  return previewNextCode('item')
}
