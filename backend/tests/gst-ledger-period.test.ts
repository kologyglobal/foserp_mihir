import { describe, expect, it } from 'vitest'
import { toReturnPeriod } from '../src/modules/accounting/tax-compliance/gst-ledger.service.js'

describe('toReturnPeriod', () => {
  it('formats UTC date as yyyy-MM', () => {
    expect(toReturnPeriod(new Date('2026-08-15T10:00:00.000Z'))).toBe('2026-08')
  })

  it('accepts date-only string', () => {
    expect(toReturnPeriod('2026-01-05')).toBe('2026-01')
  })
})
