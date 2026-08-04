import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { PurchaseDocumentLetterhead } from '@/components/purchase/PurchaseDocumentLetterhead'
import { getPurchaseOrderById } from '@/services/purchase'
import type { PurchaseOrder } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { formatStatus } from '@/components/ui/Badge'
import { notify } from '@/store/toastStore'
import { handlePurchasePdfDownload } from '@/utils/purchaseDocumentPdfExport'
import { QUOTATION_COMPANY } from '@/utils/quotationEngine/companyProfile'
import { PurchasePrintDualQtyCell } from '@/components/purchase/print/PurchasePrintDualQtyCell'
import { resolveDualQtyForPrint } from '@/utils/purchasePrintDualQty'
import { getPurchaseLineBaseUomCode } from '@/utils/purchaseLineUom'

export function PurchaseOrderPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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

  useEffect(() => {
    if (!po) return
    if (searchParams.get('download') !== '1' && searchParams.get('autodownload') !== '1') return
    const timer = window.setTimeout(() => {
      void handlePurchasePdfDownload(`${po.documentNumber}.pdf`, {
        documentKind: 'purchase_order',
      })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [po, searchParams])

  if (loading || !po) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading purchase order…</div>
  }

  const showDualQtyHint = po.lines.some((l) => {
    const dual = resolveDualQtyForPrint({
      stockQty: l.quantity,
      stockUom: getPurchaseLineBaseUomCode(l.itemId) || l.uom,
      purchaseQty: l.uomQuantity,
      purchaseUom: l.uom,
      uomConversionFactor: l.uomConversionFactor,
      itemId: l.itemId,
    })
    return dual.showDual
  })

  return (
    <DocumentPrintShell
      title={po.documentNumber}
      subtitle="Purchase order — Vasant Fabricators letterhead"
      backLabel="Back to PO"
      backTo={`/purchase/orders/${po.id}`}
      pdfFileName={`${po.documentNumber}.pdf`}
      documentKind="purchase_order"
    >
      <article className="po-print-doc">
        <PurchaseDocumentLetterhead
          docType="Purchase Order"
          docNumber={po.documentNumber}
          meta={[
            { label: 'Date', value: formatDate(po.documentDate) },
            { label: 'Expected', value: formatDate(po.expectedDeliveryDate) },
            { label: 'Rev', value: String(po.revisionNo) },
            { label: 'Status', value: formatStatus(po.status) },
          ]}
        />

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
            {showDualQtyHint ? (
              <p className="po-print-hint">Qty: purchase unit on top · stock unit below</p>
            ) : null}
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
              <th className="num">Rate</th>
              <th className="num">Taxable</th>
              <th className="num">GST</th>
              <th className="num">Amount</th>
              <th>Required</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => {
              const dual = resolveDualQtyForPrint({
                stockQty: l.quantity,
                stockUom: getPurchaseLineBaseUomCode(l.itemId) || l.uom,
                purchaseQty: l.uomQuantity,
                purchaseUom: l.uom,
                uomConversionFactor: l.uomConversionFactor,
                itemId: l.itemId,
              })
              return (
              <tr key={l.id}>
                <td className="num">{l.lineNo}</td>
                <td className="mono">{l.itemCode}</td>
                <td>{l.itemName}</td>
                <td>{l.hsnCode || l.sacCode || '—'}</td>
                <PurchasePrintDualQtyCell {...dual} />
                <td className="num">{formatCurrency(l.rate)}</td>
                <td className="num">{formatCurrency(l.taxableAmount)}</td>
                <td className="num">{formatCurrency(l.cgst + l.sgst + l.igst)}</td>
                <td className="num">{formatCurrency(l.lineTotal)}</td>
                <td>{formatDate(l.requiredDate)}</td>
              </tr>
              )
            })}
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
            <span>
              {formatCurrency(po.freight + po.packingCharges + po.insuranceCharges + po.otherCharges)}
            </span>
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
          <div className="po-print-signatures__line">
            For {QUOTATION_COMPANY.legalName} / Vendor acknowledgement
          </div>
        </div>
      </article>
    </DocumentPrintShell>
  )
}
