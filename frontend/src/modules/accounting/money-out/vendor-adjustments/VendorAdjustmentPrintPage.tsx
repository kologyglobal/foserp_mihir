import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { getVendorAdjustment } from '@/services/bridges/payablesApiBridge'
import type { VendorAdjustmentDto } from '@/types/moneyOut'
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '@/types/invoice'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import {
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_TYPE_LABELS,
  MONEY_OUT_STATUS_LABELS,
  parseDecimal,
} from '../moneyOutUi'
import { notify } from '@/store/toastStore'

function displayNo(adj: VendorAdjustmentDto): string {
  return adj.vendorAdjustmentNumber ?? adj.draftReference ?? adj.id.slice(0, 8)
}

export function VendorAdjustmentPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [adj, setAdj] = useState<VendorAdjustmentDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const row = await getVendorAdjustment(id)
        if (!cancelled) setAdj(row)
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Document not found')
        navigate('/accounting/money-out/vendor-adjustments')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (loading || !adj) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading document…</div>
  }

  const isDebit = adj.adjustmentType === 'VENDOR_DEBIT_NOTE'
  const docTitle = isDebit ? 'DEBIT NOTE' : 'VENDOR CREDIT ADJUSTMENT'
  const docNo = displayNo(adj)

  return (
    <DocumentPrintShell
      title={docNo}
      subtitle={`${isDebit ? 'Debit note' : 'Vendor adjustment'} — print-ready / Save as PDF`}
      backLabel="Back to document"
      onBack={() => navigate(`/accounting/money-out/vendor-adjustments/${adj.id}`)}
    >
      <article className="po-print-doc">
        <header className="po-print-header">
          <div>
            <h1 className="po-print-header__company">{COMPANY_NAME}</h1>
            <p className="po-print-header__address">{COMPANY_ADDRESS}</p>
            <p className="po-print-header__gst">
              GSTIN: {COMPANY_GSTIN} · PAN: {COMPANY_PAN} · {COMPANY_STATE}
            </p>
          </div>
          <div className="po-print-header__meta">
            <p className="po-print-title">{docTitle}</p>
            <p>
              <strong>{docNo}</strong>
            </p>
            <p>Date: {formatDate(adj.documentDate)}</p>
            <p>Status: {MONEY_OUT_STATUS_LABELS[adj.status] ?? adj.status}</p>
            <p>Type: {ADJUSTMENT_TYPE_LABELS[adj.adjustmentType]}</p>
          </div>
        </header>

        <div className="po-print-grid">
          <section className="po-print-box">
            <p className="po-print-box__label">Vendor</p>
            <p className="po-print-box__name">{adj.vendorNameSnapshot}</p>
            <p>Code: {adj.vendorCodeSnapshot}</p>
            <p>GSTIN: {adj.vendorGstinSnapshot ?? '—'}</p>
          </section>
          <section className="po-print-box">
            <p className="po-print-box__label">References</p>
            <p>Supplier ref: {adj.supplierReferenceNumber || '—'}</p>
            <p>
              Supplier date:{' '}
              {adj.supplierReferenceDate ? formatDate(adj.supplierReferenceDate) : '—'}
            </p>
            <p>Reason: {ADJUSTMENT_REASON_LABELS[adj.reason] ?? adj.reason}</p>
            <p>Currency: {adj.currencyCode}</p>
          </section>
        </div>

        <table className="po-print-lines">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Taxable</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {adj.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.lineNumber}</td>
                <td>{l.description}</td>
                <td>{l.hsnSacCode ?? '—'}</td>
                <td>
                  {l.quantity} {l.uomCodeSnapshot ?? ''}
                </td>
                <td>{formatCurrency(parseDecimal(l.unitPrice))}</td>
                <td>{formatCurrency(parseDecimal(l.taxableAmount))}</td>
                <td>{formatCurrency(parseDecimal(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="po-print-totals">
          <p>Taxable: {formatCurrency(parseDecimal(adj.taxableAmount))}</p>
          <p>
            CGST: {formatCurrency(parseDecimal(adj.inputCgstAmount))} · SGST:{' '}
            {formatCurrency(parseDecimal(adj.inputSgstAmount))} · IGST:{' '}
            {formatCurrency(parseDecimal(adj.inputIgstAmount))}
          </p>
          <p className="po-print-totals__grand">
            Grand Total: {formatCurrency(parseDecimal(adj.adjustmentGrandTotal))}
          </p>
        </div>
      </article>
    </DocumentPrintShell>
  )
}
