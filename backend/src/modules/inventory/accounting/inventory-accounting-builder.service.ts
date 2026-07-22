import type {
  DefaultAccountMappingKey,
  InventoryAccountingEventType,
  InventoryReferenceType,
} from '@prisma/client'
import { ValidationError } from '../../../utils/errors.js'
import { formatForPersistence } from '../../accounting/shared/finance-decimal.js'
import type { PostingRequest } from '../../accounting/posting/posting.types.js'

type MappingPair = { debit: DefaultAccountMappingKey; credit: DefaultAccountMappingKey }

/**
 * GL pairs per inventory event (ADR-039: finance default-account mappings only).
 * PURCHASE acts as the GR/IR-style counterpart for GRN quantity events until a
 * dedicated clearing mapping exists.
 */
const EVENT_MAPPINGS: Record<InventoryAccountingEventType, MappingPair> = {
  GRN_INWARD: { debit: 'RAW_MATERIAL_INVENTORY', credit: 'PURCHASE' },
  GRN_REVERSAL: { debit: 'PURCHASE', credit: 'RAW_MATERIAL_INVENTORY' },
  PURCHASE_RETURN: { debit: 'PURCHASE_RETURN', credit: 'RAW_MATERIAL_INVENTORY' },
  STOCK_ADJUSTMENT: { debit: 'RAW_MATERIAL_INVENTORY', credit: 'STOCK_ADJUSTMENT' },
  STOCK_ADJUSTMENT_REVERSAL: { debit: 'STOCK_ADJUSTMENT', credit: 'RAW_MATERIAL_INVENTORY' },
  STOCK_COUNT_ADJUSTMENT: { debit: 'RAW_MATERIAL_INVENTORY', credit: 'STOCK_ADJUSTMENT' },
  STOCK_COUNT_REVERSAL: { debit: 'STOCK_ADJUSTMENT', credit: 'RAW_MATERIAL_INVENTORY' },
  FG_DISPATCH: { debit: 'COST_OF_GOODS_SOLD', credit: 'FINISHED_GOODS_INVENTORY' },
  FG_DISPATCH_REVERSAL: { debit: 'FINISHED_GOODS_INVENTORY', credit: 'COST_OF_GOODS_SOLD' },
}

/** Adjustment-style events debit inventory for gains and flip for losses (signed quantity). */
const SIGN_FLIPPED_EVENTS: ReadonlySet<InventoryAccountingEventType> = new Set([
  'STOCK_ADJUSTMENT',
  'STOCK_ADJUSTMENT_REVERSAL',
  'STOCK_COUNT_ADJUSTMENT',
  'STOCK_COUNT_REVERSAL',
])

export function isPostableInventoryEvent(eventType: InventoryAccountingEventType): boolean {
  return eventType in EVENT_MAPPINGS
}

/**
 * Movement reference types owned by MANUFACTURING_ACCOUNTING (issue/return to WO,
 * WIP, FG receipt, subcontracting…). Inventory accounting must never post these —
 * doing so would double-post against production accounting events.
 */
const MANUFACTURING_OWNED_REFERENCE_TYPES: ReadonlySet<InventoryReferenceType> = new Set([
  'ISSUE_TO_WO',
  'RETURN_FROM_WO',
  'WIP_RECEIVE',
  'WIP_TRANSFER',
  'MOVE_TO_WIP',
  'MOVE_FROM_WIP',
  'SA_RECEIPT',
  'FG_RECEIPT',
  'SUBCON_OUT',
  'SUBCON_IN',
] satisfies InventoryReferenceType[])

export function isManufacturingOwnedReferenceType(
  referenceType: InventoryReferenceType,
): boolean {
  return MANUFACTURING_OWNED_REFERENCE_TYPES.has(referenceType)
}

/**
 * Derive the inventory accounting event type for a posted stock movement.
 * Returns null when the movement is not inventory-accounting relevant
 * (including all manufacturing-owned reference types).
 */
export function deriveInventoryAccountingEventType(
  referenceType: InventoryReferenceType,
  signedQuantity: number,
): InventoryAccountingEventType | null {
  if (isManufacturingOwnedReferenceType(referenceType)) return null
  switch (referenceType) {
    case 'GRN':
      return signedQuantity >= 0 ? 'GRN_INWARD' : 'GRN_REVERSAL'
    case 'CONTROLLED_ADJUSTMENT':
      return 'STOCK_ADJUSTMENT'
    case 'ADJUSTMENT_REVERSAL':
      return 'STOCK_ADJUSTMENT_REVERSAL'
    case 'STOCK_COUNT':
      return 'STOCK_COUNT_ADJUSTMENT'
    case 'STOCK_COUNT_REVERSAL':
      return 'STOCK_COUNT_REVERSAL'
    case 'FG_DISPATCH':
      return signedQuantity < 0 ? 'FG_DISPATCH' : 'FG_DISPATCH_REVERSAL'
    default:
      return null
  }
}

export function buildInventoryPostingRequest(args: {
  eventType: InventoryAccountingEventType
  legalEntityId: string
  eventId: string
  idempotencyKey: string
  sourceDocumentType: string
  sourceDocumentId: string
  amount: string
  documentDate: string
  postingDate: string
  narration?: string | null
  payloadJson?: unknown
}): PostingRequest {
  const payload = args.payloadJson && typeof args.payloadJson === 'object'
    ? args.payloadJson as Record<string, unknown>
    : {}
  let pair = EVENT_MAPPINGS[args.eventType]
  if (!pair) {
    throw new ValidationError(`Event type ${args.eventType} is not MappingReady for GL posting`)
  }

  const signedQuantity = Number(payload.signedQuantity ?? 0)
  if (SIGN_FLIPPED_EVENTS.has(args.eventType) && signedQuantity < 0) {
    pair = { debit: pair.credit, credit: pair.debit }
  }
  const amount = formatForPersistence(Math.abs(Number(args.amount)).toString(), 4)
  return {
    legalEntityId: args.legalEntityId,
    eventKey: args.idempotencyKey,
    eventType: `INV_${args.eventType}`,
    postingPurpose: 'SYSTEM_DOCUMENT',
    voucherType: 'SYSTEM',
    documentDate: args.documentDate,
    postingDate: args.postingDate,
    narration: args.narration ?? `Inventory ${args.eventType}`,
    sourceModule: 'INVENTORY',
    sourceDocumentType: args.sourceDocumentType,
    sourceDocumentId: args.sourceDocumentId,
    lines: [
      {
        lineNumber: 1,
        accountMappingKey: pair.debit,
        debitAmount: amount,
        creditAmount: '0',
        referenceDocumentType: args.sourceDocumentType,
        referenceDocumentId: args.sourceDocumentId,
        lineNarration: `${args.eventType} debit`,
      },
      {
        lineNumber: 2,
        accountMappingKey: pair.credit,
        debitAmount: '0',
        creditAmount: amount,
        referenceDocumentType: args.sourceDocumentType,
        referenceDocumentId: args.sourceDocumentId,
        lineNarration: `${args.eventType} credit`,
      },
    ],
  }
}
