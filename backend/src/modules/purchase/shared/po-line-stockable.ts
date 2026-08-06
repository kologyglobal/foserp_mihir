/**
 * Whether a PO / GRN line may create inventory stock movements.
 *
 * Rules (MVP):
 * - null itemId → never stock (free-text goods lack inventory identity; free services never stock)
 * - catalog service / non-stockable → never stock
 * - lineType SERVICE → never stock
 */
export function isPoLineStockPostable(input: {
  itemId?: string | null
  lineType?: string | null
  item?: { isStockable?: boolean | null; itemType?: string | null } | null
}): boolean {
  if (!input.itemId?.trim()) return false
  const lineType = (input.lineType ?? '').trim().toUpperCase()
  if (lineType === 'SERVICE') return false
  const item = input.item
  if (item) {
    if (item.isStockable === false) return false
    const masterType = (item.itemType ?? '').trim().toLowerCase()
    if (masterType === 'service') return false
  }
  return true
}

export function normalizePoLineType(value: string | null | undefined): 'GOODS' | 'SERVICE' {
  return (value ?? '').trim().toUpperCase() === 'SERVICE' ? 'SERVICE' : 'GOODS'
}
