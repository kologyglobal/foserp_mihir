import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Send,
  ShieldOff,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, Input } from '@/components/forms/Inputs'
import { StockCountDemoBanner, StockCountStatusBadge } from '@/components/inventory/stockCount'
import {
  approveStockVarianceDemo,
  createStockCountSnapshot,
  getStockCountById,
  getStockAdjustmentPreview,
  postStockCountAdjustmentDemo,
  refreshSystemQuantities,
  rejectStockVarianceDemo,
  requestRecountDemo,
  revealSystemQuantityDemo,
  saveRecountDemo,
  saveStockCount,
  StockCountServiceError,
  STOCK_COUNT_HIGH_VALUE_THRESHOLD,
  STOCK_COUNT_VARIANCE_TOLERANCE_QTY,
  submitStockCount,
} from '@/services/inventory'
import type {
  StockCount,
  StockCountLine,
  StockCountScopeInput,
  StockCountType,
} from '@/types/inventoryDomain'
import {
  STOCK_COUNT_TYPE_LABELS,
  STOCK_COUNT_WORKBENCH_STEPS,
} from '@/utils/stockCountLabels'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useMasterStore } from '@/store/masterStore'
import { cn } from '@/utils/cn'

const COUNT_TYPES: StockCountType[] = [
  'full_physical',
  'warehouse',
  'category',
  'item',
  'bin',
  'batch',
  'cycle',
]

const TEAM_OPTIONS = ['Ramesh Kumar', 'Suresh Patel', 'Vijay Singh', 'Anita Desai']

function stockCountErr(e: unknown, fallback: string): string {
  return e instanceof StockCountServiceError ? e.message : fallback
}

type ScopeForm = {
  countType: StockCountType
  warehouseId: string
  categoryId: string
  itemId: string
  binLocationId: string
  binCode: string
  batchNo: string
  countDate: string
  assignedTeam: string[]
  blindCount: boolean
}

const defaultScope = (): ScopeForm => ({
  countType: 'warehouse',
  warehouseId: '',
  categoryId: '',
  itemId: '',
  binLocationId: '',
  binCode: '',
  batchNo: '',
  countDate: new Date().toISOString().slice(0, 10),
  assignedTeam: [TEAM_OPTIONS[0]],
  blindCount: false,
})

export function StockCountWorkbenchPage({ mode }: { mode: 'new' | 'detail' }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const warehouses = useMasterStore((s) => s.warehouses.filter((w) => w.isActive))
  const categories = useMasterStore((s) => s.categories.filter((c) => c.isActive))
  const items = useMasterStore((s) => s.items.filter((i) => i.isStockable && i.isActive))
  const locations = useMasterStore((s) => s.locations.filter((l) => l.isActive))

  const [count, setCount] = useState<StockCount | null>(null)
  const [scopeForm, setScopeForm] = useState<ScopeForm>(defaultScope)
  const [lineEdits, setLineEdits] = useState<Record<string, { countedQty: string; reason: string }>>({})
  const [recountEdits, setRecountEdits] = useState<Record<string, { recountQty: string; reason: string }>>({})
  const [revealReason, setRevealReason] = useState<Record<string, string>>({})
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(mode === 'detail')
  const [busy, setBusy] = useState(false)
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null)

  const isNew = mode === 'new'
  const readOnly = count?.status === 'posted' || count?.status === 'cancelled'
  const quickCountMode = perms.canCountStock && !perms.canReviewStockCount
  const supervisorMode = perms.canReviewStockCount

  const currentStep = count?.currentStep ?? 1

  const loadCount = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const row = await getStockCountById(id)
      setCount(row)
      if (row) {
        const edits: Record<string, { countedQty: string; reason: string }> = {}
        for (const line of row.lines) {
          edits[line.id] = {
            countedQty: line.countedQty !== null ? String(line.countedQty) : '',
            reason: line.reason,
          }
        }
        setLineEdits(edits)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void loadCount() }, [loadCount])

  const scopeInput = (): StockCountScopeInput => ({
    countType: scopeForm.countType,
    warehouseId: scopeForm.warehouseId,
    categoryId: scopeForm.categoryId || null,
    itemId: scopeForm.itemId || null,
    binLocationId: scopeForm.binLocationId || null,
    binCode: scopeForm.binCode || null,
    batchNo: scopeForm.batchNo || null,
    countDate: scopeForm.countDate,
    assignedTeam: scopeForm.assignedTeam,
    blindCount: scopeForm.blindCount,
  })

  const createSnapshot = async () => {
    if (!scopeForm.warehouseId) {
      notify.error('Select a warehouse')
      return
    }
    setBusy(true)
    try {
      const created = await createStockCountSnapshot(scopeInput())
      setSnapshotMsg('Stock snapshot created in frontend demo mode.')
      notify.success(created.countNumber + ' — snapshot created (demo)')
      navigate(`/inventory/stock-count/${created.id}`, { replace: true })
    } catch (e) {
      notify.error(stockCountErr(e, 'Snapshot failed'))
    } finally {
      setBusy(false)
    }
  }

  const saveLines = async () => {
    if (!count) return
    setBusy(true)
    try {
      const inputs = count.lines.map((line) => ({
        lineId: line.id,
        countedQty: Number(lineEdits[line.id]?.countedQty ?? 0),
        reason: lineEdits[line.id]?.reason,
      }))
      const updated = await saveStockCount(count.id, inputs)
      setCount(updated)
      notify.success('Quantities saved')
    } catch (e) {
      notify.error(stockCountErr(e, 'Save failed'))
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!count) return
    setBusy(true)
    try {
      await saveLines()
      const updated = await submitStockCount(count.id)
      setCount(updated)
      notify.success('Stock count submitted')
    } catch (e) {
      notify.error(stockCountErr(e, 'Submit failed'))
    } finally {
      setBusy(false)
    }
  }

  const handleRecount = async () => {
    if (!count) return
    setBusy(true)
    try {
      const updated = await requestRecountDemo(count.id)
      setCount(updated)
      notify.info('Recount requested')
    } catch (e) {
      notify.error(stockCountErr(e, 'Recount request failed'))
    } finally {
      setBusy(false)
    }
  }

  const saveRecount = async () => {
    if (!count) return
    setBusy(true)
    try {
      const inputs = count.lines
        .filter((l) => l.lineStatus === 'recount_required')
        .map((l) => ({
          lineId: l.id,
          recountQty: Number(recountEdits[l.id]?.recountQty ?? lineEdits[l.id]?.countedQty ?? 0),
          reason: recountEdits[l.id]?.reason ?? lineEdits[l.id]?.reason,
        }))
      const updated = await saveRecountDemo(count.id, inputs)
      setCount(updated)
      notify.success('Recount saved')
    } catch (e) {
      notify.error(stockCountErr(e, 'Recount save failed'))
    } finally {
      setBusy(false)
    }
  }

  const approve = async () => {
    if (!count) return
    setBusy(true)
    try {
      const updated = await approveStockVarianceDemo(count.id)
      setCount(updated)
      notify.success('Variance approved (demo)')
    } catch (e) {
      notify.error(stockCountErr(e, 'Approval failed'))
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    if (!count) return
    setBusy(true)
    try {
      const updated = await rejectStockVarianceDemo(count.id, rejectReason)
      setCount(updated)
      notify.warning('Variance rejected')
    } catch (e) {
      notify.error(stockCountErr(e, 'Reject failed'))
    } finally {
      setBusy(false)
    }
  }

  const buildPreview = async () => {
    if (!count) return
    setBusy(true)
    try {
      const preview = await getStockAdjustmentPreview(count.id)
      const updated = await getStockCountById(count.id)
      setCount(updated)
      notify.success(`Preview: ${formatCurrency(preview.totalValueImpact)} impact (${preview.lines.length} lines)`)
    } catch (e) {
      notify.error(stockCountErr(e, 'Preview failed'))
    } finally {
      setBusy(false)
    }
  }

  const postDemo = async () => {
    if (!count) return
    setBusy(true)
    try {
      const updated = await postStockCountAdjustmentDemo(count.id)
      setCount(updated)
      notify.success('Posted in demo mode — no real stock adjustment')
    } catch (e) {
      notify.error(stockCountErr(e, 'Post failed'))
    } finally {
      setBusy(false)
    }
  }

  const revealSystemQty = async (lineId: string) => {
    if (!count) return
    const reason = revealReason[lineId]?.trim()
    if (!reason) {
      notify.error('Enter a reason to reveal system quantity')
      return
    }
    setBusy(true)
    try {
      const updated = await revealSystemQuantityDemo(count.id, lineId, reason)
      setCount(updated)
    } catch (e) {
      notify.error(stockCountErr(e, 'Reveal failed'))
    } finally {
      setBusy(false)
    }
  }

  const refreshSystem = async () => {
    if (!count) return
    setBusy(true)
    try {
      const updated = await refreshSystemQuantities(count.id)
      setCount(updated)
    } finally {
      setBusy(false)
    }
  }

  const showSystemQty = (line: StockCountLine): boolean => {
    if (!count?.scope.blindCount) return true
    if (supervisorMode) return true
    if (line.systemQtyRevealed) return true
    if (count.status !== 'counting' && count.status !== 'draft') return supervisorMode
    return false
  }

  const breadcrumbs = [
    { label: 'Inventory & Warehouse', to: '/inventory' },
    { label: 'Stock Count', to: '/inventory/stock-count' },
    { label: isNew ? 'New' : count?.countNumber ?? '…' },
  ]

  if (!perms.canViewStockCount && !perms.canCreateStockCount) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Inventory & Warehouse" title="Stock Count" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing stock count permission." />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Inventory & Warehouse" title="Stock Count" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="card" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={isNew ? 'New Stock Count' : count?.countNumber ?? 'Stock Count'}
      description={count ? `${STOCK_COUNT_TYPE_LABELS[count.scope.countType]} · ${count.scope.warehouseName}` : 'Define count scope and create a stock snapshot'}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={count ? `/inventory/stock-count/${count.id}` : '/inventory/stock-count/new'}
      commandBar={count ? (
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'Back to Register', icon: ArrowLeft, onClick: () => navigate('/inventory/stock-count') },
            ...(supervisorMode && !readOnly ? [{ id: 'refresh-sys', label: 'Refresh System Qty', icon: RefreshCw, onClick: () => void refreshSystem() }] : []),
          ]}
        />
      ) : undefined}
    >
      <StockCountDemoBanner />

      {count ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <StockCountStatusBadge status={count.status} />
          {count.scope.blindCount ? <span className="text-[12px] font-semibold text-slate-600">Blind count</span> : null}
          {readOnly ? <span className="text-[12px] text-erp-muted">Read-only</span> : null}
        </div>
      ) : null}

      {/* Step strip */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max gap-1">
          {STOCK_COUNT_WORKBENCH_STEPS.map((s) => (
            <div
              key={s.id}
              className={cn(
                'rounded-md px-3 py-2 text-[12px] font-medium',
                currentStep === s.step
                  ? 'bg-erp-primary text-white'
                  : currentStep > s.step
                    ? 'bg-green-50 text-green-800'
                    : 'bg-erp-surface-muted text-erp-muted',
              )}
            >
              <span className="mr-1 opacity-70">{s.step}.</span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1 — Scope (new only or draft) */}
      {(isNew || (count?.status === 'draft' && currentStep <= 1)) && perms.canCreateStockCount ? (
        <section className="crm-masters-card mb-6 rounded-lg border border-erp-border bg-erp-surface p-5 shadow-[var(--erp-shadow-card)]">
          <h2 className="text-[15px] font-semibold text-erp-text">Step 1 — Count Scope</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-[13px]">
              <span className="mb-1 block text-erp-muted">Count Type</span>
              <Select value={scopeForm.countType} onChange={(e) => setScopeForm((f) => ({ ...f, countType: e.target.value as StockCountType }))}>
                {COUNT_TYPES.map((t) => <option key={t} value={t}>{STOCK_COUNT_TYPE_LABELS[t]}</option>)}
              </Select>
            </label>
            <label className="block text-[13px]">
              <span className="mb-1 block text-erp-muted">Warehouse</span>
              <Select value={scopeForm.warehouseId} onChange={(e) => setScopeForm((f) => ({ ...f, warehouseId: e.target.value }))}>
                <option value="">Select warehouse</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouseName}</option>)}
              </Select>
            </label>
            {['category', 'full_physical'].includes(scopeForm.countType) || scopeForm.countType === 'category' ? (
              <label className="block text-[13px]">
                <span className="mb-1 block text-erp-muted">Item Category</span>
                <Select value={scopeForm.categoryId} onChange={(e) => setScopeForm((f) => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
                </Select>
              </label>
            ) : null}
            {scopeForm.countType === 'item' ? (
              <label className="block text-[13px]">
                <span className="mb-1 block text-erp-muted">Item</span>
                <Select value={scopeForm.itemId} onChange={(e) => setScopeForm((f) => ({ ...f, itemId: e.target.value }))}>
                  <option value="">Select item</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.itemName}</option>)}
                </Select>
              </label>
            ) : null}
            {scopeForm.countType === 'bin' ? (
              <>
                <label className="block text-[13px]">
                  <span className="mb-1 block text-erp-muted">Bin / Location</span>
                  <Select value={scopeForm.binLocationId} onChange={(e) => {
                    const loc = locations.find((l) => l.id === e.target.value)
                    setScopeForm((f) => ({ ...f, binLocationId: e.target.value, binCode: loc?.locationCode ?? '' }))
                  }}>
                    <option value="">Select bin</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.locationCode}</option>)}
                  </Select>
                </label>
              </>
            ) : null}
            {scopeForm.countType === 'batch' ? (
              <label className="block text-[13px]">
                <span className="mb-1 block text-erp-muted">Batch Number</span>
                <Input value={scopeForm.batchNo} onChange={(e) => setScopeForm((f) => ({ ...f, batchNo: e.target.value }))} placeholder="B-ITEM-001" />
              </label>
            ) : null}
            <label className="block text-[13px]">
              <span className="mb-1 block text-erp-muted">Count Date</span>
              <Input type="date" value={scopeForm.countDate} onChange={(e) => setScopeForm((f) => ({ ...f, countDate: e.target.value }))} />
            </label>
            <label className="block text-[13px]">
              <span className="mb-1 block text-erp-muted">Assigned Team</span>
              <Select
                value={scopeForm.assignedTeam[0]}
                onChange={(e) => setScopeForm((f) => ({ ...f, assignedTeam: [e.target.value] }))}
              >
                {TEAM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </label>
            <label className="flex items-center gap-2 self-end text-[13px]">
              <input
                type="checkbox"
                checked={scopeForm.blindCount}
                onChange={(e) => setScopeForm((f) => ({ ...f, blindCount: e.target.checked }))}
              />
              Blind Count (hide system qty from counters)
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" disabled={busy} onClick={() => void createSnapshot()}>
              Step 2 — Create Snapshot
            </button>
          </div>
        </section>
      ) : null}

      {snapshotMsg ? (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">{snapshotMsg}</p>
      ) : null}

      {count && count.snapshotAt && !quickCountMode ? (
        <p className="mb-4 text-[13px] text-erp-muted">
          Snapshot at {formatDate(count.snapshotAt)} · Tolerance ±{STOCK_COUNT_VARIANCE_TOLERANCE_QTY} qty · High-value threshold {formatCurrency(STOCK_COUNT_HIGH_VALUE_THRESHOLD)}
        </p>
      ) : null}

      {/* Quantity entry / supervisor table */}
      {count && count.lines.length > 0 ? (
        <section className="crm-masters-card mb-6 rounded-lg border border-erp-border bg-erp-surface shadow-[var(--erp-shadow-card)]">
          <div className="flex items-center justify-between border-b border-erp-border px-4 py-3">
            <h2 className="text-[15px] font-semibold text-erp-text">
              {quickCountMode ? 'Quick Count' : currentStep >= 4 ? 'Difference Review' : 'Step 3 — Quantity Entry'}
            </h2>
            {!readOnly && perms.canCountStock ? (
              <button type="button" className="erp-btn erp-btn-secondary h-8 gap-1 px-3 text-[12px]" disabled={busy} onClick={() => void saveLines()}>
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            ) : null}
          </div>
          <div className="overflow-x-auto p-2">
            <table className="erp-table w-full min-w-[900px]">
              <thead>
                <tr>
                  <th>Item</th>
                  {!quickCountMode && <th>Batch</th>}
                  {!quickCountMode && <th>Bin</th>}
                  {!quickCountMode && showSystemQty(count.lines[0]) ? <th className="text-right">System Qty</th> : null}
                  {count.scope.blindCount && !showSystemQty(count.lines[0]) ? <th>System Qty</th> : null}
                  <th className="text-right">Counted Qty</th>
                  {!quickCountMode && <th className="text-right">Difference</th>}
                  {!quickCountMode && perms.canViewCost ? <th className="text-right">Diff Value</th> : null}
                  {!quickCountMode && <th>Reason</th>}
                  {!quickCountMode && supervisorMode ? <th>Movement</th> : null}
                  {!quickCountMode && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {count.lines.map((line) => (
                  <LineRow
                    key={line.id}
                    line={line}
                    count={count}
                    lineEdits={lineEdits}
                    setLineEdits={setLineEdits}
                    recountEdits={recountEdits}
                    setRecountEdits={setRecountEdits}
                    revealReason={revealReason}
                    setRevealReason={setRevealReason}
                    showSystemQty={showSystemQty(line)}
                    quickCountMode={quickCountMode}
                    supervisorMode={supervisorMode}
                    canViewCost={perms.canViewCost}
                    canReveal={perms.canRevealSystemQty}
                    readOnly={readOnly}
                    onReveal={() => void revealSystemQty(line.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Supervisor actions */}
      {count && supervisorMode && !readOnly ? (
        <section className="crm-masters-card mb-6 rounded-lg border border-erp-border bg-erp-surface p-5 shadow-[var(--erp-shadow-card)]">
          <h2 className="text-[15px] font-semibold text-erp-text">Supervisor Review</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {perms.canRequestRecount && ['counting', 'under_review', 'recount_required'].includes(count.status) ? (
              <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void handleRecount()}>
                Request Recount
              </button>
            ) : null}
            {count.status === 'recount_required' && perms.canCountStock ? (
              <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void saveRecount()}>
                Save Recount
              </button>
            ) : null}
            {perms.canApproveStockVariance && count.status === 'under_review' ? (
              <>
                <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void approve()}>
                  <CheckCircle2 className="mr-1 inline h-4 w-4" /> Approve Variance
                </button>
                <Input
                  className="max-w-xs"
                  placeholder="Reject reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] text-red-700" disabled={busy} onClick={() => void reject()}>
                  Reject Variance
                </button>
              </>
            ) : null}
            {perms.canApproveStockVariance && (count.status === 'approved' || count.varianceApproved) ? (
              <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void buildPreview()}>
                Create Adjustment Preview
              </button>
            ) : null}
            {perms.canPostStockCount && (count.status === 'approved' || count.adjustmentPreview) ? (
              <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" disabled={busy || count.status === 'posted'} onClick={() => void postDemo()}>
                <ClipboardCheck className="mr-1 inline h-4 w-4" /> Post Demo
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Counter submit */}
      {count && perms.canCountStock && !readOnly && ['counting', 'recount_required'].includes(count.status) ? (
        <div className="mb-6 flex gap-2">
          <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" disabled={busy} onClick={() => void submit()}>
            <Send className="mr-1 inline h-4 w-4" /> Submit Count
          </button>
        </div>
      ) : null}

      {/* Adjustment preview */}
      {count?.adjustmentPreview ? (
        <section className="crm-masters-card mb-6 rounded-lg border border-erp-border bg-erp-surface p-5 shadow-[var(--erp-shadow-card)]">
          <h2 className="text-[15px] font-semibold text-erp-text">Step 7 — Adjustment Preview</h2>
          <p className="mt-1 text-[13px] text-erp-muted">{count.adjustmentPreview.narration}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-erp-border p-3">
              <span className="text-[12px] text-erp-muted">Qty impact</span>
              <p className="text-lg font-semibold">{formatNumber(count.adjustmentPreview.totalQtyImpact)}</p>
            </div>
            <div className="rounded border border-erp-border p-3">
              <span className="text-[12px] text-erp-muted">Value impact</span>
              <p className="text-lg font-semibold">{formatCurrency(count.adjustmentPreview.totalValueImpact)}</p>
            </div>
          </div>
          {count.adjustmentPreview.lines.length > 0 ? (
            <table className="erp-table mt-4 w-full">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Adj Qty</th>
                  <th className="text-right">Value</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {count.adjustmentPreview.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="font-mono text-[12px]">{l.itemCode}</td>
                    <td className="num">{formatNumber(l.adjustmentQty)}</td>
                    <td className="num">{formatCurrency(l.adjustmentValue)}</td>
                    <td className="text-[12px]">{l.debitAccount}</td>
                    <td className="text-[12px]">{l.creditAccount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-3 text-[13px] text-erp-muted">No adjustment lines — count matched snapshot.</p>
          )}
        </section>
      ) : null}

      {/* Audit history */}
      {count && count.auditHistory.length > 0 ? (
        <section className="crm-masters-card rounded-lg border border-erp-border bg-erp-surface p-5 shadow-[var(--erp-shadow-card)]">
          <h2 className="text-[15px] font-semibold text-erp-text">Audit History</h2>
          <ul className="mt-3 space-y-2">
            {count.auditHistory.map((a) => (
              <li key={a.id} className="border-b border-erp-border pb-2 text-[13px] last:border-0">
                <div className="flex flex-wrap gap-2">
                  <span className="font-semibold">{a.action}</span>
                  <span className="text-erp-muted">{a.userName}</span>
                  <span className="text-erp-muted">{formatDate(a.timestamp)}</span>
                </div>
                {a.remarks ? <p className="text-erp-muted">{a.remarks}</p> : null}
                {a.snapshotData ? (
                  <pre className="mt-1 max-h-24 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                    {JSON.stringify(a.snapshotData, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isNew && !count ? (
        <p className="text-[13px] text-erp-muted">
          Configure scope above, then create a snapshot to begin quantity entry.{' '}
          <Link to="/inventory/stock-count" className="text-erp-primary underline">Back to register</Link>
        </p>
      ) : null}
    </OperationalPageShell>
  )
}

function LineRow({
  line,
  count,
  lineEdits,
  setLineEdits,
  recountEdits,
  setRecountEdits,
  revealReason,
  setRevealReason,
  showSystemQty,
  quickCountMode,
  supervisorMode,
  canViewCost,
  canReveal,
  readOnly,
  onReveal,
}: {
  line: StockCountLine
  count: StockCount
  lineEdits: Record<string, { countedQty: string; reason: string }>
  setLineEdits: Dispatch<SetStateAction<Record<string, { countedQty: string; reason: string }>>>
  recountEdits: Record<string, { recountQty: string; reason: string }>
  setRecountEdits: Dispatch<SetStateAction<Record<string, { recountQty: string; reason: string }>>>
  revealReason: Record<string, string>
  setRevealReason: Dispatch<SetStateAction<Record<string, string>>>
  showSystemQty: boolean
  quickCountMode: boolean
  supervisorMode: boolean
  canViewCost: boolean
  canReveal: boolean
  readOnly: boolean
  onReveal: () => void
}) {
  const edit = lineEdits[line.id] ?? { countedQty: '', reason: '' }
  const counted = edit.countedQty !== '' ? Number(edit.countedQty) : null
  const diff = counted !== null ? counted - line.snapshotSystemQty : line.variance

  return (
    <tr>
      <td>
        <span className="font-mono text-[12px]">{line.itemCode}</span>
        <span className="block text-[11px] text-erp-muted">{line.itemName}</span>
      </td>
      {!quickCountMode && <td className="text-[12px]">{line.batchNo ?? '—'}</td>}
      {!quickCountMode && <td className="text-[12px]">{line.binCode ?? '—'}</td>}
      {!quickCountMode && showSystemQty ? (
        <td className="num">{formatNumber(line.snapshotSystemQty)}</td>
      ) : null}
      {count.scope.blindCount && !showSystemQty ? (
        <td>
          {canReveal && !readOnly ? (
            <div className="flex items-center gap-1">
              <EyeOff className="h-3.5 w-3.5 text-erp-muted" />
              <Input
                className="w-24 text-[11px]"
                placeholder="Reason"
                value={revealReason[line.id] ?? ''}
                onChange={(e) => setRevealReason((r) => ({ ...r, [line.id]: e.target.value }))}
              />
              <button type="button" className="erp-btn erp-btn-ghost h-7 px-2 text-[11px]" onClick={onReveal}>
                <Eye className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <span className="text-[12px] text-erp-muted">Hidden</span>
          )}
        </td>
      ) : null}
      <td className="num">
        {readOnly ? (
          formatNumber(line.countedQty ?? 0)
        ) : (
          <Input
            type="number"
            className="w-20 text-right"
            value={line.lineStatus === 'recount_required' ? (recountEdits[line.id]?.recountQty ?? edit.countedQty) : edit.countedQty}
            onChange={(e) => {
              if (line.lineStatus === 'recount_required') {
                setRecountEdits((r) => ({ ...r, [line.id]: { recountQty: e.target.value, reason: r[line.id]?.reason ?? '' } }))
              }
              setLineEdits((le) => ({ ...le, [line.id]: { ...edit, countedQty: e.target.value } }))
            }}
          />
        )}
      </td>
      {!quickCountMode && <td className={cn('num', diff !== 0 && 'text-amber-800 font-semibold')}>{counted !== null ? formatNumber(diff) : '—'}</td>}
      {!quickCountMode && canViewCost ? <td className="num">{formatCurrency(diff * line.unitCost)}</td> : null}
      {!quickCountMode && (
        <td>
          {readOnly ? (
            line.reason || '—'
          ) : (
            <Input
              className="min-w-[140px] text-[12px]"
              placeholder={diff !== 0 ? 'Required if variance' : 'Optional'}
              value={edit.reason}
              onChange={(e) => setLineEdits((le) => ({ ...le, [line.id]: { ...edit, reason: e.target.value } }))}
            />
          )}
        </td>
      )}
      {!quickCountMode && supervisorMode ? (
        <td className="text-[11px] text-erp-muted">
          {line.movementAfterSnapshot !== 0 ? `${line.movementAfterSnapshot > 0 ? '+' : ''}${line.movementAfterSnapshot}` : '—'}
          {line.previousCountQty !== null ? (
            <span className="block">Prev: {line.previousCountQty} ({line.previousCountDate ? formatDate(line.previousCountDate) : '—'})</span>
          ) : null}
        </td>
      ) : null}
      {!quickCountMode && <td className="text-[12px] capitalize">{line.lineStatus.replace('_', ' ')}</td>}
    </tr>
  )
}

export function StockCountNewPage() {
  return <StockCountWorkbenchPage mode="new" />
}

export function StockCountDetailPage() {
  return <StockCountWorkbenchPage mode="detail" />
}
