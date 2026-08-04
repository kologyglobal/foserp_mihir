import { ValidationError } from '../../utils/errors.js'

/** Raw material item names: MS_{GRADE}_{SECTION} e.g. MS_IS2062_100x50 */
export const RAW_MATERIAL_ITEM_NAME_PATTERN = /^MS_[A-Za-z0-9]+_[A-Za-z0-9xX×.\-/]+$/

export const RAW_MATERIAL_ITEM_NAME_MESSAGE =
  'Raw material item name must follow MS_GRADE_SECTION (e.g. MS_IS2062_100x50)'

export function isRawMaterialItem(
  itemType: string | null | undefined,
  productType: string | null | undefined,
): boolean {
  return itemType === 'raw' || productType === 'raw_material'
}

export function isValidRawMaterialItemName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  return RAW_MATERIAL_ITEM_NAME_PATTERN.test(trimmed)
}

export function assertRawMaterialItemName(
  name: string,
  itemType: string | null | undefined,
  productType: string | null | undefined,
): void {
  if (!isRawMaterialItem(itemType, productType)) return
  if (isValidRawMaterialItemName(name)) return
  throw new ValidationError(RAW_MATERIAL_ITEM_NAME_MESSAGE)
}
