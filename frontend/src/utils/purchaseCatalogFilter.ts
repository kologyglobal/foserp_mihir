import {
  normalizeEngineeringProductType,
} from '@/utils/purchaseProductType'
import type { EngineeringProductType } from '@/types/taxMaster'

/** Item catalog rows that expose Item Master product type. */
export type CatalogProductTypeRow = {
  productType?: EngineeringProductType | '' | null | string
}

/**
 * When Product Type is selected, return only matching Item Master rows
 * (legacy aliases like bought_out / finished_good are normalized).
 * When empty, return the full catalog (item search path).
 */
export function filterPurchaseCatalogByProductType<T extends CatalogProductTypeRow>(
  catalogItems: T[],
  productType: EngineeringProductType | '' | null | undefined,
): T[] {
  if (!productType) return catalogItems
  return catalogItems.filter(
    (item) => normalizeEngineeringProductType(item.productType) === productType,
  )
}
