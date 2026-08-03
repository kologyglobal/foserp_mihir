import { describe, expect, it } from 'vitest'
import { deriveSettlementStatus } from '../../src/modules/accounting/receivables/sales-invoices/sales-invoice-settlement.util.js'

describe('deriveSettlementStatus (O2C Wave 3)', () => {
  it('returns NOT_APPLICABLE for non-posted documents', () => {
    expect(
      deriveSettlementStatus({
        documentStatus: 'DRAFT',
        openAmount: '100',
        allocatedAmount: '0',
      }),
    ).toBe('NOT_APPLICABLE')
  })

  it('returns PAID when open amount is zero', () => {
    expect(
      deriveSettlementStatus({
        documentStatus: 'POSTED',
        openAmount: '0',
        allocatedAmount: '100',
      }),
    ).toBe('PAID')
  })

  it('returns PARTIALLY_PAID when some allocation remains open and not overdue', () => {
    expect(
      deriveSettlementStatus({
        documentStatus: 'POSTED',
        openAmount: '40',
        allocatedAmount: '60',
        dueDate: '2099-01-01',
        asOf: new Date('2026-07-22'),
      }),
    ).toBe('PARTIALLY_PAID')
  })

  it('returns OVERDUE when unpaid and past due', () => {
    expect(
      deriveSettlementStatus({
        documentStatus: 'POSTED',
        openAmount: '100',
        allocatedAmount: '0',
        dueDate: '2020-01-01',
        asOf: new Date('2026-07-22'),
      }),
    ).toBe('OVERDUE')
  })

  it('returns UNPAID when open with future due date', () => {
    expect(
      deriveSettlementStatus({
        documentStatus: 'POSTED',
        openAmount: '100',
        allocatedAmount: '0',
        dueDate: '2099-01-01',
        asOf: new Date('2026-07-22'),
      }),
    ).toBe('UNPAID')
  })
})
