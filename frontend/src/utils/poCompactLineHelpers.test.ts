import { describe, expect, it } from 'vitest'
import {
  duplicatePoEditorLine,
  formatPoDiscountDisplay,
  formatPoLineGstLabel,
  isPoFreeTextLine,
  isPoServiceLine,
  lineHasHsnSnapshot,
  mapPoDiscountFields,
  mapPoLineHsnPersistPayload,
  resolvePoDiscountMode,
  resolvePoMoreDetailsVisibility,
} from './poCompactLineHelpers'

describe('formatPoLineGstLabel', () => {
  it('formats intra-state CGST+SGST scheme label', () => {
    expect(formatPoLineGstLabel({ gstRatePct: 18 }, false)).toBe(
      '18% · CGST 9% + SGST 9%',
    )
  })

  it('formats inter-state IGST scheme label', () => {
    expect(formatPoLineGstLabel({ gstRatePct: 18 }, true)).toBe('18% · IGST 18%')
  })

  it('returns dash when rate is zero', () => {
    expect(formatPoLineGstLabel({ gstRatePct: 0 }, false)).toBe('-')
  })
})

describe('discount modes mapping', () => {
  it('resolves pct when discountPct set', () => {
    expect(resolvePoDiscountMode({ discountPct: 5, discountAmount: 0 })).toBe('pct')
  })

  it('resolves flat when only amount set', () => {
    expect(resolvePoDiscountMode({ discountPct: 0, discountAmount: 100 })).toBe('flat')
  })

  it('maps pct and flat fields cleanly', () => {
    expect(mapPoDiscountFields('pct', 10)).toEqual({ discountPct: 10, discountAmount: 0 })
    expect(mapPoDiscountFields('flat', 250)).toEqual({ discountPct: 0, discountAmount: 250 })
  })

  it('formats display', () => {
    expect(formatPoDiscountDisplay({ discountPct: 5 })).toBe('5%')
    expect(formatPoDiscountDisplay({ discountAmount: 20 })).toBe('20')
    expect(formatPoDiscountDisplay({})).toBe('-')
  })
})

describe('HSN persist payload', () => {
  it('accepts hsnCode only for free-text lines', () => {
    expect(
      mapPoLineHsnPersistPayload({
        itemId: null,
        hsnId: null,
        hsnCode: '998314',
      }),
    ).toEqual({ hsnId: null, hsnCode: '998314' })
  })

  it('prefers sacCode as hsnCode when empty', () => {
    expect(
      mapPoLineHsnPersistPayload({
        hsnId: null,
        hsnCode: '',
        sacCode: '998314',
      }),
    ).toEqual({ hsnId: null, hsnCode: '998314' })
  })

  it('keeps hsnId when present', () => {
    expect(
      mapPoLineHsnPersistPayload({
        hsnId: '00000000-0000-4000-8000-000000000099',
        hsnCode: '7208',
      }),
    ).toEqual({
      hsnId: '00000000-0000-4000-8000-000000000099',
      hsnCode: '7208',
    })
  })

  it('detects free-text manual lines', () => {
    expect(isPoFreeTextLine({ itemId: '', itemName: 'Consulting', lineType: 'SERVICE' })).toBe(
      true,
    )
    expect(isPoFreeTextLine({ itemId: 'abc', itemName: 'Steel' })).toBe(false)
  })

  it('requires HSN snapshot for free-text completeness checks', () => {
    expect(lineHasHsnSnapshot({ hsnCode: '7208' })).toBe(true)
    expect(lineHasHsnSnapshot({ hsnId: 'x' })).toBe(true)
    expect(lineHasHsnSnapshot({})).toBe(false)
  })
})

describe('master vs manual service line', () => {
  it('flags SERVICE lineType', () => {
    expect(isPoServiceLine({ lineType: 'SERVICE' })).toBe(true)
    expect(isPoServiceLine({ lineType: 'GOODS', itemType: 'raw_material' })).toBe(false)
  })

  it('does not treat blank seed with lineType only as free-text', () => {
    expect(isPoFreeTextLine({ itemId: '', lineType: 'GOODS' })).toBe(false)
  })
})

describe('edit / delete / duplicate helpers', () => {
  it('duplicates with new key and line no', () => {
    const src = { key: 'k1', id: 'line-db', lineNo: 2, itemName: 'A' }
    const dup = duplicatePoEditorLine(src, 5, 'k2')
    expect(dup).toEqual({ key: 'k2', id: '', lineNo: 5, itemName: 'A' })
  })
})

describe('more details visibility', () => {
  it('hides PR ref unless linked', () => {
    const none = resolvePoMoreDetailsVisibility({ remarks: 'x' })
    expect(none.showPrRef).toBe(false)
    expect(none.showRemarks).toBe(true)

    const linked = resolvePoMoreDetailsVisibility({
      prLineId: 'pr-1',
      requisitionNo: 'PR-001',
    })
    expect(linked.showPrRef).toBe(true)
  })

  it('shows QC only when relevant', () => {
    expect(resolvePoMoreDetailsVisibility({ qcRequired: true }).showQc).toBe(true)
    expect(resolvePoMoreDetailsVisibility({ qcRequired: false }).showQc).toBe(false)
  })
})
