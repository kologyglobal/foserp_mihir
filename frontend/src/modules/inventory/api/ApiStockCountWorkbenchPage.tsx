/**
 * Desktop stock count workbench (API mode).
 * Full document lifecycle: DRAFT → snapshot → COUNTING (enter counted qty)
 * → submit → approve → post variance → optional reverse. Uses the live
 * /inventory/stock-counts engine; system qty may be redacted (blind count).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Camera, CheckCheck, ClipboardList, FileCheck2, RefreshCw, RotateCcw, Save, Send } from 'lucide-react'
import { PageHeader } from '../../../components/ui/PageHeader'
import { SectionCard } from '../../../components/ui/SectionCard'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { LoadingState } from '../../../design-system/components/LoadingState'
import { Input } from '../../../components/forms/Inputs'
import { notify } from '../../../store/toastStore'
import { appConfirm, appPromptNote } from '../../../store/confirmDialogStore'
import { formatDate } from '../../../utils/dates/format'
import { canInventoryPermission, useInventoryPermissions } from '../../../utils/permissions/inventory'
import * as documentsApi from '../../../services/api/inventoryDocumentsApi'
import type { ApiInventoryDocument, ApiInventoryDocumentLine } from '../../../services/api/inventoryDocumentsApi'

const STEPS = ['DRAFT', 'SNAPSHOTTED', 'COUNTING', 'SUBMITTED', 'APPROVED', 'POSTED'] as const

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmtQty(v: string | number | null | undefined): string {
  return num(v).toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function StatusStrip({ status }: { status: string }) {
  if (status === 'REVERSED') {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[12px] font-medium text-rose-700">
        REVERSED
      </span>
    )
  }
  const activeIdx = STEPS.indexOf(status as (typeof STEPS)[number])
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      {STEPS.map((step, idx) => (
        <span
          key={step}
          className={
            idx === activeIdx
              ? 'rounded-full bg-erp-primary/10 px-2 py-0.5 font-semibold text-erp-primary'
              : idx < activeIdx
                ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700'
                : 'rounded-full bg-slate-100 px-2 py-0.5 text-erp-muted'
          }
        >
          {step}
        </span>
      ))}
    </div>
  )
}

type LineDraft = { counted: string; remarks: string }

export function ApiStockCountWorkbenchPage() {
  const { id } = useParams<{ id: string }>()
  const perms = useInventoryPermissions()
  const canReverse = canInventoryPermission('inventory.override', perms.role)
  const [doc, setDoc] = useState<ApiInventoryDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({})

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await documentsApi.getInventoryStockCount(id)
      setDoc(res.data)
      setDrafts({})
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Could not load stock count')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const lines = useMemo(() => doc?.lines ?? [], [doc])
  const status = doc?.status ?? ''
  const editable = ['SNAPSHOTTED', 'COUNTING'].includes(status) && perms.canCountStock
  const blindCount = status !== 'DRAFT' && lines.length > 0 && lines.every((l) => l.systemQty === undefined)

  const draftFor = (line: ApiInventoryDocumentLine): LineDraft =>
    drafts[line.id] ?? {
      counted: line.countedQty == null ? '' : String(num(line.countedQty)),
      remarks: line.remarks ?? '',
    }

  const dirtyLines = useMemo(
    () =>
      lines.filter((line) => {
        const draft = drafts[line.id]
        if (!draft) return false
        const savedCounted = line.countedQty == null ? '' : String(num(line.countedQty))
        return draft.counted !== savedCounted || draft.remarks !== (line.remarks ?? '')
      }),
    [lines, drafts],
  )

  const allCounted = lines.length > 0 && lines.every((line) => {
    const draft = drafts[line.id]
    const value = draft ? draft.counted : line.countedQty == null ? '' : String(num(line.countedQty))
    return value.trim() !== '' && Number(value) >= 0
  })

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      notify.success(label)
      await load()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : `${label} failed`)
    } finally {
      setBusy(false)
    }
  }

  const saveCounts = async (): Promise<boolean> => {
    if (!id) return false
    const payload = dirtyLines
      .map((line) => {
        const draft = draftFor(line)
        return {
          lineId: line.id,
          countedQty: Number(draft.counted),
          remarks: draft.remarks.trim() || undefined,
        }
      })
      .filter((entry) => Number.isFinite(entry.countedQty) && entry.countedQty >= 0)
    if (!payload.length) return true
    await documentsApi.enterInventoryStockCount(id, payload)
    return true
  }

  const submit = async () => {
    if (!id) return
    const invalid = dirtyLines.some((line) => {
      const draft = draftFor(line)
      return draft.counted.trim() !== '' && !(Number(draft.counted) >= 0)
    })
    if (invalid) {
      notify.error('Counted quantities must be zero or positive numbers')
      return
    }
    await run('Stock count submitted', async () => {
      await saveCounts()
      await documentsApi.submitInventoryStockCount(id)
    })
  }

  const post = async () => {
    if (!id || !doc) return
    const ok = await appConfirm({
      title: 'Post count variance?',
      description: 'Non-zero variances post as stock adjustments through the inventory ledger.',
      detail: doc.countNumber,
      confirmLabel: 'Post',
    })
    if (!ok) return
    await run('Stock count posted', () => documentsApi.postInventoryStockCount(id))
  }

  const reverse = async () => {
    if (!id || !doc) return
    const reason = await appPromptNote({
      title: 'Reverse posted stock count?',
      description: 'Posts negating adjustments for every variance line. The document becomes REVERSED.',
      detail: doc.countNumber,
      tone: 'danger',
      confirmLabel: 'Reverse',
      note: { label: 'Reversal reason', required: true },
    })
    if (reason == null) return
    await run('Stock count reversed', () => documentsApi.reverseInventoryStockCount(id, reason))
  }

  if (!id) return <Navigate to="/inventory/stock-count" replace />

  const number = doc?.countNumber ?? id.slice(0, 8)
  const varianceLines = lines.filter((l) => l.countedQty != null && num(l.varianceQty) !== 0)

  return (
    <div className="erp-page">
      <PageHeader
        title={`Stock Count ${number}`}
        description="Snapshot system quantity, enter the physical count, then approve and post the variance."
        breadcrumbs={[
          { label: 'Store', to: '/inventory' },
          { label: 'Stock Counts', to: '/inventory/stock-count' },
          { label: number },
        ]}
        actions={(
          <div className="flex flex-wrap gap-2">
            {status === 'DRAFT' && perms.canCreateStockCount ? (
              <Button size="sm" disabled={busy} onClick={() => void run('Snapshot captured', () => documentsApi.snapshotInventoryStockCount(id))}>
                <Camera className="h-4 w-4" /> Take Snapshot
              </Button>
            ) : null}
            {editable ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || dirtyLines.length === 0}
                  onClick={() => void run('Counted quantities saved', saveCounts)}
                >
                  <Save className="h-4 w-4" /> Save Counts
                </Button>
                {perms.canReviewStockCount ? (
                  <Button size="sm" disabled={busy || !allCounted} onClick={() => void submit()}>
                    <Send className="h-4 w-4" /> Submit Count
                  </Button>
                ) : null}
              </>
            ) : null}
            {status === 'SUBMITTED' && perms.canApproveStockVariance ? (
              <Button size="sm" disabled={busy} onClick={() => void run('Stock count approved', () => documentsApi.approveInventoryStockCount(id))}>
                <CheckCheck className="h-4 w-4" /> Approve
              </Button>
            ) : null}
            {status === 'APPROVED' && perms.canPostStockCount ? (
              <Button size="sm" disabled={busy} onClick={() => void post()}>
                <FileCheck2 className="h-4 w-4" /> Post Variance
              </Button>
            ) : null}
            {status === 'POSTED' && canReverse ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void reverse()}>
                <RotateCcw className="h-4 w-4" /> Reverse
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        )}
      />

      {loading ? (
        <div className="p-6"><LoadingState variant="table" rows={8} /></div>
      ) : !doc ? (
        <EmptyState icon={ClipboardList} title="Stock count not found" description="It may have been removed, or you may not hold inventory.stock_count.view." />
      ) : (
        <>
          <SectionCard title="Document">
            <div className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-erp-muted">Warehouse</div>
                <div>{doc.warehouse ? `${doc.warehouse.code} — ${doc.warehouse.name}` : doc.warehouseId ?? '-'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-erp-muted">Count Date</div>
                <div>{doc.countDate ? formatDate(doc.countDate) : '-'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-erp-muted">Lines</div>
                <div>{lines.length}{varianceLines.length ? ` · ${varianceLines.length} with variance` : ''}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-erp-muted">Remarks</div>
                <div>{doc.remarks || '-'}</div>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <StatusStrip status={status} />
              </div>
            </div>
          </SectionCard>

          {status === 'DRAFT' ? (
            <SectionCard title="Next step" className="mt-3">
              <p className="text-[13px] text-erp-muted">
                Take a snapshot to freeze system quantities.
                {lines.length === 0
                  ? ' No item list was given, so the snapshot will load every active stockable item in this warehouse.'
                  : ` The snapshot will refresh system quantity for the ${lines.length} selected item(s).`}
              </p>
            </SectionCard>
          ) : (
            <SectionCard title="Count Sheet" noPadding className="mt-3">
              {blindCount ? (
                <p className="border-b border-erp-border px-3 py-2 text-[12px] text-erp-muted">
                  Blind count — system quantities are hidden until submission (requires reveal permission to view).
                </p>
              ) : null}
              {lines.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={ClipboardList} title="No lines" description="Snapshot did not find stockable items for this warehouse." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="erp-table w-full min-w-[760px] text-[13px]">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="w-32 text-right">System Qty</th>
                        <th className="w-40 text-right">Counted Qty</th>
                        <th className="w-32 text-right">Variance</th>
                        <th className="w-72">Line Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const draft = draftFor(line)
                        const hasSystem = line.systemQty !== undefined
                        const liveVariance =
                          hasSystem && draft.counted.trim() !== '' && Number.isFinite(Number(draft.counted))
                            ? Number(draft.counted) - num(line.systemQty)
                            : null
                        const variance = editable ? liveVariance : hasSystem && line.countedQty != null ? num(line.varianceQty) : null
                        return (
                          <tr key={line.id}>
                            <td>
                              {line.item ? (
                                <span><span className="font-mono">{line.item.code}</span> — {line.item.name}</span>
                              ) : (
                                <span className="font-mono">{line.itemId.slice(0, 8)}</span>
                              )}
                            </td>
                            <td className="text-right tabular-nums">{hasSystem ? fmtQty(line.systemQty) : '-'}</td>
                            <td className="text-right">
                              {editable ? (
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="ml-auto w-32 text-right"
                                  value={draft.counted}
                                  onChange={(e) =>
                                    setDrafts((d) => ({ ...d, [line.id]: { ...draftFor(line), ...d[line.id], counted: e.target.value } }))
                                  }
                                />
                              ) : (
                                <span className="tabular-nums">{line.countedQty == null ? '-' : fmtQty(line.countedQty)}</span>
                              )}
                            </td>
                            <td className="text-right tabular-nums">
                              {variance == null ? (
                                <span className="text-erp-muted">-</span>
                              ) : (
                                <span className={variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-emerald-600' : ''}>
                                  {variance > 0 ? '+' : ''}{fmtQty(variance)}
                                </span>
                              )}
                            </td>
                            <td>
                              {editable ? (
                                <Input
                                  className="w-full min-w-40"
                                  value={draft.remarks}
                                  placeholder="Optional"
                                  onChange={(e) =>
                                    setDrafts((d) => ({ ...d, [line.id]: { ...draftFor(line), ...d[line.id], remarks: e.target.value } }))
                                  }
                                />
                              ) : (
                                <span>{line.remarks || '-'}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          <p className="mt-3 text-[12px] text-erp-muted">
            Posted variances appear in the <Link className="text-erp-primary hover:underline" to="/inventory/movements">stock ledger</Link> as STOCK_COUNT adjustments.
          </p>
        </>
      )}
    </div>
  )
}
