/**
 * Business card field model + OCR confidence (mobile M3.2).
 */

export type BusinessCardFieldKey =
  | 'firstName'
  | 'lastName'
  | 'company'
  | 'designation'
  | 'mobile'
  | 'alternateMobile'
  | 'email'
  | 'website'
  | 'address'
  | 'city'
  | 'state'
  | 'country'
  | 'pincode'
  | 'gstin'
  | 'linkedin'

export interface BusinessCardField {
  key: BusinessCardFieldKey
  value: string
  /** 0–100 heuristic confidence */
  confidence: number
  uncertain?: boolean
}

export interface BusinessCardFields {
  firstName: string
  lastName: string
  company: string
  designation: string
  mobile: string
  alternateMobile: string
  email: string
  website: string
  address: string
  city: string
  state: string
  country: string
  pincode: string
  gstin: string
  linkedin: string
}

export type BusinessCardConfidence = Partial<Record<BusinessCardFieldKey, number>>

export interface ParsedBusinessCard {
  fields: BusinessCardFields
  confidence: BusinessCardConfidence
  rawText: string
  lines: string[]
}

export type BusinessCardSaveMode =
  | 'create_lead'
  | 'create_company_contact'
  | 'add_contact_existing'
  | 'draft'

export const EMPTY_BUSINESS_CARD_FIELDS: BusinessCardFields = {
  firstName: '',
  lastName: '',
  company: '',
  designation: '',
  mobile: '',
  alternateMobile: '',
  email: '',
  website: '',
  address: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
  gstin: '',
  linkedin: '',
}

export const FIELD_LABELS: Record<BusinessCardFieldKey, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  company: 'Company',
  designation: 'Designation',
  mobile: 'Mobile',
  alternateMobile: 'Alt. mobile',
  email: 'Email',
  website: 'Website',
  address: 'Address',
  city: 'City',
  state: 'State',
  country: 'Country',
  pincode: 'PIN',
  gstin: 'GSTIN',
  linkedin: 'LinkedIn',
}

export function isUncertain(confidence: number | undefined, threshold = 75): boolean {
  if (confidence == null) return true
  return confidence < threshold
}

export function personDisplayName(f: BusinessCardFields): string {
  return [f.firstName, f.lastName].filter(Boolean).join(' ').trim()
}
