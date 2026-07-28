import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { PurchaseDocumentLetterhead } from '@/components/purchase/PurchaseDocumentLetterhead'
import { getPurchaseInvoiceById } from '@/services/purchase'
import type { PurchaseInvoice } from '@/types/purchaseDomain'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { formatStatus } from '@/components/ui/Badge'
import { notify } from '@/store/toastStore'
import { handlePurchasePdfDownload } from '@/utils/purchaseDocumentPdfExport'
import { QUOTATION_COMPANY } from '@/utils/quotationEngine/companyProfile'

export function PurchaseInvoicePrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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

  useEffect(() => {
    if (!inv) return
    if (searchParams.get('download') !== '1' && searchParams.get('autodownload') !== '1') return
    const timer = window.setTimeout(() => {
      void handlePurchasePdfDownload(`${inv.documentNumber}.pdf`, {
        documentKind: 'purchase_invoice',
      })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [inv, searchParams])

  if (loading || !inv) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading purchase invoice…</div>
  }

  return (
    <DocumentPrintShell
      title={inv.documentNumber}
      subtitle="Purchase invoice — Vasant Fabricators letterhead"
      backLabel="Back to invoice"
      backTo={`/purchase/invoices/${inv.id}`}
      pdfFileName={`${inv.documentNumber}.pdf`}
      documentKind="purchase_invoice"
    >
      <article className="po-print-doc">
        <PurchaseDocumentLetterhead
          docType="Purchase Invoice"
          docNumber={inv.documentNumber}
          meta={[
            { label: 'Date', value: formatDate(inv.documentDate) },
            { label: 'Vendor inv', value: inv.vendorInvoiceNumber || '—' },
            { label: 'Status', value: formatStatus(inv.status) },
          ]}
        />

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
          <p>
            CGST: {formatCurrency(inv.cgst)} · SGST: {formatCurrency(inv.sgst)} · IGST:{' '}
            {formatCurrency(inv.igst)}
          </p>
          <p className="po-print-totals__grand">Grand Total: {formatCurrency(inv.totalAmount)}</p>
        </div>

        {inv.remarks ? (
          <section className="po-print-box mt-4">
            <p className="po-print-box__label">Remarks</p>
            <p>{inv.remarks}</p>
          </section>
        ) : null}

        <div className="po-print-signatures">
          <div className="po-print-signatures__line">Prepared by</div>
          <div className="po-print-signatures__line">Checked by</div>
          <div className="po-print-signatures__line">For {QUOTATION_COMPANY.legalName}</div>
        </div>
      </article>
    </DocumentPrintShell>
  )
}
