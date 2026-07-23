import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Cog,
  Droplets,
  Layers,
  Package,
  ShoppingCart,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { DynamicsKpiRow, DynamicsKpiTile } from '@/components/dynamics/DynamicsKpiTile'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import {
  activateBom,
  deactivateBom,
  deleteBom,
  getBom,
  getBomVersionTree,
} from '@/services/api/manufacturingApi'
import type {
  Bom,
  BomLineType,
  BomTreeNode,
  BomVersion,
  ManufacturingVersionStatus,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { cn } from '@/utils/cn'
import { ManufacturingSetupShell } from '../ManufacturingSetupShell'
import { useSetupLookup } from '../useSetupLookups'
import { bomLineDescription, buildBomOutlineIndexMap } from './bomOutlineIndex'

const LIST_PATH = '/manufacturing/setup/boms'

const VERSION_STATUS_TONE: Record<ManufacturingVersionStatus, ErpStatusChipTone> = {
  DRAFT: 'pending',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUPERSEDED: 'neutral',
  ARCHIVED: 'neutral',
}

const LINE_TYPE_META: Record<BomLineType, { label: string; icon: LucideIcon; className: string }> = {
  RAW_MATERIAL: { label: 'Raw material', icon: Box, className: 'bg-slate-100 text-slate-700' },
  BOUGHT_OUT: { label: 'Bought out', icon: ShoppingCart, className: 'bg-sky-50 text-sky-700' },
  CONSUMABLE: { label: 'Consumable', icon: Droplets, className: 'bg-teal-50 text-teal-700' },
  SUBASSEMBLY: { label: 'Subassembly', icon: Layers, className: 'bg-indigo-50 text-indigo-700' },
  MANUFACTURED_COMPONENT: { label: 'Manufactured', icon: Cog, className: 'bg-violet-50 text-violet-700' },
  PACKAGING: { label: 'Packaging', icon: Package, className: 'bg-amber-50 text-amber-800' },
  SERVICE: { label: 'Service', icon: Wrench, className: 'bg-stone-100 text-stone-700' },
}

interface FlatEntry {
  node: BomTreeNode
  depth: number
}

function flattenTree(nodes: BomTreeNode[], depth = 0): FlatEntry[] {
  const out: FlatEntry[] = []
  for (const node of nodes) {
    out.push({ node, depth })
    out.push(...flattenTree(node.children, depth + 1))
  }
  return out
}

function formatQty(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n % 1 === 0 ? String(n) : String(n)
}

function LineBadge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
        className,
      )}
    >
      {label}
    </span>
  )
}

function pickDefaultVersionId(versions: BomVersion[]): string {
  if (!versions.length) return ''
  const active = versions.find((v) => v.status === 'ACTIVE')
  if (active) return active.id
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)
  return sorted[0]?.id ?? ''
}

export function BomDetailPage() {
  const { bomId } = useParams<{ bomId: string }>()
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const { options: uoms } = useSetupLookup('uom')

  const [bom, setBom] = useState<(Bom & { versions?: BomVersion[] }) | null>(null)
  const [versions, setVersions] = useState<BomVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [version, setVersion] = useState<BomVersion | null>(null)
  const [tree, setTree] = useState<BomTreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [treeSearch, setTreeSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [treeLoading, setTreeLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const uomLabel = useCallback(
    (id: string, code?: string | null) => {
      if (code) return code
      return uoms.find((u) => u.id === id)?.label?.split('—')[0]?.trim() ?? '—'
    },
    [uoms],
  )

  const productLabel = useCallback((row: Bom) => {
    if (row.productItemCode && row.productItemName) return `${row.productItemCode} — ${row.productItemName}`
    return row.productItemCode || row.productItemName || '—'
  }, [])

  const lineLabel = useCallback((node: BomTreeNode) => {
    if (node.itemCode && node.itemName) return `${node.itemCode} — ${node.itemName}`
    return node.itemName || node.itemCode || '—'
  }, [])

  const loadTree = useCallback(async (versionId: string) => {
    if (!versionId) {
      setVersion(null)
      setTree([])
      return
    }
    setTreeLoading(true)
    try {
      const treeRes = await getBomVersionTree(versionId)
      setVersion(treeRes.data.version)
      setTree(treeRes.data.tree)
      setExpanded(new Set(flattenTree(treeRes.data.tree).map((e) => e.node.id)))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load BOM structure')
      setVersion(null)
      setTree([])
    } finally {
      setTreeLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    if (!apiMode || !bomId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await getBom(bomId)
      const nextVersions = res.data.versions ?? []
      setBom(res.data)
      setVersions(nextVersions)
      const defaultId = pickDefaultVersionId(nextVersions)
      setSelectedVersionId(defaultId)
      if (defaultId) await loadTree(defaultId)
      else {
        setVersion(null)
        setTree([])
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load BOM')
      setBom(null)
    } finally {
      setLoading(false)
    }
  }, [apiMode, bomId, loadTree])

  useEffect(() => {
    if (perms.canViewSetup) void load()
    else setLoading(false)
  }, [load, perms.canViewSetup])

  const switchVersion = async (nextId: string) => {
    setSelectedVersionId(nextId)
    await loadTree(nextId)
  }

  const flatLines = useMemo(() => flattenTree(tree), [tree])
  const outlineIndexById = useMemo(() => buildBomOutlineIndexMap(tree), [tree])

  const stats = useMemo(() => {
    let make = 0
    let buy = 0
    let maxDepth = 0
    let flagged = 0
    for (const { node, depth } of flatLines) {
      if (node.makeOrBuy === 'MAKE') make += 1
      else buy += 1
      if (depth + 1 > maxDepth) maxDepth = depth + 1
      if (node.isOptional || node.phantomAssembly || node.qualityRequired) flagged += 1
    }
    return { total: flatLines.length, make, buy, maxDepth, flagged }
  }, [flatLines])

  const visibleLines = useMemo(() => {
    const q = treeSearch.trim().toLowerCase()
    const out: FlatEntry[] = []
    const matchesSelf = (n: BomTreeNode) => {
      if (!q) return true
      const outline = outlineIndexById.get(n.id) ?? ''
      const haystack = [
        outline,
        lineLabel(n),
        n.itemCode,
        n.itemName,
        n.lineType,
        n.makeOrBuy,
        bomLineDescription(n),
        n.descriptionOverride,
        n.notes,
        n.drawingReference,
        n.specification,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    }
    const hasMatchInside = (n: BomTreeNode): boolean => matchesSelf(n) || n.children.some(hasMatchInside)

    const walk = (nodes: BomTreeNode[], depth: number) => {
      for (const node of nodes) {
        if (q) {
          if (!hasMatchInside(node)) continue
          out.push({ node, depth })
          if (node.children.length) walk(node.children, depth + 1)
          continue
        }
        out.push({ node, depth })
        if (node.children.length && expanded.has(node.id)) walk(node.children, depth + 1)
      }
    }
    walk(tree, 0)
    return out
  }, [tree, expanded, treeSearch, lineLabel, outlineIndexById])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(flatLines.map((e) => e.node.id)))
  const collapseAll = () => setExpanded(new Set())

  const toggleActive = async () => {
    if (!bom || !perms.canManageBom) return
    setBusy(true)
    try {
      const next = bom.isActive ? await deactivateBom(bom.id) : await activateBom(bom.id)
      setBom((prev) => (prev ? { ...prev, ...next.data, versions: prev.versions } : next.data))
      notify.success(next.data.isActive ? 'BOM activated.' : 'BOM deactivated.')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!bom || !perms.canManageBom) return
    const ok = await appConfirm({
      title: 'Delete BOM?',
      description: `Delete ${bom.code}? This soft-deletes the BOM header.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteBom(bom.id)
      notify.success('BOM deleted.')
      navigate(LIST_PATH)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)

  if (!apiMode) {
    return (
      <ManufacturingSetupShell title="BOM" backLink={{ to: LIST_PATH, label: 'Back to BOMs' }} parentCrumb={{ label: 'BOMs', to: LIST_PATH }}>
        <EmptyState icon={Layers} title="API mode required" description="BOMs require VITE_USE_API=true." />
      </ManufacturingSetupShell>
    )
  }

  if (loading) {
    return (
      <ManufacturingSetupShell title="BOM" backLink={{ to: LIST_PATH, label: 'Back to BOMs' }} parentCrumb={{ label: 'BOMs', to: LIST_PATH }}>
        <LoadingState variant="form" rows={8} />
      </ManufacturingSetupShell>
    )
  }

  if (!bom) {
    return (
      <ManufacturingSetupShell title="Not found" backLink={{ to: LIST_PATH, label: 'Back to BOMs' }} parentCrumb={{ label: 'BOMs', to: LIST_PATH }}>
        <EmptyState icon={Layers} title="BOM not found" description="It may have been deleted." />
      </ManufacturingSetupShell>
    )
  }

  return (
    <ManufacturingSetupShell
      title={`${bom.code} — ${bom.name}`}
      description={
        bom.description?.trim()
          ? bom.description
          : 'Multi-level bill of material with revision control — index, description, and structure by level.'
      }
      backLink={{ to: LIST_PATH, label: 'Back to BOMs' }}
      parentCrumb={{ label: 'BOMs', to: LIST_PATH }}
      breadcrumbLabel={bom.code}
      actions={
        <div className="flex flex-wrap gap-2">
          <DynamicsStatusChip label={bom.isActive ? 'Active' : 'Inactive'} tone={bom.isActive ? 'success' : 'neutral'} />
          {perms.canManageBom ? (
            <>
              <ErpButton size="sm" variant="outline" loading={busy} onClick={() => void toggleActive()}>
                {bom.isActive ? 'Deactivate' : 'Activate'}
              </ErpButton>
              <ErpButton size="sm" variant="outline" loading={busy} onClick={() => void remove()}>
                Delete
              </ErpButton>
              <ErpButton
                size="sm"
                onClick={() =>
                  navigate(
                    selectedVersionId
                      ? `/manufacturing/setup/bom-versions/${selectedVersionId}`
                      : `/manufacturing/setup/boms/${bom.id}`,
                  )
                }
              >
                Edit
              </ErpButton>
            </>
          ) : (
            <ErpButton
              size="sm"
              variant="outline"
              onClick={() =>
                navigate(
                  selectedVersionId
                    ? `/manufacturing/setup/bom-versions/${selectedVersionId}`
                    : `/manufacturing/setup/boms/${bom.id}`,
                )
              }
            >
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
          icon={Layers}
          title="No revisions yet"
          description="Open the editor to create the first revision and add components."
          action={
            perms.canManageBom ? (
              <ErpButton size="sm" onClick={() => navigate(`/manufacturing/setup/boms/${bom.id}`)}>
                Open editor
              </ErpButton>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mb-4 overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-sm">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-erp-border bg-erp-surface-alt/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Revision</span>
                <Select
                  value={selectedVersionId}
                  onChange={(e) => void switchVersion(e.target.value)}
                  wrapClassName="w-44"
                  className="h-8 text-[12px]"
                >
                  {sortedVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Rev {v.revisionCode} (v{v.versionNumber}) — {v.status}
                    </option>
                  ))}
                </Select>
                {version ? <ErpStatusChip label={version.status} tone={VERSION_STATUS_TONE[version.status]} /> : null}
              </div>

              {version ? (
                <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px]">
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-erp-muted">Output</dt>
                    <dd className="max-w-[260px] truncate font-medium text-erp-text" title={productLabel(bom)}>
                      {productLabel(bom)}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-erp-muted">Base qty</dt>
                    <dd className="font-medium tabular-nums text-erp-text">
                      {formatQty(version.baseQuantity)} {uomLabel(version.baseUomId)}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-erp-muted">Expected yield</dt>
                    <dd className="font-medium tabular-nums text-erp-text">{formatQty(version.expectedYieldPercent)}%</dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-erp-muted">Effective from</dt>
                    <dd className="font-medium text-erp-text">{formatDate(version.effectiveFrom)}</dd>
                  </div>
                  {version.drawingRevision ? (
                    <div className="flex items-baseline gap-1.5">
                      <dt className="text-erp-muted">Drawing rev</dt>
                      <dd className="font-medium text-erp-text">{version.drawingRevision}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>

            {(bom.description?.trim() || version?.revisionNotes?.trim()) ? (
              <div className="space-y-1 border-b border-erp-border px-4 py-2.5 text-[12px]">
                {bom.description?.trim() ? (
                  <p className="text-erp-text">
                    <span className="font-semibold text-erp-muted">BOM description · </span>
                    {bom.description}
                  </p>
                ) : null}
                {version?.revisionNotes?.trim() ? (
                  <p className="text-erp-muted">
                    <span className="font-semibold">Revision notes · </span>
                    {version.revisionNotes}
                  </p>
                ) : null}
              </div>
            ) : null}

            <DynamicsKpiRow columns={4} className="border-0 px-3 py-2.5">
              <DynamicsKpiTile label="Components" value={stats.total} helper="All levels of this revision" tone="primary" />
              <DynamicsKpiTile label="Levels deep" value={stats.maxDepth} helper="Deepest branch in the structure" tone="neutral" />
              <DynamicsKpiTile label="Make / Buy" value={`${stats.make} / ${stats.buy}`} helper="In-house vs purchased lines" tone="success" />
              <DynamicsKpiTile
                label="Flagged lines"
                value={stats.flagged}
                helper="Optional, phantom or QC-required"
                tone={stats.flagged > 0 ? 'warning' : 'neutral'}
              />
            </DynamicsKpiRow>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SearchInput value={treeSearch} onChange={setTreeSearch} placeholder="Find by index, item, description…" className="w-72" />
            <ErpButton size="sm" variant="ghost" onClick={expandAll} disabled={flatLines.length === 0}>
              <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
              Expand all
            </ErpButton>
            <ErpButton size="sm" variant="ghost" onClick={collapseAll} disabled={flatLines.length === 0}>
              <ChevronsDownUp className="mr-1 h-3.5 w-3.5" />
              Collapse all
            </ErpButton>
            <span className="ml-auto text-[11px] tabular-nums text-erp-muted">
              {visibleLines.length} of {flatLines.length} lines
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-sm">
            {treeLoading ? (
              <div className="p-4">
                <LoadingState variant="table" rows={8} cols={8} />
              </div>
            ) : flatLines.length === 0 ? (
              <EmptyState icon={Layers} title="No components yet" description="This revision has no component lines." />
            ) : visibleLines.length === 0 ? (
              <EmptyState icon={Layers} title="No matches" description="No component matches the current search." />
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[1100px] text-left text-[12.5px]">
                  <thead>
                    <tr>
                      <th className="w-16">Index</th>
                      <th className="min-w-[220px]">Item</th>
                      <th className="min-w-[200px]">Description</th>
                      <th className="w-28">Drawing / Spec</th>
                      <th className="w-32">Type</th>
                      <th className="w-20 text-center">Source</th>
                      <th className="w-28 text-right">Qty / base</th>
                      <th className="w-20 text-right">Scrap %</th>
                      <th className="w-32">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLines.map(({ node, depth }) => {
                      const hasChildren = node.children.length > 0
                      const isExpanded = expanded.has(node.id) || Boolean(treeSearch.trim())
                      const meta = LINE_TYPE_META[node.lineType]
                      const TypeIcon = meta.icon
                      const outline = outlineIndexById.get(node.id) ?? String(node.sequence)
                      const description = bomLineDescription(node)
                      const drawingSpec = [node.drawingReference, node.specification].filter(Boolean).join(' · ') || '—'
                      const isAssembly = node.lineType === 'SUBASSEMBLY' || node.lineType === 'MANUFACTURED_COMPONENT'
                      return (
                        <tr
                          key={node.id}
                          className={cn(
                            'group transition-colors hover:bg-erp-primary-soft/20',
                            isAssembly && depth === 0 ? 'bg-slate-50/80' : null,
                          )}
                        >
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[12px] font-semibold tabular-nums text-erp-text">
                            {outline}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-stretch">
                              {Array.from({ length: depth }).map((_, i) => (
                                <span key={i} className="ml-[9px] w-[15px] shrink-0 border-l border-erp-border/60" aria-hidden />
                              ))}
                              <div className="flex min-w-0 items-center gap-1.5 py-0.5">
                                {hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(node.id)}
                                    className="rounded p-0.5 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                    aria-expanded={isExpanded}
                                  >
                                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  </button>
                                ) : (
                                  <span className="w-[18px]" aria-hidden />
                                )}
                                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', meta.className)}>
                                  <TypeIcon className="h-3.5 w-3.5" aria-hidden />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-erp-text" title={lineLabel(node)}>
                                    {node.itemName ?? lineLabel(node)}
                                  </span>
                                  <span className="block font-mono text-[10px] leading-tight text-erp-muted">
                                    {node.itemCode ?? '—'}
                                    {hasChildren ? ` · ${node.children.length} sub` : ''}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-[280px] px-3 py-1.5">
                            <span className="line-clamp-2 text-erp-text" title={description}>
                              {description}
                            </span>
                            {node.notes?.trim() && node.notes.trim() !== description ? (
                              <span className="mt-0.5 block line-clamp-1 text-[10.5px] text-erp-muted" title={node.notes}>
                                Note: {node.notes}
                              </span>
                            ) : null}
                          </td>
                          <td className="max-w-[140px] px-3 py-1.5 text-[11.5px] text-erp-muted">
                            <span className="line-clamp-2" title={drawingSpec}>
                              {drawingSpec}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            <LineBadge label={meta.label} className={meta.className} />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <LineBadge
                              label={node.makeOrBuy}
                              className={node.makeOrBuy === 'MAKE' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-800'}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                            <span className="font-semibold text-erp-text">{formatQty(node.quantity)}</span>{' '}
                            <span className="text-[11px] text-erp-muted">{uomLabel(node.uomId, node.uomCode)}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-erp-muted">
                            {Number(node.scrapPercent) > 0 ? `${formatQty(node.scrapPercent)}%` : '—'}
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {node.isOptional ? <LineBadge label="Optional" className="bg-slate-100 text-slate-600" /> : null}
                              {node.phantomAssembly ? <LineBadge label="Phantom" className="bg-purple-50 text-purple-700" /> : null}
                              {node.qualityRequired ? <LineBadge label="QC" className="bg-rose-50 text-rose-700" /> : null}
                              {node.childProductionOrderRequired ? (
                                <LineBadge label="Child WO" className="bg-sky-50 text-sky-700" />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </ManufacturingSetupShell>
  )
}
