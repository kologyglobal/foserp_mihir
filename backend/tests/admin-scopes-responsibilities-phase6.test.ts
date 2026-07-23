/**
 * Admin Panel Phase 6 — data scopes + responsibilities.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/config/database.js'
import * as scopeService from '../src/modules/access-scopes/scope.service.js'
import * as responsibilityService from '../src/modules/responsibilities/responsibility.service.js'
import * as userService from '../src/modules/users/user.service.js'

const TENANT_SLUG = 'vasant-trailers'

describe('admin scopes & responsibilities phase 6', () => {
  let tenantId = ''
  let userId = ''
  let legalEntityId = ''
  let branchId = ''
  let responsibilityId = ''
  let assignmentId = ''

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — seed required`)
    tenantId = tenant.id

    const le = await prisma.legalEntity.findFirst({ where: { tenantId, isActive: true } })
    if (!le) throw new Error('No active legal entity — organisation seed required')
    legalEntityId = le.id

    const branch = await prisma.branch.findFirst({ where: { tenantId, legalEntityId, isActive: true } })
    if (!branch) throw new Error('No active branch for legal entity')
    branchId = branch.id
  })

  afterAll(async () => {
    if (assignmentId) {
      await prisma.userResponsibility.deleteMany({ where: { id: assignmentId } })
    }
    if (responsibilityId) {
      await prisma.responsibility.deleteMany({ where: { id: responsibilityId } })
    }
    if (userId) {
      await prisma.userLegalEntityAccess.deleteMany({ where: { userId } })
      await prisma.userBranchAccess.deleteMany({ where: { userId } })
      await prisma.userWarehouseAccess.deleteMany({ where: { userId } })
      await prisma.userRole.deleteMany({ where: { userId } })
      await prisma.user.deleteMany({ where: { id: userId } })
    }
  })

  it('replaces scopes (fail-open empty), assigns responsibility, and evaluates scopeAllows', async () => {
    const email = `scope.phase6.${Date.now()}@example.com`
    const user = await userService.createUser(tenantId, {
      firstName: 'Scope',
      lastName: 'Six',
      email,
      password: 'Password123!',
    })
    userId = user.id

    const empty = await scopeService.loadUserDataScope(tenantId, userId)
    expect(empty.unrestricted).toBe(true)
    expect(scopeService.scopeAllows(empty, { legalEntityId })).toBe(true)

    const scoped = await scopeService.replaceUserScopes(tenantId, userId, {
      legalEntities: [{ legalEntityId, isDefault: true, accessLevel: 'TRANSACT' }],
      branchIds: [branchId],
      warehouseIds: [],
    })
    expect(scoped.unrestricted).toBe(false)
    expect(scoped.legalEntities).toHaveLength(1)
    expect(scoped.branches).toHaveLength(1)
    expect(scopeService.scopeAllows(scoped, { legalEntityId, branchId })).toBe(true)
    expect(scopeService.scopeAllows(scoped, { legalEntityId: '00000000-0000-4000-8000-000000000099' })).toBe(false)

    const cleared = await scopeService.replaceUserScopes(tenantId, userId, {
      legalEntities: [],
      branchIds: [],
      warehouseIds: [],
    })
    expect(cleared.unrestricted).toBe(true)

    const system = await prisma.responsibility.findFirst({
      where: { tenantId: null, code: 'PURCHASE_APPROVER', deletedAt: null },
    })
    expect(system).toBeTruthy()

    const created = await responsibilityService.createResponsibility(tenantId, {
      code: `P6_${Date.now().toString().slice(-6)}`,
      name: 'Phase6 Plant Lead',
      module: 'manufacturing',
      description: 'test',
    })
    responsibilityId = created.id

    const assigned = await responsibilityService.assignUserResponsibility(tenantId, userId, {
      responsibilityId,
    })
    assignmentId = assigned.id
    expect(assigned.responsibility.code).toBe(created.code)

    const listed = await responsibilityService.listUserResponsibilities(tenantId, userId)
    expect(listed.some((a) => a.id === assignmentId)).toBe(true)

    await responsibilityService.removeUserResponsibility(tenantId, userId, assignmentId)
    assignmentId = ''
    const after = await responsibilityService.listUserResponsibilities(tenantId, userId)
    expect(after.some((a) => a.responsibilityId === responsibilityId)).toBe(false)
  })
})
