import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { PurchaseDocumentLetterhead } from '@/components/purchase/PurchaseDocumentLetterhead'
import { getRFQById } from '@/services/purchase'
import type { RequestForQuotation } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { formatStatus } from '@/components/ui/Badge'
import { notify } from '@/store/toastStore'
import { handlePurchasePdfDownload } from '@/utils/purchaseDocumentPdfExport'
import { QUOTATION_COMPANY } from '@/utils/quotationEngine/companyProfile'
import { PurchasePrintDualQtyCell } from '@/components/purchase/print/PurchasePrintDualQtyCell'
import { resolveDualQtyForPrint } from '@/utils/purchasePrintDualQty'
import { useMasterStore } from '@/store/masterStore'

export function RfqPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [rfq, setRfq] = useState<RequestForQuotation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      // Ensure item master is available so vendor UOM / factor resolve on print.
      try {
        const store = useMasterStore.getState()
        if (!store.items.length || !store.uoms.length) {
          const { syncBatchMastersFromApi } = await import('@/services/bridges/masterBatchApiBridge')
          await syncBatchMastersFromApi()
        }
      } catch {
        /* print still works with single qty fallback */
      }
      const row = await getRFQById(id)
      if (cancelled) return
      if (!row) {
        notify.error('RFQ not found')
        navigate('/purchase/rfqs')
        return
      }
      setRfq(row)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  useEffect(() => {
    if (!rfq) return
    if (searchParams.get('download') !== '1' && searchParams.get('autodownload') !== '1') return
    const timer = window.setTimeout(() => {
      void handlePurchasePdfDownload(`${rfq.documentNumber}.pdf`, {
        documentKind: 'request_for_quotation',
      })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [rfq, searchParams])

  if (loading || !rfq) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading RFQ…</div>
  }

  const vendors = (rfq.vendors ?? [])
    .filter((v) => v.selected !== false)
    .map((v) => v.vendorName)
    .filter(Boolean)

  return (
    <DocumentPrintShell
      title={rfq.documentNumber}
      subtitle="Request for quotation — Vasant Fabricators letterhead"
      backLabel="Back to RFQ"
      backTo={`/purchase/rfqs/${rfq.id}`}
      pdfFileName={`${rfq.documentNumber}.pdf`}
      documentKind="request_for_quotation"
    >
      <article className="po-print-doc">
        <PurchaseDocumentLetterhead
          docType="Request for Quotation"
          docNumber={rfq.documentNumber}
          meta={[
            { label: 'Date', value: formatDate(rfq.documentDate) },
            { label: 'Bid due', value: formatDate(rfq.bidDueDate) },
            { label: 'Status', value: formatStatus(rfq.status) },
          ]}
        />

        <div className="po-print-grid">
          <section className="po-print-box">
            <p className="po-print-box__label">Buyer / site</p>
            <p className="po-print-box__name">{rfq.buyer?.name || '—'}</p>
            <p>Department: {rfq.department || '—'}</p>
            <p>Location: {rfq.location?.name || '—'}</p>
            <p>Requester: {rfq.requester?.name || '—'}</p>
            <p>
              PR Ref:{' '}
              {(rfq.purchaseRequisitionNumbers ?? []).join(', ') ||
                rfq.purchaseRequisitionNumber ||
                '—'}
            </p>
          </section>
          <section className="po-print-box">
            <p className="po-print-box__label">Commercial</p>
            <p>Currency: {rfq.currency}</p>
            <p>Payment: {rfq.paymentTerms || '—'}</p>
            <p>Delivery: {rfq.deliveryTerms || '—'}</p>
            <p>Freight: {rfq.freightTerms || '—'}</p>
            <p>
              Expected delivery:{' '}
              {rfq.expectedDeliveryDate ? formatDate(rfq.expectedDeliveryDate) : '—'}
            </p>
            <p>Vendors invited: {vendors.length ? vendors.join(', ') : '—'}</p>
          </section>
        </div>

        <table className="po-print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Specification</th>
              <th>HSN</th>
              <th className="num">Qty</th>
              <th>UOM</th>
              <th className="num">Target</th>
              <th className="num">Amount</th>
              <th>Required</th>
            </tr>
          </thead>
          <tbody>
            {rfq.lines.map((l) => (
              <tr key={l.id}>
                <td className="num">{l.lineNo}</td>
                <td className="mono">{l.itemCode}</td>
                <td>
                  <span className="font-semibold">{l.itemName}</span>
                  {l.specification ? (
                    <span className="block text-[10px] text-erp-muted">{l.specification}</span>
                  ) : null}
                </td>
                <td>{l.hsnCode || l.sacCode || '—'}</td>
                <PurchasePrintDualQtyCell
                  {...resolveDualQtyForPrint({ stockQty: l.quantity, itemId: l.itemId })}
                />
                <td>{l.uom || '—'}</td>
                <td className="num">{formatCurrency(l.targetPrice)}</td>
                <td className="num">{formatCurrency(l.amount)}</td>
                <td>{formatDate(l.requiredDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="po-print-summary">
          <div className="po-print-summary__row po-print-summary__row--total">
            <span>Estimated value</span>
            <span>{formatCurrency(rfq.estimatedValue)}</span>
          </div>
        </div>

        <div className="po-print-signatures">
          <div className="po-print-signatures__line">Prepared by ({rfq.buyer?.name || '—'})</div>
          <div className="po-print-signatures__line">Technical contact ({rfq.technicalContact || '—'})</div>
          <div className="po-print-signatures__line">For {QUOTATION_COMPANY.legalName}</div>
        </div>
      </article>
    </DocumentPrintShell>
  )
}
