import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Warehouse } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  activateWorkCentre,
  deactivateWorkCentre,
  deleteWorkCentre,
  listWorkCentres,
} from '@/services/api/manufacturingApi'
import type { WorkCentre } from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { ManufacturingSetupShell } from './ManufacturingSetupShell'

export function WorkCentresSetupPage() {
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [rows, setRows] = useState<WorkCentre[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

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

  const remove = async (row: WorkCentre) => {
    const ok = await appConfirm({
      title: 'Delete work centre?',
      description: `Delete ${row.code}? This soft-deletes the record.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(row.id)
    try {
      await deleteWorkCentre(row.id)
      notify.success('Work centre deleted.')
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
      title="Work Centres"
      actions={
        apiMode && perms.canManageWorkCentre ? (
          <ErpButton size="sm" onClick={() => navigate('/manufacturing/work-centres/new')}>
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
                        <div className="flex flex-wrap gap-1">
                          <ErpButton size="sm" variant="outline" onClick={() => navigate(`/manufacturing/work-centres/${row.id}`)}>
                            View
                          </ErpButton>
                          {perms.canManageWorkCentre ? (
                            <>
                              <ErpButton size="sm" variant="outline" onClick={() => navigate(`/manufacturing/work-centres/${row.id}/edit`)}>
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
