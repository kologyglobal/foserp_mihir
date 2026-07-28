/**
 * CRM sales line pickers — backed by MasterItem (salesAllowed).
 * Legacy name retained so existing imports keep working; products arg is ignored.
 */
import type { Item, Product, Uom } from '../types/master'
import {
  buildSalesItemOptions,
  useSalesItemOptionMap,
  type SalesItemPick,
  type SalesItemSelectOption,
} from './opportunityItemOptions'

export type ProductMasterPick = SalesItemPick
export type ProductMasterSelectOption = SalesItemSelectOption

export function buildProductMasterOptions(
  _products: Product[],
  items: Item[],
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
  retainItemIds?: Array<string | null | undefined>,
): ProductMasterSelectOption[] {
  return buildSalesItemOptions(items, uoms, stockByItemId, retainItemIds)
}

export function useProductMasterOptionMap(
  _products: Product[],
  items: Item[],
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
  retainItemIds?: Array<string | null | undefined>,
) {
  return useSalesItemOptionMap(items, uoms, stockByItemId, retainItemIds)
}

export {
  canUseItemInSales,
  isItemSellable,
  itemNotSellableForSalesMessage,
} from './opportunityItemOptions'
