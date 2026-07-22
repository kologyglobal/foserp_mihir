import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Warehouse } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  activateWorkCentre,
  createWorkCentre,
  deactivateWorkCentre,
  listWorkCentres,
  updateWorkCentre,
} from '@/services/api/manufacturingApi'
import type { WorkCentre } from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'

interface WorkCentreFormState {
  code: string
  name: string
  plantCode: string
  description: string
  isActive: boolean
}

const EMPTY_FORM: WorkCentreFormState = { code: '', name: '', plantCode: '', description: '', isActive: true }

export function WorkCentresSetupPage() {
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [rows, setRows] = useState<WorkCentre[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<WorkCentre | null>(null)
  const [form, setForm] = useState<WorkCentreFormState>(EMPTY_FORM)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listWorkCentres({ search: search || undefined, limit: 100 })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load work centres')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [apiMode, search])

  useEffect(() => {
    if (perms.canViewSetup) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup])

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }

  const openEdit = (row: WorkCentre) => {
    setEditing(row)
    setForm({
      code: row.code,
      name: row.name,
      plantCode: row.plantCode ?? '',
      description: row.description ?? '',
      isActive: row.isActive,
    })
    setDrawerOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        plantCode: form.plantCode.trim() || undefined,
        description: form.description.trim() || undefined,
        isActive: form.isActive,
      }
      if (editing) {
        await updateWorkCentre(editing.id, payload)
        notify.success('Work centre updated.')
      } else {
        await createWorkCentre(payload)
        notify.success('Work centre created.')
      }
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: WorkCentre) => {
    setBusyId(row.id)
    try {
      if (row.isActive) {
        await deactivateWorkCentre(row.id)
        notify.success('Work centre deactivated.')
      } else {
        await activateWorkCentre(row.id)
        notify.success('Work centre activated.')
      }
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <ManufacturingSetupShell
      title="Work Centres"
      actions={
        apiMode && perms.canManageWorkCentre ? (
          <ErpButton size="sm" onClick={openNew}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Work Centre
          </ErpButton>
        ) : null
      }
    >
      {!apiMode ? null : !perms.canViewSetup && !perms.canViewWorkCentre ? (
        <EmptyState icon={Warehouse} title="Access denied" description="Missing work centre view permission." />
      ) : (
        <>
          <div className="mb-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search code / name…" className="max-w-xs" />
          </div>
          {loading ? <LoadingState variant="table" rows={6} cols={5} /> : null}
          {!loading && filtered.length === 0 ? (
            <EmptyState icon={Warehouse} title="No work centres found" description="Create a work centre to get started." />
          ) : null}
          {!loading && filtered.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
              <table className="erp-table w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Plant</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-[11px] font-medium">{row.code}</td>
                      <td className="font-medium">{row.name}</td>
                      <td>{row.plantCode ?? '—'}</td>
                      <td>
                        <DynamicsStatusChip
                          label={row.isActive ? 'Active' : 'Inactive'}
                          tone={row.isActive ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="tabular-nums text-erp-muted">{row.updatedAt.slice(0, 10)}</td>
                      <td>
                        {perms.canManageWorkCentre ? (
                          <div className="flex flex-wrap gap-1">
                            <ErpButton size="sm" variant="outline" onClick={() => openEdit(row)}>
                              Edit
                            </ErpButton>
                            <ErpButton
                              size="sm"
                              variant="outline"
                              loading={busyId === row.id}
                              onClick={() => void toggleActive(row)}
                            >
                              {row.isActive ? 'Deactivate' : 'Activate'}
                            </ErpButton>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Work Centre' : 'New Work Centre'}
        eyebrow="Manufacturing Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton loading={saving} disabled={!form.code.trim() || !form.name.trim()} onClick={() => void save()}>
              Save
            </ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          <FormField label="Code" required>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              disabled={Boolean(editing)}
            />
          </FormField>
          <FormField label="Name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Plant Code">
            <Input value={form.plantCode} onChange={(e) => setForm((f) => ({ ...f, plantCode: e.target.value }))} />
          </FormField>
          <FormField label="Description">
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
        </div>
      </AccountDrawerShell>
    </ManufacturingSetupShell>
  )
}
