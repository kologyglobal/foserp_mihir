import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { getCustomerCreditNote } from '@/services/bridges/receivablesApiBridge'
import type { CustomerCreditNoteDto } from '@/types/moneyIn'
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '@/types/invoice'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { CREDIT_NOTE_STATUS_LABELS, creditNoteDisplayNumber, parseDecimal } from '../moneyInUi'
import { notify } from '@/store/toastStore'

export function CreditNotePrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [note, setNote] = useState<CustomerCreditNoteDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const row = await getCustomerCreditNote(id)
        if (!cancelled) setNote(row)
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Credit note not found')
        navigate('/accounting/money-in/credit-notes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (loading || !note) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading credit note…</div>
  }

  const docNo = creditNoteDisplayNumber(note)
  const lines = note.lines ?? []

  return (
    <DocumentPrintShell
      title={docNo}
      subtitle="Credit note — print-ready / Save as PDF"
      backLabel="Back to credit note"
      onBack={() => navigate(`/accounting/money-in/credit-notes/${note.id}`)}
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
            <p className="po-print-title">CREDIT NOTE</p>
            <p>
              <strong>{docNo}</strong>
            </p>
            <p>Date: {formatDate(note.creditNoteDate)}</p>
            <p>Status: {CREDIT_NOTE_STATUS_LABELS[note.status] ?? note.status}</p>
            {note.originalInvoiceNumberSnapshot ? (
              <p>Against invoice: {note.originalInvoiceNumberSnapshot}</p>
            ) : null}
          </div>
        </header>

        <div className="po-print-grid">
          <section className="po-print-box">
            <p className="po-print-box__label">Customer</p>
            <p className="po-print-box__name">{note.customerNameSnapshot}</p>
            <p>Code: {note.customerCodeSnapshot ?? '—'}</p>
            <p>GSTIN: {note.customerGstinSnapshot ?? '—'}</p>
          </section>
          <section className="po-print-box">
            <p className="po-print-box__label">Reason</p>
            <p>{note.reasonNameSnapshot ?? note.reasonCodeSnapshot ?? note.purpose}</p>
            <p>Purpose: {note.purpose}</p>
            <p>Currency: {note.currencyCode}</p>
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
                <td>{formatCurrency(parseDecimal(l.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="po-print-totals">
          <p>Taxable: {formatCurrency(parseDecimal(note.taxableAmount))}</p>
          <p>
            CGST: {formatCurrency(parseDecimal(note.cgstAmount))} · SGST:{' '}
            {formatCurrency(parseDecimal(note.sgstAmount))} · IGST:{' '}
            {formatCurrency(parseDecimal(note.igstAmount))}
          </p>
          <p className="po-print-totals__grand">
            Grand Total: {formatCurrency(parseDecimal(note.grandTotal))}
          </p>
        </div>
      </article>
    </DocumentPrintShell>
  )
}
