import { describe, expect, it } from 'vitest'
import { resolveBinSelection, resolveItemDefaultBin } from './itemDefaultBin'

const bins = [
  { id: 'uuid-1', code: 'A1-01' },
  { id: 'uuid-2', code: 'FG-01' },
]

describe('resolveItemDefaultBin / resolveBinSelection', () => {
  it('resolves default by id', () => {
    expect(resolveItemDefaultBin({ defaultBinId: 'uuid-1', defaultBinCode: 'A1-01' }, bins)).toEqual({
      binId: 'uuid-1',
      binCode: 'A1-01',
    })
  })

  it('resolves when code was stored in defaultBinId', () => {
    expect(resolveItemDefaultBin({ defaultBinId: 'FG-01', defaultBinCode: null }, bins)).toEqual({
      binId: 'uuid-2',
      binCode: 'FG-01',
    })
  })

  it('keeps code-only until catalog matches', () => {
    expect(resolveItemDefaultBin({ defaultBinId: null, defaultBinCode: 'X-99' }, bins)).toEqual({
      binId: null,
      binCode: 'X-99',
    })
  })

  it('resolveBinSelection matches by code', () => {
    expect(resolveBinSelection(null, 'A1-01', bins)).toEqual({
      binId: 'uuid-1',
      binCode: 'A1-01',
    })
  })
})
