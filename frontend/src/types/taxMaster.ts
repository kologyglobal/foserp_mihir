import type { MasterRecordAudit } from './master'

/** Engineering product classification on Item Master */
export type EngineeringProductType =
  | 'boi'
  | 'raw_material'
  | 'sub_assembly'
  | 'assembly_product'
  | 'finish_product'
  | 'scrap'
  | 'service'

export type InventoryPostingType = 'inventory' | 'non_inventory' | 'service'

export type GstGoodsType = 'goods' | 'service'

export type ItemCodeSeriesMode = 'auto' | 'manual'

export interface HsnMaster extends MasterRecordAudit {
  id: string
  code: string
  gstGroupId: string
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface GstGroupCode extends MasterRecordAudit {
  id: string
  code: string
  goodsType: GstGoodsType
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type GstTaxApplicability = 'SALES' | 'PURCHASE' | 'BOTH'

export interface GstRate extends MasterRecordAudit {
  id: string
  code: string
  gstGroupId: string
  fromState: string
  locationStateCode: string
  dateFrom: string
  dateTo: string | null
  sgst: number
  cgst: number
  igst: number
  /** Sales / purchase / both — finance engine filters by document context. */
  applicableFor: GstTaxApplicability
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const ENGINEERING_PRODUCT_TYPE_LABELS: Record<EngineeringProductType, string> = {
  boi: 'BOI',
  raw_material: 'Raw Material',
  sub_assembly: 'Sub Assembly',
  assembly_product: 'Assembly Product',
  finish_product: 'Finish Product',
  scrap: 'Scrap',
  service: 'Service',
}

export const ENGINEERING_PRODUCT_TYPES: readonly EngineeringProductType[] = [
  'boi',
  'raw_material',
  'sub_assembly',
  'assembly_product',
  'finish_product',
  'scrap',
  'service',
] as const

export const INVENTORY_POSTING_TYPE_LABELS: Record<InventoryPostingType, string> = {
  inventory: 'Inventory',
  non_inventory: 'Non-Inventory',
  service: 'Service',
}

export const GST_GOODS_TYPE_LABELS: Record<GstGoodsType, string> = {
  goods: 'Goods',
  service: 'Service',
}

export const QUALITY_TEST_GROUP_OPTIONS = [
  { code: 'RM-INCOMING', label: 'RM Incoming QC' },
  { code: 'SA-INTER', label: 'Sub-Assembly In-Process' },
  { code: 'FG-FINAL', label: 'Final Inspection' },
  { code: 'BO-RECEIPT', label: 'Bought-Out Receipt QC' },
  { code: 'PAINT-QC', label: 'Paint & Surface QC' },
] as const
