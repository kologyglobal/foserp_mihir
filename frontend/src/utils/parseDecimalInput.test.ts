import { describe, expect, it } from 'vitest'
import { parseDecimalInput } from './parseDecimalInput'

describe('parseDecimalInput', () => {
  it('maps empty and partial input to zero', () => {
    expect(parseDecimalInput('')).toBe(0)
    expect(parseDecimalInput('.')).toBe(0)
  })

  it('parses integers and decimals', () => {
    expect(parseDecimalInput('20')).toBe(20)
    expect(parseDecimalInput('02')).toBe(2)
    expect(parseDecimalInput('029')).toBe(29)
    expect(parseDecimalInput('3.5')).toBe(3.5)
  })
})
