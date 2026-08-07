import { useCompanyProfile } from '../../utils/quotationEngine/companyProfile'
import { CompanyBankDetailsBlock } from '../print/CompanyBankDetailsBlock'
import type { SalesOrder, SalesOrderLine } from '../../types/mrp'
import type { Customer, Location, Product } from '../../types/master'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { salesOrderStatusLabel } from '../../utils/salesOrderStatus'
import { formatCustomerBillingAddress, resolveCustomerShippingAddress } from '../../utils/customerUtils'
import { amountInWords } from '../../utils/amountInWords'
import { resolveSalesOrderDeliveryLocationLabel } from '../../utils/locationUtils'
import { resolveSalesOrderValue } from './SalesOrder360Sections'
import { cn } from '../../utils/cn'
import { useTenantProfileStore } from '../../store/tenantProfileStore'

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
  products: Product[] = [],
  items: Array<{ id: string; hsnCode?: string | null }> = [],
): SalesOrderPrintLine[] {
  if (order.lines && order.lines.length > 0) {
    return order.lines.map((l: SalesOrderLine, idx) => {
      const lineProduct = l.productId
        ? products.find((p) => p.id === l.productId)
        : undefined
      const item = l.itemId ? items.find((i) => i.id === l.itemId) : undefined
      // Snapshot first — do not prefer live master over saved hsnCode.
      const hsn =
        (l.hsnCode ?? '').trim() ||
        (item?.hsnCode ?? '').trim() ||
        (lineProduct?.hsnCode ?? product?.hsnCode ?? '').trim() ||
        '-'
      return {
        lineNo: l.lineNo || idx + 1,
        description: l.description || l.productOrItem || lineProduct?.productName || product?.productName || '-',
        hsn,
        qty: l.qty,
        uom: l.uom || 'Nos',
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        taxPct: l.taxPct,
        taxableValue: l.taxableValue,
        gstAmount: l.gstAmount,
        lineTotal: l.lineTotal,
      }
    })
  }

  const qty = order.qty || 1
  const unitPrice = order.unitPrice ?? product?.standardPrice ?? 0
  const discountPct = order.discountPct ?? 0
  const taxable = Math.max(0, qty * unitPrice * (1 - discountPct / 100))
  // No silent 18 — use header gstAmount when present, else 0 until resolved.
  const taxPct = 0
  const gstAmount = order.gstAmount ?? 0
  const lineTotal = order.grandTotal ?? taxable + gstAmount

  return [
    {
      lineNo: 1,
      description: product?.productName ?? 'Sales order line',
      hsn: product?.hsnCode ?? '-',
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
  products?: Product[]
  locations?: Location[]
  className?: string
}

export function SalesOrderPrintDocument({
  order,
  customer,
  product,
  products = [],
  locations = [],
  className,
}: SalesOrderPrintDocumentProps) {
  const lines = buildSalesOrderPrintLines(order, product, products)
  const taxable = lines.reduce((s, l) => s + l.taxableValue, 0)
  const gst = order.gstAmount ?? lines.reduce((s, l) => s + l.gstAmount, 0)
  const grand =
    order.grandTotal != null && Number(order.grandTotal) > 0
      ? Number(order.grandTotal)
      : resolveSalesOrderValue(order, product ?? undefined) || taxable + gst

  const billTo =
    order.billingAddress?.trim() ||
    (customer ? formatCustomerBillingAddress(customer) : '-')
  const shipTo =
    order.shippingAddress?.trim() ||
    (customer ? resolveCustomerShippingAddress(customer) : billTo)

  const company = useCompanyProfile()
  const isServices = useTenantProfileStore((s) => s.isServices())
  const deliveryLocationLabel = resolveSalesOrderDeliveryLocationLabel(order, locations)
  const bank = company.bankDetails

  return (
    <article className={cn('so-print-doc', className)}>
      <div className="so-print-doc__accent" aria-hidden />

      <header className="so-print-header">
        <div className="so-print-header__brand">
          <div className="so-print-header__logo-wrap">
            <img
              className="so-print-header__logo"
              src={company.logoUrl}
              alt={company.brandName}
            />
          </div>
          <div className="so-print-header__identity">
            <h1 className="so-print-header__company">{company.legalName}</h1>
            {company.tagline ? <p className="so-print-header__tagline">{company.tagline}</p> : null}
            <p className="so-print-header__address">{company.address}</p>
            <p className="so-print-header__contact">
              {[company.phone, company.email, company.website].filter(Boolean).join(' · ')}
            </p>
            {company.gstin ? <p className="so-print-header__gstin">GSTIN: {company.gstin}</p> : null}
          </div>
        </div>
        <div className="so-print-header__badge">
          <p className="so-print-header__doc-type">Sales Order</p>
          <p className="so-print-header__doc-no">{order.salesOrderNo}</p>
          <dl className="so-print-header__meta">
            <div>
              <dt>Order date</dt>
              <dd>{formatDate(order.orderDate ?? order.createdAt)}</dd>
            </div>
            <div>
              <dt>Required by</dt>
              <dd>{formatDate(order.requiredDate || order.expectedDeliveryDate)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{salesOrderStatusLabel(order.status)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="so-print-parties">
        <section className="so-print-party">
          <p className="so-print-party__label">Bill to</p>
          <p className="so-print-party__name">{customer?.customerName ?? order.customerName ?? '-'}</p>
          <p className="so-print-party__line">Code: {order.customerCode ?? customer?.customerCode ?? '-'}</p>
          <p className="so-print-party__line">GSTIN: {customer?.gstin || '-'}</p>
          <p className="so-print-party__line">{billTo}</p>
          <p className="so-print-party__line">State: {customer?.state ?? '-'}</p>
        </section>
        {isServices && bank ? (
          <section className="so-print-party">
            <p className="so-print-party__label">Bank details</p>
            <p className="so-print-party__name">{bank.accountName || '-'}</p>
            <p className="so-print-party__line"><span>Bank</span> {bank.bankName || '-'}</p>
            <p className="so-print-party__line"><span>A/C No.</span> {bank.accountNumber || '-'}</p>
            <p className="so-print-party__line"><span>IFSC</span> {bank.ifscCode || '-'}</p>
            <p className="so-print-party__line"><span>Branch</span> {bank.branch || '-'}</p>
          </section>
        ) : (
          <section className="so-print-party">
            <p className="so-print-party__label">Ship to</p>
            <p className="so-print-party__name">{customer?.customerName ?? order.customerName ?? '-'}</p>
            <p className="so-print-party__line">{shipTo}</p>
            {deliveryLocationLabel ? (
              <p className="so-print-party__line">Location: {deliveryLocationLabel}</p>
            ) : null}
          </section>
        )}
      </div>

      <table className="so-print-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Description</th>
            <th>HSN</th>
            <th className="num">Qty</th>
            <th>UOM</th>
            <th className="num">Rate</th>
            <th className="num">Disc %</th>
            <th className="num">Tax %</th>
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
              <td className="num">{formatNumber(l.taxPct)}</td>
              <td className="num">{formatCurrency(l.taxableValue)}</td>
              <td className="num">{formatCurrency(l.gstAmount)}</td>
              <td className="num">{formatCurrency(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="so-print-footer-grid">
        <div className="so-print-words">
          <p className="so-print-words__label">Amount in words</p>
          <p className="so-print-words__value">{amountInWords(grand)}</p>
          {(order.commercialNotes || order.technicalNotes || order.remarks || order.warrantyTerms) && (
            <div className="so-print-notes">
              <p className="so-print-notes__title">Notes &amp; terms</p>
              <ul>
                {order.warrantyTerms ? <li>Warranty: {order.warrantyTerms}</li> : null}
                {order.commercialNotes ? <li>{order.commercialNotes}</li> : null}
                {order.technicalNotes ? <li>{order.technicalNotes}</li> : null}
                {order.remarks ? <li>{order.remarks}</li> : null}
              </ul>
            </div>
          )}
        </div>
        <div className="so-print-totals">
          <div className="so-print-totals__row">
            <span>Taxable amount</span>
            <span>{formatCurrency(order.basicAmount ?? taxable)}</span>
          </div>
          <div className="so-print-totals__row">
            <span>GST</span>
            <span>{formatCurrency(gst)}</span>
          </div>
          <div className="so-print-totals__row so-print-totals__row--grand">
            <span>Grand total</span>
            <span>{formatCurrency(grand)}</span>
          </div>
        </div>
      </div>

      <section className="so-print-party so-print-party--meta so-print-commercial">
        <p className="so-print-party__label">Commercial</p>
        <p className="so-print-party__line"><span>Payment</span> {order.paymentTerms || '-'}</p>
        <p className="so-print-party__line"><span>Delivery terms</span> {order.deliveryTerms || '-'}</p>
        <p className="so-print-party__line">
          <span>Delivery Time / Lead Time</span> {order.deliveryTime || '-'}
        </p>
        <p className="so-print-party__line"><span>Customer PO</span> {order.customerPoNumber || '-'}</p>
        <p className="so-print-party__line">
          <span>PO date</span> {order.customerPoDate ? formatDate(order.customerPoDate) : '-'}
        </p>
        <p className="so-print-party__line">
          <span>Quotation Number (Reference)</span>{' '}
          {order.quotationNo ? `${order.quotationNo} Rev ${order.quotationRevisionNo ?? 1}` : '-'}
        </p>
        <p className="so-print-party__line"><span>Owner</span> {order.salesOwnerName || '-'}</p>
      </section>

      {!isServices && bank ? <CompanyBankDetailsBlock bank={bank} /> : null}

      <div className="so-print-signatures">
        <div className="so-print-signatures__block">
          <div className="so-print-signatures__line" />
          <p>Prepared by</p>
        </div>
        <div className="so-print-signatures__block">
          <div className="so-print-signatures__line" />
          <p>Checked by</p>
        </div>
        <div className="so-print-signatures__block">
          <div className="so-print-signatures__line" />
          <p>{company.authorizedPerson}</p>
          <p className="so-print-signatures__role">{company.designation}</p>
        </div>
      </div>

      <footer className="so-print-doc__footer">
        <span>{company.legalName}</span>
        <span>This is a computer-generated sales order</span>
      </footer>
    </article>
  )
}
