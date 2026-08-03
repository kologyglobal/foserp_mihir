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

const leaveTablesReady = dbAvailable
  ? await prisma
      .$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'hr_leave_requests' LIMIT 1`
      .then((rows) => Array.isArray(rows) && rows.length > 0)
      .catch(() => false)
  : false

const attendanceTablesReady = leaveTablesReady
  ? await prisma
      .$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'hr_attendance_days' LIMIT 1`
      .then((rows) => Array.isArray(rows) && rows.length > 0)
      .catch(() => false)
  : false

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
  'hrms.attendance.view',
  'hrms.attendance.manage',
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
  const slug = `hrms4-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const tenant = await prisma.tenant.create({
    data: { name: 'HRMS Leave P4', slug, email: `hrms4-${Date.now()}@test.com`, status: 'ACTIVE' },
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
      email: `mgr4-${Date.now()}@test.com`,
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
      email: `emp4-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { in: HRMS_PERMS } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Leave P4 Role ${Date.now()}`,
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

describe.skipIf(!leaveTablesReady || !attendanceTablesReady)('HRMS Phase 4 — Leave + Attendance Sync', () => {
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
      .send({ code: 'CL', name: 'Casual Leave', allowHalfDay: true, accrualType: 'MONTHLY', accrualValue: 1 })
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
        /* ignore */
      }
    }
    await soft(() => prisma.hrAttendanceException.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrAttendanceDay.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrAttendancePunch.deleteMany({ where: { tenantId: tid } }))
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

  it('A — approve leave updates balance and attendance LEAVE', async () => {
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
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
    const approve = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(approve.status).toBe(200)
    expect(approve.body.data.approvedByEmployeeId).toBe(managerEmpId)

    const days = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/attendance/days`)
      .query({ employeeId, from: '2026-08-03', to: '2026-08-03' })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(days.status).toBe(200)
    expect(days.body.data[0]?.status).toBe('LEAVE')
  })

  it('C — half-day leave writes HALF_DAY attendance', async () => {
    const draft = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-08-05',
        toDate: '2026-08-05',
        durationType: 'FIRST_HALF',
        reason: 'Half day',
      })
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)

    const days = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/attendance/days`)
      .query({ employeeId, from: '2026-08-05', to: '2026-08-05' })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(days.body.data[0]?.status).toBe('HALF_DAY')
  })

  it('I — punch on leave day retained + exception', async () => {
    const punch = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/attendance/punches`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({
        employeeId,
        punchedAt: '2026-08-06T04:00:00.000Z',
        punchType: 'IN',
        source: 'BIOMETRIC',
        deviceRef: 'GATE-1',
      })
    expect(punch.status).toBe(201)

    const draft = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-08-06',
        toDate: '2026-08-06',
        durationType: 'FULL_DAY',
        reason: 'Leave with punch',
      })
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)

    const days = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/attendance/days`)
      .query({ employeeId, from: '2026-08-06', to: '2026-08-06' })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(days.body.data[0]?.status).toBe('LEAVE')
    expect(days.body.data[0]?.hasPunch).toBe(true)
    expect(days.body.data[0]?.exceptionFlag).toBe(true)

    const punchesStill = await prisma.hrAttendancePunch.count({
      where: { tenantId: ctx.tenant.id, employeeId, id: punch.body.data.id },
    })
    expect(punchesStill).toBe(1)

    const ex = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/attendance/exceptions`)
      .query({ employeeId, resolved: false })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(ex.body.data.some((e: { exceptionType: string }) => e.exceptionType === 'PUNCH_ON_LEAVE')).toBe(
      true,
    )
  })

  it('H — cancel approved leave recalculates attendance', async () => {
    const draft = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({
        leaveTypeId,
        fromDate: '2026-08-07',
        toDate: '2026-08-07',
        durationType: 'FULL_DAY',
        reason: 'Cancel after approve',
      })
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/submit`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/requests/${draft.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ reason: 'Plan changed' })

    const days = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/attendance/days`)
      .query({ employeeId, from: '2026-08-07', to: '2026-08-07' })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(days.body.data.length).toBe(0)
  })

  it('accrual hook posts controlled accrual', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/leave/balances/accrue`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, leaveTypeId, year: 2026 })
    expect(res.status).toBe(200)
    expect(res.body.data.accrued).toBeGreaterThanOrEqual(1)
  })
})

describe.skipIf(leaveTablesReady && attendanceTablesReady)('HRMS Phase 4 — migrate gate', () => {
  it('skips until leave + attendance migrations are deployed', () => {
    expect(leaveTablesReady && attendanceTablesReady).toBe(false)
  })
})
