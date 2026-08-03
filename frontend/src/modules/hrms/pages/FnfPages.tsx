import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listBranches, listLegalEntities } from '@/services/api/financeApi'
import { listFnfSettlements, listHrEmployees, type HrFullFinalSettlement } from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { money } from './exitUi'
import { HrEmployeeCell, HrEmptyState, HrRegisterShell, HrStatusChip, hrStatusLabel } from '@/modules/hrms/components'
import '../hrms-ui.css'

type SimpleEmployee = { id: string; employeeCode: string; displayName: string }
type SimpleLegalEntity = { id: string; code: string; displayName: string }
type SimpleBranch = { id: string; code: string; name: string }

const FNF_STATUSES = ['DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED', 'POSTED', 'PAID', 'CLOSED']

export function FnfRegisterPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrFullFinalSettlement[]>([])
  const [loading, setLoading] = useState(true)

  const [legalEntities, setLegalEntities] = useState<SimpleLegalEntity[]>([])
  const [branches, setBranches] = useState<SimpleBranch[]>([])
  const [employees, setEmployees] = useState<SimpleEmployee[]>([])

  const [legalEntityId, setLegalEntityId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    void listLegalEntities({ limit: 100 })
      .then((res) => setLegalEntities((res.data ?? []).map((x) => ({ id: x.id, code: x.code, displayName: x.displayName }))))
      .catch(() => undefined)
    void listHrEmployees({ limit: 500 })
      .then((res) => setEmployees(res.data ?? []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!legalEntityId) {
      setBranches([])
      setBranchId('')
      return
    }
    void listBranches(legalEntityId, { limit: 100 })
      .then((res) =>
        setBranches((res.data ?? []).map((x: { id: string; code: string; name: string }) => ({ id: x.id, code: x.code, name: x.name }))),
      )
      .catch(() => setBranches([]))
  }, [legalEntityId])

  const load = async () => {
    setLoading(true)
    try {
      const res = await listFnfSettlements({
        limit: 200,
        legalEntityId: legalEntityId || undefined,
        branchId: branchId || undefined,
        employeeId: employeeId || undefined,
        status: status || undefined,
      })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load settlements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalEntityId, branchId, employeeId, status])

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  if (!perms.canViewFnf) {
    return (
      <OperationalPageShell
        title="Full & Final Settlements"
        breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Full & Final' }]}
      >
        <HrEmptyState icon={Banknote} title="No access" description="Requires full & final settlement view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Full & Final Settlements"
      description="Exit settlements from calculation through review, approval, posting, and payment."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Full & Final' }]}
    >
      <ErpCommandBar secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />

      <div className="mb-4 grid gap-2 rounded border border-erp-border bg-white p-3 md:grid-cols-2 lg:grid-cols-4">
        <FormField label="Employee">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeCode} — {e.displayName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Legal entity">
          <Select value={legalEntityId} onChange={(e) => setLegalEntityId(e.target.value)}>
            <option value="">All Legal Entities</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>
                {le.code} — {le.displayName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Branch">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={!legalEntityId}>
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {FNF_STATUSES.map((s) => (
              <option key={s} value={s}>
                {hrStatusLabel(s, 'fnf')}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState
            icon={Banknote}
            title="No settlements"
            description="Settlements are created by calculating full & final from an approved exit."
          />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Last Working Date</th>
                <th>Earnings</th>
                <th>Deductions</th>
                <th>Net Settlement</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const emp = r.employee ?? employeeMap.get(r.employeeId)
                return (
                  <tr key={r.id} onClick={() => navigate(`/hrms/fnf/${r.employeeExitId}`)}>
                    <td>
                      <HrEmployeeCell name={emp?.displayName ?? r.employeeId} code={emp?.employeeCode} />
                      <div className="text-xs text-erp-muted">{r.code}</div>
                    </td>
                    <td>{r.lastWorkingDate}</td>
                    <td className="tabular-nums">{money(r.earningsTotal)}</td>
                    <td className="tabular-nums">{money(r.deductionsTotal)}</td>
                    <td className={`tabular-nums font-medium ${r.netSettlement < 0 ? 'text-erp-danger-fg' : ''}`}>
                      {money(r.netSettlement)}
                    </td>
                    <td>
                      <HrStatusChip status={r.status} domain="fnf" />
                    </td>
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
