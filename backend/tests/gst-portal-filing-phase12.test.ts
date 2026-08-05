/**
 * Phase 12 — GSTR portal filing foundation unit tests (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  assertLiveGstrFilingConfigured,
  buildFilingPackageEnvelope,
  canCaptureArn,
  canCreateFilingPackage,
  canMarkFiledFromSession,
  canSubmitFiling,
  getPortalFilingCapabilitySummary,
  resolveGstrFilingProviderMode,
  simulatePortalSubmit,
} from '../src/modules/accounting/tax-compliance/gstr-portal-filing.util.js'

describe('resolveGstrFilingProviderMode', () => {
  it('defaults to SIMULATED', () => {
    expect(resolveGstrFilingProviderMode({})).toBe('SIMULATED')
  })
  it('accepts LIVE only when explicitly set', () => {
    expect(resolveGstrFilingProviderMode({ GST_PORTAL_FILING_PROVIDER_MODE: 'LIVE' })).toBe('LIVE')
    expect(resolveGstrFilingProviderMode({ GST_PORTAL_FILING_PROVIDER_MODE: 'live' })).toBe('LIVE')
    expect(resolveGstrFilingProviderMode({ GST_PORTAL_FILING_PROVIDER_MODE: 'sim' })).toBe('SIMULATED')
  })
})

describe('assertLiveGstrFilingConfigured', () => {
  it('blocks LIVE without UAT and credentials', () => {
    const r = assertLiveGstrFilingConfigured({ GST_PORTAL_FILING_PROVIDER_MODE: 'LIVE' })
    expect(r.ready).toBe(false)
    expect(r.blockers.length).toBeGreaterThan(2)
  })
  it('still blocks without HTTP transport flag', () => {
    const r = assertLiveGstrFilingConfigured({
      GST_PORTAL_FILING_LIVE_UAT_CERTIFIED: 'true',
      GST_PORTAL_FILING_API_BASE_URL: 'https://example.test',
      GST_PORTAL_FILING_USERNAME: 'u',
      GST_PORTAL_FILING_PASSWORD: 'p',
      GST_PORTAL_FILING_CLIENT_ID: 'c',
      GST_PORTAL_FILING_CLIENT_SECRET: 's',
    })
    expect(r.ready).toBe(false)
    expect(r.blockers.some((b) => b.includes('HTTP_TRANSPORT_READY'))).toBe(true)
  })
  it('ready only when UAT + credentials + transport-ready flag are all set', () => {
    const r = assertLiveGstrFilingConfigured({
      GST_PORTAL_FILING_LIVE_UAT_CERTIFIED: 'true',
      GST_PORTAL_FILING_HTTP_TRANSPORT_READY: 'true',
      GST_PORTAL_FILING_API_BASE_URL: 'https://example.test',
      GST_PORTAL_FILING_USERNAME: 'u',
      GST_PORTAL_FILING_PASSWORD: 'p',
      GST_PORTAL_FILING_CLIENT_ID: 'c',
      GST_PORTAL_FILING_CLIENT_SECRET: 's',
    })
    expect(r.ready).toBe(true)
  })
})

describe('filing session state gates', () => {
  it('allows package only from LOCKED return', () => {
    expect(canCreateFilingPackage('LOCKED')).toBe(true)
    expect(canCreateFilingPackage('DRAFT')).toBe(false)
    expect(canCreateFilingPackage('OPEN')).toBe(false)
    expect(canCreateFilingPackage('MARKED_FILED_EXTERNAL')).toBe(false)
  })
  it('allows submit from package ready / retry', () => {
    expect(canSubmitFiling('PACKAGE_READY')).toBe(true)
    expect(canSubmitFiling('PENDING_CHECKER')).toBe(false)
    expect(canSubmitFiling('FAILED')).toBe(true)
    expect(canSubmitFiling('LIVE_BLOCKED')).toBe(true)
    expect(canSubmitFiling('MARKED_FILED')).toBe(false)
    expect(canSubmitFiling('DRAFT')).toBe(false)
  })
  it('allows ARN capture and mark-filed after accept', () => {
    expect(canCaptureArn('ACCEPTED_SIMULATED')).toBe(true)
    expect(canMarkFiledFromSession('ACCEPTED_SIMULATED')).toBe(true)
    expect(canMarkFiledFromSession('MARKED_FILED')).toBe(false)
  })
})

describe('simulatePortalSubmit', () => {
  it('builds deterministic SIM-ARN and honest response mode', () => {
    const a = simulatePortalSubmit({
      returnType: 'GSTR1',
      returnPeriod: '2026-07',
      companyGstin: '27AAAAA0000A1Z5',
      packageVersion: 1,
      snapshotHash: 'abc',
    })
    const b = simulatePortalSubmit({
      returnType: 'GSTR1',
      returnPeriod: '2026-07',
      companyGstin: '27AAAAA0000A1Z5',
      packageVersion: 1,
      snapshotHash: 'abc',
    })
    expect(a.acknowledgmentRef).toMatch(/^SIM-ARN-G1-/)
    expect(a.acknowledgmentRef).toBe(b.acknowledgmentRef)
    expect(a.response.mode).toBe('SIMULATED')
    expect(String(a.response.note)).toMatch(/not submitted/i)
  })
})

describe('buildFilingPackageEnvelope', () => {
  it('embeds snapshot hash and SIMULATED readiness label', () => {
    const env = buildFilingPackageEnvelope({
      returnType: 'GSTR3B',
      returnPeriod: '2026-07',
      companyGstin: '27AAAAA0000A1Z5',
      legalEntityId: 'le-1',
      snapshot: { netPayable: 100 },
      draftVersion: 2,
      packagedAt: '2026-08-05T00:00:00.000Z',
    })
    expect(env.readinessLabel).toBe('GST_PORTAL_FILING_SIMULATED')
    expect(env.returnType).toBe('GSTR-3B')
    expect(typeof env.snapshotHash).toBe('string')
    expect(String(env.disclaimer)).toMatch(/Not FULL GST COMPLIANT/)
  })
})

describe('getPortalFilingCapabilitySummary', () => {
  it('reports SIMULATED verdict honestly', () => {
    const s = getPortalFilingCapabilitySummary({})
    expect(s.providerMode).toBe('SIMULATED')
    expect(s.isSimulated).toBe(true)
    expect(s.notFullGstCompliant).toBe(true)
    expect(s.verdict).toBe('READY_WITH_CONDITIONS')
  })
})
