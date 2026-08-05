/**
 * Phase 1 GST scheme application — pure unit tests (no DB).
 */
import { describe, expect, it } from 'vitest'
import { applySchemeToMasterRate } from '../src/modules/tax/gst-tax-resolve.service.js'

describe('applySchemeToMasterRate', () => {
  it('intra-state uses CGST+SGST and zeros IGST', () => {
    const r = applySchemeToMasterRate(
      { cgstRate: '9', sgstRate: '9', igstRate: '18', gstRate: '18' },
      { isInterstate: false },
    )
    expect(r.taxScheme).toBe('cgst_sgst')
    expect(r.cgstRate).toBe(9)
    expect(r.sgstRate).toBe(9)
    expect(r.igstRate).toBe(0)
    expect(r.gstRate).toBe(18)
  })

  it('inter-state uses IGST and zeros CGST/SGST', () => {
    const r = applySchemeToMasterRate(
      { cgstRate: '9', sgstRate: '9', igstRate: '18', gstRate: '18' },
      { isInterstate: true },
    )
    expect(r.taxScheme).toBe('igst')
    expect(r.cgstRate).toBe(0)
    expect(r.sgstRate).toBe(0)
    expect(r.igstRate).toBe(18)
    expect(r.gstRate).toBe(18)
  })

  it('uses combined CGST+SGST when IGST master is zero (inter)', () => {
    const r = applySchemeToMasterRate(
      { cgstRate: '6', sgstRate: '6', igstRate: '0', gstRate: '12' },
      { isInterstate: true },
    )
    expect(r.taxScheme).toBe('igst')
    expect(r.igstRate).toBe(12)
    expect(r.gstRate).toBe(12)
  })

  it('supports 12% and 5% master components without inventing 18', () => {
    const r12 = applySchemeToMasterRate(
      { cgstRate: '6', sgstRate: '6', igstRate: '12', gstRate: '12' },
      { isInterstate: false },
    )
    expect(r12.gstRate).toBe(12)
    const r5 = applySchemeToMasterRate(
      { cgstRate: '2.5', sgstRate: '2.5', igstRate: '5', gstRate: '5' },
      { isInterstate: true },
    )
    expect(r5.gstRate).toBe(5)
    expect(r5.igstRate).toBe(5)
  })
})
