import type { BomSourceType } from './bom'
import type { SubAssemblyRule } from './master'

export type MrpRiskStatus = 'ready' | 'low' | 'critical' | 'delayed'
export type MrpExceptionType =
  | 'no_released_bom'
  | 'no_fg_item'
  | 'inactive_bom_item'
  | 'past_due_material'
  | 'no_vendor'
  | 'draft_bom_skipped'

export type SalesOrderStatus =
  | 'open'
  | 'confirmed'
  | 'in_production'
  | 'ready_dispatch'
  | 'dispatched'
  | 'invoiced'
  | 'closed'
  /** UI register only — approved quotation awaiting SO conversion (not persisted). */
  | 'pending_so'

export type SalesOrderSource = 'quotation' | 'direct'

export interface SalesOrderLine {
  id: string
  lineNo: number
  productOrItem: string
  description: string
  productId?: string | null
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  taxPct: number
  taxableValue: number
  gstAmount: number
  lineTotal: number
  technicalScopeRef?: string | null
}

export interface SalesOrder {
  id: string
  salesOrderNo: string
  customerId: string
  productId: string
  qty: number
  requiredDate: string
  status: SalesOrderStatus
  remarks: string
  createdAt: string
  /** Last update timestamp from API audit fields (demo may omit). */
  modifiedAt?: string | null
  /** Commercial linkage — set when SO created from approved quotation; may be null after quote/opp cleanup */
  quotationId?: string | null
  quotationNo?: string | null
  quotationRevisionNo?: number | null
  quotationDocumentId?: string | null
  quotationDocumentRevisionNo?: number | null
  inquiryId?: string | null
  opportunityId?: string | null
  contactId?: string | null
  unitPrice?: number | null
  discountPct?: number | null
  grandTotal?: number | null
  paymentTerms?: string | null
  deliveryTerms?: string | null
  warrantyTerms?: string | null
  commercialNotes?: string | null
  technicalNotes?: string | null
  /** Extended commercial / handover fields */
  orderDate?: string | null
  source?: SalesOrderSource | null
  customerCode?: string | null
  customerPoNumber?: string | null
  customerPoDate?: string | null
  expectedDeliveryDate?: string | null
  deliveryLocation?: string | null
  billingAddress?: string | null
  shippingAddress?: string | null
  salesOwnerId?: string | null
  salesOwnerName?: string | null
  basicAmount?: number | null
  gstAmount?: number | null
  internalRemarks?: string | null
  directSoReason?: string | null
  lines?: SalesOrderLine[]
  locationId?: string | null
}

export interface MrpMaterialLine {
  id: string
  salesOrderId: string
  salesOrderNo: string
  productId: string
  productName: string
  fgItemCode: string
  bomHeaderId: string
  bomRevision: string
  pegBomLineId: string
  pegParentItemCode: string | null
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  warehouseCode: string
  uomCode: string
  sourceType: BomSourceType
  subAssemblyRule: SubAssemblyRule | null
  requiredQty: number
  onHand: number
  reservedQty: number
  freeStock: number
  shortageQty: number
  leadTimeDays: number
  suggestedPoQty: number
  suggestedPrQty: number
  requiredDate: string
  orderByDate: string
  riskStatus: MrpRiskStatus
  preferredVendor: string | null
}

export interface MrpWoRequirement {
  id: string
  salesOrderId: string
  salesOrderNo: string
  productId: string
  productName: string
  bomHeaderId: string
  pegBomLineId: string
  itemId: string
  itemCode: string
  itemName: string
  subAssemblyRule: SubAssemblyRule
  requiredQty: number
  requiredDate: string
  startByDate: string
  warehouseId: string
  warehouseCode: string
  leadTimeDays: number
  riskStatus: MrpRiskStatus
}

export interface MrpException {
  id: string
  salesOrderId: string
  salesOrderNo: string
  productId: string | null
  type: MrpExceptionType
  severity: 'warning' | 'error'
  message: string
}

export interface MrpPeggingLink {
  id: string
  salesOrderNo: string
  productName: string
  fgItemCode: string
  bomRevision: string
  pegParentItemCode: string | null
  demandItemCode: string
  demandItemName: string
  warehouseCode: string
  requiredQty: number
  requiredDate: string
}

export interface MrpRun {
  id: string
  runNo: string
  runAt: string
  runBy: string
  salesOrderIds: string[]
  materialLines: MrpMaterialLine[]
  woRequirements: MrpWoRequirement[]
  exceptions: MrpException[]
  pegging: MrpPeggingLink[]
}

export interface MrpRunInput {
  salesOrderId: string
  productId: string
  qty: number
  requiredDate: string
}

export interface MrpRunOptions {
  /** Reserve all available free stock against SO demand before MRP calculation */
  autoReserve?: boolean
}

export interface SoReservationResult {
  ok: boolean
  reservedLines: number
  reservedQty: number
  partialLines: number
  error?: string
}

export interface MrpDashboardSummary {
  materialShortages: number
  delayedMaterials: number
  purchaseRequired: number
  productionReadyOrders: number
  lastRunAt: string | null
}
