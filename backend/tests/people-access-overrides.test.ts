/**
 * Unit tests for People & Access permission override resolution (no DB).
 */
import { describe, expect, it } from 'vitest'
import { applyPermissionOverrides } from '../src/modules/effective-access/resolve-permissions.js'

describe('applyPermissionOverrides', () => {
  it('keeps role grants when no overrides', () => {
    expect(applyPermissionOverrides(['user.view', 'user.update'], [])).toEqual(
      expect.arrayContaining(['user.view', 'user.update']),
    )
  })

  it('DENY removes a role grant', () => {
    const result = applyPermissionOverrides(
      ['user.view', 'user.update', 'role.view'],
      [{ permissionName: 'user.update', effect: 'DENY' }],
    )
    expect(result).toContain('user.view')
    expect(result).toContain('role.view')
    expect(result).not.toContain('user.update')
  })

  it('ALLOW adds a grant not present on roles', () => {
    const result = applyPermissionOverrides(
      ['user.view'],
      [{ permissionName: 'user.delete', effect: 'ALLOW' }],
    )
    expect(result).toContain('user.view')
    expect(result).toContain('user.delete')
  })

  it('DENY wins over ALLOW for the same permission', () => {
    const result = applyPermissionOverrides(
      ['user.view'],
      [
        { permissionName: 'user.delete', effect: 'ALLOW' },
        { permissionName: 'user.delete', effect: 'DENY' },
      ],
    )
    expect(result).not.toContain('user.delete')
  })

  it('multi-role union then DENY', () => {
    const roleA = ['crm.lead.view', 'crm.lead.create']
    const roleB = ['crm.lead.view', 'crm.lead.delete', 'user.view']
    const union = [...new Set([...roleA, ...roleB])]
    const result = applyPermissionOverrides(union, [
      { permissionName: 'crm.lead.delete', effect: 'DENY' },
    ])
    expect(result).toContain('crm.lead.view')
    expect(result).toContain('crm.lead.create')
    expect(result).toContain('user.view')
    expect(result).not.toContain('crm.lead.delete')
  })
})
