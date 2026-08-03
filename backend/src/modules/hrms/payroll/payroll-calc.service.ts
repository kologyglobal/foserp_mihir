import type { HrSalaryCalculationType, HrSalaryComponentType, Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { calculateStatutoryForEmployee } from '../statutory/statutory-engine.service.js'
import { getDueRecoveriesForEmployee, buildPayrollRecoveryComponents } from '../loans/loan-recovery.service.js'
import { toDateOnly } from '../shared/shift-time.util.js'
import { computePaidDaysBreakdown, isEmployeeEligibleForPeriod, sumPayableInRange } from './paid-days.service.js'
import {
  countPendingOt,
  countUnresolvedAttendanceExceptions,
  hasPrimaryBankDetail,
  sumApprovedOtMinutes,
} from './payroll-exception.service.js'

/** Human-friendly names for engine-appended statutory lines with no matching salary component. */
const STATUTORY_COMPONENT_NAMES: Record<string, string> = {
  PF_EMPLOYEE: 'PF (Employee)',
  PF_EMPLOYER: 'PF (Employer)',
  ESIC_EMPLOYEE: 'ESIC (Employee)',
  ESIC_EMPLOYER: 'ESIC (Employer)',
  PT: 'Professional Tax',
  TDS: 'TDS',
  LWF_EMPLOYEE: 'LWF (Employee)',
  LWF_EMPLOYER: 'LWF (Employer)',
}

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

type ExceptionSeverity = 'BLOCKER' | 'WARNING'

interface ExceptionDraft {
  code: string
  severity: ExceptionSeverity
  message: string
}

type SalaryLine = {
  salaryComponentId: string
  sequence: number
  calculationType: string
  fixedAmount: Prisma.Decimal | null
  percentage: Prisma.Decimal | null
  percentageOfComponentId: string | null
  monthlyCap: Prisma.Decimal | null
  salaryComponent: { code: string; name: string; type: string }
}

interface ResolvedLine {
  salaryComponentId: string | null
  componentCode: string
  componentName: string
  componentType: string
  calculationType: string
  sequence: number
  amount: number
  quantity: number | null
  rate: number | null
  calculationBasis: string | null
  notes: string | null
}

interface SegmentContext {
  payableDays: number
  basisDays: number
  lopDays: number
  approvedOtMinutes: number
  monthlyGross: number | null
  isFinalSegment: boolean
}

interface EmployeeCalcResult {
  employeeId: string
  totalCalendarDays: number
  basisDays: number
  payableDays: number
  presentDays: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  lopDays: number
  weeklyOffDays: number
  holidayDays: number
  approvedOtMinutes: number
  paidDaysBreakdownJson: string
  salaryStructureId: string | null
  salaryStructureVersionId: string | null
  salaryAssignmentId: string | null
  gross: number
  deduction: number
  employer: number
  net: number
  status: 'CALCULATED' | 'ERROR'
  components: ResolvedLine[]
  exceptions: ExceptionDraft[]
  calculationNotesJson: string | null
  errorCode: string | null
  errorMessage: string | null
}

export interface RunCalculationSummary {
  runId: string
  status: string
  employeeCount: number
  grossAmount: number
  deductionAmount: number
  employerAmount: number
  netAmount: number
  calculatedAt: string
  exceptionSummary: { blockers: number; warnings: number }
}

function dec(n: Prisma.Decimal | number | string | null | undefined): number | null {
  if (n == null) return null
  return Number(n)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function applyCap(amount: number, monthlyCap: number | null): number {
  if (monthlyCap != null && amount > monthlyCap) return round2(monthlyCap)
  return round2(amount)
}

/**
 * Resolve every active line of one structure version for one salary segment.
 * FIXED / PERCENTAGE / ATTENDANCE_LINKED(earning) prorate per segment (summed by the caller);
 * ATTENDANCE_LINKED(code=LOP) / OT_LINKED / STATUTORY are period-level and only active on the
 * final (period-end) segment to avoid double counting across mid-period salary revisions.
 */
function resolveSegmentLines(
  lines: SalaryLine[],
  ctx: SegmentContext,
  exceptions: ExceptionDraft[],
): ResolvedLine[] {
  const sorted = [...lines].sort((a, b) => a.sequence - b.sequence)
  const amounts = new Map<string, number>()
  const earningsSoFar: string[] = []
  const results: ResolvedLine[] = []
  const fraction = ctx.basisDays > 0 ? ctx.payableDays / ctx.basisDays : 0

  for (const line of sorted) {
    const base: ResolvedLine = {
      salaryComponentId: line.salaryComponentId,
      componentCode: line.salaryComponent.code,
      componentName: line.salaryComponent.name,
      componentType: line.salaryComponent.type,
      calculationType: line.calculationType,
      sequence: line.sequence,
      amount: 0,
      quantity: null,
      rate: null,
      calculationBasis: null,
      notes: null,
    }

    if (line.calculationType === 'FIXED') {
      const fixed = dec(line.fixedAmount) ?? 0
      const amount = applyCap(fixed * fraction, dec(line.monthlyCap))
      base.amount = amount
      base.quantity = round2(fraction)
      base.rate = fixed
      base.calculationBasis = `FIXED: monthly ${fixed} × (${ctx.payableDays}/${ctx.basisDays})`
      amounts.set(line.salaryComponentId, amount)
    } else if (line.calculationType === 'PERCENTAGE') {
      const pct = dec(line.percentage) ?? 0
      const ofId = line.percentageOfComponentId
      const baseAmount = ofId ? amounts.get(ofId) : undefined
      if (!ofId || baseAmount == null) {
        base.notes = 'Base component amount not resolved for percentage line'
      } else {
        const amount = applyCap((baseAmount * pct) / 100, dec(line.monthlyCap))
        base.amount = amount
        base.quantity = pct
        base.rate = baseAmount
        base.calculationBasis = `PERCENTAGE: ${pct}% of ${baseAmount}`
        amounts.set(line.salaryComponentId, amount)
      }
    } else if (line.calculationType === 'ATTENDANCE_LINKED') {
      const isLopLine = line.salaryComponent.code.toUpperCase() === 'LOP'
      if (isLopLine) {
        if (!ctx.isFinalSegment) {
          base.notes = 'Resolved from the period-end salary segment only'
        } else {
          const ofId = line.percentageOfComponentId
          const configuredBase = ofId ? amounts.get(ofId) : undefined
          const grossSoFar = earningsSoFar.reduce((sum, id) => sum + (amounts.get(id) ?? 0), 0)
          const lopBase = configuredBase ?? ctx.monthlyGross ?? grossSoFar
          const perDay = ctx.basisDays > 0 ? lopBase / ctx.basisDays : 0
          const amount = round2(perDay * ctx.lopDays)
          base.amount = amount
          base.quantity = ctx.lopDays
          base.rate = round2(perDay)
          base.calculationBasis = `ATTENDANCE_LINKED: LOP ${ctx.lopDays}d × (${round2(lopBase)}/${ctx.basisDays})`
          amounts.set(line.salaryComponentId, amount)
        }
      } else {
        const fixed = dec(line.fixedAmount) ?? 0
        const amount = applyCap(fixed * fraction, dec(line.monthlyCap))
        base.amount = amount
        base.quantity = round2(fraction)
        base.rate = fixed
        base.calculationBasis = `ATTENDANCE_LINKED: prorated by payable days (${ctx.payableDays}/${ctx.basisDays})`
        amounts.set(line.salaryComponentId, amount)
      }
    } else if (line.calculationType === 'OT_LINKED') {
      if (!ctx.isFinalSegment) {
        base.notes = 'Resolved from the period-end salary segment only'
      } else {
        const rate = dec(line.fixedAmount)
        if (rate == null) {
          base.notes = 'OT rate (₹/hour) not configured on this component line'
          if (ctx.approvedOtMinutes > 0) {
            exceptions.push({
              code: 'OT_RATE_NOT_CONFIGURED',
              severity: 'BLOCKER',
              message: `OT-linked component ${line.salaryComponent.code} has no configured ₹/hour rate`,
            })
          }
        } else {
          const amount = round2((ctx.approvedOtMinutes / 60) * rate)
          base.amount = amount
          base.quantity = round2(ctx.approvedOtMinutes / 60)
          base.rate = rate
          base.calculationBasis = `OT_LINKED: ${ctx.approvedOtMinutes}min × ₹${rate}/hr`
          amounts.set(line.salaryComponentId, amount)
        }
      }
    } else if (line.calculationType === 'STATUTORY') {
      if (ctx.isFinalSegment) {
        base.notes = 'STATUTORY_CALCULATION_PENDING'
        exceptions.push({
          code: 'STATUTORY_DATA_MISSING',
          severity: 'WARNING',
          message: `Statutory component ${line.salaryComponent.code} is not calculated in Phase 7 (engine pending)`,
        })
      } else {
        base.notes = 'Resolved from the period-end salary segment only'
      }
    }

    if (line.salaryComponent.type === 'EARNING' && amounts.has(line.salaryComponentId)) {
      earningsSoFar.push(line.salaryComponentId)
    }
    results.push(base)
  }

  return results
}

async function calculateEmployee(
  tenantId: string,
  employee: { id: string; joinDate: Date; status: string; legalEntityId: string; branchId: string },
  periodStart: Date,
  periodEnd: Date,
  payrollYear: number,
  payrollMonth: number,
): Promise<EmployeeCalcResult> {
  const paidDays = await computePaidDaysBreakdown(tenantId, employee.id, periodStart, periodEnd)
  const exceptions: ExceptionDraft[] = paidDays.warnings.map((w) => ({
    code: w.code,
    severity: 'WARNING',
    message: w.message,
  }))

  const approvedOtMinutes = await sumApprovedOtMinutes(tenantId, employee.id, periodStart, periodEnd)

  const pendingOt = await countPendingOt(tenantId, employee.id, periodStart, periodEnd)
  if (pendingOt > 0) {
    exceptions.push({
      code: 'PENDING_OT_APPROVAL',
      severity: 'WARNING',
      message: `${pendingOt} pending OT record(s) in this period were excluded from OT pay`,
    })
  }

  const unresolvedAttn = await countUnresolvedAttendanceExceptions(tenantId, employee.id, periodStart, periodEnd)
  if (unresolvedAttn > 0) {
    exceptions.push({
      code: 'UNRESOLVED_ATTENDANCE_EXCEPTION',
      severity: 'BLOCKER',
      message: `${unresolvedAttn} unresolved attendance exception(s) in this period`,
    })
  }

  const hasBank = await hasPrimaryBankDetail(tenantId, employee.id)
  if (!hasBank) {
    exceptions.push({
      code: 'MISSING_BANK_DETAILS',
      severity: 'WARNING',
      message: 'No primary bank account on file for this employee',
    })
  }

  const base = {
    employeeId: employee.id,
    totalCalendarDays: paidDays.basisDays,
    basisDays: paidDays.basisDays,
    payableDays: paidDays.totals.payableDays,
    presentDays: paidDays.totals.present,
    paidLeaveDays: paidDays.totals.paidLeave,
    unpaidLeaveDays: paidDays.totals.unpaidLeave,
    lopDays: paidDays.totals.lop,
    weeklyOffDays: paidDays.totals.weeklyOff,
    holidayDays: paidDays.totals.holiday,
    approvedOtMinutes,
    paidDaysBreakdownJson: JSON.stringify(paidDays),
  }

  const missingSalaryResult = (message: string): EmployeeCalcResult => ({
    ...base,
    salaryStructureId: null,
    salaryStructureVersionId: null,
    salaryAssignmentId: null,
    gross: 0,
    deduction: 0,
    employer: 0,
    net: 0,
    status: 'ERROR',
    components: [],
    exceptions: [...exceptions, { code: 'MISSING_SALARY_STRUCTURE', severity: 'BLOCKER', message }],
    calculationNotesJson: null,
    errorCode: 'MISSING_SALARY_STRUCTURE',
    errorMessage: message,
  })

  const assignments = await prisma.hrEmployeeSalaryAssignment.findMany({
    where: {
      tenantId,
      employeeId: employee.id,
      deletedAt: null,
      status: { in: ['ACTIVE', 'CLOSED'] },
      effectiveFrom: { lte: periodEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
    },
    orderBy: { effectiveFrom: 'asc' },
  })

  if (assignments.length === 0) {
    return missingSalaryResult('No active salary assignment overlaps this payroll period')
  }

  const eligStart = paidDays.eligibilityStart ? toDateOnly(paidDays.eligibilityStart) : periodStart
  const eligEnd = paidDays.eligibilityEnd ? toDateOnly(paidDays.eligibilityEnd) : periodEnd

  const segments: Array<{ assignment: (typeof assignments)[number]; segStart: Date; segEnd: Date }> = []
  for (const assignment of assignments) {
    const rawStart =
      assignment.effectiveFrom.getTime() > periodStart.getTime() ? assignment.effectiveFrom : periodStart
    const rawEnd =
      assignment.effectiveTo && assignment.effectiveTo.getTime() < periodEnd.getTime()
        ? assignment.effectiveTo
        : periodEnd
    const segStart = eligStart.getTime() > rawStart.getTime() ? eligStart : rawStart
    const segEnd = eligEnd.getTime() < rawEnd.getTime() ? eligEnd : rawEnd
    if (segStart.getTime() > segEnd.getTime()) continue
    segments.push({ assignment, segStart, segEnd })
  }

  if (segments.length === 0) {
    return missingSalaryResult('Salary assignment(s) do not overlap the employee eligibility window')
  }

  const merged = new Map<string, ResolvedLine>()
  let lastAssignmentId: string | null = null
  let lastVersionId: string | null = null
  let lastStructureId: string | null = null
  let anyVersionResolved = false

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]
    const isFinalSegment = i === segments.length - 1

    const version = await prisma.hrSalaryStructureVersion.findFirst({
      where: { id: segment.assignment.salaryStructureVersionId, tenantId, deletedAt: null },
      include: {
        lines: {
          where: { deletedAt: null, isActive: true },
          orderBy: { sequence: 'asc' },
          include: { salaryComponent: { select: { code: true, name: true, type: true } } },
        },
      },
    })

    if (!version) {
      exceptions.push({
        code: 'MISSING_SALARY_STRUCTURE',
        severity: 'BLOCKER',
        message: `Salary structure version for assignment ${segment.assignment.id} was not found`,
      })
      continue
    }

    anyVersionResolved = true
    if (isFinalSegment) {
      lastAssignmentId = segment.assignment.id
      lastVersionId = version.id
      lastStructureId = version.salaryStructureId
    }

    const segmentPayableDays = sumPayableInRange(paidDays.days, segment.segStart, segment.segEnd)
    const ctx: SegmentContext = {
      payableDays: segmentPayableDays,
      basisDays: paidDays.basisDays,
      lopDays: paidDays.totals.lop,
      approvedOtMinutes,
      monthlyGross: dec(segment.assignment.monthlyGross),
      isFinalSegment,
    }

    const segmentExceptions: ExceptionDraft[] = []
    const resolved = resolveSegmentLines(version.lines, ctx, segmentExceptions)
    exceptions.push(...segmentExceptions)

    for (const line of resolved) {
      // Structure-resolved lines always carry a concrete salaryComponentId (only
      // engine-appended statutory lines, added later, may have salaryComponentId: null).
      const key = line.salaryComponentId as string
      const existing = merged.get(key)
      merged.set(key, {
        ...line,
        amount: existing ? round2(existing.amount + line.amount) : line.amount,
      })
    }
  }

  if (!anyVersionResolved) {
    return missingSalaryResult('No usable salary structure version found for this employee')
  }

  const structureComponents = [...merged.values()].sort((a, b) => a.sequence - b.sequence)
  const grossBeforeStatutory = round2(
    structureComponents.filter((c) => c.componentType === 'EARNING').reduce((s, c) => s + c.amount, 0),
  )

  const earningsByCode: Record<string, number> = {}
  for (const c of structureComponents) {
    if (c.componentType !== 'EARNING') continue
    const key = c.componentCode.toUpperCase()
    earningsByCode[key] = round2((earningsByCode[key] ?? 0) + c.amount)
  }

  let statutoryLines: Awaited<ReturnType<typeof calculateStatutoryForEmployee>>['lines'] = []
  let statutoryExceptions: ExceptionDraft[] = []
  let statutoryEvidence: Record<string, unknown> = {}
  try {
    const engineResult = await calculateStatutoryForEmployee({
      tenantId,
      employeeId: employee.id,
      legalEntityId: employee.legalEntityId,
      branchId: employee.branchId,
      payrollDate: periodEnd,
      payrollMonth,
      payrollYear,
      earningsByCode,
      grossEarnings: grossBeforeStatutory,
    })
    statutoryLines = engineResult.lines
    statutoryExceptions = engineResult.exceptions.map((ex) => ({ code: ex.code, severity: ex.severity, message: ex.message }))
    statutoryEvidence = engineResult.evidence
  } catch (err) {
    statutoryExceptions = [
      {
        code: 'STATUTORY_ENGINE_ERROR',
        severity: 'BLOCKER',
        message: err instanceof Error ? err.message : 'Statutory engine failed unexpectedly',
      },
    ]
  }

  // Fill existing STATUTORY structure lines from engine results by component code;
  // any engine result with no matching structure line is appended so payroll still
  // works for structures that have not added explicit STATUTORY lines yet.
  const engineByCode = new Map(statutoryLines.map((l) => [l.code.toUpperCase(), l]))
  const components: ResolvedLine[] = structureComponents.map((c) => {
    if (c.calculationType !== 'STATUTORY') return c
    const match = engineByCode.get(c.componentCode.toUpperCase())
    if (!match) return c
    engineByCode.delete(c.componentCode.toUpperCase())
    return { ...c, amount: match.amount, calculationBasis: match.calculationBasis, notes: match.notes }
  })
  let nextSequence = components.reduce((max, c) => Math.max(max, c.sequence), 0) + 10
  for (const line of engineByCode.values()) {
    components.push({
      salaryComponentId: null,
      componentCode: line.code,
      componentName: STATUTORY_COMPONENT_NAMES[line.code] ?? line.code,
      componentType: line.type,
      calculationType: 'STATUTORY',
      sequence: nextSequence,
      amount: line.amount,
      quantity: null,
      rate: null,
      calculationBasis: line.calculationBasis,
      notes: line.notes,
    })
    nextSequence += 10
  }
  components.sort((a, b) => a.sequence - b.sequence)

  // Loan/advance recovery is resolved once per employee per period (not per segment) —
  // it is appended after statutory so it never affects statutory bases, and it is capped
  // to the net-so-far rather than blocking payroll (fail-safe, WARNING on cap).
  let loanRecoveryExceptions: ExceptionDraft[] = []
  const netBeforeRecovery = round2(
    components.filter((c) => c.componentType === 'EARNING').reduce((s, c) => s + c.amount, 0) -
      components.filter((c) => c.componentType === 'DEDUCTION').reduce((s, c) => s + c.amount, 0),
  )
  const dueRecoveries = await getDueRecoveriesForEmployee(tenantId, employee.id, payrollYear, payrollMonth)
  if (dueRecoveries.length > 0) {
    const { components: recoveryComponents, exceptions: recoveryExceptions } = buildPayrollRecoveryComponents(
      dueRecoveries,
      netBeforeRecovery,
    )
    loanRecoveryExceptions = recoveryExceptions
    let recoverySequence = components.reduce((max, c) => Math.max(max, c.sequence), 0) + 10
    for (const rc of recoveryComponents) {
      components.push({
        salaryComponentId: null,
        componentCode: rc.componentCode,
        componentName: rc.componentName,
        componentType: rc.componentType,
        calculationType: rc.calculationType,
        sequence: recoverySequence,
        amount: rc.amount,
        quantity: null,
        rate: null,
        calculationBasis: rc.calculationBasis,
        notes: rc.notes,
      })
      recoverySequence += 10
    }
  }

  const gross = round2(components.filter((c) => c.componentType === 'EARNING').reduce((s, c) => s + c.amount, 0))
  const deduction = round2(
    components.filter((c) => c.componentType === 'DEDUCTION').reduce((s, c) => s + c.amount, 0),
  )
  const employer = round2(
    components.filter((c) => c.componentType === 'EMPLOYER_CONTRIBUTION').reduce((s, c) => s + c.amount, 0),
  )
  const net = round2(gross - deduction)

  // The engine ran, so the old Phase 7 "not calculated yet" stub warning is stale — drop it,
  // then dedupe identical BLOCKER/WARNING (code+message) raised repeatedly across segments.
  const seen = new Set<string>()
  const dedupedExceptions = [
    ...exceptions.filter((ex) => ex.code !== 'STATUTORY_DATA_MISSING'),
    ...statutoryExceptions,
    ...loanRecoveryExceptions,
  ].filter((ex) => {
    const key = `${ex.code}::${ex.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const notesObj: Record<string, unknown> =
    segments.length > 1
      ? {
          note: 'Mid-period salary revision — prorated across assignment segments',
          segments: segments.map((s) => ({
            assignmentId: s.assignment.id,
            salaryStructureVersionId: s.assignment.salaryStructureVersionId,
            from: s.segStart.toISOString().slice(0, 10),
            to: s.segEnd.toISOString().slice(0, 10),
          })),
        }
      : {}
  notesObj.statutory = statutoryEvidence

  return {
    ...base,
    salaryStructureId: lastStructureId,
    salaryStructureVersionId: lastVersionId,
    salaryAssignmentId: lastAssignmentId,
    gross,
    deduction,
    employer,
    net,
    status: 'CALCULATED',
    components,
    exceptions: dedupedExceptions,
    calculationNotesJson: JSON.stringify(notesObj),
    errorCode: null,
    errorMessage: null,
  }
}

/**
 * Calculate (or idempotently recalculate) a payroll run.
 * Deletes and recreates all employee results / components / exceptions for the run inside
 * one write transaction; the (read-only, per-employee) calculation itself runs beforehand
 * to keep the transaction short.
 */
export async function runCalculation(tenantId: string, runId: string, audit?: AuditMeta): Promise<RunCalculationSummary> {
  const run = await prisma.hrPayrollRun.findFirst({ where: { id: runId, tenantId, deletedAt: null } })
  if (!run) throw new NotFoundError('Payroll run not found')
  if (run.status === 'FINALIZED' || run.status === 'CANCELLED') {
    throw new InvalidStateError(`Cannot calculate a ${run.status} payroll run`)
  }

  const period = await prisma.hrPayrollPeriod.findFirst({
    where: { id: run.payrollPeriodId, tenantId, deletedAt: null },
  })
  if (!period) throw new NotFoundError('Payroll period not found')

  const periodStart = toDateOnly(period.startDate)
  const periodEnd = toDateOnly(period.endDate)

  const candidates = await prisma.hrEmployee.findMany({
    where: {
      tenantId,
      legalEntityId: run.legalEntityId,
      ...(run.branchId ? { branchId: run.branchId } : {}),
      deletedAt: null,
      joinDate: { lte: periodEnd },
      status: { in: ['ACTIVE', 'ON_NOTICE', 'EXITED', 'INACTIVE'] },
      payrollResults: { none: { payrollPeriodId: period.id, NOT: { payrollRunId: run.id } } },
    },
    select: { id: true, employeeCode: true, joinDate: true, status: true, legalEntityId: true, branchId: true },
    orderBy: { employeeCode: 'asc' },
  })

  const eligible: Array<{
    id: string
    joinDate: Date
    status: string
    legalEntityId: string
    branchId: string
  }> = []
  for (const emp of candidates) {
    if (await isEmployeeEligibleForPeriod(tenantId, emp, periodStart, periodEnd)) {
      eligible.push(emp)
    }
  }

  const computed: EmployeeCalcResult[] = []
  for (const emp of eligible) {
    computed.push(await calculateEmployee(tenantId, emp, periodStart, periodEnd, period.year, period.month))
  }

  const now = new Date()
  const updatedRun = await prisma.$transaction(
    async (tx) => {
      await tx.hrPayrollEmployeeResult.deleteMany({ where: { tenantId, payrollRunId: run.id } })
      await tx.hrPayrollException.deleteMany({
        where: { tenantId, payrollRunId: run.id, payrollEmployeeResultId: null },
      })

      let grossAmount = 0
      let deductionAmount = 0
      let employerAmount = 0
      let netAmount = 0

      for (const emp of computed) {
        const employeeResult = await tx.hrPayrollEmployeeResult.create({
          data: {
            tenantId,
            payrollRunId: run.id,
            payrollPeriodId: period.id,
            employeeId: emp.employeeId,
            salaryStructureId: emp.salaryStructureId,
            salaryStructureVersionId: emp.salaryStructureVersionId,
            salaryAssignmentId: emp.salaryAssignmentId,
            totalCalendarDays: emp.totalCalendarDays,
            basisDays: emp.basisDays,
            payableDays: emp.payableDays,
            presentDays: emp.presentDays,
            paidLeaveDays: emp.paidLeaveDays,
            unpaidLeaveDays: emp.unpaidLeaveDays,
            lopDays: emp.lopDays,
            weeklyOffDays: emp.weeklyOffDays,
            holidayDays: emp.holidayDays,
            approvedOtMinutes: emp.approvedOtMinutes,
            grossAmount: emp.gross,
            deductionAmount: emp.deduction,
            employerAmount: emp.employer,
            netAmount: emp.net,
            status: emp.status,
            paidDaysBreakdownJson: emp.paidDaysBreakdownJson,
            calculationNotesJson: emp.calculationNotesJson,
            errorCode: emp.errorCode,
            errorMessage: emp.errorMessage,
            createdBy: audit?.userId,
            updatedBy: audit?.userId,
          },
        })

        if (emp.components.length > 0) {
          await tx.hrPayrollComponentResult.createMany({
            data: emp.components.map((c) => ({
              tenantId,
              payrollEmployeeResultId: employeeResult.id,
              salaryComponentId: c.salaryComponentId,
              componentCode: c.componentCode,
              componentName: c.componentName,
              type: c.componentType as HrSalaryComponentType,
              calculationType: c.calculationType as HrSalaryCalculationType,
              calculationBasis: c.calculationBasis,
              quantity: c.quantity,
              rate: c.rate,
              amount: c.amount,
              sequence: c.sequence,
              notes: c.notes,
            })),
          })
        }

        if (emp.exceptions.length > 0) {
          await tx.hrPayrollException.createMany({
            data: emp.exceptions.map((ex) => ({
              tenantId,
              payrollRunId: run.id,
              payrollEmployeeResultId: employeeResult.id,
              employeeId: emp.employeeId,
              code: ex.code,
              severity: ex.severity,
              message: ex.message,
            })),
          })
        }

        grossAmount += emp.gross
        deductionAmount += emp.deduction
        employerAmount += emp.employer
        netAmount += emp.net
      }

      if (computed.length === 0) {
        await tx.hrPayrollException.create({
          data: {
            tenantId,
            payrollRunId: run.id,
            code: 'NO_ELIGIBLE_EMPLOYEES',
            severity: 'WARNING',
            message: 'No eligible employees were found for this payroll run',
          },
        })
      }

      const updated = await tx.hrPayrollRun.update({
        where: { id: run.id },
        data: {
          status: 'CALCULATED',
          employeeCount: computed.length,
          grossAmount: round2(grossAmount),
          deductionAmount: round2(deductionAmount),
          employerAmount: round2(employerAmount),
          netAmount: round2(netAmount),
          calculatedAt: now,
          reviewedAt: null,
          reviewedByUserId: null,
          updatedBy: audit?.userId,
        },
      })

      if (period.status === 'OPEN') {
        await tx.hrPayrollPeriod.update({
          where: { id: period.id },
          data: { status: 'PROCESSING', updatedBy: audit?.userId },
        })
      }

      return updated
    },
    { timeout: 60000 },
  )

  const [blockers, warnings] = await Promise.all([
    prisma.hrPayrollException.count({
      where: { tenantId, payrollRunId: run.id, severity: 'BLOCKER', resolved: false },
    }),
    prisma.hrPayrollException.count({
      where: { tenantId, payrollRunId: run.id, severity: 'WARNING', resolved: false },
    }),
  ])

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrPayrollRun',
    entityId: run.id,
    action: 'CALCULATE',
    newValues: {
      employeeCount: computed.length,
      grossAmount: dec(updatedRun.grossAmount),
      netAmount: dec(updatedRun.netAmount),
      blockers,
      warnings,
    },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return {
    runId: run.id,
    status: updatedRun.status,
    employeeCount: updatedRun.employeeCount,
    grossAmount: dec(updatedRun.grossAmount) ?? 0,
    deductionAmount: dec(updatedRun.deductionAmount) ?? 0,
    employerAmount: dec(updatedRun.employerAmount) ?? 0,
    netAmount: dec(updatedRun.netAmount) ?? 0,
    calculatedAt: (updatedRun.calculatedAt ?? now).toISOString(),
    exceptionSummary: { blockers, warnings },
  }
}
