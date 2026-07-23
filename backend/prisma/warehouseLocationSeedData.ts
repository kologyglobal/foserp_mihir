/** Seed warehouses + locations for default tenant (API mode). Upserted by code. */

export type WarehouseSeedRow = {
  code: string
  name: string
  warehouseType:
    | 'main'
    | 'sub'
    | 'wip'
    | 'fg'
    | 'quarantine'
    | 'raw_material'
    | 'finished_goods'
    | 'work_in_progress'
    | 'quality_hold'
    | 'scrap'
    | 'job_work'
  plantCode: string
  address?: string
}

export type LocationSeedRow = {
  code: string
  name: string
  warehouseCode: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
  gstin?: string
  registeredType?: string
  allowSales?: boolean
  allowPurchase?: boolean
  allowProduction?: boolean
  allowInventory?: boolean
}

/** Core warehouses used by seed locations (trailer manufacturing). */
export const WAREHOUSE_SEED_ROWS: WarehouseSeedRow[] = [
  {
    code: 'HO_STORE',
    name: 'Head Office Stores',
    warehouseType: 'main',
    plantCode: 'AHMD',
    address: 'Corporate Office — Prahlad Nagar, Ahmedabad',
  },
  {
    code: 'AHMD_MAIN',
    name: 'Ahmedabad Plant Main',
    warehouseType: 'main',
    plantCode: 'AHMD',
    address: 'Sanand Industrial Estate — Ahmedabad Plant',
  },
  {
    code: 'MUM_YARD',
    name: 'Mumbai Dispatch Yard',
    warehouseType: 'fg',
    plantCode: 'MUM',
    address: 'JNPT Logistics Park — Navi Mumbai',
  },
  {
    code: 'RM_STORE',
    name: 'RM Store',
    warehouseType: 'main',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Raw Material Store Block A',
  },
  {
    code: 'BO_STORE',
    name: 'Bought Out Store',
    warehouseType: 'main',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — BO / Running Gear Store',
  },
  {
    code: 'PAINT_STORE',
    name: 'Paint Store',
    warehouseType: 'sub',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Consumables & Paint Store',
  },
  {
    code: 'WIP_CUTTING',
    name: 'WIP Cutting',
    warehouseType: 'wip',
    plantCode: 'AHMD',
    address: 'Cutting Bay — plate & profile WIP',
  },
  {
    code: 'WIP_FABRICATION',
    name: 'WIP Fabrication',
    warehouseType: 'wip',
    plantCode: 'AHMD',
    address: 'Fabrication — rolled & formed WIP',
  },
  {
    code: 'WIP_WELDING',
    name: 'WIP Welding',
    warehouseType: 'wip',
    plantCode: 'AHMD',
    address: 'Welding Bay — structural & tank weld WIP',
  },
  {
    code: 'WIP_ASSEMBLY',
    name: 'WIP Assembly',
    warehouseType: 'wip',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Chassis & assembly bays',
  },
  {
    code: 'WIP_TANK_ASM',
    name: 'WIP Tank Assembly',
    warehouseType: 'wip',
    plantCode: 'AHMD',
    address: 'Fabrication Bay — Tank shell & assembly WIP',
  },
  {
    code: 'WIP_PAINT',
    name: 'WIP Paint',
    warehouseType: 'wip',
    plantCode: 'AHMD',
    address: 'Paint Shop Bay — surface treatment WIP',
  },
  {
    code: 'WIP_FINAL',
    name: 'WIP Final',
    warehouseType: 'wip',
    plantCode: 'AHMD',
    address: 'Pre-dispatch final assembly WIP',
  },
  {
    code: 'FG_YARD',
    name: 'FG Yard',
    warehouseType: 'fg',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Finished Goods Yard',
  },
  {
    code: 'QUARANTINE',
    name: 'Quarantine',
    warehouseType: 'quarantine',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — QC hold zone (legacy)',
  },
  /** Canonical manufacturing warehouses (profile / mapping pickers). */
  {
    code: 'RM-MAIN',
    name: 'Raw Material Store',
    warehouseType: 'raw_material',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Raw Material Main',
  },
  {
    code: 'BO-MAIN',
    name: 'Bought-Out Components',
    warehouseType: 'raw_material',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Bought-Out Main',
  },
  {
    code: 'WIP',
    name: 'Work-in-Progress',
    warehouseType: 'work_in_progress',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Production WIP',
  },
  {
    code: 'FG-MAIN',
    name: 'Finished Goods',
    warehouseType: 'finished_goods',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Finished Goods Main',
  },
  {
    code: 'QC-HOLD',
    name: 'Quality Hold',
    warehouseType: 'quality_hold',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Quality Hold',
  },
  {
    code: 'SCRAP',
    name: 'Scrap',
    warehouseType: 'scrap',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Scrap Yard',
  },
  {
    code: 'JOB-WORK',
    name: 'Job Work (Subcontractor)',
    warehouseType: 'job_work',
    plantCode: 'AHMD',
    address: 'Material with subcontractor — offsite',
  },
]

/**
 * Business locations for sales / purchase / production documents.
 * Codes kept ≤10 chars to match frontend Location Master validation.
 */
export const LOCATION_SEED_ROWS: LocationSeedRow[] = [
  {
    code: 'HO',
    name: 'Head Office',
    warehouseCode: 'HO_STORE',
    addressLine1: 'Vasant Trailers Pvt Ltd, Prahlad Nagar',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380015',
    country: 'India',
    gstin: '24AABCV1234D1Z5',
    registeredType: 'regular_taxpayer',
    allowSales: true,
    allowPurchase: true,
    allowProduction: false,
    allowInventory: true,
  },
  {
    code: 'AHMD-PLT',
    name: 'Ahmedabad Plant',
    warehouseCode: 'AHMD_MAIN',
    addressLine1: 'Plot 48–52, Sanand GIDC',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    gstin: '24AABCV1234D1Z5',
    registeredType: 'regular_taxpayer',
    allowSales: true,
    allowPurchase: true,
    allowProduction: true,
    allowInventory: true,
  },
  {
    code: 'MUM-YARD',
    name: 'Mumbai Yard',
    warehouseCode: 'MUM_YARD',
    addressLine1: 'Yard B-12, JNPT Logistics Park',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    pincode: '400707',
    country: 'India',
    allowSales: true,
    allowPurchase: false,
    allowProduction: false,
    allowInventory: true,
  },
  {
    code: 'RM-STORE',
    name: 'Raw Material Store',
    warehouseCode: 'RM_STORE',
    addressLine1: 'Plant Store Block A',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: false,
    allowPurchase: true,
    allowProduction: true,
    allowInventory: true,
  },
  {
    code: 'BO-STORE',
    name: 'Bought Out Store',
    warehouseCode: 'BO_STORE',
    addressLine1: 'Plant Store Block B',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: false,
    allowPurchase: true,
    allowProduction: true,
    allowInventory: true,
  },
  {
    code: 'WIP-PROD',
    name: 'Production Floor',
    warehouseCode: 'WIP_ASSEMBLY',
    addressLine1: 'Fabrication & assembly bays',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: false,
    allowPurchase: false,
    allowProduction: true,
    allowInventory: true,
  },
  {
    code: 'FG-YARD',
    name: 'Finished Goods Yard',
    warehouseCode: 'FG_YARD',
    addressLine1: 'Plant Dispatch Yard',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: true,
    allowPurchase: false,
    allowProduction: false,
    allowInventory: true,
  },
  {
    code: 'QC-HOLD',
    name: 'Quality Hold',
    warehouseCode: 'QC-HOLD',
    addressLine1: 'QC hold zone',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: false,
    allowPurchase: true,
    allowProduction: false,
    allowInventory: true,
  },
  {
    code: 'RM-MAIN',
    name: 'Raw Material Main',
    warehouseCode: 'RM-MAIN',
    addressLine1: 'Plant Store Block A — RM Main',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: false,
    allowPurchase: true,
    allowProduction: true,
    allowInventory: true,
  },
  {
    code: 'BO-MAIN',
    name: 'Bought-Out Main',
    warehouseCode: 'BO-MAIN',
    addressLine1: 'Plant Store Block B — BO Main',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: false,
    allowPurchase: true,
    allowProduction: true,
    allowInventory: true,
  },
  {
    code: 'WIP-MAIN',
    name: 'WIP Floor',
    warehouseCode: 'WIP',
    addressLine1: 'Production floor — WIP',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: false,
    allowPurchase: false,
    allowProduction: true,
    allowInventory: true,
  },
  {
    code: 'FG-MAIN',
    name: 'Finished Goods Main',
    warehouseCode: 'FG-MAIN',
    addressLine1: 'Plant Dispatch Yard — FG Main',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: true,
    allowPurchase: false,
    allowProduction: false,
    allowInventory: true,
  },
  {
    code: 'SCRAP',
    name: 'Scrap Yard',
    warehouseCode: 'SCRAP',
    addressLine1: 'Scrap / reject yard',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: false,
    allowPurchase: false,
    allowProduction: false,
    allowInventory: true,
  },
  {
    code: 'JOB-WORK',
    name: 'Job Work Offsite',
    warehouseCode: 'JOB-WORK',
    addressLine1: 'Material with subcontractor',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '382170',
    country: 'India',
    allowSales: false,
    allowPurchase: false,
    allowProduction: true,
    allowInventory: true,
  },
]

/** Codes required for manufacturing profile + warehouse mapping. */
export const MFG_WAREHOUSE_CODES = [
  'RM-MAIN',
  'BO-MAIN',
  'WIP',
  'FG-MAIN',
  'QC-HOLD',
  'SCRAP',
  'JOB-WORK',
] as const
