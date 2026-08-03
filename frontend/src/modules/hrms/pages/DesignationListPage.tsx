import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Plus, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Inputs'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { apiRequest, tenantPath } from '@/services/api/client'
import { notify } from '@/store/toastStore'
import { hasHrmsPermission } from '@/utils/permissions/hrms'

type Designation = { id: string; code: string; name: string; isActive: boolean; level: number | null }

export function DesignationListPage() {
  const canManage = hasHrmsPermission('hrms.designation.manage')
  const [rows, setRows] = useState<Designation[]>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiRequest<Designation[]>(`${tenantPath('/hrms/designations')}?limit=100`)
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load designations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!canManage) return
    try {
      await apiRequest(tenantPath('/hrms/designations'), {
        method: 'POST',
        body: JSON.stringify({ code: code.trim().toUpperCase(), name: name.trim() }),
      })
      setCode('')
      setName('')
      notify.success('Designation created')
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Create failed')
    }
  }

  return (
    <OperationalPageShell
      title="Designations"
      description="HR designation master (not CRM / User free-text)."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Setup' }, { label: 'Designations' }]}
    >
      <ErpCommandBar
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />
      {canManage ? (
        <form onSubmit={create} className="mb-4 flex flex-wrap items-end gap-2 rounded border border-erp-border bg-white p-3">
          <FormField label="Code" required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required />
          </FormField>
          <FormField label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <button type="submit" className="btn btn--primary btn--sm">
            <Plus className="mr-1 h-4 w-4" />
            Add
          </button>
        </form>
      ) : null}
      {loading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No designations" />
      ) : (
        <div className="overflow-x-auto rounded border border-erp-border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-erp-surface text-left text-xs uppercase text-erp-muted">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-erp-border">
                  <td className="px-3 py-2 font-medium">{d.code}</td>
                  <td className="px-3 py-2">{d.name}</td>
                  <td className="px-3 py-2">{d.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperationalPageShell>
  )
}
