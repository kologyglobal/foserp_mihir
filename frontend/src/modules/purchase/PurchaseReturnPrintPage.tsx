import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { PurchaseDocumentLetterhead } from '@/components/purchase/PurchaseDocumentLetterhead'
import {
  getPurchaseReturnById,
  PURCHASE_RETURN_ORIGIN_LABELS,
  PURCHASE_RETURN_REASON_LABELS,
} from '@/services/purchase'
import type { PurchaseReturn } from '@/types/purchaseDomain'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { formatStatus } from '@/components/ui/Badge'
import { notify } from '@/store/toastStore'
import { handlePurchasePdfDownload } from '@/utils/purchaseDocumentPdfExport'
import { QUOTATION_COMPANY } from '@/utils/quotationEngine/companyProfile'

export function PurchaseReturnPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [doc, setDoc] = useState<PurchaseReturn | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const row = await getPurchaseReturnById(id)
      if (cancelled) return
      if (!row) {
        notify.error('Purchase return not found')
        navigate('/purchase/returns')
        return
      }
      setDoc(row)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  useEffect(() => {
    if (!doc) return
    if (searchParams.get('download') !== '1' && searchParams.get('autodownload') !== '1') return
    const timer = window.setTimeout(() => {
      void handlePurchasePdfDownload(`${doc.documentNumber}.pdf`)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [doc, searchParams])

  if (loading || !doc) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading return challan…</div>
  }

  return (
    <DocumentPrintShell
      title={doc.documentNumber}
      subtitle="Purchase return challan — Vasant Fabricators letterhead"
      backLabel="Back to Return"
      backTo={`/purchase/returns/${doc.id}`}
      pdfFileName={`${doc.documentNumber}.pdf`}
    >
      <article className="po-print-doc">
        <PurchaseDocumentLetterhead
          docType="Purchase Return Challan"
          docNumber={doc.documentNumber}
          meta={[
            { label: 'Date', value: formatDate(doc.documentDate) },
            { label: 'Status', value: formatStatus(doc.status) },
            { label: 'Origin', value: PURCHASE_RETURN_ORIGIN_LABELS[doc.origin] },
          ]}
        />

        <div className="po-print-grid">
          <section className="po-print-box">
            <p className="po-print-box__label">Vendor</p>
            <p className="po-print-box__name">{doc.vendor.name}</p>
            <p>GSTIN: {doc.vendor.gstin}</p>
            <p>Code: {doc.vendor.code}</p>
          </section>
          <section className="po-print-box">
            <p className="po-print-box__label">Return details</p>
            <p>Reason: {PURCHASE_RETURN_REASON_LABELS[doc.returnReason]}</p>
            <p>Warehouse: {doc.warehouseName}</p>
            <p>Transport: {doc.transportDetails || '—'}</p>
            <p>PO: {doc.purchaseOrderNumber || '—'}</p>
            <p>GRN: {doc.goodsReceiptNumber || '—'}</p>
            <p>Invoice: {doc.purchaseInvoiceNumber || '—'}</p>
            {doc.linkedDebitNoteNumber ? <p>Debit Note: {doc.linkedDebitNoteNumber}</p> : null}
            {doc.linkedReplacementPoNumber ? (
              <p>Replacement PO: {doc.linkedReplacementPoNumber}</p>
            ) : null}
          </section>
        </div>

        <table className="po-print-lines">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Batch / Serial</th>
              <th>Return Qty</th>
              <th>UOM</th>
              <th>Unit Cost</th>
              <th>Tax</th>
              <th>Amount</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.lineNo}</td>
                <td>
                  {l.itemCode}
                  <br />
                  {l.description || l.itemName}
                </td>
                <td>
                  {l.batchLotNo || '—'}
                  {l.serialNumber ? ` / ${l.serialNumber}` : ''}
                </td>
                <td>{formatNumber(l.returnQty)}</td>
                <td>{l.uom}</td>
                <td>{formatCurrency(l.unitCost)}</td>
                <td>{formatCurrency(l.cgst + l.sgst + l.igst)}</td>
                <td>{formatCurrency(l.returnAmount)}</td>
                <td>{PURCHASE_RETURN_REASON_LABELS[l.reason]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="po-print-totals">
          <p>
            Taxable: {formatCurrency(doc.taxableAmount)} · CGST: {formatCurrency(doc.cgst)} · SGST:{' '}
            {formatCurrency(doc.sgst)} · IGST: {formatCurrency(doc.igst)}
          </p>
          <p className="po-print-totals__grand">
            <strong>Grand Total: {formatCurrency(doc.totalAmount)}</strong>
          </p>
          {doc.remarks ? <p>Remarks: {doc.remarks}</p> : null}
        </div>

        <div className="po-print-signatures">
          <div className="po-print-signatures__line">Prepared by</div>
          <div className="po-print-signatures__line">Stores / Warehouse</div>
          <div className="po-print-signatures__line">For {QUOTATION_COMPANY.legalName}</div>
        </div>
      </article>
    </DocumentPrintShell>
  )
}
