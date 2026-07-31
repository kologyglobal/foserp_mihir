import { describe, expect, it } from 'vitest'
import {
  formatCustomerDetailsFromMap,
  resolveCustomerDetailsPrintContent,
} from './customerDetails'

const map = {
  customer_name: 'Acme Logistics Pvt Ltd',
  customer_address: 'Pune, Maharashtra',
  contact_person: 'Rajesh Kumar',
  contact_mobile: '9876543210',
  contact_email: 'rajesh@acme.in',
}

describe('resolveCustomerDetailsPrintContent', () => {
  it('resolves template placeholders', () => {
    const content = 'To,\n{{customer_name}}\nKind Attn: {{contact_person}}\nMobile: {{contact_mobile}}'
    expect(resolveCustomerDetailsPrintContent(content, map)).toContain('Acme Logistics Pvt Ltd')
    expect(resolveCustomerDetailsPrintContent(content, map)).toContain('Rajesh Kumar')
    expect(resolveCustomerDetailsPrintContent(content, map)).toContain('9876543210')
  })

  it('replaces legacy UUID + Sales owner rows from merge map', () => {
    const legacy = [
      '7f3bb3cc-8184-4606-94ef-6ce9fdcaa0eb',
      'Contact: —',
      'Sales owner: Super Admin',
    ].join('\n')
    const resolved = resolveCustomerDetailsPrintContent(legacy, map, 'Super Admin')
    expect(resolved).toContain('Acme Logistics Pvt Ltd')
    expect(resolved).toContain('Contact: Rajesh Kumar')
    expect(resolved).toContain('Mobile: 9876543210')
    expect(resolved).toContain('Sales owner: Super Admin')
    expect(resolved).not.toContain('7f3bb3cc')
  })
})

describe('formatCustomerDetailsFromMap', () => {
  it('includes sales owner when provided', () => {
    expect(formatCustomerDetailsFromMap(map, 'Super Admin')).toContain('Sales owner: Super Admin')
  })
})
