import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import {
  activateBranch,
  createBranch,
  deactivateBranch,
  listBranches,
  resolveLegalEntityId,
  setDefaultBranch,
  updateBranch,
} from '@/services/bridges/financeApiBridge'
import type { Branch, BranchType } from '@/types/financeSetup'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'
import { FinanceSettingsTable } from './financeSettingsShared'

const BRANCH_TYPES: BranchType[] = ['HEAD_OFFICE', 'FACTORY', 'WAREHOUSE', 'SALES_OFFICE', 'SERVICE_CENTRE', 'OTHER']

export function BranchesPage() {
  const perms = useFinancePermissions()
  const [rows, setRows] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form, setForm] = useState({
    code: '',
    name: '',
    branchType: 'HEAD_OFFICE' as BranchType,
    gstin: '',
    stateCode: '27',
    phone: '',
    email: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listBranches())
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load branches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const save = async () => {
    try {
      if (editing) {
        await updateBranch(editing.id, form)
        notify.success('Branch updated.')
      } else {
        await createBranch({ ...form, legalEntityId: resolveLegalEntityId() })
        notify.success('Branch created.')
      }
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    if (!window.confirm(`${label}?`)) return
    try {
      await fn()
      notify.success(`${label} completed.`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    }
  }

  return (
    <FinanceSettingsShell
      title="Branches"
      actions={
        perms.canManageBranch ? (
          <ErpButton size="sm" onClick={() => { setEditing(null); setDrawerOpen(true) }}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Branch
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && perms.canView ? (
        <FinanceSettingsTable headers={['Code', 'Name', 'Type', 'Default', 'Status', 'Actions']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-mono text-[11px]">{row.code}</td>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2">{row.branchType.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2">{row.isDefault ? 'Yes' : 'No'}</td>
              <td className="px-3 py-2">{row.isActive ? 'Active' : 'Inactive'}</td>
              <td className="px-3 py-2">
                {perms.canManageBranch ? (
                  <div className="flex flex-wrap gap-1">
                    <ErpButton size="sm" variant="outline" onClick={() => { setEditing(row); setForm({ code: row.code, name: row.name, branchType: row.branchType, gstin: row.gstin ?? '', stateCode: row.stateCode ?? '', phone: row.phone ?? '', email: row.email ?? '' }); setDrawerOpen(true) }}>
                      Edit
                    </ErpButton>
                    {!row.isDefault ? (
                      <ErpButton size="sm" variant="outline" onClick={() => void runAction('Set default branch', () => setDefaultBranch(row.id))}>
                        Set default
                      </ErpButton>
                    ) : null}
                    {row.isActive ? (
                      <ErpButton size="sm" variant="outline" onClick={() => void runAction('Deactivate branch', () => deactivateBranch(row.id))}>
                        Deactivate
                      </ErpButton>
                    ) : (
                      <ErpButton size="sm" variant="outline" onClick={() => void runAction('Activate branch', () => activateBranch(row.id))}>
                        Activate
                      </ErpButton>
                    )}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </FinanceSettingsTable>
      ) : null}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Branch' : 'New Branch'}
        eyebrow="Finance Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</ErpButton>
            <ErpButton onClick={() => void save()} disabled={!perms.canManageBranch}>Save</ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Code" required><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} /></FormField>
          <FormField label="Name" required><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></FormField>
          <FormField label="Type"><Select value={form.branchType} onChange={(e) => setForm((f) => ({ ...f, branchType: e.target.value as BranchType }))}>{BRANCH_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</Select></FormField>
          <FormField label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} /></FormField>
        </div>
      </AccountDrawerShell>
    </FinanceSettingsShell>
  )
}
