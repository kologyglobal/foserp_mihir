import {
  Building2,
  Mail,
  MapPin,
  Phone,
  User,
  Briefcase,
  CreditCard,
  ExternalLink,
} from 'lucide-react'
import type { Customer } from '../../types/master'
import type { CrmCompanyStatus } from '../../utils/crmCompanyStatus'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { CompanyCustomerBadge } from '../masters/CompanyCustomerBadge'

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export type Customer360HeroStat = {
  label: string
  value: string
  tone?: 'default' | 'warning' | 'success'
}

export function Customer360Hero({
  customer,
  status,
  stats,
  onCall,
  onEmail,
  onEdit,
}: {
  customer: Customer
  status?: CrmCompanyStatus
  stats?: Customer360HeroStat[]
  onCall?: () => void
  onEmail?: () => void
  onEdit?: () => void
}) {
  const address = [customer.city, customer.state].filter(Boolean).join(', ')

  return (
    <section className="customer-360-hero" aria-label="Company profile">
      <div className="customer-360-hero__glow" aria-hidden />
      <div className="customer-360-hero__inner">
        <div className="customer-360-hero__identity">
          <div className="customer-360-hero__avatar" aria-hidden>
            {initials(customer.customerName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="customer-360-hero__badges">
              <CompanyCustomerBadge company={customer} />
              {status ? <DynamicsStatusChip label={status.label} tone={status.tone} /> : null}
              <span className="customer-360-hero__type">{customer.customerType}</span>
            </div>
            <h2 className="customer-360-hero__name">{customer.customerName}</h2>
            <p className="customer-360-hero__code">{customer.customerCode}</p>
            <div className="customer-360-hero__meta">
              {address ? (
                <span>
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {address}
                </span>
              ) : null}
              {customer.salesTerritory ? (
                <span>
                  <Briefcase className="h-3.5 w-3.5" aria-hidden />
                  {customer.salesTerritory} territory
                </span>
              ) : null}
              {customer.contactPerson ? (
                <span>
                  <User className="h-3.5 w-3.5" aria-hidden />
                  {customer.contactPerson}
                </span>
              ) : null}
            </div>
            <div className="customer-360-hero__actions">
              {customer.contactPhone ? (
                <button
                  type="button"
                  className="customer-360-hero__action"
                  onClick={onCall ?? (() => window.open(`tel:${customer.contactPhone}`))}
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Call
                </button>
              ) : null}
              {customer.contactEmail ? (
                <button
                  type="button"
                  className="customer-360-hero__action"
                  onClick={onEmail ?? (() => window.open(`mailto:${customer.contactEmail}`))}
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  Email
                </button>
              ) : null}
              {onEdit ? (
                <button type="button" className="customer-360-hero__action customer-360-hero__action--ghost" onClick={onEdit}>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Edit master
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="customer-360-hero__contact-card">
          <p className="customer-360-hero__contact-title">
            <Building2 className="h-4 w-4" aria-hidden />
            Primary contact
          </p>
          <p className="customer-360-hero__contact-name">{customer.contactPerson || '—'}</p>
          <div className="customer-360-hero__contact-lines">
            {customer.contactPhone ? (
              <button
                type="button"
                className="customer-360-hero__contact-link"
                onClick={onCall ?? (() => window.open(`tel:${customer.contactPhone}`))}
              >
                <Phone className="h-3.5 w-3.5" aria-hidden />
                {customer.contactPhone}
              </button>
            ) : (
              <span className="customer-360-hero__contact-muted">No phone on file</span>
            )}
            {customer.contactEmail ? (
              <button
                type="button"
                className="customer-360-hero__contact-link"
                onClick={onEmail ?? (() => window.open(`mailto:${customer.contactEmail}`))}
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {customer.contactEmail}
              </button>
            ) : (
              <span className="customer-360-hero__contact-muted">No email on file</span>
            )}
          </div>
          {customer.gstin ? (
            <p className="customer-360-hero__gst">
              <CreditCard className="h-3.5 w-3.5" aria-hidden />
              GSTIN {customer.gstin}
            </p>
          ) : null}
        </aside>
      </div>

      {stats && stats.length > 0 ? (
        <div className="customer-360-hero__stats" role="group" aria-label="Company snapshot">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`customer-360-hero__stat${stat.tone ? ` customer-360-hero__stat--${stat.tone}` : ''}`}
            >
              <span className="customer-360-hero__stat-label">{stat.label}</span>
              <span className="customer-360-hero__stat-value">{stat.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
