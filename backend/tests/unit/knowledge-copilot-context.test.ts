import { describe, expect, it } from 'vitest'
import {
  formatResolvedContextForPrompt,
  type ResolvedErpContext,
} from '../../src/modules/knowledge/copilot/context-resolver.js'
import { buildContextFallbackQuery } from '../../src/modules/knowledge/copilot/copilot.service.js'

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

describe('buildContextFallbackQuery', () => {
  it('enriches a vague "about this page" question with route/module/title terms', () => {
    const resolved: ResolvedErpContext = {
      routePath: '/inventory/movements/transfers/new',
      moduleKey: 'inventory',
      entityType: null,
      entityId: null,
      pageTitle: 'New Move Between Warehouse',
      screenHints: [],
      facts: [],
      permissionNotes: [],
    }
    const query = buildContextFallbackQuery('Tell me about this page', resolved)
    expect(query).not.toBe('Tell me about this page')
    expect(query).toContain('inventory')
    expect(query).toContain('New Move Between Warehouse')
    expect(query).toContain('transfers')
  })

  it('drops UUID-like route segments as noise', () => {
    const resolved: ResolvedErpContext = {
      routePath: '/purchase/orders/d3df1383-983f-415a-b899-71b5078c3a38',
      moduleKey: 'purchase',
      entityType: 'PURCHASE_ORDER',
      entityId: 'd3df1383-983f-415a-b899-71b5078c3a38',
      pageTitle: 'PO-000088',
      screenHints: [],
      facts: [],
      permissionNotes: [],
    }
    const query = buildContextFallbackQuery('what is this', resolved)
    expect(query).not.toContain('d3df1383-983f-415a-b899-71b5078c3a38')
  })

  it('returns the original question unchanged when there is no useful context', () => {
    const resolved: ResolvedErpContext = {
      routePath: '/',
      moduleKey: null,
      entityType: null,
      entityId: null,
      pageTitle: null,
      screenHints: [],
      facts: [],
      permissionNotes: [],
    }
    const query = buildContextFallbackQuery('hello', resolved)
    expect(query.toLowerCase()).toBe('hello')
  })
})
