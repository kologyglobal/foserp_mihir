import { describe, expect, it } from 'vitest'
import {
  EMPTY_TAX_SNAPSHOT,
  gstSchemeFromRates,
  taxSnapshotFromGrnOrPoLine,
  taxSnapshotFromPoLine,
  taxSnapshotFromRates,
} from '../../src/modules/purchase/shared/purchase-tax-snapshot.js'
import { copyUpstreamTaxSnapshots } from '../../src/modules/purchase/shared/purchase-upstream-line-enrichment.js'

describe('purchase tax snapshot helpers', () => {
  it('taxSnapshotFromRates combines CGST+SGST', () => {
    const snap = taxSnapshotFromRates({ cgstRate: 9, sgstRate: 9 })
    expect(snap.gstRatePctSnapshot).toBe(18)
    expect(snap.cgstRateSnapshot).toBe(9)
    expect(snap.sgstRateSnapshot).toBe(9)
    expect(snap.gstSchemeSnapshot).toBe('cgst_sgst')
  })

  it('taxSnapshotFromRates uses IGST when interstate', () => {
    const snap = taxSnapshotFromRates({ igstRate: 18 })
    expect(snap.gstRatePctSnapshot).toBe(18)
    expect(snap.igstRateSnapshot).toBe(18)
    expect(gstSchemeFromRates(0, 0, 18)).toBe('igst')
    expect(snap.gstSchemeSnapshot).toBe('igst')
  })

  it('taxSnapshotFromRates zeros unused legs when isInterstate is known', () => {
    const inter = taxSnapshotFromRates({
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 18,
      isInterstate: true,
    })
    expect(inter.gstSchemeSnapshot).toBe('igst')
    expect(inter.igstRateSnapshot).toBe(18)
    expect(inter.cgstRateSnapshot).toBe(0)
    expect(inter.sgstRateSnapshot).toBe(0)

    const intra = taxSnapshotFromRates({
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 18,
      isInterstate: false,
    })
    expect(intra.gstSchemeSnapshot).toBe('cgst_sgst')
    expect(intra.cgstRateSnapshot).toBe(9)
    expect(intra.sgstRateSnapshot).toBe(9)
    expect(intra.igstRateSnapshot).toBe(0)
    expect(intra.gstRatePctSnapshot).toBe(18)
  })

  it('taxSnapshotFromPoLine maps PO FK fields to snapshot columns', () => {
    const snap = taxSnapshotFromPoLine({
      hsnId: 'hsn-1',
      hsnCodeSnapshot: '7306',
      gstGroupId: 'gst-1',
      gstGroupCodeSnapshot: 'GST18',
      gstRatePctSnapshot: 18,
      cgstRateSnapshot: 9,
      sgstRateSnapshot: 9,
      igstRateSnapshot: 0,
      gstSchemeSnapshot: 'cgst_sgst',
    })
    expect(snap.hsnIdSnapshot).toBe('hsn-1')
    expect(snap.hsnCodeSnapshot).toBe('7306')
    expect(snap.gstRatePctSnapshot).toBe(18)
  })

  it('taxSnapshotFromGrnOrPoLine prefers GRN over PO', () => {
    const po = { hsnCodeSnapshot: 'OLD', gstRatePctSnapshot: 12 }
    const grn = { hsnCodeSnapshot: '7306', gstRatePctSnapshot: 18, gstSchemeSnapshot: 'cgst_sgst' }
    const snap = taxSnapshotFromGrnOrPoLine(grn, po)
    expect(snap?.hsnCodeSnapshot).toBe('7306')
    expect(snap?.gstRatePctSnapshot).toBe(18)
  })

  it('taxSnapshotFromGrnOrPoLine falls back to PO when GRN empty', () => {
    const po = {
      hsnId: 'hsn-1',
      hsnCodeSnapshot: '7306',
      gstGroupId: 'gst-1',
      gstGroupCodeSnapshot: 'GST18',
      gstRatePctSnapshot: 18,
      cgstRateSnapshot: 9,
      sgstRateSnapshot: 9,
    }
    const snap = taxSnapshotFromGrnOrPoLine({}, po)
    expect(snap?.hsnCodeSnapshot).toBe('7306')
    expect(snap?.gstRatePctSnapshot).toBe(18)
  })

  it('EMPTY_TAX_SNAPSHOT defaults to zero cgst_sgst', () => {
    expect(EMPTY_TAX_SNAPSHOT.gstRatePctSnapshot).toBe(0)
    expect(EMPTY_TAX_SNAPSHOT.gstSchemeSnapshot).toBe('cgst_sgst')
  })

  it('copyUpstreamTaxSnapshots copies PR line tax onto RFQ line', () => {
    const target: { hsnId?: string | null; hsnCodeSnapshot?: string; gstRatePctSnapshot?: number } =
      {}
    const copied = copyUpstreamTaxSnapshots(target, {
      hsnId: 'hsn-1',
      gstGroupId: 'gst-1',
      hsnCodeSnapshot: '7208',
      gstGroupCodeSnapshot: 'GST18',
      gstRatePctSnapshot: 18,
      cgstRateSnapshot: 9,
      sgstRateSnapshot: 9,
      igstRateSnapshot: 0,
      gstSchemeSnapshot: 'cgst_sgst',
    })
    expect(copied).toBe(true)
    expect(target.hsnCodeSnapshot).toBe('7208')
    expect(target.gstRatePctSnapshot).toBe(18)
  })
})
