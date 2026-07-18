import {
  COMPANY_ADDRESS,
  COMPANY_GSTIN,
  COMPANY_NAME,
  COMPANY_PAN,
  COMPANY_STATE,
} from '../../types/invoice'
import type { SalesOrder, SalesOrderLine } from '../../types/mrp'
import type { Customer, Product } from '../../types/master'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { salesOrderStatusLabel } from '../../utils/salesOrderStatus'
import { formatCustomerBillingAddress, resolveCustomerShippingAddress } from '../../utils/customerUtils'
import { amountInWords } from '../../utils/amountInWords'
import { resolveSalesOrderValue } from './SalesOrder360Sections'
import { cn } from '../../utils/cn'

export type SalesOrderPrintLine = {
  lineNo: number
  description: string
  hsn: string
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  taxPct: number
  taxableValue: number
  gstAmount: number
  lineTotal: number
}

export function buildSalesOrderPrintLines(
  order: SalesOrder,
  product?: Product | null,
): SalesOrderPrintLine[] {
  if (order.lines && order.lines.length > 0) {
    return order.lines.map((l: SalesOrderLine, idx) => ({
      lineNo: l.lineNo || idx + 1,
      description: l.description || l.productOrItem || product?.productName || '—',
      hsn: product?.hsnCode ?? '—',
      qty: l.qty,
      uom: l.uom || 'Nos',
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
      taxableValue: l.taxableValue,
      gstAmount: l.gstAmount,
      lineTotal: l.lineTotal,
    }))
  }

  const qty = order.qty || 1
  const unitPrice = order.unitPrice ?? product?.standardPrice ?? 0
  const discountPct = order.discountPct ?? 0
  const taxable = Math.max(0, qty * unitPrice * (1 - discountPct / 100))
  const taxPct = 18
  const gstAmount = order.gstAmount ?? taxable * (taxPct / 100)
  const lineTotal = order.grandTotal ?? taxable + gstAmount

  return [
    {
      lineNo: 1,
      description: product?.productName ?? 'Sales order line',
      hsn: product?.hsnCode ?? '—',
      qty,
      uom: 'Nos',
      unitPrice,
      discountPct,
      taxPct,
      taxableValue: order.basicAmount ?? taxable,
      gstAmount,
      lineTotal,
    },
  ]
}

interface SalesOrderPrintDocumentProps {
  order: SalesOrder
  customer?: Customer | null
  product?: Product | null
  className?: string
}

export function SalesOrderPrintDocument({
  order,
  customer,
  product,
  className,
}: SalesOrderPrintDocumentProps) {
  const lines = buildSalesOrderPrintLines(order, product)
  const taxable = lines.reduce((s, l) => s + l.taxableValue, 0)
  const gst = order.gstAmount ?? lines.reduce((s, l) => s + l.gstAmount, 0)
  const grand =
    order.grandTotal != null && Number(order.grandTotal) > 0
      ? Number(order.grandTotal)
      : resolveSalesOrderValue(order, product ?? undefined) || taxable + gst

  const billTo =
    order.billingAddress?.trim() ||
    (customer ? formatCustomerBillingAddress(customer) : '—')
  const shipTo =
    order.shippingAddress?.trim() ||
    (customer ? resolveCustomerShippingAddress(customer) : billTo)

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
          <p className="po-print-title">SALES ORDER</p>
          <p>
            <strong>{order.salesOrderNo}</strong>
          </p>
          <p>Date: {formatDate(order.orderDate ?? order.createdAt)}</p>
          <p>Required: {formatDate(order.requiredDate)}</p>
          <p>Status: {salesOrderStatusLabel(order.status)}</p>
        </div>
      </header>

      <div className="po-print-grid">
        <section className="po-print-box">
          <p className="po-print-box__label">Bill to</p>
          <p className="po-print-box__name">{customer?.customerName ?? '—'}</p>
          <p>Code: {order.customerCode ?? customer?.customerCode ?? '—'}</p>
          <p>GSTIN: {customer?.gstin || '—'}</p>
          <p>{billTo}</p>
          <p>State: {customer?.state ?? '—'}</p>
        </section>
        <section className="po-print-box">
          <p className="po-print-box__label">Order details</p>
          <p>Payment: {order.paymentTerms || '—'}</p>
          <p>Delivery: {order.deliveryTerms || '—'}</p>
          <p>Customer PO: {order.customerPoNumber || '—'}</p>
          <p>PO Date: {order.customerPoDate ? formatDate(order.customerPoDate) : '—'}</p>
          <p>Quotation: {order.quotationNo ? `${order.quotationNo} Rev ${order.quotationRevisionNo ?? 1}` : '—'}</p>
          <p>Owner: {order.salesOwnerName || '—'}</p>
          <p>Ship to: {shipTo}</p>
        </section>
      </div>

      <table className="po-print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>HSN</th>
            <th className="num">Qty</th>
            <th>UOM</th>
            <th className="num">Rate</th>
            <th className="num">Disc %</th>
            <th className="num">Taxable</th>
            <th className="num">GST</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.lineNo}>
              <td className="num">{l.lineNo}</td>
              <td>{l.description}</td>
              <td>{l.hsn}</td>
              <td className="num">{formatNumber(l.qty)}</td>
              <td>{l.uom}</td>
              <td className="num">{formatCurrency(l.unitPrice)}</td>
              <td className="num">{formatNumber(l.discountPct)}</td>
              <td className="num">{formatCurrency(l.taxableValue)}</td>
              <td className="num">{formatCurrency(l.gstAmount)}</td>
              <td className="num">{formatCurrency(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="po-print-summary">
        <div className="po-print-summary__row">
          <span>Taxable amount</span>
          <span>{formatCurrency(order.basicAmount ?? taxable)}</span>
        </div>
        <div className="po-print-summary__row">
          <span>GST</span>
          <span>{formatCurrency(gst)}</span>
        </div>
        <div className="po-print-summary__row po-print-summary__row--total">
          <span>Grand Total</span>
          <span>{formatCurrency(grand)}</span>
        </div>
      </div>

      <p className="po-print-words">
        <strong>Amount in words:</strong> {amountInWords(grand)}
      </p>

      {(order.commercialNotes || order.technicalNotes || order.remarks || order.warrantyTerms) && (
        <section className="po-print-terms">
          <p className="po-print-terms__title">Notes &amp; terms</p>
          <ul className="po-print-terms__list">
            {order.warrantyTerms ? <li>Warranty: {order.warrantyTerms}</li> : null}
            {order.commercialNotes ? <li>{order.commercialNotes}</li> : null}
            {order.technicalNotes ? <li>{order.technicalNotes}</li> : null}
            {order.remarks ? <li>{order.remarks}</li> : null}
          </ul>
        </section>
      )}

      <div className="po-print-signatures">
        <div className="po-print-signatures__line">Prepared by</div>
        <div className="po-print-signatures__line">Checked by</div>
        <div className="po-print-signatures__line">Authorised signatory</div>
      </div>
    </article>
  )
}
