import {
  ENGINEERING_PRODUCT_TYPES,
  type EngineeringProductType,
} from '../types/taxMaster'
import type { PurchaseItemCategory } from '../types/purchaseDomain'

/**
 * Normalize legacy / alternate Item Master productType values to the
 * engineering enum used by purchase Product Type filters.
 */
export function normalizeEngineeringProductType(
  value: string | null | undefined,
): EngineeringProductType | '' {
  if (!value) return ''
  if ((ENGINEERING_PRODUCT_TYPES as readonly string[]).includes(value)) {
    return value as EngineeringProductType
  }
  switch (value) {
    case 'bought_out':
      return 'boi'
    case 'finished_good':
    case 'finished_goods':
    case 'finish_goods':
      return 'finish_product'
    case 'semi_finished':
    case 'semi_finish':
      return 'sub_assembly'
    default:
      return ''
  }
}

/** Map Item Master product type → purchase line category (API / domain). */
export function mapEngineeringProductTypeToPurchaseCategory(
  productType: EngineeringProductType | '' | null | undefined,
): PurchaseItemCategory | '' {
  switch (normalizeEngineeringProductType(productType) || productType) {
    case 'raw_material':
    case 'scrap':
      return 'raw_material'
    case 'boi':
    case 'sub_assembly':
    case 'assembly_product':
    case 'finish_product':
      return 'component'
    case 'service':
      return 'job_work'
    default:
      return ''
  }
}

/** Best-effort reverse map when loading older PR lines that only stored category. */
export function mapPurchaseCategoryToEngineeringProductType(
  category: PurchaseItemCategory | '' | null | undefined,
): EngineeringProductType | '' {
  switch (category) {
    case 'raw_material':
      return 'raw_material'
    case 'component':
      return 'boi'
    case 'consumable':
    case 'packing_material':
    case 'maintenance':
      return 'scrap'
    case 'job_work':
      return 'service'
    default:
      return ''
  }
}
