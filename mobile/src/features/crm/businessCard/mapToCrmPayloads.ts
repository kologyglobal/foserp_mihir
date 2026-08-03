/**
 * Map business card fields → CRM create payloads (existing APIs only).
 */

import type { BusinessCardFields } from './types'
import { personDisplayName } from './types'

export function toLeadPayload(
  fields: BusinessCardFields,
  extras?: { leadOwnerId?: string | null; source?: string },
): Record<string, unknown> {
  const name = personDisplayName(fields) || fields.company || 'Business card lead'
  return {
    prospectName: name,
    companyName: fields.company || undefined,
    contactPerson: personDisplayName(fields) || undefined,
    designation: fields.designation || undefined,
    mobile: fields.mobile || null,
    email: fields.email || null,
    remarks: [
      fields.address && `Address: ${fields.address}`,
      fields.website && `Web: ${fields.website}`,
      fields.linkedin && `LinkedIn: ${fields.linkedin}`,
      fields.gstin && `GSTIN: ${fields.gstin}`,
      fields.alternateMobile && `Alt mobile: ${fields.alternateMobile}`,
    ]
      .filter(Boolean)
      .join('\n') || null,
    source: extras?.source || 'other',
    priority: 'medium',
    leadOwnerId: extras?.leadOwnerId ?? null,
    industry: undefined,
  }
}

export function toCompanyPayload(
  fields: BusinessCardFields,
  extras?: { ownerId?: string },
): Record<string, unknown> {
  return {
    customerName: fields.company || personDisplayName(fields) || 'Business card company',
    customerType: 'corporate',
    phone: fields.mobile || undefined,
    email: fields.email || undefined,
    website: fields.website || undefined,
    addressLine1: fields.address || undefined,
    city: fields.city || undefined,
    state: fields.state || undefined,
    pincode: fields.pincode || undefined,
    country: fields.country || 'India',
    gstin: fields.gstin || undefined,
    contactPerson: personDisplayName(fields) || undefined,
    contactPhone: fields.mobile || undefined,
    contactEmail: fields.email || undefined,
    source: 'business_card',
    ownerId: extras?.ownerId,
    notes: fields.linkedin ? `LinkedIn: ${fields.linkedin}` : undefined,
  }
}

export function toContactPayload(
  fields: BusinessCardFields,
  customerId: string,
  extras?: { ownerId?: string },
): Record<string, unknown> {
  const name = personDisplayName(fields) || fields.email || fields.mobile || 'Contact'
  return {
    customerId,
    name,
    designation: fields.designation || undefined,
    email: fields.email || undefined,
    phone: fields.mobile || undefined,
    alternatePhone: fields.alternateMobile || undefined,
    linkedInUrl: fields.linkedin || undefined,
    notes: [
      fields.address && `Address: ${fields.address}`,
      fields.website && `Web: ${fields.website}`,
    ]
      .filter(Boolean)
      .join('\n') || undefined,
    isPrimary: false,
    ownerId: extras?.ownerId,
  }
}
