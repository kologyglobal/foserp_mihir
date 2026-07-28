import type { Item, Uom } from '../types/master'
import type { ErpSmartSelectOption } from '../components/erp/ErpSmartSelect'
import { useMasterStore } from '../store/masterStore'
import { useMemo } from 'react'

export interface SalesItemPick {
  item: Item
  uomName: string
  stockQty?: number
}

export type SalesItemSelectOption = ErpSmartSelectOption<string> & { pick: SalesItemPick }

export function isItemSellable(item: Item): boolean {
  return Boolean(item.isActive && !item.isBlocked && item.salesAllowed)
}

export function itemNotSellableForSalesMessage(item: Item): string {
  if (!item.salesAllowed) return `${item.itemCode} is not allowed for sales — enable Sales allowed on the Item master.`
  if (item.isBlocked || !item.isActive) return `${item.itemCode} is inactive or blocked.`
  return `${item.itemCode} cannot be used on sales documents.`
}

export function canUseItemInSales(itemId: string): { ok: boolean; error?: string } {
  const item = useMasterStore.getState().getItem(itemId)
  if (!item) return { ok: false, error: 'Item not found' }
  if (!isItemSellable(item)) return { ok: false, error: itemNotSellableForSalesMessage(item) }
  return { ok: true }
}

function toSalesItemOption(
  item: Item,
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
  opts?: { notSellable?: boolean },
): SalesItemSelectOption {
  const uom = uoms.find((u) => u.id === item.baseUomId)
  const stockQty = stockByItemId ? stockByItemId[item.id] : undefined
  const rate = item.defaultSalesRate ?? item.standardRate ?? 0

  const searchText = [item.itemCode, item.itemName, item.itemType, item.hsnCode, opts?.notSellable ? 'not sellable' : null]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const metaText = [
    item.itemCode,
    item.itemType,
    uom?.uomCode ?? 'Nos',
    `₹${Number(rate).toLocaleString('en-IN')}`,
    item.hsnCode ? `HSN ${item.hsnCode}` : null,
    stockQty != null ? `Stock ${stockQty}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    value: item.id,
    label: item.itemName,
    searchText,
    meta: metaText,
    subtitle: opts?.notSellable ? itemNotSellableForSalesMessage(item) : undefined,
    badge: opts?.notSellable ? 'Not for sales' : undefined,
    pick: { item, uomName: uom?.uomCode ?? 'Nos', stockQty },
  }
}

/**
 * CRM/Sales pickers: salesAllowed items only.
 * Pass retainItemIds so an already-linked non-sellable item still displays with a clear badge.
 */
export function buildSalesItemOptions(
  items: Item[],
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
  retainItemIds?: Array<string | null | undefined>,
): SalesItemSelectOption[] {
  const retain = new Set((retainItemIds ?? []).filter((id): id is string => Boolean(id)))
  const sellable = items.filter(isItemSellable)
  const retainedNonSellable = items.filter((i) => retain.has(i.id) && !isItemSellable(i))

  return [
    ...sellable.map((i) => toSalesItemOption(i, uoms, stockByItemId)),
    ...retainedNonSellable.map((i) => toSalesItemOption(i, uoms, stockByItemId, { notSellable: true })),
  ]
}

export function useSalesItemOptionMap(
  items: Item[],
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
  retainItemIds?: Array<string | null | undefined>,
) {
  const retainKey = (retainItemIds ?? []).filter(Boolean).join('|')
  return useMemo(() => {
    const options = buildSalesItemOptions(items, uoms, stockByItemId, retainItemIds)
    const map = new Map<string, SalesItemPick>()
    for (const opt of options) map.set(opt.value, opt.pick)
    return { options, pickMap: map }
  }, [items, uoms, stockByItemId, retainKey])
}
