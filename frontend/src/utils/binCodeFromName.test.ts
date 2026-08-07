import { describe, expect, it } from 'vitest'
import { binCodeFromName } from './binCodeFromName'

describe('binCodeFromName', () => {
  it('uppercases and hyphenates from display name', () => {
    expect(binCodeFromName('Main Store A')).toBe('MAIN-STORE-A')
    expect(binCodeFromName('  rack 01 / zone b  ')).toBe('RACK-01-ZONE-B')
  })

  it('truncates to 32 characters', () => {
    expect(binCodeFromName('a'.repeat(40))).toHaveLength(32)
  })
})
