import {
  Building2, Mail, MapPin, Phone, User, Briefcase, CreditCard,
} from 'lucide-react'
import type { Customer } from '../../types/master'
import type { CrmCompanyStatus } from '../../utils/crmCompanyStatus'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { CompanyCustomerBadge } from '../masters/CompanyCustomerBadge'

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export function Customer360Hero({
  customer,
  status,
  onCall,
  onEmail,
}: {
  customer: Customer
  status?: CrmCompanyStatus
  onCall?: () => void
  onEmail?: () => void
}) {
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
              <span><MapPin className="h-3.5 w-3.5" />{customer.city}, {customer.state}</span>
              <span><Briefcase className="h-3.5 w-3.5" />{customer.salesTerritory} territory</span>
              <span><User className="h-3.5 w-3.5" />{customer.contactPerson}</span>
            </div>
          </div>
        </div>

        <div className="customer-360-hero__contact-card">
          <p className="customer-360-hero__contact-title">
            <Building2 className="h-4 w-4" />
            Primary contact
          </p>
          <p className="customer-360-hero__contact-name">{customer.contactPerson}</p>
          <div className="customer-360-hero__contact-lines">
            {customer.contactPhone ? (
              <button type="button" className="customer-360-hero__contact-link" onClick={onCall ?? (() => window.open(`tel:${customer.contactPhone}`))}>
                <Phone className="h-3.5 w-3.5" />
                {customer.contactPhone}
              </button>
            ) : null}
            {customer.contactEmail ? (
              <button type="button" className="customer-360-hero__contact-link" onClick={onEmail ?? (() => window.open(`mailto:${customer.contactEmail}`))}>
                <Mail className="h-3.5 w-3.5" />
                {customer.contactEmail}
              </button>
            ) : null}
          </div>
          {customer.gstin ? (
            <p className="customer-360-hero__gst">
              <CreditCard className="h-3.5 w-3.5" />
              GSTIN {customer.gstin}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
