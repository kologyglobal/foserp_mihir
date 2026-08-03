import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { FormField } from '@/components/forms/FormField'
import { Input, MobileInput, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { fetchAdminDepartmentsApi, type AdminDepartment } from '@/services/api/adminApi'
import { listBranches, listLegalEntities } from '@/services/api/financeApi'
import { listWorkCentres } from '@/services/api/manufacturingApi'
import type { WorkCentre } from '@/types/manufacturingSetup'
import {
  createHrEmployee,
  getHrEmployee,
  listHrDesignations,
  listHrEmployees,
  listShifts,
  updateHrEmployee,
  type HrDesignation,
  type HrEmployee,
  type HrEmployeeStatus,
  type HrEmploymentType,
  type HrGender,
  type HrShift,
  type HrWorkerCategory,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { EMPLOYMENT_TYPE_LABELS, GENDER_LABELS, WORKER_CATEGORY_LABELS, hrStatusLabel } from '../components'
import '../hrms-ui.css'

type SimpleLegalEntity = { id: string; code: string; displayName: string }
type SimpleBranch = { id: string; code: string; name: string }

const EMPLOYMENT_TYPES: HrEmploymentType[] = ['PERMANENT', 'PROBATION', 'CONTRACT', 'TRAINEE', 'INTERN', 'TEMPORARY']
const WORKER_CATEGORIES: HrWorkerCategory[] = ['STAFF', 'WORKER', 'SUPERVISOR', 'MANAGEMENT']
const GENDERS: HrGender[] = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']
const EMPLOYEE_STATUSES: HrEmployeeStatus[] = ['DRAFT', 'ACTIVE', 'ON_NOTICE', 'INACTIVE', 'EXITED']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function EmployeeFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const perms = useHrmsPermissions()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)

  const [legalEntities, setLegalEntities] = useState<SimpleLegalEntity[]>([])
  const [branches, setBranches] = useState<SimpleBranch[]>([])
  const [departments, setDepartments] = useState<AdminDepartment[]>([])
  const [designations, setDesignations] = useState<HrDesignation[]>([])
  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([])
  const [shifts, setShifts] = useState<HrShift[]>([])
  const [employees, setEmployees] = useState<HrEmployee[]>([])

  // Basic
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState<HrGender | ''>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [stateName, setStateName] = useState('')
  const [pin, setPin] = useState('')
  const [country, setCountry] = useState('')

  // Employment
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10))
  const [employmentType, setEmploymentType] = useState<HrEmploymentType>('PERMANENT')
  const [workerCategory, setWorkerCategory] = useState<HrWorkerCategory>('STAFF')
  const [status, setStatus] = useState<HrEmployeeStatus>('DRAFT')
  const [defaultShiftId, setDefaultShiftId] = useState('')
  const [weeklyOffDay, setWeeklyOffDay] = useState('')

  // Assignment
  const [legalEntityId, setLegalEntityId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [designationId, setDesignationId] = useState('')
  const [primaryWorkCentreId, setPrimaryWorkCentreId] = useState('')
  const [reportingManagerEmployeeId, setReportingManagerEmployeeId] = useState('')

  useEffect(() => {
    void listLegalEntities({ limit: 100 })
      .then((res) => setLegalEntities((res.data ?? []).map((x) => ({ id: x.id, code: x.code, displayName: x.displayName }))))
      .catch(() => undefined)
    void fetchAdminDepartmentsApi()
      .then((rows) => setDepartments(rows.filter((d) => d.isActive)))
      .catch(() => undefined)
    void listHrDesignations({ limit: 200, active: 'true' })
      .then((res) => setDesignations(res.data ?? []))
      .catch(() => undefined)
    void listWorkCentres({ limit: 200 })
      .then((res) => setWorkCentres((res.data ?? []).filter((w) => w.isActive)))
      .catch(() => undefined)
    void listShifts({ limit: 200 })
      .then((res) => setShifts((res.data ?? []).filter((s) => s.isActive)))
      .catch(() => undefined)
    void listHrEmployees({ limit: 500 })
      .then((res) => setEmployees(res.data ?? []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!legalEntityId) {
      setBranches([])
      return
    }
    void listBranches(legalEntityId, { limit: 100 })
      .then((res) => setBranches((res.data ?? []).map((b) => ({ id: b.id, code: b.code, name: b.name }))))
      .catch(() => setBranches([]))
  }, [legalEntityId])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    void getHrEmployee(id)
      .then((res) => {
        const emp = res.data
        if (!emp) return
        setFirstName(emp.firstName)
        setMiddleName(emp.middleName ?? '')
        setLastName(emp.lastName)
        setDisplayName(emp.displayName)
        setGender(emp.gender ?? '')
        setDateOfBirth(emp.dateOfBirth ? emp.dateOfBirth.slice(0, 10) : '')
        setMobile(emp.mobile ?? '')
        setEmail(emp.email ?? '')
        setAddressLine(emp.addressLine ?? '')
        setCity(emp.city ?? '')
        setStateName(emp.state ?? '')
        setPin(emp.pin ?? '')
        setCountry(emp.country ?? '')
        setJoinDate(emp.joinDate.slice(0, 10))
        setEmploymentType(emp.employmentType)
        setWorkerCategory(emp.workerCategory)
        setStatus(emp.status)
        setDefaultShiftId(emp.defaultShiftId ?? '')
        setWeeklyOffDay(emp.weeklyOffDay != null ? String(emp.weeklyOffDay) : '')
        setLegalEntityId(emp.legalEntityId)
        setDepartmentId(emp.departmentId)
        setDesignationId(emp.designationId)
        setPrimaryWorkCentreId(emp.primaryWorkCentreId ?? '')
        setReportingManagerEmployeeId(emp.reportingManagerEmployeeId ?? '')
        // Branch list depends on legalEntityId effect; set branchId once branches resolve.
        void listBranches(emp.legalEntityId, { limit: 100 })
          .then((r) => {
            setBranches((r.data ?? []).map((b) => ({ id: b.id, code: b.code, name: b.name })))
            setBranchId(emp.branchId)
          })
          .catch(() => undefined)
      })
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load employee'))
      .finally(() => setLoading(false))
  }, [id])

  const managerOptions = useMemo(() => employees.filter((e) => e.id !== id), [employees, id])
  const scopedDesignations = useMemo(
    () => designations.filter((d) => !d.legalEntityId || d.legalEntityId === legalEntityId),
    [designations, legalEntityId],
  )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isEdit && !perms.canEditEmployee) return
    if (!isEdit && !perms.canCreateEmployee) return
    if (!legalEntityId || !branchId || !departmentId || !designationId) {
      notify.error('Legal entity, branch, department, and designation are required')
      return
    }
    if (!firstName.trim() || !lastName.trim()) {
      notify.error('First name and last name are required')
      return
    }
    if (!joinDate) {
      notify.error('Join date is required')
      return
    }

    const payload: Record<string, unknown> = {
      legalEntityId,
      branchId,
      departmentId,
      designationId,
      primaryWorkCentreId: primaryWorkCentreId || undefined,
      firstName: firstName.trim(),
      middleName: middleName.trim() || undefined,
      lastName: lastName.trim(),
      displayName: displayName.trim() || undefined,
      mobile: mobile.trim() || undefined,
      email: email.trim() || undefined,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || undefined,
      addressLine: addressLine.trim() || undefined,
      city: city.trim() || undefined,
      state: stateName.trim() || undefined,
      pin: pin.trim() || undefined,
      country: country.trim() || undefined,
      joinDate,
      employmentType,
      workerCategory,
      reportingManagerEmployeeId: reportingManagerEmployeeId || undefined,
      defaultShiftId: defaultShiftId || undefined,
      weeklyOffDay: weeklyOffDay !== '' ? Number(weeklyOffDay) : undefined,
    }

    setBusy(true)
    try {
      if (isEdit && id) {
        await updateHrEmployee(id, { ...payload, status })
        notify.success('Employee updated')
        navigate(`/hrms/employees/${id}`)
      } else {
        const created = await createHrEmployee(payload)
        notify.success('Employee created')
        navigate(`/hrms/employees/${created.data.id}`)
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const backTo = isEdit && id ? `/hrms/employees/${id}` : '/hrms/employees'

  if (loading) {
    return (
      <OperationalPageShell
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Employees', to: '/hrms/employees' }]}
      >
        <LoadingState variant="form" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={isEdit ? 'Edit Employee' : 'Add Employee'}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Employees', to: '/hrms/employees' },
        { label: isEdit ? 'Edit' : 'New' },
      ]}
      backLink={{ to: backTo, label: isEdit ? 'Back to employee' : 'Back to employees' }}
    >
      <form onSubmit={onSubmit} className="mx-auto max-w-4xl space-y-4 pb-6">
        <section className="hr-form-section">
          <h3 className="hr-form-section__title">Basic</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="First name" required>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </FormField>
            <FormField label="Middle name">
              <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
            </FormField>
            <FormField label="Last name" required>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </FormField>
            <FormField label="Display name" hint="Defaults to first + last name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </FormField>
            <FormField label="Gender">
              <Select value={gender} onChange={(e) => setGender(e.target.value as HrGender | '')}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Date of birth">
              <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </FormField>
            <FormField label="Mobile">
              <MobileInput value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Address" className="lg:col-span-2">
              <Textarea value={addressLine} onChange={(e) => setAddressLine(e.target.value)} rows={2} />
            </FormField>
            <FormField label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </FormField>
            <FormField label="State">
              <Input value={stateName} onChange={(e) => setStateName(e.target.value)} />
            </FormField>
            <FormField label="PIN">
              <Input value={pin} onChange={(e) => setPin(e.target.value)} />
            </FormField>
            <FormField label="Country">
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </FormField>
          </div>
        </section>

        <section className="hr-form-section">
          <h3 className="hr-form-section__title">Employment</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Join date" required>
              <Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} required />
            </FormField>
            <FormField label="Employment type" required>
              <Select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as HrEmploymentType)} required>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EMPLOYMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Worker category" required>
              <Select value={workerCategory} onChange={(e) => setWorkerCategory(e.target.value as HrWorkerCategory)} required>
                {WORKER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {WORKER_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </FormField>
            {isEdit ? (
              <FormField label="Status" required>
                <Select value={status} onChange={(e) => setStatus(e.target.value as HrEmployeeStatus)} required>
                  {EMPLOYEE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {hrStatusLabel(s, 'employee')}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}
            <FormField label="Default shift">
              <Select value={defaultShiftId} onChange={(e) => setDefaultShiftId(e.target.value)}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Weekly off">
              <Select value={weeklyOffDay} onChange={(e) => setWeeklyOffDay(e.target.value)}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {WEEKDAYS.map((d, idx) => (
                  <option key={d} value={idx}>
                    {d}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </section>

        <section className="hr-form-section">
          <h3 className="hr-form-section__title">Assignment</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Legal entity" required>
              <Select
                value={legalEntityId}
                onChange={(e) => {
                  setLegalEntityId(e.target.value)
                  setBranchId('')
                }}
                required
              >
                <option value="">{SELECT_PLACEHOLDER}</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>
                    {le.code} — {le.displayName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Branch" required>
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!legalEntityId} required>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Department" required>
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Designation" required>
              <Select value={designationId} onChange={(e) => setDesignationId(e.target.value)} required>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {scopedDesignations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Primary work centre">
              <Select value={primaryWorkCentreId} onChange={(e) => setPrimaryWorkCentreId(e.target.value)}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {workCentres.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Reporting manager">
              <Select value={reportingManagerEmployeeId} onChange={(e) => setReportingManagerEmployeeId(e.target.value)}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {managerOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.employeeCode} — {m.displayName}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </section>

        <div className="hr-form-sticky-footer">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(backTo)}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </OperationalPageShell>
  )
}
