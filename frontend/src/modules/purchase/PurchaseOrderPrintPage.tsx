import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { getPurchaseOrderById } from '@/services/purchase'
import type { PurchaseOrder } from '@/types/purchaseDomain'
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

export function PurchaseOrderPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const row = await getPurchaseOrderById(id)
      if (cancelled) return
      if (!row) {
        notify.error('Purchase order not found')
        navigate('/purchase/orders')
        return
      }
      setPo(row)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  if (loading || !po) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading purchase order…</div>
  }

  return (
    <div className="po-print-page erp-page">
      <div className="po-print-toolbar no-print">
        <div>
          <p className="po-print-toolbar__title">{po.documentNumber}</p>
          <p className="po-print-toolbar__subtitle">Purchase order print preview</p>
        </div>
        <ErpButtonGroup>
          <ErpButton type="button" variant="secondary" icon={Printer} onClick={() => window.print()}>
            Print
          </ErpButton>
          <ErpButton type="button" variant="secondary" icon={Download} onClick={() => window.print()}>
            Download PDF
          </ErpButton>
          <Link to={`/purchase/orders/${po.id}`}>
            <ErpButton type="button" variant="ghost" icon={ArrowLeft}>
              Back to PO
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
            <p className="po-print-title">PURCHASE ORDER</p>
            <p>
              <strong>{po.documentNumber}</strong> · Rev {po.revisionNo}
            </p>
            <p>Date: {formatDate(po.documentDate)}</p>
            <p>Expected: {formatDate(po.expectedDeliveryDate)}</p>
            <p>Status: {formatStatus(po.status)}</p>
          </div>
        </header>

        <div className="po-print-grid">
          <section className="po-print-box">
            <p className="po-print-box__label">Vendor</p>
            <p className="po-print-box__name">{po.vendor.name}</p>
            <p>Code: {po.vendor.code}</p>
            <p>GSTIN: {po.vendor.gstin || '—'}</p>
            <p>{po.vendor.address || '—'}</p>
            <p>State: {po.vendor.state}</p>
          </section>
          <section className="po-print-box">
            <p className="po-print-box__label">Order details</p>
            <p>Payment: {po.paymentTerms || 'Net 30'}</p>
            <p>Delivery Terms: {po.deliveryTerms || '—'}</p>
            <p>Freight: {po.freightTerms || '—'}</p>
            <p>Currency: {po.currency}</p>
            <p>Place of Supply: {po.placeOfSupply || '—'}</p>
            <p>PR Ref: {po.purchaseRequisitionNumber ?? '—'}</p>
            <p>RFQ Ref: {po.rfqNumber ?? '—'}</p>
            <p>Buyer: {po.buyer.name}</p>
          </section>
        </div>

        <table className="po-print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Description</th>
              <th>HSN</th>
              <th className="num">Qty</th>
              <th>UOM</th>
              <th className="num">Rate</th>
              <th className="num">Taxable</th>
              <th className="num">GST</th>
              <th className="num">Amount</th>
              <th>Required</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id}>
                <td className="num">{l.lineNo}</td>
                <td className="mono">{l.itemCode}</td>
                <td>{l.itemName}</td>
                <td>{l.hsnCode || l.sacCode || '—'}</td>
                <td className="num">{formatNumber(l.quantity)}</td>
                <td>{l.uom}</td>
                <td className="num">{formatCurrency(l.rate)}</td>
                <td className="num">{formatCurrency(l.taxableAmount)}</td>
                <td className="num">{formatCurrency(l.cgst + l.sgst + l.igst)}</td>
                <td className="num">{formatCurrency(l.lineTotal)}</td>
                <td>{formatDate(l.requiredDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="po-print-summary">
          <div className="po-print-summary__row">
            <span>Basic Amount</span>
            <span>{formatCurrency(po.subtotal)}</span>
          </div>
          <div className="po-print-summary__row">
            <span>Discount</span>
            <span>{formatCurrency(po.discount)}</span>
          </div>
          <div className="po-print-summary__row">
            <span>Freight / Packing / Insurance / Other</span>
            <span>{formatCurrency(po.freight + po.packingCharges + po.insuranceCharges + po.otherCharges)}</span>
          </div>
          <div className="po-print-summary__row">
            <span>Taxable Amount</span>
            <span>{formatCurrency(po.taxableAmount)}</span>
          </div>
          <div className="po-print-summary__row">
            <span>CGST</span>
            <span>{formatCurrency(po.cgst)}</span>
          </div>
          <div className="po-print-summary__row">
            <span>SGST</span>
            <span>{formatCurrency(po.sgst)}</span>
          </div>
          <div className="po-print-summary__row">
            <span>IGST</span>
            <span>{formatCurrency(po.igst)}</span>
          </div>
          <div className="po-print-summary__row">
            <span>TCS</span>
            <span>{formatCurrency(po.tcsAmount)}</span>
          </div>
          <div className="po-print-summary__row">
            <span>Round Off</span>
            <span>{formatCurrency(po.roundOff)}</span>
          </div>
          <div className="po-print-summary__row po-print-summary__row--total">
            <span>Grand Total</span>
            <span>{formatCurrency(po.totalAmount)}</span>
          </div>
        </div>

        <div className="po-print-terms">
          <p className="po-print-terms__title">Terms &amp; conditions</p>
          <p className="whitespace-pre-wrap text-[12px]">
            {po.termsAndConditions ||
              'Delivery as per agreed schedule. Invoice must reference this PO number and match approved rates.'}
          </p>
        </div>

        <div className="po-print-signatures">
          <div className="po-print-signatures__line">Prepared by ({po.buyer.name})</div>
          <div className="po-print-signatures__line">Approved by ({po.approver?.name ?? '—'})</div>
          <div className="po-print-signatures__line">Vendor acknowledgement</div>
        </div>
      </article>
    </div>
  )
}
