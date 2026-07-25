import { describe, expect, it } from 'vitest'
import {
  computeSlaStatus,
  extractPushLeadPayload,
} from '../src/modules/crm/integrations/indiamart/indiamart.ingest.js'
import {
  generateWebhookToken,
  hashWebhookToken,
  buildWebhookUrl,
} from '../src/modules/crm/integrations/indiamart/indiamart.webhook.js'

describe('IndiaMART push payload extract', () => {
  it('unwraps RESPONSE object', () => {
    const lead = extractPushLeadPayload({
      CODE: '200',
      STATUS: 'SUCCESS',
      RESPONSE: { UNIQUE_QUERY_ID: 'Q1', SENDER_NAME: 'A' },
    }) as Record<string, unknown>
    expect(lead.UNIQUE_QUERY_ID).toBe('Q1')
  })

  it('accepts top-level lead fields', () => {
    const lead = extractPushLeadPayload({
      UNIQUE_QUERY_ID: 'Q2',
      SENDER_MOBILE: '9876543210',
    }) as Record<string, unknown>
    expect(lead.UNIQUE_QUERY_ID).toBe('Q2')
  })

  it('unwraps body.RESPONSE', () => {
    const lead = extractPushLeadPayload({
      body: { RESPONSE: { unique_query_id: 'Q3' } },
    }) as Record<string, unknown>
    expect(lead.unique_query_id).toBe('Q3')
  })
})

describe('IndiaMART SLA status', () => {
  it('returns CONTACTED when firstContactedAt is set', () => {
    expect(computeSlaStatus(new Date(), new Date(), {})).toBe('CONTACTED')
  })

  it('marks OVERDUE after escalation window', () => {
    const received = new Date(Date.now() - 3 * 60 * 60_000)
    expect(
      computeSlaStatus(received, null, { firstResponseSlaMinutes: 30, escalationSlaMinutes: 120 }),
    ).toBe('OVERDUE')
  })

  it('marks DUE_SOON near first-response SLA', () => {
    const received = new Date(Date.now() - 26 * 60_000)
    expect(
      computeSlaStatus(received, null, { firstResponseSlaMinutes: 30, escalationSlaMinutes: 120 }),
    ).toBe('DUE_SOON')
  })

  it('marks WITHIN_SLA for fresh enquiries', () => {
    const received = new Date(Date.now() - 5 * 60_000)
    expect(
      computeSlaStatus(received, null, { firstResponseSlaMinutes: 30, escalationSlaMinutes: 120 }),
    ).toBe('WITHIN_SLA')
  })
})

describe('IndiaMART webhook token helpers', () => {
  it('hashes tokens stably with sha256 hex', () => {
    const a = hashWebhookToken('secret-token')
    const b = hashWebhookToken('secret-token')
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
    expect(hashWebhookToken('other')).not.toBe(a)
  })

  it('generates opaque token with matching hash and prefix', () => {
    const generated = generateWebhookToken()
    expect(generated.token.length).toBeGreaterThan(16)
    expect(generated.prefix).toBe(generated.token.slice(0, 8))
    expect(generated.hash).toBe(hashWebhookToken(generated.token))
  })

  it('builds public webhook URL', () => {
    expect(
      buildWebhookUrl({
        publicBaseUrl: 'https://erp.example.com/',
        tenantSlug: 'acme',
        token: 'tok_abc',
      }),
    ).toBe('https://erp.example.com/api/v1/webhooks/indiamart/acme/tok_abc')
  })
})
