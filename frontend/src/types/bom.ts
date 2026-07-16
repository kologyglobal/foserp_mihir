import type { ItemType, SubAssemblyRule } from './master'

export type BomNodeLevel = 'assembly' | 'sub_assembly' | 'component'
export type BomSourceType = 'make' | 'buy' | 'subcontract'
export type BomStatus = 'draft' | 'submitted' | 'approved' | 'released' | 'obsolete'

export interface BomHeader {
  id: string
  bomNo: string
  productId: string
  revision: string
  description: string
  status: BomStatus
  previousRevisionId: string | null
  effectiveFrom: string
  approvedBy: string | null
  approvedAt: string | null
  submittedAt: string | null
  submittedBy: string | null
  totalCost: number
  createdAt: string
  updatedAt: string
}

export interface BomLine {
  id: string
  bomHeaderId: string
  parentLineId: string | null
  itemId: string
  nodeLevel: BomNodeLevel
  qtyPerParent: number
  uomId: string
  scrapPct: number
  sourceType: BomSourceType
  issueWarehouseId: string
  leadTimeDays: number
  standardCost: number
  sortOrder: number
}

export interface BomLineEnriched extends BomLine {
  itemCode: string
  itemName: string
  itemType: ItemType
  subAssemblyRule: SubAssemblyRule | null
  specification: string
  uomCode: string
  issueWarehouseCode: string
  qtyPerProduct: number
  totalCost: number
  revision: string
  children: BomLineEnriched[]
}

export interface BomRevisionCompare {
  field: string
  revA: string | number
  revB: string | number
  changed: boolean
}

/** MRP and production consume Released BOM only */
export const MRP_ELIGIBLE_STATUSES: BomStatus[] = ['released']

export const SUB_ASSEMBLY_RULE_LABELS: Record<NonNullable<SubAssemblyRule>, string> = {
  phantom: 'Phantom — explode children only, not stocked',
  manufactured: 'Manufactured — in-house sub-assembly with own BOM',
  purchased: 'Purchased — buy complete sub-assembly',
  subcontracted: 'Subcontracted — send out for external processing',
}
