import { describe, expect, it } from 'vitest'
import {
  ensureViewDependencies,
  filterAssignablePermissions,
  isTenantAdminAccess,
  viewDependencyFor,
} from '../src/modules/roles/effective-access.service.js'
import { AuthorizationError } from '../src/utils/errors.js'

describe('A4 effective access helpers', () => {
  it('derives .view sibling for module.resource.action names', () => {
    expect(viewDependencyFor('crm.lead.create')).toBe('crm.lead.view')
    expect(viewDependencyFor('purchase.setup.manage')).toBe('purchase.setup.view')
    expect(viewDependencyFor('crm.lead.view')).toBeNull()
    expect(viewDependencyFor('tenant.manage')).toBe('tenant.view')
  })

  it('auto-includes view dependencies for mutate grants', () => {
    expect(ensureViewDependencies(['crm.lead.create', 'crm.lead.update'])).toEqual([
      'crm.lead.create',
      'crm.lead.update',
      'crm.lead.view',
    ])
  })

  it('detects tenant admin via role name or tenant.manage', () => {
    expect(isTenantAdminAccess(['Tenant Admin'], [])).toBe(true)
    expect(isTenantAdminAccess(['Administrator'], [])).toBe(true)
    expect(isTenantAdminAccess(['Sales Manager'], ['tenant.manage'])).toBe(true)
    expect(isTenantAdminAccess(['Sales Manager'], ['crm.lead.view'])).toBe(false)
  })

  it('allows privileged actors to assign any permissions', () => {
    const result = filterAssignablePermissions(
      ['crm.lead.delete', 'finance.view'],
      ['crm.lead.view'],
      ['Tenant Admin'],
    )
    expect(result.rejected).toEqual([])
    expect(result.allowed).toEqual(['crm.lead.delete', 'finance.view'])
  })

  it('intersects permissions for non-admin actors', () => {
    const result = filterAssignablePermissions(
      ['crm.lead.view', 'crm.lead.delete', 'finance.view'],
      ['crm.lead.view', 'crm.lead.delete'],
      ['Sales Executive'],
    )
    expect(result.allowed).toEqual(['crm.lead.view', 'crm.lead.delete'])
    expect(result.rejected).toEqual(['finance.view'])
  })
})

describe('A4 system role immutability contract', () => {
  it('uses AuthorizationError (403) for system role mutations', () => {
    const err = new AuthorizationError('System roles cannot be modified')
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe('PERMISSION_DENIED')
    expect(err.message).toContain('System roles')
  })
})
