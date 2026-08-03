import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { resolveWageBasis, roundStatutoryAmount } from '../../src/modules/hrms/statutory/wage-basis.service.js'
import { calculateTds } from '../../src/modules/hrms/statutory/tds.service.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const statutoryTablesReady = dbAvailable
  ? await prisma
      .$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'hr_statutory_rules' LIMIT 1`
      .then((rows) => Array.isArray(rows) && rows.length > 0)
      .catch(() => false)
  : false

const HR_MANAGER_PERMS: PermissionName[] = [
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
  'hrms.statutory.view',
  'hrms.statutory.manage',
  'hrms.statutory.override',
  'hrms.statutory.reports',
  'organisation.view',
  'finance.legal_entity.view',
  'finance.branch.view',
  'department.view',
]

const HR_EXECUTIVE_PERMS: PermissionName[] = ['hrms.statutory.view', 'hrms.statutory.reports', 'organisation.view']

async function ensurePermissions() {
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    await prisma.permission
      .upsert({ where: { name }, create: { name, module, description: name }, update: {} })
      .catch(() => {})
  }
}

describe('HRMS Phase 8 — statutory calculation (unit)', () => {
  it('resolveWageBasis defaults to BASIC when no lines configured, falls back to gross otherwise', () => {
    const earnings = { BASIC: 15000, HRA: 3000 }
    const pfBasis = resolveWageBasis(null, earnings, { defaultComponentCodes: ['BASIC'] })
    expect(pfBasis.wage).toBe(15000)
    expect(pfBasis.included).toEqual([{ code: 'BASIC', amount: 15000 }])

    const esicBasis = resolveWageBasis(null, earnings, { fallbackWage: 18000 })
    expect(esicBasis.wage).toBe(18000)
    expect(esicBasis.included).toEqual([])

    const configured = resolveWageBasis(
      { wageBasisLines: [{ componentCode: 'BASIC', include: true, sequence: 10 }, { componentCode: 'HRA', include: false, sequence: 20 }] },
      earnings,
    )
    expect(configured.wage).toBe(15000)
  })

  it('roundStatutoryAmount honors NEAREST/UP/DOWN/NONE', () => {
    expect(roundStatutoryAmount(120.4, 'NEAREST')).toBe(120)
    expect(roundStatutoryAmount(120.4, 'UP')).toBe(121)
    expect(roundStatutoryAmount(120.9, 'DOWN')).toBe(120)
    expect(roundStatutoryAmount(120.456, 'NONE')).toBe(120.46)
    expect(roundStatutoryAmount(-5, 'NEAREST')).toBe(0)
  })

  it('calculateTds never invents a full IT calc — manual override or review-required only', () => {
    const noOverride = calculateTds(null)
    expect(noOverride.amount).toBe(0)
    expect(noOverride.reviewRequired).toBe(true)
    expect(noOverride.source).toBe('PENDING_ANNUAL_ENGINE')

    const withOverride = calculateTds({ tdsManualMonthly: 2500, tdsManualReason: 'Declared by employee' })
    expect(withOverride.amount).toBe(2500)
    expect(withOverride.reviewRequired).toBe(false)
    expect(withOverride.source).toBe('MANUAL_OVERRIDE')
  })
})

describe.skipIf(!statutoryTablesReady)('HRMS Phase 8 — Statutory rules, profile, engine & registers (live)', () => {
  let tenantSlug = ''
  let tenantId = ''
  let managerToken = ''
  let executiveToken = ''
  let legalEntityId = ''
  let branchId = ''
  let employeeId = ''
  let shiftId = ''
  let periodId = ''
  let runId = ''
  const componentIds: Record<string, string> = {}
  let pfRuleId = ''
  let esicRuleId = ''
  let ptRuleId = ''
  const cleanupTenantIds: string[] = []

  const statutoryBase = () => `/api/v1/t/${tenantSlug}/hrms/statutory`
  const salaryBase = () => `/api/v1/t/${tenantSlug}/hrms/salary`
  const payrollBase = () => `/api/v1/t/${tenantSlug}/hrms/payroll`

  beforeAll(async () => {
    await ensurePermissions()
    const { hashPassword } = await import('../../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const slug = `hrms8-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'HRMS Statutory P8', slug, email: `hrms8-${Date.now()}@test.com`, status: 'ACTIVE' },
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
        email: `mgr8-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const executiveUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        firstName: 'HR',
        lastName: 'Executive',
        email: `exec8-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })

    const mgrPerms = await prisma.permission.findMany({ where: { name: { in: HR_MANAGER_PERMS } } })
    const mgrRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Statutory P8 Manager ${Date.now()}`,
        rolePermissions: { create: mgrPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: managerUser.id, roleId: mgrRole.id, tenantId: tenant.id } })

    const execPerms = await prisma.permission.findMany({ where: { name: { in: HR_EXECUTIVE_PERMS } } })
    const execRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Statutory P8 Executive ${Date.now()}`,
        rolePermissions: { create: execPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: executiveUser.id, roleId: execRole.id, tenantId: tenant.id } })

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
        stateCode: 'MH',
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
        firstName: 'Sunita',
        lastName: 'Rao',
        displayName: 'Sunita Rao',
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
    await prisma.hrEmployeeStatutoryDetail.create({
      data: { tenantId: tenant.id, employeeId: emp.id, uan: '100200300400', esicNumber: 'ESIC0001', pan: 'ABCDE1234F' },
    })

    const mgrLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: managerUser.email, password: 'Test@123', tenantSlug: slug })
    expect(mgrLogin.status).toBe(200)
    managerToken = mgrLogin.body.data.accessToken

    const execLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: executiveUser.email, password: 'Test@123', tenantSlug: slug })
    expect(execLogin.status).toBe(200)
    executiveToken = execLogin.body.data.accessToken

    // Salary components + a structure with NO STATUTORY lines at all — the engine must
    // still append PF/ESIC/PT results so payroll works without explicit structure lines.
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
      .send({ code: 'WORKER-GRADE-P8', name: 'Worker Grade P8', workerCategory: 'WORKER' })
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
            percentage: 20,
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
      .send({ employeeId, salaryStructureVersionId: versionId, effectiveFrom: '2026-01-01', monthlyGross: 18000, annualCtc: 216000 })
    expect(assign.status, JSON.stringify(assign.body)).toBe(201)

    // Mark every non-Sunday day PRESENT for the whole payroll month so payable fraction = 1
    // (deterministic amounts — Sundays are already paid weekly-off via the shift template).
    for (let d = 1; d <= 31; d += 1) {
      const date = new Date(Date.UTC(2026, 7, d))
      if (date.getUTCMonth() !== 7) break
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
      await prisma.hrPayrollComponentResult.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollException.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollEmployeeResult.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollRun.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrPayrollPeriod.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrAttendanceDay.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployeeSalaryAssignment.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructureLine.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructureVersion.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructure.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryComponent.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrStatutoryPtSlab.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrStatutoryWageBasisLine.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrStatutoryRule.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployeeStatutoryDetail.deleteMany({ where: { tenantId: id } }).catch(() => {})
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

  it('creates, configures and activates PF/ESIC/PT rules', async () => {
    const pf = await request(app)
      .post(`${statutoryBase()}/rules`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        type: 'PF',
        code: 'PF-DEFAULT',
        name: 'EPF Default',
        effectiveFrom: '2026-01-01',
        employeeRatePct: 12,
        employerRatePct: 12,
        wageCeiling: 15000,
        roundingMode: 'NEAREST',
      })
    expect(pf.status, JSON.stringify(pf.body)).toBe(201)
    pfRuleId = pf.body.data.id

    const pfWageBasis = await request(app)
      .put(`${statutoryBase()}/rules/${pfRuleId}/wage-basis`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ lines: [{ componentCode: 'BASIC', include: true, sequence: 10 }] })
    expect(pfWageBasis.status, JSON.stringify(pfWageBasis.body)).toBe(200)

    const pfActivate = await request(app)
      .post(`${statutoryBase()}/rules/${pfRuleId}/activate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(pfActivate.status, JSON.stringify(pfActivate.body)).toBe(200)
    expect(pfActivate.body.data.status).toBe('ACTIVE')

    const esic = await request(app)
      .post(`${statutoryBase()}/rules`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        type: 'ESIC',
        code: 'ESIC-DEFAULT',
        name: 'ESIC Default',
        effectiveFrom: '2026-01-01',
        employeeRatePct: 0.75,
        employerRatePct: 3.25,
        eligibilityWageCeiling: 21000,
        roundingMode: 'NEAREST',
      })
    expect(esic.status, JSON.stringify(esic.body)).toBe(201)
    esicRuleId = esic.body.data.id
    const esicActivate = await request(app)
      .post(`${statutoryBase()}/rules/${esicRuleId}/activate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(esicActivate.status, JSON.stringify(esicActivate.body)).toBe(200)

    const pt = await request(app)
      .post(`${statutoryBase()}/rules`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'PROFESSIONAL_TAX', code: 'PT-MH', name: 'PT Maharashtra', stateCode: 'MH', effectiveFrom: '2026-01-01' })
    expect(pt.status, JSON.stringify(pt.body)).toBe(201)
    ptRuleId = pt.body.data.id

    const blockedActivate = await request(app)
      .post(`${statutoryBase()}/rules/${ptRuleId}/activate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(blockedActivate.status).toBe(400)

    const slabs = await request(app)
      .put(`${statutoryBase()}/rules/${ptRuleId}/pt-slabs`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        slabs: [
          { fromAmount: 0, toAmount: 7500, taxAmount: 0, sequence: 10 },
          { fromAmount: 7501, toAmount: 10000, taxAmount: 175, sequence: 20 },
          { fromAmount: 10001, taxAmount: 200, sequence: 30 },
        ],
      })
    expect(slabs.status, JSON.stringify(slabs.body)).toBe(200)

    const ptActivate = await request(app)
      .post(`${statutoryBase()}/rules/${ptRuleId}/activate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(ptActivate.status, JSON.stringify(ptActivate.body)).toBe(200)

    // DRAFT-only edit guard
    const editActive = await request(app)
      .patch(`${statutoryBase()}/rules/${pfRuleId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'EPF Renamed' })
    expect(editActive.status).toBe(400)
  })

  it('resolves the effective rule for the employee', async () => {
    const resolve = await request(app)
      .get(`${statutoryBase()}/resolve`)
      .query({ type: 'PF', employeeId, date: '2026-08-31' })
      .set('Authorization', `Bearer ${managerToken}`)
    expect(resolve.status, JSON.stringify(resolve.body)).toBe(200)
    expect(resolve.body.data.rule.code).toBe('PF-DEFAULT')
    expect(resolve.body.data.stateCode).toBe('MH')
  })

  it('rejects applicability override without overrideReason, accepts with reason', async () => {
    const missingReason = await request(app)
      .patch(`${statutoryBase()}/employees/${employeeId}/profile`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ esicApplicable: false })
    expect(missingReason.status).toBe(400)

    const ok = await request(app)
      .patch(`${statutoryBase()}/employees/${employeeId}/profile`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ tdsManualMonthly: 500, overrideReason: 'Declared flat monthly TDS for test' })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body.data.tdsManualMonthly).toBe(500)
  })

  it('calculates payroll: engine appends PF/ESIC/PT lines with no structure STATUTORY lines configured', async () => {
    const period = await request(app)
      .post(`${payrollBase()}/periods`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ legalEntityId, year: 2026, month: 8 })
    expect(period.status, JSON.stringify(period.body)).toBe(201)
    periodId = period.body.data.id

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
    expect(row.status).toBe('CALCULATED')

    const detail = await request(app)
      .get(`${payrollBase()}/runs/${runId}/employees/${row.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(detail.status, JSON.stringify(detail.body)).toBe(200)
    const byCode: Record<string, { amount: number }> = {}
    for (const c of detail.body.data.components) byCode[c.componentCode] = c

    expect(byCode.PF_EMPLOYEE?.amount).toBe(1800) // 12% of BASIC 15000, capped at wageCeiling 15000
    expect(byCode.PF_EMPLOYER?.amount).toBe(1800)
    expect(byCode.ESIC_EMPLOYEE?.amount).toBe(135) // 0.75% of gross 18000 (BASIC 15000 + HRA 20% = 3000)
    expect(byCode.ESIC_EMPLOYER?.amount).toBe(585) // 3.25% of gross 18000
    expect(byCode.PT?.amount).toBe(200) // wage 18000 → top slab
    expect(byCode.TDS?.amount).toBe(500) // manual override set above

    const codes = detail.body.data.components.map((c: { componentCode: string }) => c.componentCode)
    expect(codes).not.toContain('LWF_EMPLOYEE') // no LWF rule configured — applicable but rule missing ⇒ no line, only a warning

    // PF/ESIC/PT registers should now include this employee for the period
    const pfRegister = await request(app)
      .get(`${statutoryBase()}/registers/pf`)
      .query({ payrollPeriodId: periodId })
      .set('Authorization', `Bearer ${executiveToken}`)
    expect(pfRegister.status, JSON.stringify(pfRegister.body)).toBe(200)
    expect(pfRegister.body.data.find((r: { employeeId: string }) => r.employeeId === employeeId)).toBeTruthy()

    const csv = await request(app)
      .get(`${statutoryBase()}/registers/pf/export.csv`)
      .query({ payrollPeriodId: periodId })
      .set('Authorization', `Bearer ${executiveToken}`)
    expect(csv.status).toBe(200)
    expect(csv.headers['content-type']).toContain('text/csv')
    expect(csv.text).toContain('employeeCode')
  })

  it('recalculates after disabling ESIC applicability — ESIC lines disappear', async () => {
    const override = await request(app)
      .patch(`${statutoryBase()}/employees/${employeeId}/profile`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ esicApplicable: false, overrideReason: 'Employee opted out for test' })
    expect(override.status, JSON.stringify(override.body)).toBe(200)

    const recalc = await request(app)
      .post(`${payrollBase()}/runs/${runId}/calculate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(recalc.status, JSON.stringify(recalc.body)).toBe(200)

    const employees = await request(app)
      .get(`${payrollBase()}/runs/${runId}/employees`)
      .set('Authorization', `Bearer ${managerToken}`)
    const row = employees.body.data.find((r: { employeeId: string }) => r.employeeId === employeeId)

    const detail = await request(app)
      .get(`${payrollBase()}/runs/${runId}/employees/${row.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
    const codes = detail.body.data.components.map((c: { componentCode: string }) => c.componentCode)
    expect(codes).not.toContain('ESIC_EMPLOYEE')
    expect(codes).not.toContain('ESIC_EMPLOYER')
    expect(codes).toContain('PF_EMPLOYEE')
  })

  it('permissions — HR Executive has view+reports but not manage/override', async () => {
    const create = await request(app)
      .post(`${statutoryBase()}/rules`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ type: 'LWF', code: 'LWF-X', name: 'LWF X', effectiveFrom: '2026-01-01' })
    expect(create.status).toBe(403)

    const patchProfile = await request(app)
      .patch(`${statutoryBase()}/employees/${employeeId}/profile`)
      .set('Authorization', `Bearer ${executiveToken}`)
      .send({ lwfApplicable: false, overrideReason: 'test' })
    expect(patchProfile.status).toBe(403)

    const view = await request(app)
      .get(`${statutoryBase()}/rules`)
      .set('Authorization', `Bearer ${executiveToken}`)
    expect(view.status).toBe(200)
  })
})
