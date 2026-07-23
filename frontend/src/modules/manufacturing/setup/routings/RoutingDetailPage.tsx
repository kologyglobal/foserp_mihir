import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Factory, GitBranch, Layers, ListOrdered, ShieldCheck, Timer } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { DynamicsKpiRow, DynamicsKpiTile } from '@/components/dynamics/DynamicsKpiTile'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  deleteRouting,
  getRouting,
  getRoutingVersion,
  getRoutingWhereUsed,
  listMachines,
  listWorkCentres,
  updateRouting,
  type RoutingWhereUsed,
} from '@/services/api/manufacturingApi'
import {
  MANUFACTURING_TIME_UNIT_LABELS,
  ROUTING_FLOW_TYPE_LABELS,
  routingLifecycleLabel,
  type Dependency,
  type Machine,
  type ManufacturingVersionStatus,
  type Operation,
  type Routing,
  type RoutingVersion,
  type StageGroup,
  type WorkCentre,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { cn } from '@/utils/cn'
import { ManufacturingSetupShell } from '../ManufacturingSetupShell'

const LIST_PATH = '/manufacturing/setup/routings'

const VERSION_STATUS_TONE: Record<ManufacturingVersionStatus, ErpStatusChipTone> = {
  DRAFT: 'pending',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUPERSEDED: 'neutral',
  ARCHIVED: 'neutral',
}

function pickDefaultVersionId(versions: RoutingVersion[]): string {
  if (!versions.length) return ''
  const active = versions.find((v) => v.status === 'ACTIVE')
  if (active) return active.id
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)
  return sorted[0]?.id ?? ''
}

function formatTime(value: string | null | undefined): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return String(value ?? '0')
  return n % 1 === 0 ? String(n) : String(n)
}

export function RoutingDetailPage() {
  const { routingId } = useParams<{ routingId: string }>()
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()

  const [routing, setRouting] = useState<(Routing & { versions?: RoutingVersion[] }) | null>(null)
  const [versions, setVersions] = useState<RoutingVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [version, setVersion] = useState<RoutingVersion | null>(null)
  const [stageGroups, setStageGroups] = useState<StageGroup[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [workCentres, setWorkCentres] = useState<WorkCentre[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [whereUsed, setWhereUsed] = useState<RoutingWhereUsed | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const workCentreLabel = useCallback(
    (id: string | null | undefined) => {
      if (!id) return '—'
      const wc = workCentres.find((w) => w.id === id)
      return wc ? `${wc.code} — ${wc.name}` : '—'
    },
    [workCentres],
  )

  const machineLabel = useCallback(
    (id: string | null | undefined) => {
      if (!id) return '—'
      const m = machines.find((x) => x.id === id)
      return m ? `${m.code} — ${m.name}` : '—'
    },
    [machines],
  )

  const operationLabel = useCallback(
    (id: string) => {
      const op = operations.find((o) => o.id === id)
      return op ? `${op.sequence} · ${op.name}` : id.slice(0, 8)
    },
    [operations],
  )

  const loadVersionDetail = useCallback(async (versionId: string) => {
    if (!versionId) {
      setVersion(null)
      setStageGroups([])
      setOperations([])
      setDependencies([])
      setWhereUsed(null)
      return
    }
    setDetailLoading(true)
    try {
      const [res, whereRes] = await Promise.all([
        getRoutingVersion(versionId),
        getRoutingWhereUsed(versionId).catch(() => null),
      ])
      setVersion(res.data)
      setStageGroups(res.data.stageGroups ?? [])
      setOperations(res.data.operations ?? [])
      setDependencies(res.data.dependencies ?? [])
      setWhereUsed(whereRes?.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load route revision')
      setVersion(null)
      setStageGroups([])
      setOperations([])
      setDependencies([])
      setWhereUsed(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    if (!apiMode || !routingId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [routingRes, wcRes, machineRes] = await Promise.all([
        getRouting(routingId),
        listWorkCentres({ limit: 100 }),
        listMachines({ limit: 200 }),
      ])
      const nextVersions = routingRes.data.versions ?? []
      setRouting(routingRes.data)
      setVersions(nextVersions)
      setWorkCentres(wcRes.data)
      setMachines(machineRes.data)
      const defaultId = pickDefaultVersionId(nextVersions)
      setSelectedVersionId(defaultId)
      if (defaultId) await loadVersionDetail(defaultId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load routing')
      setRouting(null)
    } finally {
      setLoading(false)
    }
  }, [apiMode, routingId, loadVersionDetail])

  useEffect(() => {
    if (perms.canViewSetup) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup])

  const switchVersion = async (nextId: string) => {
    setSelectedVersionId(nextId)
    await loadVersionDetail(nextId)
  }

  const sortedStages = useMemo(
    () => [...stageGroups].sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code)),
    [stageGroups],
  )

  const sortedOperations = useMemo(
    () => [...operations].sort((a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code)),
    [operations],
  )

  const operationsByStage = useMemo(() => {
    const map = new Map<string, Operation[]>()
    for (const op of sortedOperations) {
      const list = map.get(op.stageGroupId) ?? []
      list.push(op)
      map.set(op.stageGroupId, list)
    }
    return map
  }, [sortedOperations])

  const stats = useMemo(() => {
    const qcCount = operations.filter((o) => o.qualityRequired).length
    const setupTotal = operations.reduce((sum, o) => sum + (Number(o.setupTimeMinutes) || 0), 0)
    const runTotal = operations.reduce((sum, o) => sum + (Number(o.runTimeValue) || 0), 0)
    return {
      stages: stageGroups.length,
      operations: operations.length,
      dependencies: dependencies.length,
      qcCount,
      setupTotal,
      runTotal,
    }
  }, [stageGroups, operations, dependencies])

  const lifecycleDisplay = version
    ? routingLifecycleLabel(version.status, version.lifecycleLabel)
    : routing?.isActive
      ? 'Active'
      : 'Inactive'

  const toggleActive = async () => {
    if (!routing || !perms.canManageRouting) return
    setBusy(true)
    try {
      const next = await updateRouting(routing.id, { isActive: !routing.isActive })
      setRouting((prev) => (prev ? { ...prev, ...next.data, versions: prev.versions } : next.data))
      notify.success(next.data.isActive ? 'Route activated.' : 'Route deactivated.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!routing || !perms.canManageRouting) return
    const ok = await appConfirm({
      title: 'Delete route?',
      description: `Delete ${routing.code}? This soft-deletes the route header.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteRouting(routing.id)
      notify.success('Route deleted.')
      navigate(LIST_PATH)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)
  const editPath = selectedVersionId
    ? `/manufacturing/setup/routing-versions/${selectedVersionId}`
    : routing
      ? `/manufacturing/setup/routings/${routing.id}`
      : LIST_PATH

  if (!apiMode) {
    return (
      <ManufacturingSetupShell title="Route" backLink={{ to: LIST_PATH, label: 'Back to Routings' }} parentCrumb={{ label: 'Routings', to: LIST_PATH }}>
        <EmptyState icon={GitBranch} title="API mode required" description="Routings require VITE_USE_API=true." />
      </ManufacturingSetupShell>
    )
  }

  if (loading) {
    return (
      <ManufacturingSetupShell title="Route" backLink={{ to: LIST_PATH, label: 'Back to Routings' }} parentCrumb={{ label: 'Routings', to: LIST_PATH }}>
        <LoadingState variant="form" rows={8} />
      </ManufacturingSetupShell>
    )
  }

  if (!routing) {
    return (
      <ManufacturingSetupShell title="Not found" backLink={{ to: LIST_PATH, label: 'Back to Routings' }} parentCrumb={{ label: 'Routings', to: LIST_PATH }}>
        <EmptyState icon={GitBranch} title="Route not found" description="It may have been deleted." />
      </ManufacturingSetupShell>
    )
  }

  return (
    <ManufacturingSetupShell
      title={`${routing.code} — ${routing.name}`}
      description={
        routing.description?.trim()
          ? routing.description
          : 'Production route with stages, operations, work centres, and timing.'
      }
      backLink={{ to: LIST_PATH, label: 'Back to Routings' }}
      parentCrumb={{ label: 'Routings', to: LIST_PATH }}
      breadcrumbLabel={routing.code}
      actions={
        <div className="flex flex-wrap gap-2">
          <DynamicsStatusChip
            label={routing.isActive ? 'Active' : 'Inactive'}
            tone={routing.isActive ? 'success' : 'neutral'}
          />
          {perms.canManageRouting ? (
            <>
              <ErpButton size="sm" variant="outline" loading={busy} onClick={() => void toggleActive()}>
                {routing.isActive ? 'Deactivate' : 'Activate'}
              </ErpButton>
              <ErpButton size="sm" variant="outline" loading={busy} onClick={() => void remove()}>
                Delete
              </ErpButton>
              <ErpButton size="sm" onClick={() => navigate(editPath)}>
                Edit
              </ErpButton>
            </>
          ) : (
            <ErpButton size="sm" variant="outline" onClick={() => navigate(editPath)}>
              Open
            </ErpButton>
          )}
          <ErpButton size="sm" variant="outline" onClick={() => navigate(LIST_PATH)}>
            Close
          </ErpButton>
        </div>
      }
    >
      {!versions.length ? (
        <EmptyState
          icon={GitBranch}
          title="No revisions yet"
          description="Open the editor to create the first revision and add operations."
          action={
            perms.canManageRouting ? (
              <ErpButton size="sm" onClick={() => navigate(`/manufacturing/setup/routings/${routing.id}`)}>
                Open editor
              </ErpButton>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Revision overview band */}
          <div className="mb-4 overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-erp-border bg-erp-surface-alt/60 px-4 py-3">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] font-semibold text-erp-muted">{routing.code}</span>
                  {version ? (
                    <ErpStatusChip label={lifecycleDisplay} tone={VERSION_STATUS_TONE[version.status]} />
                  ) : null}
                </div>
                <h2 className="text-[15px] font-semibold text-erp-text">{routing.name}</h2>
                {version ? (
                  <p className="text-[12px] text-erp-muted">
                    Version {version.versionNumber} · Rev {version.revisionCode}
                    {version.effectiveFrom ? ` · Effective ${formatDate(version.effectiveFrom)}` : ''}
                    {version.effectiveTo ? ` → ${formatDate(version.effectiveTo)}` : ''}
                  </p>
                ) : null}
              </div>

              <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                Revision
                <Select
                  value={selectedVersionId}
                  onChange={(e) => void switchVersion(e.target.value)}
                  wrapClassName="mt-1 w-52"
                  className="h-8 text-[12px] normal-case tracking-normal"
                >
                  {sortedVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Rev {v.revisionCode} (v{v.versionNumber}) — {routingLifecycleLabel(v.status, v.lifecycleLabel)}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <dl className="grid gap-3 border-b border-erp-border px-4 py-3 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Production flow</dt>
                <dd className="mt-0.5 font-medium text-erp-text">
                  {ROUTING_FLOW_TYPE_LABELS[routing.productionFlowType ?? 'SERIAL'] ?? routing.productionFlowType}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Updated</dt>
                <dd className="mt-0.5 font-medium text-erp-text">{formatDate(routing.updatedAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Description</dt>
                <dd className="mt-0.5 text-erp-text">{routing.description?.trim() || '—'}</dd>
              </div>
              {version?.revisionNotes?.trim() ? (
                <div className="sm:col-span-2 lg:col-span-4">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Revision notes</dt>
                  <dd className="mt-0.5 text-erp-muted">{version.revisionNotes}</dd>
                </div>
              ) : null}
            </dl>

            <DynamicsKpiRow columns={4} className="border-0 px-3 py-2.5">
              <DynamicsKpiTile label="Stages" value={stats.stages} helper="Stage groups on this revision" tone="primary" />
              <DynamicsKpiTile label="Operations" value={stats.operations} helper="Process steps in sequence" tone="neutral" />
              <DynamicsKpiTile
                label="QC steps"
                value={stats.qcCount}
                helper="Operations requiring quality"
                tone={stats.qcCount > 0 ? 'warning' : 'neutral'}
              />
              <DynamicsKpiTile
                label="Dependencies"
                value={stats.dependencies}
                helper="Operation links / constraints"
                tone="success"
              />
            </DynamicsKpiRow>
          </div>

          {detailLoading ? (
            <LoadingState variant="table" rows={8} cols={8} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0 space-y-4">
                {/* Stages */}
                <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-erp-border bg-erp-surface-alt/50 px-4 py-2.5">
                    <Layers className="h-4 w-4 text-erp-primary" aria-hidden />
                    <h3 className="text-[13px] font-semibold text-erp-text">Stages</h3>
                    <span className="ml-auto text-[11px] tabular-nums text-erp-muted">{sortedStages.length} group(s)</span>
                  </div>
                  {sortedStages.length === 0 ? (
                    <p className="px-4 py-6 text-[12px] text-erp-muted">
                      No stage groups on this revision. Operations may use a default MAIN stage.
                    </p>
                  ) : (
                    <div className="divide-y divide-erp-border">
                      {sortedStages.map((sg) => {
                        const stageOps = operationsByStage.get(sg.id) ?? []
                        return (
                          <div key={sg.id} className="px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-[11px] font-semibold text-erp-muted">{sg.code}</span>
                                  <span className="text-[13px] font-semibold text-erp-text">{sg.name}</span>
                                  {sg.isOptional ? (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                      Optional
                                    </span>
                                  ) : null}
                                  {sg.qualityRequired ? (
                                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                      QC
                                    </span>
                                  ) : null}
                                  {sg.parallelAllowed ? (
                                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                                      Parallel
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-[11px] text-erp-muted">
                                  Order {sg.displayOrder} · {sg.completionRule.replace(/_/g, ' ')}
                                  {sg.defaultWorkCentreId ? ` · ${workCentreLabel(sg.defaultWorkCentreId)}` : ''}
                                </p>
                              </div>
                              <span className="text-[11px] tabular-nums text-erp-muted">{stageOps.length} op(s)</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* Operations */}
                <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-erp-surface-alt/50 px-4 py-2.5">
                    <ListOrdered className="h-4 w-4 text-erp-primary" aria-hidden />
                    <div>
                      <h3 className="text-[13px] font-semibold text-erp-text">Operations</h3>
                      <p className="text-[11px] text-erp-muted">
                        Setup Σ {formatTime(String(stats.setupTotal))} · Run Σ {formatTime(String(stats.runTotal))}
                      </p>
                    </div>
                    <span className="ml-auto text-[11px] tabular-nums text-erp-muted">{sortedOperations.length} step(s)</span>
                  </div>
                  {sortedOperations.length === 0 ? (
                    <EmptyState icon={Factory} title="No operations" description="This revision has no process steps yet." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="erp-table w-full min-w-[980px] text-left text-[12px]">
                        <thead>
                          <tr>
                            <th className="w-16">Op</th>
                            <th className="min-w-[180px]">Description</th>
                            <th className="min-w-[150px]">Work centre</th>
                            <th className="min-w-[130px]">Machine</th>
                            <th className="w-24 text-right">Setup</th>
                            <th className="w-24 text-right">Run</th>
                            <th className="w-16 text-center">QC</th>
                            <th className="w-28">Flags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedOperations.map((op, idx) => (
                            <tr
                              key={op.id}
                              className={cn('transition-colors hover:bg-erp-primary-soft/20', idx % 2 === 1 && 'bg-slate-50/40')}
                            >
                              <td className="font-mono text-[11px] font-semibold tabular-nums">{op.sequence}</td>
                              <td>
                                <span className="block font-medium text-erp-text">{op.name}</span>
                                <span className="block font-mono text-[10px] text-erp-muted">{op.code}</span>
                              </td>
                              <td className="text-[11.5px]">{workCentreLabel(op.workCentreId)}</td>
                              <td className="text-[11.5px]">{machineLabel(op.defaultMachineId)}</td>
                              <td className="text-right tabular-nums">
                                <span className="font-semibold">{formatTime(op.setupTimeMinutes)}</span>{' '}
                                <span className="text-[10px] text-erp-muted">
                                  {MANUFACTURING_TIME_UNIT_LABELS[op.setupTimeUnit ?? 'MINUTE']}
                                </span>
                              </td>
                              <td className="text-right tabular-nums">
                                <span className="font-semibold">{formatTime(op.runTimeValue)}</span>{' '}
                                <span className="text-[10px] text-erp-muted">
                                  {MANUFACTURING_TIME_UNIT_LABELS[op.runTimeUnit ?? 'MINUTE']}
                                </span>
                              </td>
                              <td className="text-center">
                                {op.qualityRequired ? (
                                  <span className="inline-flex items-center gap-1 text-rose-700">
                                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                                    Yes
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-1">
                                  {op.isOptional ? (
                                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                      Optional
                                    </span>
                                  ) : null}
                                  {op.outsourced ? (
                                    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                      Outsourced
                                    </span>
                                  ) : null}
                                  {op.reworkAllowed ? (
                                    <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                      Rework
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Dependencies */}
                <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-erp-border bg-erp-surface-alt/50 px-4 py-2.5">
                    <GitBranch className="h-4 w-4 text-erp-primary" aria-hidden />
                    <h3 className="text-[13px] font-semibold text-erp-text">Dependencies</h3>
                    <span className="ml-auto text-[11px] tabular-nums text-erp-muted">{dependencies.length}</span>
                  </div>
                  {dependencies.length === 0 ? (
                    <p className="px-4 py-5 text-[12px] text-erp-muted">No operation dependencies defined.</p>
                  ) : (
                    <ul className="divide-y divide-erp-border">
                      {dependencies.map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[12px]">
                          <span className="font-medium text-erp-text">{operationLabel(d.predecessorOperationId)}</span>
                          <span className="text-erp-muted">→</span>
                          <span className="font-medium text-erp-text">{operationLabel(d.successorOperationId)}</span>
                          <span className="rounded border border-erp-border bg-erp-surface-alt px-1.5 py-0.5 font-mono text-[10px]">
                            {d.dependencyType.replace(/_/g, ' ')}
                          </span>
                          {d.isMandatory ? (
                            <span className="text-[10px] font-semibold text-erp-muted">Mandatory</span>
                          ) : (
                            <span className="text-[10px] text-erp-muted">Optional</span>
                          )}
                          {d.allowParallel ? (
                            <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                              Parallel OK
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {/* Side panel */}
              <aside className="space-y-4">
                <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Timer className="h-4 w-4 text-erp-primary" aria-hidden />
                    <h3 className="text-[13px] font-semibold text-erp-text">Timing summary</h3>
                  </div>
                  <dl className="space-y-2 text-[12px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-erp-muted">Total setup</dt>
                      <dd className="font-semibold tabular-nums">{formatTime(String(stats.setupTotal))}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-erp-muted">Total run</dt>
                      <dd className="font-semibold tabular-nums">{formatTime(String(stats.runTotal))}</dd>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-erp-border pt-2">
                      <dt className="text-erp-muted">QC operations</dt>
                      <dd className="font-semibold tabular-nums">{stats.qcCount}</dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Where used</h3>
                  {!whereUsed || whereUsed.profiles.length === 0 ? (
                    <p className="text-[12px] text-erp-muted">No manufacturing profiles reference this revision.</p>
                  ) : (
                    <ul className="space-y-1.5 text-[12px]">
                      {whereUsed.profiles.map((profile) => (
                        <li key={profile.id} className="rounded border border-erp-border px-2 py-1.5">
                          <span className="block font-mono text-[11px] text-erp-muted">{profile.code}</span>
                          <span className="font-medium text-erp-text">{profile.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-[13px] font-semibold text-erp-text">All revisions</h3>
                  <ul className="space-y-1.5 text-[12px]">
                    {sortedVersions.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => void switchVersion(v.id)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left transition-colors',
                            v.id === selectedVersionId
                              ? 'border-erp-primary bg-erp-primary-soft/40'
                              : 'border-erp-border hover:bg-erp-surface-alt',
                          )}
                        >
                          <span className="font-mono text-[11px]">Rev {v.revisionCode}</span>
                          <ErpStatusChip
                            label={routingLifecycleLabel(v.status, v.lifecycleLabel)}
                            tone={VERSION_STATUS_TONE[v.status]}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>
          )}
        </>
      )}
    </ManufacturingSetupShell>
  )
}
