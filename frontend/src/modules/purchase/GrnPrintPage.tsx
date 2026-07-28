import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { PurchaseDocumentLetterhead } from '@/components/purchase/PurchaseDocumentLetterhead'
import { getGRNById } from '@/services/purchase'
import type { GoodsReceiptNote } from '@/types/purchaseDomain'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { formatStatus } from '@/components/ui/Badge'
import { notify } from '@/store/toastStore'
import { handlePurchasePdfDownload } from '@/utils/purchaseDocumentPdfExport'
import { QUOTATION_COMPANY } from '@/utils/quotationEngine/companyProfile'

export function GrnPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [grn, setGrn] = useState<GoodsReceiptNote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const row = await getGRNById(id)
      if (cancelled) return
      if (!row) {
        notify.error('GRN not found')
        navigate('/purchase/grn')
        return
      }
      setGrn(row)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  useEffect(() => {
    if (!grn) return
    if (searchParams.get('download') !== '1' && searchParams.get('autodownload') !== '1') return
    const timer = window.setTimeout(() => {
      void handlePurchasePdfDownload(`${grn.documentNumber}.pdf`)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [grn, searchParams])

  if (loading || !grn) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading GRN…</div>
  }

  const showVendorUom = grn.lines.some(
    (l) => Number(l.uomConversionFactor ?? 1) > 1 && Number(l.receivedUomQty ?? 0) > 0,
  )

  return (
    <DocumentPrintShell
      title={grn.documentNumber}
      subtitle="Goods receipt note — Vasant Fabricators letterhead"
      backLabel="Back to GRN"
      backTo={`/purchase/grn/${grn.id}`}
      pdfFileName={`${grn.documentNumber}.pdf`}
    >
      <article className="po-print-doc">
        <PurchaseDocumentLetterhead
          docType="Goods Receipt Note"
          docNumber={grn.documentNumber}
          meta={[
            { label: 'Date', value: formatDate(grn.documentDate) },
            { label: 'Status', value: formatStatus(grn.status) },
            { label: 'PO', value: grn.purchaseOrderNumber || '—' },
          ]}
        />

        <div className="po-print-grid">
          <section className="po-print-box">
            <p className="po-print-box__label">Vendor</p>
            <p className="po-print-box__name">{grn.vendor.name}</p>
            <p>GSTIN: {grn.vendor.gstin || '—'}</p>
            <p>Received by: {grn.receivedBy?.name || '—'}</p>
            <p>Warehouse: {grn.warehouseName || '—'}</p>
            <p>Location: {grn.receivingLocation || grn.location?.name || '—'}</p>
          </section>
          <section className="po-print-box">
            <p className="po-print-box__label">Receipt details</p>
            <p>Challan: {grn.vendorChallanNumber || '—'}</p>
            <p>
              Challan date:{' '}
              {grn.vendorChallanDate ? formatDate(grn.vendorChallanDate) : '—'}
            </p>
            <p>Vehicle: {grn.vehicleNo || '—'}</p>
            <p>Transporter: {grn.transporterName || '—'}</p>
            <p>LR / Gate: {grn.lrNumber || grn.gateEntryNo || '—'}</p>
            <p>QC required: {grn.inspectionRequired || grn.qcRequired ? 'Yes' : 'No'}</p>
          </section>
        </div>

        <table className="po-print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>HSN</th>
              <th className="num">Ordered</th>
              {showVendorUom ? <th className="num">Vendor qty</th> : null}
              <th className="num">Received</th>
              <th className="num">Accepted</th>
              <th className="num">Rejected</th>
              <th>UOM</th>
              <th className="num">Rate</th>
              <th>Batch / Lot</th>
            </tr>
          </thead>
          <tbody>
            {grn.lines.map((l) => (
              <tr key={l.id}>
                <td className="num">{l.lineNo}</td>
                <td>
                  <span className="mono">{l.itemCode}</span>
                  <span className="block">{l.itemName}</span>
                </td>
                <td>{l.hsnCode || '—'}</td>
                <td className="num">{formatNumber(l.orderedQty)}</td>
                {showVendorUom ? (
                  <td className="num">{formatNumber(l.receivedUomQty ?? l.receivedQty)}</td>
                ) : null}
                <td className="num">{formatNumber(l.receivedQty)}</td>
                <td className="num">{formatNumber(l.acceptedQty)}</td>
                <td className="num">{formatNumber(l.rejectedQty)}</td>
                <td>{l.uom}</td>
                <td className="num">{formatCurrency(l.rate)}</td>
                <td>
                  {l.batchNumber || l.lotNumber || '—'}
                  {l.serialNumber ? ` / ${l.serialNumber}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="po-print-summary">
          <div className="po-print-summary__row">
            <span>Taxable</span>
            <span>{formatCurrency(grn.taxableAmount)}</span>
          </div>
          <div className="po-print-summary__row">
            <span>CGST / SGST / IGST</span>
            <span>
              {formatCurrency(grn.cgst)} / {formatCurrency(grn.sgst)} / {formatCurrency(grn.igst)}
            </span>
          </div>
          <div className="po-print-summary__row po-print-summary__row--total">
            <span>Grand Total</span>
            <span>{formatCurrency(grn.totalAmount)}</span>
          </div>
        </div>

        {grn.remarks ? (
          <div className="po-print-terms">
            <p className="po-print-terms__title">Remarks</p>
            <p className="whitespace-pre-wrap text-[12px]">{grn.remarks}</p>
          </div>
        ) : null}

        <div className="po-print-signatures">
          <div className="po-print-signatures__line">Received by ({grn.receivedBy?.name || '—'})</div>
          <div className="po-print-signatures__line">Stores / Warehouse</div>
          <div className="po-print-signatures__line">For {QUOTATION_COMPANY.legalName}</div>
        </div>
      </article>
    </DocumentPrintShell>
  )
}
