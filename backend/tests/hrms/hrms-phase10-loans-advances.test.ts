import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Prisma } from '@prisma/client'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { buildScheduleRows } from '../../src/modules/hrms/loans/loan-schedule.service.js'
import { buildPayrollRecoveryComponents, type DueRecoveryLine } from '../../src/modules/hrms/loans/loan-recovery.service.js'
import { buildPayrollAccrualBuckets } from '../../src/modules/hrms/payroll/payroll-accounting.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const phase10TablesReady = dbAvailable
  ? await prisma
      .$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'hr_employee_loans' LIMIT 1`
      .then((rows) => Array.isArray(rows) && rows.length > 0)
      .catch(() => false)
  : false

const HRMS_LOAN_PAYROLL_PERMS: PermissionName[] = [
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
  'hrms.loan.view',
  'hrms.loan.create',
  'hrms.loan.approve',
  'hrms.loan.disburse',
  'hrms.loan.manage',
  'hrms.loan.repayment',
  'organisation.view',
  'finance.legal_entity.view',
  'finance.branch.view',
  'department.view',
]

const SUPERVISOR_PERMS: PermissionName[] = ['hrms.employee.view', 'organisation.view']

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

// ─── Unit tests — schedule generation, recovery capping, GL bucket wiring ────

describe('HRMS Phase 10 — loan schedule & recovery (unit)', () => {
  it('schedule generation sums exactly to the disbursed amount (even division: 6 × 5000 = 30000)', () => {
    const rows = buildScheduleRows({
      loanId: 'loan-1',
      tenantId: 'tenant-1',
      disbursedAmount: 30000,
      installmentAmount: 5000,
      installmentCount: null,
      recoveryStartYear: 2026,
      recoveryStartMonth: 8,
    })

    expect(rows).toHaveLength(6)
    for (const row of rows) {
      expect(Number(row.dueAmount)).toBe(5000)
    }
    const sum = rows.reduce((s, r) => s + Number(r.dueAmount), 0)
    expect(sum).toBe(30000)

    // Months roll forward correctly from the recovery start month.
    expect(rows[0]).toMatchObject({ installmentNo: 1, year: 2026, month: 8 })
    expect(rows[5]).toMatchObject({ installmentNo: 6, year: 2027, month: 1 })
  })

  it('last installment absorbs the rounding remainder so the schedule still sums to the disbursed amount', () => {
    const rows = buildScheduleRows({
      loanId: 'loan-2',
      tenantId: 'tenant-1',
      disbursedAmount: 10000,
      installmentAmount: null,
      installmentCount: 3,
      recoveryStartYear: 2026,
      recoveryStartMonth: 11,
    })

    expect(rows).toHaveLength(3)
    expect(Number(rows[0].dueAmount)).toBe(3333.33)
    expect(Number(rows[1].dueAmount)).toBe(3333.33)
    // Last installment absorbs the remainder — not an equal 3333.33 share.
    expect(Number(rows[2].dueAmount)).toBe(3333.34)

    const sum = rows.reduce((s, r) => s + Number(r.dueAmount), 0)
    expect(sum).toBe(10000)
  })

  it('recovery component builder caps a recovery to remaining net pay and raises a WARNING', () => {
    const dueLines: DueRecoveryLine[] = [
      { scheduleId: 's1', loanId: 'l1', loanCode: 'LN-000001', type: 'LOAN', dueAmount: 5000 },
      { scheduleId: 's2', loanId: 'l2', loanCode: 'ADV-000001', type: 'SALARY_ADVANCE', dueAmount: 2000 },
    ]
    const { components, exceptions } = buildPayrollRecoveryComponents(dueLines, 6000)

    expect(components).toHaveLength(2)
    expect(components[0]).toMatchObject({ componentCode: 'LOAN_RECOVERY', amount: 5000 })
    // Only 1000 of net pay remains after the loan recovery — the advance is capped.
    expect(components[1]).toMatchObject({ componentCode: 'ADVANCE_RECOVERY', amount: 1000 })

    expect(exceptions).toHaveLength(1)
    expect(exceptions[0]).toMatchObject({ code: 'LOAN_RECOVERY_CAPPED', severity: 'WARNING' })
    expect(exceptions[0].message).toContain('capped')
  })

  it('recovery component builder skips a recovery entirely (with a WARNING) when no net pay remains', () => {
    const dueLines: DueRecoveryLine[] = [
      { scheduleId: 's1', loanId: 'l1', loanCode: 'LN-000002', type: 'LOAN', dueAmount: 3000 },
    ]
    const { components, exceptions } = buildPayrollRecoveryComponents(dueLines, 0)

    expect(components).toHaveLength(0)
    expect(exceptions).toHaveLength(1)
    expect(exceptions[0].code).toBe('LOAN_RECOVERY_CAPPED')
    expect(exceptions[0].message).toContain('skipped')
  })

  it('bucket builder credits EMPLOYEE_LOAN_RECEIVABLE for LOAN_RECOVERY and SALARY_ADVANCE_RECEIVABLE for ADVANCE_RECOVERY, staying balanced', () => {
    const results = [
      {
        netAmount: new Prisma.Decimal(9500),
        components: [
          decimalComponent('EARNING', 'BASIC', 'FIXED', 15000),
          decimalComponent('DEDUCTION', 'LOAN_RECOVERY', 'FIXED', 5000),
          decimalComponent('DEDUCTION', 'ADVANCE_RECOVERY', 'FIXED', 500),
        ],
      },
    ]

    const buckets = buildPayrollAccrualBuckets(results)

    expect(buckets.get('SALARY_BASIC_EXPENSE')?.debit.toNumber()).toBe(15000)
    expect(buckets.get('EMPLOYEE_LOAN_RECEIVABLE')?.credit.toNumber()).toBe(5000)
    expect(buckets.get('SALARY_ADVANCE_RECEIVABLE')?.credit.toNumber()).toBe(500)
    expect(buckets.get('SALARY_PAYABLE')?.credit.toNumber()).toBe(9500)

    let totalDebit = 0
    let totalCredit = 0
    for (const bucket of buckets.values()) {
      totalDebit += bucket.debit.toNumber()
      totalCredit += bucket.credit.toNumber()
    }
    expect(totalDebit).toBe(totalCredit)
  })
})

// ─── Live tests — loan lifecycle, payroll recovery integration, GL limitation ─

describe.skipIf(!phase10TablesReady)('HRMS Phase 10 — Employee Loans & Salary Advances (live)', () => {
  let tenantSlug = ''
  let tenantId = ''
  let managerToken = ''
  let managerUserId = ''
  let supervisorToken = ''
  let otherTenantToken = ''
  let legalEntityId = ''
  let branchId = ''
  let workerEmployeeId = ''
  let selfEmployeeId = ''
  let treasuryAccountId = ''
  let loanId = ''
  let advanceLoanId = ''
  const cleanupTenantIds: string[] = []

  const loansBase = () => `/api/v1/t/${tenantSlug}/hrms/loans`
  const payrollBase = () => `/api/v1/t/${tenantSlug}/hrms/payroll`
  const salaryBase = () => `/api/v1/t/${tenantSlug}/hrms/salary`

  beforeAll(async () => {
    await ensurePermissions()
    const { hashPassword } = await import('../../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const slug = `hrms10-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'HRMS Loans P10', slug, email: `hrms10-${Date.now()}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
    tenantSlug = slug
    cleanupTenantIds.push(tenant.id)

    const managerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        firstName: 'HR',
        lastName: 'Manager',
        email: `mgr10-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    managerUserId = managerUser.id
    const supervisorUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Shop',
        lastName: 'Supervisor',
        email: `sup10-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })

    const mgrPerms = await prisma.permission.findMany({ where: { name: { in: HRMS_LOAN_PAYROLL_PERMS } } })
    const mgrRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Loans P10 Role ${Date.now()}`,
        rolePermissions: { create: mgrPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: managerUser.id, roleId: mgrRole.id, tenantId: tenant.id } })

    const supPerms = await prisma.permission.findMany({ where: { name: { in: SUPERVISOR_PERMS } } })
    const supRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Supervisor P10 ${Date.now()}`,
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

    const worker = await prisma.hrEmployee.create({
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
        defaultShiftId: shift.id,
        workerCategory: 'WORKER',
        employmentType: 'PERMANENT',
        status: 'ACTIVE',
        joinDate: new Date('2024-01-01'),
      },
    })
    workerEmployeeId = worker.id

    // Linked to the HR Manager's own login — used only for the self-approval-block test.
    const selfEmp = await prisma.hrEmployee.create({
      data: {
        tenantId: tenant.id,
        employeeCode: 'EMP000002',
        firstName: 'HR',
        lastName: 'Manager',
        displayName: 'HR Manager',
        userId: managerUser.id,
        legalEntityId: le.id,
        branchId: branch.id,
        departmentId: dept.id,
        designationId: desig.id,
        workerCategory: 'STAFF',
        employmentType: 'PERMANENT',
        status: 'ACTIVE',
        joinDate: new Date('2024-01-01'),
      },
    })
    selfEmployeeId = selfEmp.id

    for (const empId of [workerEmployeeId, selfEmployeeId]) {
      await prisma.hrEmployeeStatutoryDetail.create({
        data: {
          tenantId: tenant.id,
          employeeId: empId,
          pfApplicable: false,
          esicApplicable: false,
          ptApplicable: false,
          tdsApplicable: false,
          lwfApplicable: false,
          overrideReason: 'Phase 10 loans/advances fixture — statutory coverage lives in Phase 8 tests',
        },
      })
    }

    const other = await prisma.tenant.create({
      data: { name: 'Other P10', slug: `hrms10o-${Date.now()}`, email: `hrms10o-${Date.now()}@test.com`, status: 'ACTIVE' },
    })
    cleanupTenantIds.push(other.id)
    const otherUser = await prisma.user.create({
      data: {
        tenantId: other.id,
        firstName: 'Other',
        lastName: 'Admin',
        email: `other10-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const otherPerms = await prisma.permission.findMany({ where: { name: { in: HRMS_LOAN_PAYROLL_PERMS } } })
    const otherRole = await prisma.role.create({
      data: {
        tenantId: other.id,
        name: `Other P10 ${Date.now()}`,
        rolePermissions: { create: otherPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: otherUser.id, roleId: otherRole.id, tenantId: other.id } })

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

    // Salary components + structure for the worker so payroll produces a net pay well
    // above the 5000 monthly loan recovery (keeps the recovery-capping path untested here —
    // capping itself is covered by the unit tests above).
    const defs = [
      { code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'FIXED' },
      { code: 'HRA', name: 'HRA', type: 'EARNING', calculationType: 'PERCENTAGE' },
    ]
    const componentIds: Record<string, string> = {}
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
      .send({ code: 'WORKER-GRADE-P10', name: 'Worker Grade P10', workerCategory: 'WORKER' })
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
        employeeId: workerEmployeeId,
        salaryStructureVersionId: versionId,
        effectiveFrom: '2026-01-01',
        monthlyGross: 21000,
        annualCtc: 252000,
      })
    expect(assign.status, JSON.stringify(assign.body)).toBe(201)

    // Full-month attendance for August 2026 so the payroll run produces a deterministic net pay.
    for (let d = 1; d <= 31; d += 1) {
      const date = new Date(Date.UTC(2026, 7, d))
      if (date.getUTCMonth() !== 7) break
      if (date.getUTCDay() === 0) continue
      await prisma.hrAttendanceDay.upsert({
        where: { tenantId_employeeId_attendanceDate: { tenantId, employeeId: workerEmployeeId, attendanceDate: date } },
        create: {
          tenantId,
          employeeId: workerEmployeeId,
          attendanceDate: date,
          status: 'PRESENT',
          shiftId: shift.id,
          source: 'MANUAL',
          isFinalized: true,
        },
        update: { status: 'PRESENT', isFinalized: true },
      })
    }

    // Minimal GL infrastructure for disbursement / repayment posting.
    await prisma.financeSettings.upsert({
      where: { legalEntityId },
      create: { tenantId, legalEntityId, financeActivated: true },
      update: { financeActivated: true },
    })
    const fy = await prisma.financialYear.create({
      data: {
        tenantId,
        legalEntityId,
        name: 'FY 2026',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        status: 'ACTIVE',
        isCurrent: true,
      },
    })
    await prisma.accountingPeriod.create({
      data: {
        tenantId,
        legalEntityId,
        financialYearId: fy.id,
        periodNumber: 1,
        name: 'Open',
        startDate: fy.startDate,
        endDate: fy.endDate,
        status: 'OPEN',
      },
    })
    const receivableAccount = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId,
        accountCode: `LNRCV-${Date.now()}`.slice(0, 32),
        accountName: 'Employee Loan Receivable',
        category: 'ASSET',
        accountType: 'GENERAL',
        level: 1,
        isGroup: false,
        isActive: true,
        normalBalance: 'DEBIT',
        allowManualPosting: true,
      },
    })
    const advanceReceivableAccount = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId,
        accountCode: `ADVRCV-${Date.now()}`.slice(0, 32),
        accountName: 'Salary Advance Receivable',
        category: 'ASSET',
        accountType: 'GENERAL',
        level: 1,
        isGroup: false,
        isActive: true,
        normalBalance: 'DEBIT',
        allowManualPosting: true,
      },
    })
    const bankAccount = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId,
        accountCode: `BANK-P10-${Date.now()}`.slice(0, 32),
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
    await prisma.defaultAccountMapping.createMany({
      data: [
        { tenantId, legalEntityId, mappingKey: 'EMPLOYEE_LOAN_RECEIVABLE', accountId: receivableAccount.id, isMandatory: true },
        { tenantId, legalEntityId, mappingKey: 'SALARY_ADVANCE_RECEIVABLE', accountId: advanceReceivableAccount.id, isMandatory: true },
      ],
    })
    const treasuryAccount = await prisma.treasuryAccount.create({
      data: {
        tenantId,
        legalEntityId,
        code: `BANK-P10-${Date.now()}`.slice(0, 32),
        name: 'Bank Current Account',
        accountType: 'BANK',
        status: 'ACTIVE',
        glAccountId: bankAccount.id,
      },
    })
    treasuryAccountId = treasuryAccount.id
  }, 180_000)

  afterAll(async () => {
    for (const id of cleanupTenantIds) {
      await prisma.hrLoanRepayment.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrLoanRecoverySchedule.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployeeLoan.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.generalLedgerEntry.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.accountingVoucherLine.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.postingEvent.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.accountingVoucher.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.treasuryAccount.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.defaultAccountMapping.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.account.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.accountingPeriod.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.financialYear.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.financeSettings.deleteMany({ where: { tenantId: id } }).catch(() => {})
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

  it('creates → submits → approves a LOAN through the API', async () => {
    const create = await request(app)
      .post(loansBase())
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employeeId: workerEmployeeId, type: 'LOAN', requestDate: '2026-08-01', requestedAmount: 30000, reason: 'Medical emergency' })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    loanId = create.body.data.id
    expect(create.body.data.status).toBe('DRAFT')
    expect(create.body.data.code).toMatch(/^LN-/)

    const submit = await request(app)
      .post(`${loansBase()}/${loanId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    expect(submit.body.data.status).toBe('SUBMITTED')

    const approve = await request(app)
      .post(`${loansBase()}/${loanId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ approvedAmount: 30000, installmentAmount: 5000, recoveryStartYear: 2026, recoveryStartMonth: 8 })
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)
    expect(approve.body.data.status).toBe('APPROVED')
    expect(approve.body.data.approvedAmount).toBe(30000)
    expect(approve.body.data.installmentAmount).toBe(5000)
  })

  it('disburses an APPROVED loan, posts GL, and generates a 6 × 5000 recovery schedule', async () => {
    const disburse = await request(app)
      .post(`${loansBase()}/${loanId}/disburse`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ treasuryAccountId, method: 'BANK', paymentDate: '2026-08-05' })
    expect(disburse.status, JSON.stringify(disburse.body)).toBe(200)
    expect(disburse.body.data.status).toBe('RECOVERING')
    expect(disburse.body.data.disbursedAmount).toBe(30000)
    expect(disburse.body.data.outstandingAmount).toBe(30000)
    expect(disburse.body.data.disbursementVoucherId).toBeTruthy()

    const loan = await request(app)
      .get(`${loansBase()}/${loanId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(loan.status, JSON.stringify(loan.body)).toBe(200)
    expect(loan.body.data.status).toBe('RECOVERING')
    expect(loan.body.data.schedules).toHaveLength(6)
    const sum = loan.body.data.schedules.reduce((s: number, r: { dueAmount: number }) => s + r.dueAmount, 0)
    expect(sum).toBe(30000)
    for (const row of loan.body.data.schedules) {
      expect(row.dueAmount).toBe(5000)
      expect(row.status).toBe('PENDING')
    }
    expect(loan.body.data.schedules[0]).toMatchObject({ year: 2026, month: 8, installmentNo: 1 })
  })

  it('payroll calculation includes a LOAN_RECOVERY deduction and finalize confirms the recovery — outstanding drops from 30000 to 25000', async () => {
    const period = await request(app)
      .post(`${payrollBase()}/periods`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ legalEntityId, year: 2026, month: 8 })
    expect(period.status, JSON.stringify(period.body)).toBe(201)
    const periodId = period.body.data.id

    const run = await request(app)
      .post(`${payrollBase()}/runs`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ payrollPeriodId: periodId, branchId })
    expect(run.status, JSON.stringify(run.body)).toBe(201)
    const runId = run.body.data.id

    const calc = await request(app)
      .post(`${payrollBase()}/runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(calc.status, JSON.stringify(calc.body)).toBe(200)

    const employees = await request(app)
      .get(`${payrollBase()}/runs/${runId}/employees`)
      .set('Authorization', `Bearer ${managerToken}`)
    const row = employees.body.data.find((r: { employeeId: string }) => r.employeeId === workerEmployeeId)
    expect(row).toBeTruthy()
    expect(row.grossAmount).toBeGreaterThan(5000)

    const detail = await request(app)
      .get(`${payrollBase()}/runs/${runId}/employees/${row.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(detail.status, JSON.stringify(detail.body)).toBe(200)
    const recoveryComponent = detail.body.data.components.find(
      (c: { componentCode: string }) => c.componentCode === 'LOAN_RECOVERY',
    )
    expect(recoveryComponent).toBeTruthy()
    expect(recoveryComponent.amount).toBe(5000)
    expect(recoveryComponent.type).toBe('DEDUCTION')

    const review = await request(app)
      .post(`${payrollBase()}/runs/${runId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(review.status, JSON.stringify(review.body)).toBe(200)

    const finalize = await request(app)
      .post(`${payrollBase()}/runs/${runId}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(finalize.status, JSON.stringify(finalize.body)).toBe(200)
    expect(finalize.body.data.status).toBe('FINALIZED')

    // confirmRecoveriesForRun ran inside finalize — the August installment is RECOVERED
    // and the loan's outstanding balance dropped by exactly the recovered 5000.
    const loan = await request(app)
      .get(`${loansBase()}/${loanId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(loan.status, JSON.stringify(loan.body)).toBe(200)
    expect(loan.body.data.outstandingAmount).toBe(25000)
    expect(loan.body.data.recoveredAmount).toBe(5000)
    expect(loan.body.data.status).toBe('RECOVERING')

    const augustSchedule = loan.body.data.schedules.find((s: { month: number; year: number }) => s.year === 2026 && s.month === 8)
    expect(augustSchedule.status).toBe('RECOVERED')
    expect(augustSchedule.recoveredAmount).toBe(5000)
    expect(augustSchedule.payrollRunId).toBe(runId)

    // Remaining 5 installments are still pending for future months.
    const pendingCount = loan.body.data.schedules.filter((s: { status: string }) => s.status === 'PENDING').length
    expect(pendingCount).toBe(5)
  })

  it('skip installment marks a pending schedule row SKIPPED', async () => {
    const create = await request(app)
      .post(loansBase())
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employeeId: workerEmployeeId, type: 'SALARY_ADVANCE', requestDate: '2026-09-01', requestedAmount: 8000 })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    advanceLoanId = create.body.data.id

    await request(app).post(`${loansBase()}/${advanceLoanId}/submit`).set('Authorization', `Bearer ${managerToken}`)
    const approve = await request(app)
      .post(`${loansBase()}/${advanceLoanId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ approvedAmount: 8000, installmentAmount: 2000, recoveryStartYear: 2026, recoveryStartMonth: 9 })
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)

    const disburse = await request(app)
      .post(`${loansBase()}/${advanceLoanId}/disburse`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ treasuryAccountId, method: 'BANK', paymentDate: '2026-09-01' })
    expect(disburse.status, JSON.stringify(disburse.body)).toBe(200)
    expect(disburse.body.data.status).toBe('RECOVERING')

    const loan = await request(app)
      .get(`${loansBase()}/${advanceLoanId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    const firstSchedule = loan.body.data.schedules.find((s: { installmentNo: number }) => s.installmentNo === 1)
    expect(firstSchedule.status).toBe('PENDING')

    const skip = await request(app)
      .post(`${loansBase()}/${advanceLoanId}/schedules/${firstSchedule.id}/skip`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Employee on unpaid leave this cycle' })
    expect(skip.status, JSON.stringify(skip.body)).toBe(200)
    expect(skip.body.data.schedule.status).toBe('SKIPPED')

    // Skipping an already-SKIPPED (non-pending) installment is rejected.
    const skipAgain = await request(app)
      .post(`${loansBase()}/${advanceLoanId}/schedules/${firstSchedule.id}/skip`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Retry' })
    expect(skipAgain.status).toBe(400)
  })

  it('early repayment validates amount and posts GL repayment reducing outstanding', async () => {
    const tooMuch = await request(app)
      .post(`${loansBase()}/${advanceLoanId}/repayments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ amount: 9000, date: '2026-09-10', method: 'BANK', treasuryAccountId })
    expect(tooMuch.status, JSON.stringify(tooMuch.body)).toBe(400)

    const noTreasury = await request(app)
      .post(`${loansBase()}/${advanceLoanId}/repayments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ amount: 4000, date: '2026-09-10', method: 'CASH' })
    expect(noTreasury.status, JSON.stringify(noTreasury.body)).toBe(400)

    const valid = await request(app)
      .post(`${loansBase()}/${advanceLoanId}/repayments`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ amount: 4000, date: '2026-09-10', method: 'BANK', treasuryAccountId, reason: 'Partial early settle' })
    expect(valid.status, JSON.stringify(valid.body)).toBe(200)
    expect(valid.body.data.loan.outstandingAmount).toBeLessThan(8000)
  })

  it('reject: only a SUBMITTED loan can be rejected, and rejection is recorded with a reason', async () => {
    const create = await request(app)
      .post(loansBase())
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employeeId: workerEmployeeId, type: 'LOAN', requestDate: '2026-09-15', requestedAmount: 5000 })
    expect(create.status).toBe(201)
    const draftLoanId = create.body.data.id

    const rejectDraft = await request(app)
      .post(`${loansBase()}/${draftLoanId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Too early' })
    expect(rejectDraft.status).toBe(400)

    await request(app).post(`${loansBase()}/${draftLoanId}/submit`).set('Authorization', `Bearer ${managerToken}`)

    const reject = await request(app)
      .post(`${loansBase()}/${draftLoanId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Insufficient tenure' })
    expect(reject.status, JSON.stringify(reject.body)).toBe(200)
    expect(reject.body.data.status).toBe('REJECTED')
    expect(reject.body.data.rejectionReason).toBe('Insufficient tenure')

    const approveRejected = await request(app)
      .post(`${loansBase()}/${draftLoanId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ approvedAmount: 5000, installmentAmount: 1000, recoveryStartYear: 2026, recoveryStartMonth: 10 })
    expect(approveRejected.status).toBe(400)
  })

  it('self-approval is blocked — an employee linked to the approving user cannot approve their own request', async () => {
    const create = await request(app)
      .post(loansBase())
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employeeId: selfEmployeeId, type: 'SALARY_ADVANCE', requestDate: '2026-09-20', requestedAmount: 3000 })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    const selfLoanId = create.body.data.id

    await request(app).post(`${loansBase()}/${selfLoanId}/submit`).set('Authorization', `Bearer ${managerToken}`)

    const approve = await request(app)
      .post(`${loansBase()}/${selfLoanId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ approvedAmount: 3000, installmentAmount: 1000, recoveryStartYear: 2026, recoveryStartMonth: 10 })
    expect(approve.status, JSON.stringify(approve.body)).toBe(403)

    const rejectSelf = await request(app)
      .post(`${loansBase()}/${selfLoanId}/reject`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Cannot self-approve either' })
    expect(rejectSelf.status).toBe(403)
  })

  it('permissions — supervisor without loan perms is denied list, create, and approve', async () => {
    const list = await request(app).get(loansBase()).set('Authorization', `Bearer ${supervisorToken}`)
    expect(list.status).toBe(403)

    const create = await request(app)
      .post(loansBase())
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ employeeId: workerEmployeeId, type: 'LOAN', requestDate: '2026-09-01', requestedAmount: 1000 })
    expect(create.status).toBe(403)

    const approve = await request(app)
      .post(`${loansBase()}/${loanId}/approve`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ approvedAmount: 1000, installmentAmount: 500, recoveryStartYear: 2026, recoveryStartMonth: 10 })
    expect(approve.status).toBe(403)

    const disburse = await request(app)
      .post(`${loansBase()}/${loanId}/disburse`)
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ treasuryAccountId, method: 'BANK', paymentDate: '2026-09-01' })
    expect(disburse.status).toBe(403)
  })

  it('tenant isolation — cross-tenant token cannot reach another tenant\'s loan', async () => {
    const res = await request(app).get(`${loansBase()}/${loanId}`).set('Authorization', `Bearer ${otherTenantToken}`)
    expect([403, 404]).toContain(res.status)

    const list = await request(app).get(loansBase()).set('Authorization', `Bearer ${otherTenantToken}`)
    expect([200, 403]).toContain(list.status)
    if (list.status === 200) {
      expect(list.body.data.find((l: { id: string }) => l.id === loanId)).toBeFalsy()
    }
  })
})
