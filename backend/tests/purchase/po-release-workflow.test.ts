import { describe, expect, it } from 'vitest'
import {
  allowedActions,
  resolvePoReceivableStatuses,
} from '../../src/modules/purchase/orders/purchase-order.workflow.js'

const basePo = {
  id: 'po-1',
  deletedAt: null,
  status: 'DRAFT' as const,
  orderDate: new Date('2026-08-04'),
  lines: [{ receivedQuantity: 0 }],
}

describe('PO release workflow policy', () => {
  it('requires release by default — draft PO not receivable', () => {
    expect(resolvePoReceivableStatuses(true)).toEqual(['SENT_TO_VENDOR', 'PARTIALLY_RECEIVED'])
    expect(allowedActions(basePo as never, { requirePoReleaseWorkflow: true }).canReceive).toBe(false)
  })

  it('allows GRN against draft when release workflow is off', () => {
    expect(resolvePoReceivableStatuses(false)).toContain('DRAFT')
    expect(allowedActions(basePo as never, { requirePoReleaseWorkflow: false }).canReceive).toBe(true)
    expect(
      allowedActions(basePo as never, { requirePoReleaseWorkflow: false }).canSendToVendor,
    ).toBe(false)
  })
})
