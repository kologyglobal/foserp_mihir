/**
 * Admin A3–A9 — Module Administrators designation register.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/config/database.js'
import * as moduleService from '../src/modules/modules/module.service.js'
import * as userService from '../src/modules/users/user.service.js'
import { NotFoundError, ValidationError } from '../src/utils/errors.js'

const TENANT_SLUG = 'vasant-trailers'

describe('admin module administrators', () => {
  let tenantId = ''
  let otherTenantId = ''
  let userA = ''
  let userB = ''
  let foreignUserId = ''

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — seed required`)
    tenantId = tenant.id

    const other = await prisma.tenant.create({
      data: {
        name: 'Module Admin Other',
        slug: `mod-admin-other-${Date.now()}`,
        email: `mod-admin-other-${Date.now()}@example.com`,
        status: 'ACTIVE',
      },
    })
    otherTenantId = other.id

    const a = await userService.createUser(tenantId, {
      firstName: 'Mod',
      lastName: 'Alpha',
      email: `mod.admin.a.${Date.now()}@example.com`,
      password: 'Password123!',
    })
    userA = a.id

    const b = await userService.createUser(tenantId, {
      firstName: 'Mod',
      lastName: 'Beta',
      email: `mod.admin.b.${Date.now()}@example.com`,
      password: 'Password123!',
    })
    userB = b.id

    const foreign = await userService.createUser(otherTenantId, {
      firstName: 'Foreign',
      lastName: 'User',
      email: `mod.admin.foreign.${Date.now()}@example.com`,
      password: 'Password123!',
    })
    foreignUserId = foreign.id
  })

  afterAll(async () => {
    await prisma.moduleAdministrator.deleteMany({
      where: { OR: [{ tenantId }, { tenantId: otherTenantId }] },
    })
    if (userA) {
      await prisma.userRole.deleteMany({ where: { userId: userA } })
      await prisma.user.deleteMany({ where: { id: userA } })
    }
    if (userB) {
      await prisma.userRole.deleteMany({ where: { userId: userB } })
      await prisma.user.deleteMany({ where: { id: userB } })
    }
    if (foreignUserId) {
      await prisma.userRole.deleteMany({ where: { userId: foreignUserId } })
      await prisma.user.deleteMany({ where: { id: foreignUserId } })
    }
    if (otherTenantId) {
      await prisma.tenant.delete({ where: { id: otherTenantId } }).catch(() => {})
    }
  })

  it('assigns, lists, replaces, and clears module administrators', async () => {
    const assigned = await moduleService.replaceModuleAdministrators(tenantId, 'crm', [userA, userB])
    expect(assigned.map((a) => a.userId).sort()).toEqual([userA, userB].sort())
    expect(assigned.every((a) => a.moduleKey === 'crm')).toBe(true)

    const listed = await moduleService.listModuleAdministrators(tenantId, 'crm')
    expect(listed).toHaveLength(2)

    const status = await moduleService.listModuleStatus(tenantId)
    const crm = status.modules.find((m) => m.key === 'crm')
    expect(crm?.administrators).toHaveLength(2)

    const keys = await moduleService.listUserModuleAdministrations(tenantId, userA)
    expect(keys).toContain('crm')

    const replaced = await moduleService.replaceModuleAdministrators(tenantId, 'crm', [userA])
    expect(replaced).toHaveLength(1)
    expect(replaced[0]?.userId).toBe(userA)

    const cleared = await moduleService.replaceModuleAdministrators(tenantId, 'crm', [])
    expect(cleared).toHaveLength(0)
  })

  it('rejects unknown module and cross-tenant users', async () => {
    await expect(
      moduleService.replaceModuleAdministrators(tenantId, 'not_a_module', [userA]),
    ).rejects.toBeInstanceOf(NotFoundError)

    await expect(
      moduleService.replaceModuleAdministrators(tenantId, 'crm', [foreignUserId]),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
