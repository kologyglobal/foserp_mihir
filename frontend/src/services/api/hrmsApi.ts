/**
 * HRMS API client — API mode only.
 * Base: /api/v1/t/:tenantSlug/hrms/...
 */
import { apiDownloadBlob, apiRequest, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export type HrShift = {
  id: string
  code: string
  name: string
  legalEntityId: string | null
  legalEntity?: { id: string; code: string; displayName: string } | null
  startTime: string
  endTime: string
  breakMinutes: number
  graceInMinutes: number
  graceOutMinutes: number | null
  fullDayMinimumMinutes: number
  halfDayMinimumMinutes: number
  otEligible: boolean
  otStartsAfterMinutes: number | null
  overnightShift: boolean
  weeklyOffDay: number | null
  isActive: boolean
}

export type HrDesignation = {
  id: string
  code: string
  name: string
  legalEntityId: string | null
  level: number | null
  isActive: boolean
}

export async function listHrDesignations(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrDesignation[]>(`${tenantPath('/hrms/designations')}${buildQuery(params)}`)
}

export type HrHolidayDay = {
  id: string
  holidayDate: string
  name: string
  holidayType: 'NATIONAL' | 'FESTIVAL' | 'COMPANY' | 'OPTIONAL'
  optionalHoliday: boolean
  isActive: boolean
}

export type HrHolidayCalendar = {
  id: string
  code: string
  name: string
  year: number
  legalEntityId: string
  legalEntity?: { id: string; code: string; displayName: string } | null
  branchId: string | null
  branch?: { id: string; code: string; name: string } | null
  isActive: boolean
  days: HrHolidayDay[]
}

export type RosterGrid = {
  from: string
  to: string
  dates: string[]
  employees: Array<{
    employeeId: string
    employeeCode: string
    displayName: string
    department: { id: string; code: string; name: string } | null
    designation: { id: string; code: string; name: string } | null
    workCentre: { id: string; code: string; name: string } | null
    defaultShift: { id: string; code: string; name: string; startTime: string; endTime: string } | null
    weeklyOffDay: number | null
    days: Array<{
      date: string
      source: 'TEMPORARY' | 'ROSTER' | 'DEFAULT' | null
      shiftId: string | null
      shiftCode: string | null
      shiftName: string | null
      startTime: string | null
      endTime: string | null
      assignmentId: string | null
      isWeeklyOff: boolean
    }>
  }>
}

export async function listShifts(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrShift[]>(`${tenantPath('/hrms/shifts')}${buildQuery(params)}`)
}

export async function getShift(id: string) {
  return apiRequest<HrShift>(tenantPath(`/hrms/shifts/${id}`))
}

export async function createShift(body: Record<string, unknown>) {
  return apiRequest<HrShift>(tenantPath('/hrms/shifts'), { method: 'POST', body: JSON.stringify(body) })
}

export async function updateShift(id: string, body: Record<string, unknown>) {
  return apiRequest<HrShift>(tenantPath(`/hrms/shifts/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function listHolidayCalendars(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrHolidayCalendar[]>(`${tenantPath('/hrms/holidays')}${buildQuery(params)}`)
}

export async function getHolidayCalendar(id: string) {
  return apiRequest<HrHolidayCalendar>(tenantPath(`/hrms/holidays/${id}`))
}

export async function createHolidayCalendar(body: Record<string, unknown>) {
  return apiRequest<HrHolidayCalendar>(tenantPath('/hrms/holidays'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateHolidayCalendar(id: string, body: Record<string, unknown>) {
  return apiRequest<HrHolidayCalendar>(tenantPath(`/hrms/holidays/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function addHolidayDay(calendarId: string, body: Record<string, unknown>) {
  return apiRequest<HrHolidayDay>(tenantPath(`/hrms/holidays/${calendarId}/days`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function removeHolidayDay(calendarId: string, dayId: string) {
  return apiRequest<{ id: string; deleted: boolean }>(
    tenantPath(`/hrms/holidays/${calendarId}/days/${dayId}`),
    { method: 'DELETE' },
  )
}

export async function getRosterGrid(params: {
  from: string
  to: string
  legalEntityId?: string
  branchId?: string
  departmentId?: string
  workCentreId?: string
  search?: string
}) {
  return apiRequest<RosterGrid>(`${tenantPath('/hrms/roster/grid')}${buildQuery(params)}`)
}

export async function createRosterAssignment(body: Record<string, unknown>) {
  return apiRequest(tenantPath('/hrms/roster/assignments'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function bulkRosterAssign(body: Record<string, unknown>) {
  return apiRequest(tenantPath('/hrms/roster/assignments/bulk'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function clearRosterOverrides(body: Record<string, unknown>) {
  return apiRequest(tenantPath('/hrms/roster/assignments/clear'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ─── Attendance (read-only — full register UI is a later slice) ────────────

export type HrAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY' | 'WEEKLY_OFF' | 'HOLIDAY' | 'ON_DUTY'

export type HrAttendanceDay = {
  id: string
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  attendanceDate: string
  status: HrAttendanceStatus
  leaveRequestId?: string | null
  leaveTypeCode?: string | null
  shiftId?: string | null
  firstInAt: string | null
  lastOutAt: string | null
  workedMinutes: number | null
  isFinalized?: boolean
  hasPunch?: boolean
  exceptionFlag?: boolean
  exceptionReason?: string | null
  source?: string
  note?: string | null
}

export async function listHrAttendanceDays(params?: {
  page?: number
  limit?: number
  employeeId?: string
  from?: string
  to?: string
  status?: HrAttendanceStatus
}) {
  return apiRequest<HrAttendanceDay[]>(`${tenantPath('/hrms/attendance/days')}${buildQuery(params)}`)
}

export type HrAttendanceExceptionType = 'PUNCH_ON_LEAVE' | 'PUNCH_ON_HALF_DAY_LEAVE' | 'OTHER'

export type HrAttendanceException = {
  id: string
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  attendanceDate: string
  exceptionType?: HrAttendanceExceptionType
  reason?: string
  resolved: boolean
  resolvedAt?: string | null
}

export async function listHrAttendanceExceptions(params?: {
  page?: number
  limit?: number
  employeeId?: string
  resolved?: 'true' | 'false'
  from?: string
  to?: string
}) {
  return apiRequest<HrAttendanceException[]>(`${tenantPath('/hrms/attendance/exceptions')}${buildQuery(params)}`)
}

export type HrAttendancePunchType = 'IN' | 'OUT'

export async function createAttendancePunch(body: {
  employeeId: string
  punchedAt: string
  punchType: HrAttendancePunchType
  source?: string
  deviceRef?: string
  note?: string
}) {
  return apiRequest<{ id: string; employeeId: string; punchedAt: string; punchType: HrAttendancePunchType }>(
    tenantPath('/hrms/attendance/punches'),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

// ─── Leave (Phase 3) ───────────────────────────────────────────────────────

export type HrLeaveType = {
  id: string
  code: string
  name: string
  paid: boolean
  allowHalfDay: boolean
  allowNegativeBalance: boolean
  isActive: boolean
  accrualType: string
}

export type HrLeaveBalance = {
  id: string
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  leaveTypeId: string
  leaveType?: { id: string; code: string; name: string } | null
  year: number
  opening: number
  accrued: number
  pending: number
  used: number
  adjusted: number
  available: number
}

export type HrLeaveRequest = {
  id: string
  employeeId: string
  employee?: {
    id: string
    employeeCode: string
    displayName: string
    department?: string | null
    branch?: string | null
    reportingManager?: { id: string; displayName: string } | null
  } | null
  leaveTypeId: string
  leaveType?: { id: string; code: string; name: string } | null
  fromDate: string
  toDate: string
  durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'
  requestedDays: number
  reason: string
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  rejectionReason?: string | null
}

export type HrLeavePreview = {
  requestedDays: number
  availableBalance: number
  balanceAfterApproval: number
  breakdown: Array<{ date: string; counted: boolean; days: number; reason: string; holidayName?: string | null }>
}

export async function listLeaveTypes(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrLeaveType[]>(`${tenantPath('/hrms/leave/types')}${buildQuery(params)}`)
}

export async function createLeaveType(body: Record<string, unknown>) {
  return apiRequest<HrLeaveType>(tenantPath('/hrms/leave/types'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listLeaveBalances(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrLeaveBalance[]>(`${tenantPath('/hrms/leave/balances')}${buildQuery(params)}`)
}

export async function upsertLeaveBalance(body: Record<string, unknown>) {
  return apiRequest<HrLeaveBalance>(tenantPath('/hrms/leave/balances'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function adjustLeaveBalance(body: Record<string, unknown>) {
  return apiRequest<HrLeaveBalance>(tenantPath('/hrms/leave/balances/adjust'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function previewLeave(body: Record<string, unknown>) {
  return apiRequest<HrLeavePreview>(tenantPath('/hrms/leave/preview'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listLeaveRequests(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrLeaveRequest[]>(`${tenantPath('/hrms/leave/requests')}${buildQuery(params)}`)
}

export async function createLeaveRequest(body: Record<string, unknown>) {
  return apiRequest<HrLeaveRequest>(tenantPath('/hrms/leave/requests'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function submitLeaveRequest(id: string) {
  return apiRequest<HrLeaveRequest>(tenantPath(`/hrms/leave/requests/${id}/submit`), { method: 'POST' })
}

export async function approveLeaveRequest(id: string) {
  return apiRequest<HrLeaveRequest>(tenantPath(`/hrms/leave/requests/${id}/approve`), { method: 'POST' })
}

export async function rejectLeaveRequest(id: string, reason: string) {
  return apiRequest<HrLeaveRequest>(tenantPath(`/hrms/leave/requests/${id}/reject`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function cancelLeaveRequest(id: string, reason?: string) {
  return apiRequest<HrLeaveRequest>(tenantPath(`/hrms/leave/requests/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

// ─── Overtime (Phase 5) ────────────────────────────────────────────────────

export type HrOvertimeRecord = {
  id: string
  employeeId: string
  employee?: {
    id: string
    employeeCode: string
    displayName: string
    department?: string | null
    branch?: string | null
  } | null
  attendanceDate: string
  shift?: { id: string; code: string; name: string } | null
  detectedMinutes: number
  eligibleMinutes: number
  approvedMinutes: number | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  source: 'ATTENDANCE' | 'MANUAL'
  exceptionFlags: string[]
  firstInAt?: string | null
  lastOutAt?: string | null
  workedMinutes?: number | null
  reason?: string | null
}

export async function listOvertime(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrOvertimeRecord[]>(`${tenantPath('/hrms/overtime')}${buildQuery(params)}`)
}

export async function approveOvertime(
  id: string,
  body: { approvedMinutes: number; reason?: string; overrideLimit?: boolean },
) {
  return apiRequest<HrOvertimeRecord>(tenantPath(`/hrms/overtime/${id}/approve`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function rejectOvertime(id: string, reason: string) {
  return apiRequest<HrOvertimeRecord>(tenantPath(`/hrms/overtime/${id}/reject`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function bulkApproveOvertime(ids: string[], reason?: string) {
  return apiRequest<{ approved: number; failed: Array<{ id: string; error: string }> }>(
    tenantPath('/hrms/overtime/bulk-approve'),
    { method: 'POST', body: JSON.stringify({ ids, reason }) },
  )
}

export async function bulkRejectOvertime(ids: string[], reason: string) {
  return apiRequest<{ rejected: number; failed: Array<{ id: string; error: string }> }>(
    tenantPath('/hrms/overtime/bulk-reject'),
    { method: 'POST', body: JSON.stringify({ ids, reason }) },
  )
}

// ─── Salary setup (Phase 6 — config only; not payroll) ─────────────────────

export type HrSalaryComponentType = 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION'
export type HrSalaryCalculationType =
  | 'FIXED'
  | 'PERCENTAGE'
  | 'ATTENDANCE_LINKED'
  | 'OT_LINKED'
  | 'STATUTORY'

export type HrSalaryComponent = {
  id: string
  code: string
  name: string
  legalEntityId: string | null
  type: HrSalaryComponentType
  calculationType: HrSalaryCalculationType
  taxable: boolean
  affectsGross: boolean
  affectsNet: boolean
  isActive: boolean
}

export type HrSalaryStructureVersion = {
  id: string
  salaryStructureId: string
  versionNo: number
  effectiveFrom: string
  effectiveTo: string | null
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED'
  approvedByUserId?: string | null
  approvedAt?: string | null
  lines?: HrSalaryStructureLine[]
  structure?: { id: string; code: string; name: string } | null
}

export type HrSalaryStructureLine = {
  id?: string
  salaryComponentId: string
  sequence: number
  calculationType: HrSalaryCalculationType
  fixedAmount: number | null
  percentage: number | null
  percentageOfComponentId: string | null
  monthlyCap: number | null
  annualCap: number | null
  isActive: boolean
  salaryComponent?: { id: string; code: string; name: string; type: string; isActive: boolean } | null
  percentageOfComponent?: { id: string; code: string; name: string } | null
}

export type HrSalaryStructure = {
  id: string
  code: string
  name: string
  description: string | null
  legalEntityId: string | null
  workerCategory: string | null
  isActive: boolean
  activeVersion?: HrSalaryStructureVersion | null
  versions?: HrSalaryStructureVersion[]
}

export type HrSalaryAssignment = {
  id: string
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  salaryStructureVersionId: string
  version?: {
    id: string
    versionNo: number
    status: string
    structure?: { id: string; code: string; name: string } | null
  } | null
  effectiveFrom: string
  effectiveTo: string | null
  annualCtc: number | null
  monthlyGross: number | null
  remarks: string | null
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED'
}

export type HrSalaryPreview = {
  salaryStructureVersionId: string
  effectiveDate: string
  structure?: { id: string; code: string; name: string }
  components: Array<{
    salaryComponentId: string
    componentCode: string
    componentName: string
    componentType: string
    calculationType: string
    sequence: number
    amount: number | null
    note: string | null
  }>
  summary: {
    totalEarnings: number
    totalDeductions: number
    estimatedNet: number
  }
}

export async function listSalaryComponents(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrSalaryComponent[]>(`${tenantPath('/hrms/salary/components')}${buildQuery(params)}`)
}

export async function createSalaryComponent(body: Record<string, unknown>) {
  return apiRequest<HrSalaryComponent>(tenantPath('/hrms/salary/components'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateSalaryComponent(id: string, body: Record<string, unknown>) {
  return apiRequest<HrSalaryComponent>(tenantPath(`/hrms/salary/components/${id}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function listSalaryStructures(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrSalaryStructure[]>(`${tenantPath('/hrms/salary/structures')}${buildQuery(params)}`)
}

export async function getSalaryStructure(id: string) {
  return apiRequest<HrSalaryStructure>(tenantPath(`/hrms/salary/structures/${id}`))
}

export async function createSalaryStructure(body: Record<string, unknown>) {
  return apiRequest<HrSalaryStructure>(tenantPath('/hrms/salary/structures'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function createSalaryStructureVersion(
  structureId: string,
  body: { effectiveFrom: string; effectiveTo?: string | null; copyFromVersionId?: string },
) {
  return apiRequest<HrSalaryStructureVersion>(tenantPath(`/hrms/salary/structures/${structureId}/versions`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getSalaryStructureVersion(versionId: string) {
  return apiRequest<HrSalaryStructureVersion>(tenantPath(`/hrms/salary/versions/${versionId}`))
}

export async function updateSalaryStructureVersion(
  versionId: string,
  body: { effectiveFrom?: string; effectiveTo?: string | null; lines?: Array<Record<string, unknown>> },
) {
  return apiRequest<HrSalaryStructureVersion>(tenantPath(`/hrms/salary/versions/${versionId}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function activateSalaryStructureVersion(versionId: string) {
  return apiRequest<HrSalaryStructureVersion>(tenantPath(`/hrms/salary/versions/${versionId}/activate`), {
    method: 'POST',
  })
}

export async function listSalaryAssignments(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrSalaryAssignment[]>(`${tenantPath('/hrms/salary/assignments')}${buildQuery(params)}`)
}

export async function createSalaryAssignment(body: Record<string, unknown>) {
  return apiRequest<HrSalaryAssignment>(tenantPath('/hrms/salary/assignments'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function reviseSalaryAssignment(assignmentId: string, body: Record<string, unknown>) {
  return apiRequest<HrSalaryAssignment>(tenantPath(`/hrms/salary/assignments/${assignmentId}/revise`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getEmployeeEffectiveSalary(employeeId: string, date?: string) {
  return apiRequest<Record<string, unknown>>(
    `${tenantPath(`/hrms/salary/employees/${employeeId}/effective`)}${buildQuery({ date })}`,
  )
}

export async function previewSalaryStructure(body: {
  employeeId?: string
  salaryStructureVersionId: string
  effectiveDate: string
}) {
  return apiRequest<HrSalaryPreview>(tenantPath('/hrms/salary/preview'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ─── Employees (master) ──────────────────────────────────────────────────

export type HrEmployeeStatus = 'DRAFT' | 'ACTIVE' | 'ON_NOTICE' | 'INACTIVE' | 'EXITED'
export type HrEmploymentType = 'PERMANENT' | 'PROBATION' | 'CONTRACT' | 'TRAINEE' | 'INTERN' | 'TEMPORARY'
export type HrWorkerCategory = 'STAFF' | 'WORKER' | 'SUPERVISOR' | 'MANAGEMENT'
export type HrGender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'

/** Mirrors backend `mapEmployee()` — keep in sync with employee.service.ts. */
export type HrEmployee = {
  id: string
  tenantId?: string
  employeeCode: string
  userId?: string | null
  user?: { id: string; email: string; status: string } | null
  legalEntityId: string
  legalEntity?: { id: string; code: string; displayName: string } | null
  branchId: string
  branch?: { id: string; code: string; name: string } | null
  departmentId: string
  department?: { id: string; code: string; name: string } | null
  designationId: string
  designation?: { id: string; code: string; name: string } | null
  primaryWorkCentreId?: string | null
  primaryWorkCentre?: { id: string; code: string; name: string } | null
  defaultShiftId?: string | null
  defaultShift?: { id: string; code: string; name: string; startTime: string; endTime: string } | null
  weeklyOffDay?: number | null
  firstName: string
  middleName?: string | null
  lastName: string
  displayName: string
  mobile?: string | null
  email?: string | null
  dateOfBirth?: string | null
  gender?: HrGender | null
  addressLine?: string | null
  city?: string | null
  state?: string | null
  pin?: string | null
  country?: string | null
  joinDate: string
  employmentType: HrEmploymentType
  workerCategory: HrWorkerCategory
  reportingManagerEmployeeId?: string | null
  reportingManager?: { id: string; employeeCode: string; displayName: string } | null
  status: HrEmployeeStatus
  hasStatutoryDetail?: boolean
  bankDetailCount?: number
  documentCount?: number
  createdAt?: string
  updatedAt?: string
}

export type HrEmployeeListParams = {
  page?: number
  limit?: number
  search?: string
  status?: HrEmployeeStatus
  legalEntityId?: string
  branchId?: string
  departmentId?: string
  designationId?: string
  employmentType?: HrEmploymentType
  workerCategory?: HrWorkerCategory
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export async function listHrEmployees(params?: HrEmployeeListParams) {
  return apiRequest<HrEmployee[]>(`${tenantPath('/hrms/employees')}${buildQuery(params)}`)
}

export async function getHrEmployee(employeeId: string) {
  return apiRequest<HrEmployee>(tenantPath(`/hrms/employees/${employeeId}`))
}

export async function createHrEmployee(body: Record<string, unknown>) {
  return apiRequest<HrEmployee>(tenantPath('/hrms/employees'), { method: 'POST', body: JSON.stringify(body) })
}

export async function updateHrEmployee(employeeId: string, body: Record<string, unknown>) {
  return apiRequest<HrEmployee>(tenantPath(`/hrms/employees/${employeeId}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export type HrEmployeeHistoryEntry = {
  id: string
  employeeId: string
  field: string
  oldValue: string | null
  newValue: string | null
  effectiveFrom: string
  changedBy?: string | null
  reason?: string | null
}

export async function listHrEmployeeHistory(employeeId: string) {
  return apiRequest<HrEmployeeHistoryEntry[]>(tenantPath(`/hrms/employees/${employeeId}/history`))
}

/** Sensitive — requires hrms.employee.sensitive.view; account number is masked unless the caller has that grant. */
export type HrEmployeeBankDetail = {
  id: string
  employeeId: string
  bankName: string
  accountHolderName: string
  accountNumber: string
  accountNumberMasked: string
  ifsc: string
  isPrimary: boolean
  effectiveFrom: string | null
  effectiveTo: string | null
}

export async function listHrEmployeeBank(employeeId: string) {
  return apiRequest<HrEmployeeBankDetail[]>(tenantPath(`/hrms/employees/${employeeId}/bank`))
}

/** Sensitive — requires hrms.employee.sensitive.view; PAN/UAN/ESIC masked unless the caller has that grant. */
export type HrEmployeeStatutoryDetail = {
  id: string
  employeeId: string
  pan: string | null
  aadhaarRef: string | null
  uan: string | null
  esicNumber: string | null
}

export async function getHrEmployeeStatutory(employeeId: string) {
  return apiRequest<HrEmployeeStatutoryDetail>(tenantPath(`/hrms/employees/${employeeId}/statutory`))
}

export type HrEmployeeDocument = {
  id: string
  employeeId: string
  documentType: string
  originalFilename: string
  mimeType: string
  fileSize: number
  notes: string | null
  uploadedAt: string
}

export async function listHrEmployeeDocuments(employeeId: string) {
  return apiRequest<HrEmployeeDocument[]>(tenantPath(`/hrms/employees/${employeeId}/documents`))
}

// ─── Payroll (Phase 7 — calc + finalize; no GL / payslip / statutory engine) ─

export type HrPayrollPeriod = {
  id: string
  legalEntityId: string
  year: number
  month: number
  startDate: string
  endDate: string
  status: 'OPEN' | 'PROCESSING' | 'CLOSED'
  legalEntity?: { id: string; code: string; displayName: string } | null
}

export type HrPayrollAccountingStatus = 'NOT_POSTED' | 'POSTED' | 'FAILED'
export type HrPayrollPaymentLifecycleStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PARTIALLY_PAID' | 'PAID'

export type HrPayrollRun = {
  id: string
  payrollPeriodId: string
  legalEntityId: string
  branchId: string | null
  code: string
  status: 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'FINALIZED' | 'CANCELLED'
  employeeCount: number
  grossAmount: number
  deductionAmount: number
  employerAmount: number
  netAmount: number
  calculatedAt: string | null
  reviewedAt: string | null
  finalizedAt: string | null
  /** Phase 9 — accounting / payment lifecycle (separate from calculation status) */
  accountingStatus: HrPayrollAccountingStatus
  accountingVoucherId: string | null
  postingEventId: string | null
  accountingPostedAt: string | null
  accountingPostedByUserId: string | null
  accountingError: string | null
  payslipGeneratedAt: string | null
  paymentStatus: HrPayrollPaymentLifecycleStatus
  period?: {
    id: string
    year: number
    month: number
    startDate: string
    endDate: string
    status: string
  }
  legalEntity?: { id: string; code: string; displayName: string } | null
  branch?: { id: string; code: string; name: string } | null
  exceptionSummary?: { blockers: number; warnings: number }
}

export type HrPayrollEmployeeResult = {
  id: string
  payrollRunId: string
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  payableDays: number
  lopDays: number
  approvedOtMinutes: number
  grossAmount: number
  deductionAmount: number
  employerAmount: number
  netAmount: number
  status: string
  presentDays?: number
  paidLeaveDays?: number
  unpaidLeaveDays?: number
  weeklyOffDays?: number
  holidayDays?: number
  basisDays?: number
  totalCalendarDays?: number
  errorCode?: string | null
  errorMessage?: string | null
  components?: Array<{
    id: string
    componentCode: string
    componentName: string
    type: string
    calculationType: string
    calculationBasis: string | null
    quantity: number | null
    rate: number | null
    amount: number
    sequence: number
    notes: string | null
  }>
  paidDaysBreakdown?: unknown
  exceptions?: Array<{ id: string; code: string; severity: string; message: string; resolved: boolean }>
}

export type HrPayrollException = {
  id: string
  payrollRunId: string
  employeeId: string | null
  code: string
  severity: 'BLOCKER' | 'WARNING'
  message: string
  resolved: boolean
}

export async function listPayrollPeriods(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrPayrollPeriod[]>(`${tenantPath('/hrms/payroll/periods')}${buildQuery(params)}`)
}

export async function createPayrollPeriod(body: { legalEntityId: string; year: number; month: number }) {
  return apiRequest<HrPayrollPeriod>(tenantPath('/hrms/payroll/periods'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listPayrollRuns(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrPayrollRun[]>(`${tenantPath('/hrms/payroll/runs')}${buildQuery(params)}`)
}

export async function createPayrollRun(body: {
  payrollPeriodId: string
  branchId?: string | null
  code?: string
}) {
  return apiRequest<HrPayrollRun>(tenantPath('/hrms/payroll/runs'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getPayrollRun(runId: string) {
  return apiRequest<HrPayrollRun>(tenantPath(`/hrms/payroll/runs/${runId}`))
}

export async function calculatePayrollRun(runId: string) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/hrms/payroll/runs/${runId}/calculate`), {
    method: 'POST',
  })
}

export async function reviewPayrollRun(runId: string) {
  return apiRequest<HrPayrollRun>(tenantPath(`/hrms/payroll/runs/${runId}/review`), { method: 'POST' })
}

export async function finalizePayrollRun(runId: string) {
  return apiRequest<HrPayrollRun>(tenantPath(`/hrms/payroll/runs/${runId}/finalize`), { method: 'POST' })
}

export async function cancelPayrollRun(runId: string) {
  return apiRequest<HrPayrollRun>(tenantPath(`/hrms/payroll/runs/${runId}/cancel`), { method: 'POST' })
}

export async function listPayrollEmployeeResults(
  runId: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<HrPayrollEmployeeResult[]>(
    `${tenantPath(`/hrms/payroll/runs/${runId}/employees`)}${buildQuery(params)}`,
  )
}

export async function getPayrollEmployeeResult(runId: string, employeeResultId: string) {
  return apiRequest<HrPayrollEmployeeResult>(
    tenantPath(`/hrms/payroll/runs/${runId}/employees/${employeeResultId}`),
  )
}

export async function listPayrollExceptions(
  runId: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<HrPayrollException[]>(
    `${tenantPath(`/hrms/payroll/runs/${runId}/exceptions`)}${buildQuery(params)}`,
  )
}

// ─── Statutory (Phase 8) ────────────────────────────────────────────────────

export type HrStatutoryRuleType =
  | 'PF'
  | 'ESIC'
  | 'PROFESSIONAL_TAX'
  | 'TDS'
  | 'LWF'
  | 'BONUS'
  | 'GRATUITY'

export type HrStatutoryRule = {
  id: string
  type: HrStatutoryRuleType
  code: string
  name: string
  legalEntityId: string | null
  stateCode: string | null
  effectiveFrom: string
  effectiveTo: string | null
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED'
  employeeRatePct: number | null
  employerRatePct: number | null
  wageCeiling: number | null
  eligibilityWageCeiling: number | null
  roundingMode: string
  frequency: string | null
  employeeFixedAmount: number | null
  employerFixedAmount: number | null
  isActive: boolean
  wageBasisLines?: Array<{ componentCode: string; include: boolean; sequence: number }>
  ptSlabs?: Array<{
    fromAmount: number
    toAmount: number | null
    taxAmount: number
    specialMonth: number | null
    sequence: number
  }>
}

export async function listStatutoryRules(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrStatutoryRule[]>(`${tenantPath('/hrms/statutory/rules')}${buildQuery(params)}`)
}

export async function getStatutoryRule(ruleId: string) {
  return apiRequest<HrStatutoryRule>(tenantPath(`/hrms/statutory/rules/${ruleId}`))
}

export async function createStatutoryRule(body: Record<string, unknown>) {
  return apiRequest<HrStatutoryRule>(tenantPath('/hrms/statutory/rules'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateStatutoryRule(ruleId: string, body: Record<string, unknown>) {
  return apiRequest<HrStatutoryRule>(tenantPath(`/hrms/statutory/rules/${ruleId}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function activateStatutoryRule(ruleId: string) {
  return apiRequest<HrStatutoryRule>(tenantPath(`/hrms/statutory/rules/${ruleId}/activate`), {
    method: 'POST',
  })
}

export async function putStatutoryWageBasis(
  ruleId: string,
  lines: Array<{ componentCode: string; include?: boolean; sequence?: number }>,
) {
  return apiRequest(tenantPath(`/hrms/statutory/rules/${ruleId}/wage-basis`), {
    method: 'PUT',
    body: JSON.stringify({ lines }),
  })
}

export async function putStatutoryPtSlabs(
  ruleId: string,
  slabs: Array<{
    fromAmount: number
    toAmount?: number | null
    taxAmount: number
    specialMonth?: number | null
    sequence?: number
  }>,
) {
  return apiRequest(tenantPath(`/hrms/statutory/rules/${ruleId}/pt-slabs`), {
    method: 'PUT',
    body: JSON.stringify({ slabs }),
  })
}

export async function listStatutoryRegister(
  kind: 'pf' | 'esic' | 'pt' | 'tds' | 'lwf',
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<Array<Record<string, unknown>>>(
    `${tenantPath(`/hrms/statutory/registers/${kind}`)}${buildQuery(params)}`,
  )
}

// ─── Payslips (Phase 9) ─────────────────────────────────────────────────────

export type HrPayslipStatus = 'GENERATED' | 'VOID'
export type HrPayslipPaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'FAILED'

export type HrPayslipSnapshot = {
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

export type HrPayslip = {
  id: string
  payrollRunId: string
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  legalEntityId: string
  payslipNumber: string
  year: number
  month: number
  grossAmount: number
  deductionAmount: number
  employerAmount: number
  netAmount: number
  status: HrPayslipStatus
  paymentStatus: HrPayslipPaymentStatus
  generatedAt: string
}

export type HrPayslipDetail = HrPayslip & {
  run?: { id: string; code: string; status: string } | null
  snapshot: HrPayslipSnapshot | null
}

export async function generatePayslipsForRun(runId: string) {
  return apiRequest<{ runId: string; generatedCount: number; totalPayslips: number; payslipIds: string[] }>(
    tenantPath(`/hrms/payroll/runs/${runId}/payslips/generate`),
    { method: 'POST' },
  )
}

export async function listPayslips(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrPayslip[]>(`${tenantPath('/hrms/payroll/payslips')}${buildQuery(params)}`)
}

export async function listMyPayslips(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrPayslip[]>(`${tenantPath('/hrms/payroll/payslips/mine')}${buildQuery(params)}`)
}

export async function getPayslip(payslipId: string) {
  return apiRequest<HrPayslipDetail>(tenantPath(`/hrms/payroll/payslips/${payslipId}`))
}

/** Raw payslip HTML (for print preview / client-side PDF export). */
export async function getPayslipHtml(payslipId: string): Promise<string> {
  const { blob } = await apiDownloadBlob(tenantPath(`/hrms/payroll/payslips/${payslipId}/html`))
  return blob.text()
}

// ─── Payroll accounting (Phase 9) ───────────────────────────────────────────

export type HrPayrollAccounting = {
  runId: string
  accountingStatus: HrPayrollAccountingStatus
  accountingVoucherId: string | null
  voucherNumber: string | null
  postingEventId: string | null
  accountingPostedAt: string | null
  accountingPostedByUserId: string | null
  accountingError: string | null
}

export async function getPayrollAccounting(runId: string) {
  return apiRequest<HrPayrollAccounting>(tenantPath(`/hrms/payroll/runs/${runId}/accounting`))
}

export async function postPayrollAccounting(runId: string) {
  return apiRequest<HrPayrollAccounting>(tenantPath(`/hrms/payroll/runs/${runId}/accounting/post`), {
    method: 'POST',
  })
}

// ─── Salary payment batches (Phase 9) ───────────────────────────────────────

export type HrSalaryPaymentBatchStatus = 'DRAFT' | 'READY' | 'APPROVED' | 'PAID' | 'CANCELLED'
export type HrSalaryPaymentLineStatus = 'PENDING' | 'READY' | 'PAID' | 'FAILED' | 'SKIPPED'

export type HrSalaryPaymentLine = {
  id: string
  batchId: string
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  payslipId: string
  netPay: number
  bankName: string | null
  accountHolderName: string | null
  accountNumberMasked: string | null
  ifsc: string | null
  paymentStatus: HrSalaryPaymentLineStatus
  paymentReference: string | null
  failureReason: string | null
  paidAt: string | null
}

export type HrSalaryPaymentBatch = {
  id: string
  payrollRunId: string
  legalEntityId: string
  branchId: string | null
  code: string
  treasuryAccountId: string
  paymentDate: string
  employeeCount: number
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  failedCount: number
  status: HrSalaryPaymentBatchStatus
  reference: string | null
  accountingVoucherId: string | null
  postingEventId: string | null
  accountingPostedAt: string | null
  approvedAt: string | null
  approvedByUserId: string | null
  paidAt: string | null
  paidByUserId: string | null
  createdAt: string
  updatedAt: string
  lines?: HrSalaryPaymentLine[]
  invalidEmployees?: Array<{ employeeId: string; employeeCode: string; displayName: string; reason: string }>
}

export async function listPaymentBatches(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrSalaryPaymentBatch[]>(`${tenantPath('/hrms/payroll/payment-batches')}${buildQuery(params)}`)
}

export async function createPaymentBatch(body: {
  payrollRunId: string
  treasuryAccountId: string
  paymentDate: string
  reference?: string
  employeeIds?: string[]
  skipInvalidEmployees?: boolean
}) {
  return apiRequest<HrSalaryPaymentBatch>(tenantPath('/hrms/payroll/payment-batches'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getPaymentBatch(batchId: string) {
  return apiRequest<HrSalaryPaymentBatch>(tenantPath(`/hrms/payroll/payment-batches/${batchId}`))
}

export async function markPaymentBatchReady(batchId: string) {
  return apiRequest<HrSalaryPaymentBatch>(tenantPath(`/hrms/payroll/payment-batches/${batchId}/ready`), {
    method: 'POST',
  })
}

export async function approvePaymentBatch(batchId: string) {
  return apiRequest<HrSalaryPaymentBatch>(tenantPath(`/hrms/payroll/payment-batches/${batchId}/approve`), {
    method: 'POST',
  })
}

export async function confirmPaymentBatch(
  batchId: string,
  body?: { lineIds?: string[]; failedLineIds?: Array<{ id: string; reason: string }> },
) {
  return apiRequest<HrSalaryPaymentBatch>(tenantPath(`/hrms/payroll/payment-batches/${batchId}/confirm`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function exportPaymentBatchCsv(batchId: string) {
  return apiDownloadBlob(tenantPath(`/hrms/payroll/payment-batches/${batchId}/export`))
}

export async function cancelPaymentBatch(batchId: string) {
  return apiRequest<HrSalaryPaymentBatch>(tenantPath(`/hrms/payroll/payment-batches/${batchId}/cancel`), {
    method: 'POST',
  })
}

// ─── Loans & Salary Advances (Phase 10) ─────────────────────────────────────

export type HrLoanType = 'LOAN' | 'SALARY_ADVANCE'
export type HrLoanStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'RECOVERING'
  | 'CLOSED'
  | 'CANCELLED'
export type HrLoanDisbursementMethod = 'BANK' | 'CASH'
export type HrLoanRepaymentMethod = 'BANK' | 'CASH' | 'OTHER'
export type HrLoanScheduleStatus = 'PENDING' | 'RECOVERED' | 'PARTIAL' | 'SKIPPED'

export type HrLoanRecoverySchedule = {
  id: string
  installmentNo: number
  year: number
  month: number
  dueAmount: number
  recoveredAmount: number
  status: HrLoanScheduleStatus
  payrollRunId: string | null
  payrollEmployeeResultId: string | null
  skipReason: string | null
  notes: string | null
  recoveredAt: string | null
}

export type HrLoanRepayment = {
  id: string
  amount: number
  repaymentDate: string
  method: HrLoanRepaymentMethod
  treasuryAccountId: string | null
  reference: string | null
  reason: string | null
  accountingVoucherId: string | null
  createdAt: string
}

export type HrEmployeeLoan = {
  id: string
  code: string
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  legalEntityId: string
  branchId: string | null
  type: HrLoanType
  requestDate: string
  requestedAmount: number
  approvedAmount: number | null
  disbursedAmount: number
  recoveredAmount: number
  outstandingAmount: number
  recoveryStartYear: number | null
  recoveryStartMonth: number | null
  installmentAmount: number | null
  installmentCount: number | null
  reason: string | null
  status: HrLoanStatus
  rejectionReason: string | null
  approvedByUserId: string | null
  approvedAt: string | null
  rejectedByUserId: string | null
  rejectedAt: string | null
  disbursedAt: string | null
  disbursementMethod: HrLoanDisbursementMethod | null
  treasuryAccountId: string | null
  disbursementReference: string | null
  disbursementVoucherId: string | null
  closedAt: string | null
  closedByUserId: string | null
  createdAt: string
  updatedAt: string
  schedules?: HrLoanRecoverySchedule[]
  repayments?: HrLoanRepayment[]
}

export type HrLoanAccounting = {
  loanId: string
  code: string
  disbursementVoucherId: string | null
  disbursedAmount: number
  repayments: HrLoanRepayment[]
}

export async function listLoans(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrEmployeeLoan[]>(`${tenantPath('/hrms/loans')}${buildQuery(params)}`)
}

export async function listMyLoans(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrEmployeeLoan[]>(`${tenantPath('/hrms/loans/mine')}${buildQuery(params)}`)
}

export async function getLoan(loanId: string) {
  return apiRequest<HrEmployeeLoan>(tenantPath(`/hrms/loans/${loanId}`))
}

export async function createLoan(body: {
  employeeId?: string
  type: HrLoanType
  requestDate: string
  requestedAmount: number
  reason?: string
}) {
  return apiRequest<HrEmployeeLoan>(tenantPath('/hrms/loans'), { method: 'POST', body: JSON.stringify(body) })
}

export async function updateLoanDraft(loanId: string, body: Record<string, unknown>) {
  return apiRequest<HrEmployeeLoan>(tenantPath(`/hrms/loans/${loanId}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function submitLoan(loanId: string) {
  return apiRequest<HrEmployeeLoan>(tenantPath(`/hrms/loans/${loanId}/submit`), { method: 'POST' })
}

export async function approveLoan(
  loanId: string,
  body: {
    approvedAmount?: number
    installmentAmount?: number
    installmentCount?: number
    recoveryStartYear: number
    recoveryStartMonth: number
  },
) {
  return apiRequest<HrEmployeeLoan>(tenantPath(`/hrms/loans/${loanId}/approve`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function rejectLoan(loanId: string, reason: string) {
  return apiRequest<HrEmployeeLoan>(tenantPath(`/hrms/loans/${loanId}/reject`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function disburseLoan(
  loanId: string,
  body: { treasuryAccountId: string; method: HrLoanDisbursementMethod; paymentDate: string; reference?: string },
) {
  return apiRequest<HrEmployeeLoan>(tenantPath(`/hrms/loans/${loanId}/disburse`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function cancelLoan(loanId: string, reason?: string) {
  return apiRequest<HrEmployeeLoan>(tenantPath(`/hrms/loans/${loanId}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function closeLoan(loanId: string) {
  return apiRequest<HrEmployeeLoan>(tenantPath(`/hrms/loans/${loanId}/close`), { method: 'POST' })
}

export async function skipLoanInstallment(loanId: string, scheduleId: string, reason: string) {
  return apiRequest<{ loan: HrEmployeeLoan; schedule: HrLoanRecoverySchedule }>(
    tenantPath(`/hrms/loans/${loanId}/schedules/${scheduleId}/skip`),
    { method: 'POST', body: JSON.stringify({ reason }) },
  )
}

export async function partialRecoverLoanInstallment(
  loanId: string,
  scheduleId: string,
  body: { amount: number; reason: string },
) {
  return apiRequest<{ loan: HrEmployeeLoan; schedule: HrLoanRecoverySchedule }>(
    tenantPath(`/hrms/loans/${loanId}/schedules/${scheduleId}/partial`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function recordLoanRepayment(
  loanId: string,
  body: {
    amount: number
    date: string
    method: HrLoanRepaymentMethod
    treasuryAccountId?: string
    reference?: string
    reason?: string
  },
) {
  return apiRequest<{ loan: HrEmployeeLoan; repayment: HrLoanRepayment }>(
    tenantPath(`/hrms/loans/${loanId}/repayments`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function getLoanAccounting(loanId: string, params?: { status?: 'POSTED' | 'PENDING' }) {
  return apiRequest<HrLoanAccounting>(`${tenantPath(`/hrms/loans/${loanId}/accounting`)}${buildQuery(params)}`)
}

// ─── Exit & Full & Final Settlement (Phase 11) ──────────────────────────────

export type HrExitType = 'RESIGNATION' | 'TERMINATION' | 'RETIREMENT' | 'CONTRACT_END' | 'ABSCONDING' | 'OTHER'
export type HrExitStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'CLEARANCE_PENDING'
  | 'READY_FOR_SETTLEMENT'
  | 'SETTLED'
  | 'CLOSED'
  | 'CANCELLED'
export type HrNoticeSettlementMode = 'recover' | 'pay' | 'none'
export type HrClearanceLineStatus = 'PENDING' | 'CLEARED' | 'WAIVED'
export type HrAssetLineStatus = 'PENDING' | 'RETURNED' | 'NOT_RETURNED' | 'DAMAGED' | 'WAIVED'
export type HrFnfStatus = 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'APPROVED' | 'POSTED' | 'PAID' | 'CLOSED'
export type HrFnfPaymentMethod = 'BANK' | 'CASH'

export type HrEmployeeExit = {
  id: string
  code: string
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  legalEntityId: string
  legalEntity?: { id: string; code: string; displayName: string } | null
  branchId: string | null
  branch?: { id: string; code: string; name: string } | null
  exitType: HrExitType
  resignationDate: string | null
  requestedLastWorkingDate: string
  approvedLastWorkingDate: string | null
  noticePeriodDays: number
  noticeServedDays: number | null
  noticeShortfallDays: number | null
  noticeExcessDays: number | null
  noticeSettlementMode: HrNoticeSettlementMode
  reason: string | null
  remarks: string | null
  status: HrExitStatus
  approvedByUserId: string | null
  approvedAt: string | null
  rejectedReason: string | null
  createdAt: string
  updatedAt: string
}

export type HrExitClearanceLine = {
  id: string
  exitId: string
  itemId: string | null
  code: string
  name: string
  sequence: number
  status: HrClearanceLineStatus
  ownerUserId: string | null
  remarks: string | null
  clearedByUserId: string | null
  clearedAt: string | null
  createdAt: string
  updatedAt: string
}

export type HrExitAssetLine = {
  id: string
  exitId: string
  description: string
  assetCategory: string | null
  status: HrAssetLineStatus
  recoveryAmount: number
  remarks: string | null
  clearedByUserId: string | null
  clearedAt: string | null
  createdAt: string
  updatedAt: string
}

export type HrFnfComponentKind = 'EARNING' | 'DEDUCTION'

export type HrFnfComponent = {
  id: string
  kind: HrFnfComponentKind
  code: string
  name: string
  amount: number
  calculationBasis: string | null
  sourceRef: string | null
  sequence: number
  mappingKeyHint: string | null
}

export type HrFnfException = {
  code: string
  severity: 'WARNING' | 'BLOCKER'
  message: string
}

export type HrFullFinalSettlement = {
  id: string
  code: string
  employeeExitId: string
  exit?: { id: string; code: string; status: HrExitStatus; employeeId: string } | null
  employeeId: string
  employee?: { id: string; employeeCode: string; displayName: string } | null
  legalEntityId: string
  branchId: string | null
  lastWorkingDate: string
  status: HrFnfStatus
  earningsTotal: number
  deductionsTotal: number
  netSettlement: number
  exceptions: HrFnfException[]
  calculatedAt: string | null
  reviewedAt: string | null
  reviewedByUserId: string | null
  approvedAt: string | null
  approvedByUserId: string | null
  postedAt: string | null
  postedByUserId: string | null
  accountingVoucherId: string | null
  paidAt: string | null
  paidByUserId: string | null
  paymentMethod: HrFnfPaymentMethod | null
  treasuryAccountId: string | null
  paymentReference: string | null
  paymentVoucherId: string | null
  components: HrFnfComponent[]
  createdAt: string
  updatedAt: string
}

export async function listExits(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrEmployeeExit[]>(`${tenantPath('/hrms/exits')}${buildQuery(params)}`)
}

export async function listMyExits(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrEmployeeExit[]>(`${tenantPath('/hrms/exits/mine')}${buildQuery(params)}`)
}

export async function getExit(exitId: string) {
  return apiRequest<HrEmployeeExit>(tenantPath(`/hrms/exits/${exitId}`))
}

export async function createExit(body: {
  employeeId?: string
  exitType: HrExitType
  resignationDate?: string
  requestedLastWorkingDate: string
  noticePeriodDays?: number
  noticeSettlementMode?: HrNoticeSettlementMode
  reason?: string
  remarks?: string
}) {
  return apiRequest<HrEmployeeExit>(tenantPath('/hrms/exits'), { method: 'POST', body: JSON.stringify(body) })
}

export async function updateExitDraft(exitId: string, body: Record<string, unknown>) {
  return apiRequest<HrEmployeeExit>(tenantPath(`/hrms/exits/${exitId}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function submitExit(exitId: string) {
  return apiRequest<HrEmployeeExit>(tenantPath(`/hrms/exits/${exitId}/submit`), { method: 'POST' })
}

export async function approveExit(
  exitId: string,
  body?: { approvedLastWorkingDate?: string; noticeSettlementMode?: HrNoticeSettlementMode; remarks?: string },
) {
  return apiRequest<HrEmployeeExit>(tenantPath(`/hrms/exits/${exitId}/approve`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function cancelExit(exitId: string, reason?: string) {
  return apiRequest<HrEmployeeExit>(tenantPath(`/hrms/exits/${exitId}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function listExitClearance(exitId: string) {
  return apiRequest<HrExitClearanceLine[]>(tenantPath(`/hrms/exits/${exitId}/clearance`))
}

export async function seedExitClearance(exitId: string) {
  return apiRequest<HrExitClearanceLine[]>(tenantPath(`/hrms/exits/${exitId}/clearance/seed`), { method: 'POST' })
}

export async function clearExitClearanceLine(exitId: string, lineId: string, remarks?: string) {
  return apiRequest<{ line: HrExitClearanceLine; exitStatus: HrExitStatus }>(
    tenantPath(`/hrms/exits/${exitId}/clearance/${lineId}/clear`),
    { method: 'POST', body: JSON.stringify({ remarks }) },
  )
}

export async function waiveExitClearanceLine(exitId: string, lineId: string, reason: string) {
  return apiRequest<{ line: HrExitClearanceLine; exitStatus: HrExitStatus }>(
    tenantPath(`/hrms/exits/${exitId}/clearance/${lineId}/waive`),
    { method: 'POST', body: JSON.stringify({ reason }) },
  )
}

export async function listExitAssetLines(exitId: string) {
  return apiRequest<HrExitAssetLine[]>(tenantPath(`/hrms/exits/${exitId}/assets`))
}

export async function addExitAssetLine(
  exitId: string,
  body: { description: string; assetCategory?: string; recoveryAmount?: number; remarks?: string },
) {
  return apiRequest<HrExitAssetLine>(tenantPath(`/hrms/exits/${exitId}/assets`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateExitAssetLine(
  exitId: string,
  assetLineId: string,
  body: { description?: string; assetCategory?: string | null; remarks?: string | null },
) {
  return apiRequest<HrExitAssetLine>(tenantPath(`/hrms/exits/${exitId}/assets/${assetLineId}`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function removeExitAssetLine(exitId: string, assetLineId: string) {
  return apiRequest<null>(tenantPath(`/hrms/exits/${exitId}/assets/${assetLineId}`), { method: 'DELETE' })
}

export async function setExitAssetLineStatus(
  exitId: string,
  assetLineId: string,
  body: { status: HrAssetLineStatus; recoveryAmount?: number; remarks?: string },
) {
  return apiRequest<{ line: HrExitAssetLine; exitStatus: HrExitStatus }>(
    tenantPath(`/hrms/exits/${exitId}/assets/${assetLineId}/status`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function listFnfSettlements(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<HrFullFinalSettlement[]>(`${tenantPath('/hrms/fnf')}${buildQuery(params)}`)
}

export async function getFnfSettlement(exitId: string) {
  return apiRequest<HrFullFinalSettlement>(tenantPath(`/hrms/fnf/${exitId}`))
}

export async function calculateFnf(exitId: string) {
  return apiRequest<HrFullFinalSettlement>(tenantPath(`/hrms/fnf/${exitId}/calculate`), { method: 'POST' })
}

export async function reviewFnf(exitId: string) {
  return apiRequest<HrFullFinalSettlement>(tenantPath(`/hrms/fnf/${exitId}/review`), { method: 'POST' })
}

export async function approveFnf(exitId: string) {
  return apiRequest<HrFullFinalSettlement>(tenantPath(`/hrms/fnf/${exitId}/approve`), { method: 'POST' })
}

export async function postFnf(exitId: string) {
  return apiRequest<HrFullFinalSettlement>(tenantPath(`/hrms/fnf/${exitId}/post`), { method: 'POST' })
}

export async function payFnf(
  exitId: string,
  body: { treasuryAccountId: string; method: HrFnfPaymentMethod; paymentDate: string; reference?: string },
) {
  return apiRequest<HrFullFinalSettlement>(tenantPath(`/hrms/fnf/${exitId}/pay`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

