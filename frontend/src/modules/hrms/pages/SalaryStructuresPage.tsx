import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Layers } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createSalaryStructure,
  listSalaryStructures,
  type HrSalaryStructure,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { HrEmptyState, HrRegisterShell } from '@/modules/hrms/components'
import '../hrms-ui.css'

const CATEGORIES = ['STAFF', 'WORKER', 'SUPERVISOR', 'MANAGEMENT'] as const

export function SalaryStructuresPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrSalaryStructure[]>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [workerCategory, setWorkerCategory] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await listSalaryStructures({ limit: 200 })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load structures')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!perms.canManageSalaryStructure) return
    try {
      const res = await createSalaryStructure({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        workerCategory: workerCategory || null,
      })
      const id = res.data?.id
      notify.success('Salary structure created')
      if (id) navigate(`/hrms/payroll/setup/structures/${id}`)
      else await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Create failed')
    }
  }

  return (
    <OperationalPageShell
      title="Salary Structures"
      description="Grade / band templates with versioned component lines. Assign to employees from Employee detail."
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Payroll Setup' },
        { label: 'Structures' },
      ]}
    >
      <ErpCommandBar
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />
      {perms.canManageSalaryStructure ? (
        <form
          onSubmit={create}
          className="mb-4 grid grid-cols-1 gap-2 rounded border border-erp-border bg-white p-3 md:grid-cols-4 md:items-end"
        >
          <FormField label="Code" required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="WORKER-GRADE-A" />
          </FormField>
          <FormField label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="Category">
            <Select value={workerCategory} onChange={(e) => setWorkerCategory(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <button type="submit" className="btn btn--primary btn--sm">
            <Plus className="mr-1 h-4 w-4" />
            Create
          </button>
        </form>
      ) : null}
      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={Layers} title="No salary structures" description="Create WORKER-GRADE-A or STAFF-GRADE-B." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Active Version</th>
                <th>Effective From</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/hrms/payroll/setup/structures/${r.id}`)}>
                  <td className="font-medium">
                    <Link
                      className="text-erp-primary"
                      to={`/hrms/payroll/setup/structures/${r.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td>{r.name}</td>
                  <td>{r.workerCategory ?? '-'}</td>
                  <td>{r.activeVersion ? `v${r.activeVersion.versionNo}` : '-'}</td>
                  <td>{r.activeVersion?.effectiveFrom ?? '-'}</td>
                  <td>
                    <DynamicsStatusChip label={r.isActive ? 'Active' : 'Inactive'} tone={r.isActive ? 'success' : 'neutral'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>
    </OperationalPageShell>
  )
}
