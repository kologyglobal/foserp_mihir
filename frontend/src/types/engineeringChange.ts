/** Engineering Change Request / Order — factory control workflow */

export type EcrChangeType = 'product' | 'bom' | 'routing' | 'item' | 'process' | 'cost'
export type EcrPriority = 'low' | 'medium' | 'high' | 'critical'
export type EcrStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'impact_analysis'
  | 'approved_for_eco'
  | 'rejected'
  | 'cancelled'

export type EcoStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'released'
  | 'implemented'
  | 'closed'
  | 'rejected'

export interface EngineeringChangeRequest {
  id: string
  ecrNo: string
  changeType: EcrChangeType
  productId: string | null
  bomId: string | null
  routingId: string | null
  itemId: string | null
  reason: string
  requestedBy: string
  priority: EcrPriority
  status: EcrStatus
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewRemarks: string
}

export interface EngineeringChangeOrder {
  id: string
  ecoNo: string
  ecrId: string
  effectiveDate: string
  affectedProductId: string | null
  affectedBomId: string | null
  affectedRoutingId: string | null
  costImpact: number
  approvalStatus: EcoStatus
  createdAt: string
  updatedAt: string
  approvedBy: string | null
  approvedAt: string | null
  releasedBy: string | null
  releasedAt: string | null
  implementedAt: string | null
  remarks: string
}

export interface EcoImpactAnalysis {
  products: Array<{ id: string; code: string; name: string }>
  boms: Array<{ id: string; bomNo: string; revision: string; status: string }>
  openSalesOrders: Array<{ id: string; salesOrderNo: string; status: string; qty: number }>
  openWorkOrders: Array<{ id: string; woNo: string; status: string; bomRevision: string }>
  openPurchaseOrders: Array<{ id: string; poNo: string; status: string; totalAmount: number }>
  openPurchaseRequisitions: Array<{ id: string; prNo: string; status: string }>
  inventoryItems: Array<{ id: string; itemCode: string; itemName: string; freeQty: number }>
  costSheets: Array<{ productId: string; productCode: string; standardCost: number }>
}
