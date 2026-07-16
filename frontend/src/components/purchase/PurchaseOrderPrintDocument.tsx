import { useMemo } from 'react'
import type { PurchaseOrder } from '../../types/purchase'
import type { Vendor } from '../../types/master'
import { useMasterStore } from '../../store/masterStore'
import { usePurchaseStore } from '../../store/purchaseStore'
import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '../../types/invoice'
import { buildPoPrintContext, type PoPrintContext } from '../../utils/purchaseOrderExport'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { formatStatus } from '../../components/ui/Badge'
import { cn } from '../../utils/cn'

type PurchaseOrderPrintDocumentProps = {
  po: PurchaseOrder
  vendor?: Vendor
  sourcePrNo?: string
  sourceRfqNo?: string
  className?: string
}

export function usePoPrintContext(po: PurchaseOrder, vendor?: Vendor, sourcePrNo?: string, sourceRfqNo?: string): PoPrintContext {
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)
  const uoms = useMasterStore((s) => s.uoms)
  const items = useMasterStore((s) => s.items)

  return useMemo(
    () =>
      buildPoPrintContext({
        po,
        vendor,
        sourcePrNo,
        sourceRfqNo,
        getItem,
        getWarehouse,
        getUomCode: (itemId) => {
          const item = items.find((i) => i.id === itemId)
          return uoms.find((u) => u.id === item?.baseUomId)?.uomCode ?? 'Nos'
        },
      }),
    [po, vendor, sourcePrNo, sourceRfqNo, getItem, getWarehouse, items, uoms],
  )
}

export function PurchaseOrderPrintDocument({
  po,
  vendor,
  sourcePrNo,
  sourceRfqNo,
  className,
}: PurchaseOrderPrintDocumentProps) {
  const ctx = usePoPrintContext(po, vendor, sourcePrNo, sourceRfqNo)

  return (
    <article className={cn('po-print-doc', className)}>
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
            <strong>{po.poNo}</strong> · Rev {po.revisionNo}
          </p>
          <p>Date: {formatDate(po.orderDate)}</p>
          <p>Expected: {formatDate(po.expectedDate)}</p>
          <p>Status: {formatStatus(po.status)}</p>
        </div>
      </header>

      <div className="po-print-grid">
        <section className="po-print-box">
          <p className="po-print-box__label">Vendor</p>
          <p className="po-print-box__name">{vendor?.vendorName ?? '—'}</p>
          <p>Code: {vendor?.vendorCode ?? '—'}</p>
          <p>GSTIN: {vendor?.gstin || '—'}</p>
          <p>
            {vendor?.city ?? ''}
            {vendor?.state ? `, ${vendor.state}` : ''}
          </p>
          <p>
            Contact: {vendor?.contactPerson ?? '—'} · {vendor?.contactPhone ?? '—'}
          </p>
        </section>
        <section className="po-print-box">
          <p className="po-print-box__label">Order details</p>
          <p>Payment: {po.paymentTerms || 'Net 30'}</p>
          <p>Currency: INR</p>
          <p>Incoterms: Ex-Works</p>
          <p>PR Ref: {sourcePrNo ?? '—'}</p>
          <p>RFQ Ref: {sourceRfqNo ?? '—'}</p>
          <p>Created by: {po.createdByName}</p>
          <p>Approved by: {po.approvedByName ?? '—'}</p>
        </section>
      </div>

      <table className="po-print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Description</th>
            <th>HSN</th>
            <th>Warehouse</th>
            <th className="num">Qty</th>
            <th>UOM</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          {ctx.lines.map((l) => (
            <tr key={`${l.lineNo}-${l.itemCode}`}>
              <td className="num">{l.lineNo}</td>
              <td className="mono">{l.itemCode}</td>
              <td>{l.itemName}</td>
              <td>{l.hsnCode}</td>
              <td>{l.warehouse}</td>
              <td className="num">{formatNumber(l.qty)}</td>
              <td>{l.uom}</td>
              <td className="num">{formatCurrency(l.rate)}</td>
              <td className="num">{formatCurrency(l.amount)}</td>
              <td>{formatDate(l.requiredDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="po-print-summary">
        <div className="po-print-summary__row">
          <span>Subtotal</span>
          <span>{formatCurrency(ctx.subtotal)}</span>
        </div>
        <div className="po-print-summary__row">
          <span>GST (18% est.)</span>
          <span>{formatCurrency(ctx.gstEstimate)}</span>
        </div>
        <div className="po-print-summary__row po-print-summary__row--total">
          <span>Grand Total</span>
          <span>{formatCurrency(ctx.grandTotal)}</span>
        </div>
      </div>

      <p className="po-print-words">
        <strong>Amount in words:</strong> {ctx.amountWords}
      </p>

      <div className="po-print-terms">
        <p className="po-print-terms__title">Terms &amp; conditions</p>
        <ol className="po-print-terms__list">
          <li>Delivery as per agreed schedule. Partial shipments require prior approval.</li>
          <li>Invoice must reference this PO number and match approved rates.</li>
          <li>Material must pass incoming QC where applicable before acceptance.</li>
          <li>All disputes subject to Pune jurisdiction.</li>
        </ol>
      </div>

      <div className="po-print-signatures">
        <div className="po-print-signatures__line">Prepared by</div>
        <div className="po-print-signatures__line">Approved by</div>
        <div className="po-print-signatures__line">Vendor acknowledgement</div>
      </div>
    </article>
  )
}

export function PoPrintView({ poId }: { poId: string }) {
  const po = usePurchaseStore((s) => s.purchaseOrders.find((p) => p.id === poId))
  const getVendor = useMasterStore((s) => s.getVendor)
  const sourcePr = po?.prId ? usePurchaseStore.getState().getPr(po.prId) : undefined
  const sourceRfq = po?.rfqId ? usePurchaseStore.getState().getRfq(po.rfqId) : undefined

  if (!po) {
    return (
      <div className="rounded-lg border border-dashed border-erp-border bg-erp-surface-alt p-8 text-center text-sm text-erp-muted">
        Purchase order not found.
      </div>
    )
  }

  return (
    <PurchaseOrderPrintDocument
      po={po}
      vendor={getVendor(po.vendorId)}
      sourcePrNo={sourcePr?.prNo}
      sourceRfqNo={sourceRfq?.rfqNo}
    />
  )
}
