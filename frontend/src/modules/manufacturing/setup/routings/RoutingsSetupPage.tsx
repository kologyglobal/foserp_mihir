import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { deleteRouting, listRoutings, updateRouting } from '@/services/api/manufacturingApi'
import type { ManufacturingVersionStatus, Routing } from '@/types/manufacturingSetup'
import {
  ROUTING_FLOW_TYPE_LABELS,
  routingLifecycleLabel,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { ManufacturingSetupShell } from '../ManufacturingSetupShell'

const VERSION_STATUS_TONE: Record<ManufacturingVersionStatus, ErpStatusChipTone> = {
  DRAFT: 'pending',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUPERSEDED: 'neutral',
  ARCHIVED: 'neutral',
}

function routingListStatus(row: Routing): { label: string; tone: ErpStatusChipTone } {
  const versions = row.versions ?? []
  if (versions.length > 0) {
    const active = versions.find((v) => v.status === 'ACTIVE')
    const latestDraft = [...versions]
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .find((v) => v.status === 'DRAFT')
    const displayVersion = active ?? latestDraft ?? versions[0]
    return {
      label: routingLifecycleLabel(displayVersion.status, displayVersion.lifecycleLabel),
      tone: VERSION_STATUS_TONE[displayVersion.status],
    }
  }
  if (!row.isActive) {
    return { label: 'Inactive', tone: 'neutral' }
  }
  return { label: 'Active', tone: 'success' }
}

export function RoutingsSetupPage() {
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const [rows, setRows] = useState<Routing[]>([])
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
      const res = await listRoutings({ search: search || undefined, limit: 100 })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load routings')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [apiMode, search])

  useEffect(() => {
    if (perms.canViewSetup) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup])

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  }, [rows, search])

  const toggleActive = async (row: Routing) => {
    setBusyId(row.id)
    try {
      await updateRouting(row.id, { isActive: !row.isActive })
      notify.success(row.isActive ? 'Route deactivated.' : 'Route activated.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (row: Routing) => {
    const ok = await appConfirm({
      title: 'Delete route?',
      description: `Delete ${row.code}? This soft-deletes the route header.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(row.id)
    try {
      await deleteRouting(row.id)
      notify.success('Route deleted.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ManufacturingSetupShell
      title="Routings"
      actions={
        apiMode && perms.canManageRouting ? (
          <ErpButton size="sm" onClick={() => navigate('/manufacturing/setup/routings/new')}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Route
          </ErpButton>
        ) : null
      }
    >
      {!apiMode ? null : !perms.canViewSetup ? (
        <EmptyState icon={GitBranch} title="Access denied" description="Missing routing view permission." />
      ) : (
        <>
          <div className="mb-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search code / name…" className="max-w-xs" />
          </div>
          {loading ? <LoadingState variant="table" rows={6} cols={5} /> : null}
          {!loading && filtered.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No routes found"
              description="Create a route with operations, work centres, and times — then link it on the Manufacturing Profile."
              action={
                perms.canManageRouting ? (
                  <ErpButton size="sm" onClick={() => navigate('/manufacturing/setup/routings/new')}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    New Route
                  </ErpButton>
                ) : undefined
              }
            />
          ) : null}
          {!loading && filtered.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
              <table className="erp-table w-full min-w-[760px] text-left text-[12px]">
                <thead>
                  <tr>
                    <th>Route Code</th>
                    <th>Route Name</th>
                    <th>Flow</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const status = routingListStatus(row)
                    return (
                      <tr key={row.id}>
                        <td className="font-mono text-[11px]">{row.code}</td>
                        <td className="font-medium">{row.name}</td>
                        <td>{ROUTING_FLOW_TYPE_LABELS[row.productionFlowType ?? 'SERIAL']}</td>
                        <td>
                          <ErpStatusChip label={status.label} tone={status.tone} />
                        </td>
                        <td>{row.updatedAt.slice(0, 10)}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            <ErpButton
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/manufacturing/setup/routings/${row.id}/view`)}
                            >
                              View
                            </ErpButton>
                            {perms.canManageRouting ? (
                              <>
                                <ErpButton
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/manufacturing/setup/routings/${row.id}`)}
                                >
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </ManufacturingSetupShell>
  )
}
