import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Cog,
  Droplets,
  GitCompareArrows,
  Layers,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import { DynamicsKpiRow, DynamicsKpiTile } from '@/components/dynamics/DynamicsKpiTile'
import { Input, Select } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { AccountDrawerShell, AccountConfirmModal } from '@/components/accounting/coa/AccountDrawerShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import {
  activateBomVersion,
  compareBomVersions,
  createBomLine,
  deleteBomLine,
  getBom,
  getBomVersionTree,
  reviseBomVersion,
  updateBomLine,
  validateBomVersion,
  type BomImportResult,
} from '@/services/api/manufacturingApi'
import {
  BOM_LINE_TYPE_VALUES,
  MAKE_OR_BUY_VALUES,
  type Bom,
  type BomCompareResult,
  type BomLineType,
  type BomTreeNode,
  type BomVersion,
  type MakeOrBuy,
  type ManufacturingVersionStatus,
  type ValidationResult,
} from '@/types/manufacturingSetup'
import { isApiMode } from '@/config/apiConfig'
import { useManufacturingSetupPermissions } from '@/utils/permissions/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { appConfirm } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { ManufacturingSetupShell } from '../ManufacturingSetupShell'
import { useSetupLookup } from '../useSetupLookups'
import { BomCsvImportDialog } from './BomCsvImportDialog'

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

interface ComponentFormState {
  parentLineId: string
  itemId: string
  quantity: string
  uomId: string
  makeOrBuy: MakeOrBuy
  lineType: BomLineType
  scrapPercent: string
}

const EMPTY_COMPONENT_FORM: ComponentFormState = {
  parentLineId: '',
  itemId: '',
  quantity: '1',
  uomId: '',
  makeOrBuy: 'MAKE',
  lineType: 'RAW_MATERIAL',
  scrapPercent: '0',
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

/** Tiny inline badge used for make/buy + line flags — lighter than a full status chip per row. */
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

export function BomVersionEditorPage() {
  const { bomId: bomIdParam, versionId: versionIdParam } = useParams<{ bomId?: string; versionId?: string }>()
  const navigate = useNavigate()
  const perms = useManufacturingSetupPermissions()
  const apiMode = isApiMode()
  const { options: items } = useSetupLookup('items')
  const { options: uoms } = useSetupLookup('uom')

  const [bom, setBom] = useState<Bom | null>(null)
  const [versions, setVersions] = useState<BomVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')
  const [tree, setTree] = useState<BomTreeNode[]>([])
  const [version, setVersion] = useState<BomVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [treeSearch, setTreeSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState<ComponentFormState>(EMPTY_COMPONENT_FORM)
  const [editingLine, setEditingLine] = useState<BomTreeNode | null>(null)
  const [saving, setSaving] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo] = useState('')
  const [compareResult, setCompareResult] = useState<BomCompareResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [removingLineId, setRemovingLineId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const itemLabel = useCallback((id: string) => items.find((i) => i.id === id)?.label ?? `${id.slice(0, 8)}…`, [items])
  const uomLabel = useCallback((id: string) => {
    const label = uoms.find((u) => u.id === id)?.label ?? id.slice(0, 8)
    // Lookup labels come as "CODE — Name"; the code alone reads better next to a quantity.
    return label.split('—')[0]?.trim() ?? label
  }, [uoms])

  const formatDiffLine = useCallback(
    (d: BomCompareResult['added'][number]) => {
      if (d.summary) return d.summary
      if (!d.from && d.to) return `Added ${itemLabel(d.itemId)} — quantity ${d.to.quantity} ${uomLabel(d.to.uomId)}.`
      if (d.from && !d.to) return `Removed ${itemLabel(d.itemId)} — was ${d.from.quantity} ${uomLabel(d.from.uomId)}.`
      if (d.from && d.to) {
        return `${itemLabel(d.itemId)} quantity changed from ${d.from.quantity} ${uomLabel(d.from.uomId)} to ${d.to.quantity} ${uomLabel(d.to.uomId)}.`
      }
      return itemLabel(d.itemId)
    },
    [itemLabel, uomLabel],
  )

  const loadVersionDetail = useCallback(async (versionId: string) => {
    const treeRes = await getBomVersionTree(versionId)
    setVersion(treeRes.data.version)
    setTree(treeRes.data.tree)
    setExpanded(new Set(flattenTree(treeRes.data.tree).map((e) => e.node.id)))
  }, [])

  const loadAll = useCallback(async () => {
    if (!apiMode) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      let resolvedBomId = bomIdParam
      let resolvedVersionId = versionIdParam

      if (resolvedVersionId && !resolvedBomId) {
        const treeRes = await getBomVersionTree(resolvedVersionId)
        resolvedBomId = treeRes.data.version.bomId
      }

      if (!resolvedBomId) return
      const bomRes = await getBom(resolvedBomId)
      setBom(bomRes.data)
      setVersions(bomRes.data.versions)

      if (!resolvedVersionId) {
        const active = bomRes.data.versions.find((v) => v.status === 'ACTIVE')
        const latest = [...bomRes.data.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]
        resolvedVersionId = (active ?? latest)?.id
      }
      if (resolvedVersionId) {
        setSelectedVersionId(resolvedVersionId)
        await loadVersionDetail(resolvedVersionId)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load BOM')
    } finally {
      setLoading(false)
    }
  }, [apiMode, bomIdParam, versionIdParam, loadVersionDetail])

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomIdParam, versionIdParam])

  const switchVersion = async (versionId: string) => {
    setSelectedVersionId(versionId)
    setValidation(null)
    setLoading(true)
    try {
      await loadVersionDetail(versionId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load version')
    } finally {
      setLoading(false)
    }
  }

  const flatLines = useMemo(() => flattenTree(tree), [tree])
  const isDraft = version?.status === 'DRAFT'
  const canEdit = isDraft && perms.canManageBom

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

  /** Rows actually rendered: collapse hides descendants; searching shows matches with their ancestor chain. */
  const visibleLines = useMemo(() => {
    const q = treeSearch.trim().toLowerCase()
    const out: FlatEntry[] = []
    const matchesSelf = (n: BomTreeNode) =>
      itemLabel(n.itemId).toLowerCase().includes(q) || n.lineType.toLowerCase().includes(q)
    const hasMatchInside = (n: BomTreeNode): boolean => matchesSelf(n) || n.children.some(hasMatchInside)

    const walk = (nodes: BomTreeNode[], depth: number) => {
      for (const node of nodes) {
        if (q) {
          if (!hasMatchInside(node)) continue
          out.push({ node, depth })
          walk(node.children, depth + 1)
        } else {
          out.push({ node, depth })
          if (expanded.has(node.id)) walk(node.children, depth + 1)
        }
      }
    }
    walk(tree, 0)
    return out
  }, [tree, expanded, treeSearch, itemLabel])

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

  const openAddComponent = (parentLineId?: string) => {
    setEditingLine(null)
    setForm({ ...EMPTY_COMPONENT_FORM, parentLineId: parentLineId ?? '' })
    setDrawerOpen(true)
  }

  const openEditComponent = (node: BomTreeNode) => {
    setEditingLine(node)
    setForm({
      parentLineId: node.parentLineId ?? '',
      itemId: node.itemId,
      quantity: node.quantity,
      uomId: node.uomId,
      makeOrBuy: node.makeOrBuy,
      lineType: node.lineType,
      scrapPercent: node.scrapPercent ?? '0',
    })
    setDrawerOpen(true)
  }

  const saveComponent = async () => {
    if (!selectedVersionId) return
    setSaving(true)
    try {
      if (editingLine) {
        await updateBomLine(editingLine.id, {
          quantity: Number(form.quantity) || 0,
          uomId: form.uomId,
          makeOrBuy: form.makeOrBuy,
          lineType: form.lineType,
          scrapPercent: Number(form.scrapPercent) || 0,
        })
        notify.success('Component updated.')
      } else {
        await createBomLine(selectedVersionId, {
          parentLineId: form.parentLineId || undefined,
          itemId: form.itemId,
          quantity: Number(form.quantity) || 0,
          uomId: form.uomId,
          makeOrBuy: form.makeOrBuy,
          lineType: form.lineType,
          scrapPercent: Number(form.scrapPercent) || 0,
        })
        notify.success('Component added.')
      }
      setDrawerOpen(false)
      await loadVersionDetail(selectedVersionId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : editingLine ? 'Failed to update component' : 'Failed to add component')
    } finally {
      setSaving(false)
    }
  }

  const runValidate = async () => {
    if (!selectedVersionId) return
    setValidating(true)
    try {
      const res = await validateBomVersion(selectedVersionId)
      setValidation(res.data)
      if (res.data.valid) notify.success('BOM version is valid.')
      else notify.warning(`${res.data.errors.length} validation issue(s) found.`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const runActivate = async () => {
    if (!selectedVersionId) return
    const ok = await appConfirm({
      title: 'Activate BOM version',
      description: 'Activate this BOM version? It will supersede any prior active version and become immutable.',
      confirmLabel: 'Activate',
    })
    if (!ok) return
    setBusy(true)
    try {
      await activateBomVersion(selectedVersionId)
      notify.success('BOM version activated.')
      await loadAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Activation failed')
    } finally {
      setBusy(false)
    }
  }

  const runRevise = async () => {
    if (!selectedVersionId) return
    setBusy(true)
    try {
      const res = await reviseBomVersion(selectedVersionId)
      notify.success('New draft revision created.')
      navigate(`/manufacturing/setup/bom-versions/${res.data.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Revision failed')
    } finally {
      setBusy(false)
    }
  }

  const openCompare = () => {
    setCompareFrom(versions.filter((v) => v.id !== selectedVersionId)[0]?.id ?? '')
    setCompareTo(selectedVersionId)
    setCompareResult(null)
    setCompareOpen(true)
  }

  const runCompare = async () => {
    if (!compareFrom || !compareTo) return
    setComparing(true)
    try {
      const res = await compareBomVersions(compareFrom, compareFrom, compareTo)
      setCompareResult(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Comparison failed')
    } finally {
      setComparing(false)
    }
  }

  const runRemoveLine = async (lineId: string, hasChildren: boolean) => {
    const ok = await appConfirm({
      title: 'Remove component',
      description: hasChildren
        ? 'Remove this component and all of its child components from the draft?'
        : 'Remove this component from the draft?',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setRemovingLineId(lineId)
    try {
      await deleteBomLine(lineId)
      notify.success('Component removed.')
      if (selectedVersionId) await loadVersionDetail(selectedVersionId)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemovingLineId(null)
    }
  }

  const imported = (result: BomImportResult) => {
    setImportOpen(false)
    const created = result.created[0]
    notify.success(`Imported ${result.importedLineCount} component lines into a new Draft revision.`)
    if (created) navigate(`/manufacturing/setup/bom-versions/${created.versionId}`)
  }

  if (!apiMode) {
    return <ManufacturingSetupShell title="BOM Editor">{null}</ManufacturingSetupShell>
  }

  if (loading) {
    return (
      <ManufacturingSetupShell title="BOM Editor">
        <LoadingState variant="form" rows={8} />
      </ManufacturingSetupShell>
    )
  }

  if (!bom || !version) {
    return (
      <ManufacturingSetupShell title="BOM Editor">
        <EmptyState icon={Layers} title="BOM not found" description="This BOM or version could not be loaded." />
      </ManufacturingSetupShell>
    )
  }

  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)

  return (
    <ManufacturingSetupShell
      title={`${bom.code} — ${bom.name}`}
      description="Multi-level bill of material with revision control."
      actions={
        <div className="flex flex-wrap gap-2">
          {perms.canImportBom ? (
            <ErpButton size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-3.5 w-3.5" />
              Import Draft Revision
            </ErpButton>
          ) : null}
          <ErpButton size="sm" variant="outline" loading={validating} onClick={() => void runValidate()}>
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Validate
          </ErpButton>
          <ErpButton size="sm" variant="outline" onClick={openCompare} disabled={versions.length < 2}>
            <GitCompareArrows className="mr-1 h-3.5 w-3.5" />
            Compare
          </ErpButton>
          {isDraft && perms.canActivateBom ? (
            <ErpButton size="sm" loading={busy} onClick={() => void runActivate()}>
              Activate
            </ErpButton>
          ) : null}
          {!isDraft && perms.canManageBom ? (
            <ErpButton size="sm" loading={busy} onClick={() => void runRevise()}>
              Create Revision
            </ErpButton>
          ) : null}
        </div>
      }
    >
      {/* Revision overview band */}
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
            <ErpStatusChip label={version.status} tone={VERSION_STATUS_TONE[version.status]} />
          </div>

          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px]">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-erp-muted">Output</dt>
              <dd className="max-w-[260px] truncate font-medium text-erp-text" title={itemLabel(bom.productItemId)}>
                {itemLabel(bom.productItemId)}
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
          </dl>

          {canEdit ? (
            <ErpButton size="sm" className="ml-auto" onClick={() => openAddComponent()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Component
            </ErpButton>
          ) : null}
        </div>

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

      {!isDraft ? (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            This revision is <strong>{version.status}</strong> and read-only. Use <strong>Create Revision</strong> to
            make a new editable draft.
          </span>
        </div>
      ) : null}

      {validation ? (
        <div
          className={cn(
            'mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]',
            validation.valid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900',
          )}
        >
          {validation.valid ? (
            <>
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Valid — {validation.lineCount ?? flatLines.length} component line(s), ready to activate.</span>
            </>
          ) : (
            <>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">{validation.errors.length} issue(s) to resolve:</p>
                <ul className="ml-4 mt-0.5 list-disc space-y-0.5">
                  {validation.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Tree toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SearchInput value={treeSearch} onChange={setTreeSearch} placeholder="Find component…" className="w-64" />
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

      {/* Multi-level structure grid */}
      <div className="overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-sm">
        {flatLines.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No components yet"
            description={
              canEdit
                ? 'Add the first component to this draft, or import the full structure from CSV.'
                : 'This revision has no component lines.'
            }
            action={
              canEdit ? (
                <ErpButton size="sm" onClick={() => openAddComponent()}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Component
                </ErpButton>
              ) : undefined
            }
          />
        ) : visibleLines.length === 0 ? (
          <EmptyState icon={Layers} title="No matches" description="No component matches the current search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[880px] text-left text-[12.5px]">
              <thead>
                <tr>
                  <th>Component</th>
                  <th className="w-36">Type</th>
                  <th className="w-20 text-center">Source</th>
                  <th className="w-28 text-right">Qty / base</th>
                  <th className="w-20 text-right">Scrap %</th>
                  <th className="w-32">Flags</th>
                  {canEdit ? <th className="w-28 text-right" aria-label="Actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {visibleLines.map(({ node, depth }) => {
                  const hasChildren = node.children.length > 0
                  const isExpanded = expanded.has(node.id) || Boolean(treeSearch.trim())
                  const meta = LINE_TYPE_META[node.lineType]
                  const TypeIcon = meta.icon
                  return (
                    <tr key={node.id} className="group transition-colors hover:bg-erp-primary-soft/20">
                      <td className="px-3 py-1.5">
                        <div className="flex items-stretch">
                          {/* Indent guides */}
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
                            <span
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                                meta.className,
                              )}
                            >
                              <TypeIcon className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-erp-text">{itemLabel(node.itemId)}</span>
                              <span className="block font-mono text-[10px] leading-tight text-erp-muted">
                                #{node.sequence} · L{depth + 1}
                                {hasChildren ? ` · ${node.children.length} sub` : ''}
                              </span>
                            </span>
                          </div>
                        </div>
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
                        <span className="text-[11px] text-erp-muted">{uomLabel(node.uomId)}</span>
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
                      {canEdit ? (
                        <td className="px-3 py-1.5">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => openAddComponent(node.id)}
                              className="rounded p-1 text-erp-primary hover:bg-erp-primary-soft"
                              title="Add sub-component"
                              aria-label={`Add sub-component under ${itemLabel(node.itemId)}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditComponent(node)}
                              className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                              title="Edit line"
                              aria-label={`Edit ${itemLabel(node.itemId)}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={removingLineId === node.id}
                              onClick={() => void runRemoveLine(node.id, hasChildren)}
                              className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Remove line"
                              aria-label={`Remove ${itemLabel(node.itemId)}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / edit component drawer */}
      <AccountDrawerShell
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingLine ? 'Edit Component' : 'Add Component'}
        eyebrow="BOM Draft"
        footer={
          <div className="flex justify-end gap-2">
            <ErpButton variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </ErpButton>
            <ErpButton
              loading={saving}
              disabled={!editingLine && (!form.itemId || !form.uomId)}
              onClick={() => void saveComponent()}
            >
              {editingLine ? 'Save' : 'Add'}
            </ErpButton>
          </div>
        }
      >
        <div className="space-y-3">
          {editingLine ? (
            <div className="rounded-md border border-erp-border bg-erp-surface-alt/50 px-3 py-2 text-[12px]">
              <span className="block font-medium text-erp-text">{itemLabel(editingLine.itemId)}</span>
              <span className="text-erp-muted">
                Line #{editingLine.sequence} · level {editingLine.level}
              </span>
            </div>
          ) : (
            <>
              <FormField label="Parent">
                <Select value={form.parentLineId} onChange={(e) => setForm((f) => ({ ...f, parentLineId: e.target.value }))}>
                  <option value="">— Root (top-level) —</option>
                  {flatLines.map(({ node, depth }) => (
                    <option key={node.id} value={node.id}>
                      {'—'.repeat(depth)} #{node.sequence} {itemLabel(node.itemId)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Item" required hint={items.length === 0 ? 'Paste the item UUID (item lookup unavailable).' : undefined}>
                {items.length > 0 ? (
                  <Select value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}>
                    <option value="">Select item…</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value.trim() }))} placeholder="Item UUID" />
                )}
              </FormField>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantity" required>
              <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </FormField>
            <FormField label="Scrap %">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.scrapPercent}
                onChange={(e) => setForm((f) => ({ ...f, scrapPercent: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="UOM" required hint={uoms.length === 0 ? 'Paste the UOM UUID (lookup unavailable).' : undefined}>
            {uoms.length > 0 ? (
              <Select value={form.uomId} onChange={(e) => setForm((f) => ({ ...f, uomId: e.target.value }))}>
                <option value="">Select UOM…</option>
                {uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={form.uomId} onChange={(e) => setForm((f) => ({ ...f, uomId: e.target.value.trim() }))} placeholder="UOM UUID" />
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Make / Buy">
              <Select value={form.makeOrBuy} onChange={(e) => setForm((f) => ({ ...f, makeOrBuy: e.target.value as MakeOrBuy }))}>
                {MAKE_OR_BUY_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Line Type">
              <Select value={form.lineType} onChange={(e) => setForm((f) => ({ ...f, lineType: e.target.value as BomLineType }))}>
                {BOM_LINE_TYPE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {LINE_TYPE_META[v].label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>
      </AccountDrawerShell>

      {/* Compare revisions */}
      <AccountConfirmModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Compare BOM Revisions"
        confirmLabel="Close"
        onConfirm={() => setCompareOpen(false)}
      >
        <div className="mt-3 space-y-3 text-left">
          <div className="flex gap-2">
            <FormField label="From" className="flex-1">
              <Select value={compareFrom} onChange={(e) => setCompareFrom(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Rev {v.revisionCode} (v{v.versionNumber})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="To" className="flex-1">
              <Select value={compareTo} onChange={(e) => setCompareTo(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Rev {v.revisionCode} (v{v.versionNumber})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <ErpButton size="sm" loading={comparing} onClick={() => void runCompare()}>
            <GitCompareArrows className="mr-1 h-3.5 w-3.5" />
            Compare
          </ErpButton>
          {compareResult ? (
            <div className="space-y-2 text-[12.5px]">
              <div className="flex flex-wrap gap-1.5">
                <LineBadge label={`${compareResult.added.length} added`} className="bg-emerald-50 text-emerald-700" />
                <LineBadge label={`${compareResult.removed.length} removed`} className="bg-red-50 text-red-700" />
                <LineBadge label={`${compareResult.changed.length} changed`} className="bg-amber-50 text-amber-800" />
                <LineBadge label={`${compareResult.unchanged} unchanged`} className="bg-slate-100 text-slate-600" />
              </div>
              {(compareResult.summaries?.length ?? 0) > 0 ? (
                <ul className="ml-4 list-disc space-y-1">
                  {compareResult.summaries!.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <>
                  {compareResult.added.length > 0 ? (
                    <div>
                      <p className="font-semibold text-emerald-700">Added</p>
                      <ul className="ml-4 list-disc">
                        {compareResult.added.map((d) => (
                          <li key={`add-${d.itemId}-${d.to?.sequence ?? 0}`}>{formatDiffLine(d)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {compareResult.removed.length > 0 ? (
                    <div>
                      <p className="font-semibold text-red-700">Removed</p>
                      <ul className="ml-4 list-disc">
                        {compareResult.removed.map((d) => (
                          <li key={`rem-${d.itemId}-${d.from?.sequence ?? 0}`}>{formatDiffLine(d)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {compareResult.changed.length > 0 ? (
                    <div>
                      <p className="font-semibold text-amber-700">Changed</p>
                      <ul className="ml-4 list-disc">
                        {compareResult.changed.map((d) => (
                          <li key={`chg-${d.itemId}-${d.from?.sequence ?? 0}`}>{formatDiffLine(d)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </AccountConfirmModal>
      <BomCsvImportDialog
        open={importOpen}
        restrictBomCode={bom.code}
        onClose={() => setImportOpen(false)}
        onImported={imported}
      />
    </ManufacturingSetupShell>
  )
}
