import type { InventoryIssue, InventoryReceipt, MovementLine } from '../../types/inventoryDomain'

let receiptSeq = 100
let issueSeq = 200
let transferSeq = 300
let adjustmentSeq = 400
let returnSeq = 500

export function nextReceiptNo(): string {
  receiptSeq += 1
  return `IR-${String(receiptSeq).padStart(5, '0')}`
}

export function nextIssueNo(): string {
  issueSeq += 1
  return `IS-${String(issueSeq).padStart(5, '0')}`
}

export function nextTransferNo(): string {
  transferSeq += 1
  return `IT-${String(transferSeq).padStart(5, '0')}`
}

export function nextAdjustmentNo(): string {
  adjustmentSeq += 1
  return `IA-${String(adjustmentSeq).padStart(5, '0')}`
}

export function nextReturnNo(): string {
  returnSeq += 1
  return `IRT-${String(returnSeq).padStart(5, '0')}`
}

export function resetMovementSequencesForTests() {
  receiptSeq = 100
  issueSeq = 200
  transferSeq = 300
  adjustmentSeq = 400
  returnSeq = 500
}

/** Demo approval value threshold (INR) */
export const ADJUSTMENT_APPROVAL_THRESHOLD = 25000

/** Reasons that always require approval */
export const ADJUSTMENT_REASONS_REQUIRING_APPROVAL: string[] = [
  'cost_adjustment',
  'opening_stock',
  'quality_reclassification',
]

function baseAudit(action: string, user = 'Demo User') {
  return {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    userName: user,
    timestamp: new Date().toISOString(),
    remarks: null,
  }
}

export function buildMovementLine(
  partial: Partial<MovementLine> & Pick<MovementLine, 'lineNo' | 'itemId' | 'itemCode' | 'itemName' | 'uomCode' | 'warehouseId'>,
): MovementLine {
  return {
    pendingQty: 0,
    receivedQty: 0,
    acceptedQty: 0,
    rejectedQty: 0,
    quarantineQty: 0,
    issuedQty: 0,
    availableQty: 0,
    batchNo: null,
    serialNo: null,
    expiryDate: null,
    rate: 0,
    locationId: null,
    qualityStatus: 'available',
    batchTracking: false,
    serialTracking: false,
    expiryTracking: false,
    remarks: '',
    ...partial,
    id: partial.id ?? `ml-${partial.lineNo}-${partial.itemId}`,
  }
}

/** Initial demo receipts — overwritten by service on first init from live PO/WO data */
export const SEED_RECEIPTS: InventoryReceipt[] = []

/** Initial demo issues */
export const SEED_ISSUES: InventoryIssue[] = []

export { baseAudit }
