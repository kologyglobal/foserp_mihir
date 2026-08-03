import type { RouteObject } from 'react-router-dom'
import { isApiMode } from '@/config/apiConfig'
import { ShiftFormPage, ShiftListPage } from '@/modules/hrms/pages/ShiftPages'
import { HolidayDetailPage, HolidayListPage } from '@/modules/hrms/pages/HolidayPages'
import { RosterPage } from '@/modules/hrms/pages/RosterPage'
import { HrmsApiRequiredPage } from '@/modules/hrms/pages/HrmsApiRequiredPage'
import { DesignationListPage } from '@/modules/hrms/pages/DesignationListPage'
import { HrmsHomePage } from '@/modules/hrms/pages/HrmsHomePage'
import { EmployeesRegisterPage } from '@/modules/hrms/pages/EmployeesRegisterPage'
import { EmployeeFormPage } from '@/modules/hrms/pages/EmployeeFormPage'
import { Employee360Page } from '@/modules/hrms/pages/Employee360Page'
import { MyHrPage } from '@/modules/hrms/pages/MyHrPage'
import { AttendanceRegisterPage } from '@/modules/hrms/pages/AttendanceRegisterPage'
import {
  LeaveApplyPage,
  LeaveBalancesPage,
  LeaveHubPage,
  LeaveRequestsPage,
  LeaveTypesPage,
} from '@/modules/hrms/pages/LeavePages'
import { OvertimePage } from '@/modules/hrms/pages/OvertimePage'
import { SalaryPaymentsPage } from '@/modules/hrms/pages/SalaryPaymentsPage'
import { HrSettingsHubPage } from '@/modules/hrms/pages/HrSettingsHubPage'
import { SalaryComponentsPage } from '@/modules/hrms/pages/SalaryComponentsPage'
import { SalaryStructureDetailPage } from '@/modules/hrms/pages/SalaryStructureDetailPage'
import { SalaryStructuresPage } from '@/modules/hrms/pages/SalaryStructuresPage'
import { PayrollRunDetailPage } from '@/modules/hrms/pages/PayrollRunDetailPage'
import { PayrollRunsPage } from '@/modules/hrms/pages/PayrollRunsPage'
import { PayslipRegisterPage } from '@/modules/hrms/pages/PayslipRegisterPage'
import { MyPayslipsPage } from '@/modules/hrms/pages/MyPayslipsPage'
import { StatutoryHubPage } from '@/modules/hrms/pages/StatutoryHubPage'
import { StatutoryTypePage } from '@/modules/hrms/pages/StatutoryTypePage'
import { LoanFormPage, LoansRegisterPage, MyLoansPage } from '@/modules/hrms/pages/LoanPages'
import { LoanDetailPage } from '@/modules/hrms/pages/LoanDetailPage'
import { ExitFormPage, ExitRegisterPage } from '@/modules/hrms/pages/ExitPages'
import { ExitDetailPage } from '@/modules/hrms/pages/ExitDetailPage'
import { FnfRegisterPage } from '@/modules/hrms/pages/FnfPages'
import { FnfDetailPage } from '@/modules/hrms/pages/FnfDetailPage'

const apiChildren: RouteObject[] = [
  { path: 'hrms', element: <HrmsHomePage /> },
  { path: 'hrms/employees', element: <EmployeesRegisterPage /> },
  { path: 'hrms/employees/new', element: <EmployeeFormPage /> },
  { path: 'hrms/employees/:id/edit', element: <EmployeeFormPage /> },
  { path: 'hrms/employees/:id', element: <Employee360Page /> },
  { path: 'hrms/my', element: <MyHrPage /> },
  { path: 'hrms/attendance', element: <AttendanceRegisterPage /> },
  { path: 'hrms/setup/designations', element: <DesignationListPage /> },
  { path: 'hrms/shifts', element: <ShiftListPage /> },
  { path: 'hrms/shifts/new', element: <ShiftFormPage /> },
  { path: 'hrms/shifts/:id', element: <ShiftFormPage /> },
  { path: 'hrms/holidays', element: <HolidayListPage /> },
  { path: 'hrms/holidays/new', element: <HolidayDetailPage /> },
  { path: 'hrms/holidays/:id', element: <HolidayDetailPage /> },
  { path: 'hrms/roster', element: <RosterPage /> },
  { path: 'hrms/leave', element: <LeaveHubPage /> },
  { path: 'hrms/leave/requests', element: <LeaveRequestsPage /> },
  { path: 'hrms/leave/balances', element: <LeaveBalancesPage /> },
  { path: 'hrms/leave/types', element: <LeaveTypesPage /> },
  { path: 'hrms/leave/apply', element: <LeaveApplyPage /> },
  { path: 'hrms/overtime', element: <OvertimePage /> },
  { path: 'hrms/payroll/setup/components', element: <SalaryComponentsPage /> },
  { path: 'hrms/payroll/setup/structures', element: <SalaryStructuresPage /> },
  { path: 'hrms/payroll/setup/structures/:id', element: <SalaryStructureDetailPage /> },
  { path: 'hrms/payroll/runs', element: <PayrollRunsPage /> },
  { path: 'hrms/payroll/runs/:id', element: <PayrollRunDetailPage /> },
  { path: 'hrms/payroll/payslips', element: <PayslipRegisterPage /> },
  { path: 'hrms/payroll/payments', element: <SalaryPaymentsPage /> },
  { path: 'hrms/setup', element: <HrSettingsHubPage /> },
  { path: 'hrms/payroll/my-payslips', element: <MyPayslipsPage /> },
  { path: 'hrms/payroll/statutory', element: <StatutoryHubPage /> },
  { path: 'hrms/payroll/statutory/:kind', element: <StatutoryTypePage /> },
  { path: 'hrms/loans', element: <LoansRegisterPage /> },
  { path: 'hrms/loans/new', element: <LoanFormPage /> },
  { path: 'hrms/loans/:id/edit', element: <LoanFormPage /> },
  { path: 'hrms/loans/:id', element: <LoanDetailPage /> },
  { path: 'hrms/my-loans', element: <MyLoansPage /> },
  { path: 'hrms/exits', element: <ExitRegisterPage /> },
  { path: 'hrms/exits/new', element: <ExitFormPage /> },
  { path: 'hrms/exits/:id', element: <ExitDetailPage /> },
  { path: 'hrms/fnf', element: <FnfRegisterPage /> },
  { path: 'hrms/fnf/:id', element: <FnfDetailPage /> },
]

const demoChildren: RouteObject[] = [
  { path: 'hrms', element: <HrmsApiRequiredPage /> },
  { path: 'hrms/*', element: <HrmsApiRequiredPage /> },
]

export const hrmsRouteChildren: RouteObject[] = isApiMode() ? apiChildren : demoChildren
