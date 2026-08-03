import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { sumPayableInRange, type PaidDayEntry } from '../../src/modules/hrms/payroll/paid-days.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const payrollTablesReady = dbAvailable
  ? await prisma
      .$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'hr_payroll_runs' LIMIT 1`
      .then((rows) => Array.isArray(rows) && rows.length > 0)
      .catch(() => false)
  : false

const HRMS_PAYROLL_PERMS: PermissionName[] = [
  'hrms.employee.view',
  'hrms.employee.create',
  'hrms.employee.edit',
  'hrms.designation.view',
  'hrms.designation.manage',
  'hrms.shift.view',
  'hrms.shift.manage',
  'hrms.attendance.view',
  'hrms.attendance.manage',
  'hrms.salary.component.view',
  'hrms.salary.component.manage',
  'hrms.salary.structure.view',
  'hrms.salary.structure.manage',
  'hrms.salary.assignment.view',
  'hrms.salary.assignment.manage',
  'hrms.payroll.view',
  'hrms.payroll.create',
  'hrms.payroll.calculate',
  'hrms.payroll.review',
  'hrms.payroll.finalize',
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

function dayEntry(date: string, payable: number, present = payable): PaidDayEntry {
  return {
    date,
    present,
    paidLeave: 0,
    unpaidLeave: 0,
    lop: 1 - payable,
    weeklyOff: 0,
    holiday: 0,
    payable,
    note: null,
  }
}

describe('HRMS Phase 7 — paid days (unit)', () => {
  it('sumPayableInRange sums payable within inclusive date range', () => {
    const days = [
      dayEntry('2026-07-01', 1),
      dayEntry('2026-07-02', 1),
      dayEntry('2026-07-03', 0.5, 0.5),
      dayEntry('2026-07-10', 1),
    ]
    expect(sumPayableInRange(days, new Date('2026-07-01'), new Date('2026-07-03'))).toBe(2.5)
    expect(sumPayableInRange(days, new Date('2026-07-10'), new Date('2026-07-10'))).toBe(1)
  })
})

describe.skipIf(!payrollTablesReady)('HRMS Phase 7 — Payroll Run & Calculation (live)', () => {
  let tenantSlug = ''
  let tenantId = ''
  let managerToken = ''
  let supervisorToken = ''
  let otherTenantToken = ''
  let legalEntityId = ''
  let branchId = ''
  let employeeId = ''
  let shiftId = ''
  let periodId = ''
  let runId = ''
  let employeeResultId = ''
  const componentIds: Record<string, string> = {}
  let versionId = ''
  const cleanupTenantIds: string[] = []

  const payrollBase = () => `/api/v1/t/${tenantSlug}/hrms/payroll`
  const salaryBase = () => `/api/v1/t/${tenantSlug}/hrms/salary`

  beforeAll(async () => {
    await ensurePermissions()
    const { hashPassword } = await import('../../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const slug = `hrms7-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'HRMS Payroll P7', slug, email: `hrms7-${Date.now()}@test.com`, status: 'ACTIVE' },
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
        email: `mgr7-${Date.now()}@test.com`,
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
        email: `sup7-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })

    const payrollPerms = await prisma.permission.findMany({ where: { name: { in: HRMS_PAYROLL_PERMS } } })
    const mgrRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Payroll P7 Role ${Date.now()}`,
        rolePermissions: { create: payrollPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: managerUser.id, roleId: mgrRole.id, tenantId: tenant.id } })

    const supPerms = await prisma.permission.findMany({ where: { name: { in: SUPERVISOR_PERMS } } })
    const supRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Supervisor P7 ${Date.now()}`,
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
    legalEntityId = le.id
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
    branchId = branch.id
    const dept = await prisma.department.create({
      data: { tenantId: tenant.id, code: 'PROD', name: 'Production' },
    })
    const desig = await prisma.hrDesignation.create({
      data: { tenantId: tenant.id, code: 'WRK', name: 'Worker', isActive: true },
    })

    const shift = await prisma.hrShiftTemplate.create({
      data: {
        tenantId: tenant.id,
        code: 'GEN',
        name: 'General',
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        fullDayMinimumMinutes: 480,
        halfDayMinimumMinutes: 240,
        otEligible: true,
        weeklyOffDay: 0,
        isActive: true,
      },
    })
    shiftId = shift.id

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
        defaultShiftId: shiftId,
        workerCategory: 'WORKER',
        employmentType: 'PERMANENT',
        status: 'ACTIVE',
        joinDate: new Date('2024-01-01'),
      },
    })
    employeeId = emp.id

    // Phase 8 statutory engine now runs for every payroll calculation; this fixture predates
    // statutory rule setup, so opt the test employee out of PF/ESIC/PT/TDS/LWF entirely —
    // statutory calculation itself is covered by the dedicated Phase 8 tests.
    await prisma.hrEmployeeStatutoryDetail.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp.id,
        pfApplicable: false,
        esicApplicable: false,
        ptApplicable: false,
        tdsApplicable: false,
        lwfApplicable: false,
        overrideReason: 'Phase 7 payroll fixture — statutory coverage lives in Phase 8 tests',
      },
    })

    const other = await prisma.tenant.create({
      data: {
        name: 'Other P7',
        slug: `hrms7o-${Date.now()}`,
        email: `hrms7o-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
    })
    cleanupTenantIds.push(other.id)
    const otherUser = await prisma.user.create({
      data: {
        tenantId: other.id,
        firstName: 'Other',
        lastName: 'Admin',
        email: `other7-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const otherPerms = await prisma.permission.findMany({ where: { name: { in: HRMS_PAYROLL_PERMS } } })
    const otherRole = await prisma.role.create({
      data: {
        tenantId: other.id,
        name: `Other P7 ${Date.now()}`,
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

    // Salary components + structure (Phase 6 prerequisite)
    const defs = [
      { code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED' },
      { code: 'HRA', name: 'HRA', type: 'EARNING', calculationType: 'PERCENTAGE' },
      { code: 'SPECIAL', name: 'Special Allowance', type: 'EARNING', calculationType: 'FIXED' },
      { code: 'OT', name: 'Overtime', type: 'EARNING', calculationType: 'OT_LINKED' },
      { code: 'PF', name: 'PF', type: 'DEDUCTION', calculationType: 'STATUTORY' },
    ]
    for (const d of defs) {
      const res = await request(app)
        .post(`${salaryBase()}/components`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(d)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      componentIds[d.code] = res.body.data.id
    }

    const structure = await request(app)
      .post(`${salaryBase()}/structures`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ code: 'WORKER-GRADE-A', name: 'Worker Grade A', workerCategory: 'WORKER' })
    expect(structure.status, JSON.stringify(structure.body)).toBe(201)

    const version = await request(app)
      .post(`${salaryBase()}/structures/${structure.body.data.id}/versions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ effectiveFrom: '2026-01-01' })
    expect(version.status, JSON.stringify(version.body)).toBe(201)
    versionId = version.body.data.id

    const lines = await request(app)
      .patch(`${salaryBase()}/versions/${versionId}`)
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
            fixedAmount: 200,
          },
          {
            salaryComponentId: componentIds.PF,
            sequence: 50,
            calculationType: 'STATUTORY',
          },
        ],
      })
    expect(lines.status, JSON.stringify(lines.body)).toBe(200)

    await request(app)
      .post(`${salaryBase()}/versions/${versionId}/activate`)
      .set('Authorization', `Bearer ${managerToken}`)

    const assign = await request(app)
      .post(`${salaryBase()}/assignments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        employeeId,
        salaryStructureVersionId: versionId,
        effectiveFrom: '2026-01-01',
        monthlyGross: 25000,
        annualCtc: 300000,
      })
    expect(assign.status, JSON.stringify(assign.body)).toBe(201)

    // Attendance — pragmatic subset of July 2026 (weekdays + one ABSENT)
    const presentDates = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-14']
    for (const d of presentDates) {
      await prisma.hrAttendanceDay.upsert({
        where: {
          tenantId_employeeId_attendanceDate: {
            tenantId,
            employeeId,
            attendanceDate: new Date(`${d}T00:00:00.000Z`),
          },
        },
        create: {
          tenantId,
          employeeId,
          attendanceDate: new Date(`${d}T00:00:00.000Z`),
          status: 'PRESENT',
          shiftId,
          source: 'MANUAL',
          isFinalized: true,
        },
        update: { status: 'PRESENT', isFinalized: true },
      })
    }
    await prisma.hrAttendanceDay.upsert({
      where: {
        tenantId_employeeId_attendanceDate: {
          tenantId,
          employeeId,
          attendanceDate: new Date('2026-07-13T00:00:00.000Z'),
        },
      },
      create: {
        tenantId,
        employeeId,
        attendanceDate: new Date('2026-07-13T00:00:00.000Z'),
        status: 'ABSENT',
        shiftId,
        source: 'MANUAL',
        isFinalized: true,
      },
      update: { status: 'ABSENT', isFinalized: true },
    })

    // Approved OT for July 2026
    await prisma.hrOvertimeRecord.upsert({
      where: {
        tenantId_employeeId_attendanceDate: {
          tenantId,
          employeeId,
          attendanceDate: new Date('2026-07-10T00:00:00.000Z'),
        },
      },
      create: {
        tenantId,
        employeeId,
        attendanceDate: new Date('2026-07-10T00:00:00.000Z'),
        shiftId,
        detectedMinutes: 120,
        eligibleMinutes: 120,
        approvedMinutes: 120,
        status: 'APPROVED',
        approvedAt: new Date(),
        source: 'ATTENDANCE',
      },
      update: {
        approvedMinutes: 120,
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    })
  }, 180_000)

  afterAll(async () => {
    for (const id of cleanupTenantIds) {
      await prisma.hrPayrollComponentResult.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollException.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollEmployeeResult.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollRun.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollPeriod.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrOvertimeRecord.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrAttendanceDay.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployeeSalaryAssignment.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructureLine.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructureVersion.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructure.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryComponent.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployee.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrShiftTemplate.deleteMany({ where: { tenantId: id } }).catch(() => {})
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

  it('creates payroll period and blocks duplicate', async () => {
    const create = await request(app)
      .post(`${payrollBase()}/periods`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ legalEntityId, year: 2026, month: 7 })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    periodId = create.body.data.id
    expect(create.body.data.year).toBe(2026)
    expect(create.body.data.month).toBe(7)
    expect(create.body.data.status).toBe('OPEN')

    const dup = await request(app)
      .post(`${payrollBase()}/periods`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ legalEntityId, year: 2026, month: 7 })
    expect(dup.status).toBe(409)
  })

  it('creates run, calculates, reviews, finalizes, blocks recalculate', async () => {
    const createRun = await request(app)
      .post(`${payrollBase()}/runs`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ payrollPeriodId: periodId, branchId })
    expect(createRun.status, JSON.stringify(createRun.body)).toBe(201)
    runId = createRun.body.data.id
    expect(createRun.body.data.status).toBe('DRAFT')

    const calc = await request(app)
      .post(`${payrollBase()}/runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(calc.status, JSON.stringify(calc.body)).toBe(200)
    expect(calc.body.data.status).toBe('CALCULATED')
    expect(calc.body.data.employeeCount).toBeGreaterThanOrEqual(1)

    const employees = await request(app)
      .get(`${payrollBase()}/runs/${runId}/employees`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(employees.status, JSON.stringify(employees.body)).toBe(200)
    expect(employees.body.data.length).toBeGreaterThanOrEqual(1)

    const rajesh = employees.body.data.find((r: { employeeId: string }) => r.employeeId === employeeId)
    expect(rajesh).toBeTruthy()
    expect(rajesh.status).toBe('CALCULATED')
    expect(rajesh.payableDays).toBeGreaterThan(0)
    expect(rajesh.grossAmount).toBeGreaterThan(0)
    employeeResultId = rajesh.id

    const detail = await request(app)
      .get(`${payrollBase()}/runs/${runId}/employees/${employeeResultId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(detail.status, JSON.stringify(detail.body)).toBe(200)
    const codes = detail.body.data.components.map((c: { componentCode: string }) => c.componentCode)
    expect(codes).toContain('BASIC')
    expect(codes).toContain('HRA')
    expect(codes).toContain('OT')

    const review = await request(app)
      .post(`${payrollBase()}/runs/${runId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(review.status, JSON.stringify(review.body)).toBe(200)
    expect(review.body.data.status).toBe('REVIEWED')

    const finalize = await request(app)
      .post(`${payrollBase()}/runs/${runId}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(finalize.status, JSON.stringify(finalize.body)).toBe(200)
    expect(finalize.body.data.status).toBe('FINALIZED')

    const recalc = await request(app)
      .post(`${payrollBase()}/runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(recalc.status).toBeGreaterThanOrEqual(400)
  })

  it('permissions — supervisor without payroll perms gets 403', async () => {
    const list = await request(app)
      .get(`${payrollBase()}/runs`)
      .set('Authorization', `Bearer ${supervisorToken}`)
    expect(list.status).toBe(403)

    if (runId) {
      const calc = await request(app)
        .post(`${payrollBase()}/runs/${runId}/calculate`)
        .set('Authorization', `Bearer ${supervisorToken}`)
      expect(calc.status).toBe(403)
    }
  })

  it('tenant isolation', async () => {
    if (!periodId) return
    const res = await request(app)
      .get(`${payrollBase()}/periods/${periodId}`)
      .set('Authorization', `Bearer ${otherTenantToken}`)
    expect([403, 404]).toContain(res.status)

    if (runId) {
      const runRes = await request(app)
        .get(`${payrollBase()}/runs/${runId}`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
      expect([403, 404]).toContain(runRes.status)
    }
  })
})
