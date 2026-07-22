import { describe, expect, it } from 'vitest'
import {
  adjustmentNeedsActionCategory,
  dispatchReadinessSeverity,
  needsActionKey,
  stockCountNeedsActionCategory,
  transferNeedsActionCategory,
  NEEDS_ACTION_DOMAINS,
} from '../src/modules/inventory/store-workbench/store-workbench.mappers.js'

describe('inventory store workbench needs-action mappers', () => {
  it('exposes the stable domain list used by /needs-action/:domain', () => {
    expect(NEEDS_ACTION_DOMAINS).toEqual([
      'manufacturing',
      'purchase',
      'dispatch',
      'transfers',
      'stock-counts',
      'adjustments',
      'reconciliation',
      'exceptions',
    ])
  })

  it('builds stable deterministic row keys and skips empty parts', () => {
    expect(needsActionKey('transfers', 'TRANSFER_RECEIPT_PENDING', 'doc-1')).toBe(
      'TRANSFERS:TRANSFER_RECEIPT_PENDING:doc-1',
    )
    expect(needsActionKey('reconciliation', 'BALANCE_MISMATCH', 'item-1', null, 'wh-1')).toBe(
      'RECONCILIATION:BALANCE_MISMATCH:item-1:wh-1',
    )
    // Same inputs always give the same key — rows are never persisted, clients diff on key.
    expect(needsActionKey('purchase', 'GRN_QC_PENDING', 'grn-9')).toBe(
      needsActionKey('purchase', 'GRN_QC_PENDING', 'grn-9'),
    )
  })

  it('maps transfer statuses to pending store actions', () => {
    expect(transferNeedsActionCategory('SUBMITTED')?.category).toBe('TRANSFER_APPROVAL_PENDING')
    expect(transferNeedsActionCategory('APPROVED')?.category).toBe('TRANSFER_DISPATCH_PENDING')
    expect(transferNeedsActionCategory('IN_TRANSIT')?.category).toBe('TRANSFER_RECEIPT_PENDING')
    expect(transferNeedsActionCategory('PARTIALLY_RECEIVED')?.category).toBe('TRANSFER_RECEIPT_PENDING')
    expect(transferNeedsActionCategory('DRAFT')).toBeNull()
    expect(transferNeedsActionCategory('RECEIVED')).toBeNull()
    expect(transferNeedsActionCategory('CANCELLED')).toBeNull()
    expect(transferNeedsActionCategory('REVERSED')).toBeNull()
  })

  it('maps stock count statuses to entry/approval/posting queues', () => {
    expect(stockCountNeedsActionCategory('SNAPSHOTTED')?.category).toBe('STOCK_COUNT_ENTRY_PENDING')
    expect(stockCountNeedsActionCategory('COUNTING')?.category).toBe('STOCK_COUNT_ENTRY_PENDING')
    expect(stockCountNeedsActionCategory('SUBMITTED')?.category).toBe('STOCK_COUNT_APPROVAL_PENDING')
    expect(stockCountNeedsActionCategory('APPROVED')?.category).toBe('STOCK_COUNT_POSTING_PENDING')
    expect(stockCountNeedsActionCategory('DRAFT')).toBeNull()
    expect(stockCountNeedsActionCategory('POSTED')).toBeNull()
    expect(stockCountNeedsActionCategory('REVERSED')).toBeNull()
  })

  it('maps adjustment statuses to approval/posting queues', () => {
    expect(adjustmentNeedsActionCategory('SUBMITTED')?.category).toBe('ADJUSTMENT_APPROVAL_PENDING')
    expect(adjustmentNeedsActionCategory('APPROVED')?.category).toBe('ADJUSTMENT_POSTING_PENDING')
    expect(adjustmentNeedsActionCategory('DRAFT')).toBeNull()
    expect(adjustmentNeedsActionCategory('POSTED')).toBeNull()
    expect(adjustmentNeedsActionCategory('REVERSED')).toBeNull()
  })

  it('grades dispatch readiness severity and hides done states', () => {
    expect(dispatchReadinessSeverity('BLOCKED')).toBe('CRITICAL')
    expect(dispatchReadinessSeverity('RECONCILIATION_REQUIRED')).toBe('CRITICAL')
    expect(dispatchReadinessSeverity('WAITING_FOR_PRODUCTION')).toBe('WARNING')
    expect(dispatchReadinessSeverity('WAITING_FOR_QUALITY')).toBe('WARNING')
    expect(dispatchReadinessSeverity('WAITING_FOR_STOCK')).toBe('WARNING')
    expect(dispatchReadinessSeverity('ON_HOLD')).toBe('WARNING')
    expect(dispatchReadinessSeverity('NOT_READY')).toBe('WARNING')
    expect(dispatchReadinessSeverity('PARTIALLY_READY')).toBe('INFO')
    expect(dispatchReadinessSeverity('READY_TO_DISPATCH')).toBeNull()
    expect(dispatchReadinessSeverity('FULLY_FULFILLED')).toBeNull()
  })
})
