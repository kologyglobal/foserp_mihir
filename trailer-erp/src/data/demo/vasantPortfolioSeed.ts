/**
 * Demo-mode mirror of backend Vasant Fabricators portfolio seed.
 * Idempotent merge by productCode / itemCode via mastersExtension.
 */
import type { Item, Product } from '../../types/master'
import type { ProductCategory, ProductFamily, ProductStatus } from '../../types/productMaster'
import { defaultProductMasterFields } from '../../utils/productMaster'

const now = () => new Date().toISOString()

function makeProduct(opts: {
  id: string
  code: string
  name: string
  family: ProductFamily
  type: Product['productType']
  category: ProductCategory
  fgItemId: string
  capacity?: string
  gvwKg?: number
  price?: number
  material?: string
  application?: string
  parentProductCode?: string | null
  isVariant?: boolean
  isConfigurableParent?: boolean
  vehicleGvwLabel?: string
  specs?: string
  axleConfig?: string
}): Product {
  const ts = now()
  return {
    id: opts.id,
    productCode: opts.code,
    productName: opts.name,
    productFamily: opts.family,
    productType: opts.type,
    fgItemId: opts.fgItemId,
    capacity: opts.capacity ?? '',
    axleConfig: opts.axleConfig ?? '',
    tareWeightKg: 0,
    gvwKg: opts.gvwKg ?? 0,
    standardPrice: opts.price ?? 0,
    standardLeadDays: 45,
    baseUomId: 'uom-nos',
    hsnCode: '8716',
    specifications: opts.specs ?? '',
    isActive: true,
    productCategory: opts.category,
    material: opts.material ?? '',
    application: opts.application ?? '',
    parentProductCode: opts.parentProductCode ?? null,
    isVariant: Boolean(opts.isVariant),
    isConfigurableParent: Boolean(opts.isConfigurableParent),
    vehicleGvwLabel: opts.vehicleGvwLabel ?? '',
    ...defaultProductMasterFields({
      productFamily: opts.family,
      status: 'released' as ProductStatus,
      productRevision: 'Rev-1',
      drawingRevision: 'DWG-TBD',
      bomRevision: '—',
      routingRevision: '—',
      engineeringOwner: 'Engineering',
      effectiveFrom: '2026-07-01',
      effectiveTo: null,
      revisionReason: 'Vasant Fabricators portfolio seed',
    }),
    createdAt: ts,
    updatedAt: ts,
  }
}

function makeFgItem(id: string, code: string, name: string, rate: number): Item {
  const ts = now()
  return {
    id,
    itemCode: code,
    itemName: name,
    itemName2: '',
    itemDescription: name,
    categoryId: 'cat-fg',
    baseUomId: 'uom-nos',
    itemType: 'finished_good',
    productType: 'finish_product',
    inventoryType: 'inventory',
    codeSeriesMode: 'manual',
    materialGrade: '',
    hsnCode: '8716',
    reorderLevel: 0,
    reorderQty: 0,
    standardRate: rate,
    isPurchasable: false,
    isStockable: true,
    isBlocked: false,
    quantityPerUom: 1,
    purchaseUomId: 'uom-nos',
    purchaseQtyPerUom: 1,
    qcRequired: false,
    isActive: true,
    createdAt: ts,
  }
}

const parents: Product[] = [
  makeProduct({ id: 'prod-prd-fuel-tank', code: 'PRD-FUEL-TANK', name: 'Fuel Tank', family: 'fuel_tanks', type: 'tank', category: 'tanks', fgItemId: 'item-fg-fuel-tank', application: 'Fuel / Petroleum Products', isConfigurableParent: true, specs: 'Configurable fuel tank for rigid vehicles.' }),
  makeProduct({ id: 'prod-prd-gas-tank', code: 'PRD-GAS-TANK', name: 'Gas Tank', family: 'gas_tanks', type: 'tank', category: 'tanks', fgItemId: 'item-fg-gas-tank', application: 'Gas', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-gas-st', code: 'PRD-GAS-ST', name: 'Gas Tank Semi Trailer', family: 'gas_tank_semi_trailers', type: 'semi_trailer', category: 'semi_trailers', fgItemId: 'item-fg-gas-st', application: 'Gas', isConfigurableParent: true, axleConfig: 'Multi-axle' }),
  makeProduct({ id: 'prod-prd-bulk-liq', code: 'PRD-BULK-LIQ-TANK', name: 'Bulk Liquid Tank', family: 'bulk_liquid_tanks', type: 'tank', category: 'tanks', fgItemId: 'item-fg-bulk-liq', application: 'Bulk Liquid', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-bulk-liq-st', code: 'PRD-BULK-LIQ-ST', name: 'Bulk Liquid Tank Semi Trailer', family: 'bulk_liquid_tank_semi_trailers', type: 'semi_trailer', category: 'semi_trailers', fgItemId: 'item-fg-bulk-liq-st', application: 'Bulk Liquid', isConfigurableParent: true, axleConfig: 'Multi-axle' }),
  makeProduct({ id: 'prod-prd-dry-bulk', code: 'PRD-DRY-BULK-TANK', name: 'Dry Bulk Non-Tipping Tank', family: 'dry_bulk_non_tipping_tanks', type: 'tank', category: 'tanks', fgItemId: 'item-fg-dry-bulk', application: 'Dry Powder', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-dry-bulk-st', code: 'PRD-DRY-BULK-ST', name: 'Dry Bulk Non-Tipping Semi Trailer', family: 'dry_bulk_non_tipping_semi_trailers', type: 'semi_trailer', category: 'semi_trailers', fgItemId: 'item-fg-dry-bulk-st', application: 'Dry Powder', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-tipping', code: 'PRD-TIPPING-TANK', name: 'Tipping Tank', family: 'tipping_tanks', type: 'tank', category: 'tanks', fgItemId: 'item-fg-tipping-tank', application: 'Bulk Liquid', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-tipping-st', code: 'PRD-TIPPING-ST', name: 'Tipping Tanker Semi Trailer', family: 'tipping_tanker_semi_trailers', type: 'semi_trailer', category: 'semi_trailers', fgItemId: 'item-fg-tipping-st', application: 'Bulk Liquid', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-bulker-st', code: 'PRD-BULKER-ST', name: 'Bulker Semi Trailer', family: 'bulker_semi_trailers', type: 'semi_trailer', category: 'semi_trailers', fgItemId: 'item-fg-bulker-st', application: 'Cement', isConfigurableParent: true, axleConfig: '3-Axle' }),
  makeProduct({ id: 'prod-prd-storage', code: 'PRD-STORAGE-TANK', name: 'Storage Tank', family: 'storage_tanks', type: 'tank', category: 'tanks', fgItemId: 'item-fg-storage', application: 'Industrial Storage', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-custom-proc', code: 'PRD-CUSTOM-PROC', name: 'Custom Process Equipment', family: 'custom_process_equipment', type: 'process_equipment', category: 'process_equipment', fgItemId: 'item-fg-custom-proc', application: 'Custom Process Application', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-cv-body', code: 'PRD-CV-BODY', name: 'Commercial Vehicle Body Building', family: 'commercial_vehicle_body_building', type: 'body_building', category: 'body_building_works', fgItemId: 'item-fg-cv-body', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-custom-body', code: 'PRD-CUSTOM-BODY', name: 'Custom Body Building Work', family: 'custom_body_building_works', type: 'body_building', category: 'body_building_works', fgItemId: 'item-fg-custom-body', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-liq-tr', code: 'PRD-LIQ-TANK-TR', name: 'Liquid Tank Trailer', family: 'liquid_tank_trailers', type: 'trailer', category: 'trailers', fgItemId: 'item-fg-liq-tr', application: 'Bulk Liquid', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-tanker-tr', code: 'PRD-TANKER-TR', name: 'Tanker Trailer', family: 'tanker_trailers', type: 'trailer', category: 'trailers', fgItemId: 'item-fg-tanker-tr', application: 'Fuel / Petroleum Products', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-custom-tr', code: 'PRD-CUSTOM-TR', name: 'Custom Transport Trailer', family: 'custom_transport_trailers', type: 'trailer', category: 'trailers', fgItemId: 'item-fg-custom-tr', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-asme', code: 'PRD-ASME-PROC', name: 'ASME Process Equipment', family: 'asme_process_equipment', type: 'process_equipment', category: 'process_equipment', fgItemId: 'item-fg-asme', isConfigurableParent: true }),
  makeProduct({ id: 'prod-prd-smpv', code: 'PRD-SMPV-PROC', name: 'SMPV(U) Process Equipment', family: 'smpv_process_equipment', type: 'process_equipment', category: 'process_equipment', fgItemId: 'item-fg-smpv', application: 'Gas', isConfigurableParent: true }),
]

const fuelVariants: { id: string; code: string; name: string; capacity: string; gvw: number; gvwLabel: string; material: string; fgId: string; fgCode: string; price: number }[] = [
  { id: 'prod-prd-fuel-12', code: 'PRD-FUEL-TANK-12KL', name: '12 KL Fuel Tank', capacity: '12 KL', gvw: 16000, gvwLabel: '16 GVW', material: 'Mild Steel', fgId: 'item-fg-fuel-12', fgCode: 'FG-FUEL-TANK-12KL-MS', price: 850000 },
  { id: 'prod-prd-fuel-18', code: 'PRD-FUEL-TANK-18KL', name: '18 KL Fuel Tank', capacity: '18 KL', gvw: 25000, gvwLabel: '25 GVW', material: 'Mild Steel', fgId: 'item-fg-fuel-18', fgCode: 'FG-FUEL-TANK-18KL-MS', price: 1100000 },
  { id: 'prod-prd-fuel-20', code: 'PRD-FUEL-TANK-20KL', name: '20 KL Fuel Tank', capacity: '20 KL', gvw: 25000, gvwLabel: '25 GVW', material: 'Mild Steel', fgId: 'item-fg-fuel-20', fgCode: 'FG-FUEL-TANK-20KL-MS', price: 1250000 },
  { id: 'prod-prd-fuel-24', code: 'PRD-FUEL-TANK-24KL', name: '24 KL Fuel Tank', capacity: '24 KL', gvw: 31000, gvwLabel: '31 GVW', material: 'Mild Steel', fgId: 'item-fg-fuel-24', fgCode: 'FG-FUEL-TANK-24KL-MS', price: 1450000 },
  { id: 'prod-prd-fuel-28', code: 'PRD-FUEL-TANK-28KL', name: '28 KL Fuel Tank', capacity: '28 KL', gvw: 37000, gvwLabel: '37 GVW', material: 'Mild Steel', fgId: 'item-fg-fuel-28', fgCode: 'FG-FUEL-TANK-28KL-MS', price: 1650000 },
  { id: 'prod-prd-fuel-29', code: 'PRD-FUEL-TANK-29KL', name: '29 KL Fuel Tank', capacity: '29 KL', gvw: 37000, gvwLabel: '37 GVW', material: 'Mild Steel', fgId: 'item-fg-fuel-29', fgCode: 'FG-FUEL-TANK-29KL-MS', price: 1700000 },
  { id: 'prod-prd-fuel-30', code: 'PRD-FUEL-TANK-30KL', name: '30 KL Fuel Tank', capacity: '30 KL', gvw: 40000, gvwLabel: '40 GVW', material: 'Mild Steel', fgId: 'item-fg-fuel-30', fgCode: 'FG-FUEL-TANK-30KL-MS', price: 1850000 },
  { id: 'prod-prd-fuel-35', code: 'PRD-FUEL-TANK-35KL', name: '35 KL Fuel Tank', capacity: '35 KL', gvw: 49000, gvwLabel: '49 GVW', material: 'Mild Steel', fgId: 'item-fg-fuel-35', fgCode: 'FG-FUEL-TANK-35KL-MS', price: 2100000 },
  { id: 'prod-prd-fuel-40al', code: 'PRD-FUEL-TANK-40KL-AL', name: '40 KL Aluminium Fuel Tank', capacity: '40 KL', gvw: 49000, gvwLabel: '49 GVW', material: 'Aluminium', fgId: 'item-fg-fuel-40al', fgCode: 'FG-FUEL-TANK-40KL-AL', price: 3200000 },
]

export const vasantPortfolioProducts: Product[] = [
  ...parents,
  ...fuelVariants.map((v) =>
    makeProduct({
      id: v.id,
      code: v.code,
      name: v.name,
      family: 'fuel_tanks',
      type: 'tank',
      category: 'tanks',
      fgItemId: v.fgId,
      capacity: v.capacity,
      gvwKg: v.gvw,
      vehicleGvwLabel: v.gvwLabel,
      material: v.material,
      parentProductCode: 'PRD-FUEL-TANK',
      isVariant: true,
      application: 'Fuel / Petroleum Products',
      price: v.price,
      specs: `${v.capacity} fuel tank · ${v.material} · Vehicle GVW: ${v.gvwLabel}.`,
    }),
  ),
]

export const vasantPortfolioFgItems: Item[] = [
  makeFgItem('item-fg-fuel-tank', 'FG-FUEL-TANK', 'Fuel Tank', 0),
  makeFgItem('item-fg-gas-tank', 'FG-GAS-TANK', 'Gas Tank', 0),
  makeFgItem('item-fg-gas-st', 'FG-GAS-ST', 'Gas Tank Semi Trailer', 0),
  makeFgItem('item-fg-bulk-liq', 'FG-BULK-LIQ-TANK', 'Bulk Liquid Tank', 0),
  makeFgItem('item-fg-bulk-liq-st', 'FG-BULK-LIQ-ST', 'Bulk Liquid Tank Semi Trailer', 0),
  makeFgItem('item-fg-dry-bulk', 'FG-DRY-BULK-TANK', 'Dry Bulk Non-Tipping Tank', 0),
  makeFgItem('item-fg-dry-bulk-st', 'FG-DRY-BULK-ST', 'Dry Bulk Non-Tipping Semi Trailer', 0),
  makeFgItem('item-fg-tipping-tank', 'FG-TIPPING-TANK', 'Tipping Tank', 0),
  makeFgItem('item-fg-tipping-st', 'FG-TIPPING-ST', 'Tipping Tanker Semi Trailer', 0),
  makeFgItem('item-fg-bulker-st', 'FG-BULKER-ST', 'Bulker Semi Trailer', 0),
  makeFgItem('item-fg-storage', 'FG-STORAGE-TANK', 'Storage Tank', 0),
  makeFgItem('item-fg-custom-proc', 'FG-CUSTOM-PROC', 'Custom Process Equipment', 0),
  makeFgItem('item-fg-cv-body', 'FG-CV-BODY', 'Commercial Vehicle Body Building', 0),
  makeFgItem('item-fg-custom-body', 'FG-CUSTOM-BODY', 'Custom Body Building Work', 0),
  makeFgItem('item-fg-liq-tr', 'FG-LIQ-TANK-TR', 'Liquid Tank Trailer', 0),
  makeFgItem('item-fg-tanker-tr', 'FG-TANKER-TR', 'Tanker Trailer', 0),
  makeFgItem('item-fg-custom-tr', 'FG-CUSTOM-TR', 'Custom Transport Trailer', 0),
  makeFgItem('item-fg-asme', 'FG-ASME-PROC', 'ASME Process Equipment', 0),
  makeFgItem('item-fg-smpv', 'FG-SMPV-PROC', 'SMPV(U) Process Equipment', 0),
  ...fuelVariants.map((v) => makeFgItem(v.fgId, v.fgCode, v.name, v.price)),
]
