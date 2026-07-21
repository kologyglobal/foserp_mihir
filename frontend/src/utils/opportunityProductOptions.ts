import { useMemo } from 'react'
import type { Item, Product, Uom } from '../types/master'
import { PRODUCT_FAMILY_LABELS, PRODUCT_STATUS_LABELS } from '../types/productMaster'
import type { ErpSmartSelectOption } from '../components/erp/ErpSmartSelect'
import { taxCategoryToPct } from './opportunityLineCalc'
import { useCrmStore } from '../store/crmStore'
import { isIsoTankQuotationTemplate } from './quotationTemplates'
import { isProductSellable, productNotSellableForSalesMessage } from './productMaster'

export interface ProductMasterPick {
  product: Product
  item?: Item
  uomName: string
  stockQty?: number
  templateId?: string
}

export type ProductMasterSelectOption = ErpSmartSelectOption<string> & { pick: ProductMasterPick }

function toProductMasterOption(
  product: Product,
  items: Item[],
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
  opts?: { notSellable?: boolean },
): ProductMasterSelectOption {
  const item = items.find((i) => i.id === product.fgItemId)
  const uom = uoms.find((u) => u.id === product.baseUomId)
  const family = PRODUCT_FAMILY_LABELS[product.productFamily] ?? product.productFamily
  const gst = taxCategoryToPct(product.sales.taxCategory)
  const stockQty = item && stockByItemId ? stockByItemId[item.id] : undefined
  const isoTemplate = useCrmStore.getState().quotationTemplates.find(isIsoTankQuotationTemplate)
  const templateId = product.productFamily === 'iso_tank' ? isoTemplate?.id : undefined
  const statusLabel = PRODUCT_STATUS_LABELS[product.status] ?? product.status

  const searchText = [
    product.productCode,
    product.productName,
    family,
    product.drawingRevision,
    product.hsnCode,
    item?.itemCode,
    item?.itemName,
    item?.hsnCode,
    opts?.notSellable ? 'not released' : null,
  ].filter(Boolean).join(' ').toLowerCase()

  const metaText = [
    product.productCode,
    family,
    uom?.uomCode ?? 'Nos',
    `₹${product.standardPrice.toLocaleString('en-IN')}`,
    `GST ${gst}%`,
    stockQty != null ? `Stock ${stockQty}` : null,
  ].filter(Boolean).join(' · ')

  return {
    value: product.id,
    label: product.productName,
    searchText,
    meta: metaText,
    subtitle: opts?.notSellable
      ? productNotSellableForSalesMessage(product)
      : undefined,
    badge: opts?.notSellable ? `Not released · ${statusLabel}` : undefined,
    pick: { product, item, uomName: uom?.uomCode ?? 'Nos', stockQty, templateId },
  }
}

/**
 * Sales pickers: released products only.
 * Pass `retainProductIds` so an already-linked unreleased product still displays with a clear badge.
 */
export function buildProductMasterOptions(
  products: Product[],
  items: Item[],
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
  retainProductIds?: Array<string | null | undefined>,
): ProductMasterSelectOption[] {
  const retain = new Set((retainProductIds ?? []).filter((id): id is string => Boolean(id)))
  const sellable = products.filter(isProductSellable)
  const retainedUnreleased = products.filter((p) => retain.has(p.id) && !isProductSellable(p))

  return [
    ...sellable.map((p) => toProductMasterOption(p, items, uoms, stockByItemId)),
    ...retainedUnreleased.map((p) => toProductMasterOption(p, items, uoms, stockByItemId, { notSellable: true })),
  ]
}

export function useProductMasterOptionMap(
  products: Product[],
  items: Item[],
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
  retainProductIds?: Array<string | null | undefined>,
) {
  const retainKey = (retainProductIds ?? []).filter(Boolean).join('|')
  return useMemo(() => {
    const options = buildProductMasterOptions(products, items, uoms, stockByItemId, retainProductIds)
    const map = new Map<string, ProductMasterPick>()
    for (const opt of options) map.set(opt.value, opt.pick)
    return { options, pickMap: map }
  }, [products, items, uoms, stockByItemId, retainKey])
}
