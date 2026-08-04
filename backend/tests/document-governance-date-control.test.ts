/**
 * Document Governance — pure unit tests (no DB).
 * Proves defaults / CURRENT_BEHAVIOUR / feature-flag-off preserve current behaviour.
 * No CRM/Purchase document flows are exercised (none wired).
 */
import { describe, expect, it } from 'vitest'
import type { DocumentDatePolicy } from '@prisma/client'
import {
  evaluateDocumentDatePolicy,
  resolveEffectivePolicyFromCandidates,
  scorePolicyScope,
  mapRowToEffective,
} from '../src/modules/document-governance/document-date-policy.service.js'
import {
  DOCUMENT_GOVERNANCE_REGISTRY,
  isRegisteredDocument,
  listDocumentTypes,
} from '../src/modules/document-governance/document-registry.js'
import type { EffectiveDocumentDatePolicy } from '../src/modules/document-governance/document-date-policy.types.js'

function basePolicy(
  overrides: Partial<EffectiveDocumentDatePolicy> = {},
): EffectiveDocumentDatePolicy {
  return {
    id: 'pol-1',
    tenantId: 't1',
    legalEntityId: null,
    branchId: null,
    moduleKey: 'crm',
    documentType: 'QUOTATION',
    policyEnabled: false,
    futureDateMode: 'CURRENT_BEHAVIOUR',
    pastDateMode: 'CURRENT_BEHAVIOUR',
    maxFutureDays: null,
    maxBackDateDays: null,
    approvalRequired: false,
    allowEmergencyOverride: false,
    policyProfile: null,
    profileId: null,
    effectiveFrom: null,
    effectiveTo: null,
    active: true,
    scope: 'TENANT',
    featureFlagEnabled: true,
    ...overrides,
  }
}

function row(partial: Partial<DocumentDatePolicy> & Pick<DocumentDatePolicy, 'id'>): DocumentDatePolicy {
  const now = new Date('2026-08-01T00:00:00.000Z')
  return {
    tenantId: 't1',
    legalEntityId: null,
    branchId: null,
    moduleKey: 'crm',
    documentType: 'QUOTATION',
    policyEnabled: false,
    futureDateMode: 'CURRENT_BEHAVIOUR',
    pastDateMode: 'CURRENT_BEHAVIOUR',
    maxFutureDays: null,
    maxBackDateDays: null,
    approvalRequired: false,
    allowEmergencyOverride: false,
    policyProfile: null,
    profileId: null,
    effectiveFrom: null,
    effectiveTo: null,
    active: true,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

describe('document registry', () => {
  it('lists CRM and Purchase document types', () => {
    expect(DOCUMENT_GOVERNANCE_REGISTRY.length).toBeGreaterThanOrEqual(10)
    expect(isRegisteredDocument('crm', 'QUOTATION')).toBe(true)
    expect(isRegisteredDocument('purchase', 'PURCHASE_ORDER')).toBe(true)
    expect(isRegisteredDocument('crm', 'UNKNOWN')).toBe(false)
    expect(listDocumentTypes('purchase').every((e) => e.moduleKey === 'purchase')).toBe(true)
  })
})

describe('evaluateDocumentDatePolicy — safe defaults', () => {
  it('returns currentBehavior when policyEnabled is false', () => {
    const result = evaluateDocumentDatePolicy({
      policy: basePolicy({ policyEnabled: false, futureDateMode: 'BLOCK' }),
      documentDate: '2026-08-10',
      businessDate: '2026-08-01',
    })
    expect(result.currentBehavior).toBe(true)
    expect(result.allowed).toBe(true)
    expect(result.blocked).toBe(false)
    expect(result.requiresApproval).toBe(false)
  })

  it('returns currentBehavior when feature flag is OFF', () => {
    const result = evaluateDocumentDatePolicy({
      policy: basePolicy({
        policyEnabled: true,
        featureFlagEnabled: false,
        futureDateMode: 'BLOCK',
      }),
      documentDate: '2026-08-10',
      businessDate: '2026-08-01',
    })
    expect(result.currentBehavior).toBe(true)
    expect(result.allowed).toBe(true)
  })

  it('returns currentBehavior when modes are CURRENT_BEHAVIOUR', () => {
    const result = evaluateDocumentDatePolicy({
      policy: basePolicy({
        policyEnabled: true,
        featureFlagEnabled: true,
        futureDateMode: 'CURRENT_BEHAVIOUR',
        pastDateMode: 'CURRENT_BEHAVIOUR',
      }),
      documentDate: '2026-08-10',
      businessDate: '2026-08-01',
    })
    expect(result.currentBehavior).toBe(true)
  })

  it('blocks future dates when enabled and mode BLOCK', () => {
    const result = evaluateDocumentDatePolicy({
      policy: basePolicy({
        policyEnabled: true,
        futureDateMode: 'BLOCK',
        pastDateMode: 'CURRENT_BEHAVIOUR',
      }),
      documentDate: '2026-08-10',
      businessDate: '2026-08-01',
    })
    expect(result.currentBehavior).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.reasonCode).toBe('FUTURE_DATE_BLOCKED')
  })

  it('requires approval for back dates when REQUIRE_APPROVAL', () => {
    const result = evaluateDocumentDatePolicy({
      policy: basePolicy({
        policyEnabled: true,
        pastDateMode: 'REQUIRE_APPROVAL',
        futureDateMode: 'CURRENT_BEHAVIOUR',
      }),
      documentDate: '2026-07-20',
      businessDate: '2026-08-01',
    })
    expect(result.requiresApproval).toBe(true)
    expect(result.blocked).toBe(false)
    expect(result.reasonCode).toBe('BACK_DATE_REQUIRES_APPROVAL')
  })

  it('enforces maxFutureDays window', () => {
    const result = evaluateDocumentDatePolicy({
      policy: basePolicy({
        policyEnabled: true,
        futureDateMode: 'ALLOW',
        maxFutureDays: 3,
      }),
      documentDate: '2026-08-10',
      businessDate: '2026-08-01',
    })
    expect(result.blocked).toBe(true)
    expect(result.reasonCode).toBe('MAX_FUTURE_DAYS_EXCEEDED')
    expect(result.maxAllowedDate).toBe('2026-08-04')
  })
})

describe('scope resolution', () => {
  it('scores branch > legal entity > tenant', () => {
    expect(scorePolicyScope({ legalEntityId: null, branchId: 'b1' }, 'le1', 'b1')).toBe(300)
    expect(scorePolicyScope({ legalEntityId: 'le1', branchId: null }, 'le1', 'b1')).toBe(200)
    expect(scorePolicyScope({ legalEntityId: null, branchId: null }, 'le1', 'b1')).toBe(100)
    expect(scorePolicyScope({ legalEntityId: null, branchId: 'other' }, 'le1', 'b1')).toBeNull()
  })

  it('picks branch-scoped policy over tenant-wide', () => {
    const candidates = [
      row({ id: 'tenant', branchId: null, legalEntityId: null, policyEnabled: true }),
      row({
        id: 'branch',
        branchId: 'b1',
        legalEntityId: 'le1',
        policyEnabled: true,
        futureDateMode: 'BLOCK',
      }),
      row({ id: 'le', branchId: null, legalEntityId: 'le1', policyEnabled: true }),
    ]
    const effective = resolveEffectivePolicyFromCandidates(candidates, {
      tenantId: 't1',
      legalEntityId: 'le1',
      branchId: 'b1',
      moduleKey: 'crm',
      documentType: 'QUOTATION',
    })
    expect(effective.id).toBe('branch')
    expect(effective.scope).toBe('BRANCH')
  })

  it('falls back to LE when branch has no match', () => {
    const candidates = [
      row({ id: 'tenant', branchId: null, legalEntityId: null }),
      row({ id: 'le', branchId: null, legalEntityId: 'le1' }),
      row({ id: 'other-branch', branchId: 'bx', legalEntityId: 'le1' }),
    ]
    const effective = resolveEffectivePolicyFromCandidates(candidates, {
      tenantId: 't1',
      legalEntityId: 'le1',
      branchId: 'b1',
      moduleKey: 'crm',
      documentType: 'QUOTATION',
    })
    expect(effective.id).toBe('le')
    expect(effective.scope).toBe('LEGAL_ENTITY')
  })

  it('maps null row to none scope defaults', () => {
    const effective = mapRowToEffective(
      null,
      {
        tenantId: 't1',
        moduleKey: 'purchase',
        documentType: 'GRN',
      },
      false,
    )
    expect(effective.scope).toBe('NONE')
    expect(effective.policyEnabled).toBe(false)
    expect(effective.futureDateMode).toBe('CURRENT_BEHAVIOUR')
    expect(effective.featureFlagEnabled).toBe(false)
  })
})

describe('permissions catalog (static)', () => {
  it('includes document governance permissions in package export surface', async () => {
    const { PERMISSIONS } = await import('../src/constants/permissions.js')
    const keys = [
      'platform.document_governance.view',
      'platform.document_governance.manage',
      'platform.document_governance.activate',
      'platform.document_governance.approve',
      'platform.document_governance.override',
    ]
    for (const k of keys) {
      expect(PERMISSIONS.includes(k as (typeof PERMISSIONS)[number])).toBe(true)
    }
  })
})
