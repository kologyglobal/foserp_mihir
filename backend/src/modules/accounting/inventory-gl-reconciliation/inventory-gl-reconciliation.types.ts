/** FIN-CLOSE-1 — Inventory ↔ GL / WIP ↔ GL trial-balance reason codes (no Force Balance). */
export const INVENTORY_GL_REASON_CODES = [
  'MATCHED',
  'MAPPING_MISSING',
  'ACCOUNTING_EVENT_FAILED',
  'ACCOUNTING_EVENT_UNPOSTED',
  'GRIR_NOT_CLEARED',
  'MANUAL_GL_ENTRY_DIFFERENCE',
  'OPERATIONAL_VALUE_DIFFERENCE',
  'FEATURE_FLAG_OFF',
] as const

export type InventoryGlReasonCode = (typeof INVENTORY_GL_REASON_CODES)[number]

export type InventoryGlAccountKey =
  | 'RAW_MATERIAL_INVENTORY'
  | 'FINISHED_GOODS_INVENTORY'
  | 'WIP_INVENTORY'
  | 'GRIR_CLEARING'

export interface InventoryGlTrialBalanceRow {
  mappingKey: InventoryGlAccountKey
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  /** Operational / subledger value (always debit-positive for assets; credit-positive for GR/IR). */
  operationalBalance: string
  /** GL balance in the same sign convention as operationalBalance. */
  glBalance: string
  difference: string
  status: 'MATCHED' | 'DIFFERENCE' | 'UNMAPPED' | 'WARNING'
  reasonCodes: InventoryGlReasonCode[]
  drillDown: {
    failedEventCount: number
    unpostedEventCount: number
    notes: string[]
  }
}

export interface InventoryGlTrialBalanceResult {
  legalEntityId: string
  asOfDate: string
  generatedAt: string
  tolerance: string
  inventoryAccountingEnabled: boolean
  manufacturingAccountingEnabled: boolean
  rows: InventoryGlTrialBalanceRow[]
  totals: {
    matched: number
    differences: number
    unmapped: number
    warnings: number
    absoluteDifference: string
  }
  /** Explicitly absent — FIN-CLOSE-1 hard rule. */
  forceBalanceAllowed: false
  actions: Array<'REFRESH' | 'OPEN_FAILED_EVENTS' | 'OPEN_EVENT' | 'OPEN_VOUCHER' | 'RETRY'>
}

export type FailedAccountingEventSource = 'INVENTORY' | 'MANUFACTURING'

export interface UnifiedFailedAccountingEvent {
  id: string
  source: FailedAccountingEventSource
  eventType: string
  status: string
  legalEntityId: string | null
  productionOrderId: string | null
  sourceDocumentType: string
  sourceDocumentId: string
  amount: string
  failureReason: string | null
  voucherId: string | null
  postingEventId: string | null
  idempotencyKey: string
  createdAt: string
  updatedAt: string | null
  canRetry: boolean
  links: {
    eventPath: string
    sourcePath: string | null
    voucherPath: string | null
  }
}
