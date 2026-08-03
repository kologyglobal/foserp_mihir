import { useEffect, useState, type FormEvent } from 'react'
import { Plus, RefreshCw, Wallet } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createSalaryComponent,
  listSalaryComponents,
  type HrSalaryCalculationType,
  type HrSalaryComponent,
  type HrSalaryComponentType,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { HrEmptyState, HrRegisterShell } from '@/modules/hrms/components'
import '../hrms-ui.css'

const TYPES: HrSalaryComponentType[] = ['EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION']
const CALCS: HrSalaryCalculationType[] = [
  'FIXED',
  'PERCENTAGE',
  'ATTENDANCE_LINKED',
  'OT_LINKED',
  'STATUTORY',
]

export function SalaryComponentsPage() {
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrSalaryComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<HrSalaryComponentType | ''>('')
  const [calculationType, setCalculationType] = useState<HrSalaryCalculationType | ''>('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await listSalaryComponents({ limit: 200 })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load components')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!perms.canManageSalaryComponent || !type || !calculationType) return
    try {
      await createSalaryComponent({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type,
        calculationType,
        taxable: type === 'EARNING',
        affectsGross: type === 'EARNING',
        affectsNet: type !== 'EMPLOYER_CONTRIBUTION',
      })
      setCode('')
      setName('')
      setType('')
      setCalculationType('')
      notify.success('Salary component created')
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Create failed')
    }
  }

  return (
    <OperationalPageShell
      title="Salary Components"
      description="Earnings, deductions, and employer contributions used by salary structures. Not payroll calculation."
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Payroll Setup' },
        { label: 'Components' },
      ]}
    >
      <ErpCommandBar
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />
      {perms.canManageSalaryComponent ? (
        <form
          onSubmit={create}
          className="mb-4 grid grid-cols-1 gap-2 rounded border border-erp-border bg-white p-3 md:grid-cols-5 md:items-end"
        >
          <FormField label="Code" required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required />
          </FormField>
          <FormField label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="Type" required>
            <Select value={type} onChange={(e) => setType(e.target.value as HrSalaryComponentType | '')} required>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Calculation" required>
            <Select
              value={calculationType}
              onChange={(e) => setCalculationType(e.target.value as HrSalaryCalculationType | '')}
              required
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {CALCS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <button type="submit" className="btn btn--primary btn--sm">
            <Plus className="mr-1 h-4 w-4" />
            Add
          </button>
        </form>
      ) : null}
      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={Wallet} title="No salary components" description="Add BASIC, HRA, PF, OT, etc." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Calculation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.code}</td>
                  <td>{r.name}</td>
                  <td>{r.type}</td>
                  <td>{r.calculationType}</td>
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
