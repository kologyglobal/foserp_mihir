import { describe, expect, it } from 'vitest'
import {
  formatResolvedContextForPrompt,
  type ResolvedErpContext,
} from '../../src/modules/knowledge/copilot/context-resolver.js'

describe('copilot context formatting', () => {
  it('includes route facts and permission notes', () => {
    const resolved: ResolvedErpContext = {
      routePath: '/crm/leads/abc',
      moduleKey: 'crm',
      entityType: 'LEAD',
      entityId: 'abc',
      pageTitle: 'Lead 360',
      screenHints: ['Priority high'],
      facts: ['Route: /crm/leads/abc', 'Lead code: LD-1'],
      permissionNotes: ['crm.lead.view granted path'],
    }
    const text = formatResolvedContextForPrompt(resolved)
    expect(text).toContain('## Current ERP screen context')
    expect(text).toContain('Lead code: LD-1')
    expect(text).toContain('Permission notes')
    expect(text).toContain('crm.lead.view')
  })
})
