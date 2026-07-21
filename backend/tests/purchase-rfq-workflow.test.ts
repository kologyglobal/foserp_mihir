import { describe, expect, it } from 'vitest'
import {
  RfqNotEditableError,
  RfqNotSendableError,
  RfqPrNotEligibleError,
  RfqVendorsRequiredError,
} from '../src/modules/purchase/rfq/rfq.errors.js'
import {
  assertPrEligibleForRfq,
  assertRfqDraftEditable,
  assertRfqSendable,
} from '../src/modules/purchase/rfq/rfq.workflow.js'

describe('RFQ workflow guards', () => {
  it('allows only approved RFQ-required PRs into the RFQ path', () => {
    expect(() =>
      assertPrEligibleForRfq({ status: 'APPROVED', rfqRequired: true, deletedAt: null }),
    ).not.toThrow()

    expect(() =>
      assertPrEligibleForRfq({ status: 'DRAFT', rfqRequired: true, deletedAt: null }),
    ).toThrow(RfqPrNotEligibleError)

    expect(() =>
      assertPrEligibleForRfq({ status: 'APPROVED', rfqRequired: false, deletedAt: null }),
    ).toThrow(RfqPrNotEligibleError)

    expect(() =>
      assertPrEligibleForRfq({
        status: 'APPROVED',
        rfqRequired: true,
        deletedAt: new Date(),
      }),
    ).toThrow(RfqPrNotEligibleError)
  })

  it('allows edit/send only while RFQ is draft with vendors', () => {
    expect(() => assertRfqDraftEditable('DRAFT')).not.toThrow()
    expect(() => assertRfqDraftEditable('SENT')).toThrow(RfqNotEditableError)

    expect(() => assertRfqSendable('DRAFT', 2)).not.toThrow()
    expect(() => assertRfqSendable('DRAFT', 0)).toThrow(RfqVendorsRequiredError)
    expect(() => assertRfqSendable('SENT', 2)).toThrow(RfqNotSendableError)
  })
})
