import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { createAuditLog } from '../../../services/audit.service.js'
import { NotFoundError, ValidationError } from '../../../utils/errors.js'
import type { UserDataScope } from '../../access-scopes/scope.service.js'
import { assertHrAccess } from '../hrms-scope.js'
import { getEffectiveSalaryStructure } from '../salary/effective-salary.service.js'
import { computePaidDaysBreakdown } from '../payroll/paid-days.service.js'
import { availableOf } from '../leave/leave-setup.service.js'
import { add, formatForPersistence, min, roundAmount, subtract, toDecimal } from '../../accounting/shared/finance-decimal.js'
import { getSettlementByExit } from './fnf.service.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

interface FnfException {
  code: string
  severity: 'WARNING' | 'BLOCKER'
  message: string
}

interface DraftComponent {
  kind: 'EARNING' | 'DEDUCTION'
  code: string
  name: string
  amount: Prisma.Decimal
  calculationBasis?: string
  sourceRef?: string
  mappingKeyHint?: string
}

function daysInMonthUtc(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

/**
 * Calculate (or recalculate) the full & final settlement for an exit whose last working
 * date has been locked in (approved). Persists a DRAFT/CALCULATED settlement row and
 * replaces its component lines — recalculation is only allowed while the settlement is
 * still DRAFT/CALCULATED; once REVIEWED/APPROVED it is immutable here.
 */
export async function calculateSettlement(tenantId: string, exitId: string, scope: UserDataScope, audit?: AuditMeta) {
  const exit = await prisma.hrEmployeeExit.findFirst({
    where: { id: exitId, tenantId, deletedAt: null },
    include: { employee: true },
  })
  if (!exit) throw new NotFoundError('Exit record not found')
  assertHrAccess(scope, { legalEntityId: exit.employee.legalEntityId, branchId: exit.employee.branchId })

  if (exit.status === 'CANCELLED') {
    throw new ValidationError('Cannot calculate a settlement for a cancelled exit')
  }
  if (!exit.approvedLastWorkingDate) {
    throw new ValidationError('Exit must be approved before calculating the settlement')
  }

  const existingSettlement = await prisma.hrFullFinalSettlement.findFirst({ where: { tenantId, employeeExitId: exitId } })
  if (existingSettlement && !['DRAFT', 'CALCULATED'].includes(existingSettlement.status)) {
    throw new ValidationError('Settlement has already been reviewed/approved and can no longer be recalculated')
  }

  const lwd = exit.approvedLastWorkingDate
  const employee = exit.employee
  const exceptions: FnfException[] = []
  const components: DraftComponent[] = []

  // 1. Pending salary for the exit month, prorated on payable/basis days.
  let monthlyGross: Prisma.Decimal | null = null
  try {
    const salary = await getEffectiveSalaryStructure(tenantId, employee.id, lwd)
    monthlyGross = salary.assignment.monthlyGross != null ? toDecimal(salary.assignment.monthlyGross) : null
  } catch {
    monthlyGross = null
  }

  if (monthlyGross == null) {
    exceptions.push({
      code: 'NO_SALARY_ASSIGNMENT',
      severity: 'BLOCKER',
      message: 'No effective salary assignment found for the last working date — pending salary could not be estimated',
    })
  } else {
    const monthStart = new Date(Date.UTC(lwd.getUTCFullYear(), lwd.getUTCMonth(), 1))
    const daysInMonth = daysInMonthUtc(lwd.getUTCFullYear(), lwd.getUTCMonth())
    let payableDays = lwd.getUTCDate()
    let basisDays = daysInMonth

    try {
      const breakdown = await computePaidDaysBreakdown(tenantId, employee.id, monthStart, lwd)
      payableDays = breakdown.totals.payableDays
      basisDays = daysInMonth
      for (const w of breakdown.warnings) {
        exceptions.push({ code: `PENDING_SALARY_${w.code}`, severity: 'WARNING', message: w.message })
      }
    } catch {
      exceptions.push({
        code: 'PENDING_SALARY_ESTIMATED',
        severity: 'WARNING',
        message: 'Pending salary estimated using a simple calendar-day fraction (attendance breakdown unavailable)',
      })
    }

    const pendingSalary = basisDays > 0 ? monthlyGross.mul(payableDays).div(basisDays) : toDecimal(0)
    if (pendingSalary.gt(0)) {
      components.push({
        kind: 'EARNING',
        code: 'PENDING_SALARY',
        name: 'Pending salary — final month',
        amount: roundAmount(pendingSalary, 2),
        calculationBasis: `monthlyGross ${formatForPersistence(monthlyGross, 2)} × ${payableDays}/${basisDays} days`,
        mappingKeyHint: 'SALARY_BASIC_EXPENSE',
      })
    }
  }

  // 2. Leave encashment for leave types configured with fnfSettlementAction = ENCASH.
  const encashTypes = await prisma.hrLeaveType.findMany({
    where: { tenantId, deletedAt: null, isActive: true, fnfSettlementAction: 'ENCASH' },
  })
  if (encashTypes.length > 0) {
    if (monthlyGross == null) {
      exceptions.push({
        code: 'LEAVE_ENCASHMENT_SKIPPED',
        severity: 'WARNING',
        message: 'Leave encashment skipped — no salary assignment to derive the daily rate',
      })
    } else {
      const dailyRate = monthlyGross.div(30)
      const year = lwd.getUTCFullYear()
      for (const leaveType of encashTypes) {
        const balance = await prisma.hrLeaveBalance.findFirst({
          where: { tenantId, employeeId: employee.id, leaveTypeId: leaveType.id, year },
        })
        if (!balance) continue
        const available = toDecimal(availableOf(balance))
        if (available.lte(0)) continue
        const cap = leaveType.maxEncashDays != null ? toDecimal(leaveType.maxEncashDays) : available
        const encashDays = min(available, cap)
        if (encashDays.lte(0)) continue
        const amount = encashDays.mul(dailyRate)
        components.push({
          kind: 'EARNING',
          code: `LEAVE_ENCASHMENT_${leaveType.code}`,
          name: `Leave encashment — ${leaveType.name}`,
          amount: roundAmount(amount, 2),
          calculationBasis: `${formatForPersistence(encashDays, 2)} day(s) × ${formatForPersistence(dailyRate, 2)}/day`,
          sourceRef: leaveType.code,
          mappingKeyHint: 'LEAVE_ENCASHMENT_EXPENSE',
        })
      }
    }
  }

  // 3. Overtime — not auto-included; flag for manual review.
  exceptions.push({
    code: 'OT_NOT_INCLUDED',
    severity: 'WARNING',
    message: 'Approved unpaid overtime is not auto-included in the settlement — add manually if applicable',
  })

  // 4. Notice pay / recovery per the exit's noticeSettlementMode.
  if (exit.noticeShortfallDays > 0 && exit.noticeSettlementMode !== 'none') {
    if (monthlyGross == null) {
      exceptions.push({
        code: 'NOTICE_SETTLEMENT_SKIPPED',
        severity: 'WARNING',
        message: 'Notice pay/recovery skipped — no salary assignment to derive the daily rate',
      })
    } else {
      const dailyRate = monthlyGross.div(30)
      const amount = dailyRate.mul(exit.noticeShortfallDays)
      if (exit.noticeSettlementMode === 'recover') {
        components.push({
          kind: 'DEDUCTION',
          code: 'NOTICE_RECOVERY',
          name: 'Notice period shortfall recovery',
          amount: roundAmount(amount, 2),
          calculationBasis: `${exit.noticeShortfallDays} shortfall day(s) × ${formatForPersistence(dailyRate, 2)}/day`,
          mappingKeyHint: 'NOTICE_RECOVERY_INCOME',
        })
      } else if (exit.noticeSettlementMode === 'pay') {
        components.push({
          kind: 'EARNING',
          code: 'NOTICE_PAY',
          name: 'Notice period pay-in-lieu',
          amount: roundAmount(amount, 2),
          calculationBasis: `${exit.noticeShortfallDays} unserved day(s) × ${formatForPersistence(dailyRate, 2)}/day`,
          mappingKeyHint: 'NOTICE_PAY_EXPENSE',
        })
      }
    }
  }

  // 5. Loan/salary-advance outstanding — snapshot only, never mutates the loan record.
  const loans = await prisma.hrEmployeeLoan.findMany({
    where: { tenantId, employeeId: employee.id, deletedAt: null, status: { in: ['DISBURSED', 'RECOVERING'] }, outstandingAmount: { gt: 0 } },
  })
  for (const loan of loans) {
    components.push({
      kind: 'DEDUCTION',
      code: loan.type === 'LOAN' ? 'LOAN_RECOVERY' : 'ADVANCE_RECOVERY',
      name: `${loan.type === 'LOAN' ? 'Loan' : 'Salary advance'} outstanding recovery — ${loan.code}`,
      amount: roundAmount(loan.outstandingAmount, 2),
      calculationBasis: 'Outstanding balance snapshot at exit — the loan record itself is not modified here',
      sourceRef: loan.code,
      mappingKeyHint: loan.type === 'LOAN' ? 'EMPLOYEE_LOAN_RECEIVABLE' : 'SALARY_ADVANCE_RECEIVABLE',
    })
  }

  // 6. Asset non-return/damage recovery.
  const assetLines = await prisma.hrExitAssetLine.findMany({ where: { tenantId, exitId, recoveryAmount: { gt: 0 } } })
  if (assetLines.length > 0) {
    const assetTotal = assetLines.reduce((sum, a) => add(sum, a.recoveryAmount), toDecimal(0))
    if (assetTotal.gt(0)) {
      components.push({
        kind: 'DEDUCTION',
        code: 'ASSET_RECOVERY',
        name: 'Asset non-return / damage recovery',
        amount: roundAmount(assetTotal, 2),
        calculationBasis: `${assetLines.length} asset line(s)`,
        mappingKeyHint: 'ASSET_RECOVERY_INCOME',
      })
    }
  }

  // 7. Statutory — stubbed as a warning, not a full recalculation engine.
  exceptions.push({
    code: 'STATUTORY_NOT_CALCULATED',
    severity: 'WARNING',
    message: 'Statutory deductions (PF/ESI/PT/TDS) on settlement components are not auto-calculated — review manually before approval',
  })

  const earningsTotal = components.filter((c) => c.kind === 'EARNING').reduce((s, c) => add(s, c.amount), toDecimal(0))
  const deductionsTotal = components.filter((c) => c.kind === 'DEDUCTION').reduce((s, c) => add(s, c.amount), toDecimal(0))
  const netSettlement = subtract(earningsTotal, deductionsTotal)

  const savedId = await prisma.$transaction(async (tx) => {
    let settlementId: string
    if (!existingSettlement) {
      const code = await nextCode(tenantId, 'FULL_FINAL_SETTLEMENT', tx)
      const created = await tx.hrFullFinalSettlement.create({
        data: {
          tenantId,
          code,
          employeeExitId: exitId,
          employeeId: employee.id,
          legalEntityId: employee.legalEntityId,
          branchId: employee.branchId,
          lastWorkingDate: lwd,
          status: 'CALCULATED',
          earningsTotal: formatForPersistence(earningsTotal, 2),
          deductionsTotal: formatForPersistence(deductionsTotal, 2),
          netSettlement: formatForPersistence(netSettlement, 2),
          exceptionsJson: JSON.stringify(exceptions),
          calculatedAt: new Date(),
          createdBy: audit?.userId,
          updatedBy: audit?.userId,
        },
      })
      settlementId = created.id
    } else {
      settlementId = existingSettlement.id
      await tx.hrFnfComponent.deleteMany({ where: { settlementId } })
      await tx.hrFullFinalSettlement.update({
        where: { id: settlementId },
        data: {
          lastWorkingDate: lwd,
          status: 'CALCULATED',
          earningsTotal: formatForPersistence(earningsTotal, 2),
          deductionsTotal: formatForPersistence(deductionsTotal, 2),
          netSettlement: formatForPersistence(netSettlement, 2),
          exceptionsJson: JSON.stringify(exceptions),
          calculatedAt: new Date(),
          updatedBy: audit?.userId,
        },
      })
    }

    if (components.length > 0) {
      await tx.hrFnfComponent.createMany({
        data: components.map((c, idx) => ({
          tenantId,
          settlementId,
          kind: c.kind,
          code: c.code,
          name: c.name,
          amount: formatForPersistence(c.amount, 2),
          calculationBasis: c.calculationBasis ?? null,
          sourceRef: c.sourceRef ?? null,
          sequence: (idx + 1) * 10,
          mappingKeyHint: c.mappingKeyHint ?? null,
        })),
      })
    }

    return settlementId
  })

  await createAuditLog({
    tenantId,
    module: 'hrms',
    entity: 'HrFullFinalSettlement',
    entityId: savedId,
    action: 'CALCULATE',
    newValues: {
      earningsTotal: formatForPersistence(earningsTotal, 2),
      deductionsTotal: formatForPersistence(deductionsTotal, 2),
      netSettlement: formatForPersistence(netSettlement, 2),
      exceptionCount: exceptions.length,
      blockerCount: exceptions.filter((e) => e.severity === 'BLOCKER').length,
    },
    userId: audit?.userId,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return getSettlementByExit(tenantId, exitId, scope)
}
