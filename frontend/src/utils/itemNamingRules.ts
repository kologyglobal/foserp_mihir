/** Raw material item names: MS_{GRADE}_{SECTION} — mirrors backend item-naming.rules.ts */
export const RAW_MATERIAL_ITEM_NAME_PATTERN = /^MS_[A-Za-z0-9]+_[A-Za-z0-9xX×.\-/]+$/

export const RAW_MATERIAL_ITEM_NAME_MESSAGE =
  'Raw material item name must follow MS_GRADE_SECTION (e.g. MS_IS2062_100x50)'

export function isRawMaterialProductType(productType: string): boolean {
  return productType === 'raw_material'
}

export function isValidRawMaterialItemName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  return RAW_MATERIAL_ITEM_NAME_PATTERN.test(trimmed)
}
