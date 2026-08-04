import {
  mapPurchaseCategoryToEngineeringProductType,
  normalizeEngineeringProductType,
} from '@/utils/purchaseProductType'
import type { EngineeringProductType } from '@/types/taxMaster'
import type { PurchaseItemCategory } from '@/types/purchaseDomain'

/** Item catalog rows that expose Item Master product type (and optional category). */
export type CatalogProductTypeRow = {
  productType?: EngineeringProductType | '' | null | string
  /** Demo / legacy purchase seed rows often store category without productType. */
  category?: PurchaseItemCategory | string | null
}

/**
 * Effective Item Master product type for purchase line filters.
 * Prefer explicit productType (incl. legacy aliases); fall back to category.
 */
export function resolveCatalogItemProductType(
  item: CatalogProductTypeRow,
): EngineeringProductType | '' {
  return (
    normalizeEngineeringProductType(item.productType) ||
    mapPurchaseCategoryToEngineeringProductType(
      item.category as PurchaseItemCategory | '' | null | undefined,
    ) ||
    ''
  )
}

/**
 * When Product Type is selected, return only matching Item Master rows
 * (legacy aliases like bought_out / finished_good are normalized; demo rows
 * without productType match via purchase category).
 * When empty, return the full catalog (item search path).
 */
export function filterPurchaseCatalogByProductType<T extends CatalogProductTypeRow>(
  catalogItems: T[],
  productType: EngineeringProductType | '' | null | undefined,
): T[] {
  const wanted = normalizeEngineeringProductType(productType) || productType
  if (!wanted) return catalogItems
  return catalogItems.filter((item) => resolveCatalogItemProductType(item) === wanted)
}
