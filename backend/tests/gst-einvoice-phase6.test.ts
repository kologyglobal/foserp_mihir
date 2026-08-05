/**
 * Phase 6 — e-Invoice readiness / plan unit tests (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  assertLiveEInvoiceConfigured,
  checkEInvoiceReadiness,
  planEInvoiceGenerate,
  resolveEInvoiceProviderMode,
} from '../src/modules/accounting/tax-compliance/einvoice-readiness.util.js'

describe('resolveEInvoiceProviderMode', () => {
  it('defaults to SIMULATED', () => {
    expect(resolveEInvoiceProviderMode({})).toBe('SIMULATED')
  })
  it('prefers GST_EINVOICE_PROVIDER_MODE over GST_NIC_PROVIDER', () => {
    expect(
      resolveEInvoiceProviderMode({
        GST_EINVOICE_PROVIDER_MODE: 'SIMULATED',
        GST_NIC_PROVIDER: 'LIVE',
      }),
    ).toBe('SIMULATED')
    expect(
      resolveEInvoiceProviderMode({
        GST_EINVOICE_PROVIDER_MODE: 'LIVE',
        GST_NIC_PROVIDER: 'SIMULATED',
      }),
    ).toBe('LIVE')
  })
  it('falls back to GST_NIC_PROVIDER', () => {
    expect(resolveEInvoiceProviderMode({ GST_NIC_PROVIDER: 'live' })).toBe('LIVE')
  })
})

describe('assertLiveEInvoiceConfigured', () => {
  it('blocks LIVE without UAT certification and credentials', () => {
    const r = assertLiveEInvoiceConfigured({ GST_EINVOICE_PROVIDER_MODE: 'LIVE' })
    expect(r.ready).toBe(false)
    expect(r.blockers.length).toBeGreaterThan(2)
  })
  it('still blocks when credentials set without transport-ready connector flag', () => {
    const r = assertLiveEInvoiceConfigured({
      GST_EINVOICE_LIVE_UAT_CERTIFIED: 'true',
      GST_EINVOICE_API_BASE_URL: 'https://example.test',
      GST_EINVOICE_USERNAME: 'u',
      GST_EINVOICE_PASSWORD: 'p',
      GST_EINVOICE_CLIENT_ID: 'c',
      GST_EINVOICE_CLIENT_SECRET: 's',
    })
    expect(r.ready).toBe(false)
    expect(r.blockers.some((b) => b.includes('HTTP_TRANSPORT_READY'))).toBe(true)
  })
  it('ready only when UAT + credentials + connector-ready flag are all set', () => {
    const r = assertLiveEInvoiceConfigured({
      GST_EINVOICE_LIVE_UAT_CERTIFIED: 'true',
      GST_EINVOICE_HTTP_TRANSPORT_READY: 'true',
      GST_EINVOICE_API_BASE_URL: 'https://example.test',
      GST_EINVOICE_USERNAME: 'u',
      GST_EINVOICE_PASSWORD: 'p',
      GST_EINVOICE_CLIENT_ID: 'c',
      GST_EINVOICE_CLIENT_SECRET: 's',
    })
    expect(r.ready).toBe(true)
  })
})

describe('checkEInvoiceReadiness', () => {
  const base = {
    salesInvoiceStatus: 'POSTED',
    legalEntityGstin: '27AAAAA0000A1Z5',
    customerGstin: '27BBBBB0000B1Z5',
    invoiceNumber: 'SI-1',
  }
  it('accepts posted B2B SI', () => {
    expect(checkEInvoiceReadiness(base)).toEqual({ ok: true })
  })
  it('requires POSTED', () => {
    const r = checkEInvoiceReadiness({ ...base, salesInvoiceStatus: 'DRAFT' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('NOT_POSTED')
  })
  it('requires customer GSTIN', () => {
    const r = checkEInvoiceReadiness({ ...base, customerGstin: null })
    expect(r.ok).toBe(false)
  })
})

describe('planEInvoiceGenerate', () => {
  it('returns CREATE when no row', () => {
    expect(planEInvoiceGenerate({ existing: null }).action).toBe('CREATE')
  })
  it('idempotent when GENERATED', () => {
    expect(
      planEInvoiceGenerate({
        existing: { status: 'GENERATED', irn: 'ABC', idempotencyKey: 'k1' },
        requestIdempotencyKey: 'k1',
      }).action,
    ).toBe('IDEMPOTENT_RETURN')
  })
  it('blocks cancelled regenerate', () => {
    const p = planEInvoiceGenerate({
      existing: { status: 'CANCELLED', irn: 'X' },
    })
    expect(p.action).toBe('BLOCK')
  })
  it('retries EXCEPTION', () => {
    expect(
      planEInvoiceGenerate({
        existing: { status: 'EXCEPTION', irn: null },
      }).action,
    ).toBe('RETRY')
  })
  it('blocks idempotency key clash after generate', () => {
    const p = planEInvoiceGenerate({
      existing: { status: 'GENERATED', irn: 'ABC', idempotencyKey: 'k1' },
      requestIdempotencyKey: 'k2',
    })
    expect(p.action).toBe('BLOCK')
  })
})
