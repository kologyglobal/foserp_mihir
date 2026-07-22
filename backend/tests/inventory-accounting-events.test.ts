import { describe, expect, it } from 'vitest'
import {
  buildInventoryPostingRequest,
  deriveInventoryAccountingEventType,
  isManufacturingOwnedReferenceType,
  isPostableInventoryEvent,
} from '../src/modules/inventory/accounting/inventory-accounting-builder.service.js'
import { listInventoryAccountingEventsQuerySchema } from '../src/modules/inventory/accounting/inventory-accounting.schemas.js'

const baseArgs = {
  legalEntityId: '00000000-0000-4000-8000-000000000001',
  eventId: '00000000-0000-4000-8000-000000000002',
  idempotencyKey: 'INV_ACCT:m1:V1',
  sourceDocumentType: 'GOODS_RECEIPT',
  sourceDocumentId: '00000000-0000-4000-8000-000000000003',
  amount: '150.0000',
  documentDate: '2026-07-22',
  postingDate: '2026-07-22',
} as const

describe('inventory accounting event derivation', () => {
  it('derives GRN inward vs reversal from movement sign', () => {
    expect(deriveInventoryAccountingEventType('GRN', 10)).toBe('GRN_INWARD')
    expect(deriveInventoryAccountingEventType('GRN', -10)).toBe('GRN_REVERSAL')
  })

  it('derives controlled and stock-count adjustment events', () => {
    expect(deriveInventoryAccountingEventType('CONTROLLED_ADJUSTMENT', 5)).toBe('STOCK_ADJUSTMENT')
    expect(deriveInventoryAccountingEventType('CONTROLLED_ADJUSTMENT', -5)).toBe('STOCK_ADJUSTMENT')
    expect(deriveInventoryAccountingEventType('ADJUSTMENT_REVERSAL', -5)).toBe('STOCK_ADJUSTMENT_REVERSAL')
    expect(deriveInventoryAccountingEventType('STOCK_COUNT', 3)).toBe('STOCK_COUNT_ADJUSTMENT')
    expect(deriveInventoryAccountingEventType('STOCK_COUNT_REVERSAL', -3)).toBe('STOCK_COUNT_REVERSAL')
  })

  it('derives FG dispatch issue vs reversal from movement sign', () => {
    expect(deriveInventoryAccountingEventType('FG_DISPATCH', -2)).toBe('FG_DISPATCH')
    expect(deriveInventoryAccountingEventType('FG_DISPATCH', 2)).toBe('FG_DISPATCH_REVERSAL')
  })

  it('never derives events for manufacturing-owned movement types (no double posting)', () => {
    for (const referenceType of [
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
    ] as const) {
      expect(isManufacturingOwnedReferenceType(referenceType)).toBe(true)
      expect(deriveInventoryAccountingEventType(referenceType, 1)).toBeNull()
      expect(deriveInventoryAccountingEventType(referenceType, -1)).toBeNull()
    }
  })

  it('ignores plain opening/inward/issue/quality movements', () => {
    expect(deriveInventoryAccountingEventType('OPN', 1)).toBeNull()
    expect(deriveInventoryAccountingEventType('INW', 1)).toBeNull()
    expect(deriveInventoryAccountingEventType('ISS', -1)).toBeNull()
    expect(deriveInventoryAccountingEventType('QUALITY_RELEASE', 1)).toBeNull()
    expect(deriveInventoryAccountingEventType('TRANSFER_DISPATCH', -1)).toBeNull()
  })
})

describe('inventory accounting posting request builder', () => {
  it('marks every inventory event type MappingReady', () => {
    for (const eventType of [
      'GRN_INWARD',
      'GRN_REVERSAL',
      'PURCHASE_RETURN',
      'STOCK_ADJUSTMENT',
      'STOCK_ADJUSTMENT_REVERSAL',
      'STOCK_COUNT_ADJUSTMENT',
      'STOCK_COUNT_REVERSAL',
      'FG_DISPATCH',
      'FG_DISPATCH_REVERSAL',
    ] as const) {
      expect(isPostableInventoryEvent(eventType)).toBe(true)
    }
  })

  it('builds a balanced GRN inward voucher (Dr inventory / Cr purchase)', () => {
    const request = buildInventoryPostingRequest({ ...baseArgs, eventType: 'GRN_INWARD' })
    expect(request.eventType).toBe('INV_GRN_INWARD')
    expect(request.sourceModule).toBe('INVENTORY')
    expect(request.voucherType).toBe('SYSTEM')
    expect(request.lines).toHaveLength(2)
    expect(request.lines[0]).toMatchObject({
      accountMappingKey: 'RAW_MATERIAL_INVENTORY',
      debitAmount: '150.0000',
      creditAmount: '0',
    })
    expect(request.lines[1]).toMatchObject({
      accountMappingKey: 'PURCHASE',
      debitAmount: '0',
      creditAmount: '150.0000',
    })
  })

  it('debits COGS and credits FG inventory on dispatch', () => {
    const request = buildInventoryPostingRequest({ ...baseArgs, eventType: 'FG_DISPATCH' })
    expect(request.lines[0].accountMappingKey).toBe('COST_OF_GOODS_SOLD')
    expect(request.lines[1].accountMappingKey).toBe('FINISHED_GOODS_INVENTORY')
  })

  it('flips adjustment direction for losses via signed quantity payload', () => {
    const gain = buildInventoryPostingRequest({
      ...baseArgs,
      eventType: 'STOCK_ADJUSTMENT',
      payloadJson: { signedQuantity: 4 },
    })
    expect(gain.lines[0].accountMappingKey).toBe('RAW_MATERIAL_INVENTORY')
    expect(gain.lines[1].accountMappingKey).toBe('STOCK_ADJUSTMENT')

    const loss = buildInventoryPostingRequest({
      ...baseArgs,
      eventType: 'STOCK_ADJUSTMENT',
      payloadJson: { signedQuantity: -4 },
    })
    expect(loss.lines[0].accountMappingKey).toBe('STOCK_ADJUSTMENT')
    expect(loss.lines[1].accountMappingKey).toBe('RAW_MATERIAL_INVENTORY')
  })

  it('uses the idempotency key as the posting event key and absolute amounts', () => {
    const request = buildInventoryPostingRequest({
      ...baseArgs,
      eventType: 'PURCHASE_RETURN',
      amount: '-99.5',
    })
    expect(request.eventKey).toBe(baseArgs.idempotencyKey)
    expect(request.lines[0].debitAmount).toBe('99.5000')
    expect(request.lines[1].creditAmount).toBe('99.5000')
  })
})

describe('inventory accounting API schemas', () => {
  it('accepts valid list filters and rejects unknown enum values', () => {
    expect(
      listInventoryAccountingEventsQuerySchema.safeParse({
        eventType: 'GRN_INWARD',
        status: 'SKIPPED_FLAG_OFF',
      }).success,
    ).toBe(true)
    expect(
      listInventoryAccountingEventsQuerySchema.safeParse({ eventType: 'MATERIAL_ISSUED' }).success,
    ).toBe(false)
    expect(
      listInventoryAccountingEventsQuerySchema.safeParse({ status: 'NOT_A_STATUS' }).success,
    ).toBe(false)
  })
})
