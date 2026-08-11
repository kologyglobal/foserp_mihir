import type { InventoryReferenceType } from '@prisma/client'

/**
 * Inventory Transaction Type Registry — read-only documentation/reporting layer.
 *
 * This is NOT a runtime posting-time lookup. `postStockMovement()` callers across
 * purchase, manufacturing, dispatch, quality and maintenance keep passing their own
 * fixed `(movementType, referenceType)` pair exactly as before — that stays the
 * source of truth for what actually posts. This registry only *documents* that
 * existing contract in one browsable place (direction, owning module, whether it
 * hits the GL, whether it is reversible, which permission gates it) so the
 * classification can be reported on/audited without touching any live posting
 * logic. See docs/inventory/INVENTORY_TRANSACTION_TYPE_REGISTER.md.
 *
 * `inventory-reference-type-registry.test.ts` cross-checks this map against the
 * real `isManufacturingOwnedReferenceType()` / `deriveInventoryAccountingEventType()`
 * logic in `inventory-accounting-builder.service.ts` so the two cannot silently
 * drift apart.
 */

export type InventoryReferenceTypeDirection = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT' | 'STATUS_TRANSFER'

export type InventoryReferenceTypeOwnerModule =
  | 'INVENTORY'
  | 'PURCHASE'
  | 'MANUFACTURING'
  | 'DISPATCH'
  | 'QUALITY'
  | 'MAINTENANCE'

export interface InventoryReferenceTypeMeta {
  code: InventoryReferenceType
  label: string
  direction: InventoryReferenceTypeDirection
  ownerModule: InventoryReferenceTypeOwnerModule
  /** True when a posted movement of this type also raises an inventory-accounting GL event. */
  postsToGl: boolean
  /** True when a dedicated reversal path/reference type exists for this transaction. */
  reversible: boolean
  /** Permission required at the real call site(s) that post this reference type today. */
  requiredPermission: string
  /** True when the enum value exists but no `postStockMovement()` caller uses it yet. */
  reserved?: boolean
  description: string
}

export const INVENTORY_REFERENCE_TYPE_REGISTRY: Record<InventoryReferenceType, InventoryReferenceTypeMeta> = {
  OPN: {
    code: 'OPN',
    label: 'Opening Stock',
    direction: 'RECEIPT',
    ownerModule: 'INVENTORY',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'inventory.receipts.post',
    description: 'Initial inventory loading (go-live balances, FIFO opening-stock migration).',
  },
  INW: {
    code: 'INW',
    label: 'Generic Inward',
    direction: 'RECEIPT',
    ownerModule: 'INVENTORY',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'inventory.receipts.post',
    description: 'Ad-hoc manual receipt not tied to a GRN/WO/transfer/quality document.',
  },
  ISS: {
    code: 'ISS',
    label: 'Generic Issue',
    direction: 'ISSUE',
    ownerModule: 'INVENTORY',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'inventory.issues.post',
    description: 'Ad-hoc manual issue not tied to a WO/dispatch/transfer document. Also used for purchase quality-hold-to-issue corrections.',
  },
  ADJ: {
    code: 'ADJ',
    label: 'Generic Adjustment',
    direction: 'ADJUSTMENT',
    ownerModule: 'INVENTORY',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'inventory.adjustments.post',
    description: 'Ad-hoc signed adjustment not tied to a Stock Count or Controlled Adjustment document.',
  },
  GRN: {
    code: 'GRN',
    label: 'Purchase Receipt (GRN)',
    direction: 'RECEIPT',
    ownerModule: 'PURCHASE',
    postsToGl: true,
    reversible: true,
    requiredPermission: 'purchase.grn.create',
    description: 'Goods Receipt Note against a Purchase Order. Posts GRN_INWARD/GRN_REVERSAL to GRIR_CLEARING.',
  },
  ISSUE_TO_WO: {
    code: 'ISSUE_TO_WO',
    label: 'Material Issue Against Work Order',
    direction: 'ISSUE',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: true,
    requiredPermission: 'inventory.issues.post',
    description: 'Manufacturing material consumption against a Work Order. Owned by Manufacturing Accounting, not Inventory Accounting — inventory-accounting-builder must not double-post this. Reversed by RETURN_FROM_WO.',
  },
  RETURN_FROM_WO: {
    code: 'RETURN_FROM_WO',
    label: 'Material Return From Work Order',
    direction: 'RECEIPT',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: true,
    requiredPermission: 'inventory.returns.post',
    description: 'Unused/excess material returned from a Work Order back to store, pinned to the original ISSUE_TO_WO FIFO consumption where possible.',
  },
  WIP_RECEIVE: {
    code: 'WIP_RECEIVE',
    label: 'WIP Receive',
    direction: 'RECEIPT',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'manufacturing.wip.move',
    description: 'Reserved reference type for WIP accounting mapping. No live postStockMovement caller yet.',
    reserved: true,
  },
  WIP_TRANSFER: {
    code: 'WIP_TRANSFER',
    label: 'WIP Transfer',
    direction: 'ADJUSTMENT',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: true,
    requiredPermission: 'manufacturing.wip.move',
    description: 'Movement between WIP positions during Work Order execution (incl. WIP correction handlers).',
  },
  MOVE_TO_WIP: {
    code: 'MOVE_TO_WIP',
    label: 'Move To WIP',
    direction: 'ISSUE',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'manufacturing.wip.move',
    description: 'Reserved reference type for WIP accounting mapping. No live postStockMovement caller yet.',
    reserved: true,
  },
  MOVE_FROM_WIP: {
    code: 'MOVE_FROM_WIP',
    label: 'Move From WIP',
    direction: 'RECEIPT',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'manufacturing.wip.move',
    description: 'Reserved reference type for WIP accounting mapping. No live postStockMovement caller yet.',
    reserved: true,
  },
  SA_RECEIPT: {
    code: 'SA_RECEIPT',
    label: 'Sub-Assembly Receipt',
    direction: 'RECEIPT',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'inventory.receipts.post',
    description: 'LOGICAL/child sub-assembly receipt into WIP during a Work Order (e.g. SA-LADDER child MAKE SA WO).',
  },
  FG_RECEIPT: {
    code: 'FG_RECEIPT',
    label: 'Finished Goods Receipt',
    direction: 'RECEIPT',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: true,
    requiredPermission: 'inventory.receipts.post',
    description: 'Finished-good receipt from a completed Work Order at unitActualCost, into FG warehouse. Reversible via FG correction handlers.',
  },
  DISPATCH: {
    code: 'DISPATCH',
    label: 'Dispatch (Generic)',
    direction: 'ISSUE',
    ownerModule: 'DISPATCH',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'dispatch.post',
    description: 'Reserved reference type for dispatch accounting mapping. No live postStockMovement caller yet — outbound dispatch uses FG_DISPATCH.',
    reserved: true,
  },
  FG_DISPATCH: {
    code: 'FG_DISPATCH',
    label: 'Finished Goods Dispatch (Sales Issue)',
    direction: 'ISSUE',
    ownerModule: 'DISPATCH',
    postsToGl: true,
    reversible: true,
    requiredPermission: 'dispatch.post',
    description: 'Outbound dispatch of finished goods against a Sales Order/delivery. Posts COST_OF_GOODS_SOLD vs FINISHED_GOODS_INVENTORY; a positive-signed posting of this type is treated as the reversal (FG_DISPATCH_REVERSAL).',
  },
  SUBCON_OUT: {
    code: 'SUBCON_OUT',
    label: 'Job Work — Material Sent (Returnable Challan Out)',
    direction: 'ISSUE',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: true,
    requiredPermission: 'manufacturing.job_work.dispatch',
    description: 'Material sent to a job-work vendor for outside processing. Ownership stays with the company; reversed/reconciled by SUBCON_IN.',
  },
  SUBCON_IN: {
    code: 'SUBCON_IN',
    label: 'Job Work — Material Received (Returnable Challan In)',
    direction: 'RECEIPT',
    ownerModule: 'MANUFACTURING',
    postsToGl: false,
    reversible: true,
    requiredPermission: 'manufacturing.job_work.receive',
    description: 'Processed material (or unused/scrap return) received back from a job-work vendor.',
  },
  QUALITY_RELEASE: {
    code: 'QUALITY_RELEASE',
    label: 'Quality Release',
    direction: 'STATUS_TRANSFER',
    ownerModule: 'QUALITY',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'purchase.qi.complete',
    description: 'Stock-status transfer from QC_HOLD to UNRESTRICTED after inspection acceptance (quantity unchanged, status bucket moves).',
  },
  QUALITY_HOLD: {
    code: 'QUALITY_HOLD',
    label: 'Quality Hold',
    direction: 'STATUS_TRANSFER',
    ownerModule: 'QUALITY',
    postsToGl: false,
    reversible: true,
    requiredPermission: 'purchase.qi.edit',
    description: 'Stock-status transfer into QC_HOLD pending inspection (e.g. on GRN receipt when incoming QI is required).',
  },
  QUALITY_REJECT: {
    code: 'QUALITY_REJECT',
    label: 'Quality Rejection',
    direction: 'STATUS_TRANSFER',
    ownerModule: 'QUALITY',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'purchase.qi.complete',
    description: 'Stock-status transfer from QC_HOLD to REJECTED after inspection failure (quantity unchanged, status bucket moves).',
  },
  TRANSFER_DISPATCH: {
    code: 'TRANSFER_DISPATCH',
    label: 'Warehouse Transfer — Dispatch (Issue at Source)',
    direction: 'ISSUE',
    ownerModule: 'INVENTORY',
    postsToGl: false,
    reversible: true,
    requiredPermission: 'inventory.transfers.dispatch',
    description: 'Issue side of a warehouse-to-warehouse stock transfer, posted at the source warehouse.',
  },
  TRANSFER_RECEIPT: {
    code: 'TRANSFER_RECEIPT',
    label: 'Warehouse Transfer — Receipt (Inward at Destination)',
    direction: 'RECEIPT',
    ownerModule: 'INVENTORY',
    postsToGl: false,
    reversible: true,
    requiredPermission: 'inventory.transfers.receive',
    description: 'Receipt side of a warehouse-to-warehouse stock transfer, posted at the destination warehouse; partial receive pinned per-line to cost.',
  },
  TRANSFER_REVERSAL: {
    code: 'TRANSFER_REVERSAL',
    label: 'Warehouse Transfer Reversal',
    direction: 'ADJUSTMENT',
    ownerModule: 'INVENTORY',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'inventory.transfers.reverse',
    description: 'Reversal of a dispatched/received transfer line — negates both the TRANSFER_DISPATCH and TRANSFER_RECEIPT sides.',
  },
  STOCK_COUNT: {
    code: 'STOCK_COUNT',
    label: 'Stock Count Variance',
    direction: 'ADJUSTMENT',
    ownerModule: 'INVENTORY',
    postsToGl: true,
    reversible: true,
    requiredPermission: 'inventory.stock_count.post',
    description: 'Signed variance between system and physically counted quantity, posted on stock-count approval. Posts STOCK_COUNT_ADJUSTMENT to GL.',
  },
  STOCK_COUNT_REVERSAL: {
    code: 'STOCK_COUNT_REVERSAL',
    label: 'Stock Count Variance Reversal',
    direction: 'ADJUSTMENT',
    ownerModule: 'INVENTORY',
    postsToGl: true,
    reversible: false,
    requiredPermission: 'inventory.override',
    description: 'Reversal of a previously posted stock-count variance.',
  },
  CONTROLLED_ADJUSTMENT: {
    code: 'CONTROLLED_ADJUSTMENT',
    label: 'Controlled Adjustment',
    direction: 'ADJUSTMENT',
    ownerModule: 'INVENTORY',
    postsToGl: true,
    reversible: true,
    requiredPermission: 'inventory.adjustments.post',
    description: 'Approved manual stock adjustment (incl. purchase-invoice retro-cost capitalisation of remaining stock). Posts STOCK_ADJUSTMENT to GL.',
  },
  ADJUSTMENT_REVERSAL: {
    code: 'ADJUSTMENT_REVERSAL',
    label: 'Controlled Adjustment Reversal',
    direction: 'ADJUSTMENT',
    ownerModule: 'INVENTORY',
    postsToGl: true,
    reversible: false,
    requiredPermission: 'inventory.override',
    description: 'Reversal of a previously posted controlled adjustment.',
  },
  ISSUE_TO_MAINTENANCE: {
    code: 'ISSUE_TO_MAINTENANCE',
    label: 'Material Issue Against Maintenance Ticket',
    direction: 'ISSUE',
    ownerModule: 'MAINTENANCE',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'maintenance.update',
    description: 'Spare-parts issue against a Maintenance ticket (fail-closed on insufficient stock).',
  },
  SALES_RETURN: {
    code: 'SALES_RETURN',
    label: 'Sales Return',
    direction: 'RECEIPT',
    ownerModule: 'DISPATCH',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'inventory.returns.post',
    description: 'Reserved — customer goods returned back into stock. No posting flow built yet; today only an internal FG_DISPATCH reversal exists, which is not the same business event as a customer physically returning goods.',
    reserved: true,
  },
  REQUISITION_ISSUE: {
    code: 'REQUISITION_ISSUE',
    label: 'Material Issue Against Requisition',
    direction: 'ISSUE',
    ownerModule: 'INVENTORY',
    postsToGl: false,
    reversible: false,
    requiredPermission: 'inventory.issues.post',
    description: 'Reserved — generic inter-department stock requisition issue (beyond the existing Maintenance-specific ISSUE_TO_MAINTENANCE). No posting flow built yet.',
    reserved: true,
  },
}

export function listInventoryReferenceTypes(): InventoryReferenceTypeMeta[] {
  return Object.values(INVENTORY_REFERENCE_TYPE_REGISTRY)
}
