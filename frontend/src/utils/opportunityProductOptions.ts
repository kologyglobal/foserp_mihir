import { useMemo } from 'react'
import type { Item, Product, Uom } from '../types/master'
import { PRODUCT_FAMILY_LABELS } from '../types/productMaster'
import type { ErpSmartSelectOption } from '../components/erp/ErpSmartSelect'
import { taxCategoryToPct } from './opportunityLineCalc'
import { useCrmStore } from '../store/crmStore'
import { isIsoTankQuotationTemplate } from './quotationTemplates'

export interface ProductMasterPick {
  product: Product
  item?: Item
  uomName: string
  stockQty?: number
  templateId?: string
}

export type ProductMasterSelectOption = ErpSmartSelectOption<string> & { pick: ProductMasterPick }

export function buildProductMasterOptions(
  products: Product[],
  items: Item[],
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
): ProductMasterSelectOption[] {
  return products
    .filter((p) => p.isActive && p.status === 'released')
    .map((product) => {
      const item = items.find((i) => i.id === product.fgItemId)
      const uom = uoms.find((u) => u.id === product.baseUomId)
      const family = PRODUCT_FAMILY_LABELS[product.productFamily] ?? product.productFamily
      const gst = taxCategoryToPct(product.sales.taxCategory)
      const stockQty = item && stockByItemId ? stockByItemId[item.id] : undefined
      const isoTemplate = useCrmStore.getState().quotationTemplates.find(isIsoTankQuotationTemplate)
      const templateId = product.productFamily === 'iso_tank' ? isoTemplate?.id : undefined

      const searchText = [
        product.productCode,
        product.productName,
        family,
        product.drawingRevision,
        product.hsnCode,
        item?.itemCode,
        item?.itemName,
        item?.hsnCode,
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
        pick: { product, item, uomName: uom?.uomCode ?? 'Nos', stockQty, templateId },
      }
    })
}

export function useProductMasterOptionMap(
  products: Product[],
  items: Item[],
  uoms: Uom[],
  stockByItemId?: Record<string, number>,
) {
  return useMemo(() => {
    const options = buildProductMasterOptions(products, items, uoms, stockByItemId)
    const map = new Map<string, ProductMasterPick>()
    for (const opt of options) map.set(opt.value, opt.pick)
    return { options, pickMap: map }
  }, [products, items, uoms, stockByItemId])
}
