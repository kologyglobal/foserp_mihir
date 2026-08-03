import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const HRMS_PERMS: PermissionName[] = [
  'hrms.employee.view',
  'hrms.employee.create',
  'hrms.employee.edit',
  'hrms.designation.view',
  'hrms.designation.manage',
  'hrms.shift.view',
  'hrms.shift.manage',
  'hrms.holiday.view',
  'hrms.holiday.manage',
  'hrms.roster.view',
  'hrms.roster.manage',
  'organisation.view',
  'finance.legal_entity.view',
  'finance.legal_entity.manage',
  'finance.branch.view',
  'finance.branch.manage',
  'department.view',
  'department.create',
]

async function ensurePermissions(): Promise<void> {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({
        where: { name },
        create: { name, module, description: name },
        update: {},
      })
      .catch(() => {})
  }
}

async function createHrmsTenant(withPerms: boolean, scoped = false) {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `hrms2-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  const tenant = await prisma.tenant.create({
    data: { name: 'HRMS P2', slug, email: `hrms2-${Date.now()}@test.com`, status: 'ACTIVE' },
  })

  await prisma.codeSeries.upsert({
    where: { tenantId_entityType: { tenantId: tenant.id, entityType: 'EMPLOYEE' } },
    create: { tenantId: tenant.id, entityType: 'EMPLOYEE', prefix: 'EMP', currentValue: 0, padLength: 6 },
    update: {},
  })

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'HR',
      lastName: 'Tester',
      email: `hr2-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const permNames = withPerms ? HRMS_PERMS : (['finance.view'] as PermissionName[])
  const perms = await prisma.permission.findMany({ where: { name: { in: permNames } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `HR Role ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id } })

  const le = await prisma.legalEntity.create({
    data: {
      tenantId: tenant.id,
      code: 'VF',
      legalName: 'Vasant Fabrication',
      displayName: 'Vasant Fabrication',
      isDefault: true,
      isActive: true,
    },
  })
  const branchA = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      code: 'MAIN',
      name: 'Main Plant',
      branchType: 'FACTORY',
      isDefault: true,
      isActive: true,
    },
  })
  const branchB = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      legalEntityId: le.id,
      code: 'PLANT-B',
      name: 'Plant B',
      branchType: 'FACTORY',
      isActive: true,
    },
  })
  const dept = await prisma.department.create({
    data: { tenantId: tenant.id, code: 'PROD', name: 'Production' },
  })

  if (scoped) {
    await prisma.userLegalEntityAccess.create({
      data: { tenantId: tenant.id, userId: user.id, legalEntityId: le.id, isDefault: true },
    })
    await prisma.userBranchAccess.create({
      data: { tenantId: tenant.id, userId: user.id, branchId: branchA.id },
    })
  }

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Test@123',
    tenantSlug: slug,
  })
  const token = loginRes.body?.data?.accessToken as string

  return { tenant, slug, token, user, le, branchA, branchB, dept }
}

describe.skipIf(!dbAvailable)('HRMS Phase 2 — Shift / Holiday / Roster', () => {
  let ctx: Awaited<ReturnType<typeof createHrmsTenant>>
  let designationId: string
  let employeeId: string
  let shiftAId: string
  let shiftBId: string
  let overnightId: string

  beforeAll(async () => {
    await ensurePermissions()
    ctx = await createHrmsTenant(true)

    const des = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/designations`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ code: 'WELD', name: 'Welder' })
    expect(des.status).toBe(201)
    designationId = des.body.data.id

    const emp = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/employees`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        firstName: 'Rajesh',
        lastName: 'Patel',
        legalEntityId: ctx.le.id,
        branchId: ctx.branchA.id,
        departmentId: ctx.dept.id,
        designationId,
        joinDate: '2026-01-15',
        employmentType: 'PERMANENT',
        workerCategory: 'WORKER',
        status: 'ACTIVE',
      })
    expect(emp.status).toBe(201)
    employeeId = emp.body.data.id
  })

  afterAll(async () => {
    if (!ctx) return
    await prisma.hrEmployeeShiftAssignment.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.hrHolidayCalendarDay.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.hrHolidayCalendar.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.hrEmployee.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.hrDesignation.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.hrShiftTemplate.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.userBranchAccess.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.userLegalEntityAccess.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.userRole.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId: ctx.tenant.id } } })
    await prisma.role.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.branch.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.legalEntity.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.department.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.codeSeries.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.user.deleteMany({ where: { tenantId: ctx.tenant.id } })
    await prisma.tenant.delete({ where: { id: ctx.tenant.id } }).catch(() => {})
  })

  it('creates normal and overnight shifts', async () => {
    const a = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/shifts`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: 'SHIFT-A',
        name: 'Shift A',
        startTime: '06:00',
        endTime: '14:00',
        breakMinutes: 30,
        graceInMinutes: 10,
        fullDayMinimumMinutes: 420,
        halfDayMinimumMinutes: 210,
      })
    expect(a.status).toBe(201)
    expect(a.body.data.overnightShift).toBe(false)
    shiftAId = a.body.data.id

    const b = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/shifts`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: 'SHIFT-B',
        name: 'Shift B',
        startTime: '14:00',
        endTime: '22:00',
        breakMinutes: 30,
        fullDayMinimumMinutes: 420,
        halfDayMinimumMinutes: 210,
      })
    expect(b.status).toBe(201)
    shiftBId = b.body.data.id

    const c = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/shifts`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: 'SHIFT-C',
        name: 'Night',
        startTime: '22:00',
        endTime: '06:00',
        breakMinutes: 30,
        overnightShift: true,
        fullDayMinimumMinutes: 420,
        halfDayMinimumMinutes: 210,
        weeklyOffDay: 0,
      })
    expect(c.status).toBe(201)
    expect(c.body.data.overnightShift).toBe(true)
    overnightId = c.body.data.id
  })

  it('rejects invalid shift duration', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/shifts`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: 'BAD',
        name: 'Bad',
        startTime: '09:00',
        endTime: '09:00',
        breakMinutes: 0,
        fullDayMinimumMinutes: 480,
        halfDayMinimumMinutes: 240,
      })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('sets default shift and resolves effective shift', async () => {
    const patch = await request(app)
      .patch(`/api/v1/t/${ctx.slug}/hrms/employees/${employeeId}`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ defaultShiftId: shiftAId })
    expect(patch.status).toBe(200)

    const eff = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/roster/effective-shift`)
      .query({ employeeId, date: '2026-08-05' })
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(eff.status).toBe(200)
    expect(eff.body.data.source).toBe('DEFAULT')
    expect(eff.body.data.shift.id).toBe(shiftAId)
  })

  it('roster override beats default; temporary beats roster', async () => {
    const roster = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/roster/assignments`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        employeeId,
        shiftId: shiftBId,
        effectiveFrom: '2026-08-08',
        effectiveTo: '2026-08-14',
        source: 'ROSTER',
      })
    expect(roster.status).toBe(201)

    const mid = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/roster/effective-shift`)
      .query({ employeeId, date: '2026-08-10' })
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(mid.body.data.source).toBe('ROSTER')
    expect(mid.body.data.shift.id).toBe(shiftBId)

    const temp = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/roster/assignments`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        employeeId,
        shiftId: overnightId,
        effectiveFrom: '2026-08-10',
        effectiveTo: '2026-08-10',
        source: 'TEMPORARY',
      })
    expect(temp.status).toBe(201)

    const day = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/roster/effective-shift`)
      .query({ employeeId, date: '2026-08-10' })
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(day.body.data.source).toBe('TEMPORARY')
    expect(day.body.data.shift.id).toBe(overnightId)
  })

  it('blocks overlapping roster assignments', async () => {
    const clash = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/roster/assignments`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        employeeId,
        shiftId: shiftAId,
        effectiveFrom: '2026-08-09',
        effectiveTo: '2026-08-11',
        source: 'ROSTER',
      })
    expect(clash.status).toBe(409)
  })

  it('holiday calendar + resolve prefers branch calendar', async () => {
    const leCal = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/holidays`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: 'LE-2026',
        name: 'LE Calendar',
        legalEntityId: ctx.le.id,
        year: 2026,
      })
    expect(leCal.status).toBe(201)
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/holidays/${leCal.body.data.id}/days`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ holidayDate: '2026-08-15', name: 'LE Holiday', holidayType: 'COMPANY' })

    const brCal = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/holidays`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        code: 'MAIN-2026',
        name: 'Main Plant Calendar',
        legalEntityId: ctx.le.id,
        branchId: ctx.branchA.id,
        year: 2026,
      })
    expect(brCal.status).toBe(201)
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/holidays/${brCal.body.data.id}/days`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ holidayDate: '2026-08-15', name: 'Plant Holiday', holidayType: 'FESTIVAL' })

    const resolved = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/holidays/resolve`)
      .query({ employeeId, date: '2026-08-15' })
      .set('Authorization', `Bearer ${ctx.token}`)
    expect(resolved.status).toBe(200)
    expect(resolved.body.data.isHoliday).toBe(true)
    expect(resolved.body.data.holidayName).toBe('Plant Holiday')
    expect(resolved.body.data.calendarScope).toBe('BRANCH')
  })

  it('denies shift manage without permission', async () => {
    const denied = await createHrmsTenant(false)
    const res = await request(app)
      .post(`/api/v1/t/${denied.slug}/hrms/shifts`)
      .set('Authorization', `Bearer ${denied.token}`)
      .send({
        code: 'X',
        name: 'X',
        startTime: '09:00',
        endTime: '18:00',
        fullDayMinimumMinutes: 480,
        halfDayMinimumMinutes: 240,
      })
    expect(res.status).toBe(403)

    await prisma.userRole.deleteMany({ where: { tenantId: denied.tenant.id } })
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId: denied.tenant.id } } })
    await prisma.role.deleteMany({ where: { tenantId: denied.tenant.id } })
    await prisma.branch.deleteMany({ where: { tenantId: denied.tenant.id } })
    await prisma.legalEntity.deleteMany({ where: { tenantId: denied.tenant.id } })
    await prisma.department.deleteMany({ where: { tenantId: denied.tenant.id } })
    await prisma.codeSeries.deleteMany({ where: { tenantId: denied.tenant.id } })
    await prisma.user.deleteMany({ where: { tenantId: denied.tenant.id } })
    await prisma.tenant.delete({ where: { id: denied.tenant.id } }).catch(() => {})
  })

  it('scoped HR cannot manage other plant roster employee', async () => {
    const scoped = await createHrmsTenant(true, true)
    const des = await request(app)
      .post(`/api/v1/t/${scoped.slug}/hrms/designations`)
      .set('Authorization', `Bearer ${scoped.token}`)
      .send({ code: 'OP', name: 'Operator' })
    const empB = await prisma.hrEmployee.create({
      data: {
        tenantId: scoped.tenant.id,
        employeeCode: 'EMP-SCOPED-B',
        legalEntityId: scoped.le.id,
        branchId: scoped.branchB.id,
        departmentId: scoped.dept.id,
        designationId: des.body.data.id,
        firstName: 'Other',
        lastName: 'Plant',
        displayName: 'Other Plant',
        joinDate: new Date('2026-01-01'),
        employmentType: 'PERMANENT',
        workerCategory: 'WORKER',
        status: 'ACTIVE',
      },
    })
    const shift = await request(app)
      .post(`/api/v1/t/${scoped.slug}/hrms/shifts`)
      .set('Authorization', `Bearer ${scoped.token}`)
      .send({
        code: 'GEN',
        name: 'General',
        startTime: '09:00',
        endTime: '18:00',
        fullDayMinimumMinutes: 480,
        halfDayMinimumMinutes: 240,
      })

    const assign = await request(app)
      .post(`/api/v1/t/${scoped.slug}/hrms/roster/assignments`)
      .set('Authorization', `Bearer ${scoped.token}`)
      .send({
        employeeId: empB.id,
        shiftId: shift.body.data.id,
        effectiveFrom: '2026-08-01',
        effectiveTo: '2026-08-07',
        source: 'ROSTER',
      })
    expect(assign.status).toBe(403)

    await prisma.hrEmployee.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.hrDesignation.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.hrShiftTemplate.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.userBranchAccess.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.userLegalEntityAccess.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.userRole.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId: scoped.tenant.id } } })
    await prisma.role.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.branch.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.legalEntity.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.department.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.codeSeries.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.user.deleteMany({ where: { tenantId: scoped.tenant.id } })
    await prisma.tenant.delete({ where: { id: scoped.tenant.id } }).catch(() => {})
  })
})
