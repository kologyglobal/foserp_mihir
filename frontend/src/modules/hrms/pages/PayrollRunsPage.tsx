import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Wallet } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listLegalEntities } from '@/services/api/financeApi'
import {
  createPayrollPeriod,
  createPayrollRun,
  listPayrollPeriods,
  listPayrollRuns,
  type HrPayrollPeriod,
  type HrPayrollRun,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { HrEmptyState, HrRegisterShell, HrStatusChip } from '@/modules/hrms/components'
import '../hrms-ui.css'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function money(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

export function PayrollRunsPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [periods, setPeriods] = useState<HrPayrollPeriod[]>([])
  const [runs, setRuns] = useState<HrPayrollRun[]>([])
  const [legalEntities, setLegalEntities] = useState<Array<{ id: string; code: string; displayName: string }>>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [leId, setLeId] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState(String(new Date().getMonth() + 1))
  const [periodId, setPeriodId] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [p, r, les] = await Promise.all([
        listPayrollPeriods({ limit: 100 }),
        listPayrollRuns({ limit: 100 }),
        listLegalEntities({ limit: 100 }),
      ])
      setPeriods(p.data ?? [])
      setRuns(r.data ?? [])
      setLegalEntities(
        (les.data ?? []).map((x: { id: string; code: string; displayName: string }) => ({
          id: x.id,
          code: x.code,
          displayName: x.displayName,
        })),
      )
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payroll')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const createPeriod = async () => {
    if (!perms.canCreatePayroll || !leId) return
    try {
      const res = await createPayrollPeriod({
        legalEntityId: leId,
        year: Number(year),
        month: Number(month),
      })
      notify.success('Payroll period created')
      setPeriodId(res.data?.id ?? '')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create period failed')
    }
  }

  const createRun = async () => {
    if (!perms.canCreatePayroll || !periodId) return
    try {
      const res = await createPayrollRun({ payrollPeriodId: periodId })
      notify.success('Payroll run created')
      if (res.data?.id) navigate(`/hrms/payroll/runs/${res.data.id}`)
      else await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create run failed')
    }
  }

  return (
    <OperationalPageShell
      title="Payroll Runs"
      description="Calculate and finalize monthly payroll. Statutory filing and GL posting are out of scope."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Payroll' }, { label: 'Runs' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canCreatePayroll
            ? { id: 'new', label: 'New Run', icon: Plus, onClick: () => setShowNew((v) => !v) }
            : undefined
        }
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />

      {perms.canCreatePayroll && showNew ? (
        <div className="mb-4 grid gap-3 rounded border border-erp-border bg-white p-3 md:grid-cols-2">
          <div className="grid gap-2 md:grid-cols-4 md:items-end">
            <FormField label="Legal entity" required>
              <Select value={leId} onChange={(e) => setLeId(e.target.value)}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>
                    {le.code} — {le.displayName}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Year" required>
              <Input value={year} onChange={(e) => setYear(e.target.value)} />
            </FormField>
            <FormField label="Month" required>
              <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </Select>
            </FormField>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => void createPeriod()}>
              <Plus className="mr-1 h-4 w-4" />
              Open Period
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <FormField label="Open period for run" required>
              <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                <option value="">{SELECT_PLACEHOLDER}</option>
                {periods
                  .filter((p) => p.status !== 'CLOSED')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {MONTHS[p.month - 1]} {p.year} ({p.status})
                    </option>
                  ))}
              </Select>
            </FormField>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void createRun()}>
              <Plus className="mr-1 h-4 w-4" />
              Create Run
            </button>
          </div>
        </div>
      ) : null}

      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : runs.length === 0 ? (
          <HrEmptyState icon={Wallet} title="No payroll runs" description="Open a period, then create a draft run." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Period</th>
                <th>Status</th>
                <th>Employees</th>
                <th>Gross</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const p = periods.find((x) => x.id === r.payrollPeriodId)
                return (
                  <tr key={r.id} onClick={() => navigate(`/hrms/payroll/runs/${r.id}`)}>
                    <td className="font-medium">
                      <Link className="text-erp-primary" to={`/hrms/payroll/runs/${r.id}`} onClick={(e) => e.stopPropagation()}>
                        {r.code}
                      </Link>
                    </td>
                    <td>{p ? `${MONTHS[p.month - 1]} ${p.year}` : r.payrollPeriodId.slice(0, 8)}</td>
                    <td>
                      <HrStatusChip status={r.status} domain="payrollRun" />
                    </td>
                    <td>{r.employeeCount}</td>
                    <td>{money(r.grossAmount)}</td>
                    <td className="font-medium">{money(r.netAmount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </HrRegisterShell>
    </OperationalPageShell>
  )
}
