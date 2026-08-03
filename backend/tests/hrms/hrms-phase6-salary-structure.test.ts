import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { validateStructureLines } from '../../src/modules/hrms/salary/salary-structure.service.js'
import { getEffectiveSalaryStructure } from '../../src/modules/hrms/salary/effective-salary.service.js'
import { ValidationError } from '../../src/utils/errors.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const salaryTablesReady = dbAvailable
  ? await prisma
      .$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'hr_salary_components' LIMIT 1`
      .then((rows) => Array.isArray(rows) && rows.length > 0)
      .catch(() => false)
  : false

const HRMS_SALARY_PERMS: PermissionName[] = [
  'hrms.employee.view',
  'hrms.employee.create',
  'hrms.employee.edit',
  'hrms.designation.view',
  'hrms.designation.manage',
  'hrms.salary.component.view',
  'hrms.salary.component.manage',
  'hrms.salary.structure.view',
  'hrms.salary.structure.manage',
  'hrms.salary.assignment.view',
  'hrms.salary.assignment.manage',
  'organisation.view',
  'finance.legal_entity.view',
  'finance.branch.view',
  'department.view',
]

const SUPERVISOR_PERMS: PermissionName[] = [
  'hrms.employee.view',
  'hrms.overtime.view',
  'hrms.overtime.approve',
  'organisation.view',
]

async function ensurePermissions() {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({ where: { name }, create: { name, module, description: name }, update: {} })
      .catch(() => {})
  }
}

describe('HRMS Phase 6 — formula validation (unit)', () => {
  it('rejects self-referencing percentage', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    expect(() =>
      validateStructureLines([
        {
          salaryComponentId: id,
          sequence: 10,
          calculationType: 'PERCENTAGE',
          percentage: 40,
          percentageOfComponentId: id,
        },
      ]),
    ).toThrow(ValidationError)
  })

  it('rejects percentage base not on version / wrong sequence', () => {
    const basic = '11111111-1111-1111-1111-111111111111'
    const hra = '22222222-2222-2222-2222-222222222222'
    expect(() =>
      validateStructureLines([
        {
          salaryComponentId: hra,
          sequence: 10,
          calculationType: 'PERCENTAGE',
          percentage: 40,
          percentageOfComponentId: basic,
        },
      ]),
    ).toThrow(ValidationError)
  })

  it('accepts FIXED then PERCENTAGE of BASIC', () => {
    const basic = '11111111-1111-1111-1111-111111111111'
    const hra = '22222222-2222-2222-2222-222222222222'
    expect(() =>
      validateStructureLines([
        {
          salaryComponentId: basic,
          sequence: 10,
          calculationType: 'FIXED',
          fixedAmount: 15000,
        },
        {
          salaryComponentId: hra,
          sequence: 20,
          calculationType: 'PERCENTAGE',
          percentage: 40,
          percentageOfComponentId: basic,
        },
      ]),
    ).not.toThrow()
  })
})

describe.skipIf(!salaryTablesReady)('HRMS Phase 6 — Salary Components + Structures (live)', () => {
  let tenantSlug = ''
  let tenantId = ''
  let managerToken = ''
  let supervisorToken = ''
  let otherTenantToken = ''
  let employeeId = ''
  const componentIds: Record<string, string> = {}
  let structureId = ''
  let version1Id = ''
  let version2Id = ''
  let assignmentId = ''
  const cleanupTenantIds: string[] = []

  beforeAll(async () => {
    await ensurePermissions()
    const { hashPassword } = await import('../../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const slug = `hrms6-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'HRMS Salary P6', slug, email: `hrms6-${Date.now()}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
    tenantSlug = slug
    cleanupTenantIds.push(tenant.id)

    await prisma.codeSeries.upsert({
      where: { tenantId_entityType: { tenantId: tenant.id, entityType: 'EMPLOYEE' } },
      create: { tenantId: tenant.id, entityType: 'EMPLOYEE', prefix: 'EMP', currentValue: 0, padLength: 6 },
      update: {},
    })

    const managerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        firstName: 'HR',
        lastName: 'Manager',
        email: `mgr6-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const supervisorUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Shop',
        lastName: 'Supervisor',
        email: `sup6-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })

    const salaryPerms = await prisma.permission.findMany({ where: { name: { in: HRMS_SALARY_PERMS } } })
    const mgrRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Salary P6 Role ${Date.now()}`,
        rolePermissions: { create: salaryPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: managerUser.id, roleId: mgrRole.id, tenantId: tenant.id } })

    const supPerms = await prisma.permission.findMany({ where: { name: { in: SUPERVISOR_PERMS } } })
    const supRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Supervisor P6 ${Date.now()}`,
        rolePermissions: { create: supPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({
      data: { userId: supervisorUser.id, roleId: supRole.id, tenantId: tenant.id },
    })

    const le = await prisma.legalEntity.create({
      data: {
        tenantId: tenant.id,
        code: 'LE1',
        displayName: 'LE One',
        legalName: 'LE One Pvt Ltd',
        isDefault: true,
        isActive: true,
      },
    })
    const branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        legalEntityId: le.id,
        code: 'BR1',
        name: 'Plant 1',
        branchType: 'FACTORY',
        isDefault: true,
        isActive: true,
      },
    })
    const dept = await prisma.department.create({
      data: { tenantId: tenant.id, code: 'PROD', name: 'Production' },
    })
    const desig = await prisma.hrDesignation.create({
      data: { tenantId: tenant.id, code: 'WRK', name: 'Worker', isActive: true },
    })

    const emp = await prisma.hrEmployee.create({
      data: {
        tenantId: tenant.id,
        employeeCode: 'EMP000001',
        firstName: 'Rajesh',
        lastName: 'Patel',
        displayName: 'Rajesh Patel',
        legalEntityId: le.id,
        branchId: branch.id,
        departmentId: dept.id,
        designationId: desig.id,
        workerCategory: 'WORKER',
        employmentType: 'PERMANENT',
        status: 'ACTIVE',
        joinDate: new Date('2024-01-01'),
      },
    })
    employeeId = emp.id

    const other = await prisma.tenant.create({
      data: {
        name: 'Other P6',
        slug: `hrms6o-${Date.now()}`,
        email: `hrms6o-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
    })
    cleanupTenantIds.push(other.id)
    const otherUser = await prisma.user.create({
      data: {
        tenantId: other.id,
        firstName: 'Other',
        lastName: 'Admin',
        email: `other6-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const otherPerms = await prisma.permission.findMany({ where: { name: { in: HRMS_SALARY_PERMS } } })
    const otherRole = await prisma.role.create({
      data: {
        tenantId: other.id,
        name: `Other P6 ${Date.now()}`,
        rolePermissions: { create: otherPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({
      data: { userId: otherUser.id, roleId: otherRole.id, tenantId: other.id },
    })

    const mgrLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: managerUser.email, password: 'Test@123', tenantSlug: slug })
    expect(mgrLogin.status).toBe(200)
    managerToken = mgrLogin.body.data.accessToken

    const supLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: supervisorUser.email, password: 'Test@123', tenantSlug: slug })
    expect(supLogin.status).toBe(200)
    supervisorToken = supLogin.body.data.accessToken

    const otherLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: otherUser.email, password: 'Test@123', tenantSlug: other.slug })
    expect(otherLogin.status).toBe(200)
    otherTenantToken = otherLogin.body.data.accessToken
  }, 120_000)

  afterAll(async () => {
    for (const id of cleanupTenantIds) {
      await prisma.hrEmployeeSalaryAssignment.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructureLine.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructureVersion.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructure.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryComponent.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployee.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrDesignation.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.userRole.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.rolePermission.deleteMany({ where: { role: { tenantId: id } } }).catch(() => {})
      await prisma.role.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.user.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.branch.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.department.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.legalEntity.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.codeSeries.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.tenant.delete({ where: { id } }).catch(() => {})
    }
  })

  const base = () => `/api/v1/t/${tenantSlug}/hrms/salary`

  it('component CRUD + duplicate code blocked', async () => {
    const defs = [
      { code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED' },
      { code: 'HRA', name: 'HRA', type: 'EARNING', calculationType: 'PERCENTAGE' },
      { code: 'SPECIAL', name: 'Special Allowance', type: 'EARNING', calculationType: 'FIXED' },
      { code: 'OT', name: 'Overtime', type: 'EARNING', calculationType: 'OT_LINKED' },
      { code: 'PF', name: 'PF', type: 'DEDUCTION', calculationType: 'STATUTORY' },
      { code: 'ESIC', name: 'ESIC', type: 'DEDUCTION', calculationType: 'STATUTORY' },
    ]
    for (const d of defs) {
      const res = await request(app)
        .post(`${base()}/components`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(d)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      componentIds[d.code] = res.body.data.id
    }
    const dup = await request(app)
      .post(`${base()}/components`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ code: 'BASIC', name: 'Dup', type: 'EARNING', calculationType: 'FIXED' })
    expect(dup.status).toBe(409)

    const list = await request(app)
      .get(`${base()}/components`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(list.status).toBe(200)
    expect(list.body.data.length).toBeGreaterThanOrEqual(6)
  })

  it('structure + version activate + preview', async () => {
    const create = await request(app)
      .post(`${base()}/structures`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ code: 'WORKER-GRADE-A', name: 'Worker Grade A', workerCategory: 'WORKER' })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    structureId = create.body.data.id

    const v1 = await request(app)
      .post(`${base()}/structures/${structureId}/versions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ effectiveFrom: '2026-08-01' })
    expect(v1.status, JSON.stringify(v1.body)).toBe(201)
    version1Id = v1.body.data.id

    const lines = await request(app)
      .patch(`${base()}/versions/${version1Id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        lines: [
          {
            salaryComponentId: componentIds.BASIC,
            sequence: 10,
            calculationType: 'FIXED',
            fixedAmount: 15000,
          },
          {
            salaryComponentId: componentIds.HRA,
            sequence: 20,
            calculationType: 'PERCENTAGE',
            percentage: 40,
            percentageOfComponentId: componentIds.BASIC,
          },
          {
            salaryComponentId: componentIds.SPECIAL,
            sequence: 30,
            calculationType: 'FIXED',
            fixedAmount: 4000,
          },
          {
            salaryComponentId: componentIds.OT,
            sequence: 40,
            calculationType: 'OT_LINKED',
          },
          {
            salaryComponentId: componentIds.PF,
            sequence: 50,
            calculationType: 'STATUTORY',
          },
          {
            salaryComponentId: componentIds.ESIC,
            sequence: 60,
            calculationType: 'STATUTORY',
          },
        ],
      })
    expect(lines.status, JSON.stringify(lines.body)).toBe(200)

    const act = await request(app)
      .post(`${base()}/versions/${version1Id}/activate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(act.status, JSON.stringify(act.body)).toBe(200)
    expect(act.body.data.status).toBe('ACTIVE')

    const patchActive = await request(app)
      .patch(`${base()}/versions/${version1Id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ lines: [] })
    expect(patchActive.status).toBeGreaterThanOrEqual(400)

    const preview = await request(app)
      .post(`${base()}/preview`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ salaryStructureVersionId: version1Id, effectiveDate: '2026-08-01' })
    expect(preview.status, JSON.stringify(preview.body)).toBe(200)
    expect(preview.body.data.summary.totalEarnings).toBe(25000)
  })

  it('assignment + effective resolution + overlap prevention', async () => {
    const assign = await request(app)
      .post(`${base()}/assignments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        employeeId,
        salaryStructureVersionId: version1Id,
        effectiveFrom: '2026-08-01',
        monthlyGross: 25000,
        annualCtc: 300000,
      })
    expect(assign.status, JSON.stringify(assign.body)).toBe(201)
    assignmentId = assign.body.data.id

    const overlap = await request(app)
      .post(`${base()}/assignments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        employeeId,
        salaryStructureVersionId: version1Id,
        effectiveFrom: '2026-09-01',
      })
    expect(overlap.status).toBe(409)

    const eff = await getEffectiveSalaryStructure(tenantId, employeeId, '2026-08-15')
    expect(eff.structure.code).toBe('WORKER-GRADE-A')
    expect(eff.version.versionNo).toBe(1)
    expect(eff.lines.length).toBeGreaterThanOrEqual(3)
  })

  it('version 2 historical + salary revision', async () => {
    const v2 = await request(app)
      .post(`${base()}/structures/${structureId}/versions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ effectiveFrom: '2027-01-01', copyFromVersionId: version1Id })
    expect(v2.status, JSON.stringify(v2.body)).toBe(201)
    version2Id = v2.body.data.id

    const act2 = await request(app)
      .post(`${base()}/versions/${version2Id}/activate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(act2.status, JSON.stringify(act2.body)).toBe(200)

    const v1get = await request(app)
      .get(`${base()}/versions/${version1Id}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(v1get.body.data.status).toBe('SUPERSEDED')

    const revise = await request(app)
      .post(`${base()}/assignments/${assignmentId}/revise`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        salaryStructureVersionId: version2Id,
        effectiveFrom: '2027-01-01',
        monthlyGross: 25000,
      })
    expect(revise.status, JSON.stringify(revise.body)).toBe(200)

    const hist = await request(app)
      .get(`${base()}/assignments`)
      .query({ employeeId })
      .set('Authorization', `Bearer ${managerToken}`)
    expect(hist.status).toBe(200)
    expect(hist.body.data.length).toBeGreaterThanOrEqual(2)
    expect(hist.body.data.some((a: { status: string }) => a.status === 'CLOSED')).toBe(true)

    const oldEff = await getEffectiveSalaryStructure(tenantId, employeeId, '2026-12-01')
    expect(oldEff.version.versionNo).toBe(1)
    const newEff = await getEffectiveSalaryStructure(tenantId, employeeId, '2027-01-15')
    expect(newEff.version.versionNo).toBe(2)
  })

  it('permissions — supervisor cannot view salary', async () => {
    const res = await request(app)
      .get(`${base()}/components`)
      .set('Authorization', `Bearer ${supervisorToken}`)
    expect(res.status).toBe(403)

    const assign = await request(app)
      .get(`${base()}/assignments`)
      .query({ employeeId })
      .set('Authorization', `Bearer ${supervisorToken}`)
    expect(assign.status).toBe(403)
  })

  it('tenant isolation', async () => {
    const res = await request(app)
      .get(`${base()}/structures/${structureId}`)
      .set('Authorization', `Bearer ${otherTenantToken}`)
    expect([403, 404]).toContain(res.status)
  })
})
