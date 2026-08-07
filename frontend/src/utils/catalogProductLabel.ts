/**
 * Resolve a human-readable product/item label for commercial list columns.
 *
 * Sales headers often dual-store an Item UUID on `productId` (legacy field name) while
 * looking only at Product master leaves raw UUIDs in the Product column.
 */
import type { Item, Product } from '../types/master'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isLikelyUuid(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim()
  if (!raw) return false
  return UUID_RE.test(raw) || /^[0-9a-f]{32}$/i.test(raw)
}

export function formatCodeNameLabel(
  code?: string | null,
  name?: string | null,
): string | undefined {
  const c = code?.trim() || ''
  const n = name?.trim() || ''
  if (c && n && c !== n) return `${c} — ${n}`
  if (c) return c
  if (n) return n
  return undefined
}

export type CatalogProductDisplay = {
  /** Item/product code when known */
  code: string
  /** Display name when known */
  name: string
  /** Single-line label — prefers "CODE — Name", never a raw UUID */
  label: string
}

export type CatalogLabelSource = {
  productId?: string | null
  itemId?: string | null
  itemCode?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  productOrItem?: string | null
  lines?: Array<{
    itemId?: string | null
    productId?: string | null
    itemCode?: string | null
    itemCodeSnapshot?: string | null
    itemNameSnapshot?: string | null
    productOrItem?: string | null
  }>
}

type CatalogLookup = {
  items?: Item[]
  products?: Product[]
  getItem?: (id: string) => Item | undefined
  getProduct?: (id: string) => Product | undefined
}

function lookupItem(id: string | null | undefined, opts: CatalogLookup): Item | undefined {
  if (!id) return undefined
  return opts.getItem?.(id) ?? opts.items?.find((i) => i.id === id)
}

function lookupProduct(id: string | null | undefined, opts: CatalogLookup): Product | undefined {
  if (!id) return undefined
  return opts.getProduct?.(id) ?? opts.products?.find((p) => p.id === id)
}

function parts(code: string, name: string): CatalogProductDisplay {
  return {
    code,
    name,
    label: formatCodeNameLabel(code, name) ?? (code || name || '-'),
  }
}

/**
 * Resolve display label from commercial refs (item preferred, then product master, then snapshots).
 * Accepts a bare id string or a row with productId/itemId/lines.
 */
export function resolveCatalogProductDisplay(
  source: CatalogLabelSource | string | null | undefined,
  opts: CatalogLookup = {},
): CatalogProductDisplay {
  const src: CatalogLabelSource =
    typeof source === 'string' || source == null
      ? { productId: source ?? null, itemId: source ?? null }
      : source

  const primaryLine = src.lines?.find((l) => l.itemId || l.productId || l.itemCode || l.itemCodeSnapshot || l.productOrItem)
    ?? src.lines?.[0]

  const candidateIds = [
    src.itemId,
    primaryLine?.itemId,
    src.productId,
    primaryLine?.productId,
  ].filter((id): id is string => Boolean(id?.trim()))

  for (const id of candidateIds) {
    const item = lookupItem(id, opts)
    if (item) return parts(item.itemCode, item.itemName)
  }

  for (const id of candidateIds) {
    const product = lookupProduct(id, opts)
    if (product) return parts(product.productCode, product.productName)
  }

  const snapCode =
    src.itemCode?.trim()
    || src.itemCodeSnapshot?.trim()
    || primaryLine?.itemCode?.trim()
    || primaryLine?.itemCodeSnapshot?.trim()
    || ''
  const snapName =
    src.itemNameSnapshot?.trim()
    || primaryLine?.itemNameSnapshot?.trim()
    || ''
  if (snapCode || snapName) return parts(snapCode, snapName)

  const freeText =
    src.productOrItem?.trim()
    || primaryLine?.productOrItem?.trim()
    || ''
  if (freeText && !isLikelyUuid(freeText)) {
    return parts('', freeText)
  }

  return parts('', '')
}

/** Convenience single-line label for columns / search — never returns a raw UUID. */
export function resolveCatalogProductLabel(
  source: CatalogLabelSource | string | null | undefined,
  opts: CatalogLookup = {},
): string {
  return resolveCatalogProductDisplay(source, opts).label
}
