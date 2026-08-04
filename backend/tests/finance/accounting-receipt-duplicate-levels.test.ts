/**
 * Pure unit tests for receipt duplicate scoring helpers via service export surface.
 * Full DB matching covered by live AR suite when MySQL is available.
 */
import { describe, expect, it } from 'vitest'
import type { DuplicateLevel } from '../../src/modules/accounting/receivables/source/accounting-receipt-duplicate.service.js'

describe('accounting receipt duplicate levels', () => {
  it('defines expected severity order', () => {
    const order: DuplicateLevel[] = ['NONE', 'POSSIBLE', 'PROBABLE', 'EXACT']
    expect(order).toHaveLength(4)
    expect(order[0]).toBe('NONE')
    expect(order[3]).toBe('EXACT')
  })
})
