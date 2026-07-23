import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { getPurchaseInvoiceById } from '@/services/purchase'
import type { PurchaseInvoice } from '@/types/purchaseDomain'
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '@/types/invoice'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { formatStatus } from '@/components/ui/Badge'
import { notify } from '@/store/toastStore'

export function PurchaseInvoicePrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [inv, setInv] = useState<PurchaseInvoice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const row = await getPurchaseInvoiceById(id)
      if (cancelled) return
      if (!row) {
        notify.error('Purchase invoice not found')
        navigate('/purchase/invoices')
        return
      }
      setInv(row)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (loading || !inv) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading purchase invoice…</div>
  }

  return (
    <DocumentPrintShell
      title={inv.documentNumber}
      subtitle="Purchase invoice — print-ready / Save as PDF"
      backLabel="Back to invoice"
      onBack={() => navigate(`/purchase/invoices/${inv.id}`)}
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
            <p className="po-print-title">PURCHASE INVOICE</p>
            <p>
              <strong>{inv.documentNumber}</strong>
            </p>
            <p>Date: {formatDate(inv.documentDate)}</p>
            <p>Vendor inv: {inv.vendorInvoiceNumber}</p>
            <p>Status: {formatStatus(inv.status)}</p>
          </div>
        </header>

        <div className="po-print-grid">
          <section className="po-print-box">
            <p className="po-print-box__label">Vendor</p>
            <p className="po-print-box__name">{inv.vendor.name}</p>
            <p>GSTIN: {inv.vendor.gstin}</p>
            <p>State: {inv.vendor.state}</p>
            <p>Payment: {inv.paymentTerms}</p>
          </section>
          <section className="po-print-box">
            <p className="po-print-box__label">References</p>
            <p>PO: {inv.purchaseOrderNumber ?? '—'}</p>
            <p>GRN: {inv.goodsReceiptNumber ?? '—'}</p>
            <p>Place of supply: {inv.placeOfSupply || '—'}</p>
            <p>Due: {inv.dueDate ? formatDate(inv.dueDate) : '—'}</p>
            <p>E-Invoice: {inv.eInvoiceReference ?? '—'}</p>
          </section>
        </div>

        <table className="po-print-lines">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>HSN</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Taxable</th>
              <th>GST%</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.lineNo}</td>
                <td>
                  {l.itemCode}
                  <br />
                  <span className="text-muted">{l.description || l.itemName}</span>
                </td>
                <td>{l.hsnCode || l.sacCode || '—'}</td>
                <td>
                  {formatNumber(l.quantity)} {l.uom}
                </td>
                <td>{formatCurrency(l.rate)}</td>
                <td>{formatCurrency(l.taxableAmount)}</td>
                <td>{l.gstRatePct}%</td>
                <td>{formatCurrency(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="po-print-totals">
          <p>Taxable: {formatCurrency(inv.taxableAmount)}</p>
          <p>CGST: {formatCurrency(inv.cgst)} · SGST: {formatCurrency(inv.sgst)} · IGST: {formatCurrency(inv.igst)}</p>
          <p className="po-print-totals__grand">Grand Total: {formatCurrency(inv.totalAmount)}</p>
        </div>

        {inv.remarks && (
          <section className="po-print-box mt-4">
            <p className="po-print-box__label">Remarks</p>
            <p>{inv.remarks}</p>
          </section>
        )}
      </article>
    </DocumentPrintShell>
  )
}
