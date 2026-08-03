import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Prisma } from '@prisma/client'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { UnprocessableEntityError } from '../../src/utils/errors.js'
import { buildPayrollAccrualBuckets } from '../../src/modules/hrms/payroll/payroll-accounting.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const phase9TablesReady = dbAvailable
  ? await prisma
      .$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'hr_payslips' LIMIT 1`
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
  'hrms.payslip.view',
  'hrms.payslip.generate',
  'hrms.payroll.accounting.view',
  'hrms.payroll.accounting.post',
  'hrms.salary_payment.view',
  'hrms.salary_payment.create',
  'hrms.salary_payment.approve',
  'hrms.salary_payment.confirm',
  'hrms.salary_payment.export',
  'organisation.view',
  'finance.legal_entity.view',
  'finance.branch.view',
  'department.view',
]

const SUPERVISOR_PERMS: PermissionName[] = [
  'hrms.employee.view',
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

function decimalComponent(type: string, componentCode: string, calculationType: string, amount: number) {
  return { type, componentCode, calculationType, amount: new Prisma.Decimal(amount) }
}

// ─── Unit tests — buildPayrollAccrualBuckets (no DB) ─────────────────────────

describe('HRMS Phase 9 — payroll accounting buckets (unit)', () => {
  it('produces a balanced Dr=Cr entry for BASIC/HRA/OT earnings + PF/ESIC employer & employee + SALARY_PAYABLE', () => {
    // Net = gross (22000) − employee deductions (2535) = 19465.
    const results = [
      {
        netAmount: new Prisma.Decimal(19465),
        components: [
          decimalComponent('EARNING', 'BASIC', 'FIXED', 15000),
          decimalComponent('EARNING', 'HRA', 'PERCENTAGE', 6000),
          decimalComponent('EARNING', 'OT', 'OT_LINKED', 1000),
          decimalComponent('EMPLOYER_CONTRIBUTION', 'PF_EMPLOYER', 'STATUTORY', 1800),
          decimalComponent('EMPLOYER_CONTRIBUTION', 'ESIC_EMPLOYER', 'STATUTORY', 715),
          decimalComponent('DEDUCTION', 'PF_EMPLOYEE', 'STATUTORY', 1800),
          decimalComponent('DEDUCTION', 'ESIC_EMPLOYEE', 'STATUTORY', 165),
          decimalComponent('DEDUCTION', 'PT', 'STATUTORY', 200),
          decimalComponent('DEDUCTION', 'TDS', 'STATUTORY', 370),
        ],
      },
    ]

    const buckets = buildPayrollAccrualBuckets(results)

    expect(buckets.get('SALARY_BASIC_EXPENSE')?.debit.toNumber()).toBe(15000)
    expect(buckets.get('SALARY_HRA_EXPENSE')?.debit.toNumber()).toBe(6000)
    expect(buckets.get('SALARY_OT_EXPENSE')?.debit.toNumber()).toBe(1000)
    expect(buckets.get('PF_EMPLOYER_EXPENSE')?.debit.toNumber()).toBe(1800)
    expect(buckets.get('PF_EMPLOYER_PAYABLE')?.credit.toNumber()).toBe(1800)
    expect(buckets.get('ESIC_EMPLOYER_EXPENSE')?.debit.toNumber()).toBe(715)
    expect(buckets.get('ESIC_EMPLOYER_PAYABLE')?.credit.toNumber()).toBe(715)
    expect(buckets.get('PF_EMPLOYEE_PAYABLE')?.credit.toNumber()).toBe(1800)
    expect(buckets.get('ESIC_EMPLOYEE_PAYABLE')?.credit.toNumber()).toBe(165)
    expect(buckets.get('PT_PAYABLE')?.credit.toNumber()).toBe(200)
    expect(buckets.get('TDS_SALARY_PAYABLE')?.credit.toNumber()).toBe(370)
    expect(buckets.get('SALARY_PAYABLE')?.credit.toNumber()).toBe(19465)

    let totalDebit = 0
    let totalCredit = 0
    for (const bucket of buckets.values()) {
      totalDebit += bucket.debit.toNumber()
      totalCredit += bucket.credit.toNumber()
    }
    expect(totalDebit).toBe(totalCredit)
  })

  it('aggregates buckets across multiple employees and skips zero-amount components', () => {
    const results = [
      {
        netAmount: new Prisma.Decimal(15000),
        components: [
          decimalComponent('EARNING', 'BASIC', 'FIXED', 15000),
          decimalComponent('EARNING', 'HRA', 'PERCENTAGE', 0), // zero — must be ignored
        ],
      },
      {
        // Simulated LOP employee: prorated BASIC is lower than a full month.
        netAmount: new Prisma.Decimal(10000),
        components: [decimalComponent('EARNING', 'BASIC', 'FIXED', 10000)],
      },
    ]

    const buckets = buildPayrollAccrualBuckets(results)

    expect(buckets.get('SALARY_BASIC_EXPENSE')?.debit.toNumber()).toBe(25000)
    expect(buckets.has('SALARY_HRA_EXPENSE')).toBe(false)
    expect(buckets.get('SALARY_PAYABLE')?.credit.toNumber()).toBe(25000)

    let totalDebit = 0
    let totalCredit = 0
    for (const bucket of buckets.values()) {
      totalDebit += bucket.debit.toNumber()
      totalCredit += bucket.credit.toNumber()
    }
    expect(totalDebit).toBe(totalCredit)
  })

  it('throws MISSING_PAYROLL_ACCOUNT_MAPPING for an unrecognised deduction component', () => {
    const results = [
      {
        netAmount: new Prisma.Decimal(14500),
        components: [
          decimalComponent('EARNING', 'BASIC', 'FIXED', 15000),
          decimalComponent('DEDUCTION', 'CANTEEN', 'FIXED', 500),
        ],
      },
    ]

    try {
      buildPayrollAccrualBuckets(results)
      expect.unreachable('buildPayrollAccrualBuckets should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityError)
      expect((err as UnprocessableEntityError).code).toBe('MISSING_PAYROLL_ACCOUNT_MAPPING')
    }
  })

  it('throws MISSING_PAYROLL_ACCOUNT_MAPPING for an unrecognised employer contribution component', () => {
    const results = [
      {
        netAmount: new Prisma.Decimal(15000),
        components: [
          decimalComponent('EARNING', 'BASIC', 'FIXED', 15000),
          decimalComponent('EMPLOYER_CONTRIBUTION', 'GRATUITY_ACCRUAL', 'FIXED', 300),
        ],
      },
    ]

    try {
      buildPayrollAccrualBuckets(results)
      expect.unreachable('buildPayrollAccrualBuckets should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityError)
      expect((err as UnprocessableEntityError).code).toBe('MISSING_PAYROLL_ACCOUNT_MAPPING')
    }
  })

  it('nets LOP deduction against SALARY_BASIC_EXPENSE and stays balanced', () => {
    const results = [
      {
        netAmount: new Prisma.Decimal(14000),
        components: [
          decimalComponent('EARNING', 'BASIC', 'FIXED', 15000),
          decimalComponent('DEDUCTION', 'LOP', 'ATTENDANCE_LINKED', 1000),
        ],
      },
    ]
    const buckets = buildPayrollAccrualBuckets(results)
    expect(buckets.get('SALARY_BASIC_EXPENSE')?.debit.toNumber()).toBe(15000)
    expect(buckets.get('SALARY_BASIC_EXPENSE')?.credit.toNumber()).toBe(1000)
    expect(buckets.get('SALARY_PAYABLE')?.credit.toNumber()).toBe(14000)
    let totalDebit = 0
    let totalCredit = 0
    for (const bucket of buckets.values()) {
      totalDebit += bucket.debit.toNumber()
      totalCredit += bucket.credit.toNumber()
    }
    expect(totalDebit).toBe(totalCredit)
  })
})

// ─── Live tests — payslips, accounting post, salary payment batches ─────────

describe.skipIf(!phase9TablesReady)('HRMS Phase 9 — Payslip, Accounting & Salary Payment (live)', () => {
  let tenantSlug = ''
  let tenantId = ''
  let managerToken = ''
  let supervisorToken = ''
  let otherTenantToken = ''
  let legalEntityId = ''
  let branchId = ''
  let employeeId = ''
  let shiftId = ''
  let runId = ''
  let employeeResultId = ''
  let payslipId = ''
  let batchId = ''
  const componentIds: Record<string, string> = {}
  const cleanupTenantIds: string[] = []

  const payrollBase = () => `/api/v1/t/${tenantSlug}/hrms/payroll`
  const salaryBase = () => `/api/v1/t/${tenantSlug}/hrms/salary`

  beforeAll(async () => {
    await ensurePermissions()
    const { hashPassword } = await import('../../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const slug = `hrms9-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'HRMS Payslip P9', slug, email: `hrms9-${Date.now()}@test.com`, status: 'ACTIVE' },
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
        email: `mgr9-${Date.now()}@test.com`,
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
        email: `sup9-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })

    const payrollPerms = await prisma.permission.findMany({ where: { name: { in: HRMS_PAYROLL_PERMS } } })
    const mgrRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Payslip P9 Role ${Date.now()}`,
        rolePermissions: { create: payrollPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: managerUser.id, roleId: mgrRole.id, tenantId: tenant.id } })

    const supPerms = await prisma.permission.findMany({ where: { name: { in: SUPERVISOR_PERMS } } })
    const supRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Supervisor P9 ${Date.now()}`,
        rolePermissions: { create: supPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: supervisorUser.id, roleId: supRole.id, tenantId: tenant.id } })

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
        firstName: 'Anita',
        lastName: 'Deshmukh',
        displayName: 'Anita Deshmukh',
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

    // No statutory setup in Phase 9 fixture — opt the employee out entirely so the
    // accrual buckets stay to BASIC/HRA/SALARY_PAYABLE only (statutory covered in Phase 8).
    await prisma.hrEmployeeStatutoryDetail.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp.id,
        pfApplicable: false,
        esicApplicable: false,
        ptApplicable: false,
        tdsApplicable: false,
        lwfApplicable: false,
        overrideReason: 'Phase 9 payslip/accounting/payment fixture — statutory coverage lives in Phase 8 tests',
      },
    })

    const other = await prisma.tenant.create({
      data: {
        name: 'Other P9',
        slug: `hrms9o-${Date.now()}`,
        email: `hrms9o-${Date.now()}@test.com`,
        status: 'ACTIVE',
      },
    })
    cleanupTenantIds.push(other.id)
    const otherUser = await prisma.user.create({
      data: {
        tenantId: other.id,
        firstName: 'Other',
        lastName: 'Admin',
        email: `other9-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const otherPerms = await prisma.permission.findMany({ where: { name: { in: HRMS_PAYROLL_PERMS } } })
    const otherRole = await prisma.role.create({
      data: {
        tenantId: other.id,
        name: `Other P9 ${Date.now()}`,
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

    // Salary components + structure: BASIC + HRA only (keeps GL buckets to two expense keys).
    const defs = [
      { code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED' },
      { code: 'HRA', name: 'HRA', type: 'EARNING', calculationType: 'PERCENTAGE' },
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
      .send({ code: 'WORKER-GRADE-P9', name: 'Worker Grade P9', workerCategory: 'WORKER' })
    expect(structure.status, JSON.stringify(structure.body)).toBe(201)

    const version = await request(app)
      .post(`${salaryBase()}/structures/${structure.body.data.id}/versions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ effectiveFrom: '2026-01-01' })
    expect(version.status, JSON.stringify(version.body)).toBe(201)
    const versionId = version.body.data.id

    const lines = await request(app)
      .patch(`${salaryBase()}/versions/${versionId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        lines: [
          { salaryComponentId: componentIds.BASIC, sequence: 10, calculationType: 'FIXED', fixedAmount: 15000 },
          {
            salaryComponentId: componentIds.HRA,
            sequence: 20,
            calculationType: 'PERCENTAGE',
            percentage: 40,
            percentageOfComponentId: componentIds.BASIC,
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
        monthlyGross: 21000,
        annualCtc: 252000,
      })
    expect(assign.status, JSON.stringify(assign.body)).toBe(201)

    // Mark every non-Sunday day of July 2026 PRESENT for a deterministic full-month payslip.
    for (let d = 1; d <= 31; d += 1) {
      const date = new Date(Date.UTC(2026, 6, d))
      if (date.getUTCMonth() !== 6) break
      if (date.getUTCDay() === 0) continue
      await prisma.hrAttendanceDay.upsert({
        where: { tenantId_employeeId_attendanceDate: { tenantId, employeeId, attendanceDate: date } },
        create: { tenantId, employeeId, attendanceDate: date, status: 'PRESENT', shiftId, source: 'MANUAL', isFinalized: true },
        update: { status: 'PRESENT', isFinalized: true },
      })
    }
  }, 180_000)

  afterAll(async () => {
    for (const id of cleanupTenantIds) {
      await prisma.hrSalaryPaymentLine.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryPaymentBatch.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayslip.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployeeBankDetail.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.treasuryAccount.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.account.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollComponentResult.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollException.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollEmployeeResult.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollRun.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollPeriod.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployeeSalaryAssignment.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructureLine.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructureVersion.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructure.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryComponent.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployeeStatutoryDetail.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrAttendanceDay.deleteMany({ where: { tenantId: id } }).catch(() => {})
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

  it('runs payroll period → run → calculate → review → finalize (Phase 7/8 prerequisite)', async () => {
    const period = await request(app)
      .post(`${payrollBase()}/periods`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ legalEntityId, year: 2026, month: 7 })
    expect(period.status, JSON.stringify(period.body)).toBe(201)
    const periodId = period.body.data.id

    const run = await request(app)
      .post(`${payrollBase()}/runs`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ payrollPeriodId: periodId, branchId })
    expect(run.status, JSON.stringify(run.body)).toBe(201)
    runId = run.body.data.id

    const calc = await request(app)
      .post(`${payrollBase()}/runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(calc.status, JSON.stringify(calc.body)).toBe(200)

    const employees = await request(app)
      .get(`${payrollBase()}/runs/${runId}/employees`)
      .set('Authorization', `Bearer ${managerToken}`)
    const row = employees.body.data.find((r: { employeeId: string }) => r.employeeId === employeeId)
    expect(row).toBeTruthy()
    expect(row.grossAmount).toBeGreaterThan(0)
    employeeResultId = row.id

    // Payslips can only be generated once the run is FINALIZED.
    const tooEarly = await request(app)
      .post(`${payrollBase()}/runs/${runId}/payslips/generate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(tooEarly.status).toBe(422)

    const review = await request(app)
      .post(`${payrollBase()}/runs/${runId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(review.status, JSON.stringify(review.body)).toBe(200)

    const finalize = await request(app)
      .post(`${payrollBase()}/runs/${runId}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(finalize.status, JSON.stringify(finalize.body)).toBe(200)
    expect(finalize.body.data.status).toBe('FINALIZED')
  })

  it('generates payslips idempotently from the finalized run with an immutable snapshot', async () => {
    const gen1 = await request(app)
      .post(`${payrollBase()}/runs/${runId}/payslips/generate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(gen1.status, JSON.stringify(gen1.body)).toBe(200)
    expect(gen1.body.data.generatedCount).toBe(1)
    expect(gen1.body.data.totalPayslips).toBe(1)
    payslipId = gen1.body.data.payslipIds[0]

    // Idempotent — regenerating for the same run creates no duplicates.
    const gen2 = await request(app)
      .post(`${payrollBase()}/runs/${runId}/payslips/generate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(gen2.status, JSON.stringify(gen2.body)).toBe(200)
    expect(gen2.body.data.generatedCount).toBe(0)
    expect(gen2.body.data.totalPayslips).toBe(1)

    const detail = await request(app)
      .get(`${payrollBase()}/payslips/${payslipId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(detail.status, JSON.stringify(detail.body)).toBe(200)
    expect(detail.body.data.snapshot.header.employeeCode).toBe('EMP000001')
    const codes = detail.body.data.snapshot.earnings.map((e: { code: string }) => e.code)
    expect(codes).toContain('BASIC')
    expect(codes).toContain('HRA')
    const originalNetPay = detail.body.data.snapshot.totals.netPay
    expect(originalNetPay).toBeGreaterThan(0)
    expect(detail.body.data.netAmount).toBe(originalNetPay)

    // Snapshot immutability: mutate the frozen component result directly, then confirm
    // the payslip snapshot returned by the API is untouched (never re-derived live).
    await prisma.hrPayrollComponentResult.updateMany({
      where: { tenantId, payrollEmployeeResultId: employeeResultId, componentCode: 'BASIC' },
      data: { amount: new Prisma.Decimal(999999) },
    })

    const detailAfterMutation = await request(app)
      .get(`${payrollBase()}/payslips/${payslipId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(detailAfterMutation.status).toBe(200)
    expect(detailAfterMutation.body.data.snapshot.totals.netPay).toBe(originalNetPay)
    expect(detailAfterMutation.body.data.netAmount).toBe(originalNetPay)

    const html = await request(app)
      .get(`${payrollBase()}/payslips/${payslipId}/html`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(html.status).toBe(200)
    expect(html.headers['content-type']).toContain('text/html')
    expect(html.text).toContain('Anita Deshmukh')

    const list = await request(app)
      .get(`${payrollBase()}/payslips`)
      .set('Authorization', `Bearer ${managerToken}`)
      .query({ payrollRunId: runId })
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    expect(list.body.data.length).toBe(1)
    expect(list.body.data[0].paymentStatus).toBe('UNPAID')
  })

  it('permissions — supervisor without payslip perms is denied view + generate', async () => {
    const list = await request(app)
      .get(`${payrollBase()}/payslips`)
      .set('Authorization', `Bearer ${supervisorToken}`)
    expect(list.status).toBe(403)

    const generate = await request(app)
      .post(`${payrollBase()}/runs/${runId}/payslips/generate`)
      .set('Authorization', `Bearer ${supervisorToken}`)
    expect(generate.status).toBe(403)

    const detail = await request(app)
      .get(`${payrollBase()}/payslips/${payslipId}`)
      .set('Authorization', `Bearer ${supervisorToken}`)
    expect(detail.status).toBe(403)
  })

  it('payroll accounting: returns MISSING_PAYROLL_ACCOUNT_MAPPING when default mappings are absent', async () => {
    const status0 = await request(app)
      .get(`${payrollBase()}/runs/${runId}/accounting`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(status0.status, JSON.stringify(status0.body)).toBe(200)
    expect(status0.body.data.accountingStatus).toBe('NOT_POSTED')

    const post = await request(app)
      .post(`${payrollBase()}/runs/${runId}/accounting/post`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(post.status, JSON.stringify(post.body)).toBe(422)
    expect(post.body.code).toBe('MISSING_PAYROLL_ACCOUNT_MAPPING')
    expect(post.body.missingKeys).toEqual(
      expect.arrayContaining(['SALARY_BASIC_EXPENSE', 'SALARY_HRA_EXPENSE', 'SALARY_PAYABLE']),
    )
  })

  it('permissions — supervisor without accounting perms is denied view + post', async () => {
    const status = await request(app)
      .get(`${payrollBase()}/runs/${runId}/accounting`)
      .set('Authorization', `Bearer ${supervisorToken}`)
    expect(status.status).toBe(403)

    const post = await request(app)
      .post(`${payrollBase()}/runs/${runId}/accounting/post`)
      .set('Authorization', `Bearer ${supervisorToken}`)
    expect(post.status).toBe(403)
  })

  it('salary payment batch is blocked until payroll accounting is POSTED', async () => {
    const attempt = await request(app)
      .post(`${payrollBase()}/payment-batches`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        payrollRunId: runId,
        treasuryAccountId: '00000000-0000-0000-0000-000000000000',
        paymentDate: '2026-08-01',
      })
    expect(attempt.status, JSON.stringify(attempt.body)).toBe(422)
    expect(attempt.body.code).toBe('PAYROLL_ACCOUNTING_NOT_POSTED')
  })

  it('validates employee bank details, prevents duplicate batches, enforces the DRAFT→READY→APPROVED lifecycle', async () => {
    // Fake a POSTED accrual (bypasses the real GL/CoA setup — accounting posting itself
    // is covered by the MISSING_PAYROLL_ACCOUNT_MAPPING test above) so we can exercise
    // payment-batch validation, which does not depend on the posting engine.
    await prisma.hrPayrollRun.update({ where: { id: runId }, data: { accountingStatus: 'POSTED' } })

    const glAccount = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId,
        accountCode: `BANK-P9-${Date.now()}`.slice(0, 32),
        accountName: 'Bank Current Account',
        category: 'ASSET',
        accountType: 'GENERAL',
        level: 1,
        isGroup: false,
        isActive: true,
        normalBalance: 'DEBIT',
        allowManualPosting: true,
      },
    })
    const treasuryAccount = await prisma.treasuryAccount.create({
      data: {
        tenantId,
        legalEntityId,
        code: `BANK-P9-${Date.now()}`.slice(0, 32),
        name: 'Bank Current Account',
        accountType: 'CASH',
        status: 'ACTIVE',
        glAccountId: glAccount.id,
      },
    })

    // No bank details on file yet — creation must be blocked.
    const noBank = await request(app)
      .post(`${payrollBase()}/payment-batches`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ payrollRunId: runId, treasuryAccountId: treasuryAccount.id, paymentDate: '2026-08-01' })
    expect(noBank.status, JSON.stringify(noBank.body)).toBe(422)
    expect(noBank.body.code).toBe('INVALID_EMPLOYEE_BANK_DETAILS')
    expect(noBank.body.invalidEmployees?.[0]?.employeeId).toBe(employeeId)

    await prisma.hrEmployeeBankDetail.create({
      data: {
        tenantId,
        employeeId,
        bankName: 'State Bank',
        accountHolderName: 'Anita Deshmukh',
        accountNumber: '123456789012',
        ifsc: 'SBIN0001234',
        isPrimary: true,
      },
    })

    const create = await request(app)
      .post(`${payrollBase()}/payment-batches`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ payrollRunId: runId, treasuryAccountId: treasuryAccount.id, paymentDate: '2026-08-01' })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    batchId = create.body.data.id
    expect(create.body.data.status).toBe('DRAFT')
    expect(create.body.data.employeeCount).toBe(1)
    expect(create.body.data.lines[0].accountNumberMasked).not.toBe('123456789012')

    // Duplicate prevention — the payslip is already batched (PENDING) on this run.
    const duplicate = await request(app)
      .post(`${payrollBase()}/payment-batches`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ payrollRunId: runId, treasuryAccountId: treasuryAccount.id, paymentDate: '2026-08-01' })
    expect(duplicate.status, JSON.stringify(duplicate.body)).toBe(400)

    // Lifecycle guard — approve/confirm before the right state must fail.
    const approveTooEarly = await request(app)
      .post(`${payrollBase()}/payment-batches/${batchId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(approveTooEarly.status).toBe(422)

    const confirmTooEarly = await request(app)
      .post(`${payrollBase()}/payment-batches/${batchId}/confirm`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
    expect(confirmTooEarly.status).toBe(422)

    const ready = await request(app)
      .post(`${payrollBase()}/payment-batches/${batchId}/ready`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(ready.status, JSON.stringify(ready.body)).toBe(200)
    expect(ready.body.data.status).toBe('READY')

    const confirmStillEarly = await request(app)
      .post(`${payrollBase()}/payment-batches/${batchId}/confirm`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
    expect(confirmStillEarly.status).toBe(422)

    const approve = await request(app)
      .post(`${payrollBase()}/payment-batches/${batchId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)
    expect(approve.body.data.status).toBe('APPROVED')

    const csv = await request(app)
      .get(`${payrollBase()}/payment-batches/${batchId}/export`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(csv.status).toBe(200)
    expect(csv.headers['content-type']).toContain('text/csv')
    expect(csv.text).toContain('Employee Code')

    const list = await request(app)
      .get(`${payrollBase()}/payment-batches`)
      .set('Authorization', `Bearer ${managerToken}`)
      .query({ payrollRunId: runId })
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    expect(list.body.data.find((b: { id: string }) => b.id === batchId)).toBeTruthy()

    const cancel = await request(app)
      .post(`${payrollBase()}/payment-batches/${batchId}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')
  })

  it('permissions — supervisor without salary_payment perms is denied across the batch lifecycle', async () => {
    const list = await request(app)
      .get(`${payrollBase()}/payment-batches`)
      .set('Authorization', `Bearer ${supervisorToken}`)
    expect(list.status).toBe(403)

    const create = await request(app)
      .post(`${payrollBase()}/payment-batches`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ payrollRunId: runId, treasuryAccountId: '00000000-0000-0000-0000-000000000000', paymentDate: '2026-08-01' })
    expect(create.status).toBe(403)

    if (batchId) {
      const approve = await request(app)
        .post(`${payrollBase()}/payment-batches/${batchId}/approve`)
        .set('Authorization', `Bearer ${supervisorToken}`)
      expect(approve.status).toBe(403)

      const confirm = await request(app)
        .post(`${payrollBase()}/payment-batches/${batchId}/confirm`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({})
      expect(confirm.status).toBe(403)

      const exportCsv = await request(app)
        .get(`${payrollBase()}/payment-batches/${batchId}/export`)
        .set('Authorization', `Bearer ${supervisorToken}`)
      expect(exportCsv.status).toBe(403)
    }
  })

  it('tenant isolation — cross-tenant token cannot reach payslips, accounting, or payment batches', async () => {
    if (payslipId) {
      const res = await request(app)
        .get(`${payrollBase()}/payslips/${payslipId}`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
      expect([403, 404]).toContain(res.status)
    }

    if (runId) {
      const acct = await request(app)
        .get(`${payrollBase()}/runs/${runId}/accounting`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
      expect([403, 404]).toContain(acct.status)
    }

    if (batchId) {
      const batch = await request(app)
        .get(`${payrollBase()}/payment-batches/${batchId}`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
      expect([403, 404]).toContain(batch.status)
    }
  })
})
