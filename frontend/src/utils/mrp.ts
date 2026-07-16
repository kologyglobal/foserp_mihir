import type { BomHeader } from '../types/bom'
import { MRP_ELIGIBLE_STATUSES } from '../types/bom'

/** MRP and production consume Released BOM only — not draft, submitted, or approved */
export function isMrpEligibleStatus(status: BomHeader['status']): boolean {
  return MRP_ELIGIBLE_STATUSES.includes(status)
}

export function getReleasedBomForProduct(
  headers: BomHeader[],
  productId: string,
): BomHeader | undefined {
  return headers
    .filter((h) => h.productId === productId && isMrpEligibleStatus(h.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
}
