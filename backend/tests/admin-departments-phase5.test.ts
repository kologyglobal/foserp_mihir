/**
 * Admin Panel Phase 5 — Department master CRUD + User.departmentId sync.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/config/database.js'
import * as departmentService from '../src/modules/departments/department.service.js'
import * as userService from '../src/modules/users/user.service.js'

const TENANT_SLUG = 'vasant-trailers'

describe('admin departments phase 5', () => {
  let tenantId = ''
  let departmentId = ''
  let userId = ''

  beforeAll(async () => {
    const tenant = await prisma.tenant.findFirst({ where: { slug: TENANT_SLUG, deletedAt: null } })
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found — seed required`)
    tenantId = tenant.id
  })

  afterAll(async () => {
    if (userId) {
      await prisma.userRole.deleteMany({ where: { userId } })
      await prisma.user.deleteMany({ where: { id: userId } })
    }
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } })
    }
  })

  it('creates department, assigns to user, renames and syncs string, soft-deletes', async () => {
    const code = `P5${Date.now().toString().slice(-6)}`
    const created = await departmentService.createDepartment(tenantId, {
      code,
      name: 'Phase5 Production',
      description: 'Phase 5 test',
    })
    departmentId = created.id
    expect(created.code).toBe(code.toUpperCase())
    expect(created.isActive).toBe(true)

    const email = `dept.phase5.${Date.now()}@example.com`
    const user = await userService.createUser(tenantId, {
      firstName: 'Dept',
      lastName: 'Tester',
      email,
      password: 'Password123!',
      departmentId,
    })
    userId = user.id
    expect(user.departmentId).toBe(departmentId)
    expect(user.department).toBe('Phase5 Production')

    const renamed = await departmentService.updateDepartment(tenantId, departmentId, {
      name: 'Phase5 Fabrication',
    })
    expect(renamed.name).toBe('Phase5 Fabrication')

    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(refreshed.department).toBe('Phase5 Fabrication')
    expect(refreshed.departmentId).toBe(departmentId)

    await departmentService.deleteDepartment(tenantId, departmentId)
    const afterDelete = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(afterDelete.departmentId).toBeNull()

    const soft = await prisma.department.findUniqueOrThrow({ where: { id: departmentId } })
    expect(soft.deletedAt).not.toBeNull()
    expect(soft.isActive).toBe(false)
  })
})
