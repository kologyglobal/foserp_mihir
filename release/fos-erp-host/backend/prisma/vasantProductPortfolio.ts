/**
 * Vasant Fabricators product portfolio — hierarchy for Product Master seed.
 *
 * PRODUCT CATEGORY → PRODUCT FAMILY → PRODUCT → VARIANT
 * Stored without schema change:
 * - productFamily = family key (VarChar)
 * - details.productCategory = category key
 * - details.parentProductCode = variant → parent product
 * - details.isVariant / isConfigurableParent
 * - capacity / gvwKg / details.material for variant specs
 */

export type VasantProductCategory =
  | 'tanks'
  | 'semi_trailers'
  | 'trailers'
  | 'process_equipment'
  | 'body_building_works'

export const VASANT_PRODUCT_CATEGORY_LABELS: Record<VasantProductCategory, string> = {
  tanks: 'Tanks',
  semi_trailers: 'Semi Trailers',
  trailers: 'Trailers',
  process_equipment: 'Process Equipment',
  body_building_works: 'Body Building Works',
}

/** Configurable attribute catalogs (master-driven values, not free text). */
export const VASANT_MATERIAL_OPTIONS = [
  'Mild Steel',
  'Carbon Steel',
  'High Strength Steel',
  'Stainless Steel',
  'Aluminium',
] as const

export const VASANT_LOADING_TYPE_OPTIONS = ['Top Loading', 'Bottom Loading'] as const

export const VASANT_MOUNTING_TYPE_OPTIONS = ['Rigid Vehicle', 'Semi Trailer'] as const

export const VASANT_CHASSIS_MAKE_OPTIONS = [
  'TATA',
  'Ashok Leyland',
  'BharatBenz',
  'Eicher',
  'Mahindra',
  'Other / Custom',
] as const

export const VASANT_COMPARTMENT_CONFIG_OPTIONS = [
  '3 × 4 KL',
  '4 × 3 KL',
  '2 × 4 KL + 2 × 5 KL',
  '4 × 5 KL',
  '1 × 4 KL + 4 × 5 KL',
  '4 × 7 KL',
  'Custom Configuration',
] as const

export const VASANT_OPTIONAL_TREATMENT_OPTIONS = ['FRP Lining', 'EP Coating'] as const

export const VASANT_OPTIONAL_ACCESSORY_OPTIONS = ['Foldable Handrail', 'Custom Accessories'] as const

export const VASANT_APPLICATION_OPTIONS = [
  'Fuel / Petroleum Products',
  'Bulk Liquid',
  'Liquid Chemicals',
  'Industrial Liquid',
  'Dry Powder',
  'Granulates',
  'Cement',
  'Fly Ash',
  'Gas',
  'Industrial Storage',
  'Custom Process Application',
] as const

export const VASANT_FUEL_TANK_CAPACITY_OPTIONS = [
  '12 KL',
  '18 KL',
  '20 KL',
  '24 KL',
  '28 KL',
  '29 KL',
  '30 KL',
  '35 KL',
  '40 KL',
] as const

export interface ProductSeedRow {
  code: string
  name: string
  productFamily: string
  productType: string
  fgItemCode: string | null
  capacity: string
  axleConfig: string
  tareWeightKg: number
  gvwKg: number
  standardPrice: number
  standardLeadDays: number
  baseUomId: string | null
  hsnCode: string
  specifications: string
  productStatus: string
  details: Record<string, unknown>
}

function baseDetails(opts: {
  category: VasantProductCategory
  application?: string
  material?: string
  parentProductCode?: string | null
  isVariant?: boolean
  isConfigurableParent?: boolean
  vehicleGvwLabel?: string
  loadingType?: string
  mountingType?: string
  configAttributes?: Record<string, string[]>
  engineeringOwner?: string
  salesCategory?: string
}): Record<string, unknown> {
  return {
    productCategory: opts.category,
    productCategoryLabel: VASANT_PRODUCT_CATEGORY_LABELS[opts.category],
    application: opts.application ?? '',
    material: opts.material ?? '',
    parentProductCode: opts.parentProductCode ?? null,
    isVariant: Boolean(opts.isVariant),
    isConfigurableParent: Boolean(opts.isConfigurableParent),
    vehicleGvwLabel: opts.vehicleGvwLabel ?? '',
    loadingType: opts.loadingType ?? '',
    mountingType: opts.mountingType ?? '',
    configAttributes: opts.configAttributes ?? {},
    productRevision: 'Rev-1',
    drawingRevision: 'DWG-TBD',
    bomRevision: '—',
    routingRevision: '—',
    engineeringOwner: opts.engineeringOwner ?? 'Engineering',
    effectiveFrom: '2026-07-01',
    effectiveTo: null,
    revisionReason: 'Vasant Fabricators portfolio seed',
    revisions: [],
    manufacturing: {
      defaultWorkCenterIds: [],
      standardProductionDays: 45,
      standardLaborHours: 0,
      releasedBomHeaderId: null,
      releasedRoutingHeaderId: null,
    },
    standardCost: {
      materialCost: 0,
      laborCost: 0,
      machineCost: 0,
      overheadCost: 0,
      totalCost: 0,
      costOverride: false,
      overrideApprovedBy: null,
      overrideApprovedAt: null,
      derivedAt: null,
    },
    quality: {
      finalInspectionPlanId: null,
      finalInspectionPlanName: null,
      customerApprovalRequired: false,
    },
    sales: {
      salesCategory: opts.salesCategory ?? 'domestic',
      defaultWarrantyMonths: 12,
      taxCategory: 'gst_18',
      productBrochure: null,
      specificationSheet: null,
    },
    attachments: [],
    changeLog: [],
  }
}

function product(row: {
  code: string
  name: string
  family: string
  type: string
  category: VasantProductCategory
  fgItemCode?: string | null
  capacity?: string
  axleConfig?: string
  tareWeightKg?: number
  gvwKg?: number
  price?: number
  leadDays?: number
  specs?: string
  application?: string
  material?: string
  parentProductCode?: string | null
  isVariant?: boolean
  isConfigurableParent?: boolean
  vehicleGvwLabel?: string
  loadingType?: string
  mountingType?: string
  configAttributes?: Record<string, string[]>
}): ProductSeedRow {
  return {
    code: row.code,
    name: row.name,
    productFamily: row.family,
    productType: row.type,
    fgItemCode: row.fgItemCode ?? null,
    capacity: row.capacity ?? '',
    axleConfig: row.axleConfig ?? '',
    tareWeightKg: row.tareWeightKg ?? 0,
    gvwKg: row.gvwKg ?? 0,
    standardPrice: row.price ?? 0,
    standardLeadDays: row.leadDays ?? 45,
    baseUomId: null,
    hsnCode: '8716',
    specifications: row.specs ?? '',
    productStatus: 'released',
    details: baseDetails({
      category: row.category,
      application: row.application,
      material: row.material,
      parentProductCode: row.parentProductCode,
      isVariant: row.isVariant,
      isConfigurableParent: row.isConfigurableParent,
      vehicleGvwLabel: row.vehicleGvwLabel,
      loadingType: row.loadingType,
      mountingType: row.mountingType,
      configAttributes: row.configAttributes,
    }),
  }
}

const FUEL_TANK_CONFIG: Record<string, string[]> = {
  Capacity: [...VASANT_FUEL_TANK_CAPACITY_OPTIONS],
  Material: [...VASANT_MATERIAL_OPTIONS],
  'Loading Type': [...VASANT_LOADING_TYPE_OPTIONS],
  'Mounting Type': [...VASANT_MOUNTING_TYPE_OPTIONS],
  'Vehicle Chassis / Make': [...VASANT_CHASSIS_MAKE_OPTIONS],
  'Compartment Configuration': [...VASANT_COMPARTMENT_CONFIG_OPTIONS],
  'Optional Treatments': [...VASANT_OPTIONAL_TREATMENT_OPTIONS],
  'Optional Accessories': [...VASANT_OPTIONAL_ACCESSORY_OPTIONS],
}

/** Core parent products (14) */
const CORE_PRODUCTS: ProductSeedRow[] = [
  product({
    code: 'PRD-FUEL-TANK',
    name: 'Fuel Tank',
    family: 'fuel_tanks',
    type: 'tank',
    category: 'tanks',
    fgItemCode: 'FG-FUEL-TANK',
    application: 'Fuel / Petroleum Products',
    isConfigurableParent: true,
    mountingType: 'Rigid Vehicle',
    configAttributes: FUEL_TANK_CONFIG,
    specs: 'Configurable fuel tank for rigid vehicles. Select capacity, material, loading type, and compartment layout.',
    price: 0,
    leadDays: 40,
  }),
  product({
    code: 'PRD-GAS-TANK',
    name: 'Gas Tank',
    family: 'gas_tanks',
    type: 'tank',
    category: 'tanks',
    fgItemCode: 'FG-GAS-TANK',
    application: 'Gas',
    isConfigurableParent: true,
    specs: 'Unfired gas tank for industrial gas applications. Pressure and design details configurable per order.',
    price: 0,
    leadDays: 55,
  }),
  product({
    code: 'PRD-GAS-ST',
    name: 'Gas Tank Semi Trailer',
    family: 'gas_tank_semi_trailers',
    type: 'semi_trailer',
    category: 'semi_trailers',
    fgItemCode: 'FG-GAS-ST',
    application: 'Gas',
    isConfigurableParent: true,
    mountingType: 'Semi Trailer',
    axleConfig: 'Multi-axle',
    specs: 'Gas tank mounted on semi-trailer chassis. Axles, suspension, and design pressure configurable.',
    price: 0,
    leadDays: 60,
  }),
  product({
    code: 'PRD-BULK-LIQ-TANK',
    name: 'Bulk Liquid Tank',
    family: 'bulk_liquid_tanks',
    type: 'tank',
    category: 'tanks',
    fgItemCode: 'FG-BULK-LIQ-TANK',
    application: 'Bulk Liquid',
    isConfigurableParent: true,
    specs: 'Bulk liquid tank for industrial liquids and chemicals. Material and discharge configurable.',
    price: 0,
    leadDays: 45,
  }),
  product({
    code: 'PRD-BULK-LIQ-ST',
    name: 'Bulk Liquid Tank Semi Trailer',
    family: 'bulk_liquid_tank_semi_trailers',
    type: 'semi_trailer',
    category: 'semi_trailers',
    fgItemCode: 'FG-BULK-LIQ-ST',
    application: 'Bulk Liquid',
    isConfigurableParent: true,
    mountingType: 'Semi Trailer',
    axleConfig: 'Multi-axle',
    specs: 'Bulk liquid tank on semi-trailer for long-haul liquid logistics.',
    price: 0,
    leadDays: 50,
  }),
  product({
    code: 'PRD-DRY-BULK-TANK',
    name: 'Dry Bulk Non-Tipping Tank',
    family: 'dry_bulk_non_tipping_tanks',
    type: 'tank',
    category: 'tanks',
    fgItemCode: 'FG-DRY-BULK-TANK',
    application: 'Dry Powder',
    isConfigurableParent: true,
    specs: 'Non-tipping dry bulk tank for powders and granulates. Discharge type configurable.',
    price: 0,
    leadDays: 45,
  }),
  product({
    code: 'PRD-DRY-BULK-ST',
    name: 'Dry Bulk Non-Tipping Semi Trailer',
    family: 'dry_bulk_non_tipping_semi_trailers',
    type: 'semi_trailer',
    category: 'semi_trailers',
    fgItemCode: 'FG-DRY-BULK-ST',
    application: 'Dry Powder',
    isConfigurableParent: true,
    mountingType: 'Semi Trailer',
    axleConfig: 'Multi-axle',
    specs: 'Non-tipping dry bulk semi-trailer for cement, fly ash, and powder logistics.',
    price: 0,
    leadDays: 50,
  }),
  product({
    code: 'PRD-TIPPING-TANK',
    name: 'Tipping Tank',
    family: 'tipping_tanks',
    type: 'tank',
    category: 'tanks',
    fgItemCode: 'FG-TIPPING-TANK',
    application: 'Bulk Liquid',
    isConfigurableParent: true,
    specs: 'Tipping tank body for rigid vehicles. Capacity and material configurable.',
    price: 0,
    leadDays: 40,
  }),
  product({
    code: 'PRD-TIPPING-ST',
    name: 'Tipping Tanker Semi Trailer',
    family: 'tipping_tanker_semi_trailers',
    type: 'semi_trailer',
    category: 'semi_trailers',
    fgItemCode: 'FG-TIPPING-ST',
    application: 'Bulk Liquid',
    isConfigurableParent: true,
    mountingType: 'Semi Trailer',
    axleConfig: 'Multi-axle',
    specs: 'Tipping tanker semi-trailer for bulk discharge applications.',
    price: 0,
    leadDays: 50,
  }),
  product({
    code: 'PRD-BULKER-ST',
    name: 'Bulker Semi Trailer',
    family: 'bulker_semi_trailers',
    type: 'semi_trailer',
    category: 'semi_trailers',
    fgItemCode: 'FG-BULKER-ST',
    application: 'Cement',
    isConfigurableParent: true,
    mountingType: 'Semi Trailer',
    axleConfig: '3-Axle',
    specs: 'Pneumatic bulker semi-trailer for cement and fly ash. Volume and discharge configurable.',
    price: 0,
    leadDays: 45,
  }),
  product({
    code: 'PRD-STORAGE-TANK',
    name: 'Storage Tank',
    family: 'storage_tanks',
    type: 'tank',
    category: 'tanks',
    fgItemCode: 'FG-STORAGE-TANK',
    application: 'Industrial Storage',
    isConfigurableParent: true,
    specs: 'Stationary industrial storage tank. Capacity, material, and certification configurable.',
    price: 0,
    leadDays: 35,
  }),
  product({
    code: 'PRD-CUSTOM-PROC',
    name: 'Custom Process Equipment',
    family: 'custom_process_equipment',
    type: 'process_equipment',
    category: 'process_equipment',
    fgItemCode: 'FG-CUSTOM-PROC',
    application: 'Custom Process Application',
    isConfigurableParent: true,
    specs: 'Custom ASME / SMPV(U) process equipment fabricated to customer specification.',
    price: 0,
    leadDays: 75,
  }),
  product({
    code: 'PRD-CV-BODY',
    name: 'Commercial Vehicle Body Building',
    family: 'commercial_vehicle_body_building',
    type: 'body_building',
    category: 'body_building_works',
    fgItemCode: 'FG-CV-BODY',
    application: 'Custom Process Application',
    isConfigurableParent: true,
    specs: 'Commercial vehicle body building for trucks and rigid chassis.',
    price: 0,
    leadDays: 30,
  }),
  product({
    code: 'PRD-CUSTOM-BODY',
    name: 'Custom Body Building Work',
    family: 'custom_body_building_works',
    type: 'body_building',
    category: 'body_building_works',
    fgItemCode: 'FG-CUSTOM-BODY',
    application: 'Custom Process Application',
    isConfigurableParent: true,
    specs: 'Custom body building works per customer drawing and requirement.',
    price: 0,
    leadDays: 35,
  }),
]

interface FuelVariantDef {
  code: string
  name: string
  capacity: string
  gvwKg: number
  vehicleGvwLabel: string
  material: string
  fgItemCode: string
  price: number
}

const FUEL_TANK_VARIANTS: FuelVariantDef[] = [
  { code: 'PRD-FUEL-TANK-12KL', name: '12 KL Fuel Tank', capacity: '12 KL', gvwKg: 16000, vehicleGvwLabel: '16 GVW', material: 'Mild Steel', fgItemCode: 'FG-FUEL-TANK-12KL-MS', price: 850000 },
  { code: 'PRD-FUEL-TANK-18KL', name: '18 KL Fuel Tank', capacity: '18 KL', gvwKg: 25000, vehicleGvwLabel: '25 GVW', material: 'Mild Steel', fgItemCode: 'FG-FUEL-TANK-18KL-MS', price: 1100000 },
  { code: 'PRD-FUEL-TANK-20KL', name: '20 KL Fuel Tank', capacity: '20 KL', gvwKg: 25000, vehicleGvwLabel: '25 GVW', material: 'Mild Steel', fgItemCode: 'FG-FUEL-TANK-20KL-MS', price: 1250000 },
  { code: 'PRD-FUEL-TANK-24KL', name: '24 KL Fuel Tank', capacity: '24 KL', gvwKg: 31000, vehicleGvwLabel: '31 GVW', material: 'Mild Steel', fgItemCode: 'FG-FUEL-TANK-24KL-MS', price: 1450000 },
  { code: 'PRD-FUEL-TANK-28KL', name: '28 KL Fuel Tank', capacity: '28 KL', gvwKg: 37000, vehicleGvwLabel: '37 GVW', material: 'Mild Steel', fgItemCode: 'FG-FUEL-TANK-28KL-MS', price: 1650000 },
  { code: 'PRD-FUEL-TANK-29KL', name: '29 KL Fuel Tank', capacity: '29 KL', gvwKg: 37000, vehicleGvwLabel: '37 GVW', material: 'Mild Steel', fgItemCode: 'FG-FUEL-TANK-29KL-MS', price: 1700000 },
  { code: 'PRD-FUEL-TANK-30KL', name: '30 KL Fuel Tank', capacity: '30 KL', gvwKg: 40000, vehicleGvwLabel: '40 GVW', material: 'Mild Steel', fgItemCode: 'FG-FUEL-TANK-30KL-MS', price: 1850000 },
  { code: 'PRD-FUEL-TANK-35KL', name: '35 KL Fuel Tank', capacity: '35 KL', gvwKg: 49000, vehicleGvwLabel: '49 GVW', material: 'Mild Steel', fgItemCode: 'FG-FUEL-TANK-35KL-MS', price: 2100000 },
  { code: 'PRD-FUEL-TANK-40KL-AL', name: '40 KL Aluminium Fuel Tank', capacity: '40 KL', gvwKg: 49000, vehicleGvwLabel: '49 GVW', material: 'Aluminium', fgItemCode: 'FG-FUEL-TANK-40KL-AL', price: 3200000 },
]

const FUEL_VARIANT_ROWS: ProductSeedRow[] = FUEL_TANK_VARIANTS.map((v) =>
  product({
    code: v.code,
    name: v.name,
    family: 'fuel_tanks',
    type: 'tank',
    category: 'tanks',
    fgItemCode: v.fgItemCode,
    capacity: v.capacity,
    gvwKg: v.gvwKg,
    vehicleGvwLabel: v.vehicleGvwLabel,
    material: v.material,
    parentProductCode: 'PRD-FUEL-TANK',
    isVariant: true,
    application: 'Fuel / Petroleum Products',
    mountingType: 'Rigid Vehicle',
    loadingType: '',
    price: v.price,
    leadDays: 40,
    specs: `${v.capacity} fuel tank · Material: ${v.material} · Vehicle GVW: ${v.vehicleGvwLabel}. Loading type, compartments, chassis make, and accessories are configurable.`,
  }),
)

/** Additional family placeholders under Trailers / Process (parents already cover most). */
const EXTRA_FAMILY_PRODUCTS: ProductSeedRow[] = [
  product({
    code: 'PRD-LIQ-TANK-TR',
    name: 'Liquid Tank Trailer',
    family: 'liquid_tank_trailers',
    type: 'trailer',
    category: 'trailers',
    fgItemCode: 'FG-LIQ-TANK-TR',
    application: 'Bulk Liquid',
    isConfigurableParent: true,
    specs: 'Liquid tank trailer for regional transport.',
    price: 0,
    leadDays: 45,
  }),
  product({
    code: 'PRD-TANKER-TR',
    name: 'Tanker Trailer',
    family: 'tanker_trailers',
    type: 'trailer',
    category: 'trailers',
    fgItemCode: 'FG-TANKER-TR',
    application: 'Fuel / Petroleum Products',
    isConfigurableParent: true,
    specs: 'General tanker trailer configuration.',
    price: 0,
    leadDays: 45,
  }),
  product({
    code: 'PRD-CUSTOM-TR',
    name: 'Custom Transport Trailer',
    family: 'custom_transport_trailers',
    type: 'trailer',
    category: 'trailers',
    fgItemCode: 'FG-CUSTOM-TR',
    application: 'Custom Process Application',
    isConfigurableParent: true,
    specs: 'Custom transport trailer built to customer requirement.',
    price: 0,
    leadDays: 50,
  }),
  product({
    code: 'PRD-ASME-PROC',
    name: 'ASME Process Equipment',
    family: 'asme_process_equipment',
    type: 'process_equipment',
    category: 'process_equipment',
    fgItemCode: 'FG-ASME-PROC',
    application: 'Custom Process Application',
    isConfigurableParent: true,
    specs: 'ASME-coded process equipment. Design pressure and certification configurable.',
    price: 0,
    leadDays: 90,
  }),
  product({
    code: 'PRD-SMPV-PROC',
    name: 'SMPV(U) Process Equipment',
    family: 'smpv_process_equipment',
    type: 'process_equipment',
    category: 'process_equipment',
    fgItemCode: 'FG-SMPV-PROC',
    application: 'Gas',
    isConfigurableParent: true,
    specs: 'SMPV(U) compliant process equipment for gas handling.',
    price: 0,
    leadDays: 90,
  }),
]

export const VASANT_PRODUCT_SEED_ROWS: ProductSeedRow[] = [
  ...CORE_PRODUCTS,
  ...FUEL_VARIANT_ROWS,
  ...EXTRA_FAMILY_PRODUCTS,
]

/** FG item codes to seed for Product ↔ Item Master linkage */
export const VASANT_FG_ITEM_SEED: { code: string; name: string; standardRate: number }[] = (() => {
  const map = new Map<string, { code: string; name: string; standardRate: number }>()
  for (const row of VASANT_PRODUCT_SEED_ROWS) {
    if (!row.fgItemCode) continue
    if (map.has(row.fgItemCode)) continue
    map.set(row.fgItemCode, {
      code: row.fgItemCode,
      name: row.name,
      standardRate: row.standardPrice,
    })
  }
  return [...map.values()]
})()

export const VASANT_FAMILY_TO_CATEGORY: Record<string, VasantProductCategory> = {
  fuel_tanks: 'tanks',
  gas_tanks: 'tanks',
  bulk_liquid_tanks: 'tanks',
  dry_bulk_non_tipping_tanks: 'tanks',
  tipping_tanks: 'tanks',
  storage_tanks: 'tanks',
  gas_tank_semi_trailers: 'semi_trailers',
  dry_bulk_non_tipping_semi_trailers: 'semi_trailers',
  tipping_tanker_semi_trailers: 'semi_trailers',
  bulk_liquid_tank_semi_trailers: 'semi_trailers',
  bulker_semi_trailers: 'semi_trailers',
  liquid_tank_trailers: 'trailers',
  tanker_trailers: 'trailers',
  custom_transport_trailers: 'trailers',
  asme_process_equipment: 'process_equipment',
  smpv_process_equipment: 'process_equipment',
  custom_process_equipment: 'process_equipment',
  commercial_vehicle_body_building: 'body_building_works',
  custom_body_building_works: 'body_building_works',
}
