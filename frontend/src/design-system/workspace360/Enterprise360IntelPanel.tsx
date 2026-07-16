import { Link } from 'react-router-dom'
import { Building2, FileText, Receipt, ShoppingCart, TrendingUp } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters/currency'
import type { Enterprise360RelatedLink } from './types'

export interface Enterprise360IntelProps {
  companyName?: string
  opportunities: Enterprise360RelatedLink[]
  quotations: Enterprise360RelatedLink[]
  salesOrders: Enterprise360RelatedLink[]
  invoices: Enterprise360RelatedLink[]
  outstandingAmount?: number
  creditLimit?: number
  paymentBehaviour?: string
  openOrdersCount?: number
}

export function Enterprise360IntelPanel({
  companyName,
  opportunities,
  quotations,
  salesOrders,
  invoices,
  outstandingAmount,
  creditLimit,
  paymentBehaviour,
  openOrdersCount,
}: Enterprise360IntelProps) {
  const hasRecords =
    opportunities.length > 0 ||
    quotations.length > 0 ||
    salesOrders.length > 0 ||
    invoices.length > 0

  if (!companyName && !hasRecords && outstandingAmount == null) return null

  return (
    <section className="ent-360-intel" aria-label="Customer intelligence">
      <div className="ent-360-intel__head">
        <Building2 className="h-4 w-4" />
        <h2 className="ent-360-intel__title">Customer Intelligence</h2>
        {companyName ? <span className="ent-360-intel__company">{companyName}</span> : null}
      </div>

      <div className="ent-360-intel__finance">
        {outstandingAmount != null ? (
          <div className="ent-360-intel__stat">
            <span className="ent-360-intel__stat-label">Outstanding</span>
            <span className="ent-360-intel__stat-value">{formatCurrency(outstandingAmount)}</span>
          </div>
        ) : null}
        {creditLimit != null ? (
          <div className="ent-360-intel__stat">
            <span className="ent-360-intel__stat-label">Credit Limit</span>
            <span className="ent-360-intel__stat-value">{formatCurrency(creditLimit)}</span>
          </div>
        ) : null}
        {paymentBehaviour ? (
          <div className="ent-360-intel__stat">
            <span className="ent-360-intel__stat-label">Payment Behaviour</span>
            <span className="ent-360-intel__stat-value">{paymentBehaviour}</span>
          </div>
        ) : null}
        {openOrdersCount != null ? (
          <div className="ent-360-intel__stat">
            <span className="ent-360-intel__stat-label">Open Orders</span>
            <span className="ent-360-intel__stat-value">{openOrdersCount}</span>
          </div>
        ) : null}
      </div>

      <IntelGroup icon={TrendingUp} title="Opportunities" items={opportunities} />
      <IntelGroup icon={FileText} title="Quotations" items={quotations} />
      <IntelGroup icon={ShoppingCart} title="Sales Orders" items={salesOrders} />
      <IntelGroup icon={Receipt} title="Invoices" items={invoices} />
    </section>
  )
}

function IntelGroup({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof TrendingUp
  title: string
  items: Enterprise360RelatedLink[]
}) {
  if (!items.length) return null
  return (
    <div className="ent-360-intel__group">
      <p className="ent-360-intel__group-title">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <ul className="ent-360-intel__links">
        {items.map((item) => (
          <li key={item.id}>
            {item.href ? (
              <Link to={item.href} className="ent-360-intel__link">
                <span>{item.label}</span>
                {item.subtitle ? <span className="ent-360-intel__link-sub">{item.subtitle}</span> : null}
                {item.value ? <span className="ent-360-intel__link-val">{item.value}</span> : null}
              </Link>
            ) : (
              <span className="ent-360-intel__link ent-360-intel__link--static">
                <span>{item.label}</span>
                {item.value ? <span className="ent-360-intel__link-val">{item.value}</span> : null}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
