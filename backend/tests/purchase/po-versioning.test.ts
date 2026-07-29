import { describe, expect, it } from 'vitest'
import {
  PO_REVISABLE_STATUSES,
  assertRevisable,
} from '../../src/modules/purchase/orders/purchase-order.workflow.js'
import { PurchaseOrderWorkflowError } from '../../src/modules/purchase/orders/purchase-order.errors.js'

describe('PO versioning — revisable statuses', () => {
  it('allows released / received / invoiced statuses', () => {
    for (const status of PO_REVISABLE_STATUSES) {
      expect(() => assertRevisable({ status, deletedAt: null })).not.toThrow()
    }
  })

  it('blocks draft and pending', () => {
    expect(() => assertRevisable({ status: 'DRAFT', deletedAt: null })).toThrow(
      PurchaseOrderWorkflowError,
    )
    expect(() => assertRevisable({ status: 'PENDING_APPROVAL', deletedAt: null })).toThrow(
      PurchaseOrderWorkflowError,
    )
  })

  it('blocks cancelled / closed', () => {
    expect(() => assertRevisable({ status: 'CANCELLED', deletedAt: null })).toThrow(
      PurchaseOrderWorkflowError,
    )
    expect(() => assertRevisable({ status: 'CLOSED', deletedAt: null })).toThrow(
      PurchaseOrderWorkflowError,
    )
  })
})
