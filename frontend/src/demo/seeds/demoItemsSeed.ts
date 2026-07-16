import { useMasterStore } from '../../store/masterStore'
import { DEMO_PRODUCT_NAMES, SATURATION_TARGETS } from './demoSeedCatalog'
import { defaultProductMasterFields } from '../../utils/productMaster'

const ITEM_TYPES = ['raw', 'bought_out', 'consumable', 'sub_assembly'] as const
const CATEGORIES = ['cat-rm-plate', 'cat-rm-struct', 'cat-rm-cons', 'cat-bo-run', 'cat-bo-wheel', 'cat-bo-pneu', 'cat-sa']

/** Top up items to 120 with trailer-specific codes */
export function seedDemoItems(): void {
  let n = useMasterStore.getState().items.length
  while (useMasterStore.getState().items.length < SATURATION_TARGETS.items) {
    n++
    const type = ITEM_TYPES[n % ITEM_TYPES.length]
    useMasterStore.getState().addItem({
      itemCode: `SAT-${type.toUpperCase().slice(0, 2)}-${String(n).padStart(4, '0')}`,
      itemName: `Trailer ${type.replace('_', ' ')} component ${n}`,
      itemDescription: `Saturation demo item for ${type} category`,
      categoryId: CATEGORIES[n % CATEGORIES.length],
      baseUomId: type === 'raw' ? 'uom-kg' : 'uom-nos',
      itemType: type,
      materialGrade: 'IS 2062 / BPW / Standard',
      hsnCode: '8708',
      reorderLevel: 5 + (n % 20),
      reorderQty: 20 + (n % 50),
      standardRate: 500 + n * 15,
      isPurchasable: type !== 'sub_assembly' || n % 3 === 0,
      isStockable: true,
      isActive: true,
      subAssemblyRule: type === 'sub_assembly' ? 'manufactured' : null,
    })
  }
}

/** Top up products to 25 with named trailer variants */
export function seedDemoProducts(): void {
  const master = useMasterStore.getState()
  const existingNames = new Set(master.products.map((p) => p.productName.toLowerCase()))
  const fgItems = master.items.filter((i) => i.itemType === 'finished_good')
  const defaultFg = fgItems[0]?.id ?? 'item-fg-bulker'

  for (let i = 0; i < DEMO_PRODUCT_NAMES.length; i++) {
    if (master.products.length >= SATURATION_TARGETS.products) break
    const name = DEMO_PRODUCT_NAMES[i]
    if (existingNames.has(name.toLowerCase())) continue
    const productFamily =
      name.includes('Tank') || name.includes('KL') ? 'iso_tank' : name.includes('Bulker') ? 'bulker_trailer' : 'side_wall_trailer'
    const code = `FG-SAT-${String(i + 1).padStart(2, '0')}`
    master.addProduct({
      productCode: code,
      productName: name,
      productType: name.includes('Bulker') ? 'bulker' : name.includes('Tank') || name.includes('KL') ? 'iso_tank' : 'side_wall',
      fgItemId: fgItems[i % fgItems.length]?.id ?? defaultFg,
      capacity: name.match(/\d+\s*(M3|KL|FT)/)?.[0] ?? 'Standard',
      axleConfig: `${2 + (i % 3)}-Axle`,
      tareWeightKg: 5000 + i * 200,
      gvwKg: 35000 + i * 500,
      standardPrice: 1800000 + i * 85000,
      standardLeadDays: 35 + (i % 20),
      baseUomId: 'uom-nos',
      hsnCode: '8716',
      specifications: `${name} — Vasant Trailer manufacturing spec`,
      isActive: true,
      ...defaultProductMasterFields({
        productFamily,
        status: i % 5 === 0 ? 'engineering_review' : 'released',
        productRevision: 'Rev-1',
        drawingRevision: `DWG-${code}-A`,
        bomRevision: 'Rev-A',
        routingRevision: 'Rev-A',
        engineeringOwner: 'Arun Nair',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        revisionReason: 'Demo saturation product',
        manufacturing: {
          ...defaultProductMasterFields().manufacturing,
          standardProductionDays: 40,
          releasedBomHeaderId: 'bom-bulker-a',
          releasedRoutingHeaderId: 'rtg-bulker-a',
        },
      }),
    })
    existingNames.add(name.toLowerCase())
  }

  let p = useMasterStore.getState().products.length
  while (useMasterStore.getState().products.length < SATURATION_TARGETS.products) {
    p++
    useMasterStore.getState().addProduct({
      productCode: `FG-SAT-X${String(p).padStart(2, '0')}`,
      productName: `Custom Trailer Variant ${p}`,
      productType: 'side_wall',
      fgItemId: defaultFg,
      capacity: 'Standard',
      axleConfig: '3-Axle',
      tareWeightKg: 6500,
      gvwKg: 40000,
      standardPrice: 2100000,
      standardLeadDays: 42,
      baseUomId: 'uom-nos',
      hsnCode: '8716',
      specifications: 'Custom industrial trailer',
      isActive: true,
      ...defaultProductMasterFields({ productFamily: 'other', status: 'approved' }),
    })
  }
}
