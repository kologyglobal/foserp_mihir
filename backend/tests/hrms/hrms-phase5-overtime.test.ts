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

const overtimeTablesReady = dbAvailable
  ? await prisma
      .$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'hr_overtime_records' LIMIT 1`
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
  'hrms.attendance.view',
  'hrms.attendance.manage',
  'hrms.overtime.view',
  'hrms.overtime.create',
  'hrms.overtime.approve',
  'hrms.overtime.manage',
  'hrms.overtime.override_limit',
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
  const slug = `hrms5-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const tenant = await prisma.tenant.create({
    data: { name: 'HRMS Overtime P5', slug, email: `hrms5-${Date.now()}@test.com`, status: 'ACTIVE' },
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
      email: `mgr5-${Date.now()}@test.com`,
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
      email: `emp5-${Date.now()}@test.com`,
      passwordHash: pw,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  const perms = await prisma.permission.findMany({ where: { name: { in: HRMS_PERMS } } })
  const role = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: `Overtime P5 Role ${Date.now()}`,
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

describe.skipIf(!overtimeTablesReady)('HRMS Phase 5 — Overtime', () => {
  let ctx: Awaited<ReturnType<typeof loginTenant>>
  let designationId: string
  let managerEmpId: string
  let employeeId: string
  let shiftId: string
  let policyId: string

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
        otEligible: true,
        weeklyOffDay: 0,
      })
    expect(shift.status, JSON.stringify(shift.body)).toBe(201)
    shiftId = shift.body.data.id
    await request(app)
      .patch(`/api/v1/t/${ctx.slug}/hrms/employees/${employeeId}`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ defaultShiftId: shiftId })

    const policy = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime/policies`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({
        code: 'STD-OT',
        name: 'Standard Overtime',
        legalEntityId: ctx.le.id,
        minimumExtraMinutes: 30,
        roundingMinutes: 15,
        maxOtMinutesPerDay: 180,
        maxOtMinutesPerMonth: 1200,
        weeklyOffOtAllowed: false,
        holidayOtAllowed: false,
        leaveDayOtAllowed: false,
        requireApproval: true,
        effectiveFrom: '2026-01-01',
      })
    expect(policy.status, JSON.stringify(policy.body)).toBe(201)
    policyId = policy.body.data.id
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
    await soft(() => prisma.hrOvertimeRecord.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrOvertimePolicy.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrAttendanceException.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrAttendanceDay.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrAttendancePunch.deleteMany({ where: { tenantId: tid } }))
    await soft(() => prisma.hrEmployeeShiftAssignment.deleteMany({ where: { tenantId: tid } }))
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

  it('policy list reflects the created policy', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/overtime/policies`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.some((p: { id: string }) => p.id === policyId)).toBe(true)
  })

  it('A — punch IN/OUT auto-detects a PENDING OT candidate (not finalized yet)', async () => {
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/attendance/punches`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, punchedAt: '2026-08-10T09:00:00.000Z', punchType: 'IN', source: 'BIOMETRIC' })
    await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/attendance/punches`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, punchedAt: '2026-08-10T20:00:00.000Z', punchType: 'OUT', source: 'BIOMETRIC' })

    const list = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/overtime`)
      .query({ employeeId, from: '2026-08-10', to: '2026-08-10' })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    const record = list.body.data[0]
    expect(record).toBeTruthy()
    expect(record.status).toBe('PENDING')
    // Worked 11h (660m) − 9h shift span (540m) = 120m detected, already a multiple of 15.
    expect(record.detectedMinutes).toBe(120)
    expect(record.eligibleMinutes).toBe(120)
    expect(record.exceptionFlags).toContain('ATTENDANCE_NOT_FINALIZED')
  })

  it('B — finalizing the attendance day clears the not-finalized flag', async () => {
    const res = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/attendance/days/finalize`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, date: '2026-08-10' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.attendanceDay.isFinalized).toBe(true)

    const list = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/overtime`)
      .query({ employeeId, from: '2026-08-10', to: '2026-08-10' })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(list.body.data[0]?.exceptionFlags).not.toContain('ATTENDANCE_NOT_FINALIZED')
  })

  it('C — employee cannot approve their own overtime (self-approve block)', async () => {
    const list = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/overtime`)
      .query({ employeeId, from: '2026-08-10', to: '2026-08-10' })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    const otId = list.body.data[0].id

    const selfApprove = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime/${otId}/approve`)
      .set('Authorization', `Bearer ${ctx.empToken}`)
      .send({ approvedMinutes: 120 })
    expect(selfApprove.status).toBe(403)
  })

  it('D — manager approves within eligible minutes', async () => {
    const list = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/overtime`)
      .query({ employeeId, from: '2026-08-10', to: '2026-08-10' })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    const otId = list.body.data[0].id

    const overLimit = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime/${otId}/approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ approvedMinutes: 200 })
    expect(overLimit.status).toBe(400)

    const approve = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime/${otId}/approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ approvedMinutes: 120 })
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)
    expect(approve.body.data.status).toBe('APPROVED')
    expect(approve.body.data.approvedMinutes).toBe(120)
  })

  it('E — manual OT entry is created PENDING and can be rejected', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, attendanceDate: '2026-08-11', minutes: 60, reason: 'Weekend support call' })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    expect(created.body.data.status).toBe('PENDING')
    expect(created.body.data.source).toBe('MANUAL')

    const rejected = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime/${created.body.data.id}/reject`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ reason: 'Not required' })
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200)
    expect(rejected.body.data.status).toBe('REJECTED')
  })

  it('F — cancel an approved manual OT then revive it via correction', async () => {
    const created = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, attendanceDate: '2026-08-12', minutes: 45, reason: 'Machine breakdown support' })
    expect(created.status).toBe(201)

    const approved = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime/${created.body.data.id}/approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ approvedMinutes: 45 })
    expect(approved.status).toBe(200)

    const cancelled = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime/${created.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ reason: 'Entered against wrong date' })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')

    // Duplicate create is blocked while a non-cancelled record exists, but the unique
    // constraint forces a "correction" to revive the same (now-cancelled) row.
    const revived = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, attendanceDate: '2026-08-12', minutes: 50, reason: 'Corrected minutes' })
    expect(revived.status, JSON.stringify(revived.body)).toBe(201)
    expect(revived.body.data.id).toBe(created.body.data.id)
    expect(revived.body.data.status).toBe('PENDING')
    expect(revived.body.data.detectedMinutes).toBe(50)
  })

  it('G — bulk approve pending manual OT records', async () => {
    const a = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, attendanceDate: '2026-08-13', minutes: 30, reason: 'Bulk A' })
    const b = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ employeeId, attendanceDate: '2026-08-14', minutes: 30, reason: 'Bulk B' })

    const bulk = await request(app)
      .post(`/api/v1/t/${ctx.slug}/hrms/overtime/bulk-approve`)
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
      .send({ ids: [a.body.data.id, b.body.data.id] })
    expect(bulk.status, JSON.stringify(bulk.body)).toBe(200)
    expect(bulk.body.data.approved).toHaveLength(2)
    expect(bulk.body.data.failed).toHaveLength(0)
  })

  it('H — monthly summary aggregates approved minutes for the employee', async () => {
    const res = await request(app)
      .get(`/api/v1/t/${ctx.slug}/hrms/overtime/summary/monthly`)
      .query({ year: 2026, month: 8, employeeId })
      .set('Authorization', `Bearer ${ctx.mgrToken}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const bucket = res.body.data.items.find((i: { employeeId: string }) => i.employeeId === employeeId)
    expect(bucket).toBeTruthy()
    // 120 (Aug 10) + 45→50 (Aug 12 revived, still pending) + 30 + 30 (bulk-approved) = 180 approved
    expect(bucket.approvedMinutes).toBeGreaterThanOrEqual(180)
  })
})

describe.skipIf(overtimeTablesReady)('HRMS Phase 5 — migrate gate', () => {
  it('skips until the overtime migration is deployed', () => {
    expect(overtimeTablesReady).toBe(false)
  })
})
