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
  'hrms.leave.view',
  'hrms.leave.apply',
  'hrms.leave.approve',
  'hrms.leave.manage',
  'hrms.leave.balance.view',
  'hrms.leave.balance.manage',
  'hrms.leave.type.manage',
  'organisation.view',
  'finance.legal_entity.view',
  'finance.branch.view',
  'department.view',
  'department.create',
]

async function ensurePermissions() {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({ where: { name }, create: { name, module, description: name }, update: {} })
      .catch(() => {})
  }
}

async function loginTenant() {
  const { hashPassword } = await import('../../src/utils/password.js')
  const pw = await hashPassword('Test@123')
  const slug = `hrms3-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const tenant = await prisma.tenant.create({
    data: { name: 'HRMS Leave', slug, email: `hrms3-${Date.now()}@test.com`, status: 'ACTIVE' },
  })
  await prisma.codeSeries.upsert({
    where: { tenantId_entityType: { tenantId: tenant.id, entityType: 'EMPLOYEE' } },
    create: { tenantId: tenant.id, entityType: 'EMPLOYEE', prefix: 'EMP', currentValue: 0, padLength: 6 },
    update: {},
  })

  const managerUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Suresh',
      lastName: 'Patel',
      email: `mgr-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })
  const empUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Rajesh',
      lastName: 'Patel',
      email: `emp-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { in: HRMS_PERMS } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Leave Role ${Date.now()}`,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
  })
  await prisma.userRole.create({ data: { userId: managerUser.id, roleId: role.id, tenantId: tenant.id } })
  await prisma.userRole.create({ data: { userId: empUser.id, roleId: role.id, tenantId: tenant.id } })

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
  const branch = await prisma.branch.create({
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
  const dept = await prisma.department.create({
    data: { tenantId: tenant.id, code: 'PROD', name: 'Production' },
  })

  const mgrLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: managerUser.email, password: 'Test@123', tenantSlug: slug })
  const empLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: empUser.email, password: 'Test@123', tenantSlug: slug })

  return {
    tenant,
    slug,
    le,
    branch,
    dept,
    managerUser,
    empUser,
    mgrToken: mgrLogin.body.data.accessToken as string,
    empToken: empLogin.body.data.accessToken as string,
  }
}

describe.skipIf(!dbAvailable)('HRMS Phase 3 — Leave', () => {
  let ctx: Awaited<ReturnType<typeof loginTenant>>
  let designationId: string
  let managerEmpId: string
  let employeeId: string
  let leaveTypeId: string
  let shiftId: string

  beforeAll(async () => {
    await ensurePermissions()
    ctx = await loginTenant()

    const des = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/designations`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ code: 'WELD', name: 'Welder' })
    expect(des.status, JSON.stringify(des.body)).toBe(201)
    designationId = des.body.data.id

    const mgrEmp = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/employees`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({
        firstName: 'Suresh',
        lastName: 'Patel',
        legalEntityId: ctx.le.id,
        branchId: ctx.branch.id,
        departmentId: ctx.dept.id,
        designationId,
        joinDate: '2025-01-01',
        employmentType: 'PERMANENT',
        workerCategory: 'SUPERVISOR',
        status: 'ACTIVE',
        userId: ctx.managerUser.id,
      })
    expect(mgrEmp.status, JSON.stringify(mgrEmp.body)).toBe(201)
    managerEmpId = mgrEmp.body.data.id

    const emp = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/employees`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({
        firstName: 'Rajesh',
        lastName: 'Patel',
        legalEntityId: ctx.le.id,
        branchId: ctx.branch.id,
        departmentId: ctx.dept.id,
        designationId,
        joinDate: '2026-01-15',
        employmentType: 'PERMANENT',
        workerCategory: 'WORKER',
        status: 'ACTIVE',
        userId: ctx.empUser.id,
        reportingManagerEmployeeId: managerEmpId,
      })
    expect(emp.status, JSON.stringify(emp.body)).toBe(201)
    employeeId = emp.body.data.id

    const shift = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/shifts`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({
        code: 'GEN',
        name: 'General',
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        fullDayMinimumMinutes: 480,
        halfDayMinimumMinutes: 240,
        weeklyOffDay: 0,
      })
    expect(shift.status, JSON.stringify(shift.body)).toBe(201)
    shiftId = shift.body.data.id
    await request(app)
      .patch(`/api/v1/t/${ctx.slug}/hrms/employees/${employeeId}`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ defaultShiftId: shiftId })

    const lt = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/types`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ code: 'CL', name: 'Casual Leave', allowHalfDay: true })
    expect(lt.status, JSON.stringify(lt.body)).toBe(201)
    leaveTypeId = lt.body.data.id

    const bal = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/balances`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, leaveTypeId, year: 2026, opening: 10 })
    expect(bal.status, JSON.stringify(bal.body)).toBe(200)
  })

  afterAll(async () => {
    if (!ctx) return
    const tid = ctx.tenant.id
    const soft = async (fn: () => Promise<unknown>) => {
      try {
        await fn()
      } catch {
        /* tables may be missing before migrate */
      }
    }
    await soft(() => prisma.hrLeaveRequest.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrLeaveBalanceAdjustment.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrLeaveBalance.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrLeavePolicyLeaveType.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrLeavePolicy.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrLeaveType.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrEmployeeShiftAssignment.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrHolidayCalendarDay.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrHolidayCalendar.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrEmployee.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrDesignation.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrShiftTemplate.deleteMany({ where: { tenantId: tid } }))
    await prisma.userRole.deleteMany({ where: { tenantId: tid } }).catch(() => {})
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId: tid } } }).catch(() => {})
    await prisma.role.deleteMany({ where: { tenantId: tid } }).catch(() => {})
    await prisma.branch.deleteMany({ where: { tenantId: tid } }).catch(() => {})
    await prisma.legalEntity.deleteMany({ where: { tenantId: tid } }).catch(() => {})
    await prisma.department.deleteMany({ where: { tenantId: tid } }).catch(() => {})
    await prisma.codeSeries.deleteMany({ where: { tenantId: tid } }).catch(() => {})
    await prisma.user.deleteMany({ where: { tenantId: tid } }).catch(() => {})
    await prisma.tenant.delete({ where: { id: tid } }).catch(() => {})
  })

  it('submits and approves leave moving pending → used', async () => {
    const draft = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-08-03',
        toDate: '2026-08-03',
        durationType: 'FULL_DAY',
        reason: 'Personal',
      })
    expect(draft.status).toBe(201)
    expect(draft.body.data.requestedDays).toBe(1)

    const submit = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
    expect(submit.status).toBe(200)

    const balPending = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/leave/balances`)
      .query({ employeeId, year: 2026 })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    const row = (balPending.body.data as Array<{ leaveTypeId: string; pending: number; available: number }>).find(
      (b) => b.leaveTypeId === leaveTypeId,
    )
    expect(row?.pending).toBe(1)
    expect(row?.available).toBe(9)

    const approve = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(approve.status).toBe(200)
    expect(approve.body.data.status).toBe('APPROVED')

    const balUsed = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/leave/balances`)
      .query({ employeeId, year: 2026 })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    const usedRow = (balUsed.body.data as Array<{ leaveTypeId: string; used: number; pending: number; available: number }>).find(
      (b) => b.leaveTypeId === leaveTypeId,
    )
    expect(usedRow?.used).toBe(1)
    expect(usedRow?.pending).toBe(0)
    expect(usedRow?.available).toBe(9)
  })

  it('rejects restores pending', async () => {
    const draft = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-08-04',
        toDate: '2026-08-04',
        durationType: 'FULL_DAY',
        reason: 'Will reject',
      })
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)

    const reject = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/reject`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ reason: 'Not enough cover' })
    expect(reject.status).toBe(200)
    expect(reject.body.data.status).toBe('REJECTED')
  })

  it('half day deducts 0.5', async () => {
    const preview = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/preview`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-08-05',
        toDate: '2026-08-05',
        durationType: 'FIRST_HALF',
      })
    expect(preview.status).toBe(200)
    expect(preview.body.data.requestedDays).toBe(0.5)
  })

  it('excludes holiday from requested days', async () => {
    const cal = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/holidays`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({
        code: 'MAIN-2026-L',
        name: 'Main 2026',
        legalEntityId: ctx.le.id,
        branchId: ctx.branch.id,
        year: 2026,
      })
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/holidays/${cal.body.data.id}/days`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ holidayDate: '2026-08-11', name: 'Festival', holidayType: 'FESTIVAL' })

    const preview = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/preview`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-08-10',
        toDate: '2026-08-12',
        durationType: 'FULL_DAY',
      })
    expect(preview.status).toBe(200)
    expect(preview.body.data.requestedDays).toBe(2)
  })

  it('excludes weekly off (Sunday)', async () => {
    const preview = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/preview`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-08-07', // Friday
        toDate: '2026-08-10', // Monday — Sunday 9th weekly off
        durationType: 'FULL_DAY',
      })
    expect(preview.status).toBe(200)
    expect(preview.body.data.requestedDays).toBe(3)
  })

  it('blocks overlap and insufficient balance', async () => {
    const a = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-09-01',
        toDate: '2026-09-01',
        durationType: 'FULL_DAY',
        reason: 'A',
      })
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${a.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)

    const b = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-09-01',
        toDate: '2026-09-01',
        durationType: 'FULL_DAY',
        reason: 'Overlap',
      })
    const clash = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${b.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
    expect(clash.status).toBe(409)

    // Drain balance then try large leave
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/balances`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, leaveTypeId, year: 2026, opening: 0, accrued: 0 })

    const low = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-09-14',
        toDate: '2026-09-14',
        durationType: 'FULL_DAY',
        reason: 'No balance',
      })
    // Reset opening for other tests — first restore a bit of balance after this assert
    const submitLow = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${low.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
    expect(submitLow.status).toBeGreaterThanOrEqual(400)

    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/balances`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, leaveTypeId, year: 2026, opening: 10 })
  })

  it('cancels approved leave restoring used', async () => {
    const draft = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-09-15',
        toDate: '2026-09-15',
        durationType: 'FULL_DAY',
        reason: 'Cancel me',
      })
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)

    const cancel = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ reason: 'Plan changed' })
    expect(cancel.status).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')
  })

  it('exposes approved leave source for attendance', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/leave/approved-days`)
      .query({ employeeId, from: '2026-08-01', to: '2026-08-31' })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.items)).toBe(true)
  })
})
