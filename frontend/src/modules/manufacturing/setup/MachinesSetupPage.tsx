import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Wrench } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  activateMachine,
  deactivateMachine,
  deleteMachine,
  listMachines,
  listWorkCentres,
} from '@/services/api/manufacturingApi'
import { MACHINE_STATUS_LABELS, type Machine, type WorkCentre } from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'

export function MachinesSetupPage() {
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [rows, setRows] = useState<Machine[]>([])
  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [workCentreFilter, setWorkCentreFilter] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

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

  const remove = async (row: Machine) => {
    const ok = await appConfirm({
      title: 'Delete machine?',
      description: `Delete ${row.code}? This soft-deletes the record.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(row.id)
    try {
      await deleteMachine(row.id)
      notify.success('Machine deleted.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Delete failed')
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
          <ErpButton
            size="sm"
            onClick={() => navigate('/manufacturing/machines/new')}
            disabled={workCentres.length === 0}
            disabledReason="Create a work centre first"
          >
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
                        <DynamicsStatusChip label={MACHINE_STATUS_LABELS[row.status]} tone="info" />
                      </td>
                      <td>
                        <DynamicsStatusChip
                          label={row.isActive ? 'Active' : 'Inactive'}
                          tone={row.isActive ? 'success' : 'neutral'}
                        />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <ErpButton size="sm" variant="outline" onClick={() => navigate(`/manufacturing/machines/${row.id}`)}>
                            View
                          </ErpButton>
                          {perms.canManageMachine ? (
                            <>
                              <ErpButton size="sm" variant="outline" onClick={() => navigate(`/manufacturing/machines/${row.id}/edit`)}>
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
                              <ErpButton
                                size="sm"
                                variant="outline"
                                loading={busyId === row.id}
                                onClick={() => void remove(row)}
                              >
                                Delete
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
    </ManufacturingSetupShell>
  )
}
