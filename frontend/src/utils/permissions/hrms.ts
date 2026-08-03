/**
 * HRMS frontend permissions (JWT). Backend enforces the same keys.
 */
import { useMemo } from 'react'
import { getStoredSession } from '@/services/api/client'
import { isApiMode } from '@/config/apiConfig'
import { hasWorkspaceAdminRole } from './workspaceAdmin'

export const HRMS_PERMISSIONS = [
  'hrms.employee.view',
  'hrms.employee.create',
  'hrms.employee.edit',
  'hrms.employee.sensitive.view',
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
  'hrms.overtime.view',
  'hrms.overtime.create',
  'hrms.overtime.approve',
  'hrms.overtime.manage',
  'hrms.overtime.override_limit',
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
  'hrms.payslip.view',
  'hrms.payslip.generate',
  'hrms.payroll.accounting.view',
  'hrms.payroll.accounting.post',
  'hrms.salary_payment.view',
  'hrms.salary_payment.create',
  'hrms.salary_payment.approve',
  'hrms.salary_payment.confirm',
  'hrms.salary_payment.export',
  'hrms.loan.view',
  'hrms.loan.create',
  'hrms.loan.approve',
  'hrms.loan.disburse',
  'hrms.loan.manage',
  'hrms.loan.repayment',
  'hrms.exit.view',
  'hrms.exit.create',
  'hrms.exit.approve',
  'hrms.exit.clearance',
  'hrms.fnf.view',
  'hrms.fnf.calculate',
  'hrms.fnf.approve',
  'hrms.fnf.post',
  'hrms.fnf.pay',
] as const

export type HrmsPermission = (typeof HRMS_PERMISSIONS)[number]

export function hasHrmsPermission(key: HrmsPermission): boolean {
  if (isApiMode() && hasWorkspaceAdminRole()) return true
  if (isApiMode()) {
    const perms = getStoredSession()?.user.permissions ?? []
    return perms.includes(key)
  }
  return false
}

/** Sidebar / launcher shell — any HRMS view grant (admins included via hasHrmsPermission). */
export function canAccessHrmsShell(): boolean {
  return (
    hasHrmsPermission('hrms.employee.view') ||
    hasHrmsPermission('hrms.leave.view') ||
    hasHrmsPermission('hrms.shift.view') ||
    hasHrmsPermission('hrms.holiday.view') ||
    hasHrmsPermission('hrms.roster.view') ||
    hasHrmsPermission('hrms.payroll.view') ||
    hasHrmsPermission('hrms.payslip.view') ||
    hasHrmsPermission('hrms.statutory.view') ||
    hasHrmsPermission('hrms.overtime.view') ||
    hasHrmsPermission('hrms.salary.component.view') ||
    hasHrmsPermission('hrms.designation.view') ||
    hasHrmsPermission('hrms.loan.view') ||
    hasHrmsPermission('hrms.exit.view') ||
    hasHrmsPermission('hrms.fnf.view')
  )
}

export function useHrmsPermissions() {
  return useMemo(
    () => ({
      canViewDesignation: hasHrmsPermission('hrms.designation.view'),
      canManageDesignation: hasHrmsPermission('hrms.designation.manage'),
      canViewShift: hasHrmsPermission('hrms.shift.view'),
      canManageShift: hasHrmsPermission('hrms.shift.manage'),
      canViewHoliday: hasHrmsPermission('hrms.holiday.view'),
      canManageHoliday: hasHrmsPermission('hrms.holiday.manage'),
      canViewRoster: hasHrmsPermission('hrms.roster.view'),
      canManageRoster: hasHrmsPermission('hrms.roster.manage'),
      canViewEmployee: hasHrmsPermission('hrms.employee.view'),
      canCreateEmployee: hasHrmsPermission('hrms.employee.create'),
      canEditEmployee: hasHrmsPermission('hrms.employee.edit'),
      canViewEmployeeSensitive: hasHrmsPermission('hrms.employee.sensitive.view'),
      canViewLeave: hasHrmsPermission('hrms.leave.view'),
      canApplyLeave: hasHrmsPermission('hrms.leave.apply'),
      canApproveLeave: hasHrmsPermission('hrms.leave.approve'),
      canManageLeave: hasHrmsPermission('hrms.leave.manage'),
      canViewLeaveBalance: hasHrmsPermission('hrms.leave.balance.view'),
      canManageLeaveBalance: hasHrmsPermission('hrms.leave.balance.manage'),
      canManageLeaveType: hasHrmsPermission('hrms.leave.type.manage'),
      canViewAttendance: hasHrmsPermission('hrms.attendance.view'),
      canManageAttendance: hasHrmsPermission('hrms.attendance.manage'),
      canViewOvertime: hasHrmsPermission('hrms.overtime.view'),
      canCreateOvertime: hasHrmsPermission('hrms.overtime.create'),
      canApproveOvertime: hasHrmsPermission('hrms.overtime.approve'),
      canManageOvertime: hasHrmsPermission('hrms.overtime.manage'),
      canOverrideOtLimit: hasHrmsPermission('hrms.overtime.override_limit'),
      canViewSalaryComponent: hasHrmsPermission('hrms.salary.component.view'),
      canManageSalaryComponent: hasHrmsPermission('hrms.salary.component.manage'),
      canViewSalaryStructure: hasHrmsPermission('hrms.salary.structure.view'),
      canManageSalaryStructure: hasHrmsPermission('hrms.salary.structure.manage'),
      canViewSalaryAssignment: hasHrmsPermission('hrms.salary.assignment.view'),
      canManageSalaryAssignment: hasHrmsPermission('hrms.salary.assignment.manage'),
      canViewPayroll: hasHrmsPermission('hrms.payroll.view'),
      canCreatePayroll: hasHrmsPermission('hrms.payroll.create'),
      canCalculatePayroll: hasHrmsPermission('hrms.payroll.calculate'),
      canReviewPayroll: hasHrmsPermission('hrms.payroll.review'),
      canFinalizePayroll: hasHrmsPermission('hrms.payroll.finalize'),
      canViewStatutory: hasHrmsPermission('hrms.statutory.view'),
      canManageStatutory: hasHrmsPermission('hrms.statutory.manage'),
      canOverrideStatutory: hasHrmsPermission('hrms.statutory.override'),
      canViewStatutoryReports: hasHrmsPermission('hrms.statutory.reports'),
      canViewPayslip: hasHrmsPermission('hrms.payslip.view'),
      canGeneratePayslip: hasHrmsPermission('hrms.payslip.generate'),
      canViewPayrollAccounting: hasHrmsPermission('hrms.payroll.accounting.view'),
      canPostPayrollAccounting: hasHrmsPermission('hrms.payroll.accounting.post'),
      canViewSalaryPayment: hasHrmsPermission('hrms.salary_payment.view'),
      canCreateSalaryPayment: hasHrmsPermission('hrms.salary_payment.create'),
      canApproveSalaryPayment: hasHrmsPermission('hrms.salary_payment.approve'),
      canConfirmSalaryPayment: hasHrmsPermission('hrms.salary_payment.confirm'),
      canExportSalaryPayment: hasHrmsPermission('hrms.salary_payment.export'),
      canViewLoan: hasHrmsPermission('hrms.loan.view'),
      canCreateLoan: hasHrmsPermission('hrms.loan.create'),
      canApproveLoan: hasHrmsPermission('hrms.loan.approve'),
      canDisburseLoan: hasHrmsPermission('hrms.loan.disburse'),
      canManageLoan: hasHrmsPermission('hrms.loan.manage'),
      canRecordLoanRepayment: hasHrmsPermission('hrms.loan.repayment'),
      canViewExit: hasHrmsPermission('hrms.exit.view'),
      canCreateExit: hasHrmsPermission('hrms.exit.create'),
      canApproveExit: hasHrmsPermission('hrms.exit.approve'),
      canManageExitClearance: hasHrmsPermission('hrms.exit.clearance'),
      canViewFnf: hasHrmsPermission('hrms.fnf.view'),
      canCalculateFnf: hasHrmsPermission('hrms.fnf.calculate'),
      canApproveFnf: hasHrmsPermission('hrms.fnf.approve'),
      canPostFnf: hasHrmsPermission('hrms.fnf.post'),
      canPayFnf: hasHrmsPermission('hrms.fnf.pay'),
    }),
    [],
  )
}
