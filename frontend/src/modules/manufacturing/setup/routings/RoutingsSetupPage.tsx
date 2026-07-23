import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, Plus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { listRoutings } from '@/services/api/manufacturingApi'
import type { ManufacturingVersionStatus, Routing } from '@/types/manufacturingSetup'
import {
  ROUTING_FLOW_TYPE_LABELS,
  routingLifecycleLabel,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { ManufacturingSetupShell } from '../ManufacturingSetupShell'
import { SetupViewPopup } from '../SetupViewPopup'

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
  const [viewing, setViewing] = useState<Routing | null>(null)

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

  const openEditor = (row: Routing) => {
    navigate(`/manufacturing/setup/routings/${row.id}`)
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
              <table className="erp-table w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr>
                    <th>Route Code</th>
                    <th>Route Name</th>
                    <th>Flow</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const status = routingListStatus(row)
                    return (
                      <tr
                        key={row.id}
                        className="cursor-pointer hover:bg-erp-surface-alt/60"
                        onClick={() => openEditor(row)}
                      >
                        <td className="font-mono text-[11px]">{row.code}</td>
                        <td className="font-medium">{row.name}</td>
                        <td>{ROUTING_FLOW_TYPE_LABELS[row.productionFlowType ?? 'SERIAL']}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="text-left" onClick={() => openEditor(row)}>
                            <ErpStatusChip label={status.label} tone={status.tone} />
                          </button>
                        </td>
                        <td>{row.updatedAt.slice(0, 10)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      <SetupViewPopup
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? 'Route'}
        subtitle={viewing?.code}
        fields={
          viewing
            ? [
                { label: 'Route Code', value: viewing.code, mono: true },
                { label: 'Status', value: routingListStatus(viewing).label },
                { label: 'Route Name', value: viewing.name, fullWidth: true },
                {
                  label: 'Production Type',
                  value: ROUTING_FLOW_TYPE_LABELS[viewing.productionFlowType ?? 'SERIAL'],
                },
                { label: 'Description', value: viewing.description ?? '—', fullWidth: true },
                { label: 'Updated', value: viewing.updatedAt.slice(0, 10) },
              ]
            : []
        }
        footerExtra={
          viewing ? (
            <ErpButton
              onClick={() => {
                const id = viewing.id
                setViewing(null)
                navigate(`/manufacturing/setup/routings/${id}`)
              }}
            >
              Open Editor
            </ErpButton>
          ) : null
        }
      />
    </ManufacturingSetupShell>
  )
}
