/** SO-level functional / engineering freeze */

export type FreezeStatus = 'draft' | 'active' | 'change_requested' | 'released'

export interface SalesOrderFreeze {
  id: string
  salesOrderId: string
  salesOrderNo: string
  status: FreezeStatus
  productId: string
  productCode: string
  productRevision: string
  bomId: string
  bomNo: string
  bomRevision: string
  routingId: string
  routingNo: string
  routingRevision: string
  costBaseline: number
  deliveryCommitment: string
  customerSpecRef: string
  frozenAt: string
  frozenBy: string
  changeRequestReason: string | null
  changeApprovedBy: string | null
  changeApprovedAt: string | null
  releasedAt: string | null
  releasedBy: string | null
}
