import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Wrench } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  activateMachine,
  createMachine,
  deactivateMachine,
  listMachines,
  listWorkCentres,
  setMachineStatus,
  updateMachine,
} from '@/services/api/manufacturingApi'
import { MACHINE_STATUSES, MACHINE_STATUS_LABELS, type Machine, type MachineStatus, type WorkCentre } from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'
import { SetupViewPopup } from './SetupViewPopup'

interface MachineFormState {
  code: string
  name: string
  workCentreId: string
  status: MachineStatus
  manufacturer: string
  model: string
  isActive: boolean
}

const EMPTY_FORM: MachineFormState = {
  code: '',
  name: '',
  workCentreId: '',
  status: 'AVAILABLE',
  manufacturer: '',
  model: '',
  isActive: true,
}

export function MachinesSetupPage() {
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [rows, setRows] = useState<Machine[]>([])
  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [workCentreFilter, setWorkCentreFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Machine | null>(null)
  const [viewing, setViewing] = useState<Machine | null>(null)
  const [form, setForm] = useState<MachineFormState>(EMPTY_FORM)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const workCentreLabel = useCallback(
    (id: string) => {
      const wc = workCentres.find((w) => w.id === id)
      return wc ? `${wc.code} — ${wc.name}` : '—'
    },
    [workCentres],
  )

  const load = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [machinesRes, workCentresRes] = await Promise.all([
        listMachines({
          search: search || undefined,
          workCentreId: workCentreFilter || undefined,
          limit: 100,
        }),
        listWorkCentres({ limit: 100 }),
      ])
      setRows(machinesRes.data)
      setWorkCentres(workCentresRes.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load machines')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [apiMode, search, workCentreFilter])

  useEffect(() => {
    if (perms.canViewSetup) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup])

  const openNew = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, workCentreId: workCentres[0]?.id ?? '' })
    setDrawerOpen(true)
  }

  const openEdit = (row: Machine) => {
    setViewing(null)
    setEditing(row)
    setForm({
      code: row.code,
      name: row.name,
      workCentreId: row.workCentreId,
      status: row.status,
      manufacturer: row.manufacturer ?? '',
      model: row.model ?? '',
      isActive: row.isActive,
    })
    setDrawerOpen(true)
  }

  const openView = (row: Machine) => {
    setViewing(row)
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        workCentreId: form.workCentreId,
        status: form.status,
        manufacturer: form.manufacturer.trim() || undefined,
        model: form.model.trim() || undefined,
        isActive: form.isActive,
      }
      if (editing) {
        await updateMachine(editing.id, payload)
        notify.success('Machine updated.')
      } else {
        await createMachine(payload)
        notify.success('Machine created.')
      }
      setDrawerOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: Machine) => {
    setBusyId(row.id)
    try {
      if (row.isActive) {
        await deactivateMachine(row.id)
        notify.success('Machine deactivated.')
      } else {
        await activateMachine(row.id)
        notify.success('Machine activated.')
      }
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const changeStatus = async (row: Machine, status: MachineStatus) => {
    if (status === row.status) return
    setBusyId(row.id)
    try {
      await setMachineStatus(row.id, status)
      notify.success('Machine status updated.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Status change failed')
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
      title="Machines"
      actions={
        apiMode && perms.canManageMachine ? (
          <ErpButton size="sm" onClick={openNew} disabled={workCentres.length === 0} disabledReason="Create a work centre first">
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Machine
          </ErpButton>
        ) : null
      }
    >
      {!apiMode ? null : !perms.canViewSetup && !perms.canViewMachine ? (
        <EmptyState icon={Wrench} title="Access denied" description="Missing machine view permission." />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search code / name…" className="max-w-xs" />
            <label className="text-[11px] font-medium text-erp-muted">
              Work Centre
              <Select
                value={workCentreFilter}
                onChange={(e) => setWorkCentreFilter(e.target.value)}
                className="mt-0.5 block w-56"
              >
                <option value="">All work centres</option>
                {workCentres.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.code} — {wc.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          {loading ? <LoadingState variant="table" rows={6} cols={5} /> : null}
          {!loading && filtered.length === 0 ? (
            <EmptyState icon={Wrench} title="No machines found" description="Create a machine under a work centre." />
          ) : null}
          {!loading && filtered.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
              <table className="erp-table w-full min-w-[720px] text-left text-[12px]">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Work Centre</th>
                    <th>Status</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="font-mono text-[11px] font-medium">{row.code}</td>
                      <td className="font-medium">{row.name}</td>
                      <td>{workCentreLabel(row.workCentreId)}</td>
                      <td>
                        {perms.canManageMachine ? (
                          <Select
                            value={row.status}
                            onChange={(e) => void changeStatus(row, e.target.value as MachineStatus)}
                            className="w-40"
                            disabled={busyId === row.id}
                          >
                            {MACHINE_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {MACHINE_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <DynamicsStatusChip label={MACHINE_STATUS_LABELS[row.status]} tone="info" />
                        )}
                      </td>
                      <td>
                        <DynamicsStatusChip
                          label={row.isActive ? 'Active' : 'Inactive'}
                          tone={row.isActive ? 'success' : 'neutral'}
                        />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <ErpButton size="sm" variant="outline" onClick={() => openView(row)}>
                            View
                          </ErpButton>
                          {perms.canManageMachine ? (
                            <>
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
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      <SetupViewPopup
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? 'Machine'}
        subtitle={viewing?.code}
        fields={
          viewing
            ? [
                { label: 'Code', value: viewing.code, mono: true },
                {
                  label: 'Active',
                  value: (
                    <DynamicsStatusChip
                      label={viewing.isActive ? 'Active' : 'Inactive'}
                      tone={viewing.isActive ? 'success' : 'neutral'}
                    />
                  ),
                },
                { label: 'Name', value: viewing.name, fullWidth: true },
                { label: 'Work Centre', value: workCentreLabel(viewing.workCentreId), fullWidth: true },
                { label: 'Status', value: MACHINE_STATUS_LABELS[viewing.status] },
                { label: 'Manufacturer', value: viewing.manufacturer ?? '—' },
                { label: 'Model', value: viewing.model ?? '—' },
                { label: 'Updated', value: viewing.updatedAt.slice(0, 10) },
              ]
            : []
        }
        footerExtra={
          viewing && perms.canManageMachine ? (
            <ErpButton
              onClick={() => {
                const row = viewing
                setViewing(null)
                openEdit(row)
              }}
            >
              Edit
            </ErpButton>
          ) : null
        }
      />

      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Machine' : 'New Machine'}
        eyebrow="Manufacturing Setup"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              loading={saving}
              disabled={!form.code.trim() || !form.name.trim() || !form.workCentreId}
              onClick={() => void save()}
            >
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
          <FormField label="Work Centre" required>
            <Select value={form.workCentreId} onChange={(e) => setForm((f) => ({ ...f, workCentreId: e.target.value }))}>
              <option value="">Select work centre…</option>
              {workCentres.map((wc) => (
                <option key={wc.id} value={wc.id}>
                  {wc.code} — {wc.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MachineStatus }))}>
              {MACHINE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {MACHINE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Manufacturer">
            <Input value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} />
          </FormField>
          <FormField label="Model">
            <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
          </FormField>
        </div>
      </AccountDrawerShell>
    </ManufacturingSetupShell>
  )
}
