import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import {
  getPurchaseReturnById,
  PURCHASE_RETURN_ORIGIN_LABELS,
  PURCHASE_RETURN_REASON_LABELS,
} from '@/services/purchase'
import type { PurchaseReturn } from '@/types/purchaseDomain'
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

export function PurchaseReturnPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
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

  if (loading || !doc) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading return challan…</div>
  }

  return (
    <div className="po-print-page erp-page">
      <div className="po-print-toolbar no-print">
        <div>
          <p className="po-print-toolbar__title">{doc.documentNumber}</p>
          <p className="po-print-toolbar__subtitle">Purchase return challan print preview</p>
        </div>
        <ErpButtonGroup>
          <ErpButton type="button" variant="secondary" icon={Printer} onClick={() => window.print()}>
            Print
          </ErpButton>
          <ErpButton type="button" variant="secondary" icon={Download} onClick={() => window.print()}>
            Download PDF
          </ErpButton>
          <Link to={`/purchase/returns/${doc.id}`}>
            <ErpButton type="button" variant="ghost" icon={ArrowLeft}>
              Back to Return
            </ErpButton>
          </Link>
        </ErpButtonGroup>
      </div>

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
            <h2>PURCHASE RETURN CHALLAN</h2>
            <p>
              <strong>{doc.documentNumber}</strong>
            </p>
            <p>Date: {formatDate(doc.documentDate)}</p>
            <p>Status: {formatStatus(doc.status)}</p>
          </div>
        </header>

        <section className="po-print-parties">
          <div>
            <h3>Vendor</h3>
            <p>
              <strong>{doc.vendor.name}</strong>
            </p>
            <p>GSTIN: {doc.vendor.gstin}</p>
            <p>Code: {doc.vendor.code}</p>
          </div>
          <div>
            <h3>Return details</h3>
            <p>Origin: {PURCHASE_RETURN_ORIGIN_LABELS[doc.origin]}</p>
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
          </div>
        </section>

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

        <footer className="po-print-totals">
          <p>
            Taxable: {formatCurrency(doc.taxableAmount)} · CGST: {formatCurrency(doc.cgst)} · SGST:{' '}
            {formatCurrency(doc.sgst)} · IGST: {formatCurrency(doc.igst)}
          </p>
          <p className="po-print-totals__grand">
            <strong>Grand Total: {formatCurrency(doc.totalAmount)}</strong>
          </p>
          {doc.remarks ? <p>Remarks: {doc.remarks}</p> : null}
        </footer>
      </article>
    </div>
  )
}
