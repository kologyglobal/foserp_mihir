import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { getSalesInvoice } from '@/services/bridges/receivablesApiBridge'
import type { SalesInvoiceDto } from '@/types/moneyIn'
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '@/types/invoice'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { invoiceDisplayNumber, MONEY_IN_STATUS_LABELS, parseDecimal } from '../moneyInUi'
import { notify } from '@/store/toastStore'

function gstRate(line: NonNullable<SalesInvoiceDto['lines']>[number]): number {
  return Math.max(parseDecimal(line.cgstRate), parseDecimal(line.sgstRate), parseDecimal(line.igstRate))
}

export function SalesInvoicePrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<SalesInvoiceDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const row = await getSalesInvoice(id)
        if (!cancelled) setInvoice(row)
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Invoice not found')
        navigate('/accounting/money-in/invoices')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (loading || !invoice) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading tax invoice…</div>
  }

  const docNo = invoiceDisplayNumber(invoice)
  const lines = invoice.lines ?? []

  return (
    <DocumentPrintShell
      title={docNo}
      subtitle="Tax invoice — print-ready / Save as PDF"
      backLabel="Back to invoice"
      onBack={() => navigate(`/accounting/money-in/invoices/${invoice.id}`)}
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
            <p className="po-print-title">TAX INVOICE</p>
            <p>
              <strong>{docNo}</strong>
            </p>
            <p>Date: {formatDate(invoice.invoiceDate)}</p>
            <p>Status: {MONEY_IN_STATUS_LABELS[invoice.status] ?? invoice.status}</p>
            {invoice.customerPoNumber ? <p>Customer PO: {invoice.customerPoNumber}</p> : null}
          </div>
        </header>

        <div className="po-print-grid">
          <section className="po-print-box">
            <p className="po-print-box__label">Bill to</p>
            <p className="po-print-box__name">{invoice.customerNameSnapshot}</p>
            <p>Code: {invoice.customerCodeSnapshot ?? '—'}</p>
            <p>GSTIN: {invoice.customerGstinSnapshot ?? '—'}</p>
            <p>State: {invoice.customerStateCodeSnapshot ?? '—'}</p>
          </section>
          <section className="po-print-box">
            <p className="po-print-box__label">Supply</p>
            <p>Place of supply: {invoice.placeOfSupply ?? '—'}</p>
            <p>Supply type: {invoice.supplyType}</p>
            <p>Due: {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</p>
            <p>Currency: {invoice.currencyCode}</p>
            {invoice.referenceNumber ? <p>Reference: {invoice.referenceNumber}</p> : null}
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
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{l.lineNumber}</td>
                <td>
                  {l.itemCodeSnapshot ?? '—'}
                  <br />
                  <span className="text-muted">{l.description || l.itemNameSnapshot || '—'}</span>
                </td>
                <td>{l.hsnCodeSnapshot ?? '—'}</td>
                <td>
                  {l.quantity} {l.uomSnapshot ?? ''}
                </td>
                <td>{formatCurrency(parseDecimal(l.unitRate))}</td>
                <td>{formatCurrency(parseDecimal(l.taxableAmount))}</td>
                <td>{gstRate(l)}%</td>
                <td>{formatCurrency(parseDecimal(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="po-print-totals">
          <p>Taxable: {formatCurrency(parseDecimal(invoice.taxableAmount))}</p>
          <p>
            CGST: {formatCurrency(parseDecimal(invoice.cgstAmount))} · SGST:{' '}
            {formatCurrency(parseDecimal(invoice.sgstAmount))} · IGST:{' '}
            {formatCurrency(parseDecimal(invoice.igstAmount))}
          </p>
          <p className="po-print-totals__grand">
            Grand Total: {formatCurrency(parseDecimal(invoice.totalAmount))}
          </p>
        </div>

        {invoice.narration ? (
          <section className="po-print-box mt-4">
            <p className="po-print-box__label">Narration</p>
            <p>{invoice.narration}</p>
          </section>
        ) : null}
      </article>
    </DocumentPrintShell>
  )
}
