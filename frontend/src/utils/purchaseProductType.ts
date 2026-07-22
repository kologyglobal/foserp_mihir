import type { EngineeringProductType } from '../types/taxMaster'
import type { PurchaseItemCategory } from '../types/purchaseDomain'

/** Map Item Master product type → purchase line category (API / domain). */
export function mapEngineeringProductTypeToPurchaseCategory(
  productType: EngineeringProductType | '' | null | undefined,
): PurchaseItemCategory | '' {
  switch (productType) {
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
