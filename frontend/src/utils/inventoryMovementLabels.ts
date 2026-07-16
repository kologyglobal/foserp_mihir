import type {
  AdjustmentStatus,
  AdjustmentType,
  BatchSelectionMethod,
  InventoryReturnStatus,
  InventoryReturnType,
  IssueDocumentStatus,
  IssueSourceType,
  QualityDisposition,
  ReceiptDocumentStatus,
  ReceiptSourceType,
  SalesReturnCondition,
  TransferStatus,
  TransferType,
} from '../types/inventoryDomain'

export const RECEIPT_SOURCE_LABELS: Record<ReceiptSourceType, string> = {
  purchase_order: 'Purchase Order',
  production_output: 'Production Output',
  transfer_receipt: 'Transfer Receipt',
  customer_return: 'Customer Return',
  job_work_receipt: 'Job-Work Receipt',
  direct_receipt: 'Direct Receipt',
}

export const ISSUE_SOURCE_LABELS: Record<IssueSourceType, string> = {
  production_order: 'Production Order',
  sales_order: 'Sales Order',
  maintenance: 'Maintenance',
  subcontract_issue: 'Subcontract Issue',
  transfer_issue: 'Transfer Issue',
  direct_issue: 'Direct Issue',
}

export const RECEIPT_STATUS_LABELS: Record<ReceiptDocumentStatus, string> = {
  draft: 'Draft',
  pending_receipt: 'Pending Receipt',
  quality_hold: 'Quality Hold',
  partially_received: 'Partially Received',
  posted: 'Posted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const ISSUE_STATUS_LABELS: Record<IssueDocumentStatus, string> = {
  draft: 'Draft',
  pending_issue: 'Pending Issue',
  partially_issued: 'Partially Issued',
  posted: 'Posted',
  reversed: 'Reversed',
  cancelled: 'Cancelled',
}

export const QUALITY_DISPOSITION_LABELS: Record<QualityDisposition, string> = {
  available: 'Available',
  quality_hold: 'Quality Hold',
  quarantine: 'Quarantine',
  rejected: 'Rejected',
  blocked: 'Blocked',
}

export const BATCH_METHOD_LABELS: Record<BatchSelectionMethod, string> = {
  fifo: 'FIFO',
  fefo: 'FEFO',
  manual: 'Manual',
}

export const RECEIPT_REGISTER_TABS = [
  { id: 'all', label: 'All', status: null as ReceiptDocumentStatus | null },
  { id: 'draft', label: 'Draft', status: 'draft' as const },
  { id: 'pending_receipt', label: 'Pending Receipt', status: 'pending_receipt' as const },
  { id: 'quality_hold', label: 'Quality Hold', status: 'quality_hold' as const },
  { id: 'partially_received', label: 'Partially Received', status: 'partially_received' as const },
  { id: 'posted', label: 'Posted', status: 'posted' as const },
  { id: 'rejected', label: 'Rejected', status: 'rejected' as const },
  { id: 'cancelled', label: 'Cancelled', status: 'cancelled' as const },
] as const

export const ISSUE_REGISTER_TABS = [
  { id: 'all', label: 'All', status: null as IssueDocumentStatus | null },
  { id: 'draft', label: 'Draft', status: 'draft' as const },
  { id: 'pending_issue', label: 'Pending Issue', status: 'pending_issue' as const },
  { id: 'partially_issued', label: 'Partially Issued', status: 'partially_issued' as const },
  { id: 'posted', label: 'Posted', status: 'posted' as const },
  { id: 'reversed', label: 'Reversed', status: 'reversed' as const },
  { id: 'cancelled', label: 'Cancelled', status: 'cancelled' as const },
] as const

export const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  warehouse_to_warehouse: 'Warehouse to Warehouse',
  plant_to_plant: 'Plant to Plant',
  bin_to_bin: 'Bin to Bin',
  quality_to_available: 'Quality to Available',
  available_to_quarantine: 'Available to Quarantine',
  production_to_warehouse: 'Production to Warehouse',
  warehouse_to_production: 'Warehouse to Production',
}

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  draft: 'Draft',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  partially_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled',
}

export const TRANSFER_REGISTER_TABS = [
  { id: 'all', label: 'All', status: null as TransferStatus | null },
  { id: 'draft', label: 'Draft', status: 'draft' as const },
  { id: 'dispatched', label: 'Dispatched', status: 'dispatched' as const },
  { id: 'in_transit', label: 'In Transit', status: 'in_transit' as const },
  { id: 'partially_received', label: 'Partially Received', status: 'partially_received' as const },
  { id: 'received', label: 'Received', status: 'received' as const },
  { id: 'cancelled', label: 'Cancelled', status: 'cancelled' as const },
] as const

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  found_stock: 'Found Stock',
  shortage: 'Shortage',
  damage: 'Damage',
  scrap: 'Scrap',
  expiry: 'Expiry',
  wrong_batch: 'Wrong Batch',
  wrong_warehouse: 'Wrong Warehouse',
  opening_stock: 'Opening Stock',
  quality_reclassification: 'Quality Reclassification',
  cost_adjustment: 'Cost Adjustment',
  other: 'Other',
}

export const ADJUSTMENT_STATUS_LABELS: Record<AdjustmentStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  posted: 'Posted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const ADJUSTMENT_REGISTER_TABS = [
  { id: 'all', label: 'All', status: null as AdjustmentStatus | null },
  { id: 'draft', label: 'Draft', status: 'draft' as const },
  { id: 'pending_approval', label: 'Pending Approval', status: 'pending_approval' as const },
  { id: 'approved', label: 'Approved', status: 'approved' as const },
  { id: 'posted', label: 'Posted', status: 'posted' as const },
  { id: 'rejected', label: 'Rejected', status: 'rejected' as const },
  { id: 'cancelled', label: 'Cancelled', status: 'cancelled' as const },
] as const

export const RETURN_TYPE_LABELS: Record<InventoryReturnType, string> = {
  purchase_return: 'Purchase Return',
  sales_return: 'Sales Return',
  production_material_return: 'Production Material Return',
  transfer_return: 'Transfer Return',
  job_work_return: 'Job-Work Return',
}

export const RETURN_STATUS_LABELS: Record<InventoryReturnStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
  cancelled: 'Cancelled',
}

export const SALES_RETURN_CONDITION_LABELS: Record<SalesReturnCondition, string> = {
  accept: 'Accept',
  repair: 'Repair',
  reject: 'Reject',
  scrap: 'Scrap',
}

export const RETURN_REGISTER_TABS = [
  { id: 'all', label: 'All', status: null as InventoryReturnStatus | null },
  { id: 'draft', label: 'Draft', status: 'draft' as const },
  { id: 'posted', label: 'Posted', status: 'posted' as const },
  { id: 'cancelled', label: 'Cancelled', status: 'cancelled' as const },
] as const
