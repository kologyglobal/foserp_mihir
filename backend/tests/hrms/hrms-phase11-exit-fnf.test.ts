import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { prisma } from '../../src/config/prisma.js'
import { PERMISSIONS, type PermissionName } from '../../src/constants/permissions.js'
import { computeNotice } from '../../src/modules/hrms/exit/notice.util.js'

const app = createApp()

const dbAvailable = await prisma
  .$queryRaw`SELECT 1`
  .then(() => true)
  .catch(() => false)

const phase11TablesReady = dbAvailable
  ? await prisma
      .$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'hr_employee_exits' LIMIT 1`
      .then((rows) => Array.isArray(rows) && rows.length > 0)
      .catch(() => false)
  : false

const MANAGER_PERMS: PermissionName[] = [
  'hrms.employee.view',
  'hrms.exit.view',
  'hrms.exit.create',
  'hrms.exit.approve',
  'hrms.exit.clearance',
  'hrms.fnf.view',
  'hrms.fnf.calculate',
  'hrms.fnf.approve',
  'hrms.fnf.post',
  'hrms.fnf.pay',
  'organisation.view',
  'finance.legal_entity.view',
  'finance.branch.view',
  'department.view',
]

// Mirrors the "HR Executive" role — can raise/progress exits + calculate F&F but cannot
// approve the exit or review/approve/post/pay the settlement.
const HR_EXEC_PERMS: PermissionName[] = [
  'hrms.employee.view',
  'hrms.exit.view',
  'hrms.exit.create',
  'hrms.exit.clearance',
  'hrms.fnf.view',
  'hrms.fnf.calculate',
  'organisation.view',
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

// ─── Unit tests — notice period reconciliation ──────────────────────────────

describe('HRMS Phase 11 — computeNotice (unit)', () => {
  it('shortfall: employee serves less than the contractual notice period', () => {
    const result = computeNotice(30, '2026-08-01', '2026-08-15')
    expect(result).toEqual({ served: 14, shortfall: 16, excess: 0 })
  })

  it('excess: employee serves longer than the contractual notice period', () => {
    const result = computeNotice(30, '2026-08-01', '2026-09-15')
    expect(result).toEqual({ served: 45, shortfall: 0, excess: 15 })
  })

  it('exact match: served equals required — no shortfall or excess', () => {
    const result = computeNotice(30, '2026-08-01', '2026-08-31')
    expect(result).toEqual({ served: 30, shortfall: 0, excess: 0 })
  })

  it('no resignation date (e.g. employer-initiated termination): full requirement is treated as shortfall', () => {
    const result = computeNotice(30, null, '2026-08-15')
    expect(result).toEqual({ served: 0, shortfall: 30, excess: 0 })

    const undefinedCase = computeNotice(30, undefined, '2026-08-15')
    expect(undefinedCase).toEqual({ served: 0, shortfall: 30, excess: 0 })
  })

  it('zero contractual notice period: never a shortfall, any service is excess', () => {
    expect(computeNotice(0, '2026-08-01', '2026-08-01')).toEqual({ served: 0, shortfall: 0, excess: 0 })
    expect(computeNotice(0, '2026-08-01', '2026-08-05')).toEqual({ served: 4, shortfall: 0, excess: 4 })
  })

  it('resignation date equal to last working date (immediate exit): full requirement is shortfall', () => {
    const result = computeNotice(10, '2026-08-01', '2026-08-01')
    expect(result).toEqual({ served: 0, shortfall: 10, excess: 0 })
  })

  it('negative/garbage requiredDays are clamped to zero, never a negative required', () => {
    const result = computeNotice(-5, '2026-08-01', '2026-08-01')
    expect(result).toEqual({ served: 0, shortfall: 0, excess: 0 })
  })
})

// ─── Live — exit lifecycle, clearance, and full & final settlement ─────────

describe.skipIf(!phase11TablesReady)('HRMS Phase 11 — Exit, Offboarding & Full/Final Settlement (live)', () => {
  let tenantSlug = ''
  let tenantId = ''
  let managerToken = ''
  let managerUserId = ''
  let hrExecToken = ''
  let supervisorToken = ''
  let otherTenantToken = ''
  let legalEntityId = ''
  let branchId = ''
  let exitingEmployeeId = ''
  let selfEmployeeId = ''
  let cancelEmployeeId = ''
  let exitId = ''
  let selfExitId = ''
  const cleanupTenantIds: string[] = []

  const exitsBase = () => `/api/v1/t/${tenantSlug}/hrms/exits`
  const fnfBase = () => `/api/v1/t/${tenantSlug}/hrms/fnf`
  const employeesBase = () => `/api/v1/t/${tenantSlug}/hrms/employees`

  beforeAll(async () => {
    await ensurePermissions()
    const { hashPassword } = await import('../../src/utils/password.js')
    const pw = await hashPassword('Test@123')
    const slug = `hrms11-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const tenant = await prisma.tenant.create({
      data: { name: 'HRMS Exit/FNF P11', slug, email: `hrms11-${Date.now()}@test.com`, status: 'ACTIVE' },
    })
    tenantId = tenant.id
    tenantSlug = slug
    cleanupTenantIds.push(tenant.id)

    const managerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        firstName: 'HR',
        lastName: 'Manager',
        email: `mgr11-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    managerUserId = managerUser.id

    const hrExecUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        firstName: 'HR',
        lastName: 'Executive',
        email: `hrexec11-${Date.now()}@test.com`,
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
        email: `sup11-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })

    const mgrPerms = await prisma.permission.findMany({ where: { name: { in: MANAGER_PERMS } } })
    const mgrRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Exit P11 Manager ${Date.now()}`,
        rolePermissions: { create: mgrPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: managerUser.id, roleId: mgrRole.id, tenantId: tenant.id } })

    const execPerms = await prisma.permission.findMany({ where: { name: { in: HR_EXEC_PERMS } } })
    const execRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Exit P11 Executive ${Date.now()}`,
        rolePermissions: { create: execPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: hrExecUser.id, roleId: execRole.id, tenantId: tenant.id } })

    const supPerms = await prisma.permission.findMany({ where: { name: { in: SUPERVISOR_PERMS } } })
    const supRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Exit P11 Supervisor ${Date.now()}`,
        rolePermissions: { create: supPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: supervisorUser.id, roleId: supRole.id, tenantId: tenant.id } })

    const le = await prisma.legalEntity.create({
      data: { tenantId: tenant.id, code: 'LE1', displayName: 'LE One', legalName: 'LE One Pvt Ltd', isDefault: true, isActive: true },
    })
    legalEntityId = le.id
    const branch = await prisma.branch.create({
      data: { tenantId: tenant.id, legalEntityId: le.id, code: 'BR1', name: 'Plant 1', branchType: 'FACTORY', isDefault: true, isActive: true },
    })
    branchId = branch.id
    const dept = await prisma.department.create({ data: { tenantId: tenant.id, code: 'PROD', name: 'Production' } })
    const desig = await prisma.hrDesignation.create({ data: { tenantId: tenant.id, code: 'WRK', name: 'Worker', isActive: true } })

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
        workerCategory: 'WORKER',
        employmentType: 'PERMANENT',
        status: 'ACTIVE',
        joinDate: new Date('2024-01-01'),
        noticePeriodDays: 30,
      },
    })
    exitingEmployeeId = worker.id

    const cancelWorker = await prisma.hrEmployee.create({
      data: {
        tenantId: tenant.id,
        employeeCode: 'EMP000002',
        firstName: 'Ravi',
        lastName: 'Kulkarni',
        displayName: 'Ravi Kulkarni',
        legalEntityId: le.id,
        branchId: branch.id,
        departmentId: dept.id,
        designationId: desig.id,
        workerCategory: 'WORKER',
        employmentType: 'PERMANENT',
        status: 'ACTIVE',
        joinDate: new Date('2024-01-01'),
        noticePeriodDays: 30,
      },
    })
    cancelEmployeeId = cancelWorker.id

    // Linked to the HR Manager's own login — used only for the self-approval-block test.
    const selfEmp = await prisma.hrEmployee.create({
      data: {
        tenantId: tenant.id,
        employeeCode: 'EMP000003',
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
        noticePeriodDays: 30,
      },
    })
    selfEmployeeId = selfEmp.id

    const other = await prisma.tenant.create({
      data: { name: 'Other P11', slug: `hrms11o-${Date.now()}`, email: `hrms11o-${Date.now()}@test.com`, status: 'ACTIVE' },
    })
    cleanupTenantIds.push(other.id)
    const otherUser = await prisma.user.create({
      data: {
        tenantId: other.id,
        firstName: 'Other',
        lastName: 'Admin',
        email: `other11-${Date.now()}@test.com`,
        passwordHash: pw,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const otherPerms = await prisma.permission.findMany({ where: { name: { in: MANAGER_PERMS } } })
    const otherRole = await prisma.role.create({
      data: {
        tenantId: other.id,
        name: `Other P11 ${Date.now()}`,
        rolePermissions: { create: otherPerms.map((p) => ({ permissionId: p.id })) },
      },
    })
    await prisma.userRole.create({ data: { userId: otherUser.id, roleId: otherRole.id, tenantId: other.id } })

    const mgrLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: managerUser.email, password: 'Test@123', tenantSlug: slug })
    expect(mgrLogin.status, JSON.stringify(mgrLogin.body)).toBe(200)
    managerToken = mgrLogin.body.data.accessToken

    const execLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: hrExecUser.email, password: 'Test@123', tenantSlug: slug })
    expect(execLogin.status, JSON.stringify(execLogin.body)).toBe(200)
    hrExecToken = execLogin.body.data.accessToken

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
  }, 180_000)

  afterAll(async () => {
    for (const id of cleanupTenantIds) {
      await prisma.hrFnfComponent.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrFullFinalSettlement.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrExitClearanceLine.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrExitClearanceItem.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrExitAssetLine.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployeeExit.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrEmployeeEmploymentHistory.deleteMany({ where: { tenantId: id } }).catch(() => {})
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
      await prisma.hrEmployeeSalaryAssignment.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructureVersion.deleteMany({ where: { tenantId: id } }).catch(() => {})
      await prisma.hrSalaryStructure.deleteMany({ where: { tenantId: id } }).catch(() => {})
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

  it('creates → submits → approves an exit; employee moves to ON_NOTICE and clearance is auto-seeded', async () => {
    const create = await request(app)
      .post(exitsBase())
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        employeeId: exitingEmployeeId,
        exitType: 'RESIGNATION',
        resignationDate: '2026-08-01',
        requestedLastWorkingDate: '2026-08-15',
        reason: 'Better opportunity',
      })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    exitId = create.body.data.id
    expect(create.body.data.status).toBe('DRAFT')
    expect(create.body.data.code).toMatch(/^EXIT-/)
    expect(create.body.data.noticePeriodDays).toBe(30)

    // A second in-progress exit for the same employee is rejected while this one is open.
    const dup = await request(app)
      .post(exitsBase())
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employeeId: exitingEmployeeId, exitType: 'RESIGNATION', requestedLastWorkingDate: '2026-09-01' })
    expect(dup.status, JSON.stringify(dup.body)).toBe(409)

    // Approving/submitting out of order is rejected.
    const approveTooEarly = await request(app)
      .post(`${exitsBase()}/${exitId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
    expect(approveTooEarly.status).toBe(400)

    const submit = await request(app)
      .post(`${exitsBase()}/${exitId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    expect(submit.body.data.status).toBe('SUBMITTED')

    const submitAgain = await request(app)
      .post(`${exitsBase()}/${exitId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(submitAgain.status).toBe(400)

    const approve = await request(app)
      .post(`${exitsBase()}/${exitId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)
    expect(approve.body.data.status).toBe('CLEARANCE_PENDING')
    expect(approve.body.data.approvedLastWorkingDate).toBe('2026-08-15')
    // resignation 2026-08-01 → LWD 2026-08-15 = 14 days served against a 30-day requirement.
    expect(approve.body.data.noticeServedDays).toBe(14)
    expect(approve.body.data.noticeShortfallDays).toBe(16)
    expect(approve.body.data.noticeExcessDays).toBe(0)

    const employee = await request(app)
      .get(`${employeesBase()}/${exitingEmployeeId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(employee.status, JSON.stringify(employee.body)).toBe(200)
    expect(employee.body.data.status).toBe('ON_NOTICE')

    const clearance = await request(app)
      .get(`${exitsBase()}/${exitId}/clearance`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(clearance.status, JSON.stringify(clearance.body)).toBe(200)
    expect(clearance.body.data).toHaveLength(6)
    const codes = clearance.body.data.map((l: { code: string }) => l.code).sort()
    expect(codes).toEqual(['ADMIN', 'DEPARTMENT', 'FINANCE', 'HR', 'IT', 'STORES'])
    for (const line of clearance.body.data) {
      expect(line.status).toBe('PENDING')
    }
  })

  it('self-approval is blocked — the HR Manager cannot approve their own exit', async () => {
    const create = await request(app)
      .post(exitsBase())
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employeeId: selfEmployeeId, exitType: 'RESIGNATION', requestedLastWorkingDate: '2026-09-30' })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    selfExitId = create.body.data.id

    await request(app).post(`${exitsBase()}/${selfExitId}/submit`).set('Authorization', `Bearer ${managerToken}`)

    const approve = await request(app)
      .post(`${exitsBase()}/${selfExitId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
    expect(approve.status, JSON.stringify(approve.body)).toBe(403)

    const mine = await request(app).get(`${exitsBase()}/mine`).set('Authorization', `Bearer ${managerToken}`)
    expect(mine.status, JSON.stringify(mine.body)).toBe(200)
    expect(mine.body.data.find((e: { id: string }) => e.id === selfExitId)?.status).toBe('SUBMITTED')
  })

  it('cancelling an approved exit reverts the employee from ON_NOTICE back to ACTIVE', async () => {
    const create = await request(app)
      .post(exitsBase())
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ employeeId: cancelEmployeeId, exitType: 'RESIGNATION', requestedLastWorkingDate: '2026-09-01' })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    const cancelExitId = create.body.data.id

    await request(app).post(`${exitsBase()}/${cancelExitId}/submit`).set('Authorization', `Bearer ${managerToken}`)
    const approve = await request(app)
      .post(`${exitsBase()}/${cancelExitId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)

    const beforeCancel = await request(app)
      .get(`${employeesBase()}/${cancelEmployeeId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(beforeCancel.body.data.status).toBe('ON_NOTICE')

    const cancel = await request(app)
      .post(`${exitsBase()}/${cancelExitId}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Employee withdrew resignation' })
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(200)
    expect(cancel.body.data.status).toBe('CANCELLED')

    const afterCancel = await request(app)
      .get(`${employeesBase()}/${cancelEmployeeId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(afterCancel.body.data.status).toBe('ACTIVE')

    // A cancelled exit cannot be cancelled again, nor can a new exit be blocked by it.
    const cancelAgain = await request(app)
      .post(`${exitsBase()}/${cancelExitId}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
    expect(cancelAgain.status).toBe(400)
  })

  it('clearance lines + an asset line auto-transition the exit to READY_FOR_SETTLEMENT once everything is resolved', async () => {
    const asset = await request(app)
      .post(`${exitsBase()}/${exitId}/assets`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ description: 'Company laptop', assetCategory: 'IT Equipment', recoveryAmount: 40000 })
    expect(asset.status, JSON.stringify(asset.body)).toBe(201)
    const assetLineId = asset.body.data.id
    expect(asset.body.data.status).toBe('PENDING')

    const setStatus = await request(app)
      .post(`${exitsBase()}/${exitId}/assets/${assetLineId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'DAMAGED', remarks: 'Screen cracked on return' })
    expect(setStatus.status, JSON.stringify(setStatus.body)).toBe(200)
    expect(setStatus.body.data.line.status).toBe('DAMAGED')
    // Clearance lines are all still pending — readiness has not transitioned yet.
    expect(setStatus.body.data.exitStatus).toBe('CLEARANCE_PENDING')

    const clearance = await request(app)
      .get(`${exitsBase()}/${exitId}/clearance`)
      .set('Authorization', `Bearer ${managerToken}`)
    const lines: Array<{ id: string; code: string }> = clearance.body.data
    const byCode = new Map(lines.map((l) => [l.code, l.id]))

    for (const code of ['IT', 'ADMIN', 'STORES', 'FINANCE', 'HR']) {
      const clear = await request(app)
        .post(`${exitsBase()}/${exitId}/clearance/${byCode.get(code)}/clear`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({})
      expect(clear.status, `${code}: ${JSON.stringify(clear.body)}`).toBe(200)
      expect(clear.body.data.line.status).toBe('CLEARED')
      // Still one line (DEPARTMENT) pending — readiness has not transitioned yet.
      expect(clear.body.data.exitStatus).toBe('CLEARANCE_PENDING')
    }

    // Waiving without a reason is rejected by validation.
    const waiveNoReason = await request(app)
      .post(`${exitsBase()}/${exitId}/clearance/${byCode.get('DEPARTMENT')}/waive`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
    expect(waiveNoReason.status).toBe(400)

    const waive = await request(app)
      .post(`${exitsBase()}/${exitId}/clearance/${byCode.get('DEPARTMENT')}/waive`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Employee has no department-issued property' })
    expect(waive.status, JSON.stringify(waive.body)).toBe(200)
    expect(waive.body.data.line.status).toBe('WAIVED')
    // Last pending clearance line resolved + no pending asset lines → auto-transition.
    expect(waive.body.data.exitStatus).toBe('READY_FOR_SETTLEMENT')

    // Asset lines can no longer be added once the exit is ready for settlement.
    const lateAsset = await request(app)
      .post(`${exitsBase()}/${exitId}/assets`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ description: 'ID card', recoveryAmount: 0 })
    expect(lateAsset.status).toBe(400)
  })

  it('F&F calculate flags NO_SALARY_ASSIGNMENT as a BLOCKER and blocks approval until resolved', async () => {
    const calc = await request(app)
      .post(`${fnfBase()}/${exitId}/calculate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(calc.status, JSON.stringify(calc.body)).toBe(200)
    expect(calc.body.data.status).toBe('CALCULATED')

    const blockers = calc.body.data.exceptions.filter((e: { severity: string }) => e.severity === 'BLOCKER')
    expect(blockers.map((b: { code: string }) => b.code)).toContain('NO_SALARY_ASSIGNMENT')

    // The 40000 asset recovery is already included (notice recovery is skipped with no
    // salary assignment to derive a daily rate) — the settlement is negative regardless.
    expect(calc.body.data.deductionsTotal).toBe(40000)
    expect(calc.body.data.netSettlement).toBeLessThan(0)

    const approve = await request(app)
      .post(`${fnfBase()}/${exitId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(approve.status, JSON.stringify(approve.body)).toBe(422)
    expect(approve.body.code).toBe('FNF_BLOCKERS_UNRESOLVED')
  })

  it('recalculating after a salary assignment resolves the blocker and produces a negative net settlement', async () => {
    const structure = await prisma.hrSalaryStructure.create({
      data: { tenantId, code: 'FNF-STR', name: 'FNF Structure', isActive: true },
    })
    const version = await prisma.hrSalaryStructureVersion.create({
      data: { tenantId, salaryStructureId: structure.id, versionNo: 1, effectiveFrom: new Date('2026-01-01'), status: 'ACTIVE' },
    })
    await prisma.hrEmployeeSalaryAssignment.create({
      data: {
        tenantId,
        employeeId: exitingEmployeeId,
        salaryStructureVersionId: version.id,
        effectiveFrom: new Date('2026-01-01'),
        monthlyGross: 3000,
        annualCtc: 36000,
        status: 'ACTIVE',
      },
    })

    const calc = await request(app)
      .post(`${fnfBase()}/${exitId}/calculate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(calc.status, JSON.stringify(calc.body)).toBe(200)

    const blockers = calc.body.data.exceptions.filter((e: { severity: string }) => e.severity === 'BLOCKER')
    expect(blockers).toHaveLength(0)

    const components: Array<{ code: string; kind: string; amount: number }> = calc.body.data.components
    const assetLine = components.find((c) => c.code === 'ASSET_RECOVERY')
    expect(assetLine).toMatchObject({ kind: 'DEDUCTION', amount: 40000 })
    const noticeLine = components.find((c) => c.code === 'NOTICE_RECOVERY')
    // dailyRate 3000/30 = 100 × 16 shortfall days.
    expect(noticeLine).toMatchObject({ kind: 'DEDUCTION', amount: 1600 })

    expect(calc.body.data.earningsTotal).toBeGreaterThanOrEqual(0)
    // NOTICE_RECOVERY (1600) + ASSET_RECOVERY (40000) — pending salary is an EARNING, not a deduction.
    expect(calc.body.data.deductionsTotal).toBe(41600)
    expect(calc.body.data.netSettlement).toBeLessThan(0)
    expect(calc.body.data.netSettlement).toBe(calc.body.data.earningsTotal - calc.body.data.deductionsTotal)

    const review = await request(app)
      .post(`${fnfBase()}/${exitId}/review`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(review.status, JSON.stringify(review.body)).toBe(200)
    expect(review.body.data.status).toBe('REVIEWED')

    // Once reviewed the settlement can no longer be recalculated.
    const recalcAfterReview = await request(app)
      .post(`${fnfBase()}/${exitId}/calculate`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(recalcAfterReview.status).toBe(400)

    const approve = await request(app)
      .post(`${fnfBase()}/${exitId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)
    expect(approve.body.data.status).toBe('APPROVED')
  })

  it('posts the negative-net settlement to the GL and auto-completes the exit (employee → EXITED, exit → CLOSED)', async () => {
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

    const mkAccount = async (code: string, name: string, category: 'ASSET' | 'INCOME' | 'EXPENSE', normalBalance: 'DEBIT' | 'CREDIT') =>
      prisma.account.create({
        data: {
          tenantId,
          legalEntityId,
          accountCode: `${code}-${Date.now()}`.slice(0, 32),
          accountName: name,
          category,
          accountType: 'GENERAL',
          level: 1,
          isGroup: false,
          isActive: true,
          normalBalance,
          allowManualPosting: true,
        },
      })

    const salaryExpenseAccount = await mkAccount('SALEXP', 'Salary Basic Expense', 'EXPENSE', 'DEBIT')
    const noticeIncomeAccount = await mkAccount('NOTINC', 'Notice Recovery Income', 'INCOME', 'CREDIT')
    const assetIncomeAccount = await mkAccount('ASTINC', 'Asset Recovery Income', 'INCOME', 'CREDIT')
    const fnfReceivableAccount = await mkAccount('FNFRCV', 'Employee F&F Receivable', 'ASSET', 'DEBIT')

    await prisma.defaultAccountMapping.createMany({
      data: [
        { tenantId, legalEntityId, mappingKey: 'SALARY_BASIC_EXPENSE', accountId: salaryExpenseAccount.id, isMandatory: true },
        { tenantId, legalEntityId, mappingKey: 'NOTICE_RECOVERY_INCOME', accountId: noticeIncomeAccount.id, isMandatory: true },
        { tenantId, legalEntityId, mappingKey: 'ASSET_RECOVERY_INCOME', accountId: assetIncomeAccount.id, isMandatory: true },
        { tenantId, legalEntityId, mappingKey: 'EMPLOYEE_FNF_RECEIVABLE', accountId: fnfReceivableAccount.id, isMandatory: true },
      ],
    })

    const post = await request(app)
      .post(`${fnfBase()}/${exitId}/post`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(post.status, JSON.stringify(post.body)).toBe(200)
    expect(post.body.data.status).toBe('POSTED')
    expect(post.body.data.accountingVoucherId).toBeTruthy()

    // Idempotent — posting again returns the same already-posted settlement without error.
    const postAgain = await request(app)
      .post(`${fnfBase()}/${exitId}/post`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(postAgain.status, JSON.stringify(postAgain.body)).toBe(200)
    expect(postAgain.body.data.accountingVoucherId).toBe(post.body.data.accountingVoucherId)

    const voucher = await prisma.accountingVoucher.findFirst({ where: { id: post.body.data.accountingVoucherId } })
    expect(voucher).toBeTruthy()
    expect(Number(voucher!.totalDebit)).toBe(Number(voucher!.totalCredit))

    const employee = await request(app)
      .get(`${employeesBase()}/${exitingEmployeeId}`)
      .set('Authorization', `Bearer ${managerToken}`)
    expect(employee.body.data.status).toBe('EXITED')

    const exit = await request(app).get(`${exitsBase()}/${exitId}`).set('Authorization', `Bearer ${managerToken}`)
    expect(exit.body.data.status).toBe('CLOSED')
  })

  it('pay is blocked with AMOUNT_RECOVERABLE for a negative-net settlement — the balance is owed by the employee, not to them', async () => {
    const treasuryGl = await prisma.account.create({
      data: {
        tenantId,
        legalEntityId,
        accountCode: `BANK-P11-${Date.now()}`.slice(0, 32),
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
        code: `BANK-P11-${Date.now()}`.slice(0, 32),
        name: 'Bank Current Account',
        accountType: 'BANK',
        status: 'ACTIVE',
        glAccountId: treasuryGl.id,
      },
    })

    const pay = await request(app)
      .post(`${fnfBase()}/${exitId}/pay`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ treasuryAccountId: treasuryAccount.id, method: 'BANK', paymentDate: '2026-08-20' })
    expect(pay.status, JSON.stringify(pay.body)).toBe(422)
    expect(pay.body.code).toBe('AMOUNT_RECOVERABLE')
  })

  it('permissions — HR Executive role can raise/clear exits and calculate F&F but cannot approve/post/pay', async () => {
    const list = await request(app).get(exitsBase()).set('Authorization', `Bearer ${hrExecToken}`)
    expect(list.status, JSON.stringify(list.body)).toBe(200)

    const create = await request(app)
      .post(exitsBase())
      .set('Authorization', `Bearer ${hrExecToken}`)
      .send({ employeeId: cancelEmployeeId, exitType: 'RESIGNATION', requestedLastWorkingDate: '2026-10-01' })
    expect(create.status, JSON.stringify(create.body)).toBe(201)
    const execExitId = create.body.data.id

    const approveDenied = await request(app)
      .post(`${exitsBase()}/${execExitId}/approve`)
      .set('Authorization', `Bearer ${hrExecToken}`)
      .send({})
    expect(approveDenied.status).toBe(403)

    const reviewDenied = await request(app).post(`${fnfBase()}/${exitId}/review`).set('Authorization', `Bearer ${hrExecToken}`)
    expect(reviewDenied.status).toBe(403)

    const approveFnfDenied = await request(app).post(`${fnfBase()}/${exitId}/approve`).set('Authorization', `Bearer ${hrExecToken}`)
    expect(approveFnfDenied.status).toBe(403)

    const postDenied = await request(app).post(`${fnfBase()}/${exitId}/post`).set('Authorization', `Bearer ${hrExecToken}`)
    expect(postDenied.status).toBe(403)

    const payDenied = await request(app)
      .post(`${fnfBase()}/${exitId}/pay`)
      .set('Authorization', `Bearer ${hrExecToken}`)
      .send({ treasuryAccountId: '00000000-0000-0000-0000-000000000000', method: 'BANK', paymentDate: '2026-08-20' })
    expect(payDenied.status).toBe(403)
  })

  it('permissions — supervisor without exit/F&F perms is denied everything', async () => {
    const list = await request(app).get(exitsBase()).set('Authorization', `Bearer ${supervisorToken}`)
    expect(list.status).toBe(403)

    const create = await request(app)
      .post(exitsBase())
      .set('Authorization', `Bearer ${supervisorToken}`)
      .send({ employeeId: cancelEmployeeId, exitType: 'RESIGNATION', requestedLastWorkingDate: '2026-10-01' })
    expect(create.status).toBe(403)

    const fnfList = await request(app).get(fnfBase()).set('Authorization', `Bearer ${supervisorToken}`)
    expect(fnfList.status).toBe(403)

    const calcDenied = await request(app).post(`${fnfBase()}/${exitId}/calculate`).set('Authorization', `Bearer ${supervisorToken}`)
    expect(calcDenied.status).toBe(403)
  })

  it('tenant isolation — a cross-tenant token cannot reach this tenant\'s exit or settlement', async () => {
    const getExit = await request(app).get(`${exitsBase()}/${exitId}`).set('Authorization', `Bearer ${otherTenantToken}`)
    expect([403, 404]).toContain(getExit.status)

    const listExits = await request(app).get(exitsBase()).set('Authorization', `Bearer ${otherTenantToken}`)
    expect([200, 403]).toContain(listExits.status)
    if (listExits.status === 200) {
      expect(listExits.body.data.find((e: { id: string }) => e.id === exitId)).toBeFalsy()
    }

    const getSettlement = await request(app).get(`${fnfBase()}/${exitId}`).set('Authorization', `Bearer ${otherTenantToken}`)
    expect([403, 404]).toContain(getSettlement.status)
  })
})
