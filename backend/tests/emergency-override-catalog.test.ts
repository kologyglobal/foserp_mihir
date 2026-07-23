/**
 * Emergency override catalog — never vs operational blockers.
 */
import { describe, expect, it } from 'vitest'
import {
  classifyBlockersForEmergencyOverride,
  isNeverOverridableBlocker,
} from '../src/modules/shared/emergency-override/emergency-override.catalog.js'

describe('emergency-override.catalog', () => {
  it('never allows stock / integrity codes', () => {
    expect(isNeverOverridableBlocker('INSUFFICIENT_STOCK')).toBe(true)
    expect(isNeverOverridableBlocker('DISPATCH_EXCEEDS_NET_ORDER')).toBe(true)
    expect(isNeverOverridableBlocker('NOT_DRAFT')).toBe(true)
    expect(isNeverOverridableBlocker('ACCOUNTING_PERIOD_CLOSED')).toBe(true)
  })

  it('allows operational document gates', () => {
    const c = classifyBlockersForEmergencyOverride([
      { code: 'PICK_INCOMPLETE', message: 'Pick pending' },
      { code: 'CHALLAN_NOT_READY', message: 'Challan not issued' },
    ])
    expect(c.canEmergencyOverride).toBe(true)
    expect(c.neverOverridable).toHaveLength(0)
    expect(c.overridable.map((b) => b.code)).toEqual(['PICK_INCOMPLETE', 'CHALLAN_NOT_READY'])
  })

  it('fails closed when a never-overridable code is present', () => {
    const c = classifyBlockersForEmergencyOverride([
      { code: 'PICK_INCOMPLETE' },
      { code: 'INSUFFICIENT_STOCK' },
    ])
    expect(c.canEmergencyOverride).toBe(false)
    expect(c.neverOverridable.map((b) => b.code)).toContain('INSUFFICIENT_STOCK')
  })

  it('fails closed on unknown blocker codes', () => {
    const c = classifyBlockersForEmergencyOverride([{ code: 'SOME_NEW_BLOCKER' }])
    expect(c.canEmergencyOverride).toBe(false)
    expect(c.unknown).toHaveLength(1)
  })
})
