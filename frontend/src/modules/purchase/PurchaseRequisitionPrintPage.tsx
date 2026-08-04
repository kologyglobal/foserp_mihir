import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DocumentPrintShell } from '@/components/print/DocumentPrintShell'
import { PurchaseDocumentLetterhead } from '@/components/purchase/PurchaseDocumentLetterhead'
import { getPurchaseRequisitionById } from '@/services/purchase'
import type { PurchaseRequisition } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { formatStatus } from '@/components/ui/Badge'
import { notify } from '@/store/toastStore'
import { handlePurchasePdfDownload } from '@/utils/purchaseDocumentPdfExport'
import { QUOTATION_COMPANY } from '@/utils/quotationEngine/companyProfile'
import { PurchasePrintDualQtyCell } from '@/components/purchase/print/PurchasePrintDualQtyCell'
import { resolveDualQtyForPrint } from '@/utils/purchasePrintDualQty'
import { getPurchaseLineBaseUomCode } from '@/utils/purchaseLineUom'
import { useMasterStore } from '@/store/masterStore'

export function PurchaseRequisitionPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pr, setPr] = useState<PurchaseRequisition | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const store = useMasterStore.getState()
        if (!store.items.length || !store.uoms.length) {
          const { syncBatchMastersFromApi } = await import('@/services/bridges/masterBatchApiBridge')
          await syncBatchMastersFromApi()
        }
      } catch {
        /* fallback uom from line */
      }
      const row = await getPurchaseRequisitionById(id)
      if (cancelled) return
      if (!row) {
        notify.error('Purchase requisition not found')
        navigate('/purchase/requisitions')
        return
      }
      setPr(row)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate])

  useEffect(() => {
    if (!pr) return
    if (searchParams.get('download') !== '1' && searchParams.get('autodownload') !== '1') return
    const timer = window.setTimeout(() => {
      void handlePurchasePdfDownload(`${pr.documentNumber}.pdf`, {
        documentKind: 'purchase_requisition',
      })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [pr, searchParams])

  if (loading || !pr) {
    return <div className="erp-page p-12 text-center text-erp-muted">Loading requisition…</div>
  }

  return (
    <DocumentPrintShell
      title={pr.documentNumber}
      subtitle="Purchase requisition — Vasant Fabricators letterhead"
      backLabel="Back to PR"
      backTo={`/purchase/requisitions/${pr.id}`}
      pdfFileName={`${pr.documentNumber}.pdf`}
      documentKind="purchase_requisition"
    >
      <article className="po-print-doc">
        <PurchaseDocumentLetterhead
          docType="Purchase Requisition"
          docNumber={pr.documentNumber}
          meta={[
            { label: 'Date', value: formatDate(pr.documentDate) },
            { label: 'Priority', value: formatStatus(pr.priority) },
            { label: 'Status', value: formatStatus(pr.status) },
          ]}
        />

        <div className="po-print-grid">
          <section className="po-print-box">
            <p className="po-print-box__label">Requesting</p>
            <p className="po-print-box__name">{pr.requester?.name || '—'}</p>
            <p>Department: {pr.department || '—'}</p>
            <p>Location: {pr.location?.name || '—'}</p>
            <p>Type: {formatStatus(pr.requisitionType)}</p>
            <p>Source: {formatStatus(pr.source)}</p>
          </section>
          <section className="po-print-box">
            <p className="po-print-box__label">Planning</p>
            <p>
              Required by:{' '}
              {pr.expectedDeliveryDate ? formatDate(pr.expectedDeliveryDate) : '—'}
            </p>
            <p>Cost centre: {pr.costCentre || '—'}</p>
            <p>Project: {pr.project || '—'}</p>
            <p>Production order: {pr.productionOrderNo || '—'}</p>
            <p>Preferred vendor: {pr.vendor?.name || '—'}</p>
            <p>Purpose: {pr.purpose || '—'}</p>
          </section>
        </div>

        <table className="po-print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Specification</th>
              <th className="num">Qty</th>
              <th className="num">Est. rate</th>
              <th className="num">Amount</th>
              <th>Required</th>
              <th>Preferred vendor</th>
            </tr>
          </thead>
          <tbody>
            {pr.lines.map((l) => {
              const dual = resolveDualQtyForPrint({
                stockQty: l.quantity,
                stockUom: getPurchaseLineBaseUomCode(l.itemId) || l.uom,
                itemId: l.itemId,
              })
              return (
              <tr key={l.id}>
                <td className="num">{l.lineNo}</td>
                <td className="mono">{l.itemCode}</td>
                <td>
                  <span className="font-semibold">{l.itemName}</span>
                  {l.specification ? (
                    <span className="block text-[10px] text-erp-muted">{l.specification}</span>
                  ) : null}
                </td>
                <PurchasePrintDualQtyCell {...dual} />
                <td className="num">{formatCurrency(l.estimatedRate)}</td>
                <td className="num">{formatCurrency(l.amount)}</td>
                <td>{formatDate(l.requiredDate)}</td>
                <td>{l.preferredVendorName || '—'}</td>
              </tr>
              )
            })}
          </tbody>
        </table>

        <div className="po-print-summary">
          <div className="po-print-summary__row po-print-summary__row--total">
            <span>Estimated total</span>
            <span>{formatCurrency(pr.totalAmount ?? pr.taxableAmount ?? 0)}</span>
          </div>
        </div>

        {pr.remarks ? (
          <div className="po-print-terms">
            <p className="po-print-terms__title">Remarks</p>
            <p className="whitespace-pre-wrap text-[12px]">{pr.remarks}</p>
          </div>
        ) : null}

        <div className="po-print-signatures">
          <div className="po-print-signatures__line">Requested by ({pr.requester?.name || '—'})</div>
          <div className="po-print-signatures__line">Approved by ({pr.approver?.name || '—'})</div>
          <div className="po-print-signatures__line">For {QUOTATION_COMPANY.legalName}</div>
        </div>
      </article>
    </DocumentPrintShell>
  )
}
