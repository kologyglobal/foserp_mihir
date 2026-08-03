import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import { maskAccountNumber } from '../employees/employee.mapper.js'
import type { ListMyPayslipsQuery, ListPayslipsQuery } from './payroll.schemas.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function dec(n: Prisma.Decimal | number | string | null | undefined): number {
  if (n == null) return 0
  return Number(n)
}

export interface PayslipSnapshot {
  header: {
    company: string
    payrollMonth: string
    employeeCode: string
    employeeName: string
    department: string
    designation: string
    branch: string
    bankAccountMasked: string | null
  }
  attendance: {
    workingDays: number
    paidDays: number
    lop: number
    paidLeave: number
    approvedOtMinutes: number
  }
  earnings: Array<{ code: string; name: string; amount: number }>
  deductions: Array<{ code: string; name: string; amount: number }>
  employerContributions: Array<{ code: string; name: string; amount: number }>
  totals: { gross: number; totalDeduction: number; netPay: number; employer: number }
}

function parseSnapshot(raw: string): PayslipSnapshot | null {
  try {
    return JSON.parse(raw) as PayslipSnapshot
  } catch {
    return null
  }
}

const employeeResultForSnapshotInclude = {
  components: { orderBy: { sequence: 'asc' } },
  employee: {
    include: {
      department: { select: { name: true } },
      designation: { select: { name: true } },
      branch: { select: { name: true } },
    },
  },
} satisfies Prisma.HrPayrollEmployeeResultInclude

type EmployeeResultForSnapshot = Prisma.HrPayrollEmployeeResultGetPayload<{
  include: typeof employeeResultForSnapshotInclude
}>

function buildSnapshot(
  result: EmployeeResultForSnapshot,
  period: { year: number; month: number },
  companyName: string,
  bank: { accountNumber: string } | undefined,
): PayslipSnapshot {
  const earnings = result.components
    .filter((c) => c.type === 'EARNING')
    .map((c) => ({ code: c.componentCode, name: c.componentName, amount: dec(c.amount) }))
  const deductions = result.components
    .filter((c) => c.type === 'DEDUCTION')
    .map((c) => ({ code: c.componentCode, name: c.componentName, amount: dec(c.amount) }))
  const employerContributions = result.components
    .filter((c) => c.type === 'EMPLOYER_CONTRIBUTION')
    .map((c) => ({ code: c.componentCode, name: c.componentName, amount: dec(c.amount) }))

  return {
    header: {
      company: companyName,
      payrollMonth: `${MONTH_NAMES[period.month - 1] ?? period.month} ${period.year}`,
      employeeCode: result.employee.employeeCode,
      employeeName: result.employee.displayName,
      department: result.employee.department?.name ?? '',
      designation: result.employee.designation?.name ?? '',
      branch: result.employee.branch?.name ?? '',
      bankAccountMasked: bank ? maskAccountNumber(bank.accountNumber) : null,
    },
    attendance: {
      workingDays: result.basisDays,
      paidDays: dec(result.payableDays),
      lop: dec(result.lopDays),
      paidLeave: dec(result.paidLeaveDays),
      approvedOtMinutes: result.approvedOtMinutes,
    },
    earnings,
    deductions,
    employerContributions,
    totals: {
      gross: dec(result.grossAmount),
      totalDeduction: dec(result.deductionAmount),
      netPay: dec(result.netAmount),
      employer: dec(result.employerAmount),
    },
  }
}

async function loadRunForAccess(tenantId: string, runId: string, scope: UserDataScope) {
  const run = await prisma.hrPayrollRun.findFirst({ where: { id: runId, tenantId, deletedAt: null } })
  if (!run) throw new NotFoundError('Payroll run not found')
  assertHrAccess(scope, { legalEntityId: run.legalEntityId, branchId: run.branchId })
  return run
}

/**
 * Generate immutable payslips for every FINALIZED employee result on a FINALIZED run
 * that does not yet have one. Snapshot is built entirely from the frozen calculation
 * result + components — never recalculated from current salary masters.
 */
export async function generatePayslipsForRun(
  tenantId: string,
  runId: string,
  scope: UserDataScope,
  audit?: AuditMeta,
) {
  const run = await loadRunForAccess(tenantId, runId, scope)
  if (run.status !== 'FINALIZED') {
    throw new InvalidStateError('Payslips can only be generated for a FINALIZED payroll run')
  }

  const period = await prisma.hrPayrollPeriod.findFirst({ where: { id: run.payrollPeriodId, tenantId } })
  if (!period) throw new NotFoundError('Payroll period not found')

  const legalEntity = await prisma.legalEntity.findFirst({
    where: { id: run.legalEntityId, tenantId },
    select: { displayName: true, legalName: true },
  })
  const companyName = legalEntity?.displayName || legalEntity?.legalName || 'Company'

  const pending = await prisma.hrPayrollEmployeeResult.findMany({
    where: { tenantId, payrollRunId: runId, status: 'FINALIZED', payslip: null },
    include: employeeResultForSnapshotInclude,
    orderBy: { createdAt: 'asc' },
  })

  const existingCount = await prisma.hrPayslip.count({ where: { tenantId, payrollRunId: runId } })

  if (pending.length === 0) {
    return { runId, generatedCount: 0, totalPayslips: existingCount, payslipIds: [] as string[] }
  }

  const employeeIds = pending.map((r) => r.employeeId)
  const banks = await prisma.hrEmployeeBankDetail.findMany({
    where: { tenantId, employeeId: { in: employeeIds }, isPrimary: true, deletedAt: null },
    select: { employeeId: true, accountNumber: true },
  })
  const bankByEmployee = new Map(banks.map((b) => [b.employeeId, b]))

  const createdIds = await prisma.$transaction(
    async (tx) => {
      const ids: string[] = []
      for (const result of pending) {
        const snapshot = buildSnapshot(result, period, companyName, bankByEmployee.get(result.employeeId))
        const payslipNumber = await nextCode(tenantId, 'PAYSLIP', tx)
        const row = await tx.hrPayslip.create({
          data: {
            tenantId,
            payrollRunId: runId,
            payrollEmployeeResultId: result.id,
            employeeId: result.employeeId,
            legalEntityId: run.legalEntityId,
            payslipNumber,
            year: period.year,
            month: period.month,
            snapshotJson: JSON.stringify(snapshot),
            grossAmount: result.grossAmount,
            deductionAmount: result.deductionAmount,
            employerAmount: result.employerAmount,
            netAmount: result.netAmount,
            generatedByUserId: audit?.userId ?? null,
          },
        })
        ids.push(row.id)
      }

      await tx.hrPayrollRun.update({
        where: { id: runId },
        data: { payslipGeneratedAt: new Date() },
      })

      return ids
    },
    { timeout: 60000 },
  )

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrPayslip',
    entityId: runId,
    action: 'PAYSLIP_GENERATED',
    newValues: { payrollRunId: runId, generatedCount: createdIds.length },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return {
    runId,
    generatedCount: createdIds.length,
    totalPayslips: existingCount + createdIds.length,
    payslipIds: createdIds,
  }
}

function mapPayslipSummary(row: {
  id: string
  payrollRunId: string
  employeeId: string
  legalEntityId: string
  payslipNumber: string
  year: number
  month: number
  grossAmount: Prisma.Decimal
  deductionAmount: Prisma.Decimal
  employerAmount: Prisma.Decimal
  netAmount: Prisma.Decimal
  status: string
  paymentStatus: string
  generatedAt: Date
  employee?: { id: string; employeeCode: string; displayName: string } | null
}) {
  return {
    id: row.id,
    payrollRunId: row.payrollRunId,
    employeeId: row.employeeId,
    employee: row.employee ?? null,
    legalEntityId: row.legalEntityId,
    payslipNumber: row.payslipNumber,
    year: row.year,
    month: row.month,
    grossAmount: dec(row.grossAmount),
    deductionAmount: dec(row.deductionAmount),
    employerAmount: dec(row.employerAmount),
    netAmount: dec(row.netAmount),
    status: row.status,
    paymentStatus: row.paymentStatus,
    generatedAt: row.generatedAt.toISOString(),
  }
}

function buildEmployeeAnd(query: { branchId?: string; departmentId?: string }, scope: UserDataScope) {
  const employeeAnd: Prisma.HrEmployeeWhereInput[] = []
  if (query.branchId) employeeAnd.push({ branchId: query.branchId })
  if (query.departmentId) employeeAnd.push({ departmentId: query.departmentId })
  if (!scope.unrestricted && scope.branches.length > 0) {
    employeeAnd.push({ branchId: { in: scope.branches.map((x) => x.branchId) } })
  }
  return employeeAnd
}

export async function listPayslips(tenantId: string, scope: UserDataScope, query: ListPayslipsQuery) {
  const { page, limit, skip } = getPagination(query)

  const and: Prisma.HrPayslipWhereInput[] = []
  if (query.legalEntityId) and.push({ legalEntityId: query.legalEntityId })
  if (!scope.unrestricted && scope.legalEntities.length > 0) {
    and.push({ legalEntityId: { in: scope.legalEntities.map((x) => x.legalEntityId) } })
  }
  const employeeAnd = buildEmployeeAnd(query, scope)
  if (employeeAnd.length > 0) and.push({ employee: { AND: employeeAnd } })

  const where: Prisma.HrPayslipWhereInput = {
    tenantId,
    ...(query.year ? { year: query.year } : {}),
    ...(query.month ? { month: query.month } : {}),
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.payrollRunId ? { payrollRunId: query.payrollRunId } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.hrPayslip.count({ where }),
    prisma.hrPayslip.findMany({
      where,
      include: { employee: { select: { id: true, employeeCode: true, displayName: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map(mapPayslipSummary), total, page, limit }
}

async function loadPayslipForAccess(tenantId: string, payslipId: string, scope: UserDataScope) {
  const row = await prisma.hrPayslip.findFirst({
    where: { id: payslipId, tenantId },
    include: {
      employee: { select: { id: true, employeeCode: true, displayName: true, branchId: true } },
      run: { select: { id: true, code: true, status: true } },
    },
  })
  if (!row) throw new NotFoundError('Payslip not found')
  assertHrAccess(scope, { legalEntityId: row.legalEntityId, branchId: row.employee.branchId })
  return row
}

export async function getPayslip(tenantId: string, payslipId: string, scope: UserDataScope) {
  const row = await loadPayslipForAccess(tenantId, payslipId, scope)
  return {
    ...mapPayslipSummary(row),
    run: row.run,
    snapshot: parseSnapshot(row.snapshotJson),
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function rowsHtml(lines: Array<{ code: string; name: string; amount: number }>): string {
  if (lines.length === 0) {
    return '<tr><td colspan="2" class="empty">None</td></tr>'
  }
  return lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.name)} <span class="code">(${escapeHtml(l.code)})</span></td><td class="amt">${money(l.amount)}</td></tr>`,
    )
    .join('')
}

export async function getPayslipHtml(tenantId: string, payslipId: string, scope: UserDataScope): Promise<string> {
  const row = await loadPayslipForAccess(tenantId, payslipId, scope)
  const snapshot = parseSnapshot(row.snapshotJson)
  if (!snapshot) throw new NotFoundError('Payslip snapshot could not be parsed')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Payslip ${escapeHtml(row.payslipNumber)}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; padding: 32px; background: #f8fafc; }
  .sheet { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; margin: 0 0 4px; color: #1d4ed8; }
  .header .muted { color: #64748b; font-size: 13px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 20px; font-size: 13px; }
  .meta-grid .label { color: #64748b; }
  .meta-grid .value { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
  th { text-align: left; background: #eff6ff; color: #1d4ed8; padding: 8px 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
  td.amt { text-align: right; font-weight: 600; }
  td.empty { color: #94a3b8; font-style: italic; }
  .code { color: #94a3b8; font-size: 11px; }
  .totals-row td { font-weight: 700; border-top: 2px solid #cbd5e1; }
  .attendance { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px; text-align: center; }
  .attendance div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; }
  .attendance .num { font-size: 16px; font-weight: 700; color: #1d4ed8; }
  .attendance .lbl { font-size: 11px; color: #64748b; }
  .netpay { background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; text-align: center; margin-top: 8px; }
  .netpay .amount { font-size: 24px; font-weight: 800; color: #047857; }
  .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1>${escapeHtml(snapshot.header.company)}</h1>
        <div class="muted">Payslip — ${escapeHtml(snapshot.header.payrollMonth)}</div>
      </div>
      <div class="muted">${escapeHtml(row.payslipNumber)}</div>
    </div>

    <div class="meta-grid">
      <div><span class="label">Employee:</span> <span class="value">${escapeHtml(snapshot.header.employeeName)} (${escapeHtml(snapshot.header.employeeCode)})</span></div>
      <div><span class="label">Department:</span> <span class="value">${escapeHtml(snapshot.header.department)}</span></div>
      <div><span class="label">Designation:</span> <span class="value">${escapeHtml(snapshot.header.designation)}</span></div>
      <div><span class="label">Branch:</span> <span class="value">${escapeHtml(snapshot.header.branch)}</span></div>
      <div><span class="label">Bank Account:</span> <span class="value">${escapeHtml(snapshot.header.bankAccountMasked ?? 'Not on file')}</span></div>
      <div><span class="label">Payment Status:</span> <span class="value">${escapeHtml(row.paymentStatus)}</span></div>
    </div>

    <div class="attendance">
      <div><div class="num">${snapshot.attendance.workingDays}</div><div class="lbl">Working Days</div></div>
      <div><div class="num">${snapshot.attendance.paidDays}</div><div class="lbl">Paid Days</div></div>
      <div><div class="num">${snapshot.attendance.lop}</div><div class="lbl">LOP Days</div></div>
      <div><div class="num">${snapshot.attendance.paidLeave}</div><div class="lbl">Paid Leave</div></div>
      <div><div class="num">${Math.round((snapshot.attendance.approvedOtMinutes / 60) * 100) / 100}</div><div class="lbl">OT Hours</div></div>
    </div>

    <table>
      <thead><tr><th>Earnings</th><th class="amt">Amount (₹)</th></tr></thead>
      <tbody>
        ${rowsHtml(snapshot.earnings)}
        <tr class="totals-row"><td>Gross Earnings</td><td class="amt">${money(snapshot.totals.gross)}</td></tr>
      </tbody>
    </table>

    <table>
      <thead><tr><th>Deductions</th><th class="amt">Amount (₹)</th></tr></thead>
      <tbody>
        ${rowsHtml(snapshot.deductions)}
        <tr class="totals-row"><td>Total Deductions</td><td class="amt">${money(snapshot.totals.totalDeduction)}</td></tr>
      </tbody>
    </table>

    <table>
      <thead><tr><th>Employer Contributions (info only, not deducted)</th><th class="amt">Amount (₹)</th></tr></thead>
      <tbody>
        ${rowsHtml(snapshot.employerContributions)}
        <tr class="totals-row"><td>Total Employer Contribution</td><td class="amt">${money(snapshot.totals.employer)}</td></tr>
      </tbody>
    </table>

    <div class="netpay">
      <div class="lbl">Net Pay</div>
      <div class="amount">₹ ${money(snapshot.totals.netPay)}</div>
    </div>

    <div class="footer">This is a system-generated payslip and does not require a signature.</div>
  </div>
</body>
</html>`
}

export async function listMyPayslips(tenantId: string, userId: string, query: ListMyPayslipsQuery) {
  const employee = await prisma.hrEmployee.findFirst({ where: { tenantId, userId, deletedAt: null } })
  if (!employee) {
    throw new NotFoundError('No employee profile is linked to your account')
  }

  const { page, limit, skip } = getPagination(query)
  const where: Prisma.HrPayslipWhereInput = {
    tenantId,
    employeeId: employee.id,
    ...(query.year ? { year: query.year } : {}),
    ...(query.month ? { month: query.month } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.payrollRunId ? { payrollRunId: query.payrollRunId } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.hrPayslip.count({ where }),
    prisma.hrPayslip.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ])

  return { items: rows.map((r) => mapPayslipSummary(r)), total, page, limit }
}
