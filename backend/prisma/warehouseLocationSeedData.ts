/** Seed warehouses + locations for default tenant (API mode). Upserted by code. */

export type WarehouseSeedRow = {
  code: string
  name: string
  warehouseType: 'main' | 'sub' | 'wip' | 'fg' | 'quarantine'
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
    code: 'WIP_ASSEMBLY',
    name: 'WIP Assembly',
    warehouseType: 'wip',
    plantCode: 'AHMD',
    address: 'Ahmedabad Plant — Chassis & assembly bays',
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
    address: 'Ahmedabad Plant — QC hold zone',
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
    name: 'QC Quarantine',
    warehouseCode: 'QUARANTINE',
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
]
