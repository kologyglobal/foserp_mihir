import { describe, expect, it } from 'vitest'
import {
  createEmptyOpportunityLine,
  shouldShowTaxUnresolvedWarning,
  syncOpportunityLines,
} from './opportunityLineCalc'

describe('tax unresolved warning (empty draft lines)', () => {
  it('empty create line does not show warning', () => {
    const line = createEmptyOpportunityLine(1)
    expect(line.taxUnresolved).toBe(false)
    expect(shouldShowTaxUnresolvedWarning(line)).toBe(false)
  })

  it('empty line with stale taxUnresolved flag does not show warning', () => {
    const line = createEmptyOpportunityLine(1, { taxUnresolved: true, taxSource: 'UNRESOLVED' })
    // sync strips the flag when no catalog item
    expect(line.taxUnresolved).toBe(false)
    expect(shouldShowTaxUnresolvedWarning(line)).toBe(false)

    const dirty = {
      ...createEmptyOpportunityLine(1),
      taxUnresolved: true as boolean,
      itemId: null,
      productId: null,
    }
    // Helper must still gate on catalog item even if sync was skipped
    expect(shouldShowTaxUnresolvedWarning(dirty)).toBe(false)
  })

  it('selected item with unresolved tax shows warning', () => {
    const line = {
      ...createEmptyOpportunityLine(1),
      itemId: 'item-1',
      taxUnresolved: true as boolean,
    }
    expect(shouldShowTaxUnresolvedWarning(line)).toBe(true)
  })

  it('syncOpportunityLines clears unresolved on blank rows', () => {
    const synced = syncOpportunityLines([
      {
        ...createEmptyOpportunityLine(1),
        taxUnresolved: true,
        itemId: null,
        productId: null,
      },
    ])
    expect(synced[0]!.taxUnresolved).toBe(false)
    expect(shouldShowTaxUnresolvedWarning(synced[0]!)).toBe(false)
  })
})
