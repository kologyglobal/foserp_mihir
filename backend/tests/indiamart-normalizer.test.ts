import { describe, expect, it } from 'vitest'
import {
  buildDedupeFingerprint,
  normalizeCompanyName,
  normalizeEmail,
  normalizeIndiaMartEnquiry,
  normalizeMobile,
  parseIndiaMartDate,
} from '../src/modules/crm/integrations/indiamart/indiamart.normalizer.js'
import { assertSafeIndiaMartUrl } from '../src/modules/crm/integrations/indiamart/indiamart.ssrf.js'
import { IndiaMartError } from '../src/modules/crm/integrations/indiamart/indiamart.errors.js'

describe('IndiaMART normalizer', () => {
  it('normalizes Indian mobiles with spaces/dashes', () => {
    expect(normalizeMobile('+91 98765-43210')).toBe('919876543210')
    expect(normalizeMobile('09876543210')).toBe('919876543210')
    expect(normalizeMobile('9876543210')).toBe('919876543210')
  })

  it('preserves international mobiles', () => {
    expect(normalizeMobile('+14155552671')).toBe('14155552671')
  })

  it('normalizes email case and rejects invalid', () => {
    expect(normalizeEmail('  Buyer@Example.COM ')).toBe('buyer@example.com')
    expect(normalizeEmail('not-an-email')).toBeNull()
  })

  it('normalizes company suffixes', () => {
    expect(normalizeCompanyName('Acme Pvt. Ltd.')).toBe('acme')
    expect(normalizeCompanyName('Acme Private Limited')).toBe('acme')
  })

  it('builds fingerprint', () => {
    const fp = buildDedupeFingerprint({
      normalizedMobile: '919876543210',
      normalizedEmail: 'a@b.com',
      normalizedCompanyName: 'acme',
      productName: 'ISO Tank',
      enquiryDate: new Date('2026-07-01T00:00:00Z'),
    })
    expect(fp).toContain('919876543210')
    expect(fp).toContain('2026-07-01')
  })

  it('requires UNIQUE_QUERY_ID', () => {
    expect(() => normalizeIndiaMartEnquiry({ SENDER_NAME: 'Buyer' })).toThrow(IndiaMartError)
  })

  it('maps documented Pull API fields', () => {
    const n = normalizeIndiaMartEnquiry({
      UNIQUE_QUERY_ID: 'Q-100',
      QUERY_TIME: '01-Jan-2026',
      SENDER_NAME: 'Ravi',
      SENDER_MOBILE: '9876543210',
      SENDER_EMAIL: 'ravi@example.com',
      SENDER_COUNTRY_ISO: 'IN',
      QUERY_MESSAGE: 'Need flour bulker',
      QUERY_PRODUCT_NAME: 'Flour Bulker',
      QUERY_TYPE: 'W',
    })
    expect(n.externalEnquiryId).toBe('Q-100')
    expect(n.buyerName).toBe('Ravi')
    expect(n.productName).toBe('Flour Bulker')
    expect(n.sourceType).toBe('W')
  })

  it('parses IndiaMART date formats', () => {
    expect(parseIndiaMartDate('01-Jan-2026')).toBeInstanceOf(Date)
    expect(parseIndiaMartDate('01-01-202616:30:00')).toBeInstanceOf(Date)
  })
})

describe('IndiaMART SSRF guard', () => {
  it('allows mapi.indiamart.com over https', () => {
    const url = assertSafeIndiaMartUrl('https://mapi.indiamart.com')
    expect(url.hostname).toBe('mapi.indiamart.com')
  })

  it('blocks non-approved hosts and http', () => {
    expect(() => assertSafeIndiaMartUrl('https://evil.example.com')).toThrow(IndiaMartError)
    expect(() => assertSafeIndiaMartUrl('http://mapi.indiamart.com')).toThrow(IndiaMartError)
  })
})
