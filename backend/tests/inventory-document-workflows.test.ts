import { describe, expect, it } from 'vitest'
import { createAdjustmentSchema } from '../src/modules/inventory/adjustments/adjustment.schemas.js'
import { createStockCountSchema, enterCountsSchema } from '../src/modules/inventory/stock-counts/stock-count.schemas.js'
import { createTransferSchema, receiveTransferSchema } from '../src/modules/inventory/transfers/transfer.schemas.js'

const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

describe('inventory document workflow input controls', () => {
  it('rejects same-warehouse and duplicate-item transfers', () => {
    const result = createTransferSchema.safeParse({
      fromWarehouseId: id(1),
      toWarehouseId: id(1),
      lines: [
        { itemId: id(3), quantity: 1 },
        { itemId: id(3), quantity: 2 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('requires positive partial receipt quantities and an idempotency key', () => {
    expect(receiveTransferSchema.safeParse({
      idempotencyKey: 'receive-0001',
      lines: [{ lineId: id(4), quantity: 0.25 }],
    }).success).toBe(true)
    expect(receiveTransferSchema.safeParse({
      idempotencyKey: 'short',
      lines: [{ lineId: id(4), quantity: 0 }],
    }).success).toBe(false)
  })

  it('allows zero counted stock but rejects negative counted stock', () => {
    expect(enterCountsSchema.safeParse({ lines: [{ lineId: id(5), countedQty: 0 }] }).success).toBe(true)
    expect(enterCountsSchema.safeParse({ lines: [{ lineId: id(5), countedQty: -1 }] }).success).toBe(false)
  })

  it('requires a tenant-scoped warehouse and permits targeted counts', () => {
    expect(createStockCountSchema.safeParse({ warehouseId: id(1), itemIds: [id(3)] }).success).toBe(true)
    expect(createStockCountSchema.safeParse({ warehouseId: 'not-an-id' }).success).toBe(false)
  })

  it('accepts signed non-zero adjustment quantities and rejects duplicates', () => {
    expect(createAdjustmentSchema.safeParse({
      warehouseId: id(1),
      reason: 'Cycle count correction',
      lines: [{ itemId: id(3), quantity: -2 }],
    }).success).toBe(true)
    expect(createAdjustmentSchema.safeParse({
      warehouseId: id(1),
      reason: 'Cycle count correction',
      lines: [
        { itemId: id(3), quantity: 1 },
        { itemId: id(3), quantity: -1 },
      ],
    }).success).toBe(false)
  })
})
