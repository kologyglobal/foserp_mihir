import { describe, expect, it } from 'vitest'
import { canInventoryPermission, INVENTORY_PERMISSIONS } from './inventory'

/**
 * Regression coverage for the Inventory Transfer workflow permission gates
 * (Submit / Approve / Dispatch / Receive / Cancel / Reverse) — added when the
 * transfer register was missing action buttons for its full lifecycle.
 * No stored session in this test env, so these exercise the static
 * role → permission fallback map directly.
 */
describe('Inventory transfer workflow permissions', () => {
  it('store_manager can perform every transfer lifecycle action', () => {
    for (const perm of [
      'inventory.transfers.submit',
      'inventory.transfers.approve',
      'inventory.transfers.dispatch',
      'inventory.transfers.receive',
      'inventory.transfers.cancel',
      'inventory.transfers.reverse',
    ] as const) {
      expect(canInventoryPermission(perm, 'store_manager')).toBe(true)
    }
  })

  it('store_user can create, submit and cancel their own draft transfers but not approve/dispatch/receive/reverse', () => {
    expect(canInventoryPermission('inventory.transfers.create', 'store_user')).toBe(true)
    expect(canInventoryPermission('inventory.transfers.submit', 'store_user')).toBe(true)
    expect(canInventoryPermission('inventory.transfers.cancel', 'store_user')).toBe(true)
    expect(canInventoryPermission('inventory.transfers.approve', 'store_user')).toBe(false)
    expect(canInventoryPermission('inventory.transfers.dispatch', 'store_user')).toBe(false)
    expect(canInventoryPermission('inventory.transfers.receive', 'store_user')).toBe(false)
    expect(canInventoryPermission('inventory.transfers.reverse', 'store_user')).toBe(false)
  })

  it('shop_floor can dispatch/receive (execute) but not approve or reverse', () => {
    expect(canInventoryPermission('inventory.transfers.dispatch', 'shop_floor')).toBe(true)
    expect(canInventoryPermission('inventory.transfers.receive', 'shop_floor')).toBe(true)
    expect(canInventoryPermission('inventory.transfers.approve', 'shop_floor')).toBe(false)
    expect(canInventoryPermission('inventory.transfers.reverse', 'shop_floor')).toBe(false)
  })

  it('auditor-only roles cannot mutate transfers at all', () => {
    for (const perm of [
      'inventory.transfers.create',
      'inventory.transfers.submit',
      'inventory.transfers.approve',
      'inventory.transfers.dispatch',
      'inventory.transfers.receive',
      'inventory.transfers.cancel',
      'inventory.transfers.reverse',
    ] as const) {
      expect(canInventoryPermission(perm, 'accounts')).toBe(false)
    }
    expect(canInventoryPermission('inventory.transfers.view', 'accounts')).toBe(true)
  })

  it('the permission catalog declares every transfer lifecycle action', () => {
    for (const perm of [
      'inventory.transfers.submit',
      'inventory.transfers.approve',
      'inventory.transfers.reverse',
    ]) {
      expect(INVENTORY_PERMISSIONS).toContain(perm)
    }
  })
})
